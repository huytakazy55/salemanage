const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth, requireAdmin);

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 7) + '-01';

// Helper: build store filter clause
function sf(user, tableAlias = 'o') {
    if (user.role === 'super_admin') return { clause: '', params: [] };
    return { clause: `AND ${tableAlias}.store_id = ${user.store_id}`, params: [] };
    // Note: using string interpolation is safe here since store_id comes from JWT (trusted)
}

// GET /api/reports/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const t = today(), ms = monthStart();
        const storeFilter = req.user.role === 'super_admin' ? '' : `AND store_id = ${req.user.store_id}`;
        const prodFilter = req.user.role === 'super_admin' ? '' : `AND store_id = ${req.user.store_id}`;

        const [todayR, monthR, totalProd, lowStock, outStock, chart, topProd] = await Promise.all([
            pool.query(`SELECT COALESCE(SUM(final_amount),0) as revenue, COALESCE(SUM(profit),0) as profit, COUNT(*)::int as orders FROM orders WHERE created_at::date = $1 ${storeFilter}`, [t]),
            pool.query(`SELECT COALESCE(SUM(final_amount),0) as revenue, COALESCE(SUM(profit),0) as profit, COUNT(*)::int as orders FROM orders WHERE created_at::date >= $1 ${storeFilter}`, [ms]),
            pool.query(`SELECT COUNT(*)::int as total FROM products WHERE is_active = TRUE ${prodFilter}`),
            pool.query(`SELECT COUNT(*)::int as total FROM products p
                        JOIN store_stock ss ON ss.product_id = p.id
                        WHERE p.is_active = TRUE AND ss.quantity <= p.min_stock ${prodFilter.replace('store_id', 'ss.store_id')}`),
            pool.query(`SELECT COUNT(*)::int as total FROM products p
                        JOIN store_stock ss ON ss.product_id = p.id
                        WHERE p.is_active = TRUE AND ss.quantity = 0 ${prodFilter.replace('store_id', 'ss.store_id')}`),
            pool.query(`SELECT created_at::date as date, COALESCE(SUM(final_amount),0) as revenue, COALESCE(SUM(profit),0) as profit, COUNT(*)::int as orders
                        FROM orders WHERE created_at::date >= CURRENT_DATE - INTERVAL '6 days' ${storeFilter}
                        GROUP BY created_at::date ORDER BY date ASC`),
            pool.query(`SELECT oi.product_name, SUM(oi.quantity)::int as qty_sold, COALESCE(SUM(oi.subtotal),0) as revenue, COALESCE(SUM(oi.profit),0) as profit
                        FROM order_items oi JOIN orders o ON oi.order_id = o.id
                        WHERE o.created_at::date >= $1 ${storeFilter}
                        GROUP BY oi.product_name ORDER BY qty_sold DESC LIMIT 5`, [ms]),
        ]);

        res.json({
            success: true,
            data: {
                today: todayR.rows[0],
                month: monthR.rows[0],
                inventory: { totalProducts: totalProd.rows[0].total, lowStockProducts: lowStock.rows[0].total, outOfStock: outStock.rows[0].total },
                chart: chart.rows,
                topProducts: topProd.rows,
            }
        });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/reports/revenue
