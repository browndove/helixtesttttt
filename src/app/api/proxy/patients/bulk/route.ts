import { getProxyHeaders } from '@/lib/proxy-auth';
import { resolveFacilityId } from '@/lib/proxy-facility';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// POST /api/v1/patients/bulk — multipart/form-data: facility_id (UUID) + file (CSV or Excel).
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
        const url = `${API_BASE_URL}/api/v1/patients/bulk`;

        console.log('[patients/bulk] Forwarding POST to:', url, 'facility_id:', facilityId);

        let res;
        if (contentType.includes('multipart/form-data')) {
            const formData = await req.formData();
            const requestedFacilityId = String(formData.get('facility_id') || formData.get('facilityId') || '').trim();
            if (requestedFacilityId && requestedFacilityId !== facilityId) {
                return NextResponse.json(
                    { error: 'Facility mismatch. Bulk patient import is restricted to your logged-in facility.' },
                    { status: 403 }
                );
            }
            const file = formData.get('file');
            if (!file || !(file instanceof Blob)) {
                return NextResponse.json(
                    { error: 'Missing file. Form field name must be "file" (CSV, XLSX, or XLS).' },
                    { status: 400 }
                );
            }
            if (file.size === 0) {
                return NextResponse.json({ error: 'Uploaded file is empty.' }, { status: 400 });
            }
            formData.set('facility_id', facilityId);
            formData.delete('facilityId');
            const headers = new Headers(getProxyHeaders(req));
            headers.delete('content-type');
            res = await fetch(url, {
                method: 'POST',
                headers,
                body: formData,
            });
        } else {
            const body = await req.json() as Record<string, unknown>;
            const requestedFacilityId = String(body.facility_id || body.facilityId || '').trim();
            if (requestedFacilityId && requestedFacilityId !== facilityId) {
                return NextResponse.json(
                    { error: 'Facility mismatch. Bulk patient import is restricted to your logged-in facility.' },
                    { status: 403 }
                );
            }
            body.facility_id = facilityId;
            delete body.facilityId;
            res = await fetch(url, {
                method: 'POST',
                headers: getProxyHeaders(req),
                body: JSON.stringify(body),
            });
        }

        const text = await res.text();
        console.log('[patients/bulk] Backend status:', res.status);
        if (!res.ok) console.log('[patients/bulk] Body preview:', text.substring(0, 500));

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
        console.error('[patients/bulk] Proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
