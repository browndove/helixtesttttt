import { NextRequest, NextResponse } from 'next/server';
import { getInternalTokenFromCookie } from '@/lib/proxy-auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
    try {
        const token = getInternalTokenFromCookie(req);
        if (!token) return NextResponse.json({ error: 'Not authenticated as internal admin' }, { status: 401 });

        const incoming = new URL(req.url);
        const upstream = new URL(`${API_BASE_URL}/api/v1/facilities`);
        // Internal admins: archived=include (all) | archived=only (archived). Default hides archived.
        const archived = incoming.searchParams.get('archived');
        if (archived === 'include' || archived === 'only') {
            upstream.searchParams.set('archived', archived);
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

export async function POST(req: NextRequest) {
    try {
        const token = getInternalTokenFromCookie(req);
        if (!token) return NextResponse.json({ error: 'Not authenticated as internal admin' }, { status: 401 });

        const body = await req.json();

        const res = await fetch(`${API_BASE_URL}/api/v1/facilities`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
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
