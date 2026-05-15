import { NextRequest, NextResponse } from 'next/server';
import { getInternalTokenFromCookie } from '@/lib/proxy-auth';
import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export async function POST(req: NextRequest) {
    try {
        const token = getInternalTokenFromCookie(req);
        if (!token) return NextResponse.json({ error: 'Not authenticated as internal admin' }, { status: 401 });
        const body = await req.json();
        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/audit-logs`);

        if (upstream instanceof NextResponse) return upstream;

        const { url } = upstream;
        const payload = mergeFacilityIntoBody(
            body as Record<string, unknown>,
            upstream.facilityId,
        );

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
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
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
