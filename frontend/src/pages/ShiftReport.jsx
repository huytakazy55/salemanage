import { useState, useEffect, useCallback } from 'react';
import { reportsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { exportToExcel } from '../utils/exportExcel';
import { Clock, Play, Square, Download, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const SHIFT_KEY = 'shift_start_time';
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ';
const fmtTime = (iso) => iso ? new Date(iso).toLocaleString('vi-VN') : '—';
const payLabel = { cash: '💵 Tiền mặt', transfer: '🏦 Chuyển khoản', card: '💳 Thẻ' };

const now8601 = () => new Date().toISOString();
const toLocalISO = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function StatCard({ label, value, sub, color }) {
    return (
        <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
            padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4
        }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--primary)' }}>{value}</div>
            {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
        </div>
    );
}

export default function ShiftReport() {
    const { user, isAdmin } = useAuth();
    const admin = isAdmin();

    // Shift time state
    const [shiftStart, setShiftStart] = useState(() => localStorage.getItem(SHIFT_KEY) || '');
    const [running, setRunning] = useState(() => !!localStorage.getItem(SHIFT_KEY));
    const [elapsed, setElapsed] = useState('');

    // Custom from/to
    const [from, setFrom] = useState(() => {
        const saved = localStorage.getItem(SHIFT_KEY);
        return saved ? toLocalISO(new Date(saved)) : toLocalISO(new Date(Date.now() - 8 * 3600000));
    });
    const [to, setTo] = useState(toLocalISO(new Date()));

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Elapsed timer
    useEffect(() => {
        if (!running || !shiftStart) return;
        const tick = () => {
            const diff = Date.now() - new Date(shiftStart).getTime();
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setElapsed(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [running, shiftStart]);

    const startShift = () => {
        const t = now8601();
        localStorage.setItem(SHIFT_KEY, t);
        setShiftStart(t);
        setFrom(toLocalISO(new Date(t)));
        setRunning(true);
        setData(null);
        toast.success('Ca làm việc đã bắt đầu!');
    };

    const endShift = () => {
        setRunning(false);
        setTo(toLocalISO(new Date()));
        loadReport();
    };

    const clearShift = () => {
        localStorage.removeItem(SHIFT_KEY);
        setShiftStart('');
        setRunning(false);
        setElapsed('');
        setData(null);
    };

    const setPreset = (hours) => {
        const t = new Date();
        const f = new Date(t.getTime() - hours * 3600000);
        setFrom(toLocalISO(f));
        setTo(toLocalISO(t));
    };

    const loadReport = useCallback(async (customFrom, customTo) => {
        const f = customFrom || from;
        const t = customTo || to;
        if (!f || !t) return;
        setLoading(true);
        try {
            const r = await reportsApi.getShift({
                from: new Date(f).toISOString(),
                to: new Date(t).toISOString(),
            });
            setData(r.data);
        } catch (err) {
            toast.error(err?.error || 'Không tải được báo cáo');
        } finally { setLoading(false); }
    }, [from, to]);

    const exportExcel = () => {
        if (!data) return;
        const rows = data.orders.map(o => ({
            'Mã đơn': o.order_code,
            'Thời gian': fmtTime(o.created_at),
            'Khách hàng': o.customer_name || 'Khách lẻ',
            'Người bán': o.seller_name || '',
            'T.Toán': payLabel[o.payment_method] || o.payment_method,
            'Doanh thu (đ)': +o.final_amount,
            ...(admin ? { 'Lợi nhuận (đ)': +o.profit, 'Giảm giá (đ)': +o.discount } : {}),
        }));
        exportToExcel(rows, `ca-${from?.slice(0, 16)}`, 'Tổng kết ca');
    };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div className="page-header">
                <div className="page-header-left">
                    <h2>⏱ Tổng kết ca làm việc</h2>
                    <p>Theo dõi và tổng kết doanh thu theo ca</p>
                </div>
            </div>

            {/* Shift timer card */}
            <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <Clock size={22} style={{ color: running ? 'var(--success)' : 'var(--text-muted)', flexShrink: 0 }} />
                    {running ? (
                        <>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ca bắt đầu lúc</div>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>{fmtTime(shiftStart)}</div>
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--success)', letterSpacing: 2, flex: 1 }}>{elapsed}</div>
                            <button className="btn btn-primary" onClick={endShift} style={{ gap: 6 }}>
                                <Square size={14} /> Kết thúc ca & Xem báo cáo
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={clearShift} title="Huỷ ca" style={{ color: 'var(--danger)' }}>✕</button>
                        </>
                    ) : (
                        <>
                            <div style={{ flex: 1, color: 'var(--text-muted)', fontSize: 13 }}>Chưa có ca nào đang chạy</div>
                            <button className="btn btn-primary" onClick={startShift}>
                                <Play size={14} /> Bắt đầu ca
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Time range selector */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
                    🗓 Chọn khoảng thời gian xem báo cáo
                </div>
                <div style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                        {[
                            { label: 'Ca sáng (6h-14h)', h: 8, offset: () => { const d = new Date(); d.setHours(6, 0, 0, 0); return d; } },
                            { label: 'Ca chiều (14h-22h)', h: 8, offset: () => { const d = new Date(); d.setHours(14, 0, 0, 0); return d; } },
                            { label: '8 giờ qua', h: 8 },
                            { label: '4 giờ qua', h: 4 },
                            { label: 'Hôm nay', h: 24 },
                        ].map(({ label, h, offset }) => (
                            <button key={label} className="btn btn-outline btn-sm" onClick={() => {
                                const t = new Date();
                                const f = offset ? offset() : new Date(t.getTime() - h * 3600000);
                                setFrom(toLocalISO(f));
                                setTo(toLocalISO(t));
                            }}>{label}</button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Từ</label>
                            <input type="datetime-local" className="form-control" value={from} onChange={e => setFrom(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Đến</label>
                            <input type="datetime-local" className="form-control" value={to} onChange={e => setTo(e.target.value)} />
                        </div>
                        <button className="btn btn-primary" onClick={() => loadReport()} disabled={loading}>
                            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Xem báo cáo
                        </button>
                        {data && (
                            <button className="btn btn-outline" onClick={exportExcel}>
                                <Download size={14} /> Xuất Excel
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Results */}
            {loading && <div className="spinner-wrap"><div className="spinner" /></div>}

            {data && !loading && (
                <>
                    {/* Summary stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                        <StatCard label="Tổng đơn" value={data.summary.total_orders} color="var(--primary)" />
                        <StatCard label="Doanh thu" value={fmt(data.summary.total_revenue)} color="var(--primary)" />
                        {admin && <StatCard label="Lợi nhuận" value={fmt(data.summary.total_profit)} color="var(--success)" />}
                        {+data.summary.total_discount > 0 && <StatCard label="Giảm giá" value={fmt(data.summary.total_discount)} color="var(--warning)" />}
                    </div>

                    {/* Payment breakdown + Top products side by side */}
                    <div style={{ display: 'grid', gridTemplateColumns: admin ? '1fr 1fr 1fr' : '1fr 1fr', gap: 16, marginBottom: 20 }}>
                        {/* Payment methods */}
                        <div className="card" style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13 }}>💳 Hình thức thanh toán</div>
                            {data.by_payment.length === 0
                                ? <div className="text-muted" style={{ fontSize: 12 }}>Không có đơn</div>
                                : data.by_payment.map(r => (
                                    <div key={r.payment_method} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                                        <span>{payLabel[r.payment_method] || r.payment_method}</span>
                                        <span style={{ fontWeight: 700 }}>{fmt(r.revenue)} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({r.orders} đ)</span></span>
                                    </div>
                                ))}
                        </div>

                        {/* Top products */}
                        <div className="card" style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13 }}>🏆 Sản phẩm bán nhiều</div>
                            {data.top_products.length === 0
                                ? <div className="text-muted" style={{ fontSize: 12 }}>Chưa có dữ liệu</div>
                                : data.top_products.map((p, i) => (
                                    <div key={p.product_name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, fontSize: 12 }}>
                                        <span style={{ width: 18, color: 'var(--text-muted)', flexShrink: 0 }}>{i + 1}.</span>
                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.product_name}</span>
                                        <span style={{ fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>×{p.qty}</span>
                                    </div>
                                ))}
                        </div>

                        {/* Seller breakdown — admin only */}
                        {admin && (
                            <div className="card" style={{ padding: '14px 16px' }}>
                                <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13 }}>👤 Theo nhân viên</div>
                                {data.by_seller.length === 0
                                    ? <div className="text-muted" style={{ fontSize: 12 }}>Chưa có dữ liệu</div>
                                    : data.by_seller.map(s => (
                                        <div key={s.seller_name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                                            <span>{s.seller_name || '—'}</span>
                                            <span style={{ fontWeight: 700 }}>{fmt(s.revenue)} <span style={{ color: 'var(--text-muted)' }}>({s.orders} đ)</span></span>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>

                    {/* Orders list */}
                    <div className="card">
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13 }}>
                            📋 Danh sách đơn hàng trong ca ({data.orders.length} đơn)
                        </div>
                        {data.orders.length === 0
                            ? <div className="empty-state"><p>Không có đơn hàng nào trong khoảng thời gian này</p></div>
                            : (
                                <div className="table-wrap">
                                    <table>
                                        <thead><tr>
                                            <th>Mã đơn</th>
                                            <th>Thời gian</th>
                                            <th>Khách</th>
                                            {admin && <th>Người bán</th>}
                                            <th>T.Toán</th>
                                            <th>Doanh thu</th>
                                            {admin && <th>Lợi nhuận</th>}
                                        </tr></thead>
                                        <tbody>
                                            {data.orders.map(o => (
                                                <tr key={o.order_code}>
                                                    <td><span className="badge badge-primary fw-600">{o.order_code}</span></td>
                                                    <td className="text-muted fs-12">{fmtTime(o.created_at)}</td>
                                                    <td>{o.customer_name || <span className="text-muted">Khách lẻ</span>}</td>
                                                    {admin && <td>{o.seller_name || '—'}</td>}
                                                    <td><span className="badge badge-gray">{payLabel[o.payment_method] || o.payment_method}</span></td>
                                                    <td className="fw-700">{fmt(o.final_amount)}</td>
                                                    {admin && <td className="text-success fw-600">{fmt(o.profit)}</td>}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                    </div>
                </>
            )}
        </div>
    );
}
