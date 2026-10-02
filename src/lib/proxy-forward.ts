import { NextRequest, NextResponse } from 'next/server';
import { getProxyHeaders } from '@/lib/proxy-auth';
import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

type ForwardOptions = {
    /** Upstream path under /api/v1, e.g. `blocks/abc/floors`. */
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    /** Query params copied from the incoming request onto the upstream URL. */
    forwardQuery?: string[];
};

/**
 * Forwards a tenant-scoped request to the Helix API, adding facility_id to the
 * URL and (for writes) to the body. Used by the bed hierarchy routes, which are
 * all plain CRUD passthroughs.
 */
export async function forwardToApi(req: NextRequest, options: ForwardOptions): Promise<NextResponse> {
    const { path, method, forwardQuery } = options;
    try {
        const query: Record<string, string | null> = {};
        if (forwardQuery?.length) {
            const incoming = new URL(req.url).searchParams;
            for (const key of forwardQuery) query[key] = incoming.get(key);
        }

        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, path, query);
        if (upstream instanceof NextResponse) return upstream;

        let body: string | undefined;
        if (method !== 'GET' && method !== 'DELETE') {
            const raw = await req.json().catch(() => ({}));
            const record = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
            body = JSON.stringify(mergeFacilityIntoBody(record, upstream.facilityId));
        }

        const res = await fetch(upstream.url, {
            method,
            headers: getProxyHeaders(req),
            ...(body ? { body } : {}),
        });

        if (res.status === 204) return new NextResponse(null, { status: 204 });

        const text = await res.text();
        if (!text) {
            return NextResponse.json({ message: 'OK' }, { status: res.status });
        }
        try {
            return NextResponse.json(JSON.parse(text), { status: res.status });
        } catch {
            return NextResponse.json(
                { error: 'Backend returned invalid response', details: text.substring(0, 200) },
                { status: res.status >= 400 ? res.status : 502 },
            );
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
