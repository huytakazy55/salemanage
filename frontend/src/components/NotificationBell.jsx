import { useState, useEffect, useRef, useCallback } from 'react';
import { notificationsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Bell, X, CheckCheck } from 'lucide-react';

const SOUND_FILE = '/Sound/ribhavagrawal-notification-sound-type-19-no-copyright-410278.mp3';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Shared Web Audio context — unlocked on first user interaction
let _audioCtx = null;
let _audioBuffer = null;
let _unlocked = false;

function getAudioCtx() {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return _audioCtx;
}

async function unlockAndLoadAudio() {
    if (_unlocked) return;
    _unlocked = true;
    try {
        const ctx = getAudioCtx();
        // Resume suspended context (required by Chrome autoplay policy)
        if (ctx.state === 'suspended') await ctx.resume();
        // Fetch and decode the sound file once
        const resp = await fetch(SOUND_FILE);
        const arrayBuf = await resp.arrayBuffer();
        _audioBuffer = await ctx.decodeAudioData(arrayBuf);
    } catch (_) { }
}

function playNotifSound() {
    try {
        if (!_audioBuffer) return;
        const ctx = getAudioCtx();
        const src = ctx.createBufferSource();
        src.buffer = _audioBuffer;
        src.connect(ctx.destination);
        src.start(0);
    } catch (_) { }
}

export default function NotificationBell() {
    const { user, isAdmin } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unread, setUnread] = useState(0);
    const [open, setOpen] = useState(false);
    const [toast, setToast] = useState(null);
    const dropdownRef = useRef(null);
    const toastTimerRef = useRef(null);

    if (!isAdmin()) return null;

    // Unlock audio on first user interaction anywhere on the page
    useEffect(() => {
        const unlock = () => unlockAndLoadAudio();
        window.addEventListener('click', unlock, { once: true });
        window.addEventListener('touchstart', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
        return () => {
            window.removeEventListener('click', unlock);
            window.removeEventListener('touchstart', unlock);
            window.removeEventListener('keydown', unlock);
        };
    }, []);


    const showToast = useCallback((notif) => {
        playNotifSound();
        setToast({ title: notif.title, body: notif.body });
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), 6000);
        setUnread(u => u + 1);
        setNotifications(prev => [notif, ...prev.slice(0, 49)]);
    }, []);

    // Load initial notifications
    useEffect(() => {
        notificationsApi.getAll({}).then(res => {
            setNotifications(res.data || []);
            setUnread(res.unread_count || 0);
        }).catch(() => { });
    }, []);

    // SSE real-time connection
    useEffect(() => {
        if (!user?.store_id) return;
        let es;
        let retryTimer;
        const token = localStorage.getItem('token');
        const connect = () => {
            // API_BASE already contains /api, e.g. https://capylumi.shop/api
            const url = `${API_BASE}/notifications/stream?token=${encodeURIComponent(token || '')}`;
            es = new EventSource(url);

            es.addEventListener('connected', () => {
                console.log('[SSE] connected to notification stream');
            });

            es.addEventListener('new_order', (e) => {
                try {
                    const notif = JSON.parse(e.data);
                    showToast(notif);
                } catch (_) { }
            });

            es.onerror = () => {
                es.close();
                // Retry after 5s
                retryTimer = setTimeout(connect, 5000);
            };
        };

        connect();
        return () => {
            es?.close();
            clearTimeout(retryTimer);
        };
    }, [user?.store_id, showToast]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleMarkRead = async (id) => {
        await notificationsApi.markRead(id);
        setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
        setUnread(u => Math.max(0, u - 1));
    };

    const handleMarkAll = async () => {
        await notificationsApi.markAllRead();
        setNotifications(n => n.map(x => ({ ...x, is_read: true })));
        setUnread(0);
    };

    const fmtTime = (ts) => {
        const d = new Date(ts);
        const diff = Math.floor((Date.now() - d) / 60000);
        if (diff < 1) return 'Vừa xong';
        if (diff < 60) return `${diff} phút trước`;
        if (diff < 1440) return `${Math.floor(diff / 60)} giờ trước`;
        return d.toLocaleDateString('vi-VN');
    };

    return (
        <>
            {/* Toast popup — fixed top-right, always above everything */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    top: 16,
                    right: 16,
                    zIndex: 99999,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderLeft: '4px solid #6366f1',
                    borderRadius: 12,
                    padding: '14px 16px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                    maxWidth: 340,
                    width: 'calc(100vw - 32px)',
                    animation: 'slideDown .25s ease',
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ fontSize: 22, flexShrink: 0 }}>🔔</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3 }}>
                                {toast.title}
                            </div>
                            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                                {toast.body}
                            </div>
                        </div>
                        <button
                            onClick={() => setToast(null)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, flexShrink: 0, marginTop: 2 }}
                        >
                            <X size={15} />
                        </button>
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: 2, background: '#6366f1', borderRadius: 2, marginTop: 10, animation: 'shrink 6s linear forwards' }} />
                </div>
            )}

            {/* Bell button + dropdown */}
            <div ref={dropdownRef} style={{ position: 'relative' }}>
                <button
                    onClick={() => setOpen(o => !o)}
                    className="notif-bell-btn"
                    title="Thông báo"
                >
                    <Bell size={20} />
                    {unread > 0 && (
                        <span className="notif-badge">
                            {unread > 9 ? '9+' : unread}
                        </span>
                    )}
                </button>

                {open && (
                    <div className="notif-dropdown">
                        {/* Header */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '14px 16px 10px', borderBottom: '1px solid var(--border)',
                        }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                                🔔 Thông báo {unread > 0 && <span style={{ color: '#6366f1', fontSize: 12 }}>({unread} mới)</span>}
                            </div>
                            {unread > 0 && (
                                <button onClick={handleMarkAll}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <CheckCheck size={14} /> Đọc tất cả
                                </button>
                            )}
                        </div>

                        {/* List */}
                        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                            {notifications.length === 0 ? (
                                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                                    <Bell size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
                                    Chưa có thông báo
                                </div>
                            ) : notifications.map(n => (
                                <div key={n.id}
                                    onClick={() => !n.is_read && handleMarkRead(n.id)}
                                    style={{
                                        padding: '12px 16px',
                                        borderBottom: '1px solid var(--border-light)',
                                        background: n.is_read ? 'transparent' : 'rgba(99,102,241,0.05)',
                                        cursor: n.is_read ? 'default' : 'pointer',
                                        borderLeft: n.is_read ? '3px solid transparent' : '3px solid #6366f1',
                                        transition: 'background .15s',
                                    }}
                                >
                                    <div style={{ fontWeight: n.is_read ? 400 : 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 3 }}>
                                        {n.title}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                        {n.body}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                                        <span>{fmtTime(n.created_at)}</span>
                                        {!n.is_read && <span style={{ color: '#6366f1', fontWeight: 600 }}>● Mới</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
