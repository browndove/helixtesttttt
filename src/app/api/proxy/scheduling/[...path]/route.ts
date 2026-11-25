import { NextRequest, NextResponse } from 'next/server';
import { getProxyHeaders } from '@/lib/proxy-auth';
import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

/**
 * Pass-through for /api/v1/scheduling/* (settings, roster, targets, attendance, …).
 * Adds the session's facility_id to the query, and to JSON object bodies that don't set one.
 */
async function forward(req: NextRequest, params: Promise<{ path: string[] }>) {
    try {
        const { path } = await params;
        const query = Object.fromEntries(req.nextUrl.searchParams.entries());
        const upstream = await buildTenantUpstreamUrl(
            req,
            API_BASE_URL,
            `/api/v1/scheduling/${path.map(encodeURIComponent).join('/')}`,
            query,
        );
        if (upstream instanceof NextResponse) return upstream;

        let body: string | undefined;
        if (req.method !== 'GET' && req.method !== 'DELETE') {
            const raw = await req.text();
            if (raw) {
                try {
                    const parsed: unknown = JSON.parse(raw);
                    body = JSON.stringify(
                        parsed && typeof parsed === 'object' && !Array.isArray(parsed) && !('facility_id' in parsed)
                            ? mergeFacilityIntoBody(parsed as Record<string, unknown>, upstream.facilityId)
                            : parsed,
                    );
                } catch {
                    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
                }
            }
        }

        const res = await fetch(upstream.url, { method: req.method, headers: getProxyHeaders(req), body });
        const text = await res.text();
        if (!text) return new NextResponse(null, { status: res.status === 204 ? 204 : res.status });
        try {
            return NextResponse.json(JSON.parse(text), { status: res.status });
        } catch {
            // Plain-text replies (e.g. "404 page not found") keep their status.
            return NextResponse.json({ error: text.trim().substring(0, 200) || `HTTP ${res.status}` }, { status: res.ok ? 502 : res.status });
        }
    } catch (err) {
        console.error('Scheduling proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}

type Ctx = { params: Promise<{ path: string[] }> };

export const GET = (req: NextRequest, { params }: Ctx) => forward(req, params);
export const POST = (req: NextRequest, { params }: Ctx) => forward(req, params);
export const PUT = (req: NextRequest, { params }: Ctx) => forward(req, params);
export const PATCH = (req: NextRequest, { params }: Ctx) => forward(req, params);
export const DELETE = (req: NextRequest, { params }: Ctx) => forward(req, params);
