'use client';

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { API_ENDPOINTS } from '@/lib/config';
import { MacVibrancyToast, MacVibrancyToastPortal } from '@/components/MacVibrancyToast';

const surfaceStyle: CSSProperties = {
    width: '100%',
    maxWidth: 420,
    background: '#fff',
    border: '1px solid #d7deea',
    borderRadius: 12,
    boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
    padding: 22,
};

export default function InternalAdminLogin() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 2800);
    };

    const handleLogin = async () => {
        setError('');
        if (!email.trim() || !password) {
            const msg = 'Enter internal admin email and password.';
            setError(msg);
            showToast(msg, 'error');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(API_ENDPOINTS.INTERNAL_LOGIN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password }),
                credentials: 'include',
            });
            const data = await res.json().catch(() => ({} as Record<string, unknown>));
            if (!res.ok) {
                const msg = String(data.error || data.message || 'Internal admin login failed');
                setError(msg);
                showToast(msg, 'error');
                return;
            }
            showToast('Signed in to internal admin portal.', 'success');
            if (typeof window !== 'undefined') {
                window.location.assign('/internal/dashboard');
            } else {
                router.replace('/internal/dashboard');
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Network error';
            setError(msg);
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast.message} variant={toast.type} dismissible={false} />
                </MacVibrancyToastPortal>
            )}
            <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '260px 1fr', background: '#eef2f7' }}>
                <aside style={{ background: 'linear-gradient(180deg, #091a36, #0f2a4f)', color: '#e6efff', padding: '26px 22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                        <img src="/brand-logo.svg" alt="Brand" width={22} height={22} />
                        <span style={{ fontSize: 10, letterSpacing: '0.2em', opacity: 0.8 }}>PLATFORM</span>
                    </div>
                    <h1 style={{ fontSize: 34, lineHeight: 1.05, fontWeight: 700, marginBottom: 10 }}>Helix Internal Admin</h1>
                    <p style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.9 }}>
                        Internal-only environment for support and platform operations.
                    </p>
                </aside>

                <main style={{ display: 'grid', placeItems: 'center', padding: 28 }}>
                    <div style={surfaceStyle}>
                        <div style={{ fontSize: 10, letterSpacing: '0.14em', color: '#76839b', marginBottom: 4 }}>SIGN IN</div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Internal admin access</h2>
                        <div style={{ fontSize: 11, padding: '5px 10px', borderRadius: 999, border: '1px solid #d6deea', background: '#f5f8fd', color: '#5f6d83', width: 'fit-content', marginBottom: 14 }}>
                            Password only · no OTP
                        </div>

                        <div style={{ marginBottom: 10 }}>
                            <label style={{ display: 'block', fontSize: 10, color: '#7a859a', letterSpacing: '0.12em', marginBottom: 4 }}>EMAIL</label>
                            <input
                                className="input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="internal-admin@helixhealth.app"
                                style={{ fontSize: 13 }}
                            />
                        </div>
                        <div style={{ marginBottom: 10 }}>
                            <label style={{ display: 'block', fontSize: 10, color: '#7a859a', letterSpacing: '0.12em', marginBottom: 4 }}>PASSWORD</label>
                            <input
                                className="input"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                style={{ fontSize: 13 }}
                            />
                        </div>

                        {error && <div style={{ color: '#b91c1c', fontSize: 12, marginBottom: 10 }}>{error}</div>}
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={handleLogin}
                            disabled={loading}
                            style={{ width: '100%', justifyContent: 'center', height: 40 }}
                        >
                            {loading ? 'Signing in…' : 'Sign in to dashboard'}
                        </button>
                    </div>
                </main>
            </div>
        </>
    );
}
