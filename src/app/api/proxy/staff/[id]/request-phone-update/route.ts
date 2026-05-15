import { getProxyHeaders } from '@/lib/proxy-auth';
import { NextRequest, NextResponse } from 'next/server';
import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

/** POST /api/v1/staff/{id}/request-phone-update — facility admin app JWT. Optional ?facility_id= */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const facilityId = req.nextUrl.searchParams.get('facility_id');
        const qs = facilityId ? `?facility_id=${encodeURIComponent(facilityId)}` : '';
        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/staff/${encodeURIComponent(id)}/request-phone-update${qs}`);

        if (upstream instanceof NextResponse) return upstream;

        const { url } = upstream;
        const res = await fetch(url, {
            method: 'POST',
            headers: getProxyHeaders(req),
            body: JSON.stringify({}),
            signal: AbortSignal.timeout(20000),
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
