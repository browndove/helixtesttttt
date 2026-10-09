export type TokenCheck = 'valid' | 'missing' | 'invalid' | 'expired';

function base64UrlDecode(input: string): string {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    try {
        const payload = JSON.parse(base64UrlDecode(parts[1])) as unknown;
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
        return payload as Record<string, unknown>;
    } catch {
        return null;
    }
}

/** Milliseconds since epoch, or null when the token has no expiry claim. */
export function tokenExpiryMs(payload: Record<string, unknown>): number | null {
    const raw = payload.expired_at ?? payload.exp;
    if (raw == null || raw === '') return null;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return raw < 1e12 ? raw * 1000 : raw;
    }
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) return null;
        if (/^\d+(\.\d+)?$/.test(trimmed)) {
            const asNum = Number(trimmed);
            return asNum < 1e12 ? asNum * 1000 : asNum;
        }
        const ms = Date.parse(trimmed);
        return Number.isFinite(ms) ? ms : null;
    }
    return null;
}

export function isInternalAdminPayload(payload: Record<string, unknown>): boolean {
    const user = payload.user && typeof payload.user === 'object' && !Array.isArray(payload.user)
        ? payload.user as Record<string, unknown>
        : null;
    return [
        payload.role,
        payload.system_role,
        payload.user_role,
        user?.role,
        user?.system_role,
        user?.user_role,
    ]
        .map(value => String(value || '').toLowerCase())
        .filter(Boolean)
        .some(role => role.includes('internal') || role.includes('superadmin') || role.includes('super_admin'));
}

export function checkAccessToken(token: string | undefined, options?: { requireInternal?: boolean }): TokenCheck {
    if (!token) return 'missing';
    const payload = decodeJwtPayload(token);
    if (!payload) return 'invalid';
    if (options?.requireInternal && !isInternalAdminPayload(payload)) return 'invalid';
    const expiry = tokenExpiryMs(payload);
    if (expiry != null && Date.now() >= expiry) return 'expired';
    return 'valid';
}
