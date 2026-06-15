import { getProxyHeaders } from '@/lib/proxy-auth';
import { NextRequest, NextResponse } from 'next/server';
import { buildTenantUpstreamUrl } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// GET /staff/invites — invite dashboard with summary counts and action hints
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const query: Record<string, string | undefined> = {};
        for (const param of ['page', 'page_size', 'search'] as const) {
            const value = searchParams.get(param);
            if (value) query[param] = value;
        }

        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/staff/invites`, query);
        if (upstream instanceof NextResponse) return upstream;

        const { url } = upstream;
        console.log('[staffInvites] Request to:', url);

        const res = await fetch(url, {
            method: 'GET',
            headers: getProxyHeaders(req),
        });

        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            return NextResponse.json(
                { error: 'Backend returned invalid response', details: text.substring(0, 200) },
                { status: 502 },
            );
        }

        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        console.error('Proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
