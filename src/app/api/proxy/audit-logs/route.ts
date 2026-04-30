import { getProxyHeaders } from '@/lib/proxy-auth';
import { NextRequest, NextResponse } from 'next/server';
import { resolveFacilityId } from '@/lib/proxy-facility';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// GET /audit-logs - List audit log entries (paginated + filters)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const url = new URL(`${API_BASE_URL}/api/v1/audit-logs`);

        const queryParams = ['page_size', 'page_id', 'user_id', 'entity_type', 'action', 'facility_id'];
        queryParams.forEach((param) => {
            const value = searchParams.get(param);
            if (value) url.searchParams.set(param, value);
        });

        // Audit logs must be facility-scoped: prefer explicit query, else resolve from session/auth context.
        if (!url.searchParams.get('facility_id')) {
            const resolvedFacilityId = await resolveFacilityId(req, API_BASE_URL);
            if (resolvedFacilityId) {
                url.searchParams.set('facility_id', resolvedFacilityId);
            }
        }

        console.log('Proxy list audit logs request to:', url.toString());

        const res = await fetch(url.toString(), {
            method: 'GET',
            headers: getProxyHeaders(req),
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
