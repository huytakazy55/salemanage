const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { pool } = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { auditLog, diffFields } = require('../utils/audit');

router.use(requireAuth);

// Helper: get branch_id for current user's store (or null for super_admin when no filter)
async function getUserBranchId(user) {
    if (user.role === 'super_admin') return null; // super_admin sees all
    if (!user.store_id) return null;
    const { rows: [s] } = await pool.query('SELECT branch_id FROM stores WHERE id = $1', [user.store_id]);
    return s?.branch_id || null;
}

// GET /api/products — returns products with per-store stock quantity
router.get('/', async (req, res) => {
    try {
        const { search, category_id, low_stock } = req.query;
        const branchId = await getUserBranchId(req.user);
        const storeId = req.user.role === 'super_admin' ? null : req.user.store_id;

        let query = `
            SELECT p.*,
                   c.name as category_name,
                   COALESCE(ss.quantity, 0) as stock
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN store_stock ss ON ss.product_id = p.id AND ss.store_id = $1
            WHERE p.is_active = TRUE
        `;
        const params = [storeId];
        let idx = 2;

        if (branchId) { params.push(branchId); query += ` AND p.branch_id = $${idx++}`; }

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (p.name ILIKE $${idx} OR p.sku ILIKE $${idx})`;
            idx++;
        }
        if (category_id) { params.push(category_id); query += ` AND p.category_id = $${idx++}`; }
        if (low_stock === 'true') query += ` AND COALESCE(ss.quantity, 0) <= p.min_stock`;
        query += ` ORDER BY p.name`;

        const { rows } = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
    try {
        const storeId = req.user.role === 'super_admin' ? null : req.user.store_id;
        const { rows } = await pool.query(`
            SELECT p.*, c.name as category_name, COALESCE(ss.quantity, 0) as stock
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN store_stock ss ON ss.product_id = p.id AND ss.store_id = $2
            WHERE p.id = $1 AND p.is_active = TRUE
        `, [req.params.id, storeId]);
        if (!rows[0]) return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm' });
        res.json({ success: true, data: rows[0] });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/products/bulk — admin only, import multiple products from Excel
router.post('/bulk', requireAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { products: items } = req.body;
        if (!Array.isArray(items) || items.length === 0)
            return res.status(400).json({ success: false, error: 'Danh sách sản phẩm trống' });

        // Determine branch_id
        let branchId;
        if (req.user.role === 'super_admin') {
            branchId = req.body.branch_id || null;
        } else {
            const { rows: [s] } = await pool.query('SELECT branch_id FROM stores WHERE id = $1', [req.user.store_id]);
            branchId = s?.branch_id || null;
        }
        if (!branchId) return res.status(400).json({ success: false, error: 'Cửa hàng chưa được gán chi nhánh' });

        const { rows: branchStores } = await pool.query('SELECT id FROM stores WHERE branch_id = $1 AND is_active = TRUE', [branchId]);

        await client.query('BEGIN');
        let created = 0, skipped = 0;
        const errors = [];

        for (const item of items) {
            const name = (item['Tên sản phẩm'] || item['name'] || '').toString().trim();
            if (!name) { skipped++; continue; }

            const sku = (item['SKU'] || item['sku'] || '').toString().trim() || null;
            const cost_price = parseFloat(item['Giá vốn'] || item['cost_price'] || 0) || 0;
            const stock = parseInt(item['Tồn kho'] || item['stock'] || 0) || 0;
            const min_stock = parseInt(item['Tồn tối thiểu'] || item['min_stock'] || 5) || 5;
            const unit = (item['Đơn vị'] || item['unit'] || 'cái').toString().trim();
            const description = (item['Mô tả'] || item['description'] || '').toString().trim() || null;
            const commission_pct = parseFloat(item['Hoa hồng %'] || item['commission_pct'] || 0) || 0;

            try {
                // Check for duplicate SKU manually (works even without unique constraint)
                if (sku) {
                    const { rows: exists } = await client.query(
                        'SELECT id FROM products WHERE branch_id=$1 AND sku=$2 AND is_active=TRUE LIMIT 1',
                        [branchId, sku]
                    );
                    if (exists.length > 0) { skipped++; continue; }
                }

                const { rows: [product] } = await client.query(`
                    INSERT INTO products (branch_id, name, sku, cost_price, sell_price, min_stock, unit, description, commission_pct)
                    VALUES ($1,$2,$3,$4,0,$5,$6,$7,$8) RETURNING *
                `, [branchId, name, sku || null, cost_price, min_stock, unit, description, commission_pct]);


                if (product) {
                    for (const store of branchStores) {
                        const qty = store.id === req.user.store_id ? stock : 0;
                        await client.query(
                            'INSERT INTO store_stock (product_id, store_id, quantity) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
                            [product.id, store.id, qty]
                        );
                    }
                    if (stock > 0 && req.user.store_id) {
                        await client.query(
                            `INSERT INTO inventory_logs (product_id, store_id, type, quantity, cost_price, note) VALUES ($1,$2,'import',$3,$4,'Import từ Excel')`,
                            [product.id, req.user.store_id, stock, cost_price]
                        );
                    }
                    created++;
                } else {
                    skipped++; // duplicate SKU
                }
            } catch (e) {
                errors.push({ name, error: e.message });
                skipped++;
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `Đã thêm ${created} sản phẩm, bỏ qua ${skipped}`, created, skipped, errors });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: err.message });
    } finally { client.release(); }
});

// POST /api/products — admin only, creates product at branch level + store_stock for all branch stores
router.post('/', requireAdmin, upload.single('image'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, sku, category_id, cost_price, sell_price, stock, min_stock, unit, description, commission_pct } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Tên sản phẩm là bắt buộc' });

        // Determine branch_id
        let branchId;
        if (req.user.role === 'super_admin') {
            branchId = req.body.branch_id || null;
        } else {
            const { rows: [s] } = await pool.query('SELECT branch_id FROM stores WHERE id = $1', [req.user.store_id]);
            branchId = s?.branch_id || null;
        }
        if (!branchId) return res.status(400).json({ success: false, error: 'Cửa hàng chưa được gán chi nhánh. Vui lòng gán chi nhánh trước.' });

        const image_url = req.file ? `/uploads/${req.file.filename}` : null;

        await client.query('BEGIN');
        const { rows: [product] } = await client.query(`
            INSERT INTO products (branch_id, name, sku, category_id, cost_price, sell_price, min_stock, unit, description, image_url, commission_pct)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
        `, [branchId, name, sku || null, category_id || null, cost_price || 0, sell_price || 0, min_stock || 5, unit || 'cái', description || null, image_url, commission_pct || 0]);

        // Create store_stock for every store in this branch
        const { rows: branchStores } = await client.query('SELECT id FROM stores WHERE branch_id = $1 AND is_active = TRUE', [branchId]);
        const initialQty = parseInt(stock || 0);

        for (const store of branchStores) {
            const qty = store.id === req.user.store_id ? initialQty : 0;
            await client.query(
                'INSERT INTO store_stock (product_id, store_id, quantity) VALUES ($1,$2,$3) ON CONFLICT (product_id, store_id) DO NOTHING',
                [product.id, store.id, qty]
            );
        }

        // Log initial stock for creating store
        if (initialQty > 0 && req.user.store_id) {
            await client.query(
                `INSERT INTO inventory_logs (product_id, store_id, type, quantity, cost_price, note) VALUES ($1,$2,'import',$3,$4,'Nhập kho khi tạo sản phẩm')`,
                [product.id, req.user.store_id, initialQty, cost_price]
            );
        }

        await client.query('COMMIT');

        // Return with stock for current store
        const storeQty = initialQty;
        res.status(201).json({ success: true, data: { ...product, stock: storeQty } });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: err.message });
    } finally { client.release(); }
});

// PUT /api/products/:id
router.put('/:id', requireAdmin, upload.single('image'), async (req, res) => {
    try {
        const { name, sku, category_id, cost_price, sell_price, min_stock, unit, description, commission_pct } = req.body;
        let image_url;
        if (req.file) {
            image_url = `/uploads/${req.file.filename}`;
            const { rows: [old] } = await pool.query('SELECT image_url FROM products WHERE id = $1', [req.params.id]);
            if (old?.image_url) {
                const oldPath = path.join(__dirname, '../../', old.image_url);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
        }
        let query, params;
        if (image_url) {
            query = `UPDATE products SET name=$1, sku=$2, category_id=$3, cost_price=$4, sell_price=$5, min_stock=$6, unit=$7, description=$8, image_url=$9, commission_pct=$10 WHERE id=$11 RETURNING *`;
            params = [name, sku || null, category_id || null, cost_price || 0, sell_price || 0, min_stock || 5, unit || 'cái', description || null, image_url, commission_pct || 0, req.params.id];
        } else {
            query = `UPDATE products SET name=$1, sku=$2, category_id=$3, cost_price=$4, sell_price=$5, min_stock=$6, unit=$7, description=$8, commission_pct=$9 WHERE id=$10 RETURNING *`;
            params = [name, sku || null, category_id || null, cost_price || 0, sell_price || 0, min_stock || 5, unit || 'cái', description || null, commission_pct || 0, req.params.id];
        }
        const { rows: [oldProduct] } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
        const { rows: [product] } = await pool.query(query, params);
        // Audit log
        const changed = diffFields(oldProduct, product);
        await auditLog({ action: 'UPDATE', entityType: 'products', entityId: product?.id,
            entityName: product?.name, changedFields: changed,
            userId: req.user.id, storeId: req.user.store_id });
        res.json({ success: true, data: product });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// DELETE /api/products/:id (soft delete)
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const { rows: [old] } = await pool.query('SELECT name FROM products WHERE id = $1', [req.params.id]);
        await pool.query('UPDATE products SET is_active = FALSE WHERE id = $1', [req.params.id]);
        await auditLog({ action: 'DELETE', entityType: 'products', entityId: parseInt(req.params.id),
            entityName: old?.name, userId: req.user.id, storeId: req.user.store_id });
        res.json({ success: true, message: 'Đã xóa sản phẩm' });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
