const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db/database');
const { requireAuth, requireAdmin, requireSuperAdmin } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/users
// super_admin → all users; admin → users of their store; employee → 403
router.get('/', requireAdmin, async (req, res) => {
    try {
        let query, params;
        if (req.user.role === 'super_admin') {
            query = `SELECT u.id, u.username, u.full_name, u.role, u.store_id, u.is_active, u.created_at,
                     s.name as store_name, s.max_employees FROM users u LEFT JOIN stores s ON s.id = u.store_id ORDER BY u.role DESC, u.full_name ASC`;
            params = [];
        } else {
            query = `SELECT u.id, u.username, u.full_name, u.role, u.store_id, u.is_active, u.created_at,
                     s.name as store_name, s.max_employees FROM users u LEFT JOIN stores s ON s.id = u.store_id
                     WHERE u.store_id = $1 ORDER BY u.role DESC, u.full_name ASC`;
            params = [req.user.store_id];
        }
        const { rows } = await pool.query(query, params);
        // Attach quota summary for admin
        let quota = null;
        if (req.user.role === 'admin' && rows.length > 0) {
            const maxEmp = rows[0].max_employees ?? 1;
            const usedEmp = rows.filter(u => u.role === 'employee').length;
            quota = { used: usedEmp, max: maxEmp };
        }
        res.json({ success: true, data: rows, quota });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/users
router.post('/', requireAdmin, async (req, res) => {
    try {
        const { username, password, full_name, role, store_id } = req.body;
        if (!username || !password || !full_name) return res.status(400).json({ success: false, error: 'Thiếu thông tin bắt buộc' });

        // admin can only create users for their own store
        let assignedStoreId = store_id || null;
        if (req.user.role === 'admin') {
            assignedStoreId = req.user.store_id;
        }
        const safeRole = role || 'employee';
        if (safeRole !== 'super_admin' && !assignedStoreId) {
            return res.status(400).json({ success: false, error: 'Cần chọn cửa hàng cho tài khoản này' });
        }

        // ── Quota check: admin can only create employees up to max_employees ──
        if (req.user.role === 'admin' && safeRole === 'employee') {
            const { rows: [store] } = await pool.query(
                'SELECT max_employees FROM stores WHERE id = $1', [assignedStoreId]
            );
            const maxEmp = store?.max_employees ?? 1;
            const { rows: [cnt] } = await pool.query(
                `SELECT COUNT(*) as c FROM users WHERE store_id = $1 AND role = 'employee' AND is_active = TRUE`,
                [assignedStoreId]
            );
            if (+cnt.c >= maxEmp) {
                return res.status(403).json({
                    success: false,
                    error: `Tài khoản của bạn chỉ được tạo tối đa ${maxEmp} nhân viên. Vui lòng liên hệ để nâng cấp gói.`,
                    quota_exceeded: true,
                });
            }
        }

        const hash = await bcrypt.hash(password, 10);
        const { rows: [user] } = await pool.query(
            `INSERT INTO users (username, password_hash, full_name, role, store_id)
             VALUES ($1,$2,$3,$4,$5)
             RETURNING id, username, full_name, role, store_id, is_active, created_at`,
            [username, hash, full_name, safeRole, assignedStoreId]
        );
        res.status(201).json({ success: true, data: user });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ success: false, error: 'Username đã tồn tại' });
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/users/:id
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const { full_name, role, is_active, password, store_id } = req.body;

        // admin can only edit users in their store
        if (req.user.role === 'admin') {
            const { rows: [target] } = await pool.query('SELECT store_id FROM users WHERE id = $1', [req.params.id]);
            if (!target || target.store_id !== req.user.store_id) {
                return res.status(403).json({ success: false, error: 'Không có quyền chỉnh sửa user này' });
            }
        }

        let query = 'UPDATE users SET full_name=$1, role=$2, is_active=$3, store_id=$4';
        let params = [full_name, role, is_active, store_id || null];
        if (password) {
            const hash = await bcrypt.hash(password, 10);
            query += `, password_hash=$${params.length + 1}`;
            params.push(hash);
        }
        params.push(req.params.id);
        query += ` WHERE id=$${params.length} RETURNING id, username, full_name, role, store_id, is_active, created_at`;
        const { rows: [user] } = await pool.query(query, params);
        res.json({ success: true, data: user });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// DELETE /api/users/:id
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        if (+req.params.id === req.user.id) return res.status(400).json({ success: false, error: 'Không thể xóa tài khoản của chính mình' });
        await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Đã xóa người dùng' });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
