const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

function generateOrderCode() {
    const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `HD-${d}-${rand}`;
}

function storeClause(user, paramOffset = 0) {
    if (user.role === 'super_admin') return { clause: '', params: [], nextIdx: paramOffset + 1 };
    return { clause: `AND store_id = $${paramOffset + 1}`, params: [user.store_id], nextIdx: paramOffset + 2 };
}

// GET /api/orders
router.get('/', async (req, res) => {
    try {
        const { from, to, limit = 100, user_id } = req.query;
        const sf = storeClause(req.user);
        let query = `SELECT o.*, u.full_name as seller_name
                     FROM orders o
                     LEFT JOIN users u ON u.id = o.created_by_user_id
                     WHERE 1=1 ${sf.clause}`;
        const params = [...sf.params];
        let idx = sf.nextIdx;
        if (from) { params.push(from); query += ` AND o.created_at::date >= $${idx++}`; }
        if (to) { params.push(to); query += ` AND o.created_at::date <= $${idx++}`; }
        // allow filtering by employee (admin feature)
        if (user_id && ['admin', 'super_admin'].includes(req.user.role)) {
            params.push(parseInt(user_id)); query += ` AND o.created_by_user_id = $${idx++}`;
        }
        // employee sees only their own orders
        if (req.user.role === 'employee') {
            params.push(req.user.id); query += ` AND o.created_by_user_id = $${idx++}`;
        }
        params.push(parseInt(limit));
        query += ` ORDER BY o.created_at DESC LIMIT $${idx}`;
        const { rows } = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/orders/:id
router.get('/:id', async (req, res) => {
    try {
        const sf = storeClause(req.user, 1);
        const { rows: [order] } = await pool.query(
            `SELECT o.*, u.full_name as seller_name
             FROM orders o LEFT JOIN users u ON u.id = o.created_by_user_id
             WHERE o.id = $1 ${sf.clause}`,
            [req.params.id, ...sf.params]
        );
        if (!order) return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
        const { rows: items } = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
        res.json({ success: true, data: { ...order, items } });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});;

// POST /api/orders — uses store_stock instead of products.stock
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        const { items, customer_name, customer_phone, discount = 0, payment_method = 'cash', note } = req.body;
        if (!items || items.length === 0) return res.status(400).json({ success: false, error: 'Đơn hàng phải có ít nhất 1 sản phẩm' });

        const storeId = req.user.role === 'super_admin' ? null : req.user.store_id;

        await client.query('BEGIN');
        let totalAmount = 0, totalCost = 0;
        const resolvedItems = [];

        for (const item of items) {
            // Get product info
            const { rows: [product] } = await client.query(
                'SELECT * FROM products WHERE id = $1 AND is_active = TRUE', [item.product_id]
            );
            if (!product) throw new Error(`Sản phẩm ID ${item.product_id} không tồn tại`);

            // Get stock from store_stock
            const { rows: [ss] } = await client.query(
                'SELECT quantity FROM store_stock WHERE product_id = $1 AND store_id = $2',
                [item.product_id, storeId]
            );
            const currentStock = ss?.quantity || 0;
            if (currentStock < item.quantity) throw new Error(`Sản phẩm "${product.name}" không đủ tồn kho (còn ${currentStock})`);

            const sellPrice = item.sell_price && +item.sell_price > 0 ? +item.sell_price : +product.sell_price;
            if (!sellPrice || sellPrice <= 0) throw new Error(`Vui lòng nhập giá bán cho "${product.name}"`);

            const subtotal = sellPrice * item.quantity;
            const costTotal = +product.cost_price * item.quantity;
            totalAmount += subtotal;
            totalCost += costTotal;
            resolvedItems.push({ ...item, product, subtotal, costTotal, sell_price: sellPrice, cost_price: +product.cost_price });
        }

        const finalAmount = totalAmount - discount;
        const profit = finalAmount - totalCost;
        const orderCode = generateOrderCode();

        const { rows: [order] } = await client.query(`
            INSERT INTO orders (store_id, created_by_user_id, order_code, customer_name, customer_phone, total_amount, total_cost, discount, final_amount, profit, payment_method, note)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
        `, [storeId, req.user.id, orderCode, customer_name || null, customer_phone || null, totalAmount, totalCost, discount, finalAmount, profit, payment_method, note || null]);

        for (const item of resolvedItems) {
            await client.query(`
                INSERT INTO order_items (order_id, product_id, product_name, quantity, cost_price, sell_price, subtotal, profit)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            `, [order.id, item.product_id, item.product.name, item.quantity, item.cost_price, item.sell_price, item.subtotal, item.subtotal - item.costTotal]);

            // Decrement store_stock instead of products.stock
            await client.query(
                'UPDATE store_stock SET quantity = quantity - $1 WHERE product_id = $2 AND store_id = $3',
                [item.quantity, item.product_id, storeId]
            );
            await client.query(
                `INSERT INTO inventory_logs (product_id, store_id, type, quantity, note) VALUES ($1,$2,'export',$3,$4)`,
                [item.product_id, storeId, item.quantity, `Bán hàng đơn ${orderCode}`]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ success: true, data: order, message: 'Tạo đơn hàng thành công' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ success: false, error: err.message });
    } finally { client.release(); }
});

module.exports = router;
