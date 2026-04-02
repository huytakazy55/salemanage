import { useEffect, useState, useCallback, useRef } from 'react';
import { productsApi, inventoryApi, transfersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { PackagePlus, RefreshCw, AlertTriangle, X, Warehouse, ArrowLeftRight, Download, FileSpreadsheet } from 'lucide-react';
import { exportToExcel, parseExcel } from '../utils/exportExcel';

function fmt(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 7) + '-01';

// ─── Import Hàng Modal ───────────────────────────────────────────
function ImportModal({ products, onClose, onSaved }) {
    const [form, setForm] = useState({ product_id: '', quantity: '', cost_price: '', note: '' });
    const [saving, setSaving] = useState(false);
    const selected = products.find(p => p.id === +form.product_id);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.product_id || !form.quantity) return toast.error('Vui lòng chọn sản phẩm và số lượng');
        setSaving(true);
        try {
            await inventoryApi.import({ product_id: +form.product_id, quantity: +form.quantity, cost_price: form.cost_price ? +form.cost_price : undefined, note: form.note });
            toast.success('Nhập kho thành công!'); onSaved();
        } catch (err) { toast.error(err.error || 'Có lỗi xảy ra'); }
        finally { setSaving(false); }
    };
    return (
        <div className="modal-overlay" onDoubleClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header"><span className="modal-title">📦 Nhập hàng vào kho</span><button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button></div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Sản phẩm <span className="req-star">*</span></label>
                            <select className="form-control" value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value, cost_price: products.find(p => p.id === +e.target.value)?.cost_price || '' }))} required>
                                <option value="">-- Chọn sản phẩm --</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name} (còn {p.stock} {p.unit})</option>)}
                            </select>
                        </div>
                        {selected && <div style={{ padding: '8px 12px', background: 'var(--primary-light)', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>Tồn hiện tại: <strong>{selected.stock} {selected.unit}</strong> | Giá vốn: <strong>{fmt(selected.cost_price)}</strong></div>}
                        <div className="form-row">
                            <div className="form-group"><label className="form-label">Số lượng <span className="req-star">*</span></label><input type="number" className="form-control" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} min="1" required /></div>
                            <div className="form-group"><label className="form-label">Giá nhập mới</label><input type="number" className="form-control" value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} placeholder={selected?.cost_price || '0'} min="0" /></div>
                        </div>
                        <div className="form-group"><label className="form-label">Ghi chú</label><input className="form-control" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Nhập từ NCC XYZ..." /></div>
                        {form.quantity && selected && <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>Sau nhập: {+selected.stock + +form.quantity} {selected.unit}</div>}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={onClose}>Hủy</button>
                        <button type="submit" className="btn btn-success" disabled={saving}>{saving ? 'Đang lưu...' : 'Xác nhận nhập kho'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Import Excel Kho Modal ───────────────────────────────────────
function BulkImportModal({ onClose, onSaved }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState([]);
    const [importing, setImporting] = useState(false);
    const fileRef = useRef();

    const handleFile = async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        setFile(f);
        try { const rows = await parseExcel(f); setPreview(rows.slice(0, 5)); }
        catch { toast.error('Không đọc được file Excel'); }
    };

    const downloadTemplate = () => {
        exportToExcel([
            { 'SKU': 'SP-001', 'Tên sản phẩm': 'Ví dụ SP A', 'Số lượng': 10, 'Giá nhập': 50000, 'Ghi chú': 'Nhập từ NCC' },
        ], 'mau-nhap-kho', 'Nhập kho');
    };

    const handleImport = async () => {
        if (!file) return;
        setImporting(true);
        try {
            const rows = await parseExcel(file);
            const res = await inventoryApi.bulkImport(rows);
            toast.success(res.message || `Đã nhập ${res.success_count} dòng`);
            if (res.errors?.length) toast.error(`${res.errors.length} lỗi: ${res.errors[0]?.error}`);
            onSaved();
        } catch (err) { toast.error(err.error || 'Lỗi import'); }
        finally { setImporting(false); }
    };

    return (
        <div className="modal-overlay" onDoubleClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
                <div className="modal-header"><span className="modal-title">📥 Import nhập kho từ Excel</span><button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button></div>
                <div className="modal-body">
                    <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 13 }}>
                        <div className="fw-600" style={{ marginBottom: 6 }}>📋 Cấu trúc file Excel:</div>
                        <div className="text-muted" style={{ lineHeight: 1.8 }}>
                            Cột bắt buộc: <strong>Số lượng</strong> + (<strong>SKU</strong> hoặc <strong>Tên sản phẩm</strong>)<br />
                            Cột tùy chọn: Giá nhập · Ghi chú
                        </div>
                        <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={downloadTemplate}><Download size={13} /> Tải file mẫu</button>
                    </div>
                    <div style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '24px 0', textAlign: 'center', cursor: 'pointer', marginBottom: 12 }}
                        onClick={() => fileRef.current.click()}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
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
                    <button className="btn btn-primary" onClick={handleImport} disabled={!file || importing}>{importing ? 'Đang nhập...' : '📥 Nhập kho'}</button>
                </div>
            </div>
        </div>
    );
}

