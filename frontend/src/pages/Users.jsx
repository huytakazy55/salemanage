import { useEffect, useState, useCallback } from 'react';
import { usersApi, storesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, X, Users, Shield, User, Store } from 'lucide-react';

function UserModal({ user, stores, currentUserRole, onClose, onSaved }) {
    const isEdit = !!user;
    const [form, setForm] = useState(
        isEdit
            ? { full_name: user.full_name, role: user.role, store_id: user.store_id || '', is_active: user.is_active, password: '' }
            : { username: '', password: '', full_name: '', role: 'employee', store_id: stores[0]?.id || '', is_active: true }
    );
    const [saving, setSaving] = useState(false);

    const roleNeedsStore = form.role !== 'super_admin';
    // admin can only assign their own store
    const showStorePicker = currentUserRole === 'super_admin' && roleNeedsStore;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isEdit && (!form.username || !form.password)) return toast.error('Username và mật khẩu là bắt buộc');
        if (!isEdit && !form.full_name) return toast.error('Họ tên là bắt buộc');
        if (roleNeedsStore && !form.store_id) return toast.error('Vui lòng chọn cửa hàng');
        setSaving(true);
        try {
            const data = { ...form, store_id: roleNeedsStore ? form.store_id : null };
            if (isEdit) await usersApi.update(user.id, data);
            else await usersApi.create(data);
            toast.success(isEdit ? 'Đã cập nhật!' : 'Đã tạo tài khoản!');
            onSaved();
        } catch (err) { toast.error(err.error || 'Có lỗi'); }
        finally { setSaving(false); }
    };

    return (
        <div className="modal-overlay" onDoubleClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
                <div className="modal-header">
                    <span className="modal-title">{isEdit ? '✏️ Sửa người dùng' : '➕ Thêm người dùng'}</span>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {!isEdit && (
                            <div className="form-group">
                                <label className="form-label">Username <span className="req-star">*</span></label>
                                <input className="form-control" value={form.username || ''} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="nhanvien2" />
                            </div>
                        )}
                        <div className="form-group">
                            <label className="form-label">Họ tên <span className="req-star">*</span></label>
                            <input className="form-control" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Nguyễn Văn A" />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Vai trò</label>
                                <select className="form-control" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                                    <option value="employee">👤 Nhân viên</option>
                                    <option value="admin">🔑 Admin cửa hàng</option>
                                    {currentUserRole === 'super_admin' && (
                                        <option value="super_admin">👑 Super Admin</option>
                                    )}
                                </select>
                            </div>
                            {isEdit && (
                                <div className="form-group">
                                    <label className="form-label">Trạng thái</label>
                                    <select className="form-control" value={form.is_active ? 'true' : 'false'} onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'true' }))}>
                                        <option value="true">✅ Hoạt động</option>
                                        <option value="false">🔒 Đã khóa</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Store selector — only super_admin can pick store */}
                        {showStorePicker && (
                            <div className="form-group">
                                <label className="form-label">Cửa hàng <span className="req-star">*</span></label>
                                <select
                                    className="form-control"
                                    value={form.store_id}
                                    onChange={e => setForm(f => ({ ...f, store_id: e.target.value }))}>
                                    <option value="">-- Chọn cửa hàng --</option>
                                    {stores.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* admin assigns to their own store, show info */}
                        {!showStorePicker && roleNeedsStore && currentUserRole === 'admin' && (
                            <div className="form-group">
                                <label className="form-label">Cửa hàng</label>
                                <div className="form-control" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Store size={14} /> Tự động gán vào cửa hàng của bạn
                                </div>
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">{isEdit ? 'Mật khẩu mới (để trống = không đổi)' : 'Mật khẩu *'}</label>
                            <input className="form-control" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={isEdit ? 'Để trống nếu không đổi' : '••••••'} />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={onClose}>Hủy</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo tài khoản'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function roleLabel(role) {
    if (role === 'super_admin') return <span className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>👑 Super Admin</span>;
    if (role === 'admin') return <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>🔑 Admin</span>;
    return <span className="badge badge-primary">👤 Nhân viên</span>;
}

export default function UsersPage() {
    const { user: currentUser, isSuperAdmin } = useAuth();
    const [users, setUsers] = useState([]);
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        Promise.all([
            usersApi.getAll(),
            isSuperAdmin() ? storesApi.getAll() : Promise.resolve({ data: [] }),
        ]).then(([u, s]) => {
            setUsers(u.data || []);
            setStores(s.data || []);
        }).finally(() => setLoading(false));
    }, [isSuperAdmin]);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async (u) => {
        if (!confirm(`Xóa tài khoản "${u.username}"?`)) return;
        try { await usersApi.delete(u.id); toast.success('Đã xóa'); load(); }
        catch (err) { toast.error(err.error || 'Có lỗi'); }
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h2>Quản lý người dùng</h2>
                    <p>{users.length} tài khoản</p>
                </div>
                <button className="btn btn-primary" onClick={() => setModal('add')}>
                    <Plus size={14} /> Thêm người dùng
                </button>
            </div>

            <div className="card">
                {loading ? <div className="spinner-wrap"><div className="spinner" /></div> :
                    users.length === 0 ? <div className="empty-state"><Users size={40} /><p>Chưa có người dùng</p></div> : (
                        <div className="table-wrap">
                            <table>
                                <thead><tr>
                                    <th>Người dùng</th>
                                    <th>Username</th>
                                    <th>Vai trò</th>
                                    <th>Cửa hàng</th>
                                    <th>Trạng thái</th>
                                    <th>Ngày tạo</th>
                                    <th></th>
                                </tr></thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: u.role === 'super_admin' ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : u.role === 'admin' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                                                        {u.role === 'super_admin' ? '👑' : u.role === 'admin' ? '🔑' : '👤'}
                                                    </div>
                                                    <span className="fw-600">{u.full_name}</span>
                                                </div>
                                            </td>
                                            <td><code style={{ background: 'var(--bg)', padding: '2px 8px', borderRadius: 6, fontSize: 12 }}>{u.username}</code></td>
                                            <td>{roleLabel(u.role)}</td>
                                            <td>
                                                {u.store_name
                                                    ? <span style={{ fontSize: 13 }}>🏪 {u.store_name}</span>
                                                    : <span className="text-muted fs-12">—</span>}
                                            </td>
                                            <td>{u.is_active
                                                ? <span className="badge badge-success">Hoạt động</span>
                                                : <span className="badge badge-danger">Đã khóa</span>}
                                            </td>
                                            <td className="text-muted fs-12">{new Date(u.created_at).toLocaleDateString('vi-VN')}</td>
                                            <td>
                                                {u.id !== currentUser?.id ? (
                                                    <div className="flex gap-2">
                                                        <button className="btn btn-outline btn-sm btn-icon" onClick={() => setModal(u)}><Edit2 size={13} /></button>
                                                        <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(u)}><Trash2 size={13} /></button>
                                                    </div>
                                                ) : <span className="text-muted fs-12">(Bạn)</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
            </div>

            {modal && (
                <UserModal
                    user={modal === 'add' ? null : modal}
                    stores={stores}
                    currentUserRole={currentUser?.role}
                    onClose={() => setModal(null)}
                    onSaved={() => { setModal(null); load(); }}
                />
            )}
        </div>
    );
}
