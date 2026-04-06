import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import toast from 'react-hot-toast';
import { UserPlus, Eye, EyeOff, Zap } from 'lucide-react';

export default function Register() {
    const { loginWithToken } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ store_name: '', full_name: '', username: '', password: '', confirm_password: '' });
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.store_name || !form.full_name || !form.username || !form.password)
            return toast.error('Vui lòng điền đầy đủ thông tin');
        if (form.password.length < 6)
            return toast.error('Mật khẩu phải ít nhất 6 ký tự');
        if (form.password !== form.confirm_password)
            return toast.error('Mật khẩu xác nhận không khớp');
        setLoading(true);
        try {
            const res = await authApi.register({
                store_name: form.store_name.trim(),
                full_name: form.full_name.trim(),
                username: form.username.trim(),
                password: form.password,
            });
            loginWithToken(res.token, res.user);
            toast.success(`Chào mừng ${res.user.full_name}! Cửa hàng đã được tạo 🎉`);
            navigate('/ban-hang', { replace: true });
        } catch (err) {
            toast.error(err.error || 'Có lỗi xảy ra, vui lòng thử lại');
        } finally { setLoading(false); }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#0d0d1a', position: 'relative', overflow: 'hidden',
            fontFamily: "'Inter', sans-serif",
        }}>
            {/* Animated gradient orbs */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', width: 500, height: 500, background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)', top: '-10%', left: '-10%', animation: 'float1 8s ease-in-out infinite' }} />
                <div style={{ position: 'absolute', width: 400, height: 400, background: 'radial-gradient(circle, rgba(236,72,153,0.2) 0%, transparent 70%)', bottom: '-5%', right: '-5%', animation: 'float2 10s ease-in-out infinite' }} />
                <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px)`, backgroundSize: '50px 50px' }} />
            </div>

            <style>{`
        @keyframes float1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,20px) scale(1.05); } }
        @keyframes float2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-25px,-15px) scale(1.08); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .reg-input { width:100%; padding:12px 16px; background:rgba(255,255,255,0.05); border:1.5px solid rgba(255,255,255,0.1); border-radius:10px; color:#fff; font-size:14px; font-family:inherit; outline:none; transition:all .2s; box-sizing:border-box; }
        .reg-input::placeholder { color:rgba(255,255,255,0.3); }
        .reg-input:focus { border-color:rgba(99,102,241,0.8); background:rgba(99,102,241,0.08); box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
        .reg-btn { width:100%; padding:13px; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; border:none; border-radius:10px; font-size:15px; font-weight:600; cursor:pointer; transition:all .2s; font-family:inherit; display:flex; align-items:center; justify-content:center; gap:8px; }
        .reg-btn:hover:not(:disabled) { background:linear-gradient(135deg,#4f46e5,#7c3aed); transform:translateY(-1px); box-shadow:0 8px 25px rgba(99,102,241,0.4); }
        .reg-btn:disabled { opacity:0.6; cursor:not-allowed; transform:none; }
      `}</style>

            <div style={{
                position: 'relative', zIndex: 10, width: '100%', maxWidth: 420, margin: 20,
                background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: '44px 40px',
                boxShadow: '0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: '50%',
                        background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 28, margin: '0 auto 16px', boxShadow: '0 0 30px rgba(99,102,241,0.5)',
                    }}>🏪</div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', background: 'linear-gradient(135deg,#fff,rgba(255,255,255,0.7))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Tạo cửa hàng mới
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>Đăng ký miễn phí — bắt đầu ngay hôm nay</p>
                </div>

                <form onSubmit={handleSubmit}>
                    {[
                        { key: 'store_name', label: 'Tên cửa hàng', placeholder: 'VD: Shop Thời Trang ABC...', type: 'text' },
                        { key: 'full_name', label: 'Họ tên chủ cửa hàng', placeholder: 'Nguyễn Văn A', type: 'text' },
                        { key: 'username', label: 'Tên đăng nhập', placeholder: 'username (không dấu, không khoảng trắng)', type: 'text' },
                    ].map(({ key, label, placeholder, type }) => (
                        <div key={key} style={{ marginBottom: 14 }}>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>{label}</label>
                            <input className="reg-input" type={type} placeholder={placeholder}
                                value={form[key]} onChange={e => set(key, e.target.value)} />
                        </div>
                    ))}

                    {/* Password */}
                    <div style={{ marginBottom: 14, position: 'relative' }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Mật khẩu</label>
                        <input className="reg-input" type={showPass ? 'text' : 'password'} placeholder="Ít nhất 6 ký tự"
                            value={form.password} onChange={e => set('password', e.target.value)} style={{ paddingRight: 44 }} />
                        <button type="button" onClick={() => setShowPass(s => !s)}
                            style={{ position: 'absolute', right: 12, bottom: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 0, display: 'flex' }}>
                            {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                    </div>

                    <div style={{ marginBottom: 24 }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Xác nhận mật khẩu</label>
                        <input className="reg-input" type="password" placeholder="Nhập lại mật khẩu"
                            value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)} />
                    </div>

                    {/* Free tier info */}
                    <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                        🎁 <b style={{ color: 'rgba(255,255,255,0.9)' }}>Gói miễn phí:</b> quản lý cửa hàng + tối đa <b style={{ color: '#a5b4fc' }}>1 nhân viên</b>.
                        Liên hệ admin để nâng cấp thêm slot nhân viên.
                    </div>

                    <button type="submit" className="reg-btn" disabled={loading}>
                        {loading
                            ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} /> Đang tạo...</>
                            : <><UserPlus size={16} /> Tạo cửa hàng</>
                        }
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Đã có tài khoản? </span>
                    <Link to="/login" style={{ color: '#a5b4fc', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Đăng nhập</Link>
                </div>

                <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
                    <Zap size={12} /><span>SaleManage v1.0</span>
                </div>
            </div>
        </div>
    );
}
