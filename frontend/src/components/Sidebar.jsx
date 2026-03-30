import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard, Package, Warehouse, ShoppingCart,
    ClipboardList, BarChart2, Tag, LogOut, X, Store, Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Sidebar({ open, onClose }) {
    const { user, logout, isAdmin, isSuperAdmin } = useAuth();

    const handleLogout = () => {
        logout();
        toast.success('Đã đăng xuất');
        onClose?.();
    };

    const navGroups = [
        {
            label: 'Tổng quan',
            items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }]
        },
        {
            label: 'Bán hàng',
            items: [
                { to: '/ban-hang', label: 'Bán hàng (POS)', icon: ShoppingCart },
                { to: '/don-hang', label: 'Lịch sử đơn hàng', icon: ClipboardList },
            ]
        },
        {
            label: 'Kho hàng',
            items: [
                { to: '/san-pham', label: 'Sản phẩm', icon: Package },
                { to: '/kho-hang', label: 'Kho hàng', icon: Warehouse },
                ...(isAdmin() ? [{ to: '/danh-muc', label: 'Danh mục', icon: Tag }] : []),
            ]
        },
        ...(isAdmin() ? [{
            label: 'Quản lý',
            items: [
                { to: '/bao-cao', label: 'Báo cáo', icon: BarChart2 },
                { to: '/nguoi-dung', label: 'Người dùng', icon: Users },
                ...(isSuperAdmin() ? [{ to: '/cua-hang', label: 'Cửa hàng', icon: Store }] : []),
            ]
        }] : []),
    ];

    return (
        <>
            {open && <div className="sidebar-overlay" onClick={onClose} />}

            <div className={`sidebar${open ? ' sidebar-open' : ''}`}>
                <div className="sidebar-logo">
                    <div className="flex-center gap-2" style={{ marginBottom: 4 }}>
                        <ShoppingCart size={20} color="#6366f1" />
                        <h1>SaleManage</h1>
                    </div>
                    {/* Store name badge */}
                    {user?.store_name ? (
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.07)', borderRadius: 4, padding: '2px 8px', display: 'inline-block', marginTop: 2 }}>
                            🏪 {user.store_name}
                        </div>
                    ) : (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Quản lý tổng</span>
                    )}
                    <button className="sidebar-close-btn" onClick={onClose} aria-label="Đóng menu">
                        <X size={18} />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {navGroups.map(group => (
                        <div className="nav-group" key={group.label}>
                            <div className="nav-group-label">{group.label}</div>
                            {group.items.map(item => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.to === '/'}
                                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                                    onClick={onClose}
                                >
                                    <item.icon size={17} />
                                    {item.label}
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>

                <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                            background: isSuperAdmin() ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : isAdmin() ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'linear-gradient(135deg,#10b981,#059669)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
                        }}>
                            {isSuperAdmin() ? '👑' : isAdmin() ? '🔑' : '👤'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {user?.full_name}
                            </div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                                {isSuperAdmin() ? '⚡ Super Admin' : isAdmin() ? '🔑 Admin' : '👤 Nhân viên'}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
                            background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                            fontSize: 13, transition: 'all 0.2s', fontFamily: 'inherit',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                    >
                        <LogOut size={14} /> Đăng xuất
                    </button>
                </div>
            </div>
        </>
    );
}
