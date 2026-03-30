const { pool } = require('./database');
const bcrypt = require('bcryptjs');

async function seed() {
    // ── 1. Ensure default store exists ─────────────────────────────
    const { rows: existingStores } = await pool.q('SELECT id FROM stores LIMIT 1');
    let defaultStoreId;
    if (existingStores.length === 0) {
        const { rows: [store] } = await pool.q(
            `INSERT INTO stores (name, address) VALUES ('ĐènNgủ Shop', 'Hà Nội') RETURNING id`
        );
        defaultStoreId = store.id;
        console.log('✅ Default store created');
    } else {
        defaultStoreId = existingStores[0].id;
    }

    // ── 2. Ensure default users exist ──────────────────────────────
    const { rows: existingUsers } = await pool.q('SELECT COUNT(*) as c FROM users');
    if (parseInt(existingUsers[0].c) === 0) {
        const adminHash = await bcrypt.hash('admin123', 10);
        const empHash = await bcrypt.hash('123456', 10);
        await pool.q(`
            INSERT INTO users (username, password_hash, full_name, role, store_id) VALUES
            ('admin', $1, 'Quản lý tổng', 'super_admin', NULL),
            ('nhanvien1', $2, 'Nhân viên 1', 'employee', $3)
        `, [adminHash, empHash, defaultStoreId]);
        console.log('✅ Default users created');
    } else {
        // Migrate existing admin → super_admin if needed
        await pool.q(`UPDATE users SET role = 'super_admin' WHERE username = 'admin' AND role = 'admin'`);
    }

    // ── 3. Assign orphan data to default store ─────────────────────
    await pool.q(`UPDATE categories SET store_id = $1 WHERE store_id IS NULL`, [defaultStoreId]);
    await pool.q(`UPDATE products SET store_id = $1 WHERE store_id IS NULL`, [defaultStoreId]);
    await pool.q(`UPDATE orders SET store_id = $1 WHERE store_id IS NULL`, [defaultStoreId]);

    // ── 4. Seed categories & products if empty ─────────────────────
    const { rows } = await pool.q('SELECT COUNT(*) as c FROM categories WHERE store_id = $1', [defaultStoreId]);
    if (parseInt(rows[0].c) > 0) {
        console.log('Database already seeded, skipping...');
        return;
    }

    console.log('Seeding database...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const catResult = await client.query(`
            INSERT INTO categories (store_id, name, description) VALUES
            ($1,'Đèn ngủ LED','Các loại đèn ngủ dùng bóng LED'),
            ($1,'Đèn ngủ cảm ứng','Đèn ngủ tự động bật/tắt theo cảm ứng'),
            ($1,'Đèn ngủ trẻ em','Đèn ngủ thiết kế dành cho trẻ em'),
            ($1,'Đèn ngủ trang trí','Đèn ngủ dùng làm vật trang trí')
            RETURNING id, name
        `, [defaultStoreId]);
        const catMap = {};
        catResult.rows.forEach(r => { catMap[r.name] = r.id; });

        const prods = [
            ['Đèn ngủ LED hình tròn nhỏ', 'DEN-LED-001', catMap['Đèn ngủ LED'], 35000, 25, 5],
            ['Đèn ngủ LED hình trái tim', 'DEN-LED-002', catMap['Đèn ngủ LED'], 45000, 18, 5],
            ['Đèn ngủ LED hình ngôi sao', 'DEN-LED-003', catMap['Đèn ngủ LED'], 40000, 12, 5],
            ['Đèn cảm ứng chuyển động', 'DEN-CU-001', catMap['Đèn ngủ cảm ứng'], 55000, 8, 3],
            ['Đèn cảm ứng ánh sáng', 'DEN-CU-002', catMap['Đèn ngủ cảm ứng'], 48000, 15, 3],
            ['Đèn ngủ Doraemon', 'DEN-TE-001', catMap['Đèn ngủ trẻ em'], 60000, 20, 5],
            ['Đèn ngủ Minion', 'DEN-TE-002', catMap['Đèn ngủ trẻ em'], 62000, 16, 5],
            ['Đèn ngủ Hello Kitty', 'DEN-TE-003', catMap['Đèn ngủ trẻ em'], 58000, 10, 5],
            ['Đèn thả trần thiên hà', 'DEN-TT-001', catMap['Đèn ngủ trang trí'], 120000, 5, 2],
            ['Đèn muối Himalaya nhỏ', 'DEN-TT-002', catMap['Đèn ngủ trang trí'], 85000, 7, 2],
            ['Đèn ngủ cắm USB hình mặt trăng', 'DEN-LED-004', catMap['Đèn ngủ LED'], 30000, 30, 8],
            ['Đèn ngủ đổi màu RGB', 'DEN-LED-005', catMap['Đèn ngủ LED'], 55000, 22, 5],
        ];

        const prodIds = [];
        for (const [name, sku, cat_id, cost, stock, min_stock] of prods) {
            const r = await client.query(
                `INSERT INTO products (store_id, name, sku, category_id, cost_price, stock, min_stock, unit)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,'cái') RETURNING id, cost_price, stock`,
                [defaultStoreId, name, sku, cat_id, cost, stock, min_stock]
            );
            prodIds.push(r.rows[0]);
            await client.query(
                `INSERT INTO inventory_logs (product_id, type, quantity, cost_price, note) VALUES ($1,'import',$2,$3,'Nhập hàng ban đầu')`,
                [r.rows[0].id, stock, cost]
            );
        }

        const sampleOrders = [
            { code: 'HD-001', date: '2026-03-01', items: [{ idx: 0, qty: 2 }, { idx: 5, qty: 1 }] },
            { code: 'HD-002', date: '2026-03-03', items: [{ idx: 2, qty: 1 }, { idx: 9, qty: 1 }] },
            { code: 'HD-003', date: '2026-03-05', items: [{ idx: 6, qty: 2 }] },
            { code: 'HD-004', date: '2026-03-07', items: [{ idx: 8, qty: 1 }, { idx: 10, qty: 3 }] },
            { code: 'HD-005', date: '2026-03-10', items: [{ idx: 1, qty: 1 }, { idx: 4, qty: 2 }] },
            { code: 'HD-006', date: '2026-03-12', items: [{ idx: 11, qty: 1 }] },
            { code: 'HD-007', date: '2026-03-14', items: [{ idx: 3, qty: 1 }, { idx: 7, qty: 1 }] },
            { code: 'HD-008', date: '2026-03-16', items: [{ idx: 0, qty: 3 }, { idx: 10, qty: 2 }] },
            { code: 'HD-009', date: '2026-03-18', items: [{ idx: 5, qty: 2 }, { idx: 6, qty: 1 }] },
            { code: 'HD-010', date: '2026-03-20', items: [{ idx: 2, qty: 2 }] },
        ];
        const sellMultipliers = [2.4, 2.4, 2.4, 2.4, 2.4, 2.5, 2.5, 2.5, 2.3, 2.4, 2.5, 2.45];

        for (const order of sampleOrders) {
            let totalAmount = 0, totalCost = 0;
            const resolvedItems = order.items.map(({ idx, qty }) => {
                const p = prodIds[idx];
                const sellPrice = Math.round(p.cost_price * sellMultipliers[idx] / 1000) * 1000;
                const subtotal = sellPrice * qty;
                const cost = p.cost_price * qty;
                totalAmount += subtotal; totalCost += cost;
                return { id: p.id, qty, sellPrice, cost_price: p.cost_price, subtotal, profit: subtotal - cost };
            });
            const profit = totalAmount - totalCost;
            const { rows: [ord] } = await client.query(
                `INSERT INTO orders (store_id, order_code, total_amount, total_cost, discount, final_amount, profit, payment_method, created_at)
                 VALUES ($1,$2,$3,$4,0,$3,$5,'cash',$6) RETURNING id`,
                [defaultStoreId, order.code, totalAmount, totalCost, profit, order.date + 'T10:00:00Z']
            );
            for (const item of resolvedItems) {
                const { rows: [p_row] } = await client.query('SELECT name FROM products WHERE id = $1', [item.id]);
                await client.query(
                    `INSERT INTO order_items (order_id, product_id, product_name, quantity, cost_price, sell_price, subtotal, profit)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                    [ord.id, item.id, p_row.name, item.qty, item.cost_price, item.sellPrice, item.subtotal, item.profit]
                );
            }
        }

        await client.query('COMMIT');
        console.log('✅ Seeding complete!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Seed error:', err.message);
    } finally { client.release(); }
}

module.exports = seed;
