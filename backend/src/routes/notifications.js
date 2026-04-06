const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const eventBus = require('../utils/eventBus');

// ── SSE stream — MUST be before router.use(requireAuth) ──
// EventSource browsers cannot set Authorization headers, so token comes via query param
router.get('/stream', (req, res) => {
    const rawToken = req.query.token;
    let user;
    try {
        user = jwt.verify(rawToken, JWT_SECRET);
    } catch (_) {
        res.status(401).end();
        return;
    }

    const storeId = user.store_id;
    if (!storeId) { res.status(400).end(); return; }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx proxy buffering
    res.flushHeaders();

    // Keep-alive heartbeat every 25s (nginx/proxy timeout prevention)
    const heartbeat = setInterval(() => { res.write(': ping\n\n'); }, 25000);
    res.write(`event: connected\ndata: ${JSON.stringify({ storeId })}\n\n`);

    const handler = (notif) => {
        res.write(`event: new_order\ndata: ${JSON.stringify(notif)}\n\n`);
    };
    const channel = `store:${storeId}`;
    eventBus.on(channel, handler);

    req.on('close', () => {
        clearInterval(heartbeat);
        eventBus.off(channel, handler);
    });
});

// All other routes require Bearer token auth
router.use(requireAuth);

// GET /api/notifications — list for current store
router.get('/', async (req, res) => {
    try {
        const storeId = req.user.store_id;
        const { unread_only } = req.query;
        let query = `SELECT n.*, o.order_code FROM notifications n
                     LEFT JOIN orders o ON o.id = n.order_id
                     WHERE n.store_id = $1`;
        if (unread_only === 'true') query += ` AND n.is_read = FALSE`;
        query += ` ORDER BY n.created_at DESC LIMIT 50`;
        const { rows } = await pool.query(query, [storeId]);
        const unread = rows.filter(r => !r.is_read).length;
        res.json({ success: true, data: rows, unread_count: unread });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// PATCH /api/notifications/read-all — must be before /:id/read
router.patch('/read-all', async (req, res) => {
    try {
        await pool.query('UPDATE notifications SET is_read = TRUE WHERE store_id = $1', [req.user.store_id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
    try {
        await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND store_id = $2',
            [req.params.id, req.user.store_id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
