import { getProxyHeaders } from '@/lib/proxy-auth';
import { resolveFacilityId } from '@/lib/proxy-facility';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

function tryParseJson(text: string): unknown | undefined {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

// GET /departments - List departments (requires facility_id query param)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
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
                { error: 'Facility mismatch. Departments are restricted to your logged-in facility.' },
                { status: 403 }
            );
        }

        const url = new URL(`${API_BASE_URL}/api/v1/departments`);
        url.searchParams.set('facility_id', sessionFacilityId);

        console.log('Proxy list departments request to:', url.toString());

        const res = await fetch(url.toString(), {
            method: 'GET',
            headers: getProxyHeaders(req),
        });

        const text = await res.text();
        console.log('Backend response status:', res.status);
        const data = tryParseJson(text);
        if (data === undefined) {
            console.error('Failed to parse backend response as JSON');
            return NextResponse.json(
                { error: 'Backend returned non-JSON response', details: text.substring(0, 200) },
                { status: res.status || 502 }
            );
        }
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        console.error('Proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}

// POST /departments - Create a department
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const requestedFacilityId = String(body.facility_id || body.facilityId || '').trim();
        const sessionFacilityId = await resolveFacilityId(req, API_BASE_URL);
        if (!sessionFacilityId) {
            return NextResponse.json(
                { error: 'Unable to resolve facility for current session. Please log in again.' },
                { status: 400 }
            );
        }
        if (requestedFacilityId && requestedFacilityId !== sessionFacilityId) {
            return NextResponse.json(
                { error: 'Facility mismatch. Departments can only be created in your logged-in facility.' },
                { status: 403 }
            );
        }
        const payload = { ...body, facility_id: sessionFacilityId };
        const url = `${API_BASE_URL}/api/v1/departments`;

        console.log('Proxy create department request to:', url);

        const res = await fetch(url, {
            method: 'POST',
            headers: getProxyHeaders(req),
            body: JSON.stringify(payload),
        });

        const text = await res.text();
        console.log('Backend response status:', res.status);
        const data = tryParseJson(text);
        if (data === undefined) {
            console.error('Failed to parse backend response as JSON');
            return NextResponse.json(
                { error: 'Backend returned non-JSON response', details: text.substring(0, 200) },
                { status: res.status || 502 }
            );
        }
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        console.error('Proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
