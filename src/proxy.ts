import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'helix-session';
const INTERNAL_COOKIE_NAME = 'helix-internal-session';
const SUPPORT_MODE_COOKIE = 'helix-support-mode';

const PUBLIC_PATHS = ['/', '/login', '/forgot-password', '/reset-password', '/setup-account', '/setup-facility', '/setup', '/internal/login'];
const PUBLIC_PREFIXES = ['/api/auth', '/api/proxy', '/_next', '/favicon.ico', '/assets'];
const PUBLIC_FILE_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i;

export async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Allow public paths (magic-link staff phone update is unauthenticated; token is in query string)
    if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
    if (pathname === '/update-phone' || pathname.startsWith('/update-phone/')) return NextResponse.next();
    if (PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))) return NextResponse.next();
    if (PUBLIC_FILE_EXTENSIONS.test(pathname)) return NextResponse.next();

    const isInternalRoute = pathname.startsWith('/internal');
    const standardToken = req.cookies.get(COOKIE_NAME)?.value;
    const internalToken = req.cookies.get(INTERNAL_COOKIE_NAME)?.value;
    const supportMode = req.cookies.get(SUPPORT_MODE_COOKIE)?.value === '1';

    // Internal routes require dedicated internal session.
    if (isInternalRoute) {
        if (!internalToken) {
            return NextResponse.redirect(new URL('/internal/login', req.url));
        }
        try {
            const parts = internalToken.split('.');
            if (parts.length !== 3) throw new Error('Invalid token format');
            const payload = JSON.parse(atob(parts[1]));
            const roleCandidates = [
                payload?.role,
                payload?.system_role,
                payload?.user_role,
                payload?.user?.role,
                payload?.user?.system_role,
                payload?.user?.user_role,
            ]
                .map((v: unknown) => String(v || '').toLowerCase())
                .filter(Boolean);
            const isInternal = roleCandidates.some((r: string) => r.includes('internal') || r.includes('superadmin') || r.includes('super_admin'));
            if (!isInternal) throw new Error('Not internal role');

            const expiredAt = payload.expired_at || payload.exp;
            if (expiredAt) {
                const expiry = typeof expiredAt === 'string' ? new Date(expiredAt).getTime() : expiredAt * 1000;
                if (Date.now() > expiry) throw new Error('Token expired');
            }
            return NextResponse.next();
        } catch {
            const response = NextResponse.redirect(new URL('/internal/login', req.url));
            response.cookies.delete(INTERNAL_COOKIE_NAME);
            return response;
        }
    }

    // Regular app routes: allow standard session OR internal support session.
    const token = standardToken || (supportMode ? internalToken : undefined);
    if (!token) {
        // If an internal admin has a live internal session but no support-mode context yet,
        // send them to the internal dashboard to choose a facility.
        if (internalToken) {
            return NextResponse.redirect(new URL('/internal/dashboard', req.url));
        }
        return NextResponse.redirect(new URL('/login', req.url));
    }

    try {
        // Decode JWT payload to check expiry (token is signed by external backend)
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Invalid token format');
        const payload = JSON.parse(atob(parts[1]));

        // Check if token is expired using the backend's expired_at claim or standard exp
        const expiredAt = payload.expired_at || payload.exp;
        if (expiredAt) {
            const expiry = typeof expiredAt === 'string' ? new Date(expiredAt).getTime() : expiredAt * 1000;
            if (Date.now() > expiry) throw new Error('Token expired');
        }

        return NextResponse.next();
    } catch {
        // Invalid or expired token
        const response = NextResponse.redirect(new URL('/login', req.url));
        response.cookies.delete(COOKIE_NAME);
        return response;
    }
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
