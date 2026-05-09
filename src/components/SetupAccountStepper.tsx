'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import CustomSelect from '@/components/CustomSelect';
import { API_ENDPOINTS } from '@/lib/config';
import {
    PHONE_COUNTRIES,
    formatPhoneByCountry,
    getPhoneCountryByCode,
    isValidPhoneByCountry,
    splitPhoneForCountryInput,
} from '@/lib/phone';

type SetupStep = 'info' | 'phone' | 'security';

const STEP_ORDER: SetupStep[] = ['info', 'phone', 'security'];

function setupApiMessage(data: Record<string, unknown>): string {
    return String(data.message || data.detail || data.error || '').trim() || 'Request failed';
}

function extractFacilityCode(value: unknown): string {
    if (!value || typeof value !== 'object') return '';
    const data = value as Record<string, unknown>;
    const direct: unknown[] = [
        data.facility_code,
        data.facilityCode,
        data.code,
        data.organization_code,
        data.org_code,
    ];
    for (const item of direct) {
        if (typeof item === 'string' && item.trim()) return item.trim();
    }
    return '';
}

function buildStepHref(step: SetupStep, token: string): string {
    const query = new URLSearchParams();
    if (token.trim()) query.set('token', token.trim());
    const qs = query.toString();
    return qs ? `/setup-account/${step}?${qs}` : `/setup-account/${step}`;
}

