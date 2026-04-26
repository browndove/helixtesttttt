'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { API_ENDPOINTS } from '@/lib/config';
import { formatGhanaPhoneInput, isValidGhanaPhone } from '@/lib/phone';

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

const readOnlyFieldStyle: CSSProperties = {
    background: 'var(--surface-2)',
    color: 'var(--text-secondary)',
    cursor: 'default',
    borderColor: 'var(--border-subtle)',
};

/** Display-only block (not an input) so the value cannot be edited. */
const readOnlyDisplayStyle: CSSProperties = {
    ...readOnlyFieldStyle,
    outline: 'none',
    boxShadow: 'none',
    userSelect: 'text',
    wordBreak: 'break-word',
};

/** True when user entered more than the Ghana country code (optional field). */
function ghanaPhoneHasLocalDigits(phone: string): boolean {
    const d = String(phone || '').replace(/\D/g, '');
    if (!d) return false;
    if (d.startsWith('233')) return d.length > 3;
    if (d.startsWith('0')) return d.length > 1;
    return d.length > 0;
}

export default function SetupAccountForm({
    token,
    variant = 'account',
}: {
    token: string;
    variant?: SetupAccountFormVariant;
}) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
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
    const phoneReady = useMemo(
        () => !ghanaPhoneHasLocalDigits(phone) || isValidGhanaPhone(phone),
        [phone]
    );
    const profileReady = useMemo(
        () => identityReady && phoneReady,
        [identityReady, phoneReady]
    );
    const phoneMissingFromInvite = useMemo(
        () => !ghanaPhoneHasLocalDigits(phone),
        [phone]
    );

    useEffect(() => {
        if (!token) return;
        const fromToken = extractFacilityNameFromClaims(decodeJwtPayload(token));
        if (fromToken) setFacilityName(fromToken);
    }, [token]);

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
                if (typeof data.email === 'string') setEmail(data.email.trim());
                if (inferFacilitySetupFromPrefill(rec)) {
                    setPrefillFacility(true);
                }
                const nameFromApi = extractFacilityNameFromPrefill(rec);
                if (nameFromApi) setFacilityName(nameFromApi);
                if (typeof data.phone === 'string') {
                    const formatted = formatGhanaPhoneInput(data.phone);
                    setPhone(isValidGhanaPhone(formatted) ? formatted : '');
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

    const handleSubmit = async () => {
        setError('');
        setSuccess('');

        if (!token) {
            setError('Open this page from the setup link in your invitation email, then try again.');
            return;
        }
        if (!identityReady || !phoneReady || !password.trim()) {
            setError(
                !identityReady
                    ? 'We could not load your invitation details. Open the setup link from your email again, or ask your administrator to resend the invite.'
                    : !phoneReady
                        ? 'If you enter phone, use a valid Ghana phone number.'
                    : 'Please enter and confirm your password.'
            );
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
                    last_name: lastName.trim(),
                    phone: ghanaPhoneHasLocalDigits(phone) ? formatGhanaPhoneInput(phone) : '',
                    password,
                    token,
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = data?.message || data?.detail || 'Account setup failed';
                setError(msg);
                setLoading(false);
                return;
            }

            setSuccess(
                data?.message
                || (isFacilitySetup ? 'Facility admin access is ready' : 'Account activated successfully')
            );
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
                                ? 'To set up your facility, open this page from the invitation email you received—the message has a button or link that takes you here with everything ready. If you typed the website address yourself, go back to that email and use the link there instead.'
                                : 'To finish creating your account, open this page from your invitation email and tap the setup link there. That link is what lets you continue—typing the site address on its own will not work.'}
                        </div>
                    )}
                    {!prefillLoading && token && !identityReady && (
                        <div style={{ ...alertBox, background: 'var(--critical-bg)', border: '1px solid rgba(140,90,94,0.2)', color: 'var(--critical)' }}>
                            {opts.facilityMode
                                ? 'We could not load this invitation. Open the full link from your email, or ask your organization to resend it.'
                                : 'Your account details could not be loaded. Open the setup link from your invitation email, or contact your administrator.'}
                        </div>
                    )}
                    {!opts.facilityMode && !prefillLoading && token && identityReady && !phoneReady && ghanaPhoneHasLocalDigits(phone) && (
                        <div style={{ ...alertBox, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#b45309' }}>
                            Phone is optional. If provided, it must be a valid Ghana number.
                        </div>
                    )}

                    {!opts.facilityMode && (
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.4 }}>
                            Name and email are from your invite. Phone optional.
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
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
                        </div>
                    )}

                    {!opts.facilityMode && (
                        <div style={{ marginTop: 8 }}>
                            <label className="label" style={{ fontSize: 11, marginBottom: 4 }}>Phone <span style={{ color: 'var(--text-disabled)', fontWeight: 400 }}>(optional)</span></label>
                            <input
                                className="input"
                                value={phone}
                                onChange={e => {
                                    const next = formatGhanaPhoneInput(e.target.value);
                                    setPhone(isValidGhanaPhone(next) || ghanaPhoneHasLocalDigits(next) ? next : '');
                                }}
                                readOnly={!phoneMissingFromInvite}
                                tabIndex={phoneMissingFromInvite ? 0 : -1}
                                aria-readonly={phoneMissingFromInvite ? 'false' : 'true'}
                                placeholder={phoneMissingFromInvite ? '+233…' : '—'}
                                style={phoneMissingFromInvite ? undefined : readOnlyFieldStyle}
                            />
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
                                disabled={loading}
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
                                disabled={loading}
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
                </div>
            )}
        </>
    );

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
            <div style={gridPattern}>
                <header
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
                                src="/helix-logo.png"
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
                    style={{
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        padding: '10px 12px 12px',
                        overflowY: 'auto',
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            maxWidth: 400,
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
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-900)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px 12px',
        }}>
            <div style={{ width: '100%', maxWidth: 400 }}>
                <div style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '18px 16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
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
