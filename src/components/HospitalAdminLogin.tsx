'use client';

import Link from 'next/link';
import { useState, useRef, useCallback, useEffect, useLayoutEffect, type CSSProperties, type FocusEvent } from 'react';
import { useRouter } from 'next/navigation';
import { API_ENDPOINTS } from '@/lib/config';
import { warmRolesPageCache } from '@/lib/rolesAdminCache';
import { MacVibrancyToast, MacVibrancyToastPortal } from '@/components/MacVibrancyToast';

/** Helix hospital admin web sign-in — facility code, work email, password, then email OTP. */
const C_LEFT_BG = '#0B1E3B';
const C_ACCENT = '#7FB2F0';
/** Form column — soft blue-grey canvas (reference). */
const C_RIGHT_BG = '#E8EDF4';
const C_MUTED_LABEL = '#7A8A9E';
const C_BODY_MUTED = '#5C6B7E';
const C_INPUT_BORDER = '#D4DCE8';
const C_PILL_BG = '#E4ECF6';
const C_PILL_BORDER = '#C8D4E4';

const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: C_MUTED_LABEL,
    marginBottom: 4,
};
const inputBase: CSSProperties = {
    width: '100%',
    height: 40,
    paddingLeft: 38,
    paddingRight: 12,
    borderRadius: 8,
    border: `1px solid ${C_INPUT_BORDER}`,
    fontSize: 14,
    background: '#fff',
    color: C_LEFT_BG,
    outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
};
const inputWithIcon: CSSProperties = { ...inputBase };
const inputWithIconAndToggle: CSSProperties = { ...inputBase, paddingRight: 40 };

const inputFocusHandlers = {
    onFocus: (e: FocusEvent<HTMLInputElement>) => {
        e.target.style.boxShadow = '0 0 0 3px rgba(11,30,59,0.14)';
    },
    onBlur: (e: FocusEvent<HTMLInputElement>) => {
        e.target.style.boxShadow = 'none';
    },
} as const;

const ghostBtnSm: CSSProperties = {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
};

