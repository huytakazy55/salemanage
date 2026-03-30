const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/categories — filtered by store
router.get('/', async (req, res) => {
    try {
        let query, params;
        if (req.user.role === 'super_admin') {
            query = `SELECT c.*, COUNT(p.id)::int as product_count, s.name as store_name
                     FROM categories c
                     LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
                     LEFT JOIN stores s ON s.id = c.store_id
                     GROUP BY c.id, s.name ORDER BY c.name`;
            params = [];
        } else {
            query = `SELECT c.*, COUNT(p.id)::int as product_count
                     FROM categories c
                     LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
                     WHERE c.store_id = $1
                     GROUP BY c.id ORDER BY c.name`;
            params = [req.user.store_id];
        }
        const { rows } = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/categories
router.post('/', requireAdmin, async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Tên danh mục là bắt buộc' });
        const storeId = req.user.role === 'super_admin' ? (req.body.store_id || null) : req.user.store_id;
        const { rows: [cat] } = await pool.query(
            'INSERT INTO categories (store_id, name, description) VALUES ($1,$2,$3) RETURNING *',
            [storeId, name, description || null]
        );
        res.status(201).json({ success: true, data: cat });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ success: false, error: 'Tên danh mục đã tồn tại trong cửa hàng này' });
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/categories/:id
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const { name, description } = req.body;
        const { rows: [cat] } = await pool.query(
            'UPDATE categories SET name=$1, description=$2 WHERE id=$3 RETURNING *',
            [name, description || null, req.params.id]
        );
        res.json({ success: true, data: cat });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// DELETE /api/categories/:id
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Đã xóa danh mục' });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
