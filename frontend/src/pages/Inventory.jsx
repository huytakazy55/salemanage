import { useEffect, useState, useCallback } from 'react';
import { productsApi, inventoryApi } from '../services/api';
import toast from 'react-hot-toast';
import { PackagePlus, RefreshCw, AlertTriangle, X, Warehouse } from 'lucide-react';

function fmt(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }

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
            toast.success('Nhập kho thành công!');
            onSaved();
        } catch (err) { toast.error(err.error || 'Có lỗi xảy ra'); }
        finally { setSaving(false); }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <span className="modal-title">📦 Nhập hàng vào kho</span>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Sản phẩm *</label>
                            <select className="form-control" value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value, cost_price: products.find(p => p.id === +e.target.value)?.cost_price || '' }))} required>
                                <option value="">-- Chọn sản phẩm --</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name} (còn {p.stock} {p.unit})</option>)}
                            </select>
                        </div>
                        {selected && (
                            <div style={{ padding: '8px 12px', background: 'var(--primary-light)', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                                Tồn hiện tại: <strong>{selected.stock} {selected.unit}</strong> | Giá vốn hiện tại: <strong>{fmt(selected.cost_price)}</strong>
                            </div>
                        )}
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Số lượng nhập *</label>
                                <input type="number" className="form-control" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} min="1" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Giá nhập mới (nếu đổi)</label>
                                <input type="number" className="form-control" value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} placeholder={selected?.cost_price || '0'} min="0" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Ghi chú</label>
                            <input className="form-control" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Nhập từ NCC XYZ..." />
                        </div>
                        {form.quantity && selected && (
                            <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
                                Sau nhập: {+selected.stock + +form.quantity} {selected.unit}
                            </div>
                        )}
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

export default function Inventory() {
    const [products, setProducts] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showImport, setShowImport] = useState(false);
    const [tab, setTab] = useState('stock'); // 'stock' | 'logs'
    const [filterLow, setFilterLow] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [pr, lg] = await Promise.all([
                productsApi.getAll(),
                inventoryApi.getLogs(),
            ]);
            setProducts(pr.data || []);
            setLogs(lg.data || []);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const displayed = filterLow ? products.filter(p => p.stock <= p.min_stock) : products;
    const logTypes = { import: { label: 'Nhập kho', cls: 'badge-success' }, export: { label: 'Xuất hàng', cls: 'badge-danger' }, adjust: { label: 'Điều chỉnh', cls: 'badge-warning' } };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h2>Quản lý kho hàng</h2>
                    <p>{products.filter(p => p.stock <= p.min_stock).length} sản phẩm cần nhập thêm</p>
                </div>
                <div className="flex gap-2">
                    <button className="btn btn-outline" onClick={load}><RefreshCw size={14} /> Làm mới</button>
                    <button className="btn btn-success" onClick={() => setShowImport(true)}><PackagePlus size={14} /> Nhập hàng</button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4" style={{ marginBottom: 16 }}>
                <button className={`btn ${tab === 'stock' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('stock')}><Warehouse size={14} /> Tồn kho</button>
                <button className={`btn ${tab === 'logs' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('logs')}>📋 Lịch sử nhập xuất</button>
            </div>

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
                                    <thead><tr><th>Sản phẩm</th><th>SKU</th><th>Tồn kho</th><th>Tối thiểu</th><th>Giá vốn</th><th>Giá bán</th><th>Giá trị tồn</th><th>Tình trạng</th></tr></thead>
                                    <tbody>
                                        {displayed.map(p => (
                                            <tr key={p.id} style={p.stock === 0 ? { background: '#fff7f7' } : p.stock <= p.min_stock ? { background: '#fffbeb' } : {}}>
                                                <td className="fw-600">{p.name}</td>
                                                <td><span className="badge badge-gray">{p.sku || '—'}</span></td>
                                                <td className={p.stock === 0 ? 'stock-out' : p.stock <= p.min_stock ? 'stock-low' : 'stock-ok'}>{p.stock.toLocaleString('vi-VN')} {p.unit}</td>
                                                <td className="text-muted">{p.min_stock} {p.unit}</td>
                                                <td>{fmt(p.cost_price)}</td>
                                                <td>{fmt(p.sell_price)}</td>
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

            {tab === 'logs' && (
                <div className="card">
                    {loading ? <div className="spinner-wrap"><div className="spinner" /></div> : (
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>Thời gian</th><th>Sản phẩm</th><th>Loại</th><th>Số lượng</th><th>Giá nhập</th><th>Ghi chú</th></tr></thead>
                                <tbody>
                                    {logs.map(l => (
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
            )}

            {showImport && <ImportModal products={products} onClose={() => setShowImport(false)} onSaved={() => { setShowImport(false); load(); }} />}
        </div>
    );
}
