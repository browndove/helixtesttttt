'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { API_ENDPOINTS } from '@/lib/config';
import { formatGhanaPhoneInput, isValidGhanaPhone } from '@/lib/phone';

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

export default function SetupAccountForm({ token }: { token: string }) {
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
        () => !phone.trim() || isValidGhanaPhone(phone),
        [phone]
    );
    const profileReady = useMemo(
        () => identityReady && phoneReady,
        [identityReady, phoneReady]
    );
    const phoneMissingFromInvite = useMemo(
        () => !phone.trim(),
        [phone]
    );

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
                if (typeof data.email === 'string') setEmail(data.email.trim());
                if (typeof data.phone === 'string') setPhone(formatGhanaPhoneInput(data.phone));
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
            setError('Missing setup token. Use the full link from your email.');
            return;
        }
        if (!identityReady || !phoneReady || !password.trim()) {
            setError(
                !identityReady
                    ? 'Your account details could not be loaded. Please use the full setup link from your invitation email.'
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
                    phone: phone.trim() ? formatGhanaPhoneInput(phone) : '',
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

            setSuccess(data?.message || 'Account activated successfully');
            setCompleted(true);
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-900)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 16px',
        }}>
            <div style={{ width: '100%', maxWidth: 460 }}>
                <div style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '28px 24px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}>
                    <div style={{ textAlign: 'center', marginBottom: 18 }}>
                        <h1 style={{ fontSize: 24, marginBottom: 6 }}>Set Up Account</h1>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            Complete your Helix account setup to sign in.
                        </p>
                        {prefillLoading && (
                            <p style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 6 }}>
                                Loading invite details...
                            </p>
                        )}
                    </div>

                    {!token && (
                        <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--critical-bg)', border: '1px solid rgba(140,90,94,0.2)', marginBottom: 12, fontSize: 12.5, color: 'var(--critical)' }}>
                            Setup token is missing from URL.
                        </div>
                    )}
                    {error && (
                        <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--critical-bg)', border: '1px solid rgba(140,90,94,0.2)', marginBottom: 12, fontSize: 12.5, color: 'var(--critical)' }}>
                            {error}
                        </div>
                    )}
                    {success && (
                        <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--success-bg)', border: '1px solid rgba(46,125,50,0.2)', marginBottom: 12, fontSize: 12.5, color: 'var(--success)' }}>
                            {success}
                        </div>
                    )}

                    {!completed ? (
                        <>
                            {!prefillLoading && token && !identityReady && (
                                <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--critical-bg)', border: '1px solid rgba(140,90,94,0.2)', marginBottom: 12, fontSize: 12.5, color: 'var(--critical)' }}>
                                    Your account details could not be loaded. Open the setup link from your invitation email, or contact your administrator.
                                </div>
                            )}
                            {!prefillLoading && token && identityReady && !phoneReady && phone.trim() && (
                                <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: 12, fontSize: 12.5, color: '#b45309' }}>
                                    Phone is optional. If provided, it must be a valid Ghana number.
                                </div>
                            )}

                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.45 }}>
                                Your name and email come from your invitation and cannot be changed here. Phone is optional.
                            </p>

                            {email ? (
                                <div style={{ marginBottom: 10 }}>
                                    <label className="label">Email</label>
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

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div>
                                    <label className="label">First name</label>
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
                                    <label className="label">Last name</label>
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

                            <div style={{ marginTop: 10 }}>
                                <label className="label">Phone</label>
                                <input
                                    className="input"
                                    value={phone}
                                    onChange={e => setPhone(formatGhanaPhoneInput(e.target.value))}
                                    readOnly={!phoneMissingFromInvite}
                                    tabIndex={phoneMissingFromInvite ? 0 : -1}
                                    aria-readonly={phoneMissingFromInvite ? 'false' : 'true'}
                                    placeholder={phoneMissingFromInvite ? 'Enter Ghana phone number' : '—'}
                                    style={phoneMissingFromInvite ? undefined : readOnlyFieldStyle}
                                />
                            </div>

                            <div style={{ marginTop: 10 }}>
                                <label className="label">Password *</label>
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
                                <div style={{ marginTop: 8, display: 'grid', gap: 5 }}>
                                    {passwordChecks.map(check => (
                                        <div
                                            key={check.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 7,
                                                fontSize: 12,
                                                color: check.met ? 'var(--success)' : 'var(--text-disabled)',
                                            }}
                                        >
                                            <span className="material-icons-round" style={{ fontSize: 15 }}>
                                                {check.met ? 'check_circle' : 'radio_button_unchecked'}
                                            </span>
                                            <span>{check.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginTop: 10 }}>
                                <label className="label">Confirm Password *</label>
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
                                className="btn btn-primary"
                                style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
                                onClick={handleSubmit}
                                disabled={loading || !token || !profileReady}
                            >
                                {loading ? 'Setting up...' : 'Set up account'}
                            </button>

                            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
                                Link expires in 48 hours.
                            </p>
                        </>
                    ) : (
                        <div style={{
                            marginTop: 8,
                            padding: '14px 12px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid rgba(46,125,50,0.2)',
                            background: 'var(--success-bg)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--success)' }}>task_alt</span>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Account is ready</div>
                            </div>
                            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 8 }}>
                                Download the Helix app and sign in with your email and new password.
                            </p>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                                If the app is already installed, open it now and complete sign-in.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
