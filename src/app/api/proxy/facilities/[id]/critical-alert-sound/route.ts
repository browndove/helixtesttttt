import { NextRequest, NextResponse } from 'next/server';
import { getProxyHeaders } from '@/lib/proxy-auth';
import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

/** PUT /facilities/{id}/critical-alert-sound — { critical_alert_sound: <key> } */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const upstream = await buildTenantUpstreamUrl(
            req,
            API_BASE_URL,
            `/api/v1/facilities/${encodeURIComponent(id)}/critical-alert-sound`,
        );
        if (upstream instanceof NextResponse) return upstream;

        const payload = mergeFacilityIntoBody(
            body && typeof body === 'object' ? body as Record<string, unknown> : {},
            upstream.facilityId,
        );

        const res = await fetch(upstream.url, {
            method: 'PUT',
            headers: getProxyHeaders(req),
            body: JSON.stringify(payload),
        });

        const text = await res.text();
        let data: unknown;
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            return NextResponse.json(
                { error: 'Backend returned invalid response', details: text.substring(0, 200) },
                { status: res.status || 502 },
            );
        }
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
