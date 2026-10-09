import { NextRequest, NextResponse } from 'next/server';
import { getInternalTokenFromCookie } from '@/lib/proxy-auth';
import { checkAccessToken, decodeJwtPayload, tokenExpiryMs } from '@/lib/session-token';

function clearInternalSession(response: NextResponse) {
    response.cookies.delete('helix-internal-session');
    response.cookies.delete('helix-support-mode');
    response.cookies.delete('helix-support-facility');
    response.cookies.delete('helix-support-facility-name');
    return response;
}

/** Internal admin session only. Does not read or clear the facility admin cookie. */
export async function GET(req: NextRequest) {
    const token = getInternalTokenFromCookie(req);
    const status = checkAccessToken(token, { requireInternal: true });
    if (status !== 'valid') {
        const response = NextResponse.json({ ok: false, reason: status }, { status: 401 });
        if (status !== 'missing') clearInternalSession(response);
        return response;
    }
    const payload = decodeJwtPayload(token || '');
    const expiresAt = payload ? tokenExpiryMs(payload) : null;
    return NextResponse.json({ ok: true, expires_at: expiresAt });
}

/** Sign out of the internal admin session only. */
export async function POST() {
    return clearInternalSession(NextResponse.json({ ok: true }));
}
