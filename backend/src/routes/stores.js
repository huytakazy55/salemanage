const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { requireAuth, requireSuperAdmin, requireAdmin } = require('../middleware/auth');

// GET /api/stores — super_admin: all stores, admin: own store only
router.get('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        let query, params;
        if (req.user.role === 'super_admin') {
            query = `SELECT s.*, COUNT(u.id) FILTER (WHERE u.is_active) as user_count
                     FROM stores s LEFT JOIN users u ON u.store_id = s.id
                     WHERE s.is_active = TRUE GROUP BY s.id ORDER BY s.id`;
            params = [];
        } else {
            query = `SELECT s.*, COUNT(u.id) FILTER (WHERE u.is_active) as user_count
                     FROM stores s LEFT JOIN users u ON u.store_id = s.id
                     WHERE s.id = $1 GROUP BY s.id`;
            params = [req.user.store_id];
        }
        const { rows } = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/stores — super_admin only
router.post('/', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
        const { name, address, phone } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Tên cửa hàng là bắt buộc' });
        const { rows: [store] } = await pool.query(
            `INSERT INTO stores (name, address, phone) VALUES ($1,$2,$3) RETURNING *`,
            [name, address || null, phone || null]
        );
        res.status(201).json({ success: true, data: store });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// PUT /api/stores/:id — super_admin only
router.put('/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
        const { name, address, phone, is_active } = req.body;
        const { rows: [store] } = await pool.query(
            `UPDATE stores SET name=$1, address=$2, phone=$3, is_active=$4 WHERE id=$5 RETURNING *`,
            [name, address || null, phone || null, is_active !== false, req.params.id]
        );
        res.json({ success: true, data: store });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// DELETE /api/stores/:id — super_admin soft delete
router.delete('/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
        await pool.query('UPDATE stores SET is_active = FALSE WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Đã xóa cửa hàng' });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
