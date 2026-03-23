'use client';

import { useEffect, useState } from 'react';
import { API_ENDPOINTS } from '@/lib/config';
import { formatGhanaPhoneInput, isValidGhanaPhone } from '@/lib/phone';

export default function SetupAccountForm({ token }: { token: string }) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
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
        if (!firstName.trim() || !lastName.trim() || !phone.trim() || !password.trim()) {
            setError('Please fill all required fields.');
            return;
        }
        if (!isValidGhanaPhone(phone)) {
            setError('Phone must be in +233 format with 9 digits after it.');
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
                    phone: formatGhanaPhoneInput(phone),
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
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div>
                                    <label className="label">First Name *</label>
                                    <input className="input" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Kwame" />
                                </div>
                                <div>
                                    <label className="label">Last Name *</label>
                                    <input className="input" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Mensah" />
                                </div>
                            </div>

                            <div style={{ marginTop: 10 }}>
                                <label className="label">Phone *</label>
                                <input
                                    className="input"
                                    value={phone}
                                    onChange={e => setPhone(formatGhanaPhoneInput(e.target.value))}
                                    placeholder="+233201234567"
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
                                disabled={loading || !token}
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
