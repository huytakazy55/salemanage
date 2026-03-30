import { useEffect, useState, useCallback } from 'react';
import { categoriesApi } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, X, Tag } from 'lucide-react';

function CatModal({ cat, onClose, onSaved }) {
    const [form, setForm] = useState({ name: cat?.name || '', description: cat?.description || '' });
    const [saving, setSaving] = useState(false);
    const isEdit = !!cat;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name) return toast.error('Vui lòng nhập tên danh mục');
        setSaving(true);
        try {
            if (isEdit) await categoriesApi.update(cat.id, form);
            else await categoriesApi.create(form);
            toast.success(isEdit ? 'Đã cập nhật!' : 'Đã thêm danh mục!');
            onSaved();
        } catch (err) { toast.error(err.error || 'Có lỗi'); }
        finally { setSaving(false); }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                <div className="modal-header">
                    <span className="modal-title">{isEdit ? '✏️ Sửa danh mục' : '➕ Thêm danh mục'}</span>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Tên danh mục *</label>
                            <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Đèn ngủ LED..." required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Mô tả</label>
                            <textarea className="form-control" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Mô tả danh mục..." />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={onClose}>Hủy</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function Categories() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);

    const load = useCallback(() => {
        categoriesApi.getAll().then(r => setCategories(r.data || [])).finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async (cat) => {
        if (cat.product_count > 0) return toast.error(`Không thể xóa! Danh mục có ${cat.product_count} sản phẩm.`);
        if (!confirm(`Xóa danh mục "${cat.name}"?`)) return;
        try {
            await categoriesApi.delete(cat.id);
            toast.success('Đã xóa');
            load();
        } catch { toast.error('Có lỗi xảy ra'); }
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h2>Quản lý danh mục</h2>
                    <p>{categories.length} danh mục sản phẩm</p>
                </div>
                <button className="btn btn-primary" onClick={() => setModal('add')}><Plus size={14} /> Thêm danh mục</button>
            </div>

            <div className="card">
                {loading ? <div className="spinner-wrap"><div className="spinner" /></div> :
                    categories.length === 0 ? <div className="empty-state"><Tag size={40} /><p>Chưa có danh mục nào</p></div> : (
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>#</th><th>Tên danh mục</th><th>Mô tả</th><th>Số sản phẩm</th><th>Ngày tạo</th><th></th></tr></thead>
                                <tbody>
                                    {categories.map((c, i) => (
                                        <tr key={c.id}>
                                            <td className="text-muted">{i + 1}</td>
                                            <td className="fw-600">{c.name}</td>
                                            <td className="text-muted">{c.description || '—'}</td>
                                            <td><span className="badge badge-primary">{c.product_count} sản phẩm</span></td>
                                            <td className="text-muted fs-12">{new Date(c.created_at).toLocaleDateString('vi-VN')}</td>
                                            <td>
                                                <div className="flex gap-2">
                                                    <button className="btn btn-outline btn-sm btn-icon" onClick={() => setModal(c)}><Edit2 size={13} /></button>
                                                    <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(c)}><Trash2 size={13} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
            </div>
            {modal && <CatModal cat={modal === 'add' ? null : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
        </div>
    );
}
