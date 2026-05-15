import { getProxyHeaders } from '@/lib/proxy-auth';
import { NextRequest, NextResponse } from 'next/server';
import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

function tryParseJson(text: string): unknown | undefined {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

// DELETE /departments/{id}/wards/{wardId}
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; wardId: string }> }
) {
    try {
        const { id, wardId } = await params;
        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/departments/${id}/wards/${wardId}`);

        if (upstream instanceof NextResponse) return upstream;

        const { url } = upstream;
        console.log('Proxy delete ward request to:', url);

        const res = await fetch(url, {
            method: 'DELETE',
            headers: getProxyHeaders(req),
        });

        const text = await res.text();
        console.log('Backend response status:', res.status);

        const data = tryParseJson(text);
        if (data === undefined && text.trim()) {
            return NextResponse.json(
                { error: 'Backend returned non-JSON response', details: text.substring(0, 200) },
                { status: res.status || 502 }
            );
        }
        return NextResponse.json(data ?? { success: true }, { status: res.status });
    } catch (err) {
        console.error('Proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
