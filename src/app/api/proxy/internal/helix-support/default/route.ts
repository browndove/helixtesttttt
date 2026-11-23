import { NextRequest, NextResponse } from 'next/server';
import { getInternalTokenFromCookie } from '@/lib/proxy-auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

/** PUT /api/v1/internal/helix-support/default — set the default support role. */
export async function PUT(req: NextRequest) {
    try {
        const token = getInternalTokenFromCookie(req);
        if (!token) {
            return NextResponse.json({ error: 'Not authenticated as internal admin' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({} as Record<string, unknown>));
        if (!('support_role_id' in body) || typeof body.support_role_id !== 'string' || !body.support_role_id.trim()) {
            return NextResponse.json({ error: 'support_role_id is required' }, { status: 400 });
        }

        const res = await fetch(`${API_BASE_URL}/api/v1/internal/helix-support/default`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ support_role_id: body.support_role_id.trim() }),
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
