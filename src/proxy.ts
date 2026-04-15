import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'helix-session';

const PUBLIC_PATHS = ['/', '/login', '/setup-account', '/setup'];
const PUBLIC_PREFIXES = ['/api/auth', '/api/proxy', '/_next', '/favicon.ico', '/assets'];
const PUBLIC_FILE_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i;

export async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Allow public paths
    if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
    if (PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))) return NextResponse.next();
    if (PUBLIC_FILE_EXTENSIONS.test(pathname)) return NextResponse.next();

    // Check session cookie (token is from external backend, so we decode without signature verification)
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
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
