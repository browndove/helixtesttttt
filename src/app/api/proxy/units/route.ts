import { getProxyHeaders } from '@/lib/proxy-auth';
import { resolveFacilityId } from '@/lib/proxy-facility';
import { NextRequest, NextResponse } from 'next/server';
import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// GET /units — List care units at facility
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const url = new URL(`${API_BASE_URL}/api/v1/units`);

        const sessionFacilityId = await resolveFacilityId(req, API_BASE_URL);
        if (!sessionFacilityId) {
            return NextResponse.json({ error: 'Unable to resolve facility for current session.' }, { status: 400 });
        }
        url.searchParams.set('facility_id', sessionFacilityId);

        const deptId = searchParams.get('department_id');
        if (deptId) url.searchParams.set('department_id', deptId);

        const res = await fetch(url.toString(), { method: 'GET', headers: getProxyHeaders(req) });
        const text = await res.text();
        let data: unknown;
        try { data = JSON.parse(text); } catch {
            return NextResponse.json({ error: 'Backend returned invalid response', details: text.substring(0, 200) }, { status: 502 });
        }
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}

// POST /units — Create a care unit
export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as Record<string, unknown>;
        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/units`);
        if (upstream instanceof NextResponse) return upstream;
        const { url, facilityId } = upstream;
        const payload = { ...body, facility_id: facilityId };

        const res = await fetch(url, {
            method: 'POST',
            headers: getProxyHeaders(req),
            body: JSON.stringify(payload),
        });
        const text = await res.text();
        let data: unknown;
        try { data = JSON.parse(text); } catch {
            return NextResponse.json({ error: 'Backend returned invalid response', details: text.substring(0, 200) }, { status: 502 });
        }
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
