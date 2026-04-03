const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost')
    .split(',')
    .map(o => o.trim())
    .concat(['http://localhost', 'http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1']);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.some(o => origin.startsWith(o))) return callback(null, true);
        callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
}));
app.use(express.json());

// Serve uploaded images publicly
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Public routes
app.use('/api/auth', require('./routes/auth'));

// Protected routes (auth handled inside each route file)
app.use('/api/stores', require('./routes/stores'));
app.use('/api/branches', require('./routes/branches'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/transfers', require('./routes/transfers'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/salary-config', require('./routes/salary-config'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/audit-logs', require('./routes/audit'));
app.use('/api/notifications', require('./routes/notifications'));


app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Server đang chạy tốt!', time: new Date().toISOString() });
});

app.use((req, res) => res.status(404).json({ success: false, error: 'Endpoint không tồn tại' }));
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: 'Lỗi server nội bộ' });
});

async function start() {
    const { initSchema } = require('./db/database');
    const seed = require('./db/seed');
    try {
        await initSchema();
        await seed();
    } catch (e) {
        console.warn('DB init warning:', e.message);
    }
    app.listen(PORT, () => {
        console.log(`✅ Backend đang chạy tại http://localhost:${PORT}`);
        console.log(`🐘 Database: PostgreSQL @ ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
    });
}

start();
