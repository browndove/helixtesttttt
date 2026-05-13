'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import CustomSelect from '@/components/CustomSelect';
import { API_ENDPOINTS } from '@/lib/config';
import {
    PHONE_COUNTRIES,
    formatPhoneByCountry,
    getPhoneCountryByCode,
    isValidPhoneByCountry,
    splitPhoneForCountryInput,
} from '@/lib/phone';

function apiMessage(data: Record<string, unknown>): string {
    return String(data.message || data.detail || data.error || '').trim() || 'Request failed';
}

type PrefillOk = {
    valid: true;
    first_name?: string;
    facility_name?: string;
    expires_at?: string;
    has_on_file_phone?: boolean;
};

type PrefillBad = {
    valid: false;
    message?: string;
};

export default function UpdatePhoneFlow() {
    const searchParams = useSearchParams();
    const token = (searchParams.get('token') || '').trim();

    const [prefillLoading, setPrefillLoading] = useState(true);
    const [prefill, setPrefill] = useState<PrefillOk | PrefillBad | null>(null);

    const [phoneCountry, setPhoneCountry] = useState('GH');
    const [phoneLocal, setPhoneLocal] = useState('');
    const [smsOtp, setSmsOtp] = useState('');
    const [otpCooldownSeconds, setOtpCooldownSeconds] = useState(0);
    const [requestingOtp, setRequestingOtp] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [phoneFieldFocused, setPhoneFieldFocused] = useState(false);
    const otpInputRef = useRef<HTMLInputElement | null>(null);

    const countryOptions = useMemo(() => PHONE_COUNTRIES.map(c => ({ label: c.label, value: c.code })), []);
    const countryMeta = useMemo(() => getPhoneCountryByCode(phoneCountry), [phoneCountry]);
    const formattedPhone = useMemo(() => formatPhoneByCountry(phoneLocal, phoneCountry), [phoneLocal, phoneCountry]);
    const phoneReady = useMemo(() => {
        if (!phoneLocal.trim()) return false;
        return isValidPhoneByCountry(formattedPhone, phoneCountry);
    }, [phoneLocal, phoneCountry, formattedPhone]);

    useEffect(() => {
        if (otpCooldownSeconds <= 0) return;
        const id = setInterval(() => setOtpCooldownSeconds(s => (s <= 1 ? 0 : s - 1)), 1000);
        return () => clearInterval(id);
    }, [otpCooldownSeconds]);

    useEffect(() => {
        if (!token) {
            setPrefillLoading(false);
            setPrefill({ valid: false, message: 'This page needs a link from your email. Open the update link your administrator sent you.' });
            return;
        }
        let canceled = false;
        void (async () => {
            setPrefillLoading(true);
            try {
                const res = await fetch(`${API_ENDPOINTS.STAFF_PHONE_UPDATE_PREFILL}?token=${encodeURIComponent(token)}`);
                const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
                if (canceled) return;
                if (data.valid === true) {
                    setPrefill({
                        valid: true,
                        first_name: typeof data.first_name === 'string' ? data.first_name : undefined,
                        facility_name: typeof data.facility_name === 'string' ? data.facility_name : undefined,
                        expires_at: typeof data.expires_at === 'string' ? data.expires_at : undefined,
                        has_on_file_phone: data.has_on_file_phone === true,
                    });
                } else {
                    setPrefill({
                        valid: false,
                        message: typeof data.message === 'string' ? data.message : 'This link is not valid.',
                    });
                }
            } catch {
                if (!canceled) setPrefill({ valid: false, message: 'Could not reach the server. Try again later.' });
            } finally {
                if (!canceled) setPrefillLoading(false);
            }
        })();
        return () => {
            canceled = true;
        };
    }, [token]);

    const handleRequestOtp = async () => {
        setError('');
        if (!token) return;
        if (!phoneReady) {
            setError(
                !phoneLocal.trim()
                    ? 'Enter your new phone number first.'
                    : `Enter a valid number for ${countryMeta.label} (${countryMeta.dialCode} + ${countryMeta.digits} digits).`,
            );
            return;
        }
        setRequestingOtp(true);
        try {
            const res = await fetch(API_ENDPOINTS.STAFF_PHONE_UPDATE_REQUEST_OTP, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, phone: formattedPhone }),
            });
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            if (res.status === 429 || res.ok) setOtpCooldownSeconds(60);
            if (!res.ok) {
                setError(apiMessage(data));
                return;
            }
            setSmsOtp('');
            setTimeout(() => otpInputRef.current?.focus(), 80);
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setRequestingOtp(false);
        }
    };

    const handleConfirm = async () => {
        setError('');
        const code = smsOtp.replace(/\D/g, '').slice(0, 6);
        if (code.length !== 6) {
            setError('Enter the 6-digit code from your SMS.');
            return;
        }
        if (!token || !phoneReady) return;
        setConfirming(true);
        try {
            const res = await fetch(API_ENDPOINTS.STAFF_PHONE_UPDATE_CONFIRM, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, phone: formattedPhone, otp: code }),
            });
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            if (!res.ok) {
                setError(apiMessage(data));
                return;
            }
            setSuccessMsg(String(data.message || 'Phone number updated and verified successfully.'));
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setConfirming(false);
        }
    };

    const shell: CSSProperties = {
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#E8EDF4',
    };
    const card: CSSProperties = {
        width: '100%',
        maxWidth: 420,
        background: '#fff',
        border: '1px solid rgba(11, 30, 59, 0.06)',
        borderRadius: 12,
        padding: '22px 20px 20px',
        boxShadow: '0 8px 28px rgba(11, 30, 59, 0.06), 0 1px 4px rgba(11, 30, 59, 0.04)',
    };

    if (prefillLoading) {
        return (
            <div style={shell}>
                <div style={card}>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>Checking your link…</p>
                </div>
            </div>
        );
    }

    if (!prefill || prefill.valid === false) {
        return (
            <div style={shell}>
                <div style={card}>
                    <h1 style={{ fontSize: 18, margin: '0 0 10px', color: 'var(--text-primary)' }}>Update phone</h1>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {prefill && 'message' in prefill ? prefill.message : 'This link is not valid.'}
                    </p>
                </div>
            </div>
        );
    }

    const ok = prefill as PrefillOk;
    const first = ok.first_name?.trim() || 'there';

    if (successMsg) {
        return (
            <div style={shell}>
                <div style={card}>
                    <h1 style={{ fontSize: 18, margin: '0 0 10px', color: 'var(--text-primary)' }}>Phone updated</h1>
                    <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{successMsg}</p>
                    <Link href="/login" className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center', display: 'inline-flex', textDecoration: 'none' }}>
                        Go to sign in
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div style={shell}>
            <div style={card}>
                <h1 style={{ fontSize: 18, margin: '0 0 6px', color: '#0B1E3B' }}>Update your phone</h1>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    Hi {first}
                    {ok.facility_name ? ` · ${ok.facility_name}` : ''}. Enter your new mobile number, request a code, then confirm.
                </p>
                {ok.has_on_file_phone ? (
                    <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-secondary)' }}>
                        You already had a number on file; this flow replaces it after verification.
                    </p>
                ) : null}

                {error ? (
                    <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--critical-bg)', border: '1px solid rgba(140,90,94,0.2)', color: 'var(--critical)', fontSize: 13, marginBottom: 12 }}>
                        {error}
                    </div>
                ) : null}

                <label className="label" style={{ fontSize: 11, marginBottom: 6, display: 'block' }}>Country and calling code</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', marginBottom: 8 }}>
                    <div style={{ minWidth: 160, flexShrink: 0 }}>
                        <CustomSelect value={phoneCountry} onChange={setPhoneCountry} options={countryOptions} placeholder="Country" />
                    </div>
                    <div
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'stretch',
                            minWidth: 0,
                            border: `1px solid ${phoneFieldFocused ? 'var(--helix-primary)' : 'var(--border-default)'}`,
                            borderRadius: 'var(--radius-md)',
                            background: '#fff',
                            boxShadow: phoneFieldFocused ? '0 0 0 2px rgba(37, 99, 235, 0.1)' : 'none',
                            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                        }}
                    >
                        <span
                            aria-hidden
                            style={{
                                padding: '0 10px',
                                display: 'flex',
                                alignItems: 'center',
                                flexShrink: 0,
                                fontSize: 13.5,
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                background: 'var(--surface-muted, #f1f5f9)',
                                borderRight: '1px solid var(--border-default)',
                            }}
                        >
                            {countryMeta.dialCode}
                        </span>
                        <input
                            value={phoneLocal}
                            onChange={e => setPhoneLocal(e.target.value.replace(/\D/g, '').slice(0, countryMeta.digits))}
                            onPaste={e => {
                                const raw = e.clipboardData.getData('text/plain').trim();
                                const digits = raw.replace(/\D/g, '');
                                if (digits.length <= countryMeta.digits) return;
                                const normalized = raw.startsWith('+') ? raw : `+${digits}`;
                                const split = splitPhoneForCountryInput(normalized);
                                if (split.local || split.countryCode !== phoneCountry) {
                                    e.preventDefault();
                                    setPhoneCountry(split.countryCode);
                                    setPhoneLocal(split.local);
                                }
                            }}
                            onFocus={() => setPhoneFieldFocused(true)}
                            onBlur={() => setPhoneFieldFocused(false)}
                            placeholder={`${countryMeta.digits} digits (local)`}
                            maxLength={countryMeta.digits}
                            autoComplete="tel-national"
                            inputMode="numeric"
                            aria-label="National mobile number"
                            aria-describedby="update-phone-e164-hint"
                            style={{
                                flex: 1,
                                minWidth: 0,
                                border: 'none',
                                borderRadius: 0,
                                outline: 'none',
                                boxShadow: 'none',
                                padding: '9px 13px',
                                fontSize: 13.5,
                                fontFamily: 'inherit',
                                color: 'var(--text-primary)',
                                background: 'transparent',
                            }}
                        />
                    </div>
                </div>
                <p id="update-phone-e164-hint" style={{ margin: '0 0 14px', fontSize: 11, color: 'var(--text-muted)' }}>
                    Full number with country code: <strong style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{formattedPhone || '…'}</strong> (E.164). You can paste a full international number to set country and digits.
                </p>

                <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%', justifyContent: 'center', marginBottom: 12, minHeight: 40, fontWeight: 600 }}
                    onClick={() => { void handleRequestOtp(); }}
                    disabled={!phoneReady || requestingOtp || otpCooldownSeconds > 0 || !token}
                >
                    {requestingOtp ? 'Sending…' : otpCooldownSeconds > 0 ? `Resend code in ${otpCooldownSeconds}s` : 'Send verification code'}
                </button>

                <label className="label" style={{ fontSize: 11, marginBottom: 4 }}>6-digit code</label>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input
                        ref={otpInputRef}
                        className="input"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="000000"
                        value={smsOtp}
                        maxLength={6}
                        onChange={e => setSmsOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        style={{ flex: 1, letterSpacing: '0.15em', textAlign: 'center' }}
                    />
                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ minWidth: 100, justifyContent: 'center' }}
                        onClick={() => { void handleConfirm(); }}
                        disabled={confirming || smsOtp.replace(/\D/g, '').length !== 6 || !phoneReady || !token}
                    >
                        {confirming ? 'Saving…' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
}
