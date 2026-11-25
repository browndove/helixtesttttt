import { getProxyHeaders, hasInternalAdminSession } from '@/lib/proxy-auth';
import { resolveFacilityId } from '@/lib/proxy-facility';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

/** GET /api/proxy/feature-usage-metrics — daily active users and time in app for the current facility. */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const explicitFacilityId = hasInternalAdminSession(req) ? searchParams.get('facility_id')?.trim() || null : null;
        const facilityId = explicitFacilityId || await resolveFacilityId(req, API_BASE_URL);
        if (!facilityId) {
            return NextResponse.json(
                { error: 'Unable to resolve facility for current session. Please log in again.' },
                { status: 400 }
            );
        }

        const url = new URL(`${API_BASE_URL}/api/v1/feature-usage-metrics`);
        url.searchParams.set('facility_id', facilityId);
        for (const key of ['days', 'from', 'to'] as const) {
            const value = searchParams.get(key);
            if (value) url.searchParams.set(key, value);
        }

        const res = await fetch(url.toString(), {
            method: 'GET',
            headers: { ...(getProxyHeaders(req) as Record<string, string>), 'X-Facility-Id': facilityId },
            cache: 'no-store',
        });

        const text = await res.text();
        let data: unknown;
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
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
