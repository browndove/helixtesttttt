import { getProxyHeaders } from '@/lib/proxy-auth';
import { NextRequest, NextResponse } from 'next/server';
import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// DELETE /teams/{id}/roles/{role_id} - Remove a role from a team
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; role_id: string }> }
) {
    try {
        const { id, role_id: roleId } = await params;
        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/teams/${id}/roles/${encodeURIComponent(roleId)}`);

        if (upstream instanceof NextResponse) return upstream;

        const { url } = upstream;
        const res = await fetch(url, {
            method: 'DELETE',
            headers: getProxyHeaders(req),
        });

        const text = await res.text();

        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
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
