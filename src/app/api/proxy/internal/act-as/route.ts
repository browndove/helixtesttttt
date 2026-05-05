import { NextRequest, NextResponse } from 'next/server';
import { getInternalTokenFromCookie } from '@/lib/proxy-auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

function getFacilityName(raw: unknown): string {
    if (!raw || typeof raw !== 'object') return '';
    const rec = raw as Record<string, unknown>;
    return String(rec.name || rec.facility_name || rec.hospital_name || '').trim();
}

async function emitAuditEvent(token: string, action: string, metadata: Record<string, unknown>) {
    try {
        await fetch(`${API_BASE_URL}/api/v1/audit-logs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                action,
                entity_type: 'internal_support',
                metadata,
            }),
        });
    } catch {
        // Best-effort only.
    }
}

export async function POST(req: NextRequest) {
    try {
        const token = getInternalTokenFromCookie(req);
        if (!token) return NextResponse.json({ error: 'Not authenticated as internal admin' }, { status: 401 });

        const body = await req.json();
        const facilityId = String(body?.facility_id || '').trim();
        const reason = String(body?.reason || '').trim();
        const ticketId = String(body?.ticket_id || '').trim();
        if (!facilityId) {
            return NextResponse.json({ error: 'facility_id is required' }, { status: 400 });
        }

        // Validate the chosen facility is in accessible list for this internal session.
        const facilitiesRes = await fetch(`${API_BASE_URL}/api/v1/facilities`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });
        const facilitiesData: unknown = await facilitiesRes.json().catch(() => []);
        const list = Array.isArray(facilitiesData)
            ? facilitiesData
            : (facilitiesData && typeof facilitiesData === 'object'
                ? (((facilitiesData as { items?: unknown; data?: unknown; facilities?: unknown }).items)
                    || ((facilitiesData as { items?: unknown; data?: unknown; facilities?: unknown }).data)
                    || ((facilitiesData as { items?: unknown; data?: unknown; facilities?: unknown }).facilities)
                    || [])
                : []);
        if (!Array.isArray(list)) {
            return NextResponse.json({ error: 'Could not validate facility access' }, { status: 502 });
        }
        const matched = list.find((f: unknown) => {
            if (!f || typeof f !== 'object') return false;
            const rec = f as Record<string, unknown>;
            return String(rec.id || rec.facility_id || '').trim() === facilityId;
        });
        if (!matched) {
            return NextResponse.json({ error: 'Facility is not accessible to this internal admin' }, { status: 403 });
        }

        const facilityName = getFacilityName(matched);
        const response = NextResponse.json(
            { ok: true, support_mode: true, facility_id: facilityId, facility_name: facilityName },
            { status: 200 },
        );
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
        response.cookies.set('helix-support-facility-name', facilityName, {
            httpOnly: false,
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
        await emitAuditEvent(token, 'act_as_facility_started', {
            facility_id: facilityId,
            facility_name: facilityName,
            reason,
            ticket_id: ticketId,
        });
        return response;
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const token = getInternalTokenFromCookie(req);
    if (!token) return NextResponse.json({ support_mode: false }, { status: 200 });
    const supportMode = req.cookies.get('helix-support-mode')?.value === '1';
    const facilityId = req.cookies.get('helix-support-facility')?.value || '';
    const facilityName = req.cookies.get('helix-support-facility-name')?.value || '';
    return NextResponse.json(
        { support_mode: supportMode, facility_id: facilityId, facility_name: facilityName },
        { status: 200 },
    );
}
