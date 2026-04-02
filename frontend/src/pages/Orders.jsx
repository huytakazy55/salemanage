import { useEffect, useState, useCallback } from 'react';
import { ordersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ClipboardList } from 'lucide-react';

function fmt(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }

function OrderDetailModal({ orderId, onClose }) {
    const [order, setOrder] = useState(null);
    useEffect(() => {
        ordersApi.getById(orderId).then(r => setOrder(r.data));
    }, [orderId]);

    if (!order) return <div className="modal-overlay"><div className="modal"><div className="spinner-wrap"><div className="spinner" /></div></div></div>;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
                <div className="modal-header">
                    <span className="modal-title">📋 {order.order_code}</span>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, fontSize: 13 }}>
                        <div><span className="text-muted">Thời gian: </span>{new Date(order.created_at).toLocaleString('vi-VN')}</div>
                        <div><span className="text-muted">Khách hàng: </span>{order.customer_name || 'Khách lẻ'}</div>
                        <div><span className="text-muted">Thanh toán: </span>{order.payment_method === 'cash' ? '💵 Tiền mặt' : order.payment_method === 'transfer' ? '🏦 Chuyển khoản' : '💳 Thẻ'}</div>
                        <div><span className="text-muted">Trạng thái: </span><span className="badge badge-success">Hoàn thành</span></div>
                        {order.seller_name && <div style={{ gridColumn: '1/-1' }}><span className="text-muted">Người bán: </span><strong>{order.seller_name}</strong></div>}
                    </div>
                    <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                        <thead><tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                            <th style={{ textAlign: 'left', padding: '6px 0' }}>Sản phẩm</th>
                            <th style={{ textAlign: 'center', padding: '6px 0' }}>SL</th>
                            <th style={{ textAlign: 'right', padding: '6px 0' }}>Đơn giá</th>
                            <th style={{ textAlign: 'right', padding: '6px 0' }}>T.Tiền</th>
                        </tr></thead>
                        <tbody>
                            {(order.items || []).map((item, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                    <td style={{ padding: '8px 0' }}>{item.product_name}</td>
                                    <td style={{ textAlign: 'center', padding: '8px 0' }}>{item.quantity}</td>
                                    <td style={{ textAlign: 'right', padding: '8px 0' }}>{fmt(item.sell_price)}</td>
                                    <td style={{ textAlign: 'right', padding: '8px 0', fontWeight: 600 }}>{fmt(item.subtotal)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg)', borderRadius: 10, fontSize: 13 }}>
                        {order.discount > 0 && <div className="cart-total-row"><span className="text-muted">Giảm giá:</span><span style={{ color: 'var(--danger)' }}>-{fmt(order.discount)}</span></div>}
                        <div className="cart-total-row"><span className="text-muted">Tổng thanh toán:</span><span className="fw-700" style={{ fontSize: 15 }}>{fmt(order.final_amount)}</span></div>
                        <div className="cart-total-row"><span className="text-muted">Giá vốn:</span><span>{fmt(order.total_cost)}</span></div>
                        <div className="cart-total-row" style={{ color: 'var(--success)' }}><span>Lợi nhuận:</span><span className="fw-700">{fmt(order.profit)} ({order.final_amount > 0 ? Math.round(order.profit / order.final_amount * 100) : 0}%)</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Orders() {
    const { isAdmin } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [selectedId, setSelectedId] = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        const params = { limit: 100 };
        if (from) params.from = from;
        if (to) params.to = to;
        return ordersApi.getAll(params).then(r => setOrders(r.data || [])).finally(() => setLoading(false));
    }, [from, to]);

    useEffect(() => { load(); }, [load]);

    const totalRevenue = orders.reduce((s, o) => s + +o.final_amount, 0);
    const totalProfit = orders.reduce((s, o) => s + +o.profit, 0);

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h2>Lịch sử đơn hàng</h2>
                    <p>{orders.length} đơn hàng</p>
                </div>
            </div>

            <div className="filter-bar">
                <div className="flex-center gap-2">
                    <span style={{ fontSize: 13 }}>Từ ngày:</span>
                    <input type="date" className="form-control" style={{ width: 160 }} value={from} onChange={e => setFrom(e.target.value)} />
                </div>
                <div className="flex-center gap-2">
                    <span style={{ fontSize: 13 }}>Đến ngày:</span>
                    <input type="date" className="form-control" style={{ width: 160 }} value={to} onChange={e => setTo(e.target.value)} />
                </div>
                {(from || to) && <button className="btn btn-outline btn-sm" onClick={() => { setFrom(''); setTo(''); }}>Xóa bộ lọc</button>}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
                    <div style={{ textAlign: 'right', fontSize: 13 }}>
                        <div className="text-muted fs-12">Tổng doanh thu</div>
                        <div className="fw-700" style={{ color: 'var(--primary)' }}>{fmt(totalRevenue)}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 13 }}>
                        <div className="text-muted fs-12">Tổng lợi nhuận</div>
                        <div className="fw-700 text-success">{fmt(totalProfit)}</div>
                    </div>
                </div>
            </div>

            <div className="card">
                {loading ? <div className="spinner-wrap"><div className="spinner" /></div> :
                    orders.length === 0 ? <div className="empty-state"><ClipboardList size={48} /><p>Chưa có đơn hàng nào</p></div> : (
                        <div className="table-wrap">
                            <table>
                                <thead><tr>
                                    <th>Mã đơn</th>
                                    <th>Thời gian</th>
                                    <th>Khách hàng</th>
                                    {isAdmin() && <th>Người bán</th>}
                                    <th>T.Tiền</th>
                                    <th>Lợi nhuận</th>
                                    <th>Thanh toán</th>
                                    <th></th>
                                </tr></thead>
                                <tbody>
                                    {orders.map(o => (
                                        <tr key={o.id}>
                                            <td><span className="badge badge-primary fw-600">{o.order_code}</span></td>
                                            <td className="text-muted fs-12">{new Date(o.created_at).toLocaleString('vi-VN')}</td>
                                            <td>{o.customer_name || <span className="text-muted">Khách lẻ</span>}</td>
                                            {isAdmin() && <td><strong>{o.seller_name || <span className="text-muted">—</span>}</strong></td>}
                                            <td className="fw-700">{fmt(o.final_amount)}</td>
                                            <td className="text-success fw-600">{fmt(o.profit)}</td>
                                            <td>
                                                <span className="badge badge-gray">
                                                    {o.payment_method === 'cash' ? '💵 TM' : o.payment_method === 'transfer' ? '🏦 CK' : '💳 Thẻ'}
                                                </span>
                                            </td>
                                            <td><button className="btn btn-outline btn-sm" onClick={() => setSelectedId(o.id)}>Chi tiết</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
            </div>
            {selectedId && <OrderDetailModal orderId={selectedId} onClose={() => setSelectedId(null)} />}
        </div>
    );
}
