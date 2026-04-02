import { useState, useEffect, useCallback } from 'react';
import { reportsApi, salaryConfigApi } from '../services/api';
import { Users, TrendingUp, DollarSign, Save } from 'lucide-react';
import toast from 'react-hot-toast';

function fmt(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 7) + '-01';

export default function EmployeeReport() {
    const [tab, setTab] = useState('performance'); // 'performance' | 'salary'
    const [from, setFrom] = useState(monthStart());
    const [to, setTo] = useState(today());
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    // Salary config — only base_salary now, commission is per-product
    const [baseSalary, setBaseSalary] = useState('');
    const [configSaving, setConfigSaving] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        const params = { from, to };
        const apiCall = tab === 'salary'
            ? reportsApi.getSalary(params)
            : reportsApi.getEmployeePerformance(params);
        apiCall.then(r => setData(r.data || [])).finally(() => setLoading(false));
    }, [tab, from, to]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        salaryConfigApi.get().then(r => {
            if (r.data?.length) setBaseSalary(r.data[0].base_salary);
        }).catch(() => { });
    }, []);

    const saveConfig = async () => {
        setConfigSaving(true);
        try {
            await salaryConfigApi.upsert({ base_salary: +baseSalary || 0 });
            toast.success('Đã lưu lương cơ bản');
            if (tab === 'salary') load();
        } catch (e) {
            toast.error(e.error || 'Lỗi lưu cấu hình');
        } finally { setConfigSaving(false); }
    };

    const totalOrders = data.reduce((s, r) => s + (r.total_orders || 0), 0);
    const totalItems = data.reduce((s, r) => s + (r.total_items || 0), 0);
    const totalRevenue = data.reduce((s, r) => s + +(r.total_revenue || 0), 0);
    const totalSalary = tab === 'salary' ? data.reduce((s, r) => s + +(r.calculated_salary || 0), 0) : 0;

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h2>Hiệu suất nhân viên</h2>
                    <p>Theo dõi doanh số và tính lương nhân viên</p>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button
                    className={`btn ${tab === 'performance' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    onClick={() => setTab('performance')}
                >
                    <TrendingUp size={14} /> Doanh số
                </button>
                <button
                    className={`btn ${tab === 'salary' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    onClick={() => setTab('salary')}
                >
                    <DollarSign size={14} /> Tính lương
                </button>
            </div>

            {/* Salary config (shown in salary tab) */}
            {tab === 'salary' && (
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <DollarSign size={16} />
                        <strong>Lương cơ bản</strong>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '0 0 4px' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <label className="form-label">Lương cơ bản (đ/tháng)</label>
                            <input
                                type="number"
                                className="form-control"
                                placeholder="VD: 3000000"
                                value={baseSalary}
                                onChange={e => setBaseSalary(e.target.value)}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button className="btn btn-primary" onClick={saveConfig} disabled={configSaving}>
                                <Save size={14} /> {configSaving ? 'Đang lưu...' : 'Lưu'}
                            </button>
                        </div>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                        💡 <strong>Công thức:</strong> Lương = Lương cơ bản + Σ (Doanh thu SP × % Hoa hồng SP)<br />
                        <span style={{ opacity: 0.75 }}>% Hoa hồng từng sản phẩm được cấu hình trong trang <strong>Sản phẩm</strong></span>
                    </p>
                </div>
            )}

            {/* Date filters */}
            <div className="filter-bar">
                <div className="flex-center gap-2">
                    <span style={{ fontSize: 13 }}>Từ ngày:</span>
                    <input type="date" className="form-control" style={{ width: 155 }} value={from} onChange={e => setFrom(e.target.value)} />
                </div>
                <div className="flex-center gap-2">
                    <span style={{ fontSize: 13 }}>Đến ngày:</span>
                    <input type="date" className="form-control" style={{ width: 155 }} value={to} onChange={e => setTo(e.target.value)} />
                </div>
                <button className="btn btn-outline btn-sm" onClick={load}>Lọc</button>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right', fontSize: 13 }}>
                        <div className="text-muted fs-12">Tổng đơn</div>
                        <div className="fw-700">{totalOrders}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 13 }}>
                        <div className="text-muted fs-12">Tổng SP bán</div>
                        <div className="fw-700">{totalItems}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 13 }}>
                        <div className="text-muted fs-12">Doanh thu</div>
                        <div className="fw-700" style={{ color: 'var(--primary)' }}>{fmt(totalRevenue)}</div>
                    </div>
                    {tab === 'salary' && (
                        <div style={{ textAlign: 'right', fontSize: 13 }}>
                            <div className="text-muted fs-12">Tổng lương</div>
                            <div className="fw-700" style={{ color: '#f59e0b' }}>{fmt(totalSalary)}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="card">
                {loading ? <div className="spinner-wrap"><div className="spinner" /></div> :
                    data.length === 0 ? (
                        <div className="empty-state">
                            <Users size={48} />
                            <p>Không có dữ liệu nhân viên trong kỳ này</p>
                        </div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Nhân viên</th>
                                        <th>Cửa hàng</th>
                                        <th>Số đơn</th>
                                        <th>SP bán</th>
                                        <th>Doanh thu</th>
                                        {tab === 'performance' && <th>Lợi nhuận</th>}
                                        {tab === 'salary' && <>
                                            <th>Lương CB</th>
                                            <th>Hoa hồng (%SP)</th>
                                            <th style={{ color: '#f59e0b' }}>Tổng lương</th>
                                        </>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((row, i) => (
                                        <tr key={row.user_id}>
                                            <td className="text-muted">{i + 1}</td>
                                            <td>
                                                <div className="fw-600">{row.full_name}</div>
                                                <div className="text-muted fs-12">@{row.username}</div>
                                            </td>
                                            <td className="text-muted">{row.store_name}</td>
                                            <td><span className="badge badge-primary">{row.total_orders}</span></td>
                                            <td className="fw-600">{row.total_items}</td>
                                            <td className="fw-700" style={{ color: 'var(--primary)' }}>{fmt(row.total_revenue)}</td>
                                            {tab === 'performance' && (
                                                <td className="text-success fw-600">{fmt(row.total_profit)}</td>
                                            )}
                                            {tab === 'salary' && <>
                                                <td>{fmt(row.base_salary)}</td>
                                                <td className="text-success fw-600">{fmt(row.commission_earned)}</td>
                                                <td>
                                                    <span style={{
                                                        display: 'inline-block', padding: '3px 10px', borderRadius: 6,
                                                        background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
                                                        fontWeight: 700, fontSize: 14
                                                    }}>
                                                        {fmt(row.calculated_salary)}
                                                    </span>
                                                </td>
                                            </>}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
            </div>
        </div>
    );
}
