import { useEffect, useState, useCallback, useRef } from 'react';
import { productsApi, categoriesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Search, Edit2, Trash2, X, Package, Upload, ImageOff, Download, FileSpreadsheet } from 'lucide-react';
import { exportToExcel, parseExcel } from '../utils/exportExcel';
import { CurrencyInput, Req, useFormValidate, FieldError } from '../utils/formUtils';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';
function fmt(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }
function fmtNum(n) { return Number(n || 0).toLocaleString('vi-VN'); }

const EMPTY_FORM = { name: '', sku: '', category_id: '', cost_price: '', sell_price: 0, stock: '', min_stock: 5, unit: 'cái', description: '', commission_pct: 0 };

function ProductImg({ src, size = 40 }) {
    const [err, setErr] = useState(false);
    if (!src || err) return (
        <div style={{ width: size, height: size, borderRadius: 8, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border)' }}>
            <ImageOff size={size * 0.4} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
        </div>
    );
    return <img src={`${API_BASE}${src}`} alt="" style={{ width: size, height: size, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} onError={() => setErr(true)} />;
}

function ProductModal({ product, categories, onClose, onSaved }) {
    const [form, setForm] = useState(product ? { ...product, category_id: product.category_id || '' } : EMPTY_FORM);
    const [imageFile, setImageFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(product?.image_url ? `${API_BASE}${product.image_url}` : null);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef();
    const isEdit = !!product;
    const { errors, validate, clearError } = useFormValidate();

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) return toast.error('Ảnh phải nhỏ hơn 5MB');
        setImageFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const ok = validate({
            name: { value: form.name, message: 'Vui lòng nhập tên sản phẩm' },
            cost_price: { value: form.cost_price !== '' ? form.cost_price : '', message: 'Vui lòng nhập giá vốn' },
        });
        if (!ok) return;
        setSaving(true);
        try {
            const payload = {
                ...form,
                cost_price: +form.cost_price,
                sell_price: 0,
                stock: +form.stock,
                min_stock: +form.min_stock,
                commission_pct: +form.commission_pct || 0,
                category_id: form.category_id || null,
            };
            if (imageFile) payload.image = imageFile;
            if (isEdit) await productsApi.update(product.id, payload);
            else await productsApi.create(payload);
            toast.success(isEdit ? 'Đã cập nhật sản phẩm!' : 'Đã thêm sản phẩm!');
            onSaved();
        } catch (err) {
            toast.error(err.error || 'Có lỗi xảy ra');
        } finally { setSaving(false); }
    };

    return (
        <div className="modal-overlay" onDoubleClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <span className="modal-title">{isEdit ? '✏️ Sửa sản phẩm' : '➕ Thêm sản phẩm mới'}</span>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {/* Image upload */}
                        <div className="form-group">
                            <label className="form-label">Ảnh sản phẩm</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div
                                    onClick={() => fileInputRef.current.click()}
                                    style={{ width: 90, height: 90, borderRadius: 12, border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0, background: 'var(--bg)', transition: 'border-color .2s' }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                                >
                                    {previewUrl
                                        ? <img src={previewUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}><Upload size={22} /><div style={{ fontSize: 10, marginTop: 4 }}>Chọn ảnh</div></div>
                                    }
                                </div>
                                <div>
                                    <button type="button" className="btn btn-outline btn-sm" onClick={() => fileInputRef.current.click()}>
                                        <Upload size={13} /> {previewUrl ? 'Đổi ảnh' : 'Tải ảnh lên'}
                                    </button>
                                    {previewUrl && (
                                        <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 6, color: 'var(--danger)' }}
                                            onClick={() => { setImageFile(null); setPreviewUrl(null); fileInputRef.current.value = ''; }}>
                                            <X size={12} /> Xóa
                                        </button>
                                    )}
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>JPG, PNG, WEBP · Tối đa 5MB</div>
                                </div>
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Tên sản phẩm <Req /></label>
                            <input
                                className={`form-control${errors.name ? ' is-invalid' : ''}`}
                                value={form.name}
                                onChange={e => { set('name', e.target.value); clearError('name'); }}
                                placeholder="Đèn ngủ LED hình tròn..."
                            />
                            <FieldError error={errors.name} />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Mã SKU</label>
                                <input className="form-control" value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="DEN-LED-001" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Đơn vị</label>
                                <select className="form-control" value={form.unit} onChange={e => set('unit', e.target.value)}>
                                    <option>cái</option><option>chiếc</option><option>hộp</option><option>bộ</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Danh mục</label>
                            <select className="form-control" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                                <option value="">-- Không có --</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Giá vốn (đ) <Req /></label>
                            <CurrencyInput
                                className={`form-control input-currency${errors.cost_price ? ' is-invalid' : ''}`}
                                value={form.cost_price}
                                onChange={v => { set('cost_price', v); clearError('cost_price'); }}
                                placeholder="50.000"
                            />
                            <FieldError error={errors.cost_price} />
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>💡 Giá bán sẽ nhập lúc bán hàng để tính lãi chính xác</div>
                        </div>
                        {!isEdit && (
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Tồn kho ban đầu</label>
                                    <input type="number" className="form-control" value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="0" min="0" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Cảnh báo khi còn</label>
                                    <input type="number" className="form-control" value={form.min_stock} onChange={e => set('min_stock', e.target.value)} min="0" />
                                </div>
                            </div>
                        )}
                        {isEdit && (
                            <div className="form-group">
                                <label className="form-label">Cảnh báo khi còn</label>
                                <input type="number" className="form-control" value={form.min_stock} onChange={e => set('min_stock', e.target.value)} min="0" />
                            </div>
                        )}
                        <div className="form-group">
                            <label className="form-label">Mô tả</label>
                            <textarea className="form-control" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Mô tả ngắn..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">% Hoa hồng nhân viên</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input
                                    type="number" className="form-control" style={{ width: 120 }}
                                    value={form.commission_pct} min="0" max="100" step="0.1"
                                    onChange={e => set('commission_pct', e.target.value)}
                                    placeholder="0"
                                />
                                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>% doanh thu bán SP này</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                💡 Nhân viên bán SP này sẽ nhận được {form.commission_pct || 0}% giá trị đơn hàng chứa SP này
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={onClose}>Hủy</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm sản phẩm'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Import Excel modal
function ImportModal({ onClose, onImported }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState([]);
    const [importing, setImporting] = useState(false);
    const fileRef = useRef();

    const handleFile = async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        setFile(f);
        try {
            const rows = await parseExcel(f);
            setPreview(rows.slice(0, 5));
        } catch { toast.error('Không đọc được file Excel'); }
    };

    const downloadTemplate = () => {
        const template = [{ 'Tên sản phẩm': 'Ví dụ SP A', 'SKU': 'SP-001', 'Giá vốn': 50000, 'Tồn kho': 10, 'Tồn tối thiểu': 5, 'Đơn vị': 'cái', 'Hoa hồng %': 5, 'Mô tả': '' }];
        exportToExcel(template, 'mau-import-san-pham', 'Sản phẩm');
    };

    const handleImport = async () => {
        if (!file) return;
        setImporting(true);
        try {
            const rows = await parseExcel(file);
            const res = await productsApi.bulkImport(rows);
            toast.success(res.message || `Đã nhập ${res.created} sản phẩm`);
            if (res.errors?.length) toast.error(`${res.errors.length} lỗi: ${res.errors[0]?.error}`);
            onImported();
        } catch (err) {
            toast.error(err.error || 'Lỗi import');
        } finally { setImporting(false); }
    };

    return (
        <div className="modal-overlay" onDoubleClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
                <div className="modal-header">
                    <span className="modal-title">📥 Import sản phẩm từ Excel</span>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="modal-body">
                    <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 13 }}>
                        <div className="fw-600" style={{ marginBottom: 6 }}>📋 Cấu trúc file Excel:</div>
                        <div className="text-muted" style={{ lineHeight: 1.8 }}>
                            Cột bắt buộc: <strong>Tên sản phẩm</strong><br />
                            Cột tùy chọn: SKU · Giá vốn · Tồn kho · Tồn tối thiểu · Đơn vị · Hoa hồng % · Mô tả
                        </div>
                        <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={downloadTemplate}>
                            <Download size={13} /> Tải file mẫu
                        </button>
                    </div>

                    <div
                        style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '24px 0', textAlign: 'center', cursor: 'pointer', marginBottom: 12 }}
                        onClick={() => fileRef.current.click()}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                        <FileSpreadsheet size={36} style={{ color: 'var(--primary)', marginBottom: 8 }} />
                        <div className="fw-600">{file ? file.name : 'Chọn file Excel (.xlsx, .xls)'}</div>
                        <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>Click để chọn file</div>
                        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
                    </div>

                    {preview.length > 0 && (
                        <div style={{ fontSize: 12 }}>
                            <div className="text-muted" style={{ marginBottom: 6 }}>Xem trước {preview.length} dòng đầu:</div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                                    <thead><tr>{Object.keys(preview[0]).map(k => <th key={k} style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }}>{k}</th>)}</tr></thead>
                                    <tbody>{preview.map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j} style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>{String(v)}</td>)}</tr>)}</tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-outline" onClick={onClose}>Hủy</button>
                    <button className="btn btn-primary" onClick={handleImport} disabled={!file || importing}>
                        {importing ? 'Đang nhập...' : '📥 Nhập sản phẩm'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Products() {
    const { isAdmin } = useAuth();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterCat, setFilterCat] = useState('');
    const [modal, setModal] = useState(null);
    const [showImport, setShowImport] = useState(false);

    const load = useCallback(() => {
        const params = {};
        if (search) params.search = search;
        if (filterCat) params.category_id = filterCat;
        return productsApi.getAll(params).then(r => setProducts(r.data || []));
    }, [search, filterCat]);

    useEffect(() => {
        setLoading(true);
        Promise.all([load(), categoriesApi.getAll().then(r => setCategories(r.data || []))]).finally(() => setLoading(false));
    }, [load]);

    const handleDelete = async (product) => {
        if (!confirm(`Xóa sản phẩm "${product.name}"?`)) return;
        try { await productsApi.delete(product.id); toast.success('Đã xóa sản phẩm'); load(); }
        catch { toast.error('Có lỗi xảy ra'); }
    };

    const exportExcel = () => {
        const rows = products.map(p => ({
            'Tên sản phẩm': p.name,
            'SKU': p.sku || '',
            'Danh mục': p.category_name || '',
            'Giá vốn (đ)': +p.cost_price,
            'Tồn kho': +p.stock,
            'Đơn vị': p.unit,
            'Hoa hồng %': +p.commission_pct,
            'Mô tả': p.description || '',
        }));
        exportToExcel(rows, 'danh-sach-san-pham', 'Sản phẩm');
    };

    const stockClass = (p) => p.stock === 0 ? 'stock-out' : p.stock <= p.min_stock ? 'stock-low' : 'stock-ok';
    const stockBadge = (p) => p.stock === 0 ? <span className="badge badge-danger">Hết hàng</span> : p.stock <= p.min_stock ? <span className="badge badge-warning">Sắp hết</span> : <span className="badge badge-success">Còn hàng</span>;

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h2>Quản lý sản phẩm</h2>
                    <p>{products.length} sản phẩm {search || filterCat ? '(đã lọc)' : 'trong kho'}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline btn-sm" onClick={exportExcel} disabled={products.length === 0}>
                        <Download size={14} /> Xuất Excel
                    </button>
                    {isAdmin() && (
                        <button className="btn btn-outline btn-sm" onClick={() => setShowImport(true)}>
                            <FileSpreadsheet size={14} /> Import Excel
                        </button>
                    )}
                    {isAdmin() && <button className="btn btn-primary" onClick={() => setModal('add')}><Plus size={15} /> Thêm sản phẩm</button>}
                </div>
            </div>

            <div className="filter-bar">
                <div className="search-input-wrap">
                    <Search size={15} />
                    <input className="form-control search-input" placeholder="Tìm kiếm theo tên, SKU..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="form-control" style={{ width: 200 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                    <option value="">Tất cả danh mục</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            <div className="card">
                {loading ? (
                    <div className="spinner-wrap"><div className="spinner" /></div>
                ) : products.length === 0 ? (
                    <div className="empty-state"><Package size={48} /><p>Chưa có sản phẩm nào</p></div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Sản phẩm</th>
                                    <th>Danh mục</th>
                                    <th>Giá vốn</th>
                                    <th>Tồn kho</th>
                                    <th>Tình trạng</th>
                                    {isAdmin() && <th>HH%</th>}
                                    {isAdmin() && <th></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {products.map(p => (
                                    <tr key={p.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <ProductImg src={p.image_url} size={42} />
                                                <div>
                                                    <div className="fw-600">{p.name}</div>
                                                    {p.sku && <div className="fs-12 text-muted">{p.sku}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td>{p.category_name ? <span className="badge badge-primary">{p.category_name}</span> : <span className="text-muted">—</span>}</td>
                                        <td>{fmt(p.cost_price)}</td>
                                        <td className={stockClass(p)}>{fmtNum(p.stock)} {p.unit}</td>
                                        <td>{stockBadge(p)}</td>
                                        {isAdmin() && (
                                            <td>
                                                {+p.commission_pct > 0
                                                    ? <span className="badge badge-primary">{p.commission_pct}%</span>
                                                    : <span className="text-muted">—</span>}
                                            </td>
                                        )}
                                        {isAdmin() && (
                                            <td>
                                                <div className="flex gap-2">
                                                    <button className="btn btn-outline btn-sm btn-icon" onClick={() => setModal(p)} title="Sửa"><Edit2 size={13} /></button>
                                                    <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(p)} title="Xóa"><Trash2 size={13} /></button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {modal && (
                <ProductModal
                    product={modal === 'add' ? null : modal}
                    categories={categories}
                    onClose={() => setModal(null)}
                    onSaved={() => { setModal(null); load(); }}
                />
            )}
            {showImport && (
                <ImportModal
                    onClose={() => setShowImport(false)}
                    onImported={() => { setShowImport(false); load(); }}
                />
            )}
        </div>
    );
}