router.get('/revenue', async (req, res) => {
    try {
        const { from, to, group_by = 'day' } = req.query;
        const fromDate = from || monthStart();
        const toDate = to || today();
        const storeFilter = req.user.role === 'super_admin' ? '' : `AND store_id = ${req.user.store_id}`;

        let dateTrunc;
        if (group_by === 'month') dateTrunc = `TO_CHAR(created_at, 'YYYY-MM')`;
        else if (group_by === 'week') dateTrunc = `TO_CHAR(created_at, 'YYYY-"W"IW')`;
        else dateTrunc = `created_at::date::text`;

        const { rows: data } = await pool.query(`
            SELECT ${dateTrunc} as period, COALESCE(SUM(final_amount),0) as revenue,
                   COALESCE(SUM(total_cost),0) as cost, COALESCE(SUM(profit),0) as profit, COUNT(*)::int as orders
            FROM orders WHERE created_at::date BETWEEN $1 AND $2 ${storeFilter}
            GROUP BY period ORDER BY period ASC
        `, [fromDate, toDate]);

        const { rows: [summary] } = await pool.query(`
            SELECT COALESCE(SUM(final_amount),0) as total_revenue, COALESCE(SUM(total_cost),0) as total_cost,
                   COALESCE(SUM(profit),0) as total_profit, COUNT(*)::int as total_orders, COALESCE(AVG(final_amount),0) as avg_order_value
            FROM orders WHERE created_at::date BETWEEN $1 AND $2 ${storeFilter}
        `, [fromDate, toDate]);

        res.json({ success: true, data, summary, period: { from: fromDate, to: toDate } });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/reports/profit
router.get('/profit', async (req, res) => {
    try {
        const { from, to } = req.query;
        const fromDate = from || monthStart();
        const toDate = to || today();
        const storeFilter = req.user.role === 'super_admin' ? '' : `AND o.store_id = ${req.user.store_id}`;

        const { rows: byProduct } = await pool.query(`
            SELECT oi.product_name, SUM(oi.quantity)::int as qty_sold,
                   COALESCE(SUM(oi.subtotal),0) as revenue, COALESCE(SUM(oi.quantity * oi.cost_price),0) as cost,
                   COALESCE(SUM(oi.profit),0) as profit,
                   ROUND(SUM(oi.profit) * 100.0 / NULLIF(SUM(oi.subtotal),0), 1) as margin_pct
            FROM order_items oi JOIN orders o ON oi.order_id = o.id
            WHERE o.created_at::date BETWEEN $1 AND $2 ${storeFilter}
            GROUP BY oi.product_name ORDER BY profit DESC
        `, [fromDate, toDate]);

        const { rows: [summary] } = await pool.query(`
            SELECT COALESCE(SUM(final_amount),0) as total_revenue, COALESCE(SUM(total_cost),0) as total_cost, COALESCE(SUM(profit),0) as total_profit
            FROM orders WHERE created_at::date BETWEEN $1 AND $2 ${storeFilter.replace('o.', '')}
        `, [fromDate, toDate]);

        res.json({ success: true, data: byProduct, summary, period: { from: fromDate, to: toDate } });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/reports/employee-performance
// Returns per-employee stats for a date range. Admin-only.
router.get('/employee-performance', async (req, res) => {
    try {
        const { from, to } = req.query;
        const fromDate = from || monthStart();
        const toDate = to || today();
        const storeFilter = req.user.role === 'super_admin' ? '' : `AND o.store_id = ${req.user.store_id}`;
        const empStoreFilter = req.user.role !== 'super_admin' ? `AND u.store_id = ${req.user.store_id}` : '';

        const { rows } = await pool.query(`
            SELECT
                u.id as user_id,
                u.full_name,
                u.username,
                s.name as store_name,
                COUNT(DISTINCT o.id)::int as total_orders,
                COALESCE(SUM(oi.quantity), 0)::int as total_items,
                COALESCE(SUM(o.final_amount), 0) as total_revenue,
                COALESCE(SUM(o.profit), 0) as total_profit
            FROM users u
            JOIN stores s ON s.id = u.store_id
            LEFT JOIN orders o ON o.created_by_user_id = u.id
                AND o.created_at::date BETWEEN $1 AND $2 ${storeFilter}
            LEFT JOIN order_items oi ON oi.order_id = o.id
            WHERE u.role = 'employee' AND u.is_active = TRUE ${empStoreFilter}
            GROUP BY u.id, u.full_name, u.username, s.name
            ORDER BY total_revenue DESC
        `, [fromDate, toDate]);

        res.json({ success: true, data: rows, period: { from: fromDate, to: toDate } });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/reports/salary
// Returns salary = base_salary + SUM(oi.subtotal * p.commission_pct / 100)
router.get('/salary', async (req, res) => {
    try {
        const { from, to } = req.query;
        const fromDate = from || monthStart();
        const toDate = to || today();
        const storeFilter = req.user.role === 'super_admin' ? '' : `AND o.store_id = ${req.user.store_id}`;
        const empStoreFilter = req.user.role !== 'super_admin' ? `AND u.store_id = ${req.user.store_id}` : '';

        const { rows } = await pool.query(`
            SELECT
                u.id as user_id,
                u.full_name,
                u.username,
                s.name as store_name,
                COUNT(DISTINCT o.id)::int as total_orders,
                COALESCE(SUM(oi.quantity), 0)::int as total_items,
                COALESCE(SUM(o.final_amount), 0) as total_revenue,
                COALESCE(sc.base_salary, 0) as base_salary,
                ROUND(COALESCE(SUM(oi.subtotal * COALESCE(p.commission_pct, 0) / 100), 0)) as commission_earned,
                COALESCE(sc.base_salary, 0) + ROUND(COALESCE(SUM(oi.subtotal * COALESCE(p.commission_pct, 0) / 100), 0)) as calculated_salary
            FROM users u
            JOIN stores s ON s.id = u.store_id
            LEFT JOIN salary_config sc ON sc.store_id = u.store_id
            LEFT JOIN orders o ON o.created_by_user_id = u.id
                AND o.created_at::date BETWEEN $1 AND $2 ${storeFilter}
            LEFT JOIN order_items oi ON oi.order_id = o.id
            LEFT JOIN products p ON p.id = oi.product_id
            WHERE u.role = 'employee' AND u.is_active = TRUE ${empStoreFilter}
            GROUP BY u.id, u.full_name, u.username, s.name, sc.base_salary
            ORDER BY calculated_salary DESC
        `, [fromDate, toDate]);

        res.json({ success: true, data: rows, period: { from: fromDate, to: toDate } });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});


module.exports = router;
