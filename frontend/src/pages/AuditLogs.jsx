import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Trash2, RefreshCw, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const token = () => localStorage.getItem('token');

const axiosAuth = () => axios.create({
    baseURL: API,
    headers: { Authorization: `Bearer ${token()}` },
});

const ACTION_STYLES = {
    CREATE: { bg: '#d1fae5', color: '#065f46', label: '➕ Tạo mới' },
    UPDATE: { bg: '#dbeafe', color: '#1e40af', label: '✏️ Cập nhật' },
    DELETE: { bg: '#fee2e2', color: '#991b1b', label: '🗑 Xóa' },
};

const ENTITY_LABELS = {
    products: '📦 Sản phẩm',
    users:    '👤 Người dùng',
    expenses: '💸 Khoản phát sinh',
    orders:   '🧾 Đơn hàng',
    stores:   '🏪 Cửa hàng',
    inventory: '📋 Nhập kho',
};

function fmtTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AuditLogs() {
    const { isSuperAdmin } = useAuth();
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [clearing, setClearing] = useState(false);

    // Filters
    const [filterAction, setFilterAction]     = useState('');
    const [filterEntity, setFilterEntity]     = useState('');
    const [filterFrom, setFilterFrom]         = useState('');
    const [filterTo, setFilterTo]             = useState('');

    useEffect(() => {
        if (!isSuperAdmin()) navigate('/');
    }, [isSuperAdmin, navigate]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: 300 });
            if (filterAction) params.set('action', filterAction);
            if (filterEntity) params.set('entity_type', filterEntity);
            if (filterFrom)   params.set('from', filterFrom);
            if (filterTo)     params.set('to', filterTo);
            const { data } = await axiosAuth().get(`/audit-logs?${params}`);
            setLogs(data.data || []);
        } catch {
            toast.error('Không thể tải lịch sử thay đổi');
        } finally { setLoading(false); }
    }, [filterAction, filterEntity, filterFrom, filterTo]);

    useEffect(() => { load(); }, [load]);

    const handleClear = async () => {
        if (!confirm('Xóa tất cả log cũ hơn 90 ngày?')) return;
        setClearing(true);
        try {
            const { data } = await axiosAuth().delete('/audit-logs/clear');
            toast.success(data.message);
            load();
        } catch { toast.error('Lỗi khi xóa log'); }
        finally { setClearing(false); }
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h2>🔍 Lịch sử thay đổi</h2>
                    <p>{logs.length} bản ghi gần nhất</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
                        <RefreshCw size={14} /> Làm mới
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                        onClick={handleClear} disabled={clearing}>
                        <Trash2 size={14} /> Xóa log cũ
                    </button>
                </div>
            </div>

            {/* Filter bar */}
            <div className="filter-bar">
                <select className="form-control" style={{ width: 160 }}
                    value={filterAction} onChange={e => setFilterAction(e.target.value)}>
                    <option value="">Tất cả hành động</option>
                    <option value="CREATE">Tạo mới</option>
                    <option value="UPDATE">Cập nhật</option>
                    <option value="DELETE">Xóa</option>
                </select>

                <select className="form-control" style={{ width: 200 }}
                    value={filterEntity} onChange={e => setFilterEntity(e.target.value)}>
                    <option value="">Tất cả đối tượng</option>
                    {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                    ))}
                </select>

                <input type="date" className="form-control" style={{ width: 160 }}
                    value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                    placeholder="Từ ngày" />
                <input type="date" className="form-control" style={{ width: 160 }}
                    value={filterTo} onChange={e => setFilterTo(e.target.value)}
                    placeholder="Đến ngày" />
                <button className="btn btn-outline btn-sm" onClick={() => { setFilterAction(''); setFilterEntity(''); setFilterFrom(''); setFilterTo(''); }}>
                    <Filter size={13} /> Reset
                </button>
            </div>

            <div className="card">
                {loading ? (
                    <div className="spinner-wrap"><div className="spinner" /></div>
                ) : logs.length === 0 ? (
                    <div className="empty-state">
                        <ClipboardList size={48} />
                        <p>Chưa có lịch sử thay đổi nào</p>
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Thời gian</th>
                                    <th>Hành động</th>
                                    <th>Đối tượng</th>
                                    <th>Tên bản ghi</th>
                                    <th>Trường thay đổi</th>
                                    <th>Người thực hiện</th>
                                    <th>Cửa hàng</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => {
                                    const actionStyle = ACTION_STYLES[log.action] || {};
                                    const changedFields = log.changed_fields
                                        ? (Array.isArray(log.changed_fields) ? log.changed_fields : JSON.parse(log.changed_fields))
                                        : null;
                                    return (
                                        <tr key={log.id}>
                                            <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-muted)' }}>
                                                {fmtTime(log.created_at)}
                                            </td>
                                            <td>
                                                <span style={{
                                                    background: actionStyle.bg,
                                                    color: actionStyle.color,
                                                    fontSize: 11, fontWeight: 600,
                                                    padding: '3px 8px', borderRadius: 20,
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {actionStyle.label || log.action}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 12 }}>
                                                {ENTITY_LABELS[log.entity_type] || log.entity_type}
                                            </td>
                                            <td style={{ fontSize: 13, fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {log.entity_name || <span className="text-muted">—</span>}
                                            </td>
                                            <td style={{ fontSize: 12 }}>
                                                {changedFields?.length ? (
                                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                        {changedFields.map(f => (
                                                            <span key={f} style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: 10, fontSize: 11 }}>
                                                                {f}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : <span className="text-muted fs-12">—</span>}
                                            </td>
                                            <td>
                                                <div style={{ fontSize: 13 }}>{log.user_name || '—'}</div>
                                                {log.user_role && (
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                        {log.user_role === 'super_admin' ? '👑' : log.user_role === 'admin' ? '🔑' : '👤'} {log.user_username}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ fontSize: 12 }}>
                                                {log.store_name ? `🏪 ${log.store_name}` : <span className="text-muted">—</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
