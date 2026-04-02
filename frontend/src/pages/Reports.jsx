import { useEffect, useState, useCallback } from 'react';
import { reportsApi } from '../services/api';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { Download } from 'lucide-react';
import { exportToExcel } from '../utils/exportExcel';

function fmt(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }

const TODAY = new Date().toISOString().slice(0, 10);
const MONTH_START = TODAY.slice(0, 7) + '-01';

const BAR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6'];

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="card" style={{ padding: '10px 14px', fontSize: 13 }}>
            <div className="fw-600" style={{ marginBottom: 6 }}>{label}</div>
            {payload.map(p => <div key={p.name} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</div>)}
        </div>
    );
};

export default function Reports() {
    const [from, setFrom] = useState(MONTH_START);
    const [to, setTo] = useState(TODAY);
    const [groupBy, setGroupBy] = useState('day');
    const [revenueData, setRevenueData] = useState(null);
    const [profitData, setProfitData] = useState(null);
    const [loading, setLoading] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        const params = { from, to, group_by: groupBy };
        Promise.all([
            reportsApi.getRevenue(params),
            reportsApi.getProfit({ from, to }),
        ]).then(([rev, prof]) => {
            setRevenueData(rev);
            setProfitData(prof);
        }).finally(() => setLoading(false));
    }, [from, to, groupBy]);

    useEffect(() => { load(); }, [load]);

    const chartData = (revenueData?.data || []).map(d => ({
        period: d.period,
        'Doanh thu': Math.round(d.revenue),
        'Giá vốn': Math.round(d.cost),
        'Lợi nhuận': Math.round(d.profit),
        orders: d.orders,
    }));

    const profitByProduct = (profitData?.data || []).slice(0, 10).map(d => ({
        name: d.product_name.length > 20 ? d.product_name.slice(0, 18) + '…' : d.product_name,
        'Lợi nhuận': Math.round(d.profit),
        'Doanh thu': Math.round(d.revenue),
    }));

    const s = revenueData?.summary || {};
    const margin = s.total_revenue > 0 ? Math.round(s.total_profit / s.total_revenue * 100) : 0;

    const exportRevenue = () => {
        const rows = (revenueData?.data || []).map(d => ({
            'Kỳ': d.period,
            'Doanh thu (đ)': Math.round(d.revenue),
            'Giá vốn (đ)': Math.round(d.cost),
            'Lợi nhuận (đ)': Math.round(d.profit),
            'Số đơn': d.orders,
        }));
        exportToExcel(rows, `bao-cao-doanh-thu-${from}`, 'Doanh thu');
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h2>Báo cáo Doanh thu & Lãi lỗ</h2>
                    <p>Thống kê chi tiết theo thời gian</p>
                </div>
                <button className="btn btn-outline btn-sm" onClick={exportRevenue} disabled={!revenueData}>
                    <Download size={14} /> Xuất Excel
                </button>
            </div>

            {/* Filter */}
            <div className="filter-bar">
                <div className="flex-center gap-2"><span style={{ fontSize: 13 }}>Từ:</span><input type="date" className="form-control" style={{ width: 160 }} value={from} onChange={e => setFrom(e.target.value)} /></div>
                <div className="flex-center gap-2"><span style={{ fontSize: 13 }}>Đến:</span><input type="date" className="form-control" style={{ width: 160 }} value={to} onChange={e => setTo(e.target.value)} /></div>
                <select className="form-control" style={{ width: 150 }} value={groupBy} onChange={e => setGroupBy(e.target.value)}>
                    <option value="day">Theo ngày</option>
                    <option value="week">Theo tuần</option>
                    <option value="month">Theo tháng</option>
                </select>
                <button className="btn btn-primary" onClick={load}>Xem báo cáo</button>
            </div>

            {loading ? <div className="spinner-wrap"><div className="spinner" /></div> : (
                <>
                    {/* Summary cards */}
                    <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
                        {[
                            { label: 'Tổng doanh thu', value: fmt(s.total_revenue), color: 'var(--primary)' },
                            { label: 'Tổng giá vốn', value: fmt(s.total_cost), color: 'var(--warning)' },
                            { label: 'Tổng lợi nhuận', value: fmt(s.total_profit), color: 'var(--success)' },
                            { label: 'Biên lợi nhuận', value: margin + '%', color: margin >= 30 ? 'var(--success)' : margin >= 15 ? 'var(--warning)' : 'var(--danger)' },
                        ].map((c, i) => (
                            <div key={i} className="stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                <div className="stat-label">{c.label}</div>
                                <div className="stat-value" style={{ color: c.color, fontSize: 20 }}>{c.value}</div>
                                <div className="stat-sub">{s.total_orders || 0} đơn hàng</div>
                            </div>
                        ))}
                    </div>

                    {/* Revenue chart */}
                    {chartData.length > 0 && (
                        <div className="card" style={{ marginBottom: 20 }}>
                            <div className="card-header"><span className="card-title">📈 Doanh thu & Lợi nhuận theo {groupBy === 'day' ? 'ngày' : groupBy === 'week' ? 'tuần' : 'tháng'}</span></div>
                            <div className="card-body">
                                <ResponsiveContainer width="100%" height={260}>
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                                        <YAxis tickFormatter={v => (v / 1000000).toFixed(1) + 'M'} tick={{ fontSize: 11 }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                        <Line type="monotone" dataKey="Doanh thu" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
                                        <Line type="monotone" dataKey="Giá vốn" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
                                        <Line type="monotone" dataKey="Lợi nhuận" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Profit by product */}
                    {profitByProduct.length > 0 && (
                        <div className="card">
                            <div className="card-header"><span className="card-title">🏆 Lợi nhuận theo sản phẩm (Top 10)</span></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                                <div className="card-body">
                                    <ResponsiveContainer width="100%" height={280}>
                                        <BarChart data={profitByProduct} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis type="number" tickFormatter={v => (v / 1000).toFixed(0) + 'k'} tick={{ fontSize: 11 }} />
                                            <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="Lợi nhuận" radius={4}>
                                                {profitByProduct.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="table-wrap" style={{ padding: '0 8px' }}>
                                    <table>
                                        <thead><tr><th>#</th><th>Sản phẩm</th><th>Lợi nhuận</th><th>Doanh thu</th><th>Margin</th></tr></thead>
                                        <tbody>
                                            {(profitData?.data || []).slice(0, 10).map((p, i) => (
                                                <tr key={i}>
                                                    <td>{i + 1}</td>
                                                    <td style={{ fontSize: 12 }}>{p.product_name}</td>
                                                    <td className="text-success fw-600">{fmt(p.profit)}</td>
                                                    <td>{fmt(p.revenue)}</td>
                                                    <td><span className={`badge ${p.margin_pct >= 30 ? 'badge-success' : p.margin_pct >= 15 ? 'badge-warning' : 'badge-danger'}`}>{p.margin_pct}%</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {chartData.length === 0 && profitByProduct.length === 0 && (
                        <div className="empty-state card" style={{ padding: 60 }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                            <p>Không có dữ liệu trong khoảng thời gian này</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
