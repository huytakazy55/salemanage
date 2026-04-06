import { useEffect, useState, useRef } from 'react';
import { productsApi, ordersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { ShoppingCart, Search, Minus, Plus, Trash2, CheckCircle, X, Layers } from 'lucide-react';
import { CurrencyInput, Req } from '../utils/formUtils';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';
function fmt(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }

function PosProductImg({ src }) {
    const [err, setErr] = useState(false);
    if (!src || err) return (
        <div style={{ width: '100%', height: 90, background: 'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 32 }}>💡</span>
        </div>
    );
    return <img src={`${API_BASE}${src}`} alt="" onError={() => setErr(true)}
        style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 8, marginBottom: 10, display: 'block' }} />;
}

/** Popup: nhập giá bán + số lượng khi click sản phẩm */
function AddToCartPopup({ product, onConfirm, onClose, isEmployee }) {
    const priceRef = useRef(null);

    // For employees: default to suggested_price; for admin: default to sell_price
    const defaultPrice = isEmployee
        ? (product.suggested_price > 0 ? String(product.suggested_price) : '')
        : (product.sell_price > 0 ? String(product.sell_price) : '');
    const [price, setPrice] = useState(defaultPrice);

    useEffect(() => {
        // Focus vào ô giá bán ngay khi mở
        setTimeout(() => priceRef.current?.select(), 80);
    }, []);

    const [qty, setQty] = useState(1);
    const profit = !isEmployee ? (+price - +product.cost_price) * qty : null;
    const subtotal = +price * qty;
    const maxQty = product.stock;

    const handleConfirm = () => {
        if (!+price || +price <= 0) return toast.error('Vui lòng nhập giá bán');
        if (qty < 1) return toast.error('Số lượng phải >= 1');
        onConfirm({ ...product, qty, sell_price: price });
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleConfirm();
        if (e.key === 'Escape') onClose();
    };

    return (
        <div className="modal-overlay modal-center" onDoubleClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown} style={{ maxWidth: 380 }}>
                <div className="modal-header">
                    <span className="modal-title">🛒 Thêm vào giỏ hàng</span>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="modal-body" style={{ padding: '12px 16px' }}>
                    {/* Product info */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, padding: '8px 10px', background: 'var(--bg)', borderRadius: 10 }}>
                        <div style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-card)' }}>
                            {product.image_url ? (
                                <img src={`${API_BASE}${product.image_url}`} alt=""
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>💡</div>
                            )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{product.name}</div>
                            {!isEmployee && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Vốn: {fmt(product.cost_price)} · Tồn: {product.stock} {product.unit}</div>
                            )}
                            {isEmployee && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Tồn: {product.stock} {product.unit}</div>
                            )}
                        </div>
                    </div>

                    {/* Price + qty in one row on mobile */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end', marginBottom: 8 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>Giá bán (đ) <Req /></label>
                            <CurrencyInput
                                value={price}
                                onChange={v => setPrice(v)}
                                className={`form-control input-currency${!price && price !== '' ? '' : ''}`}
                                style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)', padding: '8px 10px' }}
                                placeholder="0"
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                                Số lượng
                                {isEmployee && product.suggested_price > 0 && (
                                    <span style={{ fontWeight: 400, color: 'var(--primary)', marginLeft: 6 }}>
                                        (Đề xuất: {fmt(+product.suggested_price)})
                                    </span>
                                )}
                            </label>
                            <div className="cart-qty-control">
                                <button className="qty-btn" type="button" onClick={() => setQty(q => Math.max(1, q - 1))}><Minus size={13} /></button>
                                <input
                                    type="number"
                                    style={{ width: 40, textAlign: 'center', fontWeight: 700, fontSize: 16, border: 'none', background: 'transparent' }}
                                    value={qty}
                                    onChange={e => setQty(Math.max(1, Math.min(maxQty, +e.target.value || 1)))}
                                    min="1" max={maxQty}
                                />
                                <button className="qty-btn" type="button" onClick={() => setQty(q => Math.min(maxQty, q + 1))}><Plus size={13} /></button>
                            </div>
                        </div>
                    </div>

                    {/* Live profit preview */}
                    {+price > 0 && profit !== null && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, fontSize: 12 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Thành tiền: <strong style={{ color: 'var(--primary)' }}>{fmt(subtotal)}</strong></span>
                            <span style={{ color: profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>Lãi: {fmt(profit)}</span>
                        </div>
                    )}
                    {+price > 0 && profit === null && (
                        <div style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, fontSize: 12 }}>
                            Thành tiền: <strong style={{ color: 'var(--primary)' }}>{fmt(subtotal)}</strong>
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-outline" onClick={onClose}>Hủy (Esc)</button>
                    <button className="btn btn-primary" onClick={handleConfirm} disabled={!+price}>
                        <ShoppingCart size={15} /> Thêm vào giỏ
                    </button>
                </div>
            </div>
        </div>
    );
}

