import { NextRequest, NextResponse } from 'next/server';
import { getInternalTokenFromCookie } from '@/lib/proxy-auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
    try {
        const token = getInternalTokenFromCookie(req);
        if (!token) return NextResponse.json({ error: 'Not authenticated as internal admin' }, { status: 401 });

        const res = await fetch(`${API_BASE_URL}/api/v1/facilities`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
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
        const list = Array.isArray(data)
            ? data
            : (data && typeof data === 'object'
                ? (((data as { items?: unknown; data?: unknown; facilities?: unknown }).items)
                    || ((data as { items?: unknown; data?: unknown; facilities?: unknown }).data)
                    || ((data as { items?: unknown; data?: unknown; facilities?: unknown }).facilities)
                    || [])
                : []);

        return NextResponse.json(Array.isArray(list) ? list : [], { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
