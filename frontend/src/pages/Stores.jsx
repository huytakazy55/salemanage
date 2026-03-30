import { useEffect, useState } from 'react';
import { storesApi } from '../services/api';
import toast from 'react-hot-toast';
import { Store, Plus, Edit2, Trash2, Users } from 'lucide-react';

function StoreModal({ store, onClose, onSave }) {
    const [form, setForm] = useState({
        name: store?.name || '',
        address: store?.address || '',
        phone: store?.phone || '',
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name) return toast.error('Tên cửa hàng là bắt buộc');
        setSaving(true);
        try {
            if (store) {
                await storesApi.update(store.id, form);
                toast.success('Đã cập nhật cửa hàng');
            } else {
                await storesApi.create(form);
                toast.success('Đã thêm cửa hàng');
            }
            onSave();
        } catch (err) {
            toast.error(err.error || 'Có lỗi xảy ra');
        } finally { setSaving(false); }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
                <div className="modal-header">
                    <span className="modal-title">{store ? '✏️ Sửa cửa hàng' : '🏪 Thêm cửa hàng'}</span>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Tên cửa hàng *</label>
                            <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: SaleManage Chi nhánh 1" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Địa chỉ</label>
                            <input className="form-control" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Địa chỉ cửa hàng" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Số điện thoại</label>
                            <input className="form-control" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0901234567" />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={onClose}>Hủy</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function Stores() {
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // null | 'add' | store object

    const load = () => {
        setLoading(true);
        storesApi.getAll().then(r => setStores(r.data || [])).finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const handleDelete = async (store) => {
        if (!confirm(`Xóa cửa hàng "${store.name}"? Tất cả dữ liệu liên quan sẽ bị ảnh hưởng.`)) return;
        try {
            await storesApi.delete(store.id);
            toast.success('Đã xóa cửa hàng');
            load();
        } catch (err) { toast.error(err.error || 'Có lỗi xảy ra'); }
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h2>Quản lý cửa hàng</h2>
                    <p>{stores.length} cửa hàng</p>
                </div>
                <button className="btn btn-primary" onClick={() => setModal('add')}>
                    <Plus size={15} /> Thêm cửa hàng
                </button>
            </div>

            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {loading ? (
                    <div className="spinner-wrap"><div className="spinner" /></div>
                ) : stores.length === 0 ? (
                    <div className="empty-state"><Store size={48} /><p>Chưa có cửa hàng nào</p></div>
                ) : stores.map(store => (
                    <div key={store.id} className="card" style={{ padding: 0 }}>
                        <div className="card-body" style={{ padding: '18px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 42, height: 42, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                                        🏪
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 15 }}>{store.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{store.address || 'Chưa có địa chỉ'}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setModal(store)} title="Sửa">
                                        <Edit2 size={14} />
                                    </button>
                                    <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(store)} title="Xóa">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
                                    <Users size={13} />
                                    <span>{store.user_count || 0} nhân viên</span>
                                </div>
                                {store.phone && (
                                    <div style={{ color: 'var(--text-secondary)' }}>📞 {store.phone}</div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {modal && (
                <StoreModal
                    store={modal === 'add' ? null : modal}
                    onClose={() => setModal(null)}
                    onSave={() => { setModal(null); load(); }}
                />
            )}
        </div>
    );
}
