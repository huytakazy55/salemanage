import { useEffect, useState } from 'react';
import { reportsApi, productsApi } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, ShoppingCart, Package, AlertTriangle, DollarSign, BarChart3, Star } from 'lucide-react';

function fmt(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }

function StatCard({ icon: Icon, label, value, sub, iconClass, trend }) {
    return (
        <div className="stat-card">
            <div className={`stat-icon ${iconClass}`}><Icon /></div>
            <div>
                <div className="stat-value">{value}</div>
                <div className="stat-label">{label}</div>
                {sub && <div className="stat-sub">{sub}</div>}
                {trend !== undefined && (
                    <span className={`stat-trend ${trend >= 0 ? 'up' : 'down'}`}>
                        {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
                    </span>
                )}
            </div>
        </div>
    );
}

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="card" style={{ padding: '10px 14px', fontSize: 13 }}>
            <div className="fw-600 mb-4" style={{ marginBottom: 6 }}>{label}</div>
            {payload.map(p => (
                <div key={p.name} style={{ color: p.color }}>
                    {p.name}: {Number(p.value).toLocaleString('vi-VN')}đ
                </div>
            ))}
        </div>
    );
};

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [lowStock, setLowStock] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            reportsApi.getDashboard(),
            productsApi.getAll({ low_stock: true })
        ]).then(([dash, ls]) => {
            setData(dash.data);
            setLowStock(ls.data || []);
        }).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;
    if (!data) return null;

    const { today, month, inventory, chart, topProducts } = data;

    // Fill missing days in chart
    const chartData = chart.map(d => ({
        date: new Date(d.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        'Doanh thu': Math.round(d.revenue),
        'Lợi nhuận': Math.round(d.profit),
    }));

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h2>Tổng quan hôm nay</h2>
                    <p>Cập nhật theo thời gian thực từ hệ thống</p>
                </div>
            </div>

            <div className="stat-grid">
                <StatCard icon={TrendingUp} label="Doanh thu hôm nay" value={fmt(today.revenue)} sub={`${today.orders} đơn hàng`} iconClass="purple" />
                <StatCard icon={DollarSign} label="Lợi nhuận hôm nay" value={fmt(today.profit)} sub={`Tỷ lệ: ${today.revenue > 0 ? Math.round(today.profit / today.revenue * 100) : 0}%`} iconClass="green" />
                <StatCard icon={ShoppingCart} label="Doanh thu tháng này" value={fmt(month.revenue)} sub={`${month.orders} đơn hàng`} iconClass="blue" />
                <StatCard icon={BarChart3} label="Lợi nhuận tháng này" value={fmt(month.profit)} iconClass="pink" />
                <StatCard icon={Package} label="Tổng sản phẩm" value={inventory.totalProducts} sub={`${inventory.outOfStock} hết hàng`} iconClass="orange" />
                <StatCard icon={AlertTriangle} label="Hàng sắp hết" value={inventory.lowStockProducts} sub="Cần nhập thêm" iconClass="red" />
            </div>

            <div className="dashboard-grid">
                {/* Revenue Chart */}
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">📈 Doanh thu & Lợi nhuận 7 ngày qua</span>
                    </div>
                    <div className="card-body">
                        {chartData.length === 0 ? (
                            <div className="empty-state"><p>Chưa có dữ liệu</p></div>
                        ) : (
                            <ResponsiveContainer width="100%" height={240}>
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                    <YAxis tickFormatter={v => (v / 1000).toFixed(0) + 'k'} tick={{ fontSize: 11 }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Line type="monotone" dataKey="Doanh thu" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                    <Line type="monotone" dataKey="Lợi nhuận" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Top Products */}
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">🏆 Top sản phẩm tháng này</span>
                    </div>
                    <div className="card-body" style={{ padding: '10px 16px' }}>
                        {topProducts.length === 0 ? <div className="empty-state"><p>Chưa có đơn hàng</p></div> : (
                            topProducts.map((p, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < topProducts.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                                    <div style={{ width: 24, height: 24, borderRadius: 6, background: i === 0 ? '#fef3c7' : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: i === 0 ? '#92400e' : 'var(--text-muted)', flexShrink: 0 }}>
                                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.product_name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Bán {p.qty_sold} cái</div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--success)' }}>{fmt(p.profit)}</div>
                                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>lãi</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Low stock warning */}
            {lowStock.length > 0 && (
                <div className="card mt-4" style={{ marginTop: 20, borderColor: '#fde68a' }}>
                    <div className="card-header" style={{ background: '#fffbeb' }}>
                        <span className="card-title" style={{ color: '#92400e' }}>⚠️ Cảnh báo hàng sắp hết ({lowStock.length} sản phẩm)</span>
                    </div>
                    <div className="table-wrap">
                        <table>
                            <thead><tr><th>Sản phẩm</th><th>SKU</th><th>Tồn kho</th><th>Tồn tối thiểu</th><th>Tình trạng</th></tr></thead>
                            <tbody>
                                {lowStock.slice(0, 5).map(p => (
                                    <tr key={p.id}>
                                        <td className="fw-600">{p.name}</td>
                                        <td><span className="badge badge-gray">{p.sku || '—'}</span></td>
                                        <td className={p.stock === 0 ? 'stock-out' : 'stock-low'}>{p.stock} {p.unit}</td>
                                        <td className="text-muted">{p.min_stock} {p.unit}</td>
                                        <td>{p.stock === 0 ? <span className="badge badge-danger">Hết hàng</span> : <span className="badge badge-warning">Sắp hết</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
