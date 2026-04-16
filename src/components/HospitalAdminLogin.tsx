'use client';

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_ENDPOINTS } from '@/lib/config';
import { warmRolesPageCache } from '@/lib/rolesAdminCache';
import { MacVibrancyToast, MacVibrancyToastPortal } from '@/components/MacVibrancyToast';

function normalizeFacilityCode(raw: string): string {
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export default function HospitalAdminLogin() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [facilityCode, setFacilityCode] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
    const [sessionEmail, setSessionEmail] = useState('');
    const [sessionFacilityCode, setSessionFacilityCode] = useState('');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [resendTimer, setResendTimer] = useState(0);
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    const otp = otpDigits.join('');

    useEffect(() => {
        if (resendTimer <= 0) return;
        const t = setTimeout(() => setResendTimer(r => r - 1), 1000);
        return () => clearTimeout(t);
    }, [resendTimer]);

    // Warm the post-login landing route and RSC payload as early as possible.
    useLayoutEffect(() => {
        router.prefetch('/home');
    }, [router]);

    useEffect(() => {
        if (step === 'otp') router.prefetch('/home');
    }, [router, step]);

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
        const code = normalizeFacilityCode(facilityCode);
        if (!email || !password) {
            setError('Please enter your email and password.');
            showToast('Please enter your email and password.', 'error');
            return;
        }
        if (!code) {
            setError('Please enter your facility code.');
            showToast('Please enter your facility code.', 'error');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(API_ENDPOINTS.ADMIN_LOGIN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, facility_code: code }),
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
            setSessionFacilityCode(code);
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
            const res = await fetch(API_ENDPOINTS.ADMIN_LOGIN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: sessionEmail,
                    password,
                    facility_code: sessionFacilityCode,
                }),
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
            const res = await fetch(API_ENDPOINTS.ADMIN_VERIFY_OTP, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    email: sessionEmail,
                    otp,
                    facility_code: sessionFacilityCode,
                }),
            });
            const text = await res.text();
            let data: { message?: string } = {};
            try {
                data = text ? (JSON.parse(text) as { message?: string }) : {};
            } catch {
                setError('Invalid response from server');
                showToast('Invalid response from server', 'error');
                setLoading(false);
                return;
            }
            if (!res.ok) {
                setError(data.message || 'OTP verification failed');
                showToast(data.message || 'OTP verification failed', 'error');
                setLoading(false);
                return;
            }
            showToast('Signed in', 'success');
            // Do not block navigation on extra auth calls — session cookie is set by verify-otp.
            void fetch(API_ENDPOINTS.AUTH_ME, { credentials: 'include' }).catch(() => null);
            warmRolesPageCache();
            // Full navigation so the new Set-Cookie from verify-otp is always applied (avoids soft-nav issues on some hosts).
            if (typeof window !== 'undefined') {
                window.location.assign('/home');
            } else {
                router.replace('/home');
            }
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
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                        boxShadow: '0 2px 8px rgba(30,58,95,0.18)',
                        overflow: 'hidden',
                    }}>
                        <img
                            src="/helix-logo.png"
                            alt="Helix logo"
                            width={52}
                            height={52}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
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
                    {sessionFacilityCode && step === 'otp' && (
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 10px 4px 6px',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(30,58,95,0.06)',
                            fontSize: 12,
                            color: 'var(--helix-primary)',
                            fontWeight: 600,
                            marginBottom: 12,
                        }}>
                            <span className="material-icons-round" style={{ fontSize: 14 }}>tag</span>
                            Facility {sessionFacilityCode}
                        </div>
                    )}
                    <h2 style={{ fontSize: '1.3rem', marginBottom: 4 }}>Admin Portal</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28 }}>
                        {step === 'credentials'
                            ? 'Enter your facility code, email, and password.'
                            : 'Enter the 6-digit code sent to your email.'}
                    </p>

                    {error && (
                        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--critical-bg)', border: '1px solid rgba(140,90,94,0.2)', marginBottom: 16, fontSize: 13, color: 'var(--critical)', fontWeight: 500 }}>
                            {error}
                        </div>
                    )}

                    {step === 'credentials' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label className="label">Facility code</label>
                                <div style={{ position: 'relative' }}>
                                    <span className="material-icons-round" style={{
                                        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                                        fontSize: 16, color: 'var(--text-muted)',
                                    }}>apartment</span>
                                    <input
                                        id="facility-code"
                                        className="input"
                                        type="text"
                                        placeholder="SMH"
                                        value={facilityCode}
                                        onChange={e => setFacilityCode(normalizeFacilityCode(e.target.value))}
                                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                                        style={{ paddingLeft: 36, fontFamily: 'var(--font-mono, ui-monospace, monospace)', letterSpacing: '0.06em' }}
                                        autoComplete="off"
                                        spellCheck={false}
                                        maxLength={32}
                                    />
                                </div>
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, marginBottom: 0 }}>
                                    Letters and numbers only; typed as capitals.
                                </p>
                            </div>
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
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                                        style={{ paddingLeft: 36, paddingRight: 42 }}
                                        autoComplete="current-password"
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
                                            color: 'var(--text-muted)',
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

                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                                <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 0', fontSize: 12 }}>
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

            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast
                        message={toast.message}
                        variant={toast.type === 'error' ? 'error' : 'success'}
                        dismissible={false}
                    />
                </MacVibrancyToastPortal>
            )}
        </div>
    );
}
