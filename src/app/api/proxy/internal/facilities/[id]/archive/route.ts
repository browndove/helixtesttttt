import { NextRequest, NextResponse } from 'next/server';
import { getInternalTokenFromCookie } from '@/lib/proxy-auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

/** PUT /api/v1/internal/facilities/{id}/archive — archive or restore (internal admin only). */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const token = getInternalTokenFromCookie(req);
        if (!token) return NextResponse.json({ error: 'Not authenticated as internal admin' }, { status: 401 });

        const { id } = await ctx.params;
        if (!id) return NextResponse.json({ error: 'Facility ID is required' }, { status: 400 });

        const body = await req.json().catch(() => ({} as Record<string, unknown>));
        const archived = body?.archived;
        if (typeof archived !== 'boolean') {
            return NextResponse.json({ error: 'archived must be true or false' }, { status: 400 });
        }

        const res = await fetch(
            `${API_BASE_URL}/api/v1/internal/facilities/${encodeURIComponent(id)}/archive`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ archived }),
            },
        );

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
