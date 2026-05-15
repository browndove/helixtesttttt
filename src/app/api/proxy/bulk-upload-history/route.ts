import { getProxyHeaders } from '@/lib/proxy-auth';
import { ensureFacilityOnUrl } from '@/lib/proxy-upstream';
import type { BulkUploadHistoryKind } from '@/lib/bulk-upload-history';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

const KIND_VALUES: BulkUploadHistoryKind[] = ['staff', 'patient'];

// GET /api/v1/bulk-upload-history — query: kind (staff | patient), optional facility_id, pagination, etc.
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const kind = searchParams.get('kind')?.trim().toLowerCase() as BulkUploadHistoryKind | undefined;
        if (!kind || !KIND_VALUES.includes(kind)) {
            return NextResponse.json(
                { error: 'Query parameter "kind" is required and must be "staff" or "patient".' },
                { status: 400 }
            );
        }

        const url = new URL(`${API_BASE_URL}/api/v1/bulk-upload-history`);
        url.searchParams.set('kind', kind);

        const forwardParams = ['page_size', 'page_id', 'page', 'limit', 'offset'];
        for (const p of forwardParams) {
            const v = searchParams.get(p);
            if (v) url.searchParams.set(p, v);
        }

        const withFacility = await ensureFacilityOnUrl(req, API_BASE_URL, url);
        if (withFacility instanceof NextResponse) return withFacility;

        console.log('[bulk-upload-history] GET', withFacility.toString());

        const res = await fetch(withFacility.toString(), {
            method: 'GET',
            headers: getProxyHeaders(req),
        });

        const text = await res.text();
        let data: unknown;
        try {
            data = JSON.parse(text);
        } catch {
            console.error('[bulk-upload-history] Non-JSON backend response');
            return NextResponse.json(
                { error: 'Backend returned invalid response', details: text.substring(0, 200) },
                { status: 502 }
            );
        }

        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        console.error('[bulk-upload-history] Proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
