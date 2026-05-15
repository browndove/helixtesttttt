import { getProxyHeaders } from '@/lib/proxy-auth';
import { NextRequest, NextResponse } from 'next/server';
import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// POST /bookmarks/provider-teams/:team_id — Bookmark a provider team
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ team_id: string }> }
) {
    try {
        const { team_id } = await params;
        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/bookmarks/provider-teams/${team_id}`);

        if (upstream instanceof NextResponse) return upstream;

        const { url } = upstream;

        const res = await fetch(url, {
            method: 'POST',
            headers: getProxyHeaders(req),
        });
        if (res.status === 204) return new NextResponse(null, { status: 204 });
        const text = await res.text();
        let data: unknown = {};
        if (text.trim()) {
            try { data = JSON.parse(text); } catch {
                return NextResponse.json({ error: 'Backend returned invalid response' }, { status: 502 });
            }
        }
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}

// DELETE /bookmarks/provider-teams/:team_id — Remove bookmark
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ team_id: string }> }
) {
    try {
        const { team_id } = await params;
        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/bookmarks/provider-teams/${team_id}`);

        if (upstream instanceof NextResponse) return upstream;

        const { url } = upstream;

        const res = await fetch(url, {
            method: 'DELETE',
            headers: getProxyHeaders(req),
        });
        if (res.status === 204) return new NextResponse(null, { status: 204 });
        const text = await res.text();
        let data: unknown = {};
        if (text.trim()) {
            try { data = JSON.parse(text); } catch {
                return NextResponse.json({ error: 'Backend returned invalid response' }, { status: 502 });
            }
        }
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
