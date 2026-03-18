import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/config';

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
        const message = err instanceof Error ? err.message : String(err);
        const isTimeout = message.includes('abort') || message.includes('timeout');
        console.error('[proxy admin/login] Request failed:', message);
        return NextResponse.json(
            {
                error: isTimeout ? 'Backend request timed out' : 'Backend unreachable',
                details: message,
                hint: 'Ensure NEXT_PUBLIC_API_BASE_URL is set in .env.local and restart the dev server (npm run dev).',
            },
            { status: 502 }
        );
    }
}
