import { NextRequest, NextResponse } from 'next/server';
import { getInternalTokenFromCookie } from '@/lib/proxy-auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

/** GET /api/v1/internal/users/{user_id}/unread-breakdown — internal support tool. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
    try {
        const token = getInternalTokenFromCookie(_req);
        if (!token) {
            return NextResponse.json({ error: 'Not authenticated as internal admin' }, { status: 401 });
        }

        const { userId } = await ctx.params;
        if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 400 });

        const res = await fetch(
            `${API_BASE_URL}/api/v1/internal/users/${encodeURIComponent(userId)}/unread-breakdown`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                cache: 'no-store',
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
