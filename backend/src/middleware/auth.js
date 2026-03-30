const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'salemanage_secret_key_2026';

function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });
    }
    const token = authHeader.slice(7);
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Token không hợp lệ hoặc đã hết hạn' });
    }
}

// Only super_admin
function requireSuperAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'super_admin') {
        return res.status(403).json({ success: false, error: 'Chỉ Super Admin mới có quyền này.' });
    }
    next();
}

// admin or super_admin
function requireAdmin(req, res, next) {
    if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({ success: false, error: 'Không có quyền truy cập. Chỉ Admin mới được phép.' });
    }
    next();
}

// Helper: get store_id filter clause for queries
// super_admin sees all (no filter), others filter by their store_id
function storeFilter(user) {
    if (user.role === 'super_admin') return { clause: '', param: null };
    return { clause: `AND store_id = $`, param: user.store_id };
}

module.exports = { requireAuth, requireAdmin, requireSuperAdmin, storeFilter, JWT_SECRET };
