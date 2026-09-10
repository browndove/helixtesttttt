'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
    AdminAuthShell,
    adminAuthErrorBox,
    adminAuthInputBase,
    adminAuthInputFocusHandlers,
    adminAuthInputWithToggle,
    adminAuthLabelStyle,
    adminAuthPillStyle,
    adminAuthPrimaryBtn,
    C_BODY_MUTED,
    C_LEFT_BG,
    C_MUTED_LABEL,
} from '@/components/AdminAuthShell';
import { MacVibrancyToast, MacVibrancyToastPortal } from '@/components/MacVibrancyToast';
import { API_ENDPOINTS } from '@/lib/config';

type ResetStep = 'request' | 'otp' | 'password';

function normalizeFacilityCode(raw: string): string {
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function apiMessage(data: Record<string, unknown>, fallback: string): string {
    return String(data.message || data.error || data.detail || fallback);
}

const passwordChecksDef = (password: string) => [
    { id: 'length', label: 'At least 8 characters', met: password.length >= 8 },
    { id: 'upper', label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { id: 'lower', label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { id: 'digit', label: 'One number', met: /[0-9]/.test(password) },
    { id: 'special', label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
];

const toggleBtnStyle: CSSProperties = {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    border: 'none',
    background: 'transparent',
    color: C_MUTED_LABEL,
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
};

const inputWithIcon: CSSProperties = {
    ...adminAuthInputBase,
    paddingLeft: 38,
};

type HospitalAdminForgotPasswordProps = {
    initialEmail?: string;
    initialFacilityCode?: string;
};

export default function HospitalAdminForgotPassword({
    initialEmail = '',
    initialFacilityCode = '',
}: HospitalAdminForgotPasswordProps) {
    const router = useRouter();
    const [step, setStep] = useState<ResetStep>('request');
    const [email, setEmail] = useState(initialEmail);
    const [facilityCode, setFacilityCode] = useState(normalizeFacilityCode(initialFacilityCode));
    const [sessionEmail, setSessionEmail] = useState('');
    const [sessionFacilityCode, setSessionFacilityCode] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resendTimer, setResendTimer] = useState(0);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    const otp = otpDigits.join('');
    const passwordChecks = passwordChecksDef(password);
    const passwordIsValid = passwordChecks.every(c => c.met);
    const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

    useEffect(() => {
        if (resendTimer <= 0) return;
        const t = setTimeout(() => setResendTimer(r => r - 1), 1000);
        return () => clearTimeout(t);
    }, [resendTimer]);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3200);
    };

    const handleOtpChange = useCallback((index: number, value: string) => {
        if (value.length > 1) {
            const digits = value.replace(/\D/g, '').slice(0, 6).split('');
            const next = [...otpDigits];
            digits.forEach((d, i) => {
                if (index + i < 6) next[index + i] = d;
            });
            setOtpDigits(next);
            otpRefs.current[Math.min(index + digits.length, 5)]?.focus();
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

    const handleRequestReset = async () => {
        setError('');
        const normalized = email.trim().toLowerCase();
        const code = normalizeFacilityCode(facilityCode);
        if (!code) {
            setError('Enter your facility’s Helix code.');
            showToast('Enter your facility’s Helix code.', 'error');
            return;
        }
        if (!normalized) {
            setError('Enter your work email.');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(API_ENDPOINTS.REQUEST_RESET, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: normalized, facility_code: code }),
            });
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            if (!res.ok) {
                const msg = apiMessage(data, 'Could not send reset code.');
                setError(msg);
                showToast(msg, 'error');
                return;
            }
            setSessionEmail(normalized);
            setSessionFacilityCode(code);
            setOtpDigits(['', '', '', '', '', '']);
            setResendTimer(60);
            setStep('otp');
            showToast(String(data.message || 'If this account is registered, a reset code has been sent.'), 'success');
            setTimeout(() => otpRefs.current[0]?.focus(), 100);
        } catch {
            const msg = 'Could not reach Helix.';
            setError(msg);
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (resendTimer > 0 || !sessionEmail || !sessionFacilityCode) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch(API_ENDPOINTS.REQUEST_RESET, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: sessionEmail, facility_code: sessionFacilityCode }),
            });
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            if (!res.ok) {
                const msg = apiMessage(data, 'Could not resend the code.');
                setError(msg);
                showToast(msg, 'error');
                return;
            }
            setOtpDigits(['', '', '', '', '', '']);
            setResendTimer(60);
            showToast(String(data.message || 'A new reset code was sent.'), 'success');
            setTimeout(() => otpRefs.current[0]?.focus(), 100);
        } catch {
            showToast('Could not reach Helix.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        setError('');
        if (otp.length !== 6) {
            setError('Enter all 6 digits from the email Helix sent you.');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(API_ENDPOINTS.VERIFY_RESET_OTP, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: sessionEmail,
                    otp,
                    facility_code: sessionFacilityCode,
                }),
            });
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            if (!res.ok) {
                const msg = apiMessage(data, 'That code did not work. Try again or resend.');
                setError(msg);
                showToast(msg, 'error');
                return;
            }
            const token = String(
                data.reset_token || data.resetToken || data.token || '',
            ).trim();
            if (!token) {
                const msg = 'Reset token missing from Helix response. Try again.';
                setError(msg);
                showToast(msg, 'error');
                return;
            }
            setResetToken(token);
            setPassword('');
            setConfirmPassword('');
            setStep('password');
            showToast('Code verified. Choose a new password.', 'success');
        } catch {
            const msg = 'Could not reach Helix.';
            setError(msg);
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        setError('');
        if (!resetToken) {
            setError('Reset session expired. Request a new code.');
            return;
        }
        if (!passwordIsValid) {
            setError('Password does not meet all requirements.');
            return;
        }
        if (!passwordsMatch) {
            setError('Passwords do not match.');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(API_ENDPOINTS.RESET_PASSWORD, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: sessionEmail,
                    reset_token: resetToken,
                    new_password: password,
                    facility_code: sessionFacilityCode,
                }),
            });
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            if (!res.ok) {
                const msg = apiMessage(data, 'Could not reset password.');
                setError(msg);
                showToast(msg, 'error');
                return;
            }
            showToast(String(data.message || 'Password updated. Sign in with your new password.'), 'success');
            setTimeout(() => {
                if (typeof window !== 'undefined') window.location.assign('/login');
                else router.replace('/login');
            }, 900);
        } catch {
            const msg = 'Could not reach Helix.';
            setError(msg);
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const leftCopy =
        step === 'request'
            ? {
                  title: 'Forgot password',
                  description: 'Enter your facility Helix code and work email. We’ll send a one-time code to reset your password.',
              }
            : step === 'otp'
              ? {
                    title: 'Enter code',
                    description: 'Use the 6-digit code from your email to continue resetting your password.',
                }
              : {
                    title: 'New password',
                    description: 'Choose a new password, then sign in again with your work email.',
                };

    return (
        <>
            <AdminAuthShell
                leftAccentTitle={leftCopy.title}
                leftDescription={leftCopy.description}
                eyebrow="PASSWORD RESET"
            >
                {error && <div style={adminAuthErrorBox}>{error}</div>}

                {step === 'request' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={adminAuthPillStyle}>
                            <span className="material-icons-round" style={{ fontSize: 15, color: C_LEFT_BG }}>mail</span>
                            <span style={{ fontSize: 11, color: C_LEFT_BG, fontWeight: 600 }}>Reset via email code</span>
                        </div>
                        <div>
                            <label htmlFor="forgot-facility-code" style={adminAuthLabelStyle}>Facility Helix code</label>
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
                                        pointerEvents: 'none',
                                    }}
                                >
                                    apartment
                                </span>
                                <input
                                    id="forgot-facility-code"
                                    type="text"
                                    value={facilityCode}
                                    onChange={e => setFacilityCode(normalizeFacilityCode(e.target.value))}
                                    onKeyDown={e => e.key === 'Enter' && void handleRequestReset()}
                                    {...adminAuthInputFocusHandlers}
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
                            <p style={{ fontSize: 10, color: C_MUTED_LABEL, marginTop: 3, marginBottom: 0, lineHeight: 1.3 }}>
                                Same code you use on the sign-in page.
                            </p>
                        </div>
                        <div>
                            <label htmlFor="forgot-email" style={adminAuthLabelStyle}>Work email</label>
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
                                        pointerEvents: 'none',
                                    }}
                                >
                                    mail
                                </span>
                                <input
                                    id="forgot-email"
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && void handleRequestReset()}
                                    {...adminAuthInputFocusHandlers}
                                    style={inputWithIcon}
                                    autoComplete="email"
                                />
                            </div>
                        </div>
                        <button type="button" style={adminAuthPrimaryBtn(loading)} onClick={() => void handleRequestReset()} disabled={loading}>
                            {loading ? 'Sending…' : 'Send reset code'}
                        </button>
                    </div>
                )}

                {step === 'otp' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                        <div style={adminAuthPillStyle}>
                            <span className="material-icons-round" style={{ fontSize: 15, color: C_LEFT_BG }}>mark_email_read</span>
                            <span style={{ fontSize: 11, color: C_LEFT_BG, fontWeight: 600 }}>Check your email</span>
                        </div>
                        <p style={{ fontSize: 13, color: C_BODY_MUTED, lineHeight: 1.55, margin: 0, textAlign: 'center' }}>
                            If an account exists for <strong style={{ color: C_LEFT_BG }}>{sessionEmail}</strong> at facility{' '}
                            <strong style={{ color: C_LEFT_BG }}>{sessionFacilityCode}</strong>, we sent a 6-digit code.
                        </p>
                        <div style={{ display: 'flex', width: '100%', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {otpDigits.map((digit, i) => (
                                <input
                                    key={i}
                                    ref={el => { otpRefs.current[i] = el; }}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    value={digit}
                                    onChange={e => handleOtpChange(i, e.target.value)}
                                    onKeyDown={e => {
                                        handleOtpKeyDown(i, e);
                                        if (e.key === 'Enter' && otp.length === 6) void handleVerifyOtp();
                                    }}
                                    onFocus={e => e.target.select()}
                                    maxLength={6}
                                    style={{
                                        width: 34,
                                        height: 40,
                                        textAlign: 'center',
                                        fontSize: 18,
                                        fontWeight: 700,
                                        borderRadius: 8,
                                        border: `1.5px solid ${digit ? C_LEFT_BG : '#e2e8f0'}`,
                                        background: digit ? 'rgba(11,30,59,0.04)' : '#fff',
                                        color: C_LEFT_BG,
                                        outline: 'none',
                                    }}
                                />
                            ))}
                        </div>
                        <button
                            type="button"
                            style={adminAuthPrimaryBtn(loading || otp.length !== 6)}
                            onClick={() => void handleVerifyOtp()}
                            disabled={loading || otp.length !== 6}
                        >
                            {loading ? 'Verifying…' : 'Verify code'}
                        </button>
                        <button
                            type="button"
                            disabled={loading || resendTimer > 0}
                            onClick={() => void handleResendOtp()}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                color: resendTimer > 0 ? C_MUTED_LABEL : '#1d4ed8',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: resendTimer > 0 ? 'default' : 'pointer',
                                padding: 0,
                            }}
                        >
                            {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend code'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setStep('request');
                                setError('');
                                setOtpDigits(['', '', '', '', '', '']);
                            }}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                color: C_BODY_MUTED,
                                fontSize: 12,
                                cursor: 'pointer',
                                padding: 0,
                            }}
                        >
                            Use a different email or facility
                        </button>
                    </div>
                )}

                {step === 'password' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={adminAuthPillStyle}>
                            <span className="material-icons-round" style={{ fontSize: 15, color: C_LEFT_BG }}>lock_reset</span>
                            <span style={{ fontSize: 11, color: C_LEFT_BG, fontWeight: 600 }}>Choose a new password</span>
                        </div>
                        {[
                            { id: 'new-password', label: 'New password', value: password, set: setPassword, show: showPassword, toggle: () => setShowPassword(v => !v) },
                            { id: 'confirm-password', label: 'Confirm password', value: confirmPassword, set: setConfirmPassword, show: showConfirmPassword, toggle: () => setShowConfirmPassword(v => !v) },
                        ].map(field => (
                            <div key={field.id}>
                                <label htmlFor={field.id} style={adminAuthLabelStyle}>{field.label}</label>
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
                                            pointerEvents: 'none',
                                        }}
                                    >
                                        lock
                                    </span>
                                    <input
                                        id={field.id}
                                        type={field.show ? 'text' : 'password'}
                                        value={field.value}
                                        onChange={e => field.set(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && void handleResetPassword()}
                                        {...adminAuthInputFocusHandlers}
                                        style={adminAuthInputWithToggle}
                                        autoComplete="new-password"
                                    />
                                    <button type="button" onClick={field.toggle} style={toggleBtnStyle} aria-label={field.show ? 'Hide password' : 'Show password'}>
                                        <span className="material-icons-round" style={{ fontSize: 18 }}>{field.show ? 'visibility_off' : 'visibility'}</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {password.length > 0 && (
                            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: C_BODY_MUTED, lineHeight: 1.6 }}>
                                {passwordChecks.map(c => (
                                    <li key={c.id} style={{ color: c.met ? '#166534' : C_BODY_MUTED }}>{c.label}</li>
                                ))}
                            </ul>
                        )}
                        <button
                            type="button"
                            style={adminAuthPrimaryBtn(loading || !passwordIsValid || !passwordsMatch)}
                            onClick={() => void handleResetPassword()}
                            disabled={loading || !passwordIsValid || !passwordsMatch}
                        >
                            {loading ? 'Updating…' : 'Update password'}
                        </button>
                    </div>
                )}

                <div style={{ marginTop: 14, textAlign: 'center' }}>
                    <Link href="/login" style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8', textDecoration: 'none' }}>
                        ← Back to sign in
                    </Link>
                </div>
            </AdminAuthShell>
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast.message} variant={toast.type === 'error' ? 'error' : 'success'} dismissible={false} />
                </MacVibrancyToastPortal>
            )}
        </>
    );
}
