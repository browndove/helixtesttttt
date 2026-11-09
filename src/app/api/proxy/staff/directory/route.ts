import { getProxyHeaders } from '@/lib/proxy-auth';
import { resolveFacilityId } from '@/lib/proxy-facility';
import { NextRequest, NextResponse } from 'next/server';
import { buildTenantUpstreamUrl } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

type IncomingDirectoryBody = {
    facility_id?: string;
    facilityId?: string;
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    dob?: string;
    employee_id?: string;
    can_manage_schedule?: boolean;
    patient_access?: boolean;
};

/**
 * POST /api/v1/staff/directory — add one person to the facility directory
 * (same core fields as bulk upload; optional patient_access).
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as IncomingDirectoryBody;
        const requestedFacilityId = body.facility_id || body.facilityId;
        const sessionFacilityId = await resolveFacilityId(req, API_BASE_URL);
        if (!sessionFacilityId) {
            return NextResponse.json(
                { error: 'Unable to resolve facility for current session. Please log in again.' },
                { status: 400 },
            );
        }
        if (requestedFacilityId && requestedFacilityId !== sessionFacilityId) {
            return NextResponse.json(
                { error: 'Facility mismatch. Staff can only be created in your logged-in facility.' },
                { status: 403 },
            );
        }

        const firstName = (body.first_name || '').trim();
        const lastName = (body.last_name || '').trim();
        const dob = (body.dob || '').trim();
        if (!firstName || !lastName || !dob) {
            return NextResponse.json(
                { error: 'first_name, last_name, and dob are required' },
                { status: 400 },
            );
        }
        if (typeof body.can_manage_schedule !== 'boolean') {
            return NextResponse.json(
                { error: 'can_manage_schedule must be true or false' },
                { status: 400 },
            );
        }

        const payload: Record<string, unknown> = {
            facility_id: sessionFacilityId,
            first_name: firstName,
            last_name: lastName,
            dob,
            can_manage_schedule: body.can_manage_schedule,
        };
        const middleName = (body.middle_name || '').trim();
        const employeeId = (body.employee_id || '').trim();
        if (middleName) payload.middle_name = middleName;
        if (employeeId) payload.employee_id = employeeId;
        // Omit patient_access when the admin chose "Decide from job category".
        if (typeof body.patient_access === 'boolean') {
            payload.patient_access = body.patient_access;
        }

        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/staff/directory`);
        if (upstream instanceof NextResponse) return upstream;

        const res = await fetch(upstream.url, {
            method: 'POST',
            headers: getProxyHeaders(req),
            body: JSON.stringify(payload),
        });

        const text = await res.text();
        let data: unknown;
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            return NextResponse.json(
                { error: 'Backend returned invalid response', details: text.substring(0, 200) },
                { status: 502 },
            );
        }

        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
