import { getProxyHeaders } from '@/lib/proxy-auth';
import { buildTenantUpstreamUrl } from '@/lib/proxy-upstream';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

/** POST /api/v1/auth/admin-reset/{staff_id} — send setup email so user can set a new password. */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ staff_id: string }> },
) {
    try {
        const { staff_id } = await params;
        const upstream = await buildTenantUpstreamUrl(
            req,
            API_BASE_URL,
            `/api/v1/auth/admin-reset/${encodeURIComponent(staff_id)}`,
        );

        if (upstream instanceof NextResponse) return upstream;

        const { url } = upstream;
        const res = await fetch(url, {
            method: 'POST',
            headers: getProxyHeaders(req),
            body: JSON.stringify({}),
            signal: AbortSignal.timeout(20000),
        });

        const text = await res.text();
        let data: unknown;
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            return NextResponse.json(
                { error: 'Backend returned invalid response', details: text.substring(0, 200) },
                { status: 502 },
            );
        }

        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
