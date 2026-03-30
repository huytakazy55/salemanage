import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { LogIn, Eye, EyeOff, Zap } from 'lucide-react';

export default function Login() {
    const { login } = useAuth();
    const [form, setForm] = useState({ username: '', password: '' });
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.username || !form.password) return toast.error('Vui lòng nhập đầy đủ thông tin');
        setLoading(true);
        try {
            const user = await login(form.username, form.password);
            toast.success(`Chào mừng, ${user.full_name}! 👋`);
        } catch (err) {
            toast.error(err.error || 'Sai tên đăng nhập hoặc mật khẩu');
        } finally { setLoading(false); }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0d0d1a',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: "'Inter', sans-serif",
        }}>
            {/* Animated gradient orbs */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div style={{
                    position: 'absolute', width: 500, height: 500,
                    background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)',
                    top: '-10%', left: '-10%', animation: 'float1 8s ease-in-out infinite',
                }} />
                <div style={{
                    position: 'absolute', width: 400, height: 400,
                    background: 'radial-gradient(circle, rgba(236,72,153,0.2) 0%, transparent 70%)',
                    bottom: '-5%', right: '-5%', animation: 'float2 10s ease-in-out infinite',
                }} />
                <div style={{
                    position: 'absolute', width: 300, height: 300,
                    background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
                    top: '50%', left: '60%', animation: 'float3 12s ease-in-out infinite',
                }} />
                {/* Grid lines overlay */}
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: `
            linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px)
          `,
                    backgroundSize: '50px 50px',
                }} />
            </div>

            <style>{`
        @keyframes float1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,20px) scale(1.05); } }
        @keyframes float2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-25px,-15px) scale(1.08); } }
        @keyframes float3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(20px,30px) scale(0.95); } }
        @keyframes pulse-ring { 0% { transform: scale(0.95); opacity:1; } 100% { transform: scale(1.3); opacity:0; } }
        .login-input { width:100%; padding:12px 16px; background:rgba(255,255,255,0.05); border:1.5px solid rgba(255,255,255,0.1); border-radius:10px; color:#fff; font-size:14px; font-family:inherit; outline:none; transition:all .2s; box-sizing:border-box; }
        .login-input::placeholder { color:rgba(255,255,255,0.3); }
        .login-input:focus { border-color:rgba(99,102,241,0.8); background:rgba(99,102,241,0.08); box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
        .login-btn { width:100%; padding:13px; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; border:none; border-radius:10px; font-size:15px; font-weight:600; cursor:pointer; transition:all .2s; font-family:inherit; display:flex; align-items:center; justify-content:center; gap:8px; }
        .login-btn:hover:not(:disabled) { background:linear-gradient(135deg,#4f46e5,#7c3aed); transform:translateY(-1px); box-shadow:0 8px 25px rgba(99,102,241,0.4); }
        .login-btn:disabled { opacity:0.6; cursor:not-allowed; transform:none; }
      `}</style>

            {/* Login card */}
            <div style={{
                position: 'relative', zIndex: 10,
                width: '100%', maxWidth: 400,
                margin: 20,
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 24,
                padding: '44px 40px',
                boxShadow: '0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 36 }}>
                    <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
                        <div style={{
                            position: 'absolute', inset: -4,
                            background: 'linear-gradient(135deg,#6366f1,#ec4899)',
                            borderRadius: '50%', animation: 'pulse-ring 2.5s ease-out infinite',
                            opacity: 0.4,
                        }} />
                        <div style={{
                            width: 64, height: 64, borderRadius: '50%',
                            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 28, position: 'relative',
                            boxShadow: '0 0 30px rgba(99,102,241,0.5)',
                        }}>🌙</div>
                    </div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px', background: 'linear-gradient(135deg,#fff,rgba(255,255,255,0.7))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        SaleManage
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>Hệ thống quản lý bán hàng</p>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Username */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
                            Tên đăng nhập
                        </label>
                        <input
                            id="login-username"
                            className="login-input"
                            type="text"
                            placeholder="Nhập username..."
                            value={form.username}
                            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                            autoFocus
                            autoComplete="username"
                        />
                    </div>

                    {/* Password */}
                    <div style={{ marginBottom: 28, position: 'relative' }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
                            Mật khẩu
                        </label>
                        <input
                            id="login-password"
                            className="login-input"
                            type={showPass ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={form.password}
                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            autoComplete="current-password"
                            style={{ paddingRight: 44 }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPass(s => !s)}
                            style={{ position: 'absolute', right: 12, bottom: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 0, display: 'flex' }}
                        >
                            {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                    </div>

                    <button id="login-submit" type="submit" className="login-btn" disabled={loading}>
                        {loading
                            ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} /> Đang đăng nhập...</>
                            : <><LogIn size={16} /> Đăng nhập</>
                        }
                    </button>
                </form>

                {/* Divider + credits */}
                <div style={{ textAlign: 'center', marginTop: 28, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
                        <Zap size={12} />
                        <span>SaleManage v1.0</span>
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
}
