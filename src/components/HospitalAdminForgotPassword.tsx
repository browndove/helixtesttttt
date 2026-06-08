'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
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
} from '@/components/AdminAuthShell';
import { MacVibrancyToast, MacVibrancyToastPortal } from '@/components/MacVibrancyToast';
import { API_ENDPOINTS } from '@/lib/config';

function apiMessage(data: Record<string, unknown>, fallback: string): string {
    return String(data.message || data.error || data.detail || fallback);
}

type HospitalAdminForgotPasswordProps = {
    initialEmail?: string;
};

export default function HospitalAdminForgotPassword({ initialEmail = '' }: HospitalAdminForgotPasswordProps) {
    const [email, setEmail] = useState(initialEmail);
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3200);
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
            const res = await fetch(API_ENDPOINTS.REQUEST_RESET, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: normalized }),
            });
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            if (!res.ok) {
                const msg = apiMessage(data, 'Could not send reset email.');
                setError(msg);
                showToast(msg, 'error');
                return;
            }
            setSent(true);
            showToast(String(data.message || 'Password reset email sent.'), 'success');
        } catch {
            const msg = 'Could not reach Helix.';
            setError(msg);
            showToast(msg, 'error');
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
                leftDescription="Enter your work email and we'll send you a link to set a new password."
                eyebrow="PASSWORD RESET"
            >
                {error && <div style={adminAuthErrorBox}>{error}</div>}
                {sent ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={adminAuthPillStyle}>
                            <span className="material-icons-round" style={{ fontSize: 15, color: C_LEFT_BG }}>mark_email_read</span>
                            <span style={{ fontSize: 11, color: C_LEFT_BG, fontWeight: 600 }}>Check your email</span>
                        </div>
                        <p style={{ fontSize: 13, color: C_BODY_MUTED, lineHeight: 1.55, margin: 0 }}>
                            If an account exists for <strong style={{ color: C_LEFT_BG }}>{email.trim().toLowerCase()}</strong>, we sent a link to reset your password. Open the link from your email to continue.
                        </p>
                        <button
                            type="button"
                            style={adminAuthPrimaryBtn(loading)}
                            onClick={() => void handleRequestReset()}
                            disabled={loading}
                        >
                            {loading ? 'Sending…' : 'Resend email'}
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={adminAuthPillStyle}>
                            <span className="material-icons-round" style={{ fontSize: 15, color: C_LEFT_BG }}>mail</span>
                            <span style={{ fontSize: 11, color: C_LEFT_BG, fontWeight: 600 }}>Reset via email</span>
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
                            {loading ? 'Sending…' : 'Send reset email'}
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