// ─── Transfer Modal ───────────────────────────────────────────────
function TransferModal({ products, onClose, onSaved }) {
    const [form, setForm] = useState({ product_id: '', to_store_id: '', quantity: '', note: '' });
    const [stores, setStores] = useState([]);
    const [saving, setSaving] = useState(false);
    const selected = products.find(p => p.id === +form.product_id);
    useEffect(() => { transfersApi.getStores().then(r => setStores(r.data || [])).catch(() => toast.error('Không thể tải danh sách cửa hàng')); }, []);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.product_id || !form.to_store_id || !form.quantity) return toast.error('Vui lòng điền đầy đủ thông tin');
        if (+form.quantity > (selected?.stock || 0)) return toast.error(`Số lượng chuyển vượt quá tồn kho (${selected?.stock})`);
        setSaving(true);
        try { const res = await transfersApi.transfer({ product_id: +form.product_id, to_store_id: +form.to_store_id, quantity: +form.quantity, note: form.note }); toast.success(res.message || 'Chuyển hàng thành công!'); onSaved(); }
        catch (err) { toast.error(err.error || 'Có lỗi xảy ra'); } finally { setSaving(false); }
    };
    const afterQty = selected && form.quantity ? selected.stock - +form.quantity : null;
    return (
        <div className="modal-overlay" onDoubleClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header"><span className="modal-title">🔄 Chuyển hàng sang cửa hàng khác</span><button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button></div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group"><label className="form-label">Sản phẩm <span className="req-star">*</span></label>
                            <select className="form-control" value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value, quantity: '' }))} required>
                                <option value="">-- Chọn sản phẩm --</option>
                                {products.map(p => <option key={p.id} value={p.id} disabled={p.stock === 0}>{p.name} (tồn: {p.stock} {p.unit}){p.stock === 0 ? ' — Hết hàng' : ''}</option>)}
                            </select>
                        </div>
                        {selected && <div style={{ padding: '8px 12px', background: 'var(--primary-light)', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>Tồn kho: <strong>{selected.stock} {selected.unit}</strong>{selected.sku && <> · SKU: <strong>{selected.sku}</strong></>}</div>}
                        <div className="form-row">
                            <div className="form-group"><label className="form-label">Số lượng <span className="req-star">*</span></label><input type="number" className="form-control" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} min="1" max={selected?.stock} required /></div>
                            <div className="form-group"><label className="form-label">Chuyển đến <span className="req-star">*</span></label>
                                <select className="form-control" value={form.to_store_id} onChange={e => setForm(f => ({ ...f, to_store_id: e.target.value }))} required>
                                    <option value="">-- Chọn cửa hàng --</option>
                                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-group"><label className="form-label">Ghi chú</label><input className="form-control" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Lý do chuyển..." /></div>
                        {afterQty !== null && <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: afterQty < 0 ? '#fff7f7' : '#f0fdf4', color: afterQty < 0 ? 'var(--danger)' : 'var(--success)' }}>{afterQty < 0 ? `⚠️ Không đủ hàng!` : `Tồn kho sau chuyển: ${afterQty} ${selected.unit}`}</div>}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={onClose}>Hủy</button>
                        <button type="submit" className="btn btn-primary" disabled={saving || (afterQty !== null && afterQty < 0)}>{saving ? 'Đang chuyển...' : '✈️ Xác nhận'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────
export default function Inventory() {
    const { isAdmin } = useAuth();
    const [products, setProducts] = useState([]);
    const [logs, setLogs] = useState([]);
    const [transferLogs, setTransferLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showImport, setShowImport] = useState(false);
    const [showBulkImport, setShowBulkImport] = useState(false);
    const [showTransfer, setShowTransfer] = useState(false);
    const [tab, setTab] = useState('stock');
    const [filterLow, setFilterLow] = useState(false);
    const [from, setFrom] = useState(monthStart());
    const [to, setTo] = useState(today());
    const [logTypeFilter, setLogTypeFilter] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = tab === 'logs' ? { from, to, ...(logTypeFilter ? { type: logTypeFilter } : {}) } : {};
            const [pr, lg, tr] = await Promise.allSettled([
                productsApi.getAll(),
                inventoryApi.getLogs(params),
                transfersApi.getLogs(),
            ]);
            setProducts(pr.status === 'fulfilled' ? (pr.value.data || []) : []);
            setLogs(lg.status === 'fulfilled' ? (lg.value.data || []) : []);
            setTransferLogs(tr.status === 'fulfilled' ? (tr.value.data || []) : []);
        } finally { setLoading(false); }
    }, [tab, from, to, logTypeFilter]);

    useEffect(() => { load(); }, [load]);

    const displayed = filterLow ? products.filter(p => p.stock <= p.min_stock) : products;

    const logTypes = {
        import: { label: 'Nhập kho', cls: 'badge-success' },
        export: { label: 'Xuất hàng', cls: 'badge-danger' },
        adjust: { label: 'Điều chỉnh', cls: 'badge-warning' },
    };

    const exportStock = () => {
        const rows = displayed.map(p => ({
            'Tên sản phẩm': p.name,
            'SKU': p.sku || '',
            'Tồn kho': p.stock,
            'Đơn vị': p.unit,
            'Tối thiểu': p.min_stock,
            'Giá vốn (đ)': +p.cost_price,
            'Giá trị tồn (đ)': Math.round(p.stock * p.cost_price),
            'Tình trạng': p.stock === 0 ? 'Hết hàng' : p.stock <= p.min_stock ? 'Sắp hết' : 'Còn hàng',
        }));
        exportToExcel(rows, `ton-kho-${today()}`, 'Tồn kho');
    };

    const exportLogs = () => {
        const rows = logs.map(l => ({
            'Thời gian': new Date(l.created_at).toLocaleString('vi-VN'),
            'Sản phẩm': l.product_name,
            'SKU': l.sku || '',
            'Loại': logTypes[l.type]?.label || l.type,
            'Số lượng': l.type === 'export' ? -Math.abs(l.quantity) : +l.quantity,
            'Giá nhập (đ)': l.cost_price ? +l.cost_price : '',
            'Ghi chú': l.note || '',
        }));
        exportToExcel(rows, `lich-su-kho-${from}-${to}`, 'Lịch sử');
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h2>Quản lý kho hàng</h2>
                    <p>{products.filter(p => p.stock <= p.min_stock).length} sản phẩm cần nhập thêm</p>
                </div>
                <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                    {(tab === 'stock') && (
                        <button className="btn btn-outline btn-sm" onClick={exportStock} disabled={displayed.length === 0}>
                            <Download size={14} /> Xuất Excel
                        </button>
                    )}
                    {(tab === 'logs') && (
                        <button className="btn btn-outline btn-sm" onClick={exportLogs} disabled={logs.length === 0}>
                            <Download size={14} /> Xuất Excel
                        </button>
                    )}
                    {isAdmin() && (
                        <button className="btn btn-outline btn-sm" onClick={() => setShowBulkImport(true)}>
                            <FileSpreadsheet size={14} /> Import Excel
                        </button>
                    )}
                    <button className="btn btn-outline btn-sm" onClick={load}><RefreshCw size={14} /> Làm mới</button>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowTransfer(true)} style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none' }}>
                        <ArrowLeftRight size={14} /> Chuyển hàng
                    </button>
                    {isAdmin() && <button className="btn btn-success btn-sm" onClick={() => setShowImport(true)}><PackagePlus size={14} /> Nhập hàng</button>}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2" style={{ marginBottom: 16 }}>
                <button className={`btn ${tab === 'stock' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('stock')}><Warehouse size={14} /> Tồn kho</button>
                <button className={`btn ${tab === 'logs' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('logs')}>📋 Lịch sử nhập xuất</button>
                <button className={`btn ${tab === 'transfers' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('transfers')}><ArrowLeftRight size={14} /> Chuyển hàng</button>
            </div>

            {/* Tồn kho */}
            {tab === 'stock' && (
                <>
                    <div className="filter-bar">
                        <label className="flex-center gap-2" style={{ fontSize: 13, cursor: 'pointer' }}>
                            <input type="checkbox" checked={filterLow} onChange={e => setFilterLow(e.target.checked)} />
                            <AlertTriangle size={13} color="var(--warning)" /> Chỉ hiện hàng sắp hết / hết hàng
                        </label>
                        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>Hiển thị {displayed.length}/{products.length} sản phẩm</span>
                    </div>
                    <div className="card">
                        {loading ? <div className="spinner-wrap"><div className="spinner" /></div> : (
                            <div className="table-wrap">
                                <table>
                                    <thead><tr><th>Sản phẩm</th><th>SKU</th><th>Tồn kho</th><th>Tối thiểu</th><th>Giá vốn</th><th>Giá trị tồn</th><th>Tình trạng</th></tr></thead>
                                    <tbody>
                                        {displayed.map(p => (
                                            <tr key={p.id} style={p.stock === 0 ? { background: '#fff7f7' } : p.stock <= p.min_stock ? { background: '#fffbeb' } : {}}>
                                                <td className="fw-600">{p.name}</td>
                                                <td><span className="badge badge-gray">{p.sku || '—'}</span></td>
                                                <td className={p.stock === 0 ? 'stock-out' : p.stock <= p.min_stock ? 'stock-low' : 'stock-ok'}>{p.stock.toLocaleString('vi-VN')} {p.unit}</td>
                                                <td className="text-muted">{p.min_stock} {p.unit}</td>
                                                <td>{fmt(p.cost_price)}</td>
                                                <td className="fw-600">{fmt(p.stock * p.cost_price)}</td>
                                                <td>{p.stock === 0 ? <span className="badge badge-danger">Hết hàng</span> : p.stock <= p.min_stock ? <span className="badge badge-warning">Sắp hết</span> : <span className="badge badge-success">Còn hàng</span>}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Lịch sử nhập xuất */}
            {tab === 'logs' && (
                <>
                    <div className="filter-bar">
                        <div className="flex-center gap-2"><span style={{ fontSize: 13 }}>Từ:</span><input type="date" className="form-control" style={{ width: 155 }} value={from} onChange={e => setFrom(e.target.value)} /></div>
                        <div className="flex-center gap-2"><span style={{ fontSize: 13 }}>Đến:</span><input type="date" className="form-control" style={{ width: 155 }} value={to} onChange={e => setTo(e.target.value)} /></div>
                        <select className="form-control" style={{ width: 150 }} value={logTypeFilter} onChange={e => setLogTypeFilter(e.target.value)}>
                            <option value="">Tất cả loại</option>
                            <option value="import">Nhập kho</option>
                            <option value="export">Xuất hàng</option>
                            <option value="adjust">Điều chỉnh</option>
                        </select>
                        <button className="btn btn-outline btn-sm" onClick={load}>Lọc</button>
                        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>{logs.length} bản ghi</span>
                    </div>
                    <div className="card">
                        {loading ? <div className="spinner-wrap"><div className="spinner" /></div> : (
                            <div className="table-wrap">
                                <table>
                                    <thead><tr><th>Thời gian</th><th>Sản phẩm</th><th>Loại</th><th>Số lượng</th><th>Giá nhập</th><th>Ghi chú</th></tr></thead>
                                    <tbody>
                                        {logs.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Không có dữ liệu</td></tr>
                                            : logs.map(l => (
                                                <tr key={l.id}>
                                                    <td className="text-muted fs-12">{new Date(l.created_at).toLocaleString('vi-VN')}</td>
                                                    <td className="fw-600">{l.product_name}</td>
                                                    <td><span className={`badge ${logTypes[l.type]?.cls}`}>{logTypes[l.type]?.label}</span></td>
                                                    <td className={l.type === 'export' ? 'text-danger fw-600' : 'text-success fw-600'}>{l.type === 'export' ? '-' : '+'}{Math.abs(l.quantity)}</td>
                                                    <td>{l.cost_price ? fmt(l.cost_price) : '—'}</td>
                                                    <td className="text-muted">{l.note || '—'}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Lịch sử chuyển hàng */}
            {tab === 'transfers' && (
                <div className="card">
                    {loading ? <div className="spinner-wrap"><div className="spinner" /></div> : (
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>Thời gian</th><th>Sản phẩm</th><th>Loại</th><th>Số lượng</th><th>Cửa hàng liên quan</th><th>Người thực hiện</th><th>Ghi chú</th></tr></thead>
                                <tbody>
                                    {transferLogs.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Chưa có lịch sử chuyển hàng</td></tr>
                                        : transferLogs.map(l => (
                                            <tr key={l.id}>
                                                <td className="text-muted fs-12">{new Date(l.created_at).toLocaleString('vi-VN')}</td>
                                                <td className="fw-600">{l.product_name} {l.sku ? <span className="badge badge-gray">{l.sku}</span> : null}</td>
                                                <td>{l.type === 'transfer_out' ? <span className="badge" style={{ background: '#fef3c7', color: '#d97706' }}>📤 Xuất chuyển</span> : <span className="badge" style={{ background: '#ede9fe', color: '#7c3aed' }}>📥 Nhận hàng</span>}</td>
                                                <td className={l.type === 'transfer_out' ? 'text-danger fw-600' : 'fw-600'} style={l.type === 'transfer_in' ? { color: '#7c3aed' } : {}}>{l.type === 'transfer_out' ? '-' : '+'}{Math.abs(l.quantity)} {l.unit}</td>
                                                <td className="text-muted">{l.related_store_name || '—'}</td>
                                                <td className="text-muted">{l.performed_by_name || '—'}</td>
                                                <td className="text-muted">{l.note || '—'}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {showImport && <ImportModal products={products} onClose={() => setShowImport(false)} onSaved={() => { setShowImport(false); load(); }} />}
            {showBulkImport && <BulkImportModal onClose={() => setShowBulkImport(false)} onSaved={() => { setShowBulkImport(false); load(); }} />}
            {showTransfer && <TransferModal products={products} onClose={() => setShowTransfer(false)} onSaved={() => { setShowTransfer(false); load(); }} />}
        </div>
    );
}
