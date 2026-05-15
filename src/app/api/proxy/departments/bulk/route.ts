import { getProxyHeaders } from '@/lib/proxy-auth';
import { NextRequest, NextResponse } from 'next/server';
import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// POST /departments/bulk - Bulk create departments via CSV
export async function POST(req: NextRequest) {
    try {
        const contentType = req.headers.get('content-type') || '';
        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/departments/bulk`);

        if (upstream instanceof NextResponse) return upstream;

        const { url } = upstream;
        console.log('Proxy bulk create departments request to:', url);

        let res;
        if (contentType.includes('multipart/form-data')) {
            const formData = await req.formData();
            res = await fetch(url, {
                method: 'POST',
                body: formData,
            });
        } else {
            const body = await req.json();
            res = await fetch(url, {
                method: 'POST',
                headers: getProxyHeaders(req),
                body: JSON.stringify(body),
            });
        }

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
