import { NextRequest } from 'next/server';

const COOKIE_NAME = 'helix-session';
const INTERNAL_COOKIE_NAME = 'helix-internal-session';

export function hasInternalSupportContext(req: NextRequest): boolean {
    return req.cookies.get('helix-support-mode')?.value === '1';
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
    if (hasInternalSupportContext(req)) {
        const internal = req.cookies.get(INTERNAL_COOKIE_NAME)?.value;
        if (internal) return internal;
    }
    return req.cookies.get(COOKIE_NAME)?.value;
}

/**
 * Gets internal-admin token from dedicated cookie.
 */
export function getInternalTokenFromCookie(req: NextRequest): string | undefined {
    return req.cookies.get(INTERNAL_COOKIE_NAME)?.value;
}
