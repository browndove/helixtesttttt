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

// PUT /units/{id}/floors/{floorId} — Rename or reorder a floor
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; floorId: string }> }
) {
    try {
        const { id, floorId } = await params;
        const body = await req.json();
        const upstream = await buildTenantUpstreamUrl(
            req,
            API_BASE_URL,
            `/api/v1/units/${id}/floors/${floorId}`,
        );
        if (upstream instanceof NextResponse) return upstream;

        const payload = mergeFacilityIntoBody(body as Record<string, unknown>, upstream.facilityId);
        const res = await fetch(upstream.url, {
            method: 'PUT',
            headers: getProxyHeaders(req),
            body: JSON.stringify(payload),
        });
        const text = await res.text();
        const data = tryParseJson(text);
        if (data === undefined) {
            return NextResponse.json(
                { error: 'Backend returned non-JSON response', details: text.substring(0, 200) },
                { status: res.status || 502 },
            );
        }
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}

// DELETE /units/{id}/floors/{floorId} — Remove a floor
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; floorId: string }> }
) {
    try {
        const { id, floorId } = await params;
        const upstream = await buildTenantUpstreamUrl(
            req,
            API_BASE_URL,
            `/api/v1/units/${id}/floors/${floorId}`,
        );
        if (upstream instanceof NextResponse) return upstream;

        const res = await fetch(upstream.url, {
            method: 'DELETE',
            headers: getProxyHeaders(req),
        });
        const text = await res.text();
        const data = tryParseJson(text);
        if (data === undefined && text.trim()) {
            return NextResponse.json(
                { error: 'Backend returned non-JSON response', details: text.substring(0, 200) },
                { status: res.status || 502 },
            );
        }
        return NextResponse.json(data ?? { message: 'Floor deleted' }, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
