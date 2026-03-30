const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { pool } = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.use(requireAuth);

// Helper: store filter for queries
function getStoreFilter(user, paramOffset = 0) {
    if (user.role === 'super_admin') return { clause: '', params: [], nextIdx: paramOffset + 1 };
    return {
        clause: `AND p.store_id = $${paramOffset + 1}`,
        params: [user.store_id],
        nextIdx: paramOffset + 2,
    };
}

// GET /api/products
router.get('/', async (req, res) => {
    try {
        const { search, category_id, low_stock } = req.query;
        const sf = getStoreFilter(req.user, 0);
        let query = `
            SELECT p.*, c.name as category_name
            FROM products p LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = TRUE ${sf.clause}
        `;
        const params = [...sf.params];
        let idx = sf.nextIdx;
        if (search) { params.push(`%${search}%`); query += ` AND (p.name ILIKE $${idx} OR p.sku ILIKE $${idx})`; idx++; }
        if (category_id) { params.push(category_id); query += ` AND p.category_id = $${idx}`; idx++; }
        if (low_stock === 'true') query += ` AND p.stock <= p.min_stock`;
        query += ` ORDER BY p.name`;
        const { rows } = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
    try {
        const sf = getStoreFilter(req.user, 1);
        const { rows } = await pool.query(`
            SELECT p.*, c.name as category_name
            FROM products p LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = $1 ${sf.clause}
        `, [req.params.id, ...sf.params]);
        if (!rows[0]) return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm' });
        res.json({ success: true, data: rows[0] });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/products
router.post('/', requireAdmin, upload.single('image'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, sku, category_id, cost_price, sell_price, stock, min_stock, unit, description } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Tên sản phẩm là bắt buộc' });
        const storeId = req.user.role === 'super_admin' ? (req.body.store_id || null) : req.user.store_id;
        const image_url = req.file ? `/uploads/${req.file.filename}` : null;

        const { rows: [product] } = await client.query(`
            INSERT INTO products (store_id, name, sku, category_id, cost_price, sell_price, stock, min_stock, unit, description, image_url)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
        `, [storeId, name, sku || null, category_id || null, cost_price || 0, sell_price || 0, stock || 0, min_stock || 5, unit || 'cái', description || null, image_url]);

        if ((stock || 0) > 0) {
            await client.query(
                `INSERT INTO inventory_logs (product_id, type, quantity, cost_price, note) VALUES ($1,'import',$2,$3,'Nhập kho khi tạo sản phẩm')`,
                [product.id, stock, cost_price]
            );
        }
        res.status(201).json({ success: true, data: product });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally { client.release(); }
});

// PUT /api/products/:id
router.put('/:id', requireAdmin, upload.single('image'), async (req, res) => {
    try {
        const { name, sku, category_id, cost_price, sell_price, min_stock, unit, description } = req.body;
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
            query = `UPDATE products SET name=$1, sku=$2, category_id=$3, cost_price=$4, sell_price=$5, min_stock=$6, unit=$7, description=$8, image_url=$9 WHERE id=$10 RETURNING *`;
            params = [name, sku || null, category_id || null, cost_price || 0, sell_price || 0, min_stock || 5, unit || 'cái', description || null, image_url, req.params.id];
        } else {
            query = `UPDATE products SET name=$1, sku=$2, category_id=$3, cost_price=$4, sell_price=$5, min_stock=$6, unit=$7, description=$8 WHERE id=$9 RETURNING *`;
            params = [name, sku || null, category_id || null, cost_price || 0, sell_price || 0, min_stock || 5, unit || 'cái', description || null, req.params.id];
        }
        const { rows: [product] } = await pool.query(query, params);
        res.json({ success: true, data: product });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// DELETE /api/products/:id (soft delete)
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        await pool.query('UPDATE products SET is_active = FALSE WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Đã xóa sản phẩm' });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
