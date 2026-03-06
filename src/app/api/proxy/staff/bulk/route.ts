import { getProxyHeaders } from '@/lib/proxy-auth';
import { resolveFacilityId } from '@/lib/proxy-facility';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// POST /staff/bulk - Bulk create staff via CSV upload
export async function POST(req: NextRequest) {
    try {
        const contentType = req.headers.get('content-type') || '';
        const facilityId = await resolveFacilityId(req, API_BASE_URL);
        if (!facilityId) {
            return NextResponse.json(
                { error: 'Unable to resolve facility for current session. Please log in again.' },
                { status: 400 }
            );
        }
        const url = new URL(`${API_BASE_URL}/api/v1/staff/bulk`);
        url.searchParams.set('facility_id', facilityId);

        console.log('Proxy bulk create staff request to:', url.toString(), 'facility_id:', facilityId);

        let res;
        if (contentType.includes('multipart/form-data')) {
            const formData = await req.formData();
            const requestedFacilityId = String(formData.get('facility_id') || formData.get('facilityId') || '').trim();
            if (requestedFacilityId && requestedFacilityId !== facilityId) {
                return NextResponse.json(
                    { error: 'Facility mismatch. Bulk staff import is restricted to your logged-in facility.' },
                    { status: 403 }
                );
            }
            formData.set('facility_id', facilityId);
            formData.delete('facilityId');
            const headers = new Headers(getProxyHeaders(req));
            headers.delete('content-type');
            res = await fetch(url.toString(), {
                method: 'POST',
                headers,
                body: formData,
            });
        } else {
            const body = await req.json() as Record<string, unknown>;
            const requestedFacilityId = String(body.facility_id || body.facilityId || '').trim();
            if (requestedFacilityId && requestedFacilityId !== facilityId) {
                return NextResponse.json(
                    { error: 'Facility mismatch. Bulk staff import is restricted to your logged-in facility.' },
                    { status: 403 }
                );
            }
            body.facility_id = facilityId;
            delete body.facilityId;
            res = await fetch(url.toString(), {
                method: 'POST',
                headers: getProxyHeaders(req),
                body: JSON.stringify(body),
            });
        }

        const text = await res.text();
        console.log('Backend response status:', res.status);
        if (!res.ok) console.log('Backend response body (first 500):', text.substring(0, 500));

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
