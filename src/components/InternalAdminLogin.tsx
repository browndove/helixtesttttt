'use client';

import { useEffect, useRef, useState, type ClipboardEvent, type CSSProperties, type KeyboardEvent } from 'react';
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
    const [showPassword, setShowPassword] = useState(false);
    const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
    const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
    const [resendTimer, setResendTimer] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
    const otp = otpDigits.join('');

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 2800);
    };

    useEffect(() => {
        if (step !== 'otp' || resendTimer <= 0) return;
        const t = setInterval(() => {
            setResendTimer(prev => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(t);
    }, [step, resendTimer]);

    const applyOtpFromString = (raw: string, startIndex = 0) => {
        const digits = raw.replace(/\D/g, '').slice(0, 6 - startIndex);
        if (!digits.length) return;
        const copied = [...otpDigits];
        for (let i = 0; i < digits.length && startIndex + i < 6; i += 1) {
            copied[startIndex + i] = digits[i]!;
        }
        setOtpDigits(copied);
        const focusIndex = Math.min(startIndex + digits.length, 5);
        otpRefs.current[focusIndex]?.focus();
    };

    const updateOtpDigit = (index: number, next: string) => {
        if (!/^\d?$/.test(next)) return;
        const copied = [...otpDigits];
        copied[index] = next;
        setOtpDigits(copied);
        if (next && index < 5) otpRefs.current[index + 1]?.focus();
    };

    const handleOtpPaste = (index: number, e: ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        applyOtpFromString(e.clipboardData.getData('text'), index);
    };

    const handleOtpKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
            const copied = [...otpDigits];
            copied[index - 1] = '';
            setOtpDigits(copied);
            otpRefs.current[index - 1]?.focus();
        }
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
            const normalizedEmail = email.trim().toLowerCase();
            const res = await fetch(API_ENDPOINTS.INTERNAL_LOGIN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: normalizedEmail, password }),
                credentials: 'include',
            });
            const data = await res.json().catch(() => ({} as Record<string, unknown>));
            if (!res.ok) {
                const msg = String(
                    data.detail || data.error || data.message || 'Internal admin login failed'
                );
                setError(msg);
                showToast(msg, 'error');
                return;
            }
            const successMsg = String(data.message || 'Verification code sent to your email.');
            setStep('otp');
            setOtpDigits(['', '', '', '', '', '']);
            setResendTimer(60);
            showToast(successMsg, 'success');
            setTimeout(() => otpRefs.current[0]?.focus(), 80);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Network error';
            setError(msg);
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (loading || resendTimer > 0) return;
        setError('');
        setLoading(true);
        try {
            const normalizedEmail = email.trim().toLowerCase();
            const res = await fetch(API_ENDPOINTS.INTERNAL_LOGIN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: normalizedEmail, password }),
                credentials: 'include',
            });
            const data = await res.json().catch(() => ({} as Record<string, unknown>));
            if (!res.ok) {
                const msg = String(data.detail || data.error || data.message || 'Could not resend OTP');
                setError(msg);
                showToast(msg, 'error');
                return;
            }
            setOtpDigits(['', '', '', '', '', '']);
            setResendTimer(60);
            showToast('A new verification code was sent.', 'success');
            setTimeout(() => otpRefs.current[0]?.focus(), 80);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Network error';
            setError(msg);
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        setError('');
        if (otp.length !== 6) {
            const msg = 'Enter the full 6-digit OTP sent to your email.';
            setError(msg);
            showToast(msg, 'error');
            return;
        }
        setLoading(true);
        try {
            const normalizedEmail = email.trim().toLowerCase();
            const res = await fetch(API_ENDPOINTS.INTERNAL_VERIFY_OTP, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: normalizedEmail, otp }),
                credentials: 'include',
            });
            const data = await res.json().catch(() => ({} as Record<string, unknown>));
            if (!res.ok) {
                const msg = String(data.detail || data.error || data.message || 'OTP verification failed');
                setError(msg);
                showToast(msg, 'error');
                return;
            }
            showToast('Signed in to internal admin portal.', 'success');
            if (typeof window !== 'undefined') window.location.assign('/internal/dashboard');
            else router.replace('/internal/dashboard');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Network error';
            setError(msg);
            showToast(msg, 'error');
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
        <>
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast.message} variant={toast.type} dismissible={false} />
                </MacVibrancyToastPortal>
            )}
            <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '300px 1fr', background: '#eef2f7' }}>
                <aside style={{ background: 'linear-gradient(180deg, #071733, #102c55)', color: '#f5f9ff', padding: '30px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
                        <img src="/brand-logo.svg" alt="Brand" width={22} height={22} />
                        <span style={{ fontSize: 10, letterSpacing: '0.2em', color: 'rgba(231,240,255,0.92)', fontWeight: 600 }}>PLATFORM</span>
                    </div>
                    <h1 style={{ fontSize: 42, lineHeight: 1.02, fontWeight: 800, marginBottom: 12, color: '#ffffff', letterSpacing: '-0.02em', textShadow: '0 1px 1px rgba(0,0,0,0.24)' }}>
                        Helix Internal Admin
                    </h1>
                    <p style={{ fontSize: 12.5, lineHeight: 1.6, color: 'rgba(233,242,255,0.95)', maxWidth: 220, textShadow: '0 1px 1px rgba(0,0,0,0.2)' }}>
                        Internal-only environment for support and platform operations.
                    </p>
                </aside>

                <main style={{ display: 'grid', placeItems: 'center', padding: 28 }}>
                    <div style={surfaceStyle}>
                        <div style={{ fontSize: 10, letterSpacing: '0.14em', color: '#76839b', marginBottom: 4 }}>SIGN IN</div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Internal admin access</h2>
                        <div style={{ fontSize: 11, padding: '5px 10px', borderRadius: 999, border: '1px solid #d6deea', background: '#f5f8fd', color: '#5f6d83', width: 'fit-content', marginBottom: 14 }}>
                            {step === 'credentials' ? 'Password + email OTP' : 'Enter email OTP'}
                        </div>

                        {step === 'credentials' ? (
                            <>
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
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            className="input"
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Enter password"
                                            autoComplete="current-password"
                                            style={{ fontSize: 13, width: '100%', boxSizing: 'border-box', paddingRight: 40 }}
                                        />
                                        <button
                                            type="button"
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            onClick={() => setShowPassword(prev => !prev)}
                                            style={{
                                                position: 'absolute',
                                                right: 10,
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                border: 'none',
                                                background: 'transparent',
                                                color: '#7a859a',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: 0,
                                            }}
                                        >
                                            <span className="material-icons-round" style={{ fontSize: 18 }}>
                                                {showPassword ? 'visibility_off' : 'visibility'}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ marginBottom: 8, fontSize: 12, color: '#52607a' }}>
                                    Enter the 6-digit code sent to <strong>{email.trim().toLowerCase()}</strong>.
                                </div>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginBottom: 10 }}>
                                    {otpDigits.map((digit, i) => (
                                        <input
                                            key={i}
                                            ref={el => { otpRefs.current[i] = el; }}
                                            className="input"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={digit}
                                            onChange={e => {
                                                const digitsOnly = e.target.value.replace(/\D/g, '');
                                                if (digitsOnly.length > 1) {
                                                    applyOtpFromString(digitsOnly, i);
                                                    return;
                                                }
                                                updateOtpDigit(i, digitsOnly.slice(-1));
                                            }}
                                            onPaste={e => handleOtpPaste(i, e)}
                                            onKeyDown={e => handleOtpKeyDown(i, e)}
                                            style={{ width: 48, textAlign: 'center', fontSize: 20, fontWeight: 700, padding: '10px 0' }}
                                        />
                                    ))}
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
                                    {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Didn’t get a code?'}
                                    <button
                                        type="button"
                                        onClick={handleResendOtp}
                                        disabled={resendTimer > 0 || loading}
                                        style={{ marginLeft: 6, border: 'none', background: 'none', color: '#1d4ed8', cursor: resendTimer > 0 ? 'default' : 'pointer', fontWeight: 600 }}
                                    >
                                        Resend OTP
                                    </button>
                                </div>
                            </>
                        )}

                        {error && <div style={{ color: '#b91c1c', fontSize: 12, marginBottom: 10 }}>{error}</div>}
                        {step === 'credentials' ? (
                            <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={handleLogin}
                                disabled={loading}
                                style={{ width: '100%', justifyContent: 'center', height: 40 }}
                            >
                                {loading ? 'Signing in…' : 'Continue to OTP'}
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={handleBackToCredentials}
                                    disabled={loading}
                                    style={{ flex: 1, justifyContent: 'center', height: 40 }}
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={handleVerifyOtp}
                                    disabled={loading || otp.length !== 6}
                                    style={{ flex: 2, justifyContent: 'center', height: 40 }}
                                >
                                    {loading ? 'Verifying…' : 'Verify OTP'}
                                </button>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </>
    );
}
