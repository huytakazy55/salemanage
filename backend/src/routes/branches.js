const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/branches — super_admin: tất cả; others: chỉ branch của store mình
router.get('/', async (req, res) => {
    try {
        let rows;
        if (req.user.role === 'super_admin') {
            const result = await pool.query(`
                SELECT b.*, COUNT(s.id) as store_count
                FROM branches b
                LEFT JOIN stores s ON s.branch_id = b.id AND s.is_active = TRUE
                GROUP BY b.id ORDER BY b.name
            `);
            rows = result.rows;
        } else {
            // Trả branch của store người dùng (nếu có)
            const result = await pool.query(`
                SELECT b.*, COUNT(s.id) as store_count
                FROM branches b
                LEFT JOIN stores s ON s.branch_id = b.id AND s.is_active = TRUE
                WHERE b.id = (SELECT branch_id FROM stores WHERE id = $1)
                GROUP BY b.id
            `, [req.user.store_id]);
            rows = result.rows;
        }
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/branches — super_admin only
router.post('/', requireSuperAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Tên chi nhánh là bắt buộc' });
        const { rows: [branch] } = await pool.query(
            `INSERT INTO branches (name) VALUES ($1) RETURNING *`,
            [name]
        );
        res.status(201).json({ success: true, data: branch });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ success: false, error: 'Tên chi nhánh đã tồn tại' });
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/branches/:id — super_admin only
router.put('/:id', requireSuperAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Tên chi nhánh là bắt buộc' });
        const { rows: [branch] } = await pool.query(
            `UPDATE branches SET name = $1 WHERE id = $2 RETURNING *`,
            [name, req.params.id]
        );
        if (!branch) return res.status(404).json({ success: false, error: 'Không tìm thấy chi nhánh' });
        res.json({ success: true, data: branch });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ success: false, error: 'Tên chi nhánh đã tồn tại' });
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/branches/:id — super_admin only
router.delete('/:id', requireSuperAdmin, async (req, res) => {
    try {
        const { rows: [check] } = await pool.query(
            `SELECT COUNT(*) as cnt FROM stores WHERE branch_id = $1 AND is_active = TRUE`,
            [req.params.id]
        );
        if (parseInt(check.cnt) > 0) {
            return res.status(400).json({ success: false, error: 'Không thể xóa chi nhánh còn cửa hàng đang hoạt động' });
        }
        await pool.query('DELETE FROM branches WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Đã xóa chi nhánh' });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
