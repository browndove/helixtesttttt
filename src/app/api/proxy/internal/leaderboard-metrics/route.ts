import { NextRequest, NextResponse } from 'next/server';
import { getInternalTokenFromCookie } from '@/lib/proxy-auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

/** GET /api/v1/leaderboard-metrics — engagement standings for a UTC month. */
export async function GET(req: NextRequest) {
    try {
        const token = getInternalTokenFromCookie(req);
        if (!token) {
            return NextResponse.json({ error: 'Not authenticated as internal admin' }, { status: 401 });
        }

        const incoming = new URL(req.url);
        const upstream = new URL(`${API_BASE_URL}/api/v1/leaderboard-metrics`);
        for (const key of ['month', 'facility_id', 'limit', 'include_internal', 'q'] as const) {
            const value = incoming.searchParams.get(key);
            if (value) upstream.searchParams.set(key, value);
        }

        const res = await fetch(upstream.toString(), {
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
            console.error('Leaderboard metrics upstream returned non-JSON', res.status, text.slice(0, 500));
            return NextResponse.json(
                { error: 'Backend returned invalid response', details: text.substring(0, 200) },
                { status: 502 },
            );
        }

        if (!res.ok) {
            console.error('Leaderboard metrics upstream', res.status, upstream.pathname + upstream.search, text.slice(0, 800));
        }

        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : '';
        console.error('Leaderboard metrics proxy failed:', message, cause);
        return NextResponse.json({ error: 'Proxy error', details: cause || message }, { status: 500 });
    }
}
