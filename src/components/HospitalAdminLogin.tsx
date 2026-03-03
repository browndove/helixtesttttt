'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_ENDPOINTS } from '@/lib/config';

export default function HospitalAdminLogin() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
    const [sessionEmail, setSessionEmail] = useState('');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [resendTimer, setResendTimer] = useState(0);
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    const otp = otpDigits.join('');

    useEffect(() => {
        if (resendTimer <= 0) return;
        const t = setTimeout(() => setResendTimer(r => r - 1), 1000);
        return () => clearTimeout(t);
    }, [resendTimer]);

    const handleOtpChange = useCallback((index: number, value: string) => {
        // Handle paste of full code
        if (value.length > 1) {
            const digits = value.replace(/\D/g, '').slice(0, 6).split('');
            const next = [...otpDigits];
            digits.forEach((d, i) => { if (index + i < 6) next[index + i] = d; });
            setOtpDigits(next);
            const focusIdx = Math.min(index + digits.length, 5);
            otpRefs.current[focusIdx]?.focus();
            return;
        }
        const digit = value.replace(/\D/g, '');
        const next = [...otpDigits];
        next[index] = digit;
        setOtpDigits(next);
        if (digit && index < 5) otpRefs.current[index + 1]?.focus();
    }, [otpDigits]);

    const handleOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
            const next = [...otpDigits];
            next[index - 1] = '';
            setOtpDigits(next);
            otpRefs.current[index - 1]?.focus();
        }
    }, [otpDigits]);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleLogin = async () => {
        setError('');
        if (!email || !password) {
            setError('Please enter your email and password.');
            showToast('Please enter your email and password.', 'error');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(API_ENDPOINTS.LOGIN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message || 'Login failed');
                showToast(data.message || 'Login failed', 'error');
                setLoading(false);
                return;
            }
            // OTP sent to email, move to OTP verification step
            setSessionEmail(email);
            setStep('otp');
            setOtpDigits(['', '', '', '', '', '']);
            setResendTimer(60);
            showToast('OTP sent to your email', 'success');
            setTimeout(() => otpRefs.current[0]?.focus(), 100);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Network error. Please try again.';
            setError(errMsg);
            showToast(errMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (resendTimer > 0) return;
        setLoading(true);
        try {
            const res = await fetch(API_ENDPOINTS.LOGIN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: sessionEmail, password }),
            });
            if (res.ok) {
                setOtpDigits(['', '', '', '', '', '']);
                setResendTimer(60);
                showToast('New OTP sent to your email', 'success');
                setTimeout(() => otpRefs.current[0]?.focus(), 100);
            } else {
                showToast('Failed to resend OTP', 'error');
            }
        } catch {
            showToast('Network error', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        setError('');
        const code = otpDigits.join('');
        if (!code || code.length !== 6) {
            setError('Please enter a valid 6-digit OTP.');
            showToast('Please enter a valid 6-digit OTP.', 'error');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(API_ENDPOINTS.VERIFY_OTP, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: sessionEmail, otp }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message || 'OTP verification failed');
                showToast(data.message || 'OTP verification failed', 'error');
                setLoading(false);
                return;
            }
            showToast('Login successful! Redirecting...', 'success');
            setTimeout(() => router.push('/dashboard'), 1500);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Network error. Please try again.';
            setError(errMsg);
            showToast(errMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleBackToCredentials = () => {
        setStep('credentials');
        setOtpDigits(['', '', '', '', '', '']);
        setError('');
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
                        {step === 'credentials' ? 'Sign in to manage hospital configurations.' : 'Enter the 6-digit code sent to your email.'}
                    </p>

                    {error && (
                        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--critical-bg)', border: '1px solid rgba(140,90,94,0.2)', marginBottom: 16, fontSize: 13, color: 'var(--critical)', fontWeight: 500 }}>
                            {error}
                        </div>
                    )}

                    {step === 'credentials' ? (
                        // Credentials Step
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
                    ) : (
                        // OTP Verification Step
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
                            {/* Shield icon */}
                            <div style={{
                                width: 56, height: 56,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, rgba(30,58,95,0.08), rgba(30,58,95,0.15))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <span className="material-icons-round" style={{ fontSize: 28, color: 'var(--helix-primary)' }}>verified_user</span>
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Two-Factor Authentication</div>
                                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                    Enter the 6-digit code sent to<br />
                                    <strong style={{ color: 'var(--text-secondary)' }}>{sessionEmail}</strong>
                                </div>
                            </div>

                            {/* 6 digit boxes */}
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                {otpDigits.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={el => { otpRefs.current[i] = el; }}
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        value={digit}
                                        onChange={e => handleOtpChange(i, e.target.value)}
                                        onKeyDown={e => handleOtpKeyDown(i, e)}
                                        onFocus={e => e.target.select()}
                                        maxLength={6}
                                        style={{
                                            width: 46, height: 52,
                                            textAlign: 'center',
                                            fontSize: 22, fontWeight: 700,
                                            letterSpacing: 0,
                                            borderRadius: 'var(--radius-md)',
                                            border: `1.5px solid ${digit ? 'var(--helix-primary)' : 'var(--border-default)'}`,
                                            background: digit ? 'rgba(30,58,95,0.03)' : 'var(--surface-card)',
                                            color: 'var(--text-primary)',
                                            outline: 'none',
                                            transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
                                            caretColor: 'var(--helix-primary)',
                                            fontFamily: "'Montserrat', sans-serif",
                                        }}
                                        onBlur={e => { e.target.style.boxShadow = 'none'; }}
                                    />
                                ))}
                            </div>

                            {/* Filled indicator dots */}
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                {otpDigits.map((d, i) => (
                                    <div key={i} style={{
                                        width: 6, height: 6, borderRadius: '50%',
                                        background: d ? 'var(--helix-primary)' : 'var(--border-default)',
                                        transition: 'background 0.15s',
                                    }} />
                                ))}
                            </div>

                            <button
                                id="verify-otp-btn"
                                className="btn btn-primary"
                                style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14, opacity: loading || otp.length !== 6 ? 0.6 : 1, transition: 'opacity 0.15s' }}
                                onClick={handleVerifyOtp}
                                disabled={loading || otp.length !== 6}
                            >
                                {loading ? (
                                    <>Verifying...</>
                                ) : (
                                    <>Verify & Continue <span className="material-icons-round" style={{ fontSize: 16 }}>arrow_forward</span></>
                                )}
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, width: '100%' }}>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}
                                    onClick={handleBackToCredentials}
                                    disabled={loading}
                                >
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_back</span>
                                    Back
                                </button>

                                <div style={{ width: 1, height: 14, background: 'var(--border-default)' }} />

                                <button
                                    className="btn btn-ghost btn-sm"
                                    style={{ fontSize: 12, color: resendTimer > 0 ? 'var(--text-disabled)' : 'var(--helix-primary)', padding: '4px 0' }}
                                    onClick={handleResendOtp}
                                    disabled={loading || resendTimer > 0}
                                >
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>refresh</span>
                                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
                                </button>
                            </div>
                        </div>
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
                <p style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--text-disabled)', marginTop: 12 }}>
                    &copy; {new Date().getFullYear()} Blvcksapphire Company Ltd
                </p>
            </div>

            {/* Toast Notification */}
            {toast && (
                <div className="toast-enter" style={{
                    position: 'fixed',
                    top: 20,
                    right: 20,
                    zIndex: 999,
                    background: 'var(--surface-card)',
                    border: `1px solid ${toast.type === 'error' ? 'var(--critical)' : 'var(--success)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: toast.type === 'error' ? 'var(--critical)' : 'var(--success)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                }}>
                    <span className="material-icons-round" style={{ fontSize: 16 }}>
                        {toast.type === 'error' ? 'error' : 'check_circle'}
                    </span>
                    {toast.message}
                </div>
            )}
        </div>
    );
}