/** Picker: chọn phân loại sản phẩm trước khi thêm vào giỏ */
function VariantPickerModal({ product, onPick, onClose, isEmployee }) {
    return (
        <div className="modal-overlay modal-center" onDoubleClick={onClose}>
            <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <span className="modal-title">🎨 Chọn phân loại</span>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="modal-body" style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: 'var(--text-muted)' }}>{product.name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(product.variants || []).map(v => {
                            const outOfStock = (v.stock || 0) === 0;
                            return (
                                <button
                                    key={v.id}
                                    className={`btn ${outOfStock ? 'btn-outline' : 'btn-primary'}`}
                                    style={{
                                        justifyContent: 'space-between', padding: '10px 16px',
                                        opacity: outOfStock ? 0.5 : 1, cursor: outOfStock ? 'not-allowed' : 'pointer'
                                    }}
                                    disabled={outOfStock}
                                    onClick={() => !outOfStock && onPick({
                                        ...product,
                                        // Override with variant data
                                        variant_id: v.id,
                                        variant_name: v.name,
                                        stock: v.stock || 0,
                                        cost_price: +v.cost_price > 0 ? v.cost_price : product.cost_price,
                                        suggested_price: +v.suggested_price > 0 ? v.suggested_price : product.suggested_price,
                                        sell_price: +v.suggested_price > 0 ? v.suggested_price : product.sell_price,
                                    })}
                                >
                                    <span style={{ fontWeight: 700 }}>{v.name}{v.sku ? <span style={{ fontWeight: 400, fontSize: 11, marginLeft: 6 }}>({v.sku})</span> : ''}</span>
                                    <span style={{ fontSize: 12 }}>
                                        {outOfStock ? 'Hết hàng' : `Còn ${v.stock}`}
                                        {!isEmployee && +v.suggested_price > 0 && <> · {Number(v.suggested_price).toLocaleString('vi-VN')}đ</>}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Sales() {
    const { user } = useAuth();
    const isEmployee = user?.role === 'employee';
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [search, setSearch] = useState('');
    const [discount, setDiscount] = useState(0);
    const [payMethod, setPayMethod] = useState('cash');
    const [customerName, setCustomerName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [successOrder, setSuccessOrder] = useState(null);
    const [popupProduct, setPopupProduct] = useState(null);
    const [variantPickerProduct, setVariantPickerProduct] = useState(null);
    const [cartOpen, setCartOpen] = useState(false); // mobile cart toggle

    useEffect(() => {
        productsApi.getAll().then(r => setProducts(r.data || []));
    }, []);

    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku || '').toLowerCase().includes(search.toLowerCase())
    );

    const handleProductClick = (product) => {
        if (product.has_variants) {
            // Show variant picker first
            const totalVariantStock = (product.variants || []).reduce((s, v) => s + (v.stock || 0), 0);
            if (totalVariantStock === 0) return toast.error('Sản phẩm đã hết tất cả phân loại!');
            setVariantPickerProduct(product);
        } else {
            if (product.stock === 0) return toast.error('Sản phẩm đã hết hàng!');
            setPopupProduct(product);
        }
    };

    const handleConfirmAdd = ({ qty, sell_price, ...product }) => {
        // Cart key: product+variant combination
        const cartKey = product.variant_id ? `${product.id}_v${product.variant_id}` : `${product.id}`;
        setCart(prev => {
            const existing = prev.find(i => i._cartKey === cartKey);
            if (existing) {
                const newQty = existing.qty + qty;
                if (newQty > product.stock) {
                    toast.error(`Chỉ còn ${product.stock} ${product.unit} trong kho!`);
                    return prev;
                }
                return prev.map(i => i._cartKey === cartKey ? { ...i, qty: newQty, sell_price } : i);
            }
            return [...prev, { ...product, qty, sell_price, _cartKey: cartKey }];
        });
        setPopupProduct(null);
        setVariantPickerProduct(null);
        setCartOpen(true);
        const label = product.variant_name ? `${product.name} · ${product.variant_name}` : product.name;
        toast.success(`Đã thêm ${qty} × ${label}`, { duration: 1500, icon: '🛒' });
    };

    const updateQty = (cartKey, delta) => {
        setCart(prev => {
            const item = prev.find(i => i._cartKey === cartKey);
            const newQty = (item?.qty || 0) + delta;
            if (newQty <= 0) return prev.filter(i => i._cartKey !== cartKey);
            const product = products.find(p => p.id === item?.id);
            if (newQty > (item?.stock || product?.stock || 0)) { toast.error(`Chỉ còn ${item?.stock || product?.stock} ${item?.unit}!`); return prev; }
            return prev.map(i => i._cartKey === cartKey ? { ...i, qty: newQty } : i);
        });
    };

    const updateSellPrice = (cartKey, price) => {
        setCart(prev => prev.map(i => i._cartKey === cartKey ? { ...i, sell_price: price } : i));
    };

    const removeItem = (cartKey) => setCart(prev => prev.filter(i => i._cartKey !== cartKey));
    const clearCart = () => setCart([]);

    const totalAmount = cart.reduce((s, i) => s + (+i.sell_price || 0) * i.qty, 0);
    const finalAmount = Math.max(0, totalAmount - discount);
    const totalCost = cart.reduce((s, i) => s + i.cost_price * i.qty, 0);
    const estProfit = finalAmount - totalCost;
    const allPricesFilled = cart.length > 0 && cart.every(i => +i.sell_price > 0);

    const handleSubmit = async () => {
        if (cart.length === 0) return toast.error('Giỏ hàng trống!');
        const missingPrice = cart.find(i => !+i.sell_price);
        if (missingPrice) return toast.error(`Vui lòng nhập giá bán cho "${missingPrice.name}"`);
        setSubmitting(true);
        try {
            const result = await ordersApi.create({
                items: cart.map(i => ({
                    product_id: i.id,
                    quantity: i.qty,
                    sell_price: +i.sell_price,
                    ...(i.variant_id ? { variant_id: i.variant_id, variant_name: i.variant_name } : {}),
                })),
                customer_name: customerName || null,
                discount: +discount,
                payment_method: payMethod,
            });
            // Play confirmation sound for the seller
            try {
                const audio = new Audio('/Sound/ribhavagrawal-notification-sound-type-19-no-copyright-410278.mp3');
                audio.play().catch(() => { });
            } catch (_) { }
            setSuccessOrder(result.data);
            setCart([]); setDiscount(0); setCustomerName(''); setCartOpen(false);
            toast.success('Đặt hàng thành công!');
            productsApi.getAll().then(r => setProducts(r.data || []));
        } catch (err) {
            toast.error(err.error || 'Có lỗi xảy ra');
        } finally { setSubmitting(false); }
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h2>Bán hàng (POS)</h2>
                    <p>Click sản phẩm → nhập giá + số lượng → thanh toán</p>
                </div>
            </div>

            <div className="pos-layout">
                {/* Products grid */}
                <div>
                    <div className="filter-bar">
                        <div className="search-input-wrap" style={{ flex: 1 }}>
                            <Search size={15} />
                            <input className="form-control search-input" placeholder="Tìm sản phẩm..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                    </div>
                    <div className="pos-product-grid">
                        {filtered.map(p => (
                            <div key={p.id} className={`pos-product-card ${p.stock === 0 ? 'out-of-stock' : ''}`} onClick={() => handleProductClick(p)}>
                                <PosProductImg src={p.image_url} />
                                <div className="pos-product-name">{p.name}</div>
                                {!isEmployee && (
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Vốn: {fmt(p.cost_price)}</div>
                                )}
                                {isEmployee && p.suggested_price > 0 && (
                                    <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 2, fontWeight: 600 }}>Đề xuất: {fmt(p.suggested_price)}</div>
                                )}
                                <div className="pos-product-stock" style={{ marginTop: 4 }}>Còn: {p.stock} {p.unit}</div>
                                {p.stock <= p.min_stock && p.stock > 0 && (
                                    <div style={{ fontSize: 10, color: 'var(--warning)', marginTop: 2, fontWeight: 600 }}>⚠ Sắp hết</div>
                                )}
                                {p.stock === 0 && <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 2, fontWeight: 600 }}>Hết hàng</div>}
                            </div>
                        ))}
                        {filtered.length === 0 && (
                            <div className="empty-state" style={{ gridColumn: '1/-1' }}><ShoppingCart size={40} /><p>Không tìm thấy sản phẩm</p></div>
                        )}
                    </div>
                </div>

                {/* Cart panel — desktop: sidebar, mobile: bottom sheet */}
                <div className={`cart-panel${cartOpen ? ' cart-panel-open' : ''}`}>
                    {/* Drag handle (mobile only) */}
                    <div className="cart-drag-handle" />

                    <div className="cart-header">
                        <span style={{ fontSize: 15, fontWeight: 700 }}>🛒 Giỏ hàng</span>
                        {cart.length > 0 && <span className="badge badge-primary" style={{ marginLeft: 6 }}>{cart.reduce((s, i) => s + i.qty, 0)} món</span>}
                        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                            {cart.length > 0 && (
                                <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={clearCart}><Trash2 size={14} /></button>
                            )}
                            <button className="btn btn-ghost btn-sm btn-icon pos-cart-close" onClick={() => setCartOpen(false)}><X size={16} /></button>
                        </div>
                    </div>

                    {cart.length === 0 ? (
                        <div style={{ padding: '20px 16px', textAlign: 'center' }}>
                            <div style={{ fontSize: 36, marginBottom: 8 }}>🛒</div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Giỏ hàng trống</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Bấm vào sản phẩm để thêm</div>
                        </div>
                    ) : (
                        <div className="cart-items">
                            {cart.map(item => {
                                const sellPrice = +item.sell_price || 0;
                                const profit = (sellPrice - item.cost_price) * item.qty;
                                return (
                                    <div key={item._cartKey} style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-light)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                                            <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)', padding: 2, flexShrink: 0 }} onClick={() => removeItem(item._cartKey)}><X size={12} /></button>
                                            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                                                {item.name}
                                                {item.variant_name && <span style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--primary)', marginTop: 1 }}>🎨 {item.variant_name}</span>}
                                            </span>
                                            {sellPrice > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>{fmt(sellPrice * item.qty)}</span>}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 24 }}>
                                            <div className="cart-qty-control">
                                                <button className="qty-btn" onClick={() => updateQty(item._cartKey, -1)}><Minus size={11} /></button>
                                                <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 600, fontSize: 13 }}>{item.qty}</span>
                                                <button className="qty-btn" onClick={() => updateQty(item._cartKey, 1)}><Plus size={11} /></button>
                                            </div>
                                            <input type="number" className="form-control" placeholder="Giá bán..."
                                                value={item.sell_price} onChange={e => updateSellPrice(item._cartKey, e.target.value)} min="0"
                                                style={{ fontSize: 12, padding: '4px 8px', flex: 1, borderColor: !+item.sell_price ? 'var(--warning)' : 'var(--border)' }} />
                                            {sellPrice > 0 && (
                                                <span style={{ fontSize: 11, color: profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600, flexShrink: 0 }}>+{fmt(profit)}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="cart-footer">
                        {/* Inline: customer + discount */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8, marginBottom: 10 }}>
                            <input className="form-control" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="👤 Tên khách..." style={{ fontSize: 12 }} />
                            <input type="number" className="form-control" value={discount || ''} onChange={e => setDiscount(Math.max(0, +e.target.value))} placeholder="Giảm giá" min="0" style={{ fontSize: 12 }} />
                        </div>
                        {/* Payment method — tab style */}
                        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                            {[{ v: 'cash', icon: '💵', label: 'Tiền mặt' }, { v: 'transfer', icon: '🏦', label: 'Chuyển khoản' }, { v: 'card', icon: '💳', label: 'Thẻ' }].map(pm => (
                                <button key={pm.v} type="button" onClick={() => setPayMethod(pm.v)} style={{
                                    flex: 1, padding: '6px 4px', fontSize: 11, border: '1.5px solid',
                                    borderColor: payMethod === pm.v ? 'var(--primary)' : 'var(--border)',
                                    background: payMethod === pm.v ? 'rgba(99,102,241,0.08)' : 'transparent',
                                    color: payMethod === pm.v ? 'var(--primary)' : 'var(--text-muted)',
                                    borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                                    fontWeight: payMethod === pm.v ? 700 : 400, transition: 'all 0.15s',
                                }}>
                                    {pm.icon}<br />{pm.label}
                                </button>
                            ))}
                        </div>
                        {/* Totals */}
                        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                                <span style={{ color: 'var(--text-muted)' }}>Tổng cộng</span>
                                <span className="fw-600">{fmt(totalAmount)}</span>
                            </div>
                            {discount > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--danger)', marginBottom: 4 }}>
                                    <span>Giảm giá</span><span>-{fmt(discount)}</span>
                                </div>
                            )}
                            <div style={{ borderTop: '1px solid var(--border-light)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 700, fontSize: 14 }}>Thanh toán</span>
                                <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--primary)' }}>{fmt(finalAmount)}</span>
                            </div>
                            {allPricesFilled && (
                                <div style={{ fontSize: 11, color: estProfit >= 0 ? 'var(--success)' : 'var(--danger)', textAlign: 'right', marginTop: 4, fontWeight: 600 }}>
                                    Lãi: {fmt(estProfit)} ({finalAmount > 0 ? Math.round(estProfit / finalAmount * 100) : 0}%)
                                </div>
                            )}
                        </div>
                        {!allPricesFilled && cart.length > 0 && (
                            <div style={{ fontSize: 11, color: 'var(--warning)', textAlign: 'center', marginBottom: 8 }}>⚠ Nhập giá bán cho tất cả sản phẩm</div>
                        )}
                        <button className="btn btn-primary btn-block btn-lg" onClick={handleSubmit} disabled={submitting || !allPricesFilled}>
                            {submitting ? 'Đang xử lý...' : <><CheckCircle size={16} /> Xác nhận thanh toán</>}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile: backdrop when cart is open */}
            {cartOpen && <div className="pos-cart-backdrop" onClick={() => setCartOpen(false)} />}

            {/* Mobile: floating cart button */}
            <button className="pos-cart-fab" onClick={() => setCartOpen(o => !o)} aria-label="Xem giỏ hàng">
                🛒
                {cart.length > 0 && (
                    <span className="pos-cart-fab-badge">{cart.reduce((s, i) => s + i.qty, 0)}</span>
                )}
            </button>

            {/* Product add popup */}

            {popupProduct && (
                <AddToCartPopup
                    product={popupProduct}
                    onConfirm={handleConfirmAdd}
                    onClose={() => setPopupProduct(null)}
                    isEmployee={isEmployee}
                />
            )}

            {variantPickerProduct && !popupProduct && (
                <VariantPickerModal
                    product={variantPickerProduct}
                    onPick={(variantProduct) => {
                        setVariantPickerProduct(null);
                        setPopupProduct(variantProduct);
                    }}
                    onClose={() => setVariantPickerProduct(null)}
                    isEmployee={isEmployee}
                />
            )}

            {/* Success modal */}
            {successOrder && (
                <div className="modal-overlay modal-center" onDoubleClick={() => setSuccessOrder(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, textAlign: 'center' }}>
                        <div className="modal-body" style={{ padding: '32px 24px' }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                            <h3 style={{ marginBottom: 8 }}>Thanh toán thành công!</h3>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                                Mã đơn: <strong>{successOrder.order_code}</strong>
                            </div>
                            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '14px 20px', textAlign: 'left', marginBottom: 16 }}>
                                <div className="cart-total-row"><span>Tổng tiền:</span><span className="fw-600">{fmt(successOrder.final_amount)}</span></div>
                                {!isEmployee && <div className="cart-total-row" style={{ color: 'var(--success)' }}><span>Lợi nhuận:</span><span className="fw-600">{fmt(successOrder.profit)}</span></div>}
                            </div>
                            <button className="btn btn-primary btn-block" onClick={() => setSuccessOrder(null)}>Đóng</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
