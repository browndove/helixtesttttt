import { getProxyHeaders } from '@/lib/proxy-auth';
import { resolveFacilityId } from '@/lib/proxy-facility';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// GET /hospital - Get hospital/facility info for the logged-in user
export async function GET(req: NextRequest) {
    try {
        // First resolve the user's actual facility ID
        const facilityId = await resolveFacilityId(req, API_BASE_URL);

        // If we have a specific facility ID, fetch that one directly
        const url = facilityId
            ? `${API_BASE_URL}/api/v1/facilities/${facilityId}`
            : `${API_BASE_URL}/api/v1/facilities`;

        console.log('[hospital] GET request to:', url);

        const res = await fetch(url, {
            method: 'GET',
            headers: getProxyHeaders(req),
        });

        const text = await res.text();
        console.log('[hospital] Response status:', res.status);

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            console.error('Failed to parse backend response as JSON');
            return NextResponse.json(
                { error: 'Backend returned invalid response', details: text.substring(0, 200) },
                { status: 502 }
            );
        }

        // If backend returns an array, find the matching facility or return first
        let hospital = data;
        if (Array.isArray(data)) {
            hospital = (facilityId ? data.find((f: { id?: string }) => f.id === facilityId) : null) || data[0] || null;
        }
        return NextResponse.json(hospital, { status: res.status });
    } catch (err) {
        console.error('Proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}

// PUT /hospital - Update hospital/facility info
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const facilityId = body.id || body.facility_id || await resolveFacilityId(req, API_BASE_URL);
        const url = facilityId
            ? `${API_BASE_URL}/api/v1/facilities/${facilityId}`
            : `${API_BASE_URL}/api/v1/facilities`;

        console.log('[hospital] PUT request to:', url);

        const res = await fetch(url, {
            method: 'PUT',
            headers: getProxyHeaders(req),
            body: JSON.stringify(body),
        });

        const text = await res.text();
        console.log('Backend response status:', res.status);

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            console.error('Failed to parse backend response as JSON');
            return NextResponse.json(
                { error: 'Backend returned invalid response', details: text.substring(0, 200) },
                { status: 502 }
            );
        }

        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        console.error('Proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
