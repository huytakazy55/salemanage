const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/database');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ success: false, error: 'Vui lòng nhập username và password' });

        const { rows: [user] } = await pool.query(`
            SELECT u.*, s.name as store_name
            FROM users u
            LEFT JOIN stores s ON s.id = u.store_id
            WHERE u.username = $1 AND u.is_active = TRUE
        `, [username]);
        if (!user) return res.status(401).json({ success: false, error: 'Tài khoản không tồn tại hoặc đã bị khóa' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ success: false, error: 'Sai mật khẩu' });

        const payload = {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
            store_id: user.store_id,
            store_name: user.store_name,
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

        res.json({
            success: true,
            token,
            user: payload,
        });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/auth/register — public, creates store + admin user
router.post('/register', async (req, res) => {
    const client = await pool.connect();
    try {
        const { store_name, username, password, full_name } = req.body;
        if (!store_name || !username || !password || !full_name)
            return res.status(400).json({ success: false, error: 'Vui lòng điền đầy đủ thông tin' });
        if (password.length < 6)
            return res.status(400).json({ success: false, error: 'Mật khẩu phải ít nhất 6 ký tự' });

        const { rows: existing } = await client.query('SELECT id FROM users WHERE username = $1', [username]);
        if (existing.length > 0)
            return res.status(400).json({ success: false, error: 'Username đã tồn tại, vui lòng chọn username khác' });

        await client.query('BEGIN');

        // Create branch + store
        const { rows: [branch] } = await client.query(
            `INSERT INTO branches (name) VALUES ($1) RETURNING id`, [store_name]
        );
        const { rows: [store] } = await client.query(
            `INSERT INTO stores (name, branch_id, max_employees) VALUES ($1,$2,1) RETURNING *`,
            [store_name, branch.id]
        );

        // Create admin user
        const hash = await bcrypt.hash(password, 10);
        const { rows: [user] } = await client.query(
            `INSERT INTO users (username, password_hash, full_name, role, store_id)
             VALUES ($1,$2,$3,'admin',$4)
             RETURNING id, username, full_name, role, store_id`,
            [username, hash, full_name, store.id]
        );

        await client.query('COMMIT');

        const payload = {
            id: user.id, username: user.username, full_name: user.full_name,
            role: user.role, store_id: user.store_id, store_name: store.name,
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
        res.status(201).json({ success: true, token, user: payload });
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') return res.status(400).json({ success: false, error: 'Username đã tồn tại' });
        res.status(500).json({ success: false, error: err.message });
    } finally { client.release(); }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
    try {
        const { rows: [user] } = await pool.query(`
            SELECT u.id, u.username, u.full_name, u.role, u.store_id, u.created_at, s.name as store_name
            FROM users u LEFT JOIN stores s ON s.id = u.store_id
            WHERE u.id = $1
        `, [req.user.id]);
        if (!user) return res.status(404).json({ success: false, error: 'User không tồn tại' });
        res.json({ success: true, user });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// PUT /api/auth/change-password
router.put('/change-password', requireAuth, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        const { rows: [user] } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        const valid = await bcrypt.compare(current_password, user.password_hash);
        if (!valid) return res.status(400).json({ success: false, error: 'Mật khẩu hiện tại không đúng' });
        const hash = await bcrypt.hash(new_password, 10);
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
        res.json({ success: true, message: 'Đổi mật khẩu thành công' });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
