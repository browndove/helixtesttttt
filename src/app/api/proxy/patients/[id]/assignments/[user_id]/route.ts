import { getProxyHeaders } from '@/lib/proxy-auth';
import { NextRequest, NextResponse } from 'next/server';
import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// DELETE /patients/:id/assignments/:user_id — Remove staff from patient
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; user_id: string }> }
) {
    try {
        const { id, user_id } = await params;
        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/patients/${id}/assignments/${user_id}`);

        if (upstream instanceof NextResponse) return upstream;

        const { url } = upstream;

        const res = await fetch(url, {
            method: 'DELETE',
            headers: getProxyHeaders(req),
        });
        const text = await res.text();
        let data: unknown = {};
        if (text.trim()) {
            try { data = JSON.parse(text); } catch {
                return NextResponse.json({ error: 'Backend returned invalid response', details: text.substring(0, 200) }, { status: 502 });
            }
        }
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
