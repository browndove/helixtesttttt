import { NextRequest, NextResponse } from 'next/server';
import { getInternalTokenFromCookie } from '@/lib/proxy-auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

/** GET /api/v1/leaderboard-metrics/users/{id} — one person's monthly points, rank, and ledger. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const token = getInternalTokenFromCookie(req);
        if (!token) {
            return NextResponse.json({ error: 'Not authenticated as internal admin' }, { status: 401 });
        }

        const { id } = await ctx.params;
        if (!id) return NextResponse.json({ error: 'User ID is required' }, { status: 400 });

        const incoming = new URL(req.url);
        const upstream = new URL(`${API_BASE_URL}/api/v1/leaderboard-metrics/users/${encodeURIComponent(id)}`);
        for (const key of ['facility_id', 'month', 'events_limit', 'events_offset'] as const) {
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
            return NextResponse.json(
                { error: 'Backend returned invalid response', details: text.substring(0, 200) },
                { status: 502 },
            );
        }

        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
