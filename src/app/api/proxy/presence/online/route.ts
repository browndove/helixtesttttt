import { getProxyHeaders } from '@/lib/proxy-auth';
import { NextRequest, NextResponse } from 'next/server';
import { buildTenantUpstreamUrl } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

/** GET /api/v1/presence/online — who is currently online for this facility/session. */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const query: Record<string, string | undefined> = {};
        searchParams.forEach((value, key) => {
            query[key] = value;
        });
        // REST defaults to app-sourced presence; admin Next.js must pass client=admin (see fetchMergedFacilityPresenceOnline).
        if (!query.client) {
            query.client = 'admin';
        }

        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/presence/online`, query);
        if (upstream instanceof NextResponse) return upstream;

        const res = await fetch(upstream.url, {
            method: 'GET',
            headers: getProxyHeaders(req),
        });

        const text = await res.text();
        if (!text.trim()) {
            return NextResponse.json(
                { data: [] },
                { status: res.status }
            );
        }
        let data: unknown;
        try {
            data = JSON.parse(text);
        } catch {
            return NextResponse.json(
                { error: 'Backend returned invalid response', details: text.substring(0, 200) },
                { status: 502 }
            );
        }
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
