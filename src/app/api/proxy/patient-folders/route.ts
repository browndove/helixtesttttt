import { getProxyHeaders } from '@/lib/proxy-auth';
import { resolveFacilityId } from '@/lib/proxy-facility';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

type CreateFolderBody = {
    facility_id?: string;
    facilityId?: string;
    name?: string;
    description?: string;
    visibility?: 'public' | 'private';
};

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const url = new URL(`${API_BASE_URL}/api/v1/patient-folders`);

        const requestedFacilityId = searchParams.get('facility_id');
        const sessionFacilityId = await resolveFacilityId(req, API_BASE_URL);
        if (!sessionFacilityId) {
            return NextResponse.json({ error: 'Unable to resolve facility for current session.' }, { status: 400 });
        }
        if (requestedFacilityId && requestedFacilityId !== sessionFacilityId) {
            return NextResponse.json({ error: 'Facility mismatch.' }, { status: 403 });
        }

        url.searchParams.set('facility_id', sessionFacilityId);
        // List endpoint: only public folders (backend filter).
        url.searchParams.set('visibility', 'public');

        const res = await fetch(url.toString(), {
            method: 'GET',
            headers: getProxyHeaders(req),
        });
        const text = await res.text();
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

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as CreateFolderBody;
        const requestedFacilityId = body.facility_id || body.facilityId;
        const sessionFacilityId = await resolveFacilityId(req, API_BASE_URL);
        if (!sessionFacilityId) {
            return NextResponse.json({ error: 'Unable to resolve facility for current session.' }, { status: 400 });
        }
        if (requestedFacilityId && requestedFacilityId !== sessionFacilityId) {
            return NextResponse.json({ error: 'Facility mismatch.' }, { status: 403 });
        }

        const payload = {
            facility_id: sessionFacilityId,
            name: (body.name || '').trim(),
            description: (body.description || '').trim() || undefined,
            visibility: 'public' as const,
        };

        const res = await fetch(`${API_BASE_URL}/api/v1/patient-folders`, {
            method: 'POST',
            headers: getProxyHeaders(req),
            body: JSON.stringify(payload),
        });

        const text = await res.text();
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

