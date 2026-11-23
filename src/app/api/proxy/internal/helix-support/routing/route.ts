import { NextRequest, NextResponse } from 'next/server';
import { getInternalTokenFromCookie } from '@/lib/proxy-auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

/** GET /api/v1/internal/helix-support/routing — support roles + facility assignments. */
export async function GET(req: NextRequest) {
    try {
        const token = getInternalTokenFromCookie(req);
        if (!token) {
            return NextResponse.json({ error: 'Not authenticated as internal admin' }, { status: 401 });
        }

        const res = await fetch(`${API_BASE_URL}/api/v1/internal/helix-support/routing`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
        });

        const text = await res.text();
        let data: unknown;
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            console.error('[helix-support/routing] non-JSON backend response', res.status, text.substring(0, 400));
            return NextResponse.json(
                { error: 'Backend returned invalid response', details: text.substring(0, 200) },
                { status: 502 },
            );
        }

        if (!res.ok) {
            console.error('[helix-support/routing] backend error', res.status, data);
        }

        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[helix-support/routing] proxy error', message);
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
