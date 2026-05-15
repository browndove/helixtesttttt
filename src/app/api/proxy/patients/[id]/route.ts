import { getProxyHeaders } from '@/lib/proxy-auth';
import { resolveFacilityId } from '@/lib/proxy-facility';
import { NextRequest, NextResponse } from 'next/server';
import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// GET /patients/:id — Full patient detail
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const url = new URL(`${API_BASE_URL}/api/v1/patients/${id}`);

        const facilityId = searchParams.get('facility_id') || await resolveFacilityId(req, API_BASE_URL);
        if (facilityId) url.searchParams.set('facility_id', facilityId);

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

// PUT /patients/:id — Update patient
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();

        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/patients/${id}`);


        if (upstream instanceof NextResponse) return upstream;


        const { url } = upstream;
        const payload = mergeFacilityIntoBody(
            body as Record<string, unknown>,
            upstream.facilityId,
        );


        const res = await fetch(url, {
            method: 'PUT',
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

// DELETE /patients/:id — Delete patient (admin only)
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/patients/${id}`);

        if (upstream instanceof NextResponse) return upstream;

        const { url } = upstream;

        const res = await fetch(url, {
            method: 'DELETE',
            headers: getProxyHeaders(req),
        });
        const text = await res.text();
        let data: unknown = {};
        if (text.trim()) {
            try { data = JSON.parse(text); } catch {
                return NextResponse.json({ error: 'Backend returned invalid response', details: text.substring(0, 200) }, { status: 502 });
            }
        }
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
