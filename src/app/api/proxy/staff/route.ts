import { getProxyHeaders } from '@/lib/proxy-auth';
import { resolveDepartmentIdByName } from '@/lib/proxy-resolve-department';
import { resolveFacilityId } from '@/lib/proxy-facility';
import { NextRequest, NextResponse } from 'next/server';
import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

type IncomingStaffBody = {
    facility_id?: string;
    facilityId?: string;
    department_id?: string;
    departmentId?: string;
    department?: string;
    dept?: string;
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    dob?: string;
    employee_id?: string;
    gender?: string;
    title?: string;
    job_title?: string;
    highest_qualification?: string;
    highest_qualifications?: string;
    additional_title?: string;
    is_doctor?: boolean;
    patient_access?: boolean;
    can_access_patients?: boolean;
    is_scheduler?: boolean;
    scheduler?: boolean;
    can_schedule?: boolean;
    can_manage_schedule?: boolean;
    role?: string;
};

function mapUpstreamNetworkError(err: unknown) {
    const cause = (err && typeof err === 'object' && 'cause' in err)
        ? (err as { cause?: { code?: string; hostname?: string } }).cause
        : undefined;
    const code = cause?.code;
    if (code === 'ENOTFOUND') {
        const host = cause?.hostname || 'upstream host';
        return {
            status: 502,
            body: {
                error: 'Upstream API host could not be resolved',
                details: `DNS lookup failed for ${host}`,
            },
        };
    }
    if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT') {
        return {
            status: 502,
            body: {
                error: 'Upstream API is unreachable',
                details: code,
            },
        };
    }
    return null;
}

// GET /staff - List staff members (paginated, with filters)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const query: Record<string, string | undefined> = {};
        for (const param of ['page_size', 'page_id', 'role', 'job_title', 'status', 'search'] as const) {
            const value = searchParams.get(param);
            if (value) query[param] = value;
        }

        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/staff`, query);
        if (upstream instanceof NextResponse) return upstream;

        const { url, facilityId } = upstream;
        console.log('[listStaff] Resolved facilityId:', facilityId);
        console.log('[listStaff] Request to:', url);

        const res = await fetch(url, {
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
        const mapped = mapUpstreamNetworkError(err);
        if (mapped) return NextResponse.json(mapped.body, { status: mapped.status });
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
        const canManageSchedule = Boolean(
            body.can_manage_schedule ?? body.is_scheduler ?? body.scheduler ?? body.can_schedule,
        );
        const payload: Record<string, unknown> = {
            facility_id: facilityId,
            first_name: (body.first_name || '').trim(),
            middle_name: (body.middle_name || '').trim(),
            last_name: (body.last_name || '').trim(),
            // Same core fields as staff bulk upload; extras are optional when provided.
            can_manage_schedule: canManageSchedule,
            is_scheduler: canManageSchedule,
            role: (body.role || 'staff').toLowerCase(),
        };
        if (departmentId) payload.department_id = departmentId;
        const email = (body.email || '').trim();
        const phone = (body.phone || '').trim();
        const title = (body.title || '').trim();
        const jobTitle = (body.job_title || '').trim();
        const highestQual = (body.highest_qualifications || body.highest_qualification || '').trim();
        const additionalTitle = (body.additional_title || '').trim();
        const employeeId = (body.employee_id || '').trim();
        if (email) payload.email = email;
        if (phone) payload.phone = phone;
        if (title) payload.title = title;
        if (jobTitle) payload.job_title = jobTitle;
        if (highestQual) {
            payload.highest_qualifications = highestQual;
            payload.highest_qualification = highestQual;
        }
        if (additionalTitle) payload.additional_title = additionalTitle;
        if (employeeId) payload.employee_id = employeeId;
        if (!payload.middle_name) delete payload.middle_name;
        if (body.dob) payload.dob = body.dob.trim();
        if (body.gender) payload.gender = body.gender.trim();
        if (body.is_doctor !== undefined) payload.is_doctor = Boolean(body.is_doctor);
        if (body.patient_access !== undefined || body.can_access_patients !== undefined) {
            const patientAccess = Boolean(body.patient_access ?? body.can_access_patients);
            payload.patient_access = patientAccess;
            payload.can_access_patients = patientAccess;
        }
        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/staff`);

        if (upstream instanceof NextResponse) return upstream;

        const { url } = upstream;
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
