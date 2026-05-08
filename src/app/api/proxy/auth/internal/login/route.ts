import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/config';

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
        const raw = (await req.json()) as Record<string, unknown>;
        const email = String(raw.email ?? '').trim().toLowerCase();
        const upstreamBody = { ...raw, email };

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(upstreamBody),
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

        await emitAuditEvent(undefined, 'internal_login_challenge_sent', { email });

        const response = NextResponse.json(data, { status: 200 });
        // Clear support context from any prior session at OTP challenge time.
        response.cookies.delete('helix-internal-session');
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
