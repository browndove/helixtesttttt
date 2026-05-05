import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/config';

const INTERNAL_SESSION_COOKIE = 'helix-internal-session';

function describeFetchError(err: unknown): string {
    if (!(err instanceof Error)) return String(err);
    const parts: string[] = [err.message];
    let c: unknown = err.cause;
    for (let i = 0; i < 6 && c; i++) {
        if (c instanceof Error) {
            parts.push(`${c.name}: ${c.message}`);
            c = c.cause;
        } else if (typeof c === 'object' && c !== null && 'code' in c) {
            parts.push(`code=${String((c as { code?: unknown }).code)}`);
            break;
        } else {
            parts.push(String(c));
            break;
        }
    }
    return parts.join(' -> ');
}

function isInternalRole(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    const rec = payload as Record<string, unknown>;
    const user = rec.user && typeof rec.user === 'object' && !Array.isArray(rec.user)
        ? rec.user as Record<string, unknown>
        : undefined;
    const candidates = [
        rec.role,
        rec.user_role,
        rec.system_role,
        user?.role,
        user?.user_role,
        user?.system_role,
    ];
    const normalized = candidates
        .map((v) => String(v || '').trim().toLowerCase())
        .filter(Boolean);
    return normalized.some((r) => r.includes('internal') || r.includes('superadmin') || r.includes('super_admin'));
}

async function emitAuditEvent(token: string | undefined, action: string, metadata: Record<string, unknown>) {
    if (!token) return;
    try {
        await fetch(`${API_BASE_URL}/api/v1/audit-logs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                action,
                entity_type: 'internal_support',
                metadata,
            }),
        });
    } catch {
        // Best-effort only; never block auth on audit delivery.
    }
}

export async function POST(req: NextRequest) {
    const url = `${API_BASE_URL}/api/v1/auth/internal/login`;
    try {
        const body = await req.json();
        const email = String(body?.email || '').trim();

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15000),
        });

        const text = await res.text();
        let data: unknown;
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            return NextResponse.json(
                {
                    error: 'Backend returned invalid response',
                    details: text.substring(0, 200),
                },
                { status: 502 },
            );
        }

        if (!res.ok) {
            await emitAuditEvent(undefined, 'internal_login_failed', { email, status: res.status });
            return NextResponse.json(data, { status: res.status });
        }

        const rec = data && typeof data === 'object' ? data as Record<string, unknown> : {};
        const token = String(rec.access_token || rec.token || '').trim();
        if (!token) {
            return NextResponse.json({ error: 'Internal login succeeded without access token' }, { status: 502 });
        }
        if (!isInternalRole(rec)) {
            return NextResponse.json({ error: 'Account is not authorized for internal admin access' }, { status: 403 });
        }

        await emitAuditEvent(token, 'internal_login_success', { email });

        const response = NextResponse.json(data, { status: 200 });
        response.cookies.set(INTERNAL_SESSION_COOKIE, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 8,
        });
        // Clear support context from any prior session at login time.
        response.cookies.delete('helix-support-mode');
        response.cookies.delete('helix-support-facility');
        response.cookies.delete('helix-support-facility-name');
        return response;
    } catch (err) {
        const detail = describeFetchError(err);
        const isTimeout = detail.toLowerCase().includes('abort') || detail.toLowerCase().includes('timeout');
        return NextResponse.json(
            {
                error: isTimeout ? 'Backend request timed out' : 'Backend unreachable',
                details: detail,
            },
            { status: 502 },
        );
    }
}
