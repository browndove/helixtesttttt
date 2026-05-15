import { getProxyHeaders } from '@/lib/proxy-auth';
import { resolveFacilityId } from '@/lib/proxy-facility';
import { NextRequest, NextResponse } from 'next/server';
import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// GET /patients - List patients (paginated, with filters)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const url = new URL(`${API_BASE_URL}/api/v1/patients`);

        const requestedFacilityId = searchParams.get('facility_id');
        const sessionFacilityId = await resolveFacilityId(req, API_BASE_URL);
        if (!sessionFacilityId) {
            return NextResponse.json(
                { error: 'Unable to resolve facility for current session. Please log in again.' },
                { status: 400 }
            );
        }
        if (requestedFacilityId && requestedFacilityId !== sessionFacilityId) {
            return NextResponse.json(
                { error: 'Facility mismatch. Patient listing is restricted to your logged-in facility.' },
                { status: 403 }
            );
        }

        url.searchParams.set('facility_id', sessionFacilityId);

        const queryParams = ['department_id', 'status', 'page_size', 'page_id', 'search'];
        queryParams.forEach((param) => {
            const value = searchParams.get(param);
            if (value) url.searchParams.set(param, value);
        });

        const res = await fetch(url.toString(), {
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
                { status: 502 }
            );
        }

        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}

// POST /patients — Create a patient
export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as Record<string, unknown>;
        const sessionFacilityId = await resolveFacilityId(req, API_BASE_URL);
        if (!sessionFacilityId) {
            return NextResponse.json({ error: 'Unable to resolve facility for current session.' }, { status: 400 });
        }

        const payload = { ...body, facility_id: sessionFacilityId };

        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/patients`);


        if (upstream instanceof NextResponse) return upstream;


        const { url } = upstream;


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
