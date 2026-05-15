import { getProxyHeaders } from '@/lib/proxy-auth';
import { ensureFacilityOnUrl } from '@/lib/proxy-upstream';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// GET /roles/active - List active (signed-in) roles
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        let url = new URL(`${API_BASE_URL}/api/v1/roles/active`);

        searchParams.forEach((value, key) => {
            if (key !== 'facility_id') url.searchParams.set(key, value);
        });

        const withFacility = await ensureFacilityOnUrl(req, API_BASE_URL, url);
        if (withFacility instanceof NextResponse) return withFacility;
        url = withFacility;

        console.log('Proxy list active roles request to:', url.toString());

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
