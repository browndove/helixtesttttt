import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/config';

/** Unwrap undici/node fetch failure chains for logs and API responses */
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
    return parts.join(' → ');
}

export async function POST(req: NextRequest) {
    const url = `${API_BASE_URL}/api/v1/auth/admin/login`;
    console.log('[proxy admin/login] Forwarding to:', url);

    try {
        const body = await req.json();

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15000),
        });

        const text = await res.text();
        console.log('[proxy admin/login] Backend status:', res.status, 'body preview:', text.substring(0, 300));

        let data: unknown;
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            console.error('[proxy admin/login] Backend returned non-JSON. Status:', res.status);
            return NextResponse.json(
                {
                    error: 'Backend returned invalid response',
                    details: text.substring(0, 200),
                    hint: res.status >= 500 ? 'Backend may be down or misconfigured. Check api.helixhealth.app.' : undefined,
                },
                { status: 502 }
            );
        }

        if (res.status >= 500) {
            console.error('[proxy admin/login] Backend 5xx:', res.status, data);
        }

        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        const detail = describeFetchError(err);
        const isTimeout =
            detail.toLowerCase().includes('abort') ||
            detail.toLowerCase().includes('timeout') ||
            detail.includes('UND_ERR_CONNECT_TIMEOUT');
        console.error('[proxy admin/login] Request failed:', detail);
        return NextResponse.json(
            {
                error: isTimeout ? 'Backend request timed out' : 'Backend unreachable',
                details: detail,
                hint: 'No HTTP response from the API host. Check VPN/firewall, DNS (try curl from this machine), that api.helixhealth.app is up, and NEXT_PUBLIC_API_BASE_URL in .env.local. Node IPv6 hangs: try NODE_OPTIONS=--dns-result-order=ipv4first.',
            },
            { status: 502 }
        );
    }
}