export default function SetupAccountStepper({ token, step }: { token: string; step: SetupStep }) {
    const router = useRouter();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [middleName, setMiddleName] = useState('');
    const [email, setEmail] = useState('');
    const [phoneCountry, setPhoneCountry] = useState('GH');
    const [phoneLocal, setPhoneLocal] = useState('');
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [verifiedPhoneE164, setVerifiedPhoneE164] = useState('');
    const [smsOtp, setSmsOtp] = useState('');
    const [otpCooldownSeconds, setOtpCooldownSeconds] = useState(0);
    const [requestingSmsOtp, setRequestingSmsOtp] = useState(false);
    const [verifyingSmsOtp, setVerifyingSmsOtp] = useState(false);
    const [smsHint, setSmsHint] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [prefillLoading, setPrefillLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [completed, setCompleted] = useState(false);
    const [facilityCode, setFacilityCode] = useState('');
    const otpInputRef = useRef<HTMLInputElement | null>(null);

    const countryOptions = useMemo(
        () => PHONE_COUNTRIES.map(c => ({ label: c.label, value: c.code })),
        []
    );
    const accountCountryMeta = useMemo(() => getPhoneCountryByCode(phoneCountry), [phoneCountry]);
    const formattedPhone = useMemo(() => formatPhoneByCountry(phoneLocal, phoneCountry), [phoneLocal, phoneCountry]);
    const identityReady = useMemo(
        () => Boolean(firstName.trim()) && Boolean(lastName.trim()),
        [firstName, lastName]
    );
    const phoneReady = useMemo(() => {
        if (!phoneLocal.trim()) return false;
        return isValidPhoneByCountry(formattedPhone, phoneCountry);
    }, [phoneLocal, formattedPhone, phoneCountry]);
    const phoneVerifiedForSubmit = useMemo(
        () => phoneVerified && verifiedPhoneE164 !== '' && verifiedPhoneE164 === formattedPhone,
        [phoneVerified, verifiedPhoneE164, formattedPhone]
    );
    const passwordChecks = [
        { id: 'length', label: 'At least 8 characters', met: password.length >= 8 },
        { id: 'upper', label: 'At least one uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
        { id: 'lower', label: 'At least one lowercase letter (a-z)', met: /[a-z]/.test(password) },
        { id: 'digit', label: 'At least one number (0-9)', met: /[0-9]/.test(password) },
        { id: 'special', label: 'At least one special character (e.g. !@#$%^&*)', met: /[^A-Za-z0-9]/.test(password) },
    ];
    const passwordIsValid = passwordChecks.every(check => check.met);

    useEffect(() => {
        if (!token) return;
        let canceled = false;

        const loadPrefill = async () => {
            setPrefillLoading(true);
            try {
                const res = await fetch(`${API_ENDPOINTS.SETUP_PREFILL}?token=${encodeURIComponent(token)}`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok || canceled) return;
                if (typeof data.first_name === 'string') setFirstName(data.first_name);
                if (typeof data.last_name === 'string') setLastName(data.last_name);
                if (typeof data.middle_name === 'string') setMiddleName(data.middle_name);
                if (typeof data.email === 'string') setEmail(data.email.trim());
                if (typeof data.phone === 'string' && data.phone.trim()) {
                    const split = splitPhoneForCountryInput(String(data.phone));
                    setPhoneCountry(prev => prev || split.countryCode);
                    setPhoneLocal(prev => prev || split.local);
                }
                const codeFromApi = extractFacilityCode(data);
                if (codeFromApi) setFacilityCode(prev => prev || codeFromApi);
            } finally {
                if (!canceled) setPrefillLoading(false);
            }
        };

        void loadPrefill();
        return () => {
            canceled = true;
        };
    }, [token]);

    useEffect(() => {
        if (!token) return;
        try {
            const raw = window.sessionStorage.getItem(`setup-account:${token}`);
            if (!raw) return;
            const saved = JSON.parse(raw) as Record<string, unknown>;
            if (typeof saved.phoneCountry === 'string') setPhoneCountry(saved.phoneCountry);
            if (typeof saved.phoneLocal === 'string') setPhoneLocal(saved.phoneLocal);
            if (saved.phoneVerified === true) setPhoneVerified(true);
            if (typeof saved.verifiedPhoneE164 === 'string') setVerifiedPhoneE164(saved.verifiedPhoneE164);
        } catch {
            // Ignore invalid persisted data.
        }
    }, [token]);

    useEffect(() => {
        if (!token) return;
        const payload = {
            phoneCountry,
            phoneLocal,
            phoneVerified,
            verifiedPhoneE164,
        };
        window.sessionStorage.setItem(`setup-account:${token}`, JSON.stringify(payload));
    }, [token, phoneCountry, phoneLocal, phoneVerified, verifiedPhoneE164]);

    useEffect(() => {
        if (otpCooldownSeconds <= 0) return;
        const id = setInterval(() => setOtpCooldownSeconds(s => (s <= 1 ? 0 : s - 1)), 1000);
        return () => clearInterval(id);
    }, [otpCooldownSeconds]);

    useEffect(() => {
        if (verifiedPhoneE164 && formattedPhone !== verifiedPhoneE164) {
            setPhoneVerified(false);
            setVerifiedPhoneE164('');
            setSmsOtp('');
            setSmsHint('');
        }
    }, [formattedPhone, verifiedPhoneE164]);

    const moveStep = (next: SetupStep) => {
        router.push(buildStepHref(next, token));
    };

    const handleRequestSetupSmsOtp = async () => {
        setError('');
        setSmsHint('');
        if (!token) {
            setError('Open this page from the setup link in your invitation email, then try again.');
            return;
        }
        if (!phoneReady) {
            setError(
                !phoneLocal.trim()
                    ? 'Enter your phone number before requesting a code.'
                    : `Enter a valid number for ${accountCountryMeta.label} (${accountCountryMeta.dialCode} + ${accountCountryMeta.digits} digits).`,
            );
            return;
        }
        setRequestingSmsOtp(true);
        try {
            const res = await fetch(API_ENDPOINTS.SETUP_PHONE_REQUEST_OTP, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, phone: formattedPhone }),
            });
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            if (res.status === 429 || res.ok) setOtpCooldownSeconds(60);
            if (!res.ok) {
                setError(setupApiMessage(data));
                return;
            }
            setPhoneVerified(false);
            setVerifiedPhoneE164('');
            setSmsOtp('');
            setSmsHint('We sent a 6-digit code. It expires in 5 minutes. Enter it below.');
            setTimeout(() => otpInputRef.current?.focus(), 80);
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setRequestingSmsOtp(false);
        }
    };

    const handleVerifySetupSmsOtp = async () => {
        setError('');
        const code = smsOtp.replace(/\D/g, '').slice(0, 6);
        if (code.length !== 6) {
            setError('Enter the 6-digit code from your SMS.');
            return;
        }
        if (!token || !phoneReady) return;
        setVerifyingSmsOtp(true);
        try {
            const res = await fetch(API_ENDPOINTS.SETUP_PHONE_VERIFY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, phone: formattedPhone, otp: code }),
            });
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            if (!res.ok) {
                setError(setupApiMessage(data));
                return;
            }
            setPhoneVerified(true);
            setVerifiedPhoneE164(formattedPhone);
            setSmsHint(String(data.message || 'Phone verified. Continue to password.'));
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setVerifyingSmsOtp(false);
        }
    };

    const handleSubmit = async () => {
        setError('');
        setSuccess('');
        if (!token) {
            setError('Open this page from the setup link in your invitation email, then try again.');
            return;
        }
        if (!identityReady) {
            setError('Your invitation details are missing. Reopen the link from your email.');
            return;
        }
        if (!phoneReady || !phoneVerifiedForSubmit) {
            setError('Verify your phone number first using the SMS code.');
            return;
        }
        if (!password.trim()) {
            setError('Please enter and confirm your password.');
            return;
        }
        if (!passwordIsValid) {
            setError('Password does not meet all requirements.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(API_ENDPOINTS.SETUP, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: firstName.trim(),
                    ...(middleName.trim() ? { middle_name: middleName.trim() } : {}),
                    last_name: lastName.trim(),
                    phone: formattedPhone,
                    password,
                    token,
                }),
            });
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            if (!res.ok) {
                setError(setupApiMessage(data));
                return;
            }
            setSuccess(String(data.message || 'Account activated successfully.'));
            const responseFacilityCode = extractFacilityCode(data);
            if (responseFacilityCode) setFacilityCode(responseFacilityCode);
            setCompleted(true);
            window.sessionStorage.removeItem(`setup-account:${token}`);
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const stepIndex = STEP_ORDER.indexOf(step);
    const alertBox: CSSProperties = { padding: '8px 10px', borderRadius: 8, fontSize: 12, marginBottom: 10 };
    const shellRootStyle: CSSProperties = {
        position: 'relative',
        height: '100dvh',
        maxHeight: '100dvh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#F0F2F5',
    };
    const asideStyle: CSSProperties = {
        position: 'relative',
        minWidth: 0,
        background: '#0B1E3B',
        overflow: 'hidden',
        display: 'flex',
        minHeight: 180,
        width: '100%',
        maxHeight: '36vh',
        flex: '0 0 auto',
        flexDirection: 'column',
        justifyContent: 'space-between',
    };
    const rightColumnStyle: CSSProperties = {
        display: 'flex',
        width: '100%',
        minWidth: 0,
        minHeight: 0,
        flex: 1,
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#E8EDF4',
    };
    const formScrollStyle: CSSProperties = {
        display: 'flex',
        width: '100%',
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: '24px 40px',
    };
    const formInnerStyle: CSSProperties = {
        display: 'flex',
        width: '100%',
        maxWidth: 'min(100%, 26rem)',
        flexDirection: 'column',
        alignItems: 'stretch',
        paddingLeft: 16,
        paddingRight: 16,
        paddingBottom: 4,
    };
    const cardSurface: CSSProperties = {
        width: '100%',
        background: '#fff',
        border: '1px solid rgba(11, 30, 59, 0.06)',
        borderRadius: 12,
        padding: '22px 20px 20px',
        boxShadow: '0 8px 28px rgba(11, 30, 59, 0.06), 0 1px 4px rgba(11, 30, 59, 0.04)',
    };
    const sectionCard: CSSProperties = {
        border: 'none',
        borderRadius: 0,
        background: 'transparent',
        padding: 0,
        boxShadow: 'none',
    };
    const inputStyle: CSSProperties = {
        minHeight: 40,
        borderRadius: 10,
        borderColor: '#D4DCE8',
        fontSize: 15,
        padding: '10px 12px',
        boxShadow: 'none',
    };
    const readOnlyInputStyle: CSSProperties = {
        ...inputStyle,
        background: '#f6f8fc',
        color: '#475569',
    };
    const primaryButtonStyle: CSSProperties = {
        minHeight: 42,
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 600,
        justifyContent: 'center',
    };
    const secondaryButtonStyle: CSSProperties = {
        ...primaryButtonStyle,
        background: '#ffffff',
        border: '1px solid #D4DCE8',
        color: '#22324a',
    };
    const sendCodeButtonStyle: CSSProperties = {
        ...primaryButtonStyle,
        background: 'linear-gradient(180deg, #e8eef8 0%, #d8e3f3 100%)',
        border: '1px solid #b7c8e0',
        color: '#153761',
        fontWeight: 700,
    };

    return (
        <>
            <style>
                {`
@media (max-width: 767px) {
  .setup-step-aside { display: none !important; }
  .setup-step-right {
    flex: 1 1 auto !important;
    min-height: 100dvh !important;
    height: 100dvh !important;
  }
  .setup-step-scroll {
    padding: 16px !important;
    justify-content: flex-start !important;
    overflow-y: auto !important;
  }
  .setup-step-inner {
    max-width: 100% !important;
    padding-top: 10px !important;
    padding-bottom: 22px !important;
  }
}
@media (min-width: 768px) {
  .setup-step-shell { flex-direction: row !important; }
  .setup-step-aside {
    max-height: none !important;
    height: 100% !important;
    min-height: 0 !important;
    width: 40% !important;
    max-width: 28rem !important;
    flex: 0 0 40% !important;
  }
}
            `}
            </style>
            <div className="setup-step-shell" style={shellRootStyle}>
                <aside className="setup-step-aside" style={asideStyle}>
                    <div
                        aria-hidden
                        style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundImage:
                                'repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(255,255,255,0.035) 21px), repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(255,255,255,0.035) 21px)',
                            pointerEvents: 'none',
                        }}
                    />
                    <div
                        aria-hidden
                        style={{
                            position: 'absolute',
                            width: 280,
                            height: 280,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle at center, rgba(127,178,240,0.26), rgba(127,178,240,0))',
                            top: -90,
                            right: -80,
                        }}
                    />
                    <div style={{ position: 'relative', zIndex: 1, padding: '30px 28px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
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
                                <img src="/brand-logo.svg" alt="Helix logo" width={28} height={28} style={{ width: 28, height: 28, objectFit: 'contain' }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.78)' }}>
                                ACCOUNT SETUP
                            </span>
                        </div>
                        <h1 style={{ fontSize: 'clamp(1.35rem, 2.8vw, 1.75rem)', fontWeight: 800, lineHeight: 1.12, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
                            Helix
                        </h1>
                        <p style={{ margin: '10px 0 0', fontSize: 'clamp(1.12rem, 2.4vw, 1.45rem)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em', color: '#7FB2F0' }}>
                            Invite Activation
                        </p>
                        <p style={{ marginTop: 22, fontSize: 13, lineHeight: 1.6, color: '#c5d0e3', maxWidth: 360 }}>
                            Complete your account in three quick steps: confirm profile details, verify your mobile number, and set a secure password.
                        </p>
                    </div>
                    <p style={{ position: 'relative', zIndex: 1, padding: '0 28px 18px', margin: 0, fontSize: 12, lineHeight: 1.55, color: 'rgba(255,255,255,0.72)' }}>
                        Use the invite link sent by your administrator.
                    </p>
                </aside>

                <div className="setup-step-right" style={rightColumnStyle}>
                    <div className="setup-step-scroll" style={formScrollStyle}>
                        <div className="setup-step-inner" style={formInnerStyle}>
                            <header style={{ textAlign: 'center', marginBottom: 22 }}>
                                <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', color: '#7A8A9E', margin: '0 0 4px' }}>
                                    STEP {stepIndex + 1} OF 3
                                </p>
                                <h2 style={{ fontSize: 'clamp(1.1rem, 2.8vw + 0.5rem, 1.5rem)', fontWeight: 800, color: '#0B1E3B', margin: 0, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                                    Set up account
                                </h2>
                            </header>

                            <div style={cardSurface}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
                                    {STEP_ORDER.map((item, idx) => (
                                        <div
                                            key={item}
                                            style={{
                                                borderRadius: 999,
                                                height: 7,
                                                background: idx <= stepIndex ? 'linear-gradient(90deg, #0e4fca 0%, #173a7f 100%)' : 'rgba(17, 59, 128, 0.12)',
                                            }}
                                        />
                                    ))}
                                </div>

                {prefillLoading && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px' }}>Loading invitation details…</p>}
                {!token && (
                    <div style={{ ...alertBox, background: 'var(--critical-bg)', border: '1px solid rgba(140,90,94,0.2)', color: 'var(--critical)' }}>
                        Use the invitation link from your email to open this page.
                    </div>
                )}
                {error && <div style={{ ...alertBox, background: 'var(--critical-bg)', border: '1px solid rgba(140,90,94,0.2)', color: 'var(--critical)' }}>{error}</div>}
                {success && !completed && <div style={{ ...alertBox, background: 'var(--success-bg)', border: '1px solid rgba(46,125,50,0.2)', color: 'var(--success)' }}>{success}</div>}

                {completed ? (
                    <div style={{ padding: '10px 10px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(46,125,50,0.2)', background: 'var(--success-bg)' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Account is ready</div>
                        {facilityCode ? <p style={{ margin: '0 0 8px', fontSize: 11 }}>Facility code: <strong>{facilityCode}</strong></p> : null}
                        <Link href="/login" className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center', display: 'inline-flex', textDecoration: 'none' }}>
                            Continue to login
                        </Link>
                    </div>
                ) : null}

                {!completed && step === 'info' && (
                    <>
                        <div style={{ ...sectionCard, marginBottom: 10 }}>
                            <label className="label" style={{ fontSize: 11, marginBottom: 4 }}>Email</label>
                            <div className="input" style={readOnlyInputStyle}>{email || '—'}</div>
                        </div>
                        <div style={{ ...sectionCard, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div>
                                <label className="label" style={{ fontSize: 11, marginBottom: 4 }}>First name</label>
                                <input className="input" value={firstName} readOnly tabIndex={-1} style={readOnlyInputStyle} />
                            </div>
                            <div>
                                <label className="label" style={{ fontSize: 11, marginBottom: 4 }}>Last name</label>
                                <input className="input" value={lastName} readOnly tabIndex={-1} style={readOnlyInputStyle} />
                            </div>
                        </div>
                        <button className="btn btn-primary" type="button" style={{ ...primaryButtonStyle, width: '100%', marginTop: 16 }} onClick={() => moveStep('phone')} disabled={!identityReady || !token}>
                            Continue to phone verification
                        </button>
                    </>
                )}

                {!completed && step === 'phone' && (
                    <>
                        <div style={{ ...sectionCard, marginBottom: 10 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                                <div style={{ minWidth: 170, flexShrink: 0 }}>
                                    <CustomSelect value={phoneCountry} onChange={setPhoneCountry} options={countryOptions} placeholder="Country" />
                                </div>
                                <input
                                    className="input"
                                    value={phoneLocal}
                                    onChange={e => setPhoneLocal(e.target.value.replace(/\D/g, '').slice(0, accountCountryMeta.digits))}
                                    placeholder={`${accountCountryMeta.digits} digits`}
                                    maxLength={accountCountryMeta.digits}
                                    autoComplete="tel-national"
                                    aria-label="Phone number (local digits)"
                                    style={{ ...inputStyle, flex: 1 }}
                                />
                            </div>
                            <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                                {`Saved as ${formattedPhone || '…'} (${accountCountryMeta.dialCode} + ${accountCountryMeta.digits} digits)`}
                            </p>
                        </div>
                        {phoneVerifiedForSubmit ? (
                            <div style={{ ...alertBox, background: 'var(--success-bg)', border: '1px solid rgba(46,125,50,0.2)', color: 'var(--success)', marginBottom: 12 }}>
                                Phone verified for {formattedPhone}
                            </div>
                        ) : (
                            <div style={{ ...sectionCard, marginTop: 0 }}>
                                <button type="button" className="btn btn-secondary" style={sendCodeButtonStyle} onClick={() => { void handleRequestSetupSmsOtp(); }} disabled={!phoneReady || requestingSmsOtp || otpCooldownSeconds > 0 || !token}>
                                    {requestingSmsOtp ? 'Sending…' : otpCooldownSeconds > 0 ? `Resend in ${otpCooldownSeconds}s` : 'Send verification code'}
                                </button>
                                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                                    <input
                                        ref={otpInputRef}
                                        className="input"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        placeholder="6-digit code"
                                        value={smsOtp}
                                        maxLength={6}
                                        onChange={e => setSmsOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        style={{ ...inputStyle, width: 210, letterSpacing: '0.2em', textAlign: 'center' }}
                                    />
                                    <button type="button" className="btn btn-primary" style={primaryButtonStyle} onClick={() => { void handleVerifySetupSmsOtp(); }} disabled={verifyingSmsOtp || smsOtp.replace(/\D/g, '').length !== 6 || !token || !phoneReady}>
                                        {verifyingSmsOtp ? 'Verifying…' : 'Verify'}
                                    </button>
                                </div>
                                {smsHint ? <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0' }}>{smsHint}</p> : null}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                            <button className="btn btn-secondary" type="button" style={{ ...secondaryButtonStyle, flex: 1 }} onClick={() => moveStep('info')}>
                                Back
                            </button>
                            <button className="btn btn-primary" type="button" style={{ ...primaryButtonStyle, flex: 1 }} onClick={() => moveStep('security')} disabled={!phoneVerifiedForSubmit}>
                                Continue
                            </button>
                        </div>
                    </>
                )}

                {!completed && step === 'security' && (
                    <>
                        <div style={{ ...alertBox, background: '#f7f9fd', border: '1px solid #d9e1ee', color: '#415067' }}>
                            Verified phone: <strong>{verifiedPhoneE164 || 'Not verified yet'}</strong>
                        </div>
                        <div style={{ ...sectionCard, marginBottom: 10 }}>
                            <div style={{ marginBottom: 8 }}>
                                <label className="label" style={{ fontSize: 11, marginBottom: 4 }}>Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input className="input" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" style={{ ...inputStyle, paddingRight: 42 }} />
                                    <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                                        <span className="material-icons-round" style={{ fontSize: 18 }}>{showPassword ? 'visibility_off' : 'visibility'}</span>
                                    </button>
                                </div>
                            </div>
                            <div style={{ marginBottom: 8 }}>
                                <label className="label" style={{ fontSize: 11, marginBottom: 4 }}>Confirm password</label>
                                <div style={{ position: 'relative' }}>
                                    <input className="input" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" style={{ ...inputStyle, paddingRight: 42 }} />
                                    <button type="button" onClick={() => setShowConfirmPassword(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                                        <span className="material-icons-round" style={{ fontSize: 18 }}>{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', marginBottom: 0, marginTop: 2 }}>
                                {passwordChecks.map(check => (
                                    <div key={check.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: check.met ? 'var(--success)' : 'var(--text-disabled)' }}>
                                        <span className="material-icons-round" style={{ fontSize: 12 }}>{check.met ? 'check_circle' : 'radio_button_unchecked'}</span>
                                        <span>{check.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="btn btn-secondary" type="button" style={{ ...secondaryButtonStyle, flex: 1 }} onClick={() => moveStep('phone')}>
                                Back
                            </button>
                            <button className="btn btn-primary" type="button" style={{ ...primaryButtonStyle, flex: 1 }} onClick={() => { void handleSubmit(); }} disabled={loading || !phoneVerifiedForSubmit || !passwordIsValid || password !== confirmPassword}>
                                {loading ? 'Setting up…' : 'Set up account'}
                            </button>
                        </div>
                    </>
                )}

                {!completed && <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, marginBottom: 0, textAlign: 'center' }}>Link expires in 48 hours.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
