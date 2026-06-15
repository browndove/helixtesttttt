import { getProxyHeaders } from '@/lib/proxy-auth';
import { NextRequest, NextResponse } from 'next/server';
import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// POST /staff/invites/actions — revoke, reinvite, or push reminder
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/staff/invites/actions`);
        if (upstream instanceof NextResponse) return upstream;

        const { url, facilityId } = upstream;
        const payload = mergeFacilityIntoBody(body, facilityId);

        console.log('[staffInviteActions] Request to:', url, 'action:', payload?.action);

        const res = await fetch(url, {
            method: 'POST',
            headers: getProxyHeaders(req),
            body: JSON.stringify(payload),
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
