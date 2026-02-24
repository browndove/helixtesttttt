import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret');
const COOKIE_NAME = 'helix-session';

const PUBLIC_PATHS = ['/', '/login'];
const PUBLIC_PREFIXES = ['/api/auth', '/_next', '/favicon.ico'];

export async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Allow public paths
    if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
    if (PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))) return NextResponse.next();

    // Check session cookie
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.redirect(new URL('/', req.url));
    }

    try {
        await jwtVerify(token, SECRET);
        return NextResponse.next();
    } catch {
        // Invalid or expired token
        const response = NextResponse.redirect(new URL('/', req.url));
        response.cookies.delete(COOKIE_NAME);
        return response;
    }
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
