'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type CSSProperties, type KeyboardEvent } from 'react';
import {
    AdminAuthShell,
    adminAuthErrorBox,
    adminAuthInputBase,
    adminAuthInputFocusHandlers,
    adminAuthLabelStyle,
    adminAuthPillStyle,
    adminAuthPrimaryBtn,
    C_BODY_MUTED,
    C_LEFT_BG,
    C_MUTED_LABEL,
} from '@/components/AdminAuthShell';
import { MacVibrancyToast, MacVibrancyToastPortal } from '@/components/MacVibrancyToast';
import { API_ENDPOINTS } from '@/lib/config';
import { storeResetEmail, storeResetOtp } from '@/lib/reset-auth';

function apiMessage(data: Record<string, unknown>, fallback: string): string {
    return String(data.message || data.error || data.detail || fallback);
}

function extractResetToken(payload: Record<string, unknown>): string {
    const direct = payload.reset_token ?? payload.resetToken;
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const nested = payload.data ?? payload.result;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        const t = (nested as Record<string, unknown>).reset_token ?? (nested as Record<string, unknown>).resetToken;
        if (typeof t === 'string' && t.trim()) return t.trim();
    }
    return '';
}

type HospitalAdminForgotPasswordProps = {
    initialEmail?: string;
};

export default function HospitalAdminForgotPassword({ initialEmail = '' }: HospitalAdminForgotPasswordProps) {
    const router = useRouter();
    const [step, setStep] = useState<'email' | 'otp'>('email');
    const [email, setEmail] = useState(initialEmail);
    const [sessionEmail, setSessionEmail] = useState('');
    const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resendTimer, setResendTimer] = useState(0);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
    const otp = otpDigits.join('');

    useEffect(() => {
        if (resendTimer <= 0) return;
        const t = setTimeout(() => setResendTimer(r => r - 1), 1000);
        return () => clearTimeout(t);
    }, [resendTimer]);

    useEffect(() => {
        if (step === 'otp') setTimeout(() => otpRefs.current[0]?.focus(), 80);
    }, [step]);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3200);
    };

    const applyOtpFromString = useCallback((raw: string, startIndex = 0) => {
        const digits = raw.replace(/\D/g, '').slice(0, 6 - startIndex);
        if (!digits.length) return;
        setOtpDigits(prev => {
            const copied = [...prev];
            for (let i = 0; i < digits.length && startIndex + i < 6; i += 1) copied[startIndex + i] = digits[i]!;
            return copied;
        });
        otpRefs.current[Math.min(startIndex + digits.length, 5)]?.focus();
    }, []);

    const sendResetOtp = async (targetEmail: string) => {
        const res = await fetch(API_ENDPOINTS.REQUEST_RESET, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: targetEmail }),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) throw new Error(apiMessage(data, 'Could not send reset code.'));
    };

    const handleRequestReset = async () => {
        setError('');
        const normalized = email.trim().toLowerCase();
        if (!normalized) {
            setError('Enter your work email.');
            return;
        }
        setLoading(true);
        try {
            await sendResetOtp(normalized);
            setSessionEmail(normalized);
            setOtpDigits(['', '', '', '', '', '']);
            setResendTimer(60);
            setStep('otp');
            showToast('Verification code sent.', 'success');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Could not send code.';
            setError(msg);
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        setError('');
        if (otp.length !== 6) {
            setError('Enter the full 6-digit code.');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(API_ENDPOINTS.VERIFY_RESET_OTP, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: sessionEmail, otp }),
            });
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            if (!res.ok) {
                setError(apiMessage(data, 'That code did not work.'));
                return;
            }
            const resetToken = extractResetToken(data);
            if (!resetToken) {
                setError('Verification succeeded but no reset token was returned.');
                return;
            }
            storeResetOtp(otp);
            storeResetEmail(sessionEmail);
            router.push(`/reset-password?reset_token=${encodeURIComponent(resetToken)}`);
        } catch {
            setError('Could not reach Helix.');
        } finally {
            setLoading(false);
        }
    };

    const emailInputStyle: CSSProperties = {
        ...adminAuthInputBase,
        paddingLeft: 12,
    };

    return (
        <>
            <AdminAuthShell
                leftAccentTitle="Forgot password"
                leftDescription="We'll email you a code to verify it's you, then you can set a new password."
                eyebrow={step === 'email' ? 'PASSWORD RESET' : 'VERIFY CODE'}
            >
                {error && <div style={adminAuthErrorBox}>{error}</div>}
                {step === 'email' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={adminAuthPillStyle}>
                            <span className="material-icons-round" style={{ fontSize: 15, color: C_LEFT_BG }}>mail</span>
                            <span style={{ fontSize: 11, color: C_LEFT_BG, fontWeight: 600 }}>Email verification</span>
                        </div>
                        <div>
                            <label htmlFor="forgot-email" style={adminAuthLabelStyle}>Work email</label>
                            <input
                                id="forgot-email"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && void handleRequestReset()}
                                {...adminAuthInputFocusHandlers}
                                style={emailInputStyle}
                                autoComplete="email"
                            />
                        </div>
                        <button type="button" style={adminAuthPrimaryBtn(loading)} onClick={() => void handleRequestReset()} disabled={loading}>
                            {loading ? 'Sending…' : 'Send code'}
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                        <div style={adminAuthPillStyle}>
                            <span className="material-icons-round" style={{ fontSize: 15, color: C_LEFT_BG }}>verified_user</span>
                            <span style={{ fontSize: 11, color: C_LEFT_BG, fontWeight: 600 }}>Enter verification code</span>
                        </div>
                        <p style={{ fontSize: 12, color: C_BODY_MUTED, textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
                            Code sent to <strong style={{ color: C_LEFT_BG }}>{sessionEmail}</strong>
                        </p>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {otpDigits.map((digit, i) => (
                                <input
                                    key={i}
                                    ref={el => { otpRefs.current[i] = el; }}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    value={digit}
                                    maxLength={6}
                                    onChange={e => {
                                        const v = e.target.value;
                                        if (v.length > 1) { applyOtpFromString(v, i); return; }
                                        const d = v.replace(/\D/g, '');
                                        setOtpDigits(prev => { const n = [...prev]; n[i] = d; return n; });
                                        if (d && i < 5) otpRefs.current[i + 1]?.focus();
                                    }}
                                    onPaste={e => { e.preventDefault(); applyOtpFromString(e.clipboardData.getData('text'), i); }}
                                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                                        if (e.key === 'Backspace' && !otpDigits[i] && i > 0) {
                                            setOtpDigits(prev => { const n = [...prev]; n[i - 1] = ''; return n; });
                                            otpRefs.current[i - 1]?.focus();
                                        }
                                    }}
                                    style={{
                                        width: 34,
                                        height: 40,
                                        textAlign: 'center',
                                        fontSize: 18,
                                        fontWeight: 700,
                                        borderRadius: 8,
                                        border: `1.5px solid ${digit ? C_LEFT_BG : '#e2e8f0'}`,
                                        outline: 'none',
                                    }}
                                />
                            ))}
                        </div>
                        <button
                            type="button"
                            style={{ ...adminAuthPrimaryBtn(otp.length !== 6 || loading), width: '100%' }}
                            disabled={otp.length !== 6 || loading}
                            onClick={() => void handleVerifyOtp()}
                        >
                            {loading ? 'Verifying…' : 'Continue'}
                        </button>
                        <button
                            type="button"
                            style={{
                                border: 'none',
                                background: 'none',
                                fontSize: 13,
                                color: resendTimer > 0 ? C_MUTED_LABEL : '#1d4ed8',
                                cursor: resendTimer > 0 ? 'default' : 'pointer',
                                fontWeight: 600,
                            }}
                            disabled={resendTimer > 0 || loading}
                            onClick={() => void sendResetOtp(sessionEmail).then(() => {
                                setResendTimer(60);
                                showToast('New code sent.', 'success');
                            }).catch(err => showToast(err instanceof Error ? err.message : 'Failed', 'error'))}
                        >
                            {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
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
