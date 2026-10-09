import { NextRequest, NextResponse } from 'next/server';
import { checkAccessToken } from '@/lib/session-token';

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
    const internalStatus = checkAccessToken(internalToken, { requireInternal: true });

    const redirectInternalLogin = () => {
        const response = NextResponse.redirect(new URL('/internal/login', req.url));
        response.cookies.delete(INTERNAL_COOKIE_NAME);
        response.cookies.delete(SUPPORT_MODE_COOKIE);
        response.cookies.delete('helix-support-facility');
        response.cookies.delete('helix-support-facility-name');
        return response;
    };

    // Internal pages use only the internal session. Never send them to facility login.
    if (isInternalRoute) {
        if (internalStatus !== 'valid') return redirectInternalLogin();
        return NextResponse.next();
    }

    // Act-as facility pages are still the internal admin's session.
    if (supportMode) {
        if (internalStatus !== 'valid') return redirectInternalLogin();
        return NextResponse.next();
    }

    // Facility admin pages use only the facility session.
    if (!standardToken) {
        if (internalStatus === 'valid') {
            return NextResponse.redirect(new URL('/internal/dashboard', req.url));
        }
        return NextResponse.redirect(new URL('/login', req.url));
    }

    const facilityStatus = checkAccessToken(standardToken);
    if (facilityStatus === 'valid') return NextResponse.next();

    const response = NextResponse.redirect(new URL('/login', req.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
