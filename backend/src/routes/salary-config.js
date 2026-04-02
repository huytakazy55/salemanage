const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth, requireAdmin);

// GET /api/salary-config — get config for current store (or all for super_admin)
router.get('/', async (req, res) => {
    try {
        let query, params;
        if (req.user.role === 'super_admin') {
            query = `SELECT sc.*, s.name as store_name
                     FROM salary_config sc JOIN stores s ON s.id = sc.store_id
                     ORDER BY s.name`;
            params = [];
        } else {
            query = `SELECT sc.*, s.name as store_name
                     FROM salary_config sc JOIN stores s ON s.id = sc.store_id
                     WHERE sc.store_id = $1`;
            params = [req.user.store_id];
        }
        const { rows } = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/salary-config — upsert base_salary for a store
router.post('/', async (req, res) => {
    try {
        const { base_salary, store_id } = req.body;
        // admin can only configure their own store
        const targetStoreId = req.user.role === 'super_admin' ? (store_id || req.user.store_id) : req.user.store_id;
        if (!targetStoreId) return res.status(400).json({ success: false, error: 'Thiếu store_id' });

        const { rows: [config] } = await pool.query(`
            INSERT INTO salary_config (store_id, base_salary, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (store_id) DO UPDATE SET
                base_salary = EXCLUDED.base_salary,
                updated_at = NOW()
            RETURNING *
        `, [targetStoreId, base_salary || 0]);

        res.json({ success: true, data: config, message: 'Đã lưu cấu hình lương' });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
