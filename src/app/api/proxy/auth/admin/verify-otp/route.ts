import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

function extractFacilityIdFromPayload(payload: unknown): string {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';
    const root = payload as Record<string, unknown>;

    const candidates: unknown[] = [
        root.facility_id,
        root.facilityId,
        root.current_facility_id,
        root.currentFacilityId,
        root.user,
        root.staff,
        root.admin,
        root.data,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
        const obj = candidate as Record<string, unknown>;
        const nestedId = String(
            obj.facility_id
            || obj.facilityId
            || obj.current_facility_id
            || obj.currentFacilityId
            || (obj.facility && typeof obj.facility === 'object'
                ? (obj.facility as Record<string, unknown>).id || (obj.facility as Record<string, unknown>).facility_id
                : '')
            || ''
        ).trim();
        if (nestedId) return nestedId;
    }

    return '';
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const url = `${API_BASE_URL}/api/v1/auth/admin/verify-otp`;

        console.log('Proxy admin verify-otp request to:', url);

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const text = await res.text();
        console.log('Backend response status:', res.status);
        console.log('Backend response text:', text.substring(0, 500));

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            console.error('Failed to parse backend response as JSON');
            return NextResponse.json(
                { error: 'Backend returned invalid response', details: text.substring(0, 200) },
                { status: 502 }
            );
        }

        const response = NextResponse.json(data, { status: res.status });
        if (res.ok) {
            if (data.access_token) {
                response.cookies.set('helix-session', data.access_token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    path: '/',
                    maxAge: 60 * 60 * 8,
                });
            }

            const facilityId = extractFacilityIdFromPayload(data);
            if (facilityId) {
                response.cookies.set('helix-facility', facilityId, {
                    httpOnly: false,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    path: '/',
                    maxAge: 60 * 60 * 8,
                });
            } else {
                response.cookies.delete('helix-facility');
            }
        }

        return response;
    } catch (err) {
        console.error('Proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
