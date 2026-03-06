import { NextRequest, NextResponse } from 'next/server';
import { getProxyHeaders } from '@/lib/proxy-auth';
import { getTokenFromCookie } from '@/lib/proxy-auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// GET /facility-select - List all facilities available to the user
export async function GET(req: NextRequest) {
    try {
        const url = `${API_BASE_URL}/api/v1/facilities`;
        const res = await fetch(url, {
            method: 'GET',
            headers: getProxyHeaders(req),
        });
        if (!res.ok) {
            return NextResponse.json({ error: 'Failed to fetch facilities' }, { status: res.status });
        }
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data?.items || data?.data || data?.facilities || []);
        return NextResponse.json(list, { status: 200 });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST /facility-select - Set the active facility cookie
export async function POST(req: NextRequest) {
    try {
        const token = getTokenFromCookie(req);
        if (!token) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await req.json();
        const facilityId = body.facility_id;
        if (!facilityId || typeof facilityId !== 'string') {
            return NextResponse.json({ error: 'facility_id is required' }, { status: 400 });
        }

        const response = NextResponse.json({ ok: true, facility_id: facilityId }, { status: 200 });
        response.cookies.set('helix-facility', facilityId, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 30, // 30 days
        });
        return response;
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
