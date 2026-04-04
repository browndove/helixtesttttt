import { getProxyHeaders } from '@/lib/proxy-auth';
import { resolveDepartmentIdByName } from '@/lib/proxy-resolve-department';
import { resolveFacilityId } from '@/lib/proxy-facility';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

type IncomingStaffBody = {
    facility_id?: string;
    facilityId?: string;
    department_id?: string;
    departmentId?: string;
    department?: string;
    dept?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    dob?: string;
    gender?: string;
    title?: string;
    job_title?: string;
    highest_qualification?: string;
    highest_qualifications?: string;
    is_doctor?: boolean;
    patient_access?: boolean;
    can_access_patients?: boolean;
    role?: string;
};

// GET /staff - List staff members (paginated, with filters)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const url = new URL(`${API_BASE_URL}/api/v1/staff`);
        const requestedFacilityId = searchParams.get('facility_id');
        const sessionFacilityId = await resolveFacilityId(req, API_BASE_URL);
        console.log('[listStaff] Resolved facilityId:', sessionFacilityId);
        if (!sessionFacilityId) {
            return NextResponse.json(
                { error: 'Unable to resolve facility for current session. Please log in again.' },
                { status: 400 }
            );
        }
        if (requestedFacilityId && requestedFacilityId !== sessionFacilityId) {
            return NextResponse.json(
                { error: 'Facility mismatch. Staff listing is restricted to your logged-in facility.' },
                { status: 403 }
            );
        }
        url.searchParams.set('facility_id', sessionFacilityId);

        // Forward all supported query params
        const queryParams = ['page_size', 'page_id', 'role', 'job_title', 'status', 'search'];
        queryParams.forEach((param) => {
            const value = searchParams.get(param);
            if (value) url.searchParams.set(param, value);
        });

        console.log('[listStaff] Request to:', url.toString());

        const res = await fetch(url.toString(), {
            method: 'GET',
            headers: getProxyHeaders(req),
        });

        const text = await res.text();
        console.log('Backend response status:', res.status);

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

        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        console.error('Proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}

// POST /staff - Create a staff member
export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as IncomingStaffBody;
        const requestedFacilityId = body.facility_id || body.facilityId;
        const sessionFacilityId = await resolveFacilityId(req, API_BASE_URL);
        if (!sessionFacilityId) {
            return NextResponse.json(
                { error: 'Unable to resolve facility for current session. Please log in again.' },
                { status: 400 }
            );
        }
        if (requestedFacilityId && requestedFacilityId !== sessionFacilityId) {
            return NextResponse.json(
                { error: 'Facility mismatch. Staff can only be created in your logged-in facility.' },
                { status: 403 }
            );
        }
        const facilityId = sessionFacilityId;
        const departmentId = body.department_id
            || body.departmentId
            || (facilityId ? await resolveDepartmentIdByName(req, facilityId, body.department || body.dept) : undefined);
        const payload: Record<string, unknown> = {
            facility_id: facilityId,
            department_id: departmentId,
            first_name: (body.first_name || '').trim(),
            last_name: (body.last_name || '').trim(),
            email: (body.email || '').trim(),
            phone: (body.phone || '').trim(),
            title: (body.title || '').trim(),
            job_title: (body.job_title || '').trim(),
            highest_qualifications: (body.highest_qualifications || body.highest_qualification || '').trim(),
            is_doctor: Boolean(body.is_doctor),
            // Backend field naming has varied; send both for compatibility.
            patient_access: Boolean(body.patient_access ?? body.can_access_patients),
            can_access_patients: Boolean(body.patient_access ?? body.can_access_patients),
            role: (body.role || 'staff').toLowerCase(),
        };
        if (body.dob) payload.dob = body.dob.trim();
        if (body.gender) payload.gender = body.gender.trim();
        const url = `${API_BASE_URL}/api/v1/staff`;

        console.log('Proxy create staff request to:', url);
        console.log('[createStaff] Payload:', JSON.stringify(payload));

        const res = await fetch(url, {
            method: 'POST',
            headers: getProxyHeaders(req),
            body: JSON.stringify(payload),
        });

        const text = await res.text();
        console.log('Backend response status:', res.status);
        if (!res.ok) console.log('[createStaff] Error response:', text.substring(0, 500));

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

        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        console.error('Proxy error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}
