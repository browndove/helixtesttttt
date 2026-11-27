import { getInternalTokenFromCookie } from '@/lib/proxy-auth';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

/**
 * GET /api/proxy/usage-metrics — cross-facility usage metrics (internal admins only).
 * Used by the analytics report export when several facilities are selected.
 */
export async function GET(req: NextRequest) {
    const token = getInternalTokenFromCookie(req);
    if (!token) {
        return NextResponse.json({ error: 'Not authenticated as internal admin' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const url = new URL(`${API_BASE_URL}/api/v1/usage-metrics`);

        const facilityId = searchParams.get('facility_id')?.trim() || null;
        if (facilityId) url.searchParams.set('facility_id', facilityId);

        // Repeated facility_ids=… and/or one comma-separated value.
        const facilityIds = Array.from(new Set(
            searchParams.getAll('facility_ids')
                .flatMap(value => value.split(','))
                .map(value => value.trim())
                .filter(Boolean)
        ));
        for (const id of facilityIds) url.searchParams.append('facility_ids', id);

        for (const key of ['days', 'from', 'to', 'daily_volume_days'] as const) {
            const value = searchParams.get(key);
            if (value) url.searchParams.set(key, value);
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        };
        const scopedFacility = facilityId || (facilityIds.length === 1 ? facilityIds[0] : null);
        if (scopedFacility) headers['X-Facility-Id'] = scopedFacility;

        const res = await fetch(url.toString(), { method: 'GET', headers, cache: 'no-store' });
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
