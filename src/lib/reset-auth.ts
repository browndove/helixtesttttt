import { decodeTokenClaims, getClaimString } from '@/lib/token-claims';

const RESET_OTP_SESSION_KEY = 'helix_reset_otp';
const RESET_EMAIL_SESSION_KEY = 'helix_reset_email';

export function extractEmailFromResetToken(resetToken: string): string {
    const claims = decodeTokenClaims(resetToken.trim());
    return getClaimString(claims, ['email', 'Email', 'user_email', 'work_email', 'sub']) || readStoredResetEmail();
}

export function storeResetEmail(email: string): void {
    if (typeof window === 'undefined') return;
    const normalized = email.trim().toLowerCase();
    if (normalized) sessionStorage.setItem(RESET_EMAIL_SESSION_KEY, normalized);
}

export function readStoredResetEmail(): string {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem(RESET_EMAIL_SESSION_KEY) || '';
}

export function clearStoredResetEmail(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(RESET_EMAIL_SESSION_KEY);
}

export function extractOtpFromResetToken(resetToken: string): string {
    const claims = decodeTokenClaims(resetToken.trim());
    return getClaimString(claims, ['otp', 'OTP', 'code']);
}

export function storeResetOtp(otp: string): void {
    if (typeof window === 'undefined') return;
    const normalized = otp.replace(/\D/g, '').slice(0, 6);
    if (normalized.length === 6) {
        sessionStorage.setItem(RESET_OTP_SESSION_KEY, normalized);
    }
}

export function readStoredResetOtp(): string {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem(RESET_OTP_SESSION_KEY) || '';
}

export function clearStoredResetOtp(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(RESET_OTP_SESSION_KEY);
    sessionStorage.removeItem(RESET_EMAIL_SESSION_KEY);
}

export function resolveResetOtp(resetToken: string): string {
    return readStoredResetOtp() || extractOtpFromResetToken(resetToken);
}

export function buildResetPasswordBody(resetToken: string, newPassword: string): Record<string, string> {
    const token = resetToken.trim();
    const email = extractEmailFromResetToken(token);
    const otp = resolveResetOtp(token);
    return {
        email,
        otp,
        new_password: newPassword,
        reset_token: token,
    };
}