const ghostBtnXs: CSSProperties = {
    ...ghostBtnSm,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
};

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
            setError('Enter the work email and password for your Helix admin account.');
            showToast('Enter your work email and password.', 'error');
            return;
        }
        if (!code) {
            setError('Enter your facility’s Helix code (same code your organization uses in Helix).');
            showToast('Enter your facility’s Helix code.', 'error');
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
                setError(data.message || 'Could not sign you in. Check your facility code, email, and password.');
                showToast(data.message || 'Could not sign you in.', 'error');
                setLoading(false);
                return;
            }
            // OTP sent to email, move to OTP verification step
            setSessionEmail(email);
            setSessionFacilityCode(code);
            setStep('otp');
            setOtpDigits(['', '', '', '', '', '']);
            setResendTimer(60);
            showToast('Verification code sent to your email.', 'success');
            setTimeout(() => otpRefs.current[0]?.focus(), 100);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Could not reach Helix. Check your connection and try again.';
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
                showToast('A new verification code was sent to your email.', 'success');
                setTimeout(() => otpRefs.current[0]?.focus(), 100);
            } else {
                showToast('Could not resend the code. Try again in a moment.', 'error');
            }
        } catch {
            showToast('Could not reach Helix.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        setError('');
        const code = otpDigits.join('');
        if (!code || code.length !== 6) {
            setError('Enter all 6 digits from the email Helix sent you.');
            showToast('Enter the full 6-digit code.', 'error');
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
                setError('Helix returned an unexpected response. Please try again.');
                showToast('Something went wrong. Try again.', 'error');
                setLoading(false);
                return;
            }
            if (!res.ok) {
                setError(data.message || 'That code did not work. Check the email and try again, or resend a new code.');
                showToast(data.message || 'Code could not be verified.', 'error');
                setLoading(false);
                return;
            }
            showToast('Signed in to Helix.', 'success');
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
            const errMsg = err instanceof Error ? err.message : 'Could not reach Helix. Check your connection and try again.';
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

    const leftPanelSurface: CSSProperties = {
        position: 'relative' as const,
        minWidth: 0,
        background: C_LEFT_BG,
        overflow: 'hidden',
    };

    const shellRootStyle: CSSProperties = {
        position: 'relative' as const,
        height: '100dvh',
        maxHeight: '100dvh',
        width: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#F0F2F5',
    };

    const asideStyle: CSSProperties = {
        ...leftPanelSurface,
        display: 'flex',
        minHeight: 160,
        width: '100%',
        minWidth: 0,
        maxHeight: '30vh',
        flex: '0 0 auto',
        flexDirection: 'column',
        justifyContent: 'space-between',
    };

    const rightColumnStyle: CSSProperties = {
        display: 'flex',
        height: '100%',
        minHeight: 0,
        width: '100%',
        minWidth: 0,
        flex: 1,
        flexDirection: 'column',
        overflow: 'hidden',
        background: C_RIGHT_BG,
    };

    const formScrollStyle: CSSProperties = {
        display: 'flex',
        minHeight: 0,
        width: '100%',
        minWidth: 0,
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflowX: 'hidden',
        overflowY: 'hidden',
        overscrollBehavior: 'none',
        padding: '24px 40px',
    };

    const formInnerStyle: CSSProperties = {
        display: 'flex',
        width: '100%',
        minWidth: 0,
        maxWidth: 'min(100%, 26rem)',
        flexShrink: 0,
        flexDirection: 'column',
        alignItems: 'stretch',
        paddingLeft: 16,
        paddingRight: 16,
        paddingBottom: 4,
    };

    const leftContentStyle: CSSProperties = {
        position: 'relative' as const,
        zIndex: 1,
        minHeight: 0,
        maxHeight: '100%',
        flex: 1,
        overflow: 'hidden',
        paddingTop: 32,
        paddingLeft: 24,
        paddingRight: 24,
        paddingBottom: 0,
    };

    const leftFooterStyle: CSSProperties = {
        position: 'relative' as const,
        zIndex: 1,
        flexShrink: 0,
        padding: '20px 24px 40px',
        fontSize: 12,
        lineHeight: 1.55,
        color: 'rgba(255,255,255,0.72)',
        margin: 0,
        textShadow: '0 1px 1px rgba(0,0,0,0.25)',
    };

    return (
        <>
            <style>
                {`
@media (min-width: 768px) {
  .admin-login-shell { flex-direction: row !important; }
  .admin-login-aside {
    max-height: none !important;
    height: 100% !important;
    min-height: 0 !important;
    width: 40% !important;
    max-width: 28rem !important;
    flex: 0 0 40% !important;
  }
  .admin-login-left-content { padding-top: 48px !important; padding-left: 40px !important; padding-right: 40px !important; }
  .admin-login-left-footer { padding-left: 40px !important; padding-right: 40px !important; padding-bottom: 40px !important; }
}
@media (min-width: 1024px) {
  .admin-login-aside { max-width: none !important; }
}
`}
            </style>
        <div className="fade-in admin-login-shell" style={shellRootStyle}>
            {/* — Left: brand & narrative (dark) — slow gradient motion — */}
            <aside className="admin-login-aside" style={asideStyle}>
                <div
                    aria-hidden
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `
              repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(255,255,255,0.035) 21px),
              repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(255,255,255,0.035) 21px)
            `,
                        pointerEvents: 'none' as const,
                    }}
                />
                <div className="admin-login-aurora-mesh" aria-hidden />
                <div className="admin-login-aurora-1" aria-hidden />
                <div className="admin-login-aurora-2" aria-hidden />
                <div className="admin-login-left-content" style={leftContentStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
                        <div
                            style={{
                                width: 38,
                                height: 38,
                                borderRadius: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(0,0,0,0.2)',
                                boxShadow: '0 1px 0 rgba(255,255,255,0.15) inset',
                                overflow: 'hidden',
                            }}
                        >
                            <img
                                src="/brand-logo.svg"
                                alt=""
                                width={32}
                                height={32}
                                style={{ width: 28, height: 28, objectFit: 'contain' }}
                            />
                        </div>
                        <span
                            style={{
                                fontSize: 11,
                                fontWeight: 600,
                                letterSpacing: '0.16em',
                                color: 'rgba(255,255,255,0.78)',
                                textShadow: '0 1px 1px rgba(0,0,0,0.2)',
                            }}
                        >
                            HOSPITAL ADMIN
                        </span>
                    </div>
                    <h1
                        style={{
                            fontSize: 'clamp(1.35rem, 2.8vw, 1.75rem)',
                            fontWeight: 800,
                            lineHeight: 1.12,
                            color: '#fff',
                            margin: 0,
                            letterSpacing: '-0.02em',
                            textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                        }}
                    >
                        Helix
                    </h1>
                    <p
                        style={{
                            margin: '10px 0 0',
                            fontSize: 'clamp(1.2rem, 2.4vw, 1.55rem)',
                            fontWeight: 800,
                            lineHeight: 1.15,
                            letterSpacing: '-0.02em',
                            color: C_ACCENT,
                            textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }}
                    >
                        Facility Administration
                    </p>
                    <p
                        style={{
                            marginTop: 28,
                            fontSize: 13,
                            lineHeight: 1.65,
                            color: '#c5d0e3',
                            maxWidth: 400,
                            textShadow: '0 1px 1px rgba(0,0,0,0.2)',
                        }}
                    >
                        For facility and hospital staff who manage Helix on the web. Sign in with your work email and
                        password; Helix will email you a one-time code to confirm it’s you.
                    </p>
                </div>
                <p className="admin-login-left-footer" style={leftFooterStyle}>
                    This is not the patient app or ward staff mobile sign-in.
                </p>
            </aside>

            {/* — Right: centered product form (reference) — */}
            <div style={rightColumnStyle}>
                <div style={formScrollStyle} data-admin-login-scroll>
                    <div style={formInnerStyle}>
                        <header style={{ textAlign: 'center', marginBottom: 22 }}>
                            <p
                                style={{
                                    fontSize: 9,
                                    fontWeight: 600,
                                    letterSpacing: '0.14em',
                                    color: C_MUTED_LABEL,
                                    margin: '0 0 4px',
                                }}
                            >
                                ADMIN SIGN IN
                            </p>
                            <h2
                                style={{
                                    fontSize: 'clamp(1.1rem, 2.8vw + 0.5rem, 1.5rem)',
                                    fontWeight: 800,
                                    color: C_LEFT_BG,
                                    margin: 0,
                                    letterSpacing: '-0.03em',
                                    lineHeight: 1.2,
                                }}
                            >
                                Helix Facility Administration
                            </h2>
                        </header>

                        {/* Card */}
                        <div
                            style={{
                                background: '#fff',
                                border: '1px solid rgba(11, 30, 59, 0.06)',
                                borderRadius: 12,
                                padding: '22px 20px 20px',
                                boxShadow: '0 8px 28px rgba(11, 30, 59, 0.06), 0 1px 4px rgba(11, 30, 59, 0.04)',
                            }}
                        >
                            {sessionFacilityCode && step === 'otp' && (
                                <div
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '4px 10px 4px 6px',
                                        borderRadius: 999,
                                        background: C_PILL_BG,
                                        border: `1px solid ${C_PILL_BORDER}`,
                                        fontSize: 11,
                                        color: C_LEFT_BG,
                                        fontWeight: 600,
                                        marginBottom: 10,
                                    }}
                                >
                                    <span className="material-icons-round" style={{ fontSize: 15 }}>tag</span>
                                    Facility · {sessionFacilityCode}
                                </div>
                            )}
                            {step === 'credentials' && (
                                <>
                                    <div
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            marginBottom: 10,
                                            padding: '5px 10px',
                                            borderRadius: 999,
                                            background: C_PILL_BG,
                                            border: `1px solid ${C_PILL_BORDER}`,
                                        }}
                                    >
                                        <span className="material-icons-round" style={{ fontSize: 15, color: C_LEFT_BG }}>lock</span>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: C_LEFT_BG, letterSpacing: '0.01em' }}>
                                            Facility code & Helix password
                                        </span>
                                    </div>
                                    <p
                                        style={{
                                            fontSize: 12,
                                            color: C_BODY_MUTED,
                                            margin: '0 0 16px',
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        Use your facility’s Helix code and the admin email and password your organization gave you. Helix will email you a short code to finish signing in.
                                    </p>
                                </>
                            )}

                            {error && (
                                <div
                                    style={{
                                        padding: '8px 10px',
                                        borderRadius: 8,
                                        background: 'var(--critical-bg)',
                                        border: '1px solid rgba(140,90,94,0.2)',
                                        marginBottom: 10,
                                        fontSize: 12,
                                        color: 'var(--critical)',
                                        fontWeight: 500,
                                        lineHeight: 1.4,
                                    }}
                                >
                                    {error}
                                </div>
                            )}

                            {step === 'credentials' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label htmlFor="facility-code" style={labelStyle}>Facility Helix code</label>
                                <div style={{ position: 'relative' }}>
                                    <span
                                        className="material-icons-round"
                                        style={{
                                            position: 'absolute',
                                            left: 10,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            fontSize: 17,
                                            color: C_MUTED_LABEL,
                                        }}
                                    >
                                        apartment
                                    </span>
                                    <input
                                        id="facility-code"
                                        type="text"
                                        value={facilityCode}
                                        onChange={e => setFacilityCode(normalizeFacilityCode(e.target.value))}
                                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                                        {...inputFocusHandlers}
                                        style={{
                                            ...inputWithIcon,
                                            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                                            letterSpacing: '0.06em',
                                        }}
                                        autoComplete="off"
                                        spellCheck={false}
                                        maxLength={32}
                                    />
                                </div>
                                <p style={{ fontSize: 10, color: C_MUTED_LABEL, marginTop: 3, marginBottom: 0, lineHeight: 1.3 }}>Letters and numbers only. Shown in capitals.</p>
                            </div>
                            <div>
                                <label htmlFor="email" style={labelStyle}>Work email</label>
                                <div style={{ position: 'relative' }}>
                                    <span
                                        className="material-icons-round"
                                        style={{
                                            position: 'absolute',
                                            left: 10,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            fontSize: 17,
                                            color: C_MUTED_LABEL,
                                        }}
                                    >
                                        mail
                                    </span>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                                        {...inputFocusHandlers}
                                        style={inputWithIcon}
                                    />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="password" style={labelStyle}>Helix password</label>
                                <div style={{ position: 'relative' }}>
                                    <span
                                        className="material-icons-round"
                                        style={{
                                            position: 'absolute',
                                            left: 10,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            fontSize: 17,
                                            color: C_MUTED_LABEL,
                                        }}
                                    >
                                        vpn_key
                                    </span>
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                                        {...inputFocusHandlers}
                                        style={inputWithIconAndToggle}
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
                                            color: C_MUTED_LABEL,
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

                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: -4 }}>
                                <Link
                                    href={email.trim() ? `/forgot-password?email=${encodeURIComponent(email.trim())}` : '/forgot-password'}
                                    style={{
                                        ...ghostBtnSm,
                                        padding: '2px 0',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: '#1d4ed8',
                                        textDecoration: 'none',
                                    }}
                                >
                                    Forgot password?
                                </Link>
                            </div>

                            <button
                                id="sign-in-btn"
                                type="button"
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                    marginTop: 2,
                                    padding: '10px 14px',
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: '#fff',
                                    background: C_LEFT_BG,
                                    border: 'none',
                                    borderRadius: 8,
                                    cursor: loading ? 'wait' : 'pointer',
                                    opacity: loading ? 0.85 : 1,
                                    boxShadow: '0 2px 10px rgba(11, 30, 59, 0.22)',
                                }}
                                onClick={handleLogin}
                                disabled={loading}
                            >
                                {loading ? 'Signing in…' : 'Continue to Helix'}
                                {!loading && <span className="material-icons-round" style={{ fontSize: 18 }}>arrow_forward</span>}
                            </button>
                        </div>
                    ) : (
                        // OTP Verification Step
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', paddingTop: 0 }}>
                            <div
                                style={{
                                width: 44,
                                height: 44,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, rgba(11,30,59,0.08), rgba(11,30,59,0.14))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                }}
                            >
                                <span className="material-icons-round" style={{ fontSize: 22, color: C_LEFT_BG }}>verified_user</span>
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: C_LEFT_BG, marginBottom: 2 }}>Check your email</div>
                                <div style={{ fontSize: 11, color: C_BODY_MUTED, lineHeight: 1.35 }}>
                                    Enter the 6-digit code Helix sent to<br />
                                    <strong style={{ color: '#334155' }}>{sessionEmail}</strong>
                                </div>
                            </div>

                            {/* 6 digit boxes — compact */}
                            <div
                                style={{
                                    display: 'flex',
                                    width: '100%',
                                    maxWidth: '100%',
                                    flexWrap: 'wrap',
                                    justifyContent: 'center',
                                    gap: 6,
                                }}
                            >
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
                                            width: 34,
                                            minWidth: 34,
                                            height: 40,
                                            flex: '0 0 auto',
                                            textAlign: 'center',
                                            fontSize: 18,
                                            fontWeight: 700,
                                            letterSpacing: 0,
                                            borderRadius: 8,
                                            border: `1.5px solid ${digit ? C_LEFT_BG : '#e2e8f0'}`,
                                            background: digit ? 'rgba(11,30,59,0.04)' : '#fff',
                                            color: C_LEFT_BG,
                                            outline: 'none',
                                            transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
                                            caretColor: C_LEFT_BG,
                                            fontFamily: "'Montserrat', sans-serif",
                                        }}
                                        onBlur={e => { e.target.style.boxShadow = 'none'; }}
                                    />
                                ))}
                            </div>

                            {/* Filled indicator dots */}
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: -4 }}>
                                {otpDigits.map((d, i) => (
                                    <div
                                        key={i}
                                        style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background: d ? C_LEFT_BG : '#e2e8f0',
                                        transition: 'background 0.15s',
                                        }}
                                    />
                                ))}
                            </div>

                            <button
                                id="verify-otp-btn"
                                type="button"
                                style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                padding: '10px 12px',
                                fontSize: 13,
                                fontWeight: 600,
                                color: '#fff',
                                background: C_LEFT_BG,
                                border: 'none',
                                borderRadius: 8,
                                cursor: loading || otp.length !== 6 ? 'not-allowed' : 'pointer',
                                opacity: loading || otp.length !== 6 ? 0.5 : 1,
                                transition: 'opacity 0.15s',
                                boxShadow: '0 2px 8px rgba(11, 30, 59, 0.2)',
                                }}
                                onClick={handleVerifyOtp}
                                disabled={loading || otp.length !== 6}
                            >
                                {loading ? (
                                    <>Signing you in…</>
                                ) : (
                                    <>Continue to Helix <span className="material-icons-round" style={{ fontSize: 16 }}>arrow_forward</span></>
                                )}
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', marginTop: -2 }}>
                                <button
                                    type="button"
                                    style={{ ...ghostBtnSm, fontSize: 13, color: C_BODY_MUTED, padding: '4px 0', fontWeight: 500 }}
                                    onClick={handleBackToCredentials}
                                    disabled={loading}
                                >
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_back</span>
                                    Edit sign-in details
                                </button>

                                <div style={{ width: 1, height: 14, background: 'var(--border-default)' }} />

                                <button
                                    type="button"
                                    style={{
                                        ...ghostBtnSm,
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: resendTimer > 0 ? C_MUTED_LABEL : '#1d4ed8',
                                        padding: '4px 0',
                                    }}
                                    onClick={handleResendOtp}
                                    disabled={loading || resendTimer > 0}
                                >
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>refresh</span>
                                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Send new code'}
                                </button>
                            </div>
                        </div>
                    )}
                        </div>

                        <footer style={{ marginTop: 22, textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap' as const, justifyContent: 'center', gap: 20, marginBottom: 8 }}>
                                {[
                                    { icon: 'help', label: 'Help & support' },
                                    { icon: 'policy', label: 'Privacy' },
                                ].map(item => (
                                    <button
                                        key={item.label}
                                        type="button"
                                        style={{ ...ghostBtnXs, color: C_BODY_MUTED, fontWeight: 500, fontSize: 12 }}
                                    >
                                        <span className="material-icons-round" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 3 }}>{item.icon}</span>
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </footer>
                    </div>
                </div>
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
        </>
    );
}
