'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import CustomSelect from '@/components/CustomSelect';
import { formatPhoneForDisplay } from '@/lib/phone';

type CountryOption = { label: string; value: string; triggerLabel?: string };

type SetupAccountPhoneStepProps = {
    stepIndex: number;
    phoneCountry: string;
    phoneLocal: string;
    formattedPhone: string;
    countryOptions: CountryOption[];
    countryDialOptions: CountryOption[];
    phoneDigits: number;
    onPhoneCountryChange: (code: string) => void;
    onPhoneLocalChange: (local: string) => void;
    smsOtp: string;
    onOtpChange: (value: string) => void;
    otpCodeSent: boolean;
    phoneVerifiedForSubmit: boolean;
    phoneReady: boolean;
    requestingSmsOtp: boolean;
    verifyingSmsOtp: boolean;
    otpCooldownSeconds: number;
    error?: string;
    onBack: () => void;
    onSendCode: () => void;
    onVerifyOtp: () => void;
    onEditNumber: () => void;
    onContinue: () => void;
};

const STEP_COUNT = 3;
const OTP_LENGTH = 6;

export default function SetupAccountPhoneStep({
    stepIndex,
    phoneCountry,
    phoneLocal,
    formattedPhone,
    countryOptions,
    countryDialOptions,
    phoneDigits,
    onPhoneCountryChange,
    onPhoneLocalChange,
    smsOtp,
    onOtpChange,
    otpCodeSent,
    phoneVerifiedForSubmit,
    phoneReady,
    requestingSmsOtp,
    verifyingSmsOtp,
    otpCooldownSeconds,
    error,
    onBack,
    onSendCode,
    onVerifyOtp,
    onEditNumber,
    onContinue,
}: SetupAccountPhoneStepProps) {
    const otpInputRef = useRef<HTMLInputElement | null>(null);
    const lastAutoVerifyOtp = useRef('');
    const displayPhone = formatPhoneForDisplay(formattedPhone);
    const otpDigits = smsOtp.replace(/\D/g, '').slice(0, OTP_LENGTH);
    const showOtpPhase = otpCodeSent && !phoneVerifiedForSubmit;
    const showNumberPhase = !showOtpPhase && !phoneVerifiedForSubmit;

    useEffect(() => {
        if (showOtpPhase) {
            const t = setTimeout(() => otpInputRef.current?.focus(), 80);
            return () => clearTimeout(t);
        }
        lastAutoVerifyOtp.current = '';
    }, [showOtpPhase]);

    useEffect(() => {
        if (!showOtpPhase || verifyingSmsOtp || phoneVerifiedForSubmit) return;
        if (otpDigits.length !== OTP_LENGTH) {
            lastAutoVerifyOtp.current = '';
            return;
        }
        if (lastAutoVerifyOtp.current === otpDigits) return;
        lastAutoVerifyOtp.current = otpDigits;
        onVerifyOtp();
    }, [otpDigits, showOtpPhase, verifyingSmsOtp, phoneVerifiedForSubmit, onVerifyOtp]);

    const resendLabel =
        requestingSmsOtp
            ? 'Sending…'
            : otpCooldownSeconds > 0
              ? `Resend OTP (${otpCooldownSeconds}s)`
              : 'Resend OTP';

    const layoutClass = [
        'setup-security-layout',
        showNumberPhase ? 'setup-flow-page' : '',
        showOtpPhase ? 'setup-phone-phase--otp' : '',
        phoneVerifiedForSubmit ? 'setup-phone-phase--verified' : '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={layoutClass}>
            <div className="setup-security-topbar">
                <button
                    type="button"
                    className="setup-security-back"
                    aria-label={showOtpPhase ? 'Change phone number' : 'Back'}
                    onClick={showOtpPhase ? onEditNumber : onBack}
                >
                    <span className="material-icons-round" style={{ fontSize: 22 }}>chevron_left</span>
                </button>
                {showNumberPhase ? (
                    <button type="button" className="setup-flow-cancel" onClick={onBack}>
                        Cancel
                    </button>
                ) : (
                    <Link href="/login" className="setup-security-skip">
                        Sign in
                    </Link>
                )}
            </div>

            {error ? (
                <div className="setup-flow-alert setup-flow-alert--error" role="alert">
                    {error}
                </div>
            ) : null}

            {phoneVerifiedForSubmit ? (
                <>
                    <h1 className="setup-security-heading">Phone verified</h1>
                    <p className="setup-security-subtitle">
                        Your number <strong>{displayPhone || formattedPhone}</strong> is confirmed. Continue to set your password.
                    </p>
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
                        onClick={onContinue}
                    >
                        Continue
                    </button>
                </>
            ) : showOtpPhase ? (
                <>
                    <h1 className="setup-security-heading">OTP Sent!</h1>
                    <p className="setup-otp-instruction">
                        Enter the {OTP_LENGTH}-digit code sent to you at{' '}
                        <strong>{displayPhone || formattedPhone || 'your number'}</strong>.{' '}
                        <button type="button" className="setup-otp-edit-link" onClick={onEditNumber}>
                            Did you enter the correct number?
                        </button>
                    </p>

                    <div className="setup-otp-input-wrap">
                        <input
                            ref={otpInputRef}
                            className="setup-otp-input-clean"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder={'•'.repeat(OTP_LENGTH)}
                            value={otpDigits}
                            maxLength={OTP_LENGTH}
                            aria-label={`${OTP_LENGTH}-digit verification code`}
                            onChange={e => onOtpChange(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                        />
                    </div>

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
                        onClick={onSendCode}
                        disabled={requestingSmsOtp || otpCooldownSeconds > 0 || !phoneReady}
                    >
                        {resendLabel}
                    </button>

                    <button
                        type="button"
                        className="setup-otp-help"
                        onClick={onSendCode}
                        disabled={requestingSmsOtp || otpCooldownSeconds > 0 || !phoneReady}
                    >
                        I don&apos;t receive code
                    </button>

                    {verifyingSmsOtp ? (
                        <p style={{ marginTop: 16, fontSize: 13, color: '#64748b', textAlign: 'center' }}>
                            Verifying…
                        </p>
                    ) : null}
                </>
            ) : (
                <>
                    <div className="setup-flow-body">
                        <h1 className="setup-security-heading">Phone number</h1>
                        <p className="setup-flow-subtitle-dark">
                            Required information to complete your account setup.
                        </p>

                        <div className="setup-flow-field">
                            <div className="setup-flow-country-picker">
                                <CustomSelect
                                    value={phoneCountry}
                                    onChange={onPhoneCountryChange}
                                    options={countryDialOptions.length > 0 ? countryDialOptions : countryOptions}
                                    placeholder="+"
                                    dropdownMinWidth={280}
                                    searchPlaceholder="Search country or code…"
                                />
                            </div>
                            <input
                                className="setup-flow-field-input"
                                value={phoneLocal}
                                onChange={e => onPhoneLocalChange(e.target.value.replace(/\D/g, '').slice(0, phoneDigits))}
                                placeholder="Phone number"
                                maxLength={phoneDigits}
                                autoComplete="tel-national"
                                aria-label="Phone number"
                                inputMode="numeric"
                            />
                            <span className="setup-flow-field-icon material-icons-round" aria-hidden>
                                phone
                            </span>
                        </div>
                    </div>

                    <div className="setup-flow-footer">
                        <button
                            type="button"
                            className="btn btn-primary setup-security-continue"
                            onClick={onSendCode}
                            disabled={!phoneReady || requestingSmsOtp}
                        >
                            {requestingSmsOtp ? 'Sending…' : 'Continue'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
