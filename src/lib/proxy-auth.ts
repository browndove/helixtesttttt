import { NextRequest } from 'next/server';

const COOKIE_NAME = 'helix-session';
const INTERNAL_COOKIE_NAME = 'helix-internal-session';

export function hasInternalSupportContext(req: NextRequest): boolean {
    return req.cookies.get('helix-support-mode')?.value === '1';
}

/** True when the request carries an internal-admin session (support mode or not). */
export function hasInternalAdminSession(req: NextRequest): boolean {
    return Boolean(getInternalTokenFromCookie(req));
}

/** Tenant proxy routes need facility_id only while internal admin is in act-as (support) mode. */
export function isInternalScopedRequest(req: NextRequest): boolean {
    return hasInternalSupportContext(req);
}

/**
 * Extracts the backend access token from the session cookie
 * and returns headers with Authorization for proxying to the backend.
 */
export function getProxyHeaders(req: NextRequest): HeadersInit {
    const token = getTokenFromCookie(req);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

/**
 * Gets just the token string from the cookie.
 */
export function getTokenFromCookie(req: NextRequest): string | undefined {
    const internal = req.cookies.get(INTERNAL_COOKIE_NAME)?.value;
    if (hasInternalSupportContext(req) && internal) return internal;
    const standard = req.cookies.get(COOKIE_NAME)?.value;
    if (standard) return standard;
    return internal;
}

/**
 * Gets internal-admin token from dedicated cookie.
 */
export function getInternalTokenFromCookie(req: NextRequest): string | undefined {
    return req.cookies.get(INTERNAL_COOKIE_NAME)?.value;
}
