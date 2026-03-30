const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');

// GET inventory logs
router.get('/', async (req, res) => {
    try {
        const { type, product_id, from, to } = req.query;
        let query = `
      SELECT il.*, p.name as product_name, p.sku, p.stock as current_stock
      FROM inventory_logs il
      JOIN products p ON il.product_id = p.id
      WHERE 1=1
    `;
        const params = [];
        if (type) { params.push(type); query += ` AND il.type = $${params.length}`; }
        if (product_id) { params.push(product_id); query += ` AND il.product_id = $${params.length}`; }
        if (from) { params.push(from); query += ` AND il.created_at::date >= $${params.length}`; }
        if (to) { params.push(to); query += ` AND il.created_at::date <= $${params.length}`; }
        query += ` ORDER BY il.created_at DESC LIMIT 200`;
        const { rows } = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST nhập kho
router.post('/import', async (req, res) => {
    const client = await pool.connect();
    try {
        const { product_id, quantity, cost_price, note } = req.body;
        if (!product_id || !quantity) return res.status(400).json({ success: false, error: 'Thiếu thông tin' });

        await client.query('BEGIN');
        await client.query(
            `INSERT INTO inventory_logs (product_id, type, quantity, cost_price, note) VALUES ($1,'import',$2,$3,$4)`,
            [product_id, quantity, cost_price || null, note || 'Nhập kho']
        );
        await client.query(
            `UPDATE products SET stock = stock + $1${cost_price ? ', cost_price = $2' : ''} WHERE id = ${cost_price ? '$3' : '$2'}`,
            cost_price ? [quantity, cost_price, product_id] : [quantity, product_id]
        );
        const { rows: [product] } = await client.query('SELECT * FROM products WHERE id = $1', [product_id]);
        await client.query('COMMIT');
        res.json({ success: true, data: product, message: 'Nhập kho thành công' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: err.message });
    } finally { client.release(); }
});

// POST điều chỉnh kho
router.post('/adjust', async (req, res) => {
    const client = await pool.connect();
    try {
        const { product_id, new_quantity, note } = req.body;
        if (!product_id || new_quantity === undefined) return res.status(400).json({ success: false, error: 'Thiếu thông tin' });

        await client.query('BEGIN');
        const { rows: [current] } = await client.query('SELECT stock FROM products WHERE id = $1', [product_id]);
        const diff = parseInt(new_quantity) - current.stock;
        await client.query(
            `INSERT INTO inventory_logs (product_id, type, quantity, note) VALUES ($1,'adjust',$2,$3)`,
            [product_id, diff, note || 'Điều chỉnh kho']
        );
        await client.query('UPDATE products SET stock = $1 WHERE id = $2', [new_quantity, product_id]);
        const { rows: [product] } = await client.query('SELECT * FROM products WHERE id = $1', [product_id]);
        await client.query('COMMIT');
        res.json({ success: true, data: product });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: err.message });
    } finally { client.release(); }
});

module.exports = router;
