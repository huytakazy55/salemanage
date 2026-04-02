import { useEffect, useState, useCallback } from 'react';
import { reportsApi, expensesApi } from '../services/api';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { Download, Plus, Trash2, Edit2, X, Check, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { exportToExcel } from '../utils/exportExcel';
import { CurrencyInput, Req, useFormValidate, FieldError } from '../utils/formUtils';

function fmt(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }

const TODAY = new Date().toISOString().slice(0, 10);
const MONTH_START = TODAY.slice(0, 7) + '-01';

const BAR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6'];

const EXPENSE_CATEGORIES = ['Thuê mặt bằng', 'Điện nước', 'Nhân công', 'Vận chuyển', 'Marketing', 'Nợ/Lãi vay', 'Bảo trì', 'Khác'];

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="card" style={{ padding: '10px 14px', fontSize: 13 }}>
            <div className="fw-600" style={{ marginBottom: 6 }}>{label}</div>
            {payload.map(p => <div key={p.name} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</div>)}
        </div>
    );
};

// ── Expense form modal ──────────────────────────────────────────────────────
function ExpenseModal({ initial, onSave, onClose }) {
    const [form, setForm] = useState({
        expense_date: initial?.expense_date?.slice(0, 10) || TODAY,
        category: initial?.category || 'Khác',
        description: initial?.description || '',
        amount: initial?.amount || '',
    });
    const [saving, setSaving] = useState(false);
    const { errors, validate, clearError } = useFormValidate();

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        const ok = validate({
            description: { value: form.description, message: 'Vui lòng nhập mô tả khoản phát sinh' },
            amount: { value: form.amount !== '' ? form.amount : '', message: 'Vui lòng nhập số tiền' },
        });
        if (!ok) return;
        setSaving(true);
        try {
            await onSave(form);
            onClose();
        } finally { setSaving(false); }
    };

    const labelStyle = { fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 500 };

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onDoubleClick={onClose}
        >
            <div className="card" style={{ width: 440, padding: 28 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>{initial ? '✏️ Sửa khoản phát sinh' : '➕ Thêm khoản phát sinh'}</h3>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={labelStyle}>Ngày phát sinh <Req /></label>
                        <input type="date" className="form-control" value={form.expense_date} onChange={e => set('expense_date', e.target.value)} />
                    </div>
                    <div>
                        <label style={labelStyle}>Danh mục</label>
                        <select className="form-control" value={form.category} onChange={e => set('category', e.target.value)}>
                            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Mô tả <Req /></label>
                        <input
                            className={`form-control${errors.description ? ' is-invalid' : ''}`}
                            placeholder="VD: Tiền thuê tháng 4..."
                            value={form.description}
                            onChange={e => { set('description', e.target.value); clearError('description'); }}
                        />
                        <FieldError error={errors.description} />
                    </div>
                    <div>
                        <label style={labelStyle}>Số tiền (đ) <Req /></label>
                        <CurrencyInput
                            className={`form-control input-currency${errors.amount ? ' is-invalid' : ''}`}
                            placeholder="0"
                            value={form.amount}
                            onChange={v => { set('amount', v); clearError('amount'); }}
                        />
                        <FieldError error={errors.amount} />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 22, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>Hủy</button>
                    <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                        {saving ? '...' : <><Check size={14} /> Lưu</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Reports page ───────────────────────────────────────────────────────
export default function Reports() {
    const [from, setFrom] = useState(MONTH_START);
    const [to, setTo] = useState(TODAY);
    const [groupBy, setGroupBy] = useState('day');
    const [revenueData, setRevenueData] = useState(null);
    const [profitData, setProfitData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Extra expenses state
    const [expenses, setExpenses] = useState([]);
    const [expenseSummary, setExpenseSummary] = useState({ total: 0 });
    const [expLoading, setExpLoading] = useState(false);
    const [showExpenses, setShowExpenses] = useState(true);
    const [expModal, setExpModal] = useState(null); // null | 'add' | expense-object
    const [deleting, setDeleting] = useState(null);

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

    const loadExpenses = useCallback(() => {
        setExpLoading(true);
        Promise.all([
            expensesApi.getAll({ from, to }),
            expensesApi.getSummary({ from, to }),
        ]).then(([list, summ]) => {
            setExpenses(list.data || []);
            setExpenseSummary({ total: summ.total || 0, byCategory: summ.data || [] });
        }).finally(() => setExpLoading(false));
    }, [from, to]);

    useEffect(() => { load(); loadExpenses(); }, [load, loadExpenses]);

    const handleAddExpense = async (form) => {
        await expensesApi.create(form);
        loadExpenses();
    };

    const handleEditExpense = async (form) => {
        await expensesApi.update(expModal.id, form);
        loadExpenses();
    };

    const handleDelete = async (id) => {
        setDeleting(id);
        try {
            await expensesApi.delete(id);
            loadExpenses();
        } finally { setDeleting(null); }
    };

    const chartData = (revenueData?.data || []).map(d => ({
        period: d.period,
        'Doanh thu': Math.round(d.revenue),
        'Giá vốn': Math.round(d.cost),
        'Lợi nhuận thô': Math.round(d.profit),
        orders: d.orders,
    }));

    const profitByProduct = (profitData?.data || []).slice(0, 10).map(d => ({
        name: d.product_name.length > 20 ? d.product_name.slice(0, 18) + '…' : d.product_name,
        'Lợi nhuận': Math.round(d.profit),
        'Doanh thu': Math.round(d.revenue),
    }));

    const s = revenueData?.summary || {};
    const totalExpenses = Number(expenseSummary.total || 0);
    const netProfit = Math.round((s.total_profit || 0) - totalExpenses);
    const netMargin = s.total_revenue > 0 ? Math.round(netProfit / s.total_revenue * 100) : 0;
    const grossMargin = s.total_revenue > 0 ? Math.round((s.total_profit || 0) / s.total_revenue * 100) : 0;

    const exportRevenue = () => {
        const rows = (revenueData?.data || []).map(d => ({
            'Kỳ': d.period,
            'Doanh thu (đ)': Math.round(d.revenue),
            'Giá vốn (đ)': Math.round(d.cost),
            'Lợi nhuận thô (đ)': Math.round(d.profit),
            'Số đơn': d.orders,
        }));
        const expRows = expenses.map(e => ({
            'Ngày': e.expense_date,
            'Danh mục': e.category,
            'Mô tả': e.description,
            'Số tiền (đ)': Number(e.amount),
        }));
        exportToExcel([
            ...rows,
            {},
            { 'Kỳ': '--- KHOẢN PHÁT SINH ---' },
            ...expRows,
            { 'Kỳ': 'TỔNG PHÁT SINH', 'Doanh thu (đ)': totalExpenses },
            { 'Kỳ': 'LÃI THỰC', 'Doanh thu (đ)': netProfit },
        ], `bao-cao-doanh-thu-${from}`, 'Doanh thu');
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h2>Báo cáo Doanh thu & Lãi lỗ</h2>
                    <p>Thống kê chi tiết theo thời gian (bao gồm khoản phát sinh)</p>
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
                <button className="btn btn-primary" onClick={() => { load(); loadExpenses(); }}>Xem báo cáo</button>
            </div>

            {loading ? <div className="spinner-wrap"><div className="spinner" /></div> : (
                <>
                    {/* Summary cards - 5 cards now including net profit */}
                    <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 24 }}>
                        {[
                            { label: 'Tổng doanh thu', value: fmt(s.total_revenue), color: 'var(--primary)', sub: `${s.total_orders || 0} đơn hàng` },
                            { label: 'Tổng giá vốn', value: fmt(s.total_cost), color: 'var(--warning)', sub: `Biên thô: ${grossMargin}%` },
                            { label: 'Lợi nhuận thô', value: fmt(s.total_profit), color: '#10b981', sub: 'Trước khoản phát sinh' },
                            { label: 'Tổng phát sinh', value: fmt(totalExpenses), color: 'var(--danger)', sub: `${expenses.length} khoản` },
                            {
                                label: 'Lãi thực cầm về',
                                value: fmt(netProfit),
                                color: netProfit >= 0 ? '#6366f1' : 'var(--danger)',
                                sub: `Biên thực: ${netMargin}%`,
                                highlight: true
                            },
                        ].map((c, i) => (
                            <div key={i} className="stat-card" style={{
                                flexDirection: 'column', alignItems: 'flex-start',
                                ...(c.highlight ? { border: '2px solid var(--primary)', background: 'linear-gradient(135deg, #6366f110, #8b5cf610)' } : {})
                            }}>
                                <div className="stat-label" style={c.highlight ? { fontWeight: 700 } : {}}>{c.label}</div>
                                <div className="stat-value" style={{ color: c.color, fontSize: 18 }}>{c.value}</div>
                                <div className="stat-sub">{c.sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* ── Extra Expenses Section ── */}
                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setShowExpenses(v => !v)}>
                            <span className="card-title">💸 Khoản phát sinh trong kỳ</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                {totalExpenses > 0 && (
                                    <span style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>
                                        Tổng: -{fmt(totalExpenses)}
                                    </span>
                                )}
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={e => { e.stopPropagation(); setExpModal('add'); }}
                                    style={{ gap: 4 }}
                                >
                                    <Plus size={13} /> Thêm
                                </button>
                                {showExpenses ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                        </div>

                        {showExpenses && (
                            <div className="card-body" style={{ padding: 0 }}>
                                {expLoading ? (
                                    <div style={{ padding: 24, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                                ) : expenses.length === 0 ? (
                                    <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        <AlertCircle size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                                        <p style={{ margin: 0, fontSize: 13 }}>Chưa có khoản phát sinh nào trong kỳ này</p>
                                        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setExpModal('add')}>
                                            <Plus size={13} /> Thêm khoản phát sinh
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {/* Category breakdown */}
                                        {(expenseSummary.byCategory || []).length > 1 && (
                                            <div style={{ padding: '12px 20px', background: 'var(--bg-secondary, #f8fafc)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                {(expenseSummary.byCategory || []).map((c, i) => (
                                                    <span key={i} style={{
                                                        padding: '3px 10px', borderRadius: 20, fontSize: 12,
                                                        background: BAR_COLORS[i % BAR_COLORS.length] + '20',
                                                        color: BAR_COLORS[i % BAR_COLORS.length],
                                                        fontWeight: 600, border: `1px solid ${BAR_COLORS[i % BAR_COLORS.length]}40`
                                                    }}>
                                                        {c.category}: {fmt(c.total_amount)}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <div className="table-wrap">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>#</th>
                                                        <th>Ngày</th>
                                                        <th>Danh mục</th>
                                                        <th>Mô tả</th>
                                                        <th style={{ textAlign: 'right' }}>Số tiền</th>
                                                        <th></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {expenses.map((e, i) => (
                                                        <tr key={e.id}>
                                                            <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{i + 1}</td>
                                                            <td style={{ fontSize: 12 }}>{e.expense_date?.slice(0, 10)}</td>
                                                            <td>
                                                                <span style={{
                                                                    padding: '2px 8px', borderRadius: 12, fontSize: 11,
                                                                    background: BAR_COLORS[EXPENSE_CATEGORIES.indexOf(e.category) % BAR_COLORS.length] + '20',
                                                                    color: BAR_COLORS[EXPENSE_CATEGORIES.indexOf(e.category) % BAR_COLORS.length],
                                                                }}>
                                                                    {e.category}
                                                                </span>
                                                            </td>
                                                            <td style={{ fontSize: 13 }}>{e.description}</td>
                                                            <td style={{ textAlign: 'right', color: 'var(--danger)', fontWeight: 600 }}>
                                                                -{fmt(e.amount)}
                                                            </td>
                                                            <td>
                                                                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                                                    <button className="btn btn-ghost btn-sm" onClick={() => setExpModal(e)} title="Sửa">
                                                                        <Edit2 size={13} />
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-ghost btn-sm"
                                                                        style={{ color: 'var(--danger)' }}
                                                                        onClick={() => handleDelete(e.id)}
                                                                        disabled={deleting === e.id}
                                                                        title="Xóa"
                                                                    >
                                                                        {deleting === e.id ? '...' : <Trash2 size={13} />}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                                                        <td colSpan={4} style={{ padding: '10px 12px', fontSize: 13 }}>Tổng khoản phát sinh</td>
                                                        <td style={{ textAlign: 'right', color: 'var(--danger)', fontSize: 15 }} colSpan={2}>
                                                            -{fmt(totalExpenses)}
                                                        </td>
                                                    </tr>
                                                    <tr style={{ background: 'linear-gradient(135deg, #6366f108, #8b5cf608)', fontWeight: 700 }}>
                                                        <td colSpan={4} style={{ padding: '10px 12px', fontSize: 13, color: 'var(--primary)' }}>🎯 Lãi thực cầm về</td>
                                                        <td style={{ textAlign: 'right', fontSize: 15, color: netProfit >= 0 ? 'var(--primary)' : 'var(--danger)' }} colSpan={2}>
                                                            {fmt(netProfit)}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
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
                                        <Line type="monotone" dataKey="Lợi nhuận thô" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
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

            {/* Expense modal */}
            {expModal && (
                <ExpenseModal
                    initial={expModal === 'add' ? null : expModal}
                    onSave={expModal === 'add' ? handleAddExpense : handleEditExpense}
                    onClose={() => setExpModal(null)}
                />
            )}
        </div>
    );
}
