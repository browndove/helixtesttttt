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

        const { url } = upstream;
        const payload = mergeFacilityIntoBody(
            { conversation_retention_months: months },
            upstream.facilityId,
        );
        console.log('Proxy facility conversation-retention PUT:', url, payload);

        const res = await fetch(url, {
            method: 'PUT',
            headers: getProxyHeaders(req),
            body: JSON.stringify(payload),
        });

        const text = await res.text();
        let data: unknown;
        try {
            data = JSON.parse(text);
        } catch {
            return NextResponse.json(
                { error: 'Backend returned invalid response', details: text.substring(0, 200) },
                { status: res.status || 502 },
            );
        }
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        console.error('Proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
