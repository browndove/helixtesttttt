import { getProxyHeaders } from '@/lib/proxy-auth';
import { NextRequest, NextResponse } from 'next/server';
import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

const ALLOWED = new Set([1, 3, 6]);

function normalizeRetentionMonths(raw: unknown): 1 | 3 | 6 | null | undefined {
    if (raw === null) return null;
    if (raw === undefined) return undefined;
    if (typeof raw === 'string' && raw.trim() === '') return null;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) return undefined;
    if (ALLOWED.has(n)) return n as 1 | 3 | 6;
    return undefined;
}

function tryParseJson(text: string): unknown | undefined {
    const trimmed = text.trim();
    if (!trimmed) return undefined;
    try {
        return JSON.parse(trimmed) as unknown;
    } catch {
        return undefined;
    }
}

async function putUpstream(
    url: string,
    headers: HeadersInit,
    payload: Record<string, unknown>,
): Promise<{ status: number; text: string; data: unknown | undefined }> {
    const res = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
    });
    const text = await res.text();
    return { status: res.status, text, data: tryParseJson(text) };
}

// PUT /facilities/{id}/conversation-retention — admin retention policy (1 | 3 | 6 | null)
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
        const months = normalizeRetentionMonths(body.conversation_retention_months);

        if (months === undefined) {
            return NextResponse.json(
                { error: 'conversation_retention_months must be 1, 3, 6, or null' },
                { status: 400 },
            );
        }

        const upstream = await buildTenantUpstreamUrl(
            req,
            API_BASE_URL,
            `/api/v1/facilities/${id}/conversation-retention`,
        );
        if (upstream instanceof NextResponse) return upstream;

        const headers = getProxyHeaders(req);
        const retentionPayload = mergeFacilityIntoBody(
            { conversation_retention_months: months },
            upstream.facilityId,
        );

        console.log('Proxy facility conversation-retention PUT:', upstream.url, retentionPayload);

        let result = await putUpstream(upstream.url, headers, retentionPayload);

        // Dedicated route missing / HTML 404 → fall back to facility PUT (same field on FacilityResponse).
        const looksMissing =
            result.status === 404
            || (result.data === undefined && /404|not found|page not found/i.test(result.text));

        if (looksMissing) {
            const facilityUpstream = await buildTenantUpstreamUrl(
                req,
                API_BASE_URL,
                `/api/v1/facilities/${id}`,
            );
            if (facilityUpstream instanceof NextResponse) return facilityUpstream;

            const facilityPayload = mergeFacilityIntoBody(
                { conversation_retention_months: months },
                facilityUpstream.facilityId,
            );
            console.log(
                'Proxy conversation-retention fallback to facility PUT:',
                facilityUpstream.url,
                facilityPayload,
            );
            result = await putUpstream(facilityUpstream.url, headers, facilityPayload);
        }

        if (result.data !== undefined) {
            return NextResponse.json(result.data, { status: result.status });
        }

        // Empty body on success — synthesize Facility-shaped response for the client.
        if (result.status >= 200 && result.status < 300) {
            return NextResponse.json(
                { id, conversation_retention_months: months },
                { status: 200 },
            );
        }

        console.error(
            'Conversation-retention upstream non-JSON:',
            result.status,
            result.text.substring(0, 300),
        );
        return NextResponse.json(
            {
                error: 'Failed to update conversation retention',
                details: result.text.substring(0, 200) || `HTTP ${result.status}`,
            },
            { status: result.status || 502 },
        );
    } catch (err) {
        console.error('Proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
