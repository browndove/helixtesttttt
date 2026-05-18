'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { API_ENDPOINTS } from '@/lib/config';
import {
    PHONE_COUNTRIES,
    formatPhoneByCountry,
    getPhoneCountryByCode,
    isValidPhoneByCountry,
    splitPhoneForCountryInput,
} from '@/lib/phone';
import CustomSelect from '@/components/CustomSelect';
import { SETUP_ACCOUNT_MOBILE_CSS } from '@/components/setupAccountMobileStyles';

export type SetupAccountFormVariant = 'account' | 'facility';

function inferFacilitySetupFromPrefill(data: Record<string, unknown>): boolean {
    if (data.is_facility_setup === true) return true;
    const raw = data.setup_kind ?? data.invite_kind ?? data.setup_type;
    const sk = String(raw || '').toLowerCase();
    return sk === 'facility' || sk === 'organization' || sk === 'org';
}

/** Read JWT payload (unsigned) for facility claims — same token as setup-prefill. */
function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
    if (!jwt || typeof jwt !== 'string') return null;
    try {
        const parts = jwt.split('.');
        if (parts.length < 2) return null;
        let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const pad = b64.length % 4;
        if (pad) b64 += '='.repeat(4 - pad);
        const json = atob(b64);
        return JSON.parse(json) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function pickString(r: unknown): string {
    if (typeof r === 'string' && r.trim()) return r.trim();
    return '';
}

function extractFacilityNameFromClaims(p: Record<string, unknown> | null): string {
    if (!p) return '';
    const direct: unknown[] = [
        p.facility_name,
        p.hospital_name,
        p.organization_name,
        p.org_name,
        p.site_name,
        p.facility_display_name,
        p.facilityName,
    ];
    for (const d of direct) {
        const s = pickString(d);
        if (s) return s;
    }
    for (const key of ['facility', 'hospital', 'organization', 'org', 'hospital_data']) {
        const v = p[key];
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            const o = v as Record<string, unknown>;
            const s = pickString(o.name) || pickString(o.display_name) || pickString(o.legal_name);
            if (s) return s;
        }
    }
    return '';
}

function extractFacilityNameFromPrefill(data: Record<string, unknown>): string {
    const p = data;
    const direct: unknown[] = [
        p.facility_name,
        p.hospital_name,
        p.organization_name,
        p.org_name,
        p.site_name,
        p.facility_display_name,
    ];
    for (const d of direct) {
        const s = pickString(d);
        if (s) return s;
    }
    for (const key of ['facility', 'hospital', 'organization', 'hospital_data']) {
        const v = p[key];
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            const o = v as Record<string, unknown>;
            const s = pickString(o.name) || pickString(o.display_name);
            if (s) return s;
        }
    }
    return '';
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
        const s = pickString(item);
        if (s) return s;
    }
    for (const key of ['facility', 'organization', 'org', 'hospital']) {
        const nested = data[key];
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
            const obj = nested as Record<string, unknown>;
            const s = pickString(obj.facility_code) || pickString(obj.facilityCode) || pickString(obj.code);
            if (s) return s;
        }
    }
    return '';
}

const readOnlyFieldStyle: CSSProperties = {
    background: 'var(--surface-2)',
    color: 'var(--text-secondary)',
    cursor: 'default',
    borderColor: 'var(--border-subtle)',
};

/** Display-only block (not an input) so the value cannot be edited. */
function setupApiMessage(data: Record<string, unknown>): string {
    return String(data.message || data.detail || data.error || '').trim() || 'Request failed';
}

const readOnlyDisplayStyle: CSSProperties = {
    ...readOnlyFieldStyle,
    outline: 'none',
    boxShadow: 'none',
    userSelect: 'text',
    wordBreak: 'break-word',
};

