'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { API_ENDPOINTS } from '@/lib/config';
import { SETUP_ACCOUNT_MOBILE_CSS } from '@/components/setupAccountMobileStyles';
import SetupAccountSecurityStep from '@/components/SetupAccountSecurityStep';

type SetupStep = 'info' | 'security';

const STEP_ORDER: SetupStep[] = ['info', 'security'];

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
    if (step !== 'info') query.set('step', step);
    const qs = query.toString();
    return qs ? `/setup-account?${qs}` : '/setup-account';
}

export default function SetupAccountStepper({ token, step }: { token: string; step: SetupStep }) {
    const router = useRouter();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [middleName, setMiddleName] = useState('');
    const [email, setEmail] = useState('');
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

    const identityReady = useMemo(
        () => Boolean(firstName.trim()) && Boolean(lastName.trim()),
        [firstName, lastName]
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
            if (typeof saved.firstName === 'string' && saved.firstName.trim()) setFirstName(saved.firstName);
            if (typeof saved.lastName === 'string' && saved.lastName.trim()) setLastName(saved.lastName);
            if (typeof saved.middleName === 'string') setMiddleName(saved.middleName);
            if (typeof saved.email === 'string' && saved.email.trim()) setEmail(saved.email);
        } catch {
            // Ignore invalid persisted data.
        }
    }, [token]);

    useEffect(() => {
        if (!token) return;
        window.sessionStorage.setItem(
            `setup-account:${token}`,
            JSON.stringify({ firstName, lastName, middleName, email }),
        );
    }, [token, firstName, lastName, middleName, email]);

    const moveStep = (next: SetupStep) => {
        router.push(buildStepHref(next, token));
    };

    const handleSubmit = async () => {
        setError('');
        setSuccess('');
        if (!token) {
            setError('Open this page from the setup link in your invitation email, then try again.');
            return;
        }
        if (!identityReady) {
            setError('Your invitation details are still loading or missing. Reopen the link from your email, or go back to the profile step.');
            if (step === 'security' && !prefillLoading) moveStep('info');
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
                    password,
                    token,
                }),
            });
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            if (!res.ok) {
                setError(setupApiMessage(data));
                return;
            }
            setSuccess(String(data.message || 'Your account is ready.'));
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
    const isCleanFlowStep = step === 'security';
    const profileReady = Boolean(token) && identityReady;
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
    return (
        <>
            <style>{SETUP_ACCOUNT_MOBILE_CSS}</style>
            <div
                className={[
                    'setup-account-shell',
                    'setup-step-shell',
                    isCleanFlowStep ? 'setup-step-shell--clean' : 'setup-step-shell--classic',
                ].join(' ')}
                style={shellRootStyle}
            >
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
                            Complete your account in two quick steps: confirm your profile and set a secure password.
                        </p>
                        <ol className="setup-aside-steps" aria-label="Setup progress">
                            {STEP_ORDER.map((item, idx) => {
                                const labels = { info: 'Profile', security: 'Password' } as const;
                                return (
                                    <li
                                        key={item}
                                        className={[
                                            idx < stepIndex ? 'is-done' : '',
                                            idx === stepIndex ? 'is-active' : '',
                                        ].filter(Boolean).join(' ') || undefined}
                                    >
                                        <span className="setup-aside-steps__num">{idx + 1}</span>
                                        <span>{labels[item]}</span>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                    <p style={{ position: 'relative', zIndex: 1, padding: '0 28px 18px', margin: 0, fontSize: 12, lineHeight: 1.55, color: 'rgba(255,255,255,0.72)' }}>
                        Use the invite link sent by your administrator.
                    </p>
                </aside>

                <div
                    className={
                        step === 'security'
                            ? 'setup-step-right setup-step-right--security'
                            : 'setup-step-right'
                    }
                    style={rightColumnStyle}
                >
                    <div
                        className="setup-account-scroll setup-step-scroll"
                        style={formScrollStyle}
                    >
                        <div
                            className={[
                                'setup-account-card',
                                'setup-step-inner',
                                isCleanFlowStep ? 'setup-step-inner--clean' : 'setup-step-inner--classic',
                            ].join(' ')}
                            style={formInnerStyle}
                        >
                            {isCleanFlowStep ? (
                                <p className="setup-desktop-step-label">
                                    Step {stepIndex + 1} of {STEP_ORDER.length}
                                </p>
                            ) : null}
                            {!isCleanFlowStep && (
                            <header style={{ textAlign: 'center', marginBottom: 22 }}>
                                <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', color: '#7A8A9E', margin: '0 0 4px' }}>
                                    STEP {stepIndex + 1} OF {STEP_ORDER.length}
                                </p>
                                <h2 style={{ fontSize: 'clamp(1.1rem, 2.8vw + 0.5rem, 1.5rem)', fontWeight: 800, color: '#0B1E3B', margin: 0, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                                    Set up account
                                </h2>
                            </header>
                            )}

                            <div
                                className={
                                    step === 'security'
                                        ? 'setup-step-card setup-step-card--security'
                                        : 'setup-step-card'
                                }
                                style={isCleanFlowStep ? undefined : cardSurface}
                            >
                                {!isCleanFlowStep && (
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
                                )}

                {prefillLoading && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px' }}>Loading invitation details…</p>}
                {!token && (
                    <div style={{ ...alertBox, background: 'var(--critical-bg)', border: '1px solid rgba(140,90,94,0.2)', color: 'var(--critical)' }}>
                        Use the invitation link from your email to open this page.
                    </div>
                )}
                {error && !isCleanFlowStep && <div style={{ ...alertBox, background: 'var(--critical-bg)', border: '1px solid rgba(140,90,94,0.2)', color: 'var(--critical)' }}>{error}</div>}
                {success && !completed && <div style={{ ...alertBox, background: 'var(--success-bg)', border: '1px solid rgba(46,125,50,0.2)', color: 'var(--success)' }}>{success}</div>}

                {completed ? (
                    <div style={{ padding: '14px 14px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(46,125,50,0.2)', background: 'var(--success-bg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--success)' }}>task_alt</span>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>You&apos;re all set</div>
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                            Your account is ready. Download the Helix app from the <strong>App Store</strong> or <strong>Google Play</strong>, then sign in with your email and the password you just created.
                            {facilityCode ? (
                                <> Your facility code is <strong>{facilityCode}</strong>.</>
                            ) : null}
                        </p>
                    </div>
                ) : null}

                {!completed && step === 'info' && (
                    <>
                        <div style={{ ...sectionCard, marginBottom: 10 }}>
                            <label className="label" style={{ fontSize: 11, marginBottom: 4 }}>Email</label>
                            <div className="input" style={readOnlyInputStyle}>{email || '—'}</div>
                        </div>
                        <div className="setup-name-grid" style={{ ...sectionCard, marginBottom: 10 }}>
                            <div>
                                <label className="label" style={{ fontSize: 11, marginBottom: 4 }}>First name</label>
                                <input className="input" value={firstName} readOnly tabIndex={-1} style={readOnlyInputStyle} />
                            </div>
                            <div>
                                <label className="label" style={{ fontSize: 11, marginBottom: 4 }}>Last name</label>
                                <input className="input" value={lastName} readOnly tabIndex={-1} style={readOnlyInputStyle} />
                            </div>
                        </div>
                        <button
                            className="btn btn-primary"
                            type="button"
                            style={{ ...primaryButtonStyle, width: '100%', marginTop: 16 }}
                            onClick={() => moveStep('security')}
                            disabled={!identityReady || !token}
                        >
                            Continue to password
                        </button>
                    </>
                )}

                {!completed && step === 'security' && (
                    <SetupAccountSecurityStep
                        password={password}
                        confirmPassword={confirmPassword}
                        showPassword={showPassword}
                        showConfirmPassword={showConfirmPassword}
                        onPasswordChange={setPassword}
                        onConfirmPasswordChange={setConfirmPassword}
                        onToggleShowPassword={() => setShowPassword(p => !p)}
                        onToggleShowConfirmPassword={() => setShowConfirmPassword(p => !p)}
                        passwordChecks={passwordChecks}
                        passwordIsValid={passwordIsValid}
                        profileReady={profileReady}
                        prefillLoading={prefillLoading}
                        loading={loading}
                        error={error}
                        stepIndex={stepIndex}
                        onBack={() => moveStep('info')}
                        onSubmit={() => { void handleSubmit(); }}
                    />
                )}


                {!completed && step !== 'security' && (
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, marginBottom: 0, textAlign: 'center' }}>
                        Link expires in 48 hours.
                    </p>
                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
