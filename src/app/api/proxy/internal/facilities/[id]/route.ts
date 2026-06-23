import { NextRequest, NextResponse } from 'next/server';
import { getInternalTokenFromCookie } from '@/lib/proxy-auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

function buildBackendUrl(id: string): string {
    return `${API_BASE_URL}/api/v1/facilities/${encodeURIComponent(id)}`;
}

async function parseBackendJson(res: Response): Promise<{ data?: unknown; error?: string; details?: string }> {
    const text = await res.text();
    try {
        return { data: text ? JSON.parse(text) : {} };
    } catch {
        return {
            error: 'Backend returned invalid response',
            details: text.substring(0, 200),
        };
    }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const token = getInternalTokenFromCookie(req);
        if (!token) return NextResponse.json({ error: 'Not authenticated as internal admin' }, { status: 401 });

        const { id } = await ctx.params;
        if (!id) return NextResponse.json({ error: 'Facility ID is required' }, { status: 400 });

        const body = await req.json();
        const res = await fetch(buildBackendUrl(id), {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });

        const parsed = await parseBackendJson(res);
        if (parsed.error) return NextResponse.json(parsed, { status: 502 });
        return NextResponse.json(parsed.data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const token = getInternalTokenFromCookie(req);
        if (!token) return NextResponse.json({ error: 'Not authenticated as internal admin' }, { status: 401 });

        const { id } = await ctx.params;
        if (!id) return NextResponse.json({ error: 'Facility ID is required' }, { status: 400 });

        const res = await fetch(buildBackendUrl(id), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });

        const parsed = await parseBackendJson(res);
        if (parsed.error) return NextResponse.json(parsed, { status: 502 });
        return NextResponse.json(parsed.data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const token = getInternalTokenFromCookie(req);
        if (!token) return NextResponse.json({ error: 'Not authenticated as internal admin' }, { status: 401 });

        const { id } = await ctx.params;
        if (!id) return NextResponse.json({ error: 'Facility ID is required' }, { status: 400 });

        const body = await req.json();
        const res = await fetch(buildBackendUrl(id), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });

        const parsed = await parseBackendJson(res);
        if (parsed.error) return NextResponse.json(parsed, { status: 502 });
        return NextResponse.json(parsed.data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const token = getInternalTokenFromCookie(req);
        if (!token) return NextResponse.json({ error: 'Not authenticated as internal admin' }, { status: 401 });

        const { id } = await ctx.params;
        if (!id) return NextResponse.json({ error: 'Facility ID is required' }, { status: 400 });

        const res = await fetch(buildBackendUrl(id), {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });

        const parsed = await parseBackendJson(res);
        if (parsed.error) return NextResponse.json(parsed, { status: 502 });
        return NextResponse.json(parsed.data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
