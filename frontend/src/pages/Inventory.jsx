import { useEffect, useState, useCallback } from 'react';
import { productsApi, inventoryApi, transfersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { PackagePlus, RefreshCw, AlertTriangle, X, Warehouse, ArrowLeftRight } from 'lucide-react';

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

function TransferModal({ products, onClose, onSaved }) {
    const [form, setForm] = useState({ product_id: '', to_store_id: '', quantity: '', note: '' });
    const [stores, setStores] = useState([]);
    const [saving, setSaving] = useState(false);
    const selected = products.find(p => p.id === +form.product_id);

    useEffect(() => {
        transfersApi.getStores()
            .then(r => setStores(r.data || []))
            .catch(() => toast.error('Không thể tải danh sách cửa hàng'));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.product_id || !form.to_store_id || !form.quantity) {
            return toast.error('Vui lòng điền đầy đủ thông tin');
        }
        if (+form.quantity > (selected?.stock || 0)) {
            return toast.error(`Số lượng chuyển (${form.quantity}) vượt quá tồn kho (${selected?.stock})`);
        }
        setSaving(true);
        try {
            const res = await transfersApi.transfer({
                product_id: +form.product_id,
                to_store_id: +form.to_store_id,
                quantity: +form.quantity,
                note: form.note,
            });
            toast.success(res.message || 'Chuyển hàng thành công!');
            onSaved();
        } catch (err) {
            toast.error(err.error || 'Có lỗi xảy ra khi chuyển hàng');
        } finally {
            setSaving(false);
        }
    };

    const afterQty = selected && form.quantity ? selected.stock - +form.quantity : null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <span className="modal-title">🔄 Chuyển hàng sang cửa hàng khác</span>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {/* Sản phẩm */}
                        <div className="form-group">
                            <label className="form-label">Sản phẩm chuyển đi *</label>
                            <select
                                className="form-control"
                                value={form.product_id}
                                onChange={e => setForm(f => ({ ...f, product_id: e.target.value, quantity: '' }))}
                                required
                            >
                                <option value="">-- Chọn sản phẩm --</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id} disabled={p.stock === 0}>
                                        {p.name} (tồn: {p.stock} {p.unit}){p.sku ? ` · ${p.sku}` : ''}{p.stock === 0 ? ' — Hết hàng' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Thông tin sản phẩm đã chọn */}
                        {selected && (
                            <div style={{ padding: '8px 12px', background: 'var(--primary-light)', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                                Tồn kho hiện tại: <strong>{selected.stock} {selected.unit}</strong>
                                {selected.sku && <> · SKU: <strong>{selected.sku}</strong></>}
                            </div>
                        )}

                        <div className="form-row">
                            {/* Số lượng */}
                            <div className="form-group">
                                <label className="form-label">Số lượng chuyển *</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    value={form.quantity}
                                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                                    min="1"
                                    max={selected?.stock || undefined}
                                    required
                                />
                            </div>

                            {/* Cửa hàng đích */}
                            <div className="form-group">
                                <label className="form-label">Chuyển đến cửa hàng *</label>
                                <select
                                    className="form-control"
                                    value={form.to_store_id}
                                    onChange={e => setForm(f => ({ ...f, to_store_id: e.target.value }))}
                                    required
                                >
                                    <option value="">-- Chọn cửa hàng đích --</option>
                                    {stores.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}{s.address ? ` · ${s.address}` : ''}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Ghi chú */}
                        <div className="form-group">
                            <label className="form-label">Ghi chú</label>
                            <input
                                className="form-control"
                                value={form.note}
                                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                                placeholder="Lý do chuyển hàng..."
                            />
                        </div>

                        {/* Preview sau chuyển */}
                        {afterQty !== null && (
                            <div style={{
                                padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                                background: afterQty < 0 ? '#fff7f7' : afterQty <= (selected?.min_stock || 5) ? '#fffbeb' : '#f0fdf4',
                                color: afterQty < 0 ? 'var(--danger)' : afterQty <= (selected?.min_stock || 5) ? 'var(--warning)' : 'var(--success)',
                            }}>
                                {afterQty < 0
                                    ? `⚠️ Không đủ hàng! Còn ${selected.stock} ${selected.unit}`
                                    : `Tồn kho sau chuyển: ${afterQty} ${selected.unit}`
                                }
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={onClose}>Hủy</button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={saving || (afterQty !== null && afterQty < 0)}
                        >
                            {saving ? 'Đang chuyển...' : '✈️ Xác nhận chuyển hàng'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function Inventory() {
    const { isAdmin } = useAuth();
    const [products, setProducts] = useState([]);
    const [logs, setLogs] = useState([]);
    const [transferLogs, setTransferLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showImport, setShowImport] = useState(false);
    const [showTransfer, setShowTransfer] = useState(false);
    const [tab, setTab] = useState('stock'); // 'stock' | 'logs' | 'transfers'
    const [filterLow, setFilterLow] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [pr, lg, tr] = await Promise.allSettled([
                productsApi.getAll(),
                inventoryApi.getLogs(),
                transfersApi.getLogs(),
            ]);
            setProducts(pr.status === 'fulfilled' ? (pr.value.data || []) : []);
            setLogs(lg.status === 'fulfilled' ? (lg.value.data || []) : []);
            setTransferLogs(tr.status === 'fulfilled' ? (tr.value.data || []) : []);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const displayed = filterLow ? products.filter(p => p.stock <= p.min_stock) : products;
    const logTypes = {
        import: { label: 'Nhập kho', cls: 'badge-success' },
        export: { label: 'Xuất hàng', cls: 'badge-danger' },
        adjust: { label: 'Điều chỉnh', cls: 'badge-warning' },
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h2>Quản lý kho hàng</h2>
                    <p>{products.filter(p => p.stock <= p.min_stock).length} sản phẩm cần nhập thêm</p>
                </div>
                <div className="flex gap-2">
                    <button className="btn btn-outline" onClick={load}><RefreshCw size={14} /> Làm mới</button>
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowTransfer(true)}
                        style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none' }}
                    >
                        <ArrowLeftRight size={14} /> Chuyển hàng
                    </button>
                    {isAdmin() && (
                        <button className="btn btn-success" onClick={() => setShowImport(true)}><PackagePlus size={14} /> Nhập hàng</button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4" style={{ marginBottom: 16 }}>
                <button className={`btn ${tab === 'stock' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('stock')}><Warehouse size={14} /> Tồn kho</button>
                <button className={`btn ${tab === 'logs' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('logs')}>📋 Lịch sử nhập xuất</button>
                <button className={`btn ${tab === 'transfers' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('transfers')}><ArrowLeftRight size={14} /> Chuyển hàng</button>
            </div>

            {/* Tab: Tồn kho */}
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

            {/* Tab: Lịch sử nhập xuất */}
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

            {/* Tab: Lịch sử chuyển hàng */}
            {tab === 'transfers' && (
                <div className="card">
                    {loading ? <div className="spinner-wrap"><div className="spinner" /></div> : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Thời gian</th>
                                        <th>Sản phẩm</th>
                                        <th>Loại</th>
                                        <th>Số lượng</th>
                                        <th>Cửa hàng liên quan</th>
                                        <th>Người thực hiện</th>
                                        <th>Ghi chú</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transferLogs.length === 0 ? (
                                        <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Chưa có lịch sử chuyển hàng</td></tr>
                                    ) : transferLogs.map(l => (
                                        <tr key={l.id}>
                                            <td className="text-muted fs-12">{new Date(l.created_at).toLocaleString('vi-VN')}</td>
                                            <td className="fw-600">{l.product_name} {l.sku ? <span className="badge badge-gray">{l.sku}</span> : null}</td>
                                            <td>
                                                {l.type === 'transfer_out'
                                                    ? <span className="badge" style={{ background: '#fef3c7', color: '#d97706' }}>📤 Xuất chuyển</span>
                                                    : <span className="badge" style={{ background: '#ede9fe', color: '#7c3aed' }}>📥 Nhận hàng</span>
                                                }
                                            </td>
                                            <td className={l.type === 'transfer_out' ? 'text-danger fw-600' : 'fw-600'} style={l.type === 'transfer_in' ? { color: '#7c3aed' } : {}}>
                                                {l.type === 'transfer_out' ? '-' : '+'}{Math.abs(l.quantity)} {l.unit}
                                            </td>
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
            {showTransfer && <TransferModal products={products} onClose={() => setShowTransfer(false)} onSaved={() => { setShowTransfer(false); load(); }} />}
        </div>
    );
}
