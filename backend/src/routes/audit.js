const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Super admin only middleware
function requireSuperAdmin(req, res, next) {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ success: false, error: 'Chỉ Super Admin mới có quyền xem lịch sử thay đổi' });
    }
    next();
}

// GET /api/audit-logs?limit=100&entity_type=&action=&from=&to=
router.get('/', requireSuperAdmin, async (req, res) => {
    try {
        const { limit = 200, entity_type, action, from, to, store_id } = req.query;

        const params = [];
        const where = [];
        let idx = 1;

        if (entity_type) { params.push(entity_type); where.push(`al.entity_type = $${idx++}`); }
        if (action)      { params.push(action);       where.push(`al.action = $${idx++}`); }
        if (store_id)    { params.push(parseInt(store_id)); where.push(`al.store_id = $${idx++}`); }
        if (from)        { params.push(from);         where.push(`al.created_at::date >= $${idx++}`); }
        if (to)          { params.push(to);           where.push(`al.created_at::date <= $${idx++}`); }

        const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
        params.push(Math.min(parseInt(limit) || 200, 500));

        const { rows } = await pool.query(`
            SELECT
                al.*,
                u.full_name  as user_name,
                u.username   as user_username,
                u.role       as user_role,
                s.name       as store_name
            FROM audit_logs al
            LEFT JOIN users u  ON u.id = al.user_id
            LEFT JOIN stores s ON s.id = al.store_id
            ${whereClause}
            ORDER BY al.created_at DESC
            LIMIT $${idx}
        `, params);

        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/audit-logs — clear all logs older than 90 days
router.delete('/clear', requireSuperAdmin, async (req, res) => {
    try {
        const { rowCount } = await pool.query(
            `DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days'`
        );
        res.json({ success: true, message: `Đã xóa ${rowCount} bản ghi cũ hơn 90 ngày` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
