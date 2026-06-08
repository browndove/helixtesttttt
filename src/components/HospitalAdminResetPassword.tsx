'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type CSSProperties } from 'react';
import {
    AdminAuthShell,
    adminAuthErrorBox,
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
import {
    buildResetPasswordBody,
    clearStoredResetOtp,
    extractEmailFromResetToken,
    resolveResetOtp,
} from '@/lib/reset-auth';

const passwordChecksDef = (password: string) => [
    { id: 'length', label: 'At least 8 characters', met: password.length >= 8 },
    { id: 'upper', label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { id: 'lower', label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { id: 'digit', label: 'One number', met: /[0-9]/.test(password) },
    { id: 'special', label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
];

function apiMessage(data: Record<string, unknown>, fallback: string): string {
    return String(data.message || data.error || data.detail || fallback);
}

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

type HospitalAdminResetPasswordProps = {
    resetToken: string;
};

export default function HospitalAdminResetPassword({ resetToken }: HospitalAdminResetPasswordProps) {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const passwordChecks = passwordChecksDef(password);
    const passwordIsValid = passwordChecks.every(c => c.met);
    const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
    const canSubmit = Boolean(resetToken.trim()) && passwordIsValid && passwordsMatch && !loading;

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3200);
    };

    const handleResetPassword = async () => {
        setError('');
        if (!resetToken.trim()) {
            setError('This reset link is invalid. Request a new one from your administrator.');
            return;
        }
        const email = extractEmailFromResetToken(resetToken);
        if (!email) {
            setError('This reset link is invalid or expired. Start again from Forgot password.');
            return;
        }
        const otp = resolveResetOtp(resetToken);
        if (!otp) {
            setError('Your verification session expired. Start again from Forgot password.');
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
                body: JSON.stringify(buildResetPasswordBody(resetToken, password)),
            });
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            if (!res.ok) {
                const msg = apiMessage(data, 'Could not reset password.');
                setError(msg);
                showToast(msg, 'error');
                return;
            }
            clearStoredResetOtp();
            showToast(String(data.message || 'Password updated. Sign in with your new password.'), 'success');
            setTimeout(() => {
                if (typeof window !== 'undefined') window.location.assign('/login');
                else router.replace('/login');
            }, 900);
        } catch {
            const msg = 'Could not reach Helix. Check your connection and try again.';
            setError(msg);
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const invalidLinkContent = (
        <>
            <div style={adminAuthPillStyle}>
                <span className="material-icons-round" style={{ fontSize: 15, color: C_LEFT_BG }}>link_off</span>
                <span style={{ fontSize: 11, color: C_LEFT_BG, fontWeight: 600 }}>Invalid reset link</span>
            </div>
            <p style={{ fontSize: 13, color: C_BODY_MUTED, lineHeight: 1.55, margin: '0 0 16px' }}>
                Ask your administrator to send a password reset, or use Forgot password on the sign-in page.
            </p>
            <Link
                href="/login"
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#1d4ed8',
                    textDecoration: 'none',
                }}
            >
                <span className="material-icons-round" style={{ fontSize: 16 }}>arrow_back</span>
                Back to sign in
            </Link>
        </>
    );

    const formContent = (
        <>
            <div style={adminAuthPillStyle}>
                <span className="material-icons-round" style={{ fontSize: 15, color: C_LEFT_BG }}>lock_reset</span>
                <span style={{ fontSize: 11, color: C_LEFT_BG, fontWeight: 600 }}>Choose a new password</span>
            </div>
            {error && <div style={adminAuthErrorBox}>{error}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                <button type="button" style={adminAuthPrimaryBtn(!canSubmit)} onClick={() => void handleResetPassword()} disabled={!canSubmit}>
                    {loading ? 'Updating…' : 'Update password'}
                </button>
            </div>
            <div style={{ marginTop: 14, textAlign: 'center' }}>
                <Link href="/login" style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8', textDecoration: 'none' }}>
                    ← Back to sign in
                </Link>
            </div>
        </>
    );

    return (
        <>
            <AdminAuthShell
                leftAccentTitle="New password"
                leftDescription="Choose a new password, then sign in again with your work email."
                leftFooter="This is not the patient app or ward staff mobile sign-in."
                eyebrow="SET NEW PASSWORD"
            >
                {!resetToken.trim() ? invalidLinkContent : formContent}
            </AdminAuthShell>
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast.message} variant={toast.type === 'error' ? 'error' : 'success'} dismissible={false} />
                </MacVibrancyToastPortal>
            )}
        </>
    );
}
