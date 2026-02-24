'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HospitalAdminLogin() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setError('');
        if (!email || !password) {
            setError('Please enter your email and password.');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Login failed');
                setLoading(false);
                return;
            }
            router.push('/dashboard');
        } catch {
            setError('Network error. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-900)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
        }}>

            <div className="fade-in" style={{ width: '100%', maxWidth: 420, padding: '0 20px' }}>
                {/* Brand */}
                <div style={{ textAlign: 'center', marginBottom: 36 }}>
                    <div style={{
                        width: 52, height: 52,
                        background: 'var(--helix-primary)',
                        borderRadius: 14,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px',
                        boxShadow: '0 2px 8px rgba(30,58,95,0.18)',
                    }}>
                        <span className="material-icons-round" style={{ fontSize: 26, color: '#fff' }}>local_hospital</span>
                    </div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                        Helix
                    </h1>
                    <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, letterSpacing: '0.02em' }}>Clinical Workflow OS</p>
                </div>

                {/* Card */}
                <div style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '32px 28px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)',
                }}>
                    <h2 style={{ fontSize: '1.3rem', marginBottom: 4 }}>Admin Portal</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28 }}>
                        Sign in to manage hospital configurations.
                    </p>

                    {error && (
                        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--critical-bg)', border: '1px solid rgba(140,90,94,0.2)', marginBottom: 16, fontSize: 13, color: 'var(--critical)', fontWeight: 500 }}>
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label className="label">Email Address</label>
                            <div style={{ position: 'relative' }}>
                                <span className="material-icons-round" style={{
                                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                                    fontSize: 16, color: 'var(--text-muted)',
                                }}>mail</span>
                                <input
                                    id="email"
                                    className="input"
                                    type="email"
                                    placeholder="admin@accramedical.com.gh"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                                    style={{ paddingLeft: 36 }}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="label">Password</label>
                            <div style={{ position: 'relative' }}>
                                <span className="material-icons-round" style={{
                                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                                    fontSize: 16, color: 'var(--text-muted)',
                                }}>lock</span>
                                <input
                                    id="password"
                                    className="input"
                                    type="password"
                                    placeholder="••••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                                    style={{ paddingLeft: 36 }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 0', fontSize: 12 }}>
                                Recovery?
                            </button>
                        </div>

                        <button
                            id="sign-in-btn"
                            className="btn btn-primary"
                            style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14, marginTop: 4, opacity: loading ? 0.7 : 1 }}
                            onClick={handleLogin}
                            disabled={loading}
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                            {!loading && <span className="material-icons-round" style={{ fontSize: 16 }}>arrow_forward</span>}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 24 }}>
                    {[
                        { icon: 'help', label: 'Help Desk' },
                        { icon: 'policy', label: 'Privacy Policy' },
                    ].map(item => (
                        <button key={item.label} className="btn btn-ghost btn-xs" style={{ color: 'var(--text-muted)' }}>
                            <span className="material-icons-round" style={{ fontSize: 14 }}>{item.icon}</span>
                            {item.label}
                        </button>
                    ))}
                </div>
                <p style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--text-disabled)', marginTop: 12 }}>
                    &copy; {new Date().getFullYear()} Blvcksapphire Company Ltd
                </p>
            </div>
        </div>
    );
}
