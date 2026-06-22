import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/config';

const INTERNAL_SESSION_COOKIE = 'helix-internal-session';

function roleCandidatesFromRecord(rec: Record<string, unknown>): string[] {
    const user = rec.user && typeof rec.user === 'object' && !Array.isArray(rec.user)
        ? rec.user as Record<string, unknown>
        : undefined;
    return [
        rec.role,
        rec.user_role,
        rec.system_role,
        user?.role,
        user?.user_role,
        user?.system_role,
    ]
        .map((v) => String(v || '').trim().toLowerCase())
        .filter(Boolean);
}

function isInternalRole(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    return roleCandidatesFromRecord(payload as Record<string, unknown>)
        .some((r) => r.includes('internal') || r.includes('superadmin') || r.includes('super_admin'));
}

function isInternalRoleFromToken(token: string): boolean {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        const payload = JSON.parse(atob(parts[1]!)) as Record<string, unknown>;
        return isInternalRole(payload);
    } catch {
        return false;
    }
}

function extractAccessToken(payload: unknown): string {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';
    const rec = payload as Record<string, unknown>;
    const direct = String(rec.access_token || rec.accessToken || rec.token || '').trim();
    if (direct) return direct;

    for (const nest of [rec.data, rec.result, rec.payload]) {
        if (!nest || typeof nest !== 'object' || Array.isArray(nest)) continue;
        const nested = nest as Record<string, unknown>;
        const t = String(nested.access_token || nested.accessToken || nested.token || '').trim();
        if (t) return t;
    }
    return '';
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const email = String(body?.email || '').trim().toLowerCase();
        const otp = String(body?.otp || '').trim();
        const verifyUrl = `${API_BASE_URL}/api/v1/auth/internal/verify-otp`;

        const res = await fetch(verifyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...body, email, otp }),
            signal: AbortSignal.timeout(15000),
        });

        const text = await res.text();
        let data: unknown;
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            return NextResponse.json(
                { error: 'Backend returned invalid response', details: text.substring(0, 200) },
                { status: 502 },
            );
        }

        if (!res.ok) {
            return NextResponse.json(data, { status: res.status });
        }

        const token = extractAccessToken(data);
        if (!token) {
            return NextResponse.json({ error: 'OTP verification succeeded without access token' }, { status: 502 });
        }
        if (!isInternalRole(data) && !isInternalRoleFromToken(token)) {
            return NextResponse.json({ error: 'Account is not authorized for internal admin access' }, { status: 403 });
        }

        const response = NextResponse.json(data, { status: 200 });
        response.cookies.set(INTERNAL_SESSION_COOKIE, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 8,
        });
        response.cookies.delete('helix-support-mode');
        response.cookies.delete('helix-support-facility');
        response.cookies.delete('helix-support-facility-name');
        return response;
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
