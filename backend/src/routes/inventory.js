const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET inventory logs for current store
router.get('/', async (req, res) => {
    try {
        const { type, product_id, from, to } = req.query;
        const storeId = req.user.role === 'super_admin' ? null : req.user.store_id;

        let query = `
            SELECT il.*, p.name as product_name, p.sku,
                   COALESCE(ss.quantity, 0) as current_stock
            FROM inventory_logs il
            JOIN products p ON il.product_id = p.id
            LEFT JOIN store_stock ss ON ss.product_id = p.id AND ss.store_id = il.store_id
            WHERE 1=1
        `;
        const params = [];
        let idx = 1;

        if (storeId) { params.push(storeId); query += ` AND il.store_id = $${idx++}`; }
        if (type) { params.push(type); query += ` AND il.type = $${idx++}`; }
        if (product_id) { params.push(product_id); query += ` AND il.product_id = $${idx++}`; }
        if (from) { params.push(from); query += ` AND il.created_at::date >= $${idx++}`; }
        if (to) { params.push(to); query += ` AND il.created_at::date <= $${idx++}`; }
        query += ` ORDER BY il.created_at DESC LIMIT 200`;

        const { rows } = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/inventory/import — nhập kho (cộng store_stock)
router.post('/import', async (req, res) => {
    const client = await pool.connect();
    try {
        const { product_id, quantity, cost_price, note } = req.body;
        if (!product_id || !quantity) return res.status(400).json({ success: false, error: 'Thiếu thông tin' });

        const storeId = req.user.store_id;
        if (!storeId) return res.status(400).json({ success: false, error: 'Không xác định được cửa hàng' });

        await client.query('BEGIN');

        // Upsert store_stock
        await client.query(`
            INSERT INTO store_stock (product_id, store_id, quantity)
            VALUES ($1, $2, $3)
            ON CONFLICT (product_id, store_id) DO UPDATE SET quantity = store_stock.quantity + $3
        `, [product_id, storeId, quantity]);

        // Update product cost_price if provided
        if (cost_price) {
            await client.query('UPDATE products SET cost_price = $1 WHERE id = $2', [cost_price, product_id]);
        }

        await client.query(
            `INSERT INTO inventory_logs (product_id, store_id, type, quantity, cost_price, note)
             VALUES ($1,$2,'import',$3,$4,$5)`,
            [product_id, storeId, quantity, cost_price || null, note || 'Nhập kho']
        );

        const { rows: [product] } = await client.query(`
            SELECT p.*, COALESCE(ss.quantity,0) as stock
            FROM products p
            LEFT JOIN store_stock ss ON ss.product_id = p.id AND ss.store_id = $2
            WHERE p.id = $1
        `, [product_id, storeId]);

        await client.query('COMMIT');
        res.json({ success: true, data: product, message: 'Nhập kho thành công' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: err.message });
    } finally { client.release(); }
});

// POST /api/inventory/adjust — điều chỉnh kho (set store_stock)
router.post('/adjust', async (req, res) => {
    const client = await pool.connect();
    try {
        const { product_id, new_quantity, note } = req.body;
        if (!product_id || new_quantity === undefined) return res.status(400).json({ success: false, error: 'Thiếu thông tin' });

        const storeId = req.user.store_id;
        if (!storeId) return res.status(400).json({ success: false, error: 'Không xác định được cửa hàng' });

        await client.query('BEGIN');

        const { rows: [current] } = await client.query(
            'SELECT quantity FROM store_stock WHERE product_id = $1 AND store_id = $2',
            [product_id, storeId]
        );
        const currentQty = current?.quantity || 0;
        const diff = parseInt(new_quantity) - currentQty;

        await client.query(`
            INSERT INTO store_stock (product_id, store_id, quantity)
            VALUES ($1, $2, $3)
            ON CONFLICT (product_id, store_id) DO UPDATE SET quantity = $3
        `, [product_id, storeId, new_quantity]);

        await client.query(
            `INSERT INTO inventory_logs (product_id, store_id, type, quantity, note) VALUES ($1,$2,'adjust',$3,$4)`,
            [product_id, storeId, diff, note || 'Điều chỉnh kho']
        );

        const { rows: [product] } = await client.query(`
            SELECT p.*, COALESCE(ss.quantity,0) as stock
            FROM products p
            LEFT JOIN store_stock ss ON ss.product_id = p.id AND ss.store_id = $2
            WHERE p.id = $1
        `, [product_id, storeId]);

        await client.query('COMMIT');
        res.json({ success: true, data: product });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: err.message });
    } finally { client.release(); }
});

module.exports = router;
