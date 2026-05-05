import { NextRequest, NextResponse } from 'next/server';
import { getInternalTokenFromCookie } from '@/lib/proxy-auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

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
    const token = getInternalTokenFromCookie(req);
    if (!token) return NextResponse.json({ error: 'Not authenticated as internal admin' }, { status: 401 });

    const facilityId = req.cookies.get('helix-support-facility')?.value || '';
    const response = NextResponse.json({ ok: true, support_mode: false }, { status: 200 });
    response.cookies.delete('helix-support-mode');
    response.cookies.delete('helix-support-facility');
    response.cookies.delete('helix-support-facility-name');
    response.cookies.delete('helix-facility');

    await emitAuditEvent(token, 'act_as_facility_ended', { facility_id: facilityId });
    return response;
}
