'use client';

import Link from 'next/link';

type PasswordCheck = { id: string; label: string; met: boolean };

type SetupAccountSecurityStepProps = {
    password: string;
    confirmPassword: string;
    showPassword: boolean;
    showConfirmPassword: boolean;
    onPasswordChange: (value: string) => void;
    onConfirmPasswordChange: (value: string) => void;
    onToggleShowPassword: () => void;
    onToggleShowConfirmPassword: () => void;
    passwordChecks: PasswordCheck[];
    passwordIsValid: boolean;
    verifiedPhoneE164: string;
    loading: boolean;
    phoneVerifiedForSubmit: boolean;
    stepIndex: number;
    onBack: () => void;
    onSubmit: () => void;
};

const STEP_COUNT = 3;

export default function SetupAccountSecurityStep({
    password,
    confirmPassword,
    showPassword,
    showConfirmPassword,
    onPasswordChange,
    onConfirmPasswordChange,
    onToggleShowPassword,
    onToggleShowConfirmPassword,
    passwordChecks,
    passwordIsValid,
    verifiedPhoneE164,
    loading,
    phoneVerifiedForSubmit,
    stepIndex,
    onBack,
    onSubmit,
}: SetupAccountSecurityStepProps) {
    const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
    const canSubmit = !loading && phoneVerifiedForSubmit && passwordIsValid && passwordsMatch;
    const showHints = password.length > 0 || confirmPassword.length > 0;

    return (
        <div className="setup-security-layout">
            <div className="setup-security-topbar">
                <button
                    type="button"
                    className="setup-security-back"
                    aria-label="Back to phone verification"
                    onClick={onBack}
                >
                    <span className="material-icons-round" style={{ fontSize: 22 }}>chevron_left</span>
                </button>
                <Link href="/login" className="setup-security-skip">
                    Sign in
                </Link>
            </div>

            <h1 className="setup-security-heading">Set Password</h1>
            <p className="setup-security-subtitle">
                Required information to complete your account setup.
            </p>

            {verifiedPhoneE164 ? (
                <p className="setup-security-verified">
                    Verified mobile: <strong>{verifiedPhoneE164}</strong>
                </p>
            ) : null}

            <div className="setup-security-fields">
                <div className="setup-security-field-wrap">
                    <input
                        id="setup-password"
                        className="setup-security-input"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => onPasswordChange(e.target.value)}
                        placeholder="Password"
                        autoComplete="new-password"
                    />
                    <button
                        type="button"
                        className="setup-security-toggle"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={onToggleShowPassword}
                    >
                        <span className="material-icons-round" style={{ fontSize: 20 }}>
                            {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                    </button>
                </div>
                <div className="setup-security-field-wrap">
                    <input
                        id="setup-password-confirm"
                        className="setup-security-input"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => onConfirmPasswordChange(e.target.value)}
                        placeholder="Repeat Password"
                        autoComplete="new-password"
                    />
                    <button
                        type="button"
                        className="setup-security-toggle"
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        onClick={onToggleShowConfirmPassword}
                    >
                        <span className="material-icons-round" style={{ fontSize: 20 }}>
                            {showConfirmPassword ? 'visibility_off' : 'visibility'}
                        </span>
                    </button>
                </div>
            </div>

            {showHints && (
                <div className="setup-security-hints">
                    <ul>
                        {passwordChecks.map(check => (
                            <li key={check.id} className={check.met ? 'is-met' : undefined}>
                                <span className="material-icons-round" style={{ fontSize: 14 }}>
                                    {check.met ? 'check_circle' : 'radio_button_unchecked'}
                                </span>
                                {check.label}
                            </li>
                        ))}
                        <li className={passwordsMatch ? 'is-met' : undefined}>
                            <span className="material-icons-round" style={{ fontSize: 14 }}>
                                {passwordsMatch ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                            Passwords match
                        </li>
                    </ul>
                </div>
            )}

            <div className="setup-dot-progress" aria-hidden>
                {Array.from({ length: STEP_COUNT }, (_, idx) => (
                    <span
                        key={idx}
                        className={[
                            idx === stepIndex ? 'is-active' : '',
                            idx < stepIndex ? 'is-done' : '',
                        ].filter(Boolean).join(' ') || undefined}
                    />
                ))}
            </div>

            <button
                type="button"
                className="btn btn-primary setup-security-continue"
                onClick={onSubmit}
                disabled={!canSubmit}
            >
                {loading ? 'Setting up…' : 'Continue'}
            </button>

            <div className="setup-security-footer">
                Already have an account?
                <br />
                <Link href="/login">
                    LOGIN <span className="material-icons-round" style={{ fontSize: 14 }}>chevron_right</span>
                </Link>
            </div>
        </div>
    );
}
