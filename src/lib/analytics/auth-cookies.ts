/** Facility admin session (tenant user). */
export const FACILITY_SESSION_COOKIE = "helix-session";

/** Internal Helix staff session (superadmin / internal role). */
export const INTERNAL_SESSION_COOKIE = "helix-internal-session";

/** Set when internal admin is acting as a facility (support mode). */
export const SUPPORT_MODE_COOKIE = "helix-support-mode";

/** httpOnly — facility id while in support mode. */
export const SUPPORT_FACILITY_COOKIE = "helix-support-facility";

/** Readable by browser — facility id for client / proxy query hints. */
export const FACILITY_ID_COOKIE = "helix-facility";

export type SessionCookieOptions = {
    httpOnly?: boolean;
    maxAge?: number;
};

const DEFAULT_MAX_AGE = 60 * 60 * 8;

export function sessionCookieOptions(httpOnly: boolean, maxAge = DEFAULT_MAX_AGE) {
    return {
        httpOnly,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
        maxAge,
    };
}

export function parseJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        const payload = JSON.parse(atob(parts[1])) as Record<string, unknown>;
        return payload;
    } catch {
        return null;
    }
}

export function isTokenExpired(payload: Record<string, unknown>): boolean {
    const expiredAt = payload.expired_at ?? payload.exp;
    if (!expiredAt) return false;
    const expiry =
        typeof expiredAt === "string"
            ? new Date(expiredAt).getTime()
            : typeof expiredAt === "number"
              ? expiredAt * 1000
              : 0;
    return Boolean(expiry && Date.now() > expiry);
}

export function isTokenValid(token: string | undefined): boolean {
    if (!token) return false;
    const payload = parseJwtPayload(token);
    if (!payload) return false;
    return !isTokenExpired(payload);
}

export function isInternalAdminPayload(payload: Record<string, unknown>): boolean {
    const role = String(payload.role ?? payload.internal_role ?? payload.user_type ?? "").toLowerCase();
    if (role === "superadmin" || role === "internal" || role === "internal_admin") return true;
    if (payload.is_internal === true || payload.internal_admin === true) return true;
    return false;
}

export function isInternalAdminToken(token: string | undefined): boolean {
    if (!token) return false;
    const payload = parseJwtPayload(token);
    if (!payload || isTokenExpired(payload)) return false;
    return isInternalAdminPayload(payload);
}

export function isSupportMode(req: { cookies: { get: (name: string) => { value?: string } | undefined } }): boolean {
    return req.cookies.get(SUPPORT_MODE_COOKIE)?.value === "1";
}

export function getSupportFacilityId(req: {
    cookies: { get: (name: string) => { value?: string } | undefined };
}): string | undefined {
    const fromSupport = req.cookies.get(SUPPORT_FACILITY_COOKIE)?.value?.trim();
    if (fromSupport) return fromSupport;
    return req.cookies.get(FACILITY_ID_COOKIE)?.value?.trim() || undefined;
}

export const SUPPORT_COOKIE_NAMES = [
    SUPPORT_MODE_COOKIE,
    SUPPORT_FACILITY_COOKIE,
    FACILITY_ID_COOKIE,
] as const;

export const INTERNAL_COOKIE_NAMES = [INTERNAL_SESSION_COOKIE, ...SUPPORT_COOKIE_NAMES] as const;
