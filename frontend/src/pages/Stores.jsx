import { useEffect, useState } from 'react';
import { storesApi, branchesApi } from '../services/api';
import toast from 'react-hot-toast';
import { Store, Plus, Edit2, Trash2, Users, GitBranch, X } from 'lucide-react';

// ── Branch Modal ───────────────────────────────────────────────────────────
function BranchModal({ branch, onClose, onSave }) {
    const [name, setName] = useState(branch?.name || '');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return toast.error('Tên chi nhánh là bắt buộc');
        setSaving(true);
        try {
            if (branch) {
                await branchesApi.update(branch.id, { name });
                toast.success('Đã cập nhật chi nhánh');
            } else {
                await branchesApi.create({ name });
                toast.success('Đã thêm chi nhánh');
            }
            onSave();
        } catch (err) { toast.error(err.error || 'Có lỗi xảy ra'); }
        finally { setSaving(false); }
    };

    return (
        <div className="modal-overlay" onDoubleClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                <div className="modal-header">
                    <span className="modal-title">{branch ? '✏️ Sửa chi nhánh' : '🏢 Thêm chi nhánh'}</span>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Tên chi nhánh <span className="req-star">*</span></label>
                            <input className="form-control" value={name} onChange={e => setName(e.target.value)} placeholder="VD: Chi nhánh Hà Nội" autoFocus />
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

// ── Store Modal ────────────────────────────────────────────────────────────
function StoreModal({ store, branches, onClose, onSave }) {
    const [form, setForm] = useState({
        name: store?.name || '',
        address: store?.address || '',
        phone: store?.phone || '',
        branch_id: store?.branch_id || '',
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name) return toast.error('Tên cửa hàng là bắt buộc');
        setSaving(true);
        try {
            const payload = { ...form, branch_id: form.branch_id || null };
            if (store) {
                await storesApi.update(store.id, payload);
                toast.success('Đã cập nhật cửa hàng');
            } else {
                await storesApi.create(payload);
                toast.success('Đã thêm cửa hàng');
            }
            onSave();
        } catch (err) { toast.error(err.error || 'Có lỗi xảy ra'); }
        finally { setSaving(false); }
    };

    return (
        <div className="modal-overlay" onDoubleClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
                <div className="modal-header">
                    <span className="modal-title">{store ? '✏️ Sửa cửa hàng' : '🏪 Thêm cửa hàng'}</span>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Tên cửa hàng <span className="req-star">*</span></label>
                            <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: SaleManage Chi nhánh 1" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Chi nhánh</label>
                            <select className="form-control" value={form.branch_id} onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}>
                                <option value="">-- Chưa thuộc chi nhánh nào --</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                Chỉ các cửa hàng cùng chi nhánh mới được chuyển hàng cho nhau
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Địa chỉ</label>
                                <input className="form-control" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Địa chỉ cửa hàng" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Số điện thoại</label>
                                <input className="form-control" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0901234567" />
                            </div>
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

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Stores() {
    const [stores, setStores] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [storeModal, setStoreModal] = useState(null);
    const [branchModal, setBranchModal] = useState(null); // null | 'add' | branch object

    const load = () => {
        setLoading(true);
        Promise.allSettled([
            storesApi.getAll(),
            branchesApi.getAll(),
        ]).then(([sr, br]) => {
            setStores(sr.status === 'fulfilled' ? (sr.value.data || []) : []);
            setBranches(br.status === 'fulfilled' ? (br.value.data || []) : []);
        }).finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const handleDeleteStore = async (store) => {
        if (!confirm(`Xóa cửa hàng "${store.name}"?`)) return;
        try { await storesApi.delete(store.id); toast.success('Đã xóa cửa hàng'); load(); }
        catch (err) { toast.error(err.error || 'Có lỗi xảy ra'); }
    };

    const handleDeleteBranch = async (branch) => {
        if (!confirm(`Xóa chi nhánh "${branch.name}"?`)) return;
        try { await branchesApi.delete(branch.id); toast.success('Đã xóa chi nhánh'); load(); }
        catch (err) { toast.error(err.error || 'Không thể xóa — còn cửa hàng trong chi nhánh này'); }
    };

    // Group stores by branch
    const unassigned = stores.filter(s => !s.branch_id);
    const byBranch = branches.map(b => ({
        branch: b,
        stores: stores.filter(s => s.branch_id === b.id),
    }));

    return (
        <div>
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="page-header">
                <div className="page-header-left">
                    <h2>Quản lý cửa hàng</h2>
                    <p>{stores.length} cửa hàng · {branches.length} chi nhánh</p>
                </div>
                <div className="flex gap-2">
                    <button className="btn btn-outline" onClick={() => setBranchModal('add')}>
                        <GitBranch size={14} /> Thêm chi nhánh
                    </button>
                    <button className="btn btn-primary" onClick={() => setStoreModal('add')}>
                        <Plus size={14} /> Thêm cửa hàng
                    </button>
                </div>
            </div>

            {loading ? <div className="spinner-wrap"><div className="spinner" /></div> : (
                <>
                    {/* ── Branches section ───────────────────────────────── */}
                    {branches.length > 0 && (
                        <div style={{ marginBottom: 28 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <GitBranch size={13} /> Chi nhánh
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                {branches.map(b => (
                                    <div key={b.id} style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '8px 14px', borderRadius: 10,
                                        background: 'var(--surface)', border: '1px solid var(--border)',
                                        fontSize: 13,
                                    }}>
                                        <GitBranch size={14} color="#6366f1" />
                                        <span style={{ fontWeight: 600 }}>{b.name}</span>
                                        <span style={{ color: 'var(--text-muted)' }}>{b.store_count || 0} CH</span>
                                        <button className="btn btn-ghost btn-icon" style={{ width: 24, height: 24, padding: 0 }} onClick={() => setBranchModal(b)} title="Sửa"><Edit2 size={12} /></button>
                                        <button className="btn btn-ghost btn-icon" style={{ width: 24, height: 24, padding: 0, color: 'var(--danger)' }} onClick={() => handleDeleteBranch(b)} title="Xóa"><Trash2 size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Stores grouped by branch ───────────────────────── */}
                    {byBranch.map(({ branch, stores: bStores }) => (
                        <div key={branch.id} style={{ marginBottom: 24 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <GitBranch size={12} /> {branch.name}
                                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({bStores.length} cửa hàng)</span>
                            </div>
                            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                                {bStores.length === 0 ? (
                                    <div style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>Chưa có cửa hàng nào trong chi nhánh này</div>
                                ) : bStores.map(store => <StoreCard key={store.id} store={store} onEdit={() => setStoreModal(store)} onDelete={() => handleDeleteStore(store)} />)}
                            </div>
                        </div>
                    ))}

                    {/* ── Unassigned stores ──────────────────────────────── */}
                    {unassigned.length > 0 && (
                        <div style={{ marginBottom: 24 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                                ⚠️ Chưa phân chi nhánh ({unassigned.length})
                            </div>
                            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                                {unassigned.map(store => <StoreCard key={store.id} store={store} onEdit={() => setStoreModal(store)} onDelete={() => handleDeleteStore(store)} nosBranch />)}
                            </div>
                        </div>
                    )}

                    {stores.length === 0 && branches.length === 0 && (
                        <div className="empty-state"><Store size={48} /><p>Chưa có cửa hàng nào</p></div>
                    )}
                </>
            )}

            {/* ── Modals ─────────────────────────────────────────────────── */}
            {storeModal && (
                <StoreModal
                    store={storeModal === 'add' ? null : storeModal}
                    branches={branches}
                    onClose={() => setStoreModal(null)}
                    onSave={() => { setStoreModal(null); load(); }}
                />
            )}
            {branchModal && (
                <BranchModal
                    branch={branchModal === 'add' ? null : branchModal}
                    onClose={() => setBranchModal(null)}
                    onSave={() => { setBranchModal(null); load(); }}
                />
            )}
        </div>
    );
}

// ── Store Card ─────────────────────────────────────────────────────────────
function StoreCard({ store, onEdit, onDelete, nosBranch }) {
    return (
        <div className="card" style={{ padding: 0, borderLeft: nosBranch ? '3px solid var(--warning)' : undefined }}>
            <div className="card-body" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🏪</div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{store.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{store.address || 'Chưa có địa chỉ'}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={onEdit} title="Sửa"><Edit2 size={14} /></button>
                        <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={onDelete} title="Xóa"><Trash2 size={14} /></button>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
                        <Users size={13} /><span>{store.user_count || 0} nhân viên</span>
                    </div>
                    {store.phone && <div style={{ color: 'var(--text-secondary)' }}>📞 {store.phone}</div>}
                    {nosBranch && <span className="badge badge-warning" style={{ marginLeft: 'auto' }}>Chưa có chi nhánh</span>}
                </div>
            </div>
        </div>
    );
}
