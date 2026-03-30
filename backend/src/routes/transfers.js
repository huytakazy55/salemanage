const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

/**
 * POST /api/transfers
 * Body: { product_id, to_store_id, quantity, note }
 * product_id là branch-level — cùng product_id cho tất cả stores trong branch.
 * Chỉ cần cộng/trừ store_stock, KHÔNG cần match tên/SKU.
 */
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        const { product_id, to_store_id, quantity, note } = req.body;
        if (!product_id || !to_store_id || !quantity) {
            return res.status(400).json({ success: false, error: 'Thiếu thông tin: cần product_id, to_store_id, quantity' });
        }
        const qty = parseInt(quantity);
        if (isNaN(qty) || qty <= 0) return res.status(400).json({ success: false, error: 'Số lượng phải là số nguyên dương' });

        // Determine source store
        const fromStoreId = req.user.role === 'super_admin'
            ? (req.body.from_store_id ? parseInt(req.body.from_store_id) : null)
            : req.user.store_id;
        if (!fromStoreId) return res.status(400).json({ success: false, error: 'Không xác định được cửa hàng nguồn' });
        if (fromStoreId === parseInt(to_store_id)) return res.status(400).json({ success: false, error: 'Cửa hàng nguồn và đích không được trùng nhau' });

        await client.query('BEGIN');

        // 1. Verify product exists and is active
        const { rows: [product] } = await client.query('SELECT * FROM products WHERE id = $1 AND is_active = TRUE', [product_id]);
        if (!product) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm' }); }

        // 2. Check both stores belong to same branch
        const { rows: [srcStore] } = await client.query('SELECT id, name, branch_id FROM stores WHERE id = $1', [fromStoreId]);
        const { rows: [dstStore] } = await client.query('SELECT id, name, branch_id FROM stores WHERE id = $1', [to_store_id]);
        if (!srcStore || !dstStore) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: 'Không tìm thấy cửa hàng' }); }
        if (!srcStore.branch_id || !dstStore.branch_id || srcStore.branch_id !== dstStore.branch_id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'Chỉ được chuyển hàng giữa các cửa hàng trong cùng chi nhánh' });
        }
        if (product.branch_id !== srcStore.branch_id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'Sản phẩm không thuộc chi nhánh này' });
        }

        // 3. Check source stock
        const { rows: [srcSS] } = await client.query(
            'SELECT quantity FROM store_stock WHERE product_id = $1 AND store_id = $2',
            [product_id, fromStoreId]
        );
        const srcQty = srcSS?.quantity || 0;
        if (srcQty < qty) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: `Không đủ hàng. Tồn kho hiện tại: ${srcQty} ${product.unit}` });
        }

        // 4. Ensure destination store_stock row exists (upsert with 0)
        await client.query(`
            INSERT INTO store_stock (product_id, store_id, quantity)
            VALUES ($1, $2, 0)
            ON CONFLICT (product_id, store_id) DO NOTHING
        `, [product_id, parseInt(to_store_id)]);

        // 5. Decrement source, increment destination
        await client.query('UPDATE store_stock SET quantity = quantity - $1 WHERE product_id = $2 AND store_id = $3', [qty, product_id, fromStoreId]);
        await client.query('UPDATE store_stock SET quantity = quantity + $1 WHERE product_id = $2 AND store_id = $3', [qty, product_id, parseInt(to_store_id)]);

        const userId = req.user.id;
        const userName = req.user.full_name || req.user.username;
        const transferNote = note ? ` — ${note}` : '';
        const outNote = `Chuyển hàng sang ${dstStore.name}${transferNote} (bởi ${userName})`;
        const inNote  = `Nhận hàng từ ${srcStore.name}${transferNote} (bởi ${userName})`;

        await client.query(
            `INSERT INTO inventory_logs (product_id, store_id, type, quantity, note, related_store_id, performed_by_user_id)
             VALUES ($1,$2,'transfer_out',$3,$4,$5,$6)`,
            [product_id, fromStoreId, qty, outNote, parseInt(to_store_id), userId]
        );
        await client.query(
            `INSERT INTO inventory_logs (product_id, store_id, type, quantity, note, related_store_id, performed_by_user_id)
             VALUES ($1,$2,'transfer_in',$3,$4,$5,$6)`,
            [product_id, parseInt(to_store_id), qty, inNote, fromStoreId, userId]
        );

        await client.query('COMMIT');

        const { rows: [updatedSS] } = await pool.query('SELECT quantity FROM store_stock WHERE product_id=$1 AND store_id=$2', [product_id, fromStoreId]);
        res.json({
            success: true,
            message: `Đã chuyển ${qty} ${product.unit} "${product.name}" sang ${dstStore.name}`,
            data: { remaining_stock: updatedSS?.quantity || 0 }
        });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: err.message });
    } finally { client.release(); }
});

/**
 * GET /api/transfers — lịch sử chuyển hàng
 */
router.get('/', async (req, res) => {
    try {
        const { from, to } = req.query;
        const storeId = req.user.role === 'super_admin' ? null : req.user.store_id;
        let query = `
            SELECT il.*, p.name as product_name, p.sku, p.unit,
                   ss.quantity as current_stock,
                   s_il.name as store_name,
                   rs.name as related_store_name,
                   u.full_name as performed_by_name
            FROM inventory_logs il
            JOIN products p ON il.product_id = p.id
            LEFT JOIN stores s_il ON il.store_id = s_il.id
            LEFT JOIN store_stock ss ON ss.product_id = p.id AND ss.store_id = il.store_id
            LEFT JOIN stores rs ON il.related_store_id = rs.id
            LEFT JOIN users u ON il.performed_by_user_id = u.id
            WHERE il.type IN ('transfer_in', 'transfer_out')
        `;
        const params = [];
        let idx = 1;
        if (storeId) { params.push(storeId); query += ` AND il.store_id = $${idx++}`; }
        if (from) { params.push(from); query += ` AND il.created_at::date >= $${idx++}`; }
        if (to)   { params.push(to);   query += ` AND il.created_at::date <= $${idx++}`; }
        query += ` ORDER BY il.created_at DESC LIMIT 300`;
        const { rows } = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

/**
 * GET /api/transfers/stores — stores cùng branch (để chọn đích)
 */
router.get('/stores', async (req, res) => {
    try {
        let query, params;
        if (req.user.role === 'super_admin') {
            query = `SELECT s.id, s.name, s.address, b.name as branch_name
                     FROM stores s LEFT JOIN branches b ON b.id = s.branch_id
                     WHERE s.is_active = TRUE ORDER BY b.name NULLS LAST, s.name`;
            params = [];
        } else {
            const { rows: [myStore] } = await pool.query('SELECT branch_id FROM stores WHERE id = $1', [req.user.store_id]);
            if (!myStore?.branch_id) return res.json({ success: true, data: [], message: 'Cửa hàng chưa thuộc chi nhánh nào' });
            query = `SELECT s.id, s.name, s.address FROM stores s
                     WHERE s.is_active = TRUE AND s.branch_id = $1 AND s.id != $2
                     ORDER BY s.name`;
            params = [myStore.branch_id, req.user.store_id];
        }
        const { rows } = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
