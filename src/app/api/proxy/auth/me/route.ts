import { getProxyHeaders } from '@/lib/proxy-auth';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

function tryParseJson(text: string): unknown | undefined {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

function extractFacilityId(payload: unknown): string {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';
    const root = payload as Record<string, unknown>;
    const user = root.user && typeof root.user === 'object' ? root.user as Record<string, unknown> : undefined;
    const staff = root.staff && typeof root.staff === 'object' ? root.staff as Record<string, unknown> : undefined;

    const candidates = [
        root.facility_id,
        root.facilityId,
        root.current_facility_id,
        root.currentFacilityId,
        user?.facility_id,
        user?.facilityId,
        user?.current_facility_id,
        user?.currentFacilityId,
        staff?.facility_id,
        staff?.facilityId,
        staff?.current_facility_id,
        staff?.currentFacilityId,
    ];

    const match = candidates.find((v) => typeof v === 'string' && v.trim());
    return typeof match === 'string' ? match.trim() : '';
}

// GET /auth/me - Get current user + auth settings
export async function GET(req: NextRequest) {
    try {
        const url = `${API_BASE_URL}/api/v1/auth/me`;

        console.log('Proxy auth me request to:', url);

        const res = await fetch(url, {
            method: 'GET',
            headers: getProxyHeaders(req),
        });

        const text = await res.text();
        console.log('Backend response status:', res.status);
        const data = tryParseJson(text);
        if (data === undefined) {
            console.error('Backend returned non-JSON response');
            return NextResponse.json(
                { error: 'Backend returned non-JSON response', details: text.substring(0, 200) },
                { status: res.status || 502 }
            );
        }

        const response = NextResponse.json(data, { status: res.status });
        if (res.ok) {
            const facilityId = extractFacilityId(data);
            if (facilityId) {
                response.cookies.set('helix-facility', facilityId, {
                    httpOnly: false,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    path: '/',
                    maxAge: 60 * 60 * 8,
                });
            }
        }
        return response;
    } catch (err) {
        console.error('Proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