export default function SetupAccountForm({
    token,
    variant = 'account',
}: {
    token: string;
    variant?: SetupAccountFormVariant;
}) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [middleName, setMiddleName] = useState('');
    const [email, setEmail] = useState('');
    const [phoneCountry, setPhoneCountry] = useState('GH');
    const [phoneLocal, setPhoneLocal] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [prefillLoading, setPrefillLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [completed, setCompleted] = useState(false);
    /** When prefill marks this invite as facility/org admin, match dedicated facility setup UX. */
    const [prefillFacility, setPrefillFacility] = useState(false);
    /** Display name for facility flow — from JWT and/or prefill, never from first/last name fields. */
    const [facilityName, setFacilityName] = useState('');
    const [facilityCode, setFacilityCode] = useState('');
    /** Staff setup: SMS OTP must succeed before POST /auth/setup; same E.164 string for request, verify, setup. */
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [verifiedPhoneE164, setVerifiedPhoneE164] = useState('');
    const [smsOtp, setSmsOtp] = useState('');
    const [otpCooldownSeconds, setOtpCooldownSeconds] = useState(0);
    const [requestingSmsOtp, setRequestingSmsOtp] = useState(false);
    const [verifyingSmsOtp, setVerifyingSmsOtp] = useState(false);
    const [smsHint, setSmsHint] = useState('');
    const otpInputRef = useRef<HTMLInputElement | null>(null);

    const isFacilitySetup = variant === 'facility' || prefillFacility;

    const passwordChecks = [
        { id: 'length', label: 'At least 8 characters', met: password.length >= 8 },
        { id: 'upper', label: 'At least one uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
        { id: 'lower', label: 'At least one lowercase letter (a-z)', met: /[a-z]/.test(password) },
        { id: 'digit', label: 'At least one number (0-9)', met: /[0-9]/.test(password) },
        { id: 'special', label: 'At least one special character (e.g. !@#$%^&*)', met: /[^A-Za-z0-9]/.test(password) },
    ];
    const passwordIsValid = passwordChecks.every(check => check.met);

    const identityReady = useMemo(
        () => Boolean(firstName.trim()) && Boolean(lastName.trim()),
        [firstName, lastName]
    );
    const countryOptions = useMemo(
        () => PHONE_COUNTRIES.map(c => ({ label: c.label, value: c.code })),
        []
    );
    const accountCountryMeta = useMemo(() => getPhoneCountryByCode(phoneCountry), [phoneCountry]);
    const formattedAccountPhone = useMemo(
        () => formatPhoneByCountry(phoneLocal, phoneCountry),
        [phoneLocal, phoneCountry]
    );
    /** Staff account setup requires a verified number; facility setup does not collect phone here. */
    const phoneReady = useMemo(() => {
        if (isFacilitySetup) return true;
        if (!phoneLocal.trim()) return false;
        return isValidPhoneByCountry(formattedAccountPhone, phoneCountry);
    }, [isFacilitySetup, phoneLocal, phoneCountry, formattedAccountPhone]);
    const profileReady = useMemo(
        () => identityReady && phoneReady,
        [identityReady, phoneReady]
    );
    const staffPhoneVerifiedForSubmit = useMemo(
        () => phoneVerified && verifiedPhoneE164 !== '' && verifiedPhoneE164 === formattedAccountPhone,
        [phoneVerified, verifiedPhoneE164, formattedAccountPhone],
    );
    const staffSetupReady = useMemo(
        () => isFacilitySetup || (profileReady && staffPhoneVerifiedForSubmit),
        [isFacilitySetup, profileReady, staffPhoneVerifiedForSubmit],
    );
    useEffect(() => {
        if (!token) return;
        const fromToken = extractFacilityNameFromClaims(decodeJwtPayload(token));
        if (fromToken) setFacilityName(fromToken);
        const codeFromToken = extractFacilityCode(decodeJwtPayload(token));
        if (codeFromToken) setFacilityCode(prev => prev || codeFromToken);
    }, [token]);

    useEffect(() => {
        if (otpCooldownSeconds <= 0) return;
        const id = setInterval(() => {
            setOtpCooldownSeconds(s => (s <= 1 ? 0 : s - 1));
        }, 1000);
        return () => clearInterval(id);
    }, [otpCooldownSeconds]);

    useEffect(() => {
        if (isFacilitySetup) return;
        if (verifiedPhoneE164 && formattedAccountPhone !== verifiedPhoneE164) {
            setPhoneVerified(false);
            setVerifiedPhoneE164('');
            setSmsOtp('');
            setSmsHint('');
        }
    }, [formattedAccountPhone, verifiedPhoneE164, isFacilitySetup]);

    useEffect(() => {
        if (!token) return;
        let canceled = false;

        const loadPrefill = async () => {
            setPrefillLoading(true);
            try {
                const res = await fetch(`${API_ENDPOINTS.SETUP_PREFILL}?token=${encodeURIComponent(token)}`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok || canceled) return;
                const rec = data as Record<string, unknown>;

                if (typeof data.first_name === 'string') setFirstName(data.first_name);
                if (typeof data.last_name === 'string') setLastName(data.last_name);
                if (typeof data.middle_name === 'string') setMiddleName(data.middle_name);
                if (typeof data.email === 'string') setEmail(data.email.trim());
                if (inferFacilitySetupFromPrefill(rec)) {
                    setPrefillFacility(true);
                }
                const nameFromApi = extractFacilityNameFromPrefill(rec);
                if (nameFromApi) setFacilityName(nameFromApi);
                const codeFromApi = extractFacilityCode(rec);
                if (codeFromApi) setFacilityCode(prev => prev || codeFromApi);
                if (typeof data.phone === 'string' && data.phone.trim()) {
                    const split = splitPhoneForCountryInput(String(data.phone));
                    setPhoneCountry(split.countryCode);
                    setPhoneLocal(split.local);
                }
            } catch {
                // Prefill is best-effort. Form still works without it.
            } finally {
                if (!canceled) setPrefillLoading(false);
            }
        };

        loadPrefill();
        return () => { canceled = true; };
    }, [token]);

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
                body: JSON.stringify({ token, phone: formattedAccountPhone }),
            });
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            if (res.status === 429 || res.ok) {
                setOtpCooldownSeconds(60);
            }
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
                body: JSON.stringify({ token, phone: formattedAccountPhone, otp: code }),
            });
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            if (!res.ok) {
                setError(setupApiMessage(data));
                return;
            }
            setPhoneVerified(true);
            setVerifiedPhoneE164(formattedAccountPhone);
            setSmsHint(String(data.message || 'Phone verified. You can complete setup below.'));
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setVerifyingSmsOtp(false);
        }
    };

    const handleSubmit = async () => {
        setError('');
        setSuccess('');
        setFacilityCode('');

        if (!token) {
            setError('Open this page from the setup link in your invitation email, then try again.');
            return;
        }
        if (!identityReady) {
            setError('We could not load your invitation details. Open the setup link from your email again, or ask your administrator to resend the invite.');
            return;
        }
        if (!isFacilitySetup && !phoneReady) {
            setError(
                !phoneLocal.trim()
                    ? 'Please enter your phone number with country code.'
                    : `Please enter a valid phone number for ${accountCountryMeta.label} (${accountCountryMeta.dialCode} + ${accountCountryMeta.digits} digits).`
            );
            return;
        }
        if (!isFacilitySetup && !staffPhoneVerifiedForSubmit) {
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
                    phone: isFacilitySetup ? '' : formattedAccountPhone,
                    password,
                    token,
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = data?.message || data?.detail || data?.error || 'Account setup failed';
                setError(msg);
                setLoading(false);
                return;
            }

            setSuccess(
                data?.message
                || (isFacilitySetup ? 'Facility admin access is ready' : 'Account activated successfully')
            );
            const responseFacilityCode = extractFacilityCode(data);
            if (responseFacilityCode) setFacilityCode(responseFacilityCode);
            setCompleted(true);
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const alertBox: CSSProperties = {
        padding: '8px 10px',
        borderRadius: 'var(--radius-md)',
        marginBottom: 8,
        fontSize: 12,
    };

    const displayFacilityTitle = facilityName.trim() || 'Your organization';
    const displayFacilityCode = facilityCode.trim() || 'Unavailable';

    const passwordHintBullets = [
        { key: 'len', text: '8 or more characters', met: password.length >= 8 },
        { key: 'ul', text: 'Upper and lowercase letters', met: /[A-Z]/.test(password) && /[a-z]/.test(password) },
        { key: 'num', text: 'At least one number', met: /[0-9]/.test(password) },
        { key: 'spec', text: 'At least one special character', met: /[^A-Za-z0-9]/.test(password) },
    ] as const;

    const formAlertsAndFields = (opts: { facilityMode: boolean }) => (
        <>
            {error && (
                <div style={{ ...alertBox, background: 'var(--critical-bg)', border: '1px solid rgba(140,90,94,0.2)', color: 'var(--critical)' }}>
                    {error}
                </div>
            )}
            {success && !completed && (
                <div style={{ ...alertBox, background: 'var(--success-bg)', border: '1px solid rgba(46,125,50,0.2)', color: 'var(--success)' }}>
                    {success}
                </div>
            )}

            {!completed ? (
                <>
                    {!token && (
                        <div
                            style={{
                                ...alertBox,
                                background: 'var(--critical-bg)',
                                border: '1px solid rgba(140,90,94,0.2)',
                                color: 'var(--critical)',
                                fontSize: 12,
                                lineHeight: 1.5,
                            }}
                        >
                            {opts.facilityMode
                                ? 'Use the link in your facility invitation email to open this page. Typing the site address alone will not work.'
                                : 'Use the link in your invitation email to open this page. Typing the site address alone will not work.'}
                        </div>
                    )}
                    {!prefillLoading && token && !identityReady && (
                        <div style={{ ...alertBox, background: 'var(--critical-bg)', border: '1px solid rgba(140,90,94,0.2)', color: 'var(--critical)' }}>
                            {opts.facilityMode
                                ? 'We could not load this invitation. Open the full link from your email, or ask your organization to resend it.'
                                : 'Your account details could not be loaded. Open the setup link from your invitation email, or contact your administrator.'}
                        </div>
                    )}
                    {!opts.facilityMode && !prefillLoading && token && identityReady && phoneLocal.trim() && !phoneReady && (
                        <div style={{ ...alertBox, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#b45309' }}>
                            {`This number does not match ${accountCountryMeta.label} (${accountCountryMeta.dialCode} + ${accountCountryMeta.digits} digits).`}
                        </div>
                    )}

                    {!opts.facilityMode && (
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.4 }}>
                            Name and email come from your invite. Enter your mobile number, verify it with the SMS code, then choose a password.
                        </p>
                    )}

                    {!opts.facilityMode && email ? (
                        <div style={{ marginBottom: 8 }}>
                            <label className="label" style={{ fontSize: 11, marginBottom: 4 }}>Email</label>
                            <div
                                className="input"
                                tabIndex={-1}
                                aria-label={`Email from invitation: ${email}. Not editable.`}
                                style={readOnlyDisplayStyle}
                            >
                                {email}
                            </div>
                        </div>
                    ) : null}

                    {!opts.facilityMode && (
                        <div className="setup-staff-form-grid">
                            <div>
                                <label className="label" style={{ fontSize: 11, marginBottom: 4 }}>First name</label>
                                <input
                                    className="input"
                                    value={firstName}
                                    readOnly
                                    tabIndex={-1}
                                    aria-readonly="true"
                                    placeholder="—"
                                    style={readOnlyFieldStyle}
                                />
                            </div>
                            <div>
                                <label className="label" style={{ fontSize: 11, marginBottom: 4 }}>Last name</label>
                                <input
                                    className="input"
                                    value={lastName}
                                    readOnly
                                    tabIndex={-1}
                                    aria-readonly="true"
                                    placeholder="—"
                                    style={readOnlyFieldStyle}
                                />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label className="label" style={{ fontSize: 11, marginBottom: 4 }}>Phone *</label>
                                <div className="setup-phone-row">
                                    <div className="setup-country-wrap">
                                        <CustomSelect
                                            value={phoneCountry}
                                            onChange={v => setPhoneCountry(v)}
                                            options={countryOptions}
                                            placeholder="Country"
                                        />
                                    </div>
                                    <input
                                        className="input setup-phone-input"
                                        value={phoneLocal}
                                        onChange={e => setPhoneLocal(e.target.value.replace(/\D/g, '').slice(0, accountCountryMeta.digits))}
                                        placeholder={`${accountCountryMeta.digits} digits`}
                                        maxLength={accountCountryMeta.digits}
                                        autoComplete="tel-national"
                                        aria-label="Phone number (local digits)"
                                    />
                                </div>
                                <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--text-muted)' }}>
                                    {`Format: ${accountCountryMeta.dialCode} + ${accountCountryMeta.digits} digits (saved as ${formattedAccountPhone || '…'})`}
                                </div>
                            </div>
                            <div
                                style={{
                                    gridColumn: '1 / -1',
                                    marginTop: 4,
                                    padding: '10px 10px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-subtle)',
                                    background: 'var(--surface-2)',
                                }}
                            >
                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                                    Phone verification (SMS)
                                </div>
                                {staffPhoneVerifiedForSubmit ? (
                                    <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span className="material-icons-round" style={{ fontSize: 16 }}>check_circle</span>
                                        Phone verified for {formattedAccountPhone}
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm setup-sms-send-btn"
                                            style={{ marginBottom: 8 }}
                                            onClick={() => { void handleRequestSetupSmsOtp(); }}
                                            disabled={!phoneReady || requestingSmsOtp || otpCooldownSeconds > 0 || !token}
                                        >
                                            {requestingSmsOtp ? 'Sending…' : otpCooldownSeconds > 0 ? `Resend in ${otpCooldownSeconds}s` : 'Send verification code'}
                                        </button>
                                        <div className="setup-otp-row">
                                            <input
                                                ref={otpInputRef}
                                                className="input setup-otp-input"
                                                inputMode="numeric"
                                                autoComplete="one-time-code"
                                                placeholder="6-digit code"
                                                value={smsOtp}
                                                maxLength={6}
                                                onChange={e => setSmsOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                style={{ fontSize: 14, letterSpacing: '0.2em', textAlign: 'center' }}
                                            />
                                            <button
                                                type="button"
                                                className="btn btn-primary btn-sm setup-otp-verify-btn"
                                                onClick={() => { void handleVerifySetupSmsOtp(); }}
                                                disabled={verifyingSmsOtp || smsOtp.replace(/\D/g, '').length !== 6 || !token || !phoneReady}
                                            >
                                                {verifyingSmsOtp ? 'Verifying…' : 'Verify'}
                                            </button>
                                        </div>
                                        <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '8px 0 0', lineHeight: 1.4 }}>
                                            Code is valid 5 minutes. After too many wrong attempts, request a new code. If your number is already in use at this facility, contact your administrator.
                                        </p>
                                    </>
                                )}
                                {smsHint && !error ? (
                                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '8px 0 0', lineHeight: 1.4 }}>{smsHint}</p>
                                ) : null}
                            </div>
                        </div>
                    )}

                    {opts.facilityMode ? (
                        <>
                            <div style={{ marginTop: 0 }}>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        className="input"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="Create a strong password"
                                        style={{ padding: '6px 38px 6px 10px', background: '#fff', fontSize: 13 }}
                                    />
                                    <button
                                        type="button"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        onClick={() => setShowPassword(prev => !prev)}
                                        style={{
                                            position: 'absolute',
                                            right: 8,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            border: 'none',
                                            background: 'transparent',
                                            color: 'var(--text-muted)',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <span className="material-icons-round" style={{ fontSize: 18 }}>
                                            {showPassword ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                                <div
                                    style={{
                                        marginTop: 6,
                                        background: 'rgba(11, 74, 163, 0.08)',
                                        border: '1px solid rgba(11, 74, 163, 0.16)',
                                        borderRadius: 8,
                                        padding: '6px 8px 8px',
                                    }}
                                >
                                    <p style={{ fontSize: 11, fontWeight: 600, color: '#334155', margin: '0 0 4px' }}>Password must contain:</p>
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '2px 8px',
                                            fontSize: 10,
                                            lineHeight: 1.3,
                                            color: '#64748b',
                                        }}
                                    >
                                        {passwordHintBullets.map(b => (
                                            <div
                                                key={b.key}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: 3,
                                                    color: b.met ? 'var(--success)' : 'inherit',
                                                }}
                                            >
                                                <span
                                                    className="material-icons-round"
                                                    style={{ fontSize: 12, flexShrink: 0, lineHeight: 1.2, color: b.met ? 'var(--success)' : 'var(--text-disabled)' }}
                                                >
                                                    {b.met ? 'check_circle' : 'radio_button_unchecked'}
                                                </span>
                                                <span>{b.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: 8 }}>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>Confirm Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        className="input"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder="Re-enter your password"
                                        style={{ padding: '6px 38px 6px 10px', background: '#fff', fontSize: 13 }}
                                    />
                                    <button
                                        type="button"
                                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                                        onClick={() => setShowConfirmPassword(prev => !prev)}
                                        style={{
                                            position: 'absolute',
                                            right: 8,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            border: 'none',
                                            background: 'transparent',
                                            color: 'var(--text-muted)',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <span className="material-icons-round" style={{ fontSize: 18 }}>
                                            {showConfirmPassword ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <button
                                className="btn btn-primary"
                                type="button"
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                    marginTop: 12,
                                    padding: '9px 12px',
                                    fontSize: 14,
                                    fontWeight: 600,
                                }}
                                onClick={handleSubmit}
                                disabled={loading || !profileReady}
                            >
                                {loading ? 'Activating…' : 'Activate facility'}
                                {!loading && <span className="material-icons-round" style={{ fontSize: 16 }}>arrow_forward</span>}
                            </button>

                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 4,
                                    marginTop: 8,
                                    fontSize: 10,
                                    color: '#64748b',
                                }}
                            >
                                <span className="material-icons-round" style={{ fontSize: 14 }}>schedule</span>
                                <span>Link valid 48h from invite (see email).</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ marginTop: 8 }}>
                                <label className="label" style={{ fontSize: 11, marginBottom: 4 }}>Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        className="input"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="At least 8 characters"
                                        style={{ paddingRight: 42 }}
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
                                <div
                                    style={{
                                        marginTop: 6,
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: '2px 8px',
                                    }}
                                >
                                    {passwordChecks.map(check => (
                                        <div
                                            key={check.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                fontSize: 10,
                                                lineHeight: 1.3,
                                                color: check.met ? 'var(--success)' : 'var(--text-disabled)',
                                            }}
                                        >
                                            <span className="material-icons-round" style={{ fontSize: 12, flexShrink: 0 }}>
                                                {check.met ? 'check_circle' : 'radio_button_unchecked'}
                                            </span>
                                            <span>{check.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginTop: 8 }}>
                                <label className="label" style={{ fontSize: 11, marginBottom: 4 }}>Confirm password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        className="input"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder="Re-enter password"
                                        style={{ paddingRight: 42 }}
                                    />
                                    <button
                                        type="button"
                                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                                        onClick={() => setShowConfirmPassword(prev => !prev)}
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
                                            {showConfirmPassword ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <button
                                className="btn btn-primary btn-sm"
                                style={{ width: '100%', justifyContent: 'center', marginTop: 12, padding: '8px 14px' }}
                                onClick={handleSubmit}
                                disabled={loading || !staffSetupReady}
                            >
                                {loading ? 'Setting up...' : 'Set up account'}
                            </button>

                            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, marginBottom: 0, textAlign: 'center' }}>
                                Link expires in 48 hours.
                            </p>
                        </>
                    )}
                </>
            ) : opts.facilityMode ? (
                <div style={{
                    marginTop: 2,
                    padding: '8px 8px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(46,125,50,0.2)',
                    background: 'var(--success-bg)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <span className="material-icons-round" style={{ fontSize: 15, color: 'var(--success)' }}>task_alt</span>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{displayFacilityTitle} is ready</div>
                    </div>
                    <p style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4, margin: '0 0 6px' }}>
                        Open the Helix Admin Portal and sign in with the email above and your new password.
                    </p>
                    <div
                        style={{
                            marginBottom: 6,
                            padding: '6px 8px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid rgba(11,74,163,0.2)',
                            background: 'rgba(11,74,163,0.08)',
                            fontSize: 10.5,
                            color: '#0b3a6e',
                        }}
                    >
                        Your facility code is <strong>{displayFacilityCode}</strong>.
                    </div>
                    <Link
                        href="/login"
                        className="btn btn-primary btn-sm"
                        style={{ width: '100%', justifyContent: 'center', display: 'inline-flex', textDecoration: 'none', padding: '6px 12px', fontSize: 12 }}
                    >
                        <span className="material-icons-round" style={{ fontSize: 15 }}>login</span>
                        Admin sign-in
                    </Link>
                </div>
            ) : (
                <div style={{
                    marginTop: 4,
                    padding: '10px 10px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(46,125,50,0.2)',
                    background: 'var(--success-bg)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--success)' }}>task_alt</span>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Account is ready</div>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
                        Open the Helix app and sign in with your email and new password.
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.45, margin: '6px 0 0' }}>
                        Your facility code is <strong>{displayFacilityCode}</strong>.
                    </p>
                </div>
            )}
        </>
    );

    const accountShellStyle: CSSProperties = {
        minHeight: '100dvh',
        background: 'linear-gradient(180deg, #f6f8fb 0%, #eef3f8 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflowX: 'clip',
        isolation: 'isolate',
    };

    const accountWatermarkBase: CSSProperties = {
        position: 'absolute',
        pointerEvents: 'none',
        borderRadius: '999px',
        filter: 'blur(1px)',
        opacity: 1,
        zIndex: 0,
    };

    if (isFacilitySetup) {
        const gridPattern: CSSProperties = {
            height: '100dvh',
            minHeight: '100dvh',
            maxHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            backgroundColor: '#f0efec',
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 16px, rgba(0,0,0,0.035) 17px), repeating-linear-gradient(90deg, transparent, transparent 16px, rgba(0,0,0,0.035) 17px)',
        };
        return (
            <div className="setup-facility-shell" style={gridPattern}>
                <style>{SETUP_ACCOUNT_MOBILE_CSS}</style>
                <header
                    className="setup-facility-header"
                    style={{
                        position: 'sticky' as const,
                        top: 0,
                        zIndex: 40,
                        background: '#ffffff',
                        borderBottom: '1px solid var(--border-default)',
                        height: 48,
                        padding: '0 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexShrink: 0,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                overflow: 'hidden',
                            }}
                        >
                            <img
                                src="/brand-logo.svg"
                                alt="Helix logo"
                                width={28}
                                height={28}
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em', color: 'var(--text-primary)', lineHeight: 1.15 }}>
                                Helix
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginTop: 0 }}>
                                Facility setup
                            </div>
                        </div>
                    </div>
                    <span
                        className="material-icons-round"
                        style={{ fontSize: 20, color: 'var(--text-disabled)' }}
                        title="Help"
                        aria-hidden
                    >
                        help_outline
                    </span>
                </header>

                <main
                    className="setup-facility-main"
                    style={{
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        overflowY: 'auto',
                    }}
                >
                    <div
                        className="setup-facility-card"
                        style={{
                            width: '100%',
                            background: '#fff',
                            borderRadius: 12,
                            border: '1px solid #e8e4df',
                            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                            padding: '18px 16px 16px',
                        }}
                    >
                        <h1
                            id="facility-setup-title"
                            style={{ textAlign: 'center', fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}
                        >
                            Setup your facility
                        </h1>
                        <p style={{ textAlign: 'center', fontSize: 12, color: '#64748b', margin: '0 0 10px', lineHeight: 1.4 }}>
                            Activate your administrative access to begin configuration.
                        </p>
                        {prefillLoading && (
                            <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', margin: '0 0 8px' }}>Loading…</p>
                        )}

                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                background: 'linear-gradient(90deg, rgba(11, 74, 163, 0.1) 0%, rgba(11, 74, 163, 0.06) 100%)',
                                border: '1px solid rgba(11, 74, 163, 0.18)',
                                borderRadius: 8,
                                padding: '7px 10px',
                                marginBottom: 8,
                                fontSize: 12,
                                fontWeight: 600,
                                color: '#0b3a6e',
                            }}
                        >
                            <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--helix-primary)' }}>apartment</span>
                            <span>Facility: {displayFacilityTitle}</span>
                        </div>
                        {email ? (
                            <p style={{ fontSize: 11, color: '#64748b', textAlign: 'center', margin: '0 0 8px' }}>
                                <span style={{ fontWeight: 600, color: '#334155' }}>Administrator</span> · {email}
                            </p>
                        ) : null}

                        {formAlertsAndFields({ facilityMode: true })}
                    </div>
                </main>

                <footer
                    style={{
                        padding: '6px 12px 8px',
                        textAlign: 'center',
                        fontSize: 10,
                        color: '#94a3b8',
                        flexShrink: 0,
                    }}
                >
                    <span>Helix facility onboarding · link valid 48h from send</span>
                </footer>
            </div>
        );
    }

    return (
        <div className="setup-staff-shell setup-account-shell" style={accountShellStyle}>
            <style>
                {`${SETUP_ACCOUNT_MOBILE_CSS}
@keyframes staffSetupFloatA {
  0%, 100% { transform: translate3d(0,0,0) scale(1); opacity: 0.28; }
  50% { transform: translate3d(14px,-10px,0) scale(1.05); opacity: 0.4; }
}
@keyframes staffSetupFloatB {
  0%, 100% { transform: translate3d(0,0,0) scale(1.02); opacity: 0.22; }
  50% { transform: translate3d(-12px,8px,0) scale(0.98); opacity: 0.34; }
}
@keyframes staffSetupMeshDrift {
  0%, 100% { background-position: 0% 0%, 0% 0%; opacity: 0.3; }
  50% { background-position: 42px 30px, -28px -24px; opacity: 0.42; }
}
@media (prefers-reduced-motion: reduce) {
  .staff-setup-watermark-a,
  .staff-setup-watermark-b,
  .staff-setup-watermark-mesh { animation: none !important; opacity: 0.24 !important; }
}
`}
            </style>
            <div
                aria-hidden
                className="staff-setup-watermark-mesh"
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 0,
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 21px, rgba(30,64,175,0.09) 22px), repeating-linear-gradient(90deg, transparent, transparent 21px, rgba(14,116,144,0.08) 22px)',
                    animation: 'staffSetupMeshDrift 20s ease-in-out infinite',
                }}
            />
            <div
                aria-hidden
                className="staff-setup-watermark-a"
                style={{
                    ...accountWatermarkBase,
                    width: 420,
                    height: 420,
                    top: -120,
                    right: -80,
                    background: 'radial-gradient(ellipse at center, rgba(37,99,235,0.36) 0%, rgba(37,99,235,0.12) 58%, rgba(37,99,235,0) 100%)',
                    animation: 'staffSetupFloatA 18s ease-in-out infinite',
                }}
            />
            <div
                aria-hidden
                className="staff-setup-watermark-b"
                style={{
                    ...accountWatermarkBase,
                    width: 420,
                    height: 420,
                    left: -95,
                    bottom: -120,
                    background: 'radial-gradient(ellipse at center, rgba(37,99,235,0.34) 0%, rgba(37,99,235,0.11) 58%, rgba(37,99,235,0) 100%)',
                    animation: 'staffSetupFloatB 22s ease-in-out infinite',
                }}
            />
            <div className="setup-staff-card-wrap setup-account-card" style={{ width: '100%', position: 'relative', zIndex: 1, maxHeight: '100%' }}>
                <div className="setup-staff-card" style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'clamp(16px, 4vw, 18px) clamp(14px, 3.5vw, 16px)',
                    boxShadow: '0 14px 34px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(0,0,0,0.05)',
                    maxHeight: 'calc(100dvh - max(32px, env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px)))',
                    overflowY: 'auto',
                }}>
                    <div style={{ textAlign: 'center', marginBottom: 12 }}>
                        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Set up account</h1>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                            Complete setup to sign in to Helix.
                        </p>
                        {prefillLoading && (
                            <p style={{ fontSize: 10, color: 'var(--text-disabled)', marginTop: 6, marginBottom: 0 }}>
                                Loading…
                            </p>
                        )}
                    </div>

                    {formAlertsAndFields({ facilityMode: false })}
                </div>
            </div>
        </div>
    );
}
