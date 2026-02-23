'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'login' | '2fa';

export default function HospitalAdminLogin() {
    const router = useRouter();
    const [step, setStep] = useState<Step>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);

    const handleOtpChange = (index: number, value: string) => {
        if (value.length > 1) return;
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        if (value && index < 5) {
            const next = document.getElementById(`otp-${index + 1}`);
            next?.focus();
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
                    {step === 'login' ? (
                        <>
                            <h2 style={{ fontSize: '1.3rem', marginBottom: 4 }}>Admin Portal</h2>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28 }}>
                                Sign in to manage hospital configurations.
                            </p>

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
                                            placeholder="admin@kbth.gov.gh"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
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
                                    style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14, marginTop: 4 }}
                                    onClick={() => setStep('2fa')}
                                >
                                    Sign In
                                    <span className="material-icons-round" style={{ fontSize: 16 }}>arrow_forward</span>
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <button className="btn btn-ghost btn-xs" onClick={() => setStep('login')} style={{ padding: '4px 6px' }}>
                                    <span className="material-icons-round" style={{ fontSize: 16 }}>arrow_back</span>
                                </button>
                                <h2 style={{ fontSize: '1.3rem' }}>Verify Identity</h2>
                            </div>

                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28 }}>
                                Enter the 6-digit code sent to your secure device ending in{' '}
                                <strong style={{ color: 'var(--text-secondary)' }}>...8834</strong>
                            </p>

                            {/* OTP Input */}
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
                                {otp.map((digit, i) => (
                                    <input
                                        key={i}
                                        id={`otp-${i}`}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={e => handleOtpChange(i, e.target.value)}
                                        style={{
                                            width: 52, height: 56,
                                            textAlign: 'center',
                                            fontSize: 22,
                                            fontWeight: 700,
                                            fontFamily: 'JetBrains Mono, monospace',
                                            background: 'var(--surface-3)',
                                            border: `1px solid ${digit ? 'var(--helix-primary)' : 'var(--border-default)'}`,
                                            borderRadius: 10,
                                            color: 'var(--text-primary)',
                                            outline: 'none',
                                            transition: 'all 0.15s',
                                        }}
                                    />
                                ))}
                            </div>

                            <button id="verify-btn" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14 }} onClick={() => router.push('/live-coverage')}>
                                <span className="material-icons-round" style={{ fontSize: 16 }}>verified_user</span>
                                Verify & Continue
                            </button>

                            <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>
                                Resend Code
                            </button>
                        </>
                    )}
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
                <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-disabled)', marginTop: 12 }}>
                    Protected System • v4.2.0 • Ghana Health Service Compliant
                </p>
            </div>
        </div>
    );
}
