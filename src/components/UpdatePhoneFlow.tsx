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

/** System UI stack so the page feels at home on iPhone (SF) and elsewhere. */
const IOS_FONT =
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif';

const IOS_BLUE = '#007AFF';
const IOS_LABEL = '#3C3C43';
const IOS_SECONDARY = 'rgba(60, 60, 67, 0.6)';
const IOS_TERTIARY = 'rgba(60, 60, 67, 0.48)';
const IOS_BG = '#F2F2F7';
const IOS_CARD = '#FFFFFF';
const IOS_SEPARATOR = 'rgba(60, 60, 67, 0.12)';

function apiMessage(data: Record<string, unknown>): string {
    return String(data.message || data.detail || data.error || '').trim() || 'Something went wrong. Please try again.';
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
            setPrefill({
                valid: false,
                message:
                    'Open this page using the link from the email or text your team sent you. If you do not have a link, ask your administrator to send a new one.',
            });
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
                        message: typeof data.message === 'string' ? data.message : 'This link is not valid anymore. Ask your administrator for a new link.',
                    });
                }
            } catch {
                if (!canceled) {
                    setPrefill({ valid: false, message: 'We could not reach the hospital system. Check your connection and try again in a moment.' });
                }
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
                    ? 'Add your new mobile number first, then tap send code.'
                    : `That number does not match what we expect for ${countryMeta.label}. It should be ${countryMeta.digits} digits after ${countryMeta.dialCode}.`,
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
            setError('Something blocked that request. Check your connection and try again.');
        } finally {
            setRequestingOtp(false);
        }
    };

    const handleConfirm = async () => {
        setError('');
        const code = smsOtp.replace(/\D/g, '').slice(0, 6);
        if (code.length !== 6) {
            setError('Type the 6 numbers from the text we sent you.');
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
            setSuccessMsg(String(data.message || 'Your phone number is updated. You can sign in with it from now on.'));
        } catch {
            setError('Something blocked that request. Check your connection and try again.');
        } finally {
            setConfirming(false);
        }
    };

    const shell: CSSProperties = {
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px max(24px, env(safe-area-inset-bottom))',
        background: `linear-gradient(165deg, #E8E8ED 0%, ${IOS_BG} 42%, #D9D9DE 100%)`,
        fontFamily: IOS_FONT,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
    };
    const card: CSSProperties = {
        width: '100%',
        maxWidth: 400,
        background: 'rgba(255, 255, 255, 0.78)',
        backdropFilter: 'saturate(180%) blur(24px)',
        WebkitBackdropFilter: 'saturate(180%) blur(24px)',
        borderRadius: 22,
        padding: '28px 20px 24px',
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.1), 0 1px 0 rgba(255, 255, 255, 0.65) inset',
        border: `0.5px solid ${IOS_SEPARATOR}`,
    };
    const sectionKicker: CSSProperties = {
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        textTransform: 'none',
        color: IOS_SECONDARY,
        margin: '0 0 4px 0',
    };
    const sectionTitle: CSSProperties = {
        fontSize: 17,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        color: IOS_LABEL,
        margin: '0 0 12px 0',
        lineHeight: 1.25,
    };
    const panel: CSSProperties = {
        border: 'none',
        borderRadius: 14,
        padding: 14,
        background: 'rgba(242, 242, 247, 0.95)',
        marginBottom: 14,
    };
    const fieldLabel: CSSProperties = {
        display: 'block',
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: '-0.01em',
        color: IOS_SECONDARY,
        marginBottom: 8,
    };
    const btnPrimary: CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 50,
        padding: '0 20px',
        borderRadius: 14,
        border: 'none',
        background: IOS_BLUE,
        color: '#fff',
        fontFamily: IOS_FONT,
        fontSize: 17,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        boxShadow: '0 1px 0 rgba(255,255,255,0.25) inset',
    };
    const btnSecondary: CSSProperties = {
        ...btnPrimary,
        width: '100%',
        background: '#E5E5EA',
        color: IOS_LABEL,
        boxShadow: 'none',
    };
    const btnPrimaryDisabled: CSSProperties = {
        opacity: 0.38,
        cursor: 'not-allowed',
    };

    if (prefillLoading) {
        return (
            <div style={shell}>
                <div style={card}>
                    <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: IOS_SECONDARY }}>One moment</p>
                    <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: IOS_LABEL, letterSpacing: '-0.02em' }}>
                        Making sure your link still works…
                    </p>
                </div>
            </div>
        );
    }

    if (!prefill || prefill.valid === false) {
        return (
            <div style={shell}>
                <div style={card}>
                    <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 12px', color: IOS_LABEL, letterSpacing: '-0.03em' }}>
                        We could not open that link
                    </h1>
                    <p style={{ margin: 0, fontSize: 16, color: IOS_SECONDARY, lineHeight: 1.45, letterSpacing: '-0.01em' }}>
                        {prefill && 'message' in prefill ? prefill.message : 'That link does not look right. Ask your administrator to send you a new one.'}
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
                    <div
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: '50%',
                            background: 'rgba(52, 199, 89, 0.15)',
                            display: 'grid',
                            placeItems: 'center',
                            marginBottom: 16,
                            fontSize: 26,
                        }}
                        aria-hidden
                    >
                        ✓
                    </div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 10px', color: IOS_LABEL, letterSpacing: '-0.04em' }}>
                        All set
                    </h1>
                    <p style={{ margin: '0 0 24px', fontSize: 16, color: IOS_SECONDARY, lineHeight: 1.45, letterSpacing: '-0.01em' }}>{successMsg}</p>
                    <Link
                        href="/login"
                        style={{
                            ...btnPrimary,
                            width: '100%',
                            textDecoration: 'none',
                            boxSizing: 'border-box',
                        }}
                    >
                        Continue to sign in
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div style={shell}>
            <div style={card}>
                <p style={{ ...sectionKicker, marginBottom: 2 }}>This link is ready</p>
                <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 16px', color: IOS_LABEL, letterSpacing: '-0.04em', lineHeight: 1.1 }}>
                    Update your phone
                </h1>

                <div
                    style={{
                        borderRadius: 14,
                        padding: '14px 16px',
                        marginBottom: 20,
                        background: 'rgba(0, 122, 255, 0.09)',
                        border: '0.5px solid rgba(0, 122, 255, 0.18)',
                    }}
                >
                    <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: IOS_LABEL, letterSpacing: '-0.02em' }}>
                        Hi {first}
                        {ok.facility_name ? (
                            <span style={{ fontWeight: 500, color: IOS_SECONDARY }}>
                                {' '}
                                · {ok.facility_name}
                            </span>
                        ) : null}
                    </p>
                    <p style={{ margin: '10px 0 0', fontSize: 15, color: IOS_SECONDARY, lineHeight: 1.45, letterSpacing: '-0.01em' }}>
                        Add your new number below, tap to text yourself a short code, then type that code to finish. It only takes a minute.
                    </p>
                    {ok.has_on_file_phone ? (
                        <p style={{ margin: '12px 0 0', fontSize: 14, color: IOS_TERTIARY, lineHeight: 1.45, letterSpacing: '-0.01em' }}>
                            You already have a number on file. It will switch to the new one only after you enter the code.
                        </p>
                    ) : null}
                </div>

                {error ? (
                    <div
                        role="alert"
                        style={{
                            padding: '12px 14px',
                            borderRadius: 14,
                            background: 'rgba(255, 59, 48, 0.1)',
                            border: '0.5px solid rgba(255, 59, 48, 0.22)',
                            color: '#C03403',
                            fontSize: 15,
                            marginBottom: 18,
                            lineHeight: 1.45,
                            letterSpacing: '-0.01em',
                        }}
                    >
                        {error}
                    </div>
                ) : null}

                <section aria-labelledby="update-phone-step1-title">
                    <p id="update-phone-step1-title" style={sectionKicker}>
                        First — your number
                    </p>
                    <h2 style={sectionTitle}>What is your new mobile number?</h2>
                    <div style={panel}>
                        <div style={{ marginBottom: 16 }} role="group" aria-labelledby="update-phone-country-label">
                            <span id="update-phone-country-label" style={fieldLabel}>
                                Country or region
                            </span>
                            <CustomSelect value={phoneCountry} onChange={setPhoneCountry} options={countryOptions} placeholder="Choose your country" />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <label htmlFor="update-phone-local" style={fieldLabel}>
                                Your number
                            </label>
                            <p style={{ margin: '0 0 8px', fontSize: 12, color: IOS_TERTIARY, lineHeight: 1.35 }}>
                                Type the digits after the country code. The grey box shows the code for you.
                            </p>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'stretch',
                                    minWidth: 0,
                                    border: `1px solid ${phoneFieldFocused ? IOS_BLUE : IOS_SEPARATOR}`,
                                    borderRadius: 12,
                                    background: '#fff',
                                    boxShadow: phoneFieldFocused ? `0 0 0 3px rgba(0, 122, 255, 0.22)` : 'none',
                                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                                    overflow: 'hidden',
                                }}
                            >
                                <span
                                    aria-hidden
                                    style={{
                                        padding: '0 14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        flexShrink: 0,
                                        fontSize: 17,
                                        fontWeight: 600,
                                        color: IOS_SECONDARY,
                                        background: '#F2F2F7',
                                        borderRight: `0.5px solid ${IOS_SEPARATOR}`,
                                    }}
                                >
                                    {countryMeta.dialCode}
                                </span>
                                <input
                                    id="update-phone-local"
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
                                    placeholder={`${countryMeta.digits} digits`}
                                    maxLength={countryMeta.digits}
                                    autoComplete="tel-national"
                                    inputMode="numeric"
                                    aria-describedby="update-phone-e164-hint"
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        border: 'none',
                                        borderRadius: 0,
                                        outline: 'none',
                                        boxShadow: 'none',
                                        padding: '14px 16px',
                                        fontSize: 17,
                                        fontFamily: IOS_FONT,
                                        letterSpacing: '-0.01em',
                                        color: IOS_LABEL,
                                        background: 'transparent',
                                    }}
                                />
                            </div>
                        </div>
                        <p id="update-phone-e164-hint" style={{ margin: 0, fontSize: 13, color: IOS_TERTIARY, lineHeight: 1.4, letterSpacing: '-0.01em' }}>
                            We will store it as{' '}
                            <strong style={{ fontWeight: 600, color: IOS_SECONDARY }}>{formattedPhone || '…'}</strong>
                            {' '}so calls and messages from the hospital reach you. Tip: you can paste a number that starts with + and we will fill the country for you.
                        </p>
                    </div>
                </section>

                <button
                    type="button"
                    style={{
                        ...btnSecondary,
                        marginBottom: 22,
                        ...(!phoneReady || requestingOtp || otpCooldownSeconds > 0 || !token ? btnPrimaryDisabled : {}),
                    }}
                    onClick={() => { void handleRequestOtp(); }}
                    disabled={!phoneReady || requestingOtp || otpCooldownSeconds > 0 || !token}
                >
                    {requestingOtp ? 'Sending…' : otpCooldownSeconds > 0 ? `Send again in ${otpCooldownSeconds}s` : 'Text me a code'}
                </button>

                <section aria-labelledby="update-phone-step2-title">
                    <p id="update-phone-step2-title" style={sectionKicker}>
                        Then — check your messages
                    </p>
                    <h2 style={{ ...sectionTitle, marginBottom: 12 }}>Enter the code we text you</h2>
                    <div style={{ ...panel, marginBottom: 0 }}>
                        <label htmlFor="update-phone-otp" style={{ ...fieldLabel, marginBottom: 8 }}>
                            6-digit code
                        </label>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
                            <input
                                id="update-phone-otp"
                                ref={otpInputRef}
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="------"
                                value={smsOtp}
                                maxLength={6}
                                onChange={e => setSmsOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                style={{
                                    flex: 1,
                                    letterSpacing: '0.22em',
                                    textAlign: 'center',
                                    fontSize: 20,
                                    fontWeight: 600,
                                    fontFamily: IOS_FONT,
                                    color: IOS_LABEL,
                                    minHeight: 52,
                                    borderRadius: 12,
                                    border: `1px solid ${IOS_SEPARATOR}`,
                                    background: '#fff',
                                    outline: 'none',
                                    paddingLeft: '0.22em',
                                }}
                            />
                            <button
                                type="button"
                                style={{
                                    ...btnPrimary,
                                    minWidth: 112,
                                    ...(confirming || smsOtp.replace(/\D/g, '').length !== 6 || !phoneReady || !token ? btnPrimaryDisabled : {}),
                                }}
                                onClick={() => { void handleConfirm(); }}
                                disabled={confirming || smsOtp.replace(/\D/g, '').length !== 6 || !phoneReady || !token}
                            >
                                {confirming ? 'Saving…' : 'Done'}
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
