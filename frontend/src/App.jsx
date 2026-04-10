import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { Menu, LayoutDashboard, ShoppingCart, ClipboardList, Warehouse, MoreHorizontal } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import NotificationBell from './components/NotificationBell';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Orders from './pages/Orders';
import Reports from './pages/Reports';
import Categories from './pages/Categories';
import UsersPage from './pages/Users';
import StoresPage from './pages/Stores';
import EmployeeReport from './pages/EmployeeReport';
import AuditLogs from './pages/AuditLogs';
import ShiftReport from './pages/ShiftReport';
import Register from './pages/Register';

function PrivateRoute({ children, adminOnly = false, superAdminOnly = false }) {
    const { isAdmin, isSuperAdmin } = useAuth();
    if (superAdminOnly && !isSuperAdmin()) return <Navigate to="/" replace />;
    if (adminOnly && !isAdmin()) return <Navigate to="/" replace />;
    return children;
}

// Redirect nhân viên khỏi Dashboard → trang bán hàng
function EmployeeGuard() {
    const { isAdmin } = useAuth();
    if (!isAdmin()) return <Navigate to="/ban-hang" replace />;
    return <Dashboard />;
}

// Mobile bottom navigation
function MobileBottomNav({ onOpenSidebar }) {
    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Tổng quan', end: true },
        { to: '/ban-hang', icon: ShoppingCart, label: 'Bán hàng' },
        { to: '/don-hang', icon: ClipboardList, label: 'Đơn hàng' },
        { to: '/kho-hang', icon: Warehouse, label: 'Kho hàng' },
    ];

    return (
        <nav className="mobile-bottom-nav">
            {navItems.map(item => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
                >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                </NavLink>
            ))}
            {/* More button → opens sidebar */}
            <button className="mobile-nav-item" onClick={onOpenSidebar}>
                <MoreHorizontal size={20} />
                <span>Thêm</span>
            </button>
        </nav>
    );
}

function AppLayout() {
    const { user, loading } = useAuth();
    const { dark, toggle } = useTheme();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)', fontSize: 14 }}>
            Đang tải...
        </div>
    );
    if (!user) return <Navigate to="/login" replace />;

    return (
        <div className="app-layout">
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className="main-content">
                {/* Mobile top bar */}
                <div className="mobile-topbar">
                    <button
                        className="mobile-menu-btn"
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Mở menu"
                    >
                        <Menu size={20} />
                    </button>
                    <span className="mobile-topbar-title">📊 SaleManage</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <NotificationBell />
                        <button
                            className="theme-toggle-topbar"
                            onClick={toggle}
                            aria-label="Chuyển chế độ sáng/tối"
                            title={dark ? 'Chuyển sang sáng' : 'Chuyển sang tối'}
                        >
                            {dark ? '☀️' : '🌙'}
                        </button>
                    </div>
                </div>

                {/* Desktop floating theme toggle — bottom right */}
                <button
                    className="theme-toggle-fab"
                    onClick={toggle}
                    aria-label="Chuyển chế độ sáng/tối"
                    title={dark ? 'Chuyển sang sáng' : 'Chuyển sang tối'}
                >
                    {dark ? '☀️' : '🌙'}
                </button>

                {/* Desktop notification bell FAB — above theme toggle */}
                <div className="notif-fab-wrapper">
                    <NotificationBell />
                </div>

                {/* Page content wrapper — handles all padding */}
                <div className="page-wrapper">
                    <Routes>
                        <Route path="/" element={
                            user && user.role === 'employee'
                                ? <Navigate to="/ban-hang" replace />
                                : <Dashboard />
                        } />
                        <Route path="/ban-hang" element={<Sales />} />
                        <Route path="/don-hang" element={<Orders />} />
                        <Route path="/ca-lam-viec" element={<ShiftReport />} />
                        <Route path="/san-pham" element={<Products />} />
                        <Route path="/kho-hang" element={<Inventory />} />
                        <Route path="/danh-muc" element={<PrivateRoute adminOnly><Categories /></PrivateRoute>} />
                        <Route path="/bao-cao" element={<PrivateRoute adminOnly><Reports /></PrivateRoute>} />
                        <Route path="/nhan-vien" element={<PrivateRoute adminOnly><EmployeeReport /></PrivateRoute>} />
                        <Route path="/nguoi-dung" element={<PrivateRoute adminOnly><UsersPage /></PrivateRoute>} />
                        <Route path="/cua-hang" element={<PrivateRoute superAdminOnly><StoresPage /></PrivateRoute>} />
                        <Route path="/lich-su-thay-doi" element={<PrivateRoute superAdminOnly><AuditLogs /></PrivateRoute>} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </div>
            </main>

            {/* Bottom nav — always fixed at bottom on mobile */}
            <MobileBottomNav onOpenSidebar={() => setSidebarOpen(true)} />

            {/* Theme toggle — bottom left, always visible */}

        </div>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
                <Routes>
                    <Route path="/login" element={<LoginGuard />} />
                    <Route path="/dang-ky" element={<RegisterGuard />} />
                    <Route path="/*" element={<AppLayout />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

function LoginGuard() {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (user) return <Navigate to="/" replace />;
    return <Login />;
}

function RegisterGuard() {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (user) return <Navigate to="/" replace />;
    return <Register />;
}
