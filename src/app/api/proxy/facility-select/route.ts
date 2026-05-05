import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromCookie } from '@/lib/proxy-auth';
import { getInternalTokenFromCookie } from '@/lib/proxy-auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

function tokenHasInternalRole(token: string | undefined): boolean {
    if (!token) return false;
    try {
        const payloadRaw = token.split('.')[1];
        if (!payloadRaw) return false;
        const payload = JSON.parse(atob(payloadRaw)) as Record<string, unknown>;
        const candidates = [
            payload.role,
            payload.system_role,
            payload.user_role,
            payload.user && typeof payload.user === 'object' ? (payload.user as Record<string, unknown>).role : undefined,
            payload.user && typeof payload.user === 'object' ? (payload.user as Record<string, unknown>).system_role : undefined,
            payload.user && typeof payload.user === 'object' ? (payload.user as Record<string, unknown>).user_role : undefined,
        ]
            .map((v) => String(v || '').toLowerCase())
            .filter(Boolean);
        return candidates.some((r) => r.includes('internal') || r.includes('superadmin') || r.includes('super_admin'));
    } catch {
        return false;
    }
}

// GET /facility-select - List all facilities available to the user
export async function GET(req: NextRequest) {
    try {
        const internalToken = getInternalTokenFromCookie(req);
        if (!tokenHasInternalRole(internalToken)) {
            return NextResponse.json({ error: 'Internal admin access required' }, { status: 403 });
        }
        const url = `${API_BASE_URL}/api/v1/facilities`;
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${internalToken}`,
            },
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
        const token = getInternalTokenFromCookie(req) || getTokenFromCookie(req);
        if (!tokenHasInternalRole(token)) {
            return NextResponse.json({ error: 'Internal admin access required' }, { status: 403 });
        }
        if (!token) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await req.json();
        const facilityId = body.facility_id;
        if (!facilityId || typeof facilityId !== 'string') {
            return NextResponse.json({ error: 'facility_id is required' }, { status: 400 });
        }

        const response = NextResponse.json({ ok: true, facility_id: facilityId }, { status: 200 });
        response.cookies.set('helix-support-mode', '1', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 8,
        });
        response.cookies.set('helix-support-facility', facilityId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 8,
        });
        response.cookies.set('helix-facility', facilityId, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 8,
        });
        return response;
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
