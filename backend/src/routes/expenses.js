const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { auditLog, diffFields } = require('../utils/audit');

router.use(requireAuth, requireAdmin);

// GET /api/expenses/summary?from=&to=  ← phải đặt TRƯỚC /:id
router.get('/summary', async (req, res) => {
    try {
        const { from, to } = req.query;
        const storeFilter = req.user.role !== 'super_admin' ? `AND e.store_id = ${req.user.store_id}` : '';

        const params = [from, to];
        const { rows } = await pool.query(`
            SELECT e.category, COALESCE(SUM(e.amount), 0) as total_amount, COUNT(*)::int as count
            FROM extra_expenses e
            WHERE e.expense_date BETWEEN $1 AND $2 ${storeFilter}
            GROUP BY e.category
            ORDER BY total_amount DESC
        `, params);

        const total = rows.reduce((sum, r) => sum + Number(r.total_amount), 0);
        res.json({ success: true, data: rows, total });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/expenses?from=&to=&store_id=
router.get('/', async (req, res) => {
    try {
        const { from, to, store_id } = req.query;
        const params = [];
        let where = [];

        // Store filter — dùng alias e. để tránh ambiguous với users.store_id
        if (req.user.role !== 'super_admin') {
            params.push(req.user.store_id);
            where.push(`e.store_id = $${params.length}`);
        } else if (store_id) {
            params.push(parseInt(store_id));
            where.push(`e.store_id = $${params.length}`);
        }

        if (from) {
            params.push(from);
            where.push(`e.expense_date >= $${params.length}`);
        }
        if (to) {
            params.push(to);
            where.push(`e.expense_date <= $${params.length}`);
        }

        const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

        const { rows } = await pool.query(`
            SELECT e.*, s.name as store_name, u.full_name as created_by_name
            FROM extra_expenses e
            LEFT JOIN stores s ON s.id = e.store_id
            LEFT JOIN users u ON u.id = e.created_by_user_id
            ${whereClause}
            ORDER BY e.expense_date DESC, e.created_at DESC
        `, params);

        const totalAmount = rows.reduce((sum, r) => sum + Number(r.amount), 0);
        res.json({ success: true, data: rows, summary: { total_amount: totalAmount, count: rows.length } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/expenses
router.post('/', async (req, res) => {
    try {
        const { expense_date, category, description, amount, store_id } = req.body;
        if (!description || !amount) {
            return res.status(400).json({ success: false, error: 'Thiếu thông tin bắt buộc' });
        }

        const effectiveStoreId = req.user.role !== 'super_admin' ? req.user.store_id : (store_id || null);

        const { rows } = await pool.query(`
            INSERT INTO extra_expenses (store_id, expense_date, category, description, amount, created_by_user_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [effectiveStoreId, expense_date || new Date().toISOString().slice(0, 10), category || 'Khác', description, Math.round(amount), req.user.id]);

        await auditLog({ action: 'CREATE', entityType: 'expenses', entityId: rows[0]?.id,
            entityName: `${rows[0]?.category}: ${description}`, userId: req.user.id, storeId: effectiveStoreId });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/expenses/:id
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { expense_date, category, description, amount } = req.body;

        const { rows: existing } = await pool.query('SELECT * FROM extra_expenses WHERE id = $1', [id]);
        if (!existing.length) return res.status(404).json({ success: false, error: 'Không tìm thấy' });
        if (req.user.role !== 'super_admin' && Number(existing[0].store_id) !== Number(req.user.store_id)) {
            return res.status(403).json({ success: false, error: 'Không có quyền' });
        }

        const { rows } = await pool.query(`
            UPDATE extra_expenses
            SET expense_date = COALESCE($1, expense_date),
                category = COALESCE($2, category),
                description = COALESCE($3, description),
                amount = COALESCE($4, amount)
            WHERE id = $5
            RETURNING *
        `, [expense_date, category, description, amount ? Math.round(amount) : null, id]);

        const changed = diffFields(existing[0], rows[0]);
        await auditLog({ action: 'UPDATE', entityType: 'expenses', entityId: parseInt(id),
            entityName: rows[0]?.description, changedFields: changed,
            userId: req.user.id, storeId: existing[0].store_id });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { rows: existing } = await pool.query('SELECT * FROM extra_expenses WHERE id = $1', [id]);
        if (!existing.length) return res.status(404).json({ success: false, error: 'Không tìm thấy' });
        if (req.user.role !== 'super_admin' && Number(existing[0].store_id) !== Number(req.user.store_id)) {
            return res.status(403).json({ success: false, error: 'Không có quyền' });
        }

        await pool.query('DELETE FROM extra_expenses WHERE id = $1', [id]);
        await auditLog({ action: 'DELETE', entityType: 'expenses', entityId: parseInt(id),
            entityName: existing[0]?.description, userId: req.user.id, storeId: existing[0].store_id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
