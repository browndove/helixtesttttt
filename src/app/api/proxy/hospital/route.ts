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
        const resolvedId = body.id || body.facility_id || await resolveFacilityId(req, API_BASE_URL);
        const facilityId = String(resolvedId || '').trim();
        const hasFacilityId = facilityId.length > 0;
        const method = hasFacilityId ? 'PUT' : 'POST';
        const url = hasFacilityId
            ? `${API_BASE_URL}/api/v1/facilities/${facilityId}`
            : `${API_BASE_URL}/api/v1/facilities`;

        console.log(`[hospital] ${method} request to:`, url);

        const res = await fetch(url, {
            method,
            headers: getProxyHeaders(req),
            body: JSON.stringify(body),
        });

        const text = await res.text();
        console.log(`[hospital] ${method} response status:`, res.status);

        // Some backends return 204 No Content on successful update/create.
        if (!text.trim()) {
            return NextResponse.json(
                { ok: res.ok, message: res.ok ? 'Facility saved' : 'Facility save failed' },
                { status: res.status }
            );
        }

        let data: unknown = {};
        try {
            data = JSON.parse(text);
        } catch {
            if (!res.ok) {
                return NextResponse.json(
                    { error: 'Facility save failed', details: text.substring(0, 300) },
                    { status: res.status }
                );
            }
            return NextResponse.json(
                { ok: true, message: 'Facility saved' },
                { status: res.status }
            );
        }

        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        console.error('Proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
