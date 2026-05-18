import { getProxyHeaders } from '@/lib/proxy-auth';
import { NextRequest, NextResponse } from 'next/server';
import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

/** POST /api/v1/staff/send-invite-emails — queue Helix account-setup invite emails. */
export async function POST(req: NextRequest) {
    try {
        const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, '/api/v1/staff/send-invite-emails');

        if (upstream instanceof NextResponse) return upstream;

        const { url, facilityId } = upstream;
        const payload = mergeFacilityIntoBody(body, facilityId);

        const res = await fetch(url, {
            method: 'POST',
            headers: getProxyHeaders(req),
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(60000),
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
