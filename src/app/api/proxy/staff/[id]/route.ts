import { getProxyHeaders } from '@/lib/proxy-auth';
import { resolveDepartmentIdByName } from '@/lib/proxy-resolve-department';
import { resolveFacilityId } from '@/lib/proxy-facility';
import { NextRequest, NextResponse } from 'next/server';
import { buildTenantUpstreamUrl, mergeFacilityIntoBody } from '@/lib/proxy-upstream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// GET /staff/{id} - Get a staff member
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/staff/${id}`);

        if (upstream instanceof NextResponse) return upstream;

        const { url } = upstream;
        console.log('Proxy get staff member request to:', url);

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
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Proxy error', details: message }, { status: 500 });
    }
}

// PUT /staff/{id} - Update a staff member
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = (await req.json()) as Record<string, unknown>;
        const sessionFacilityId = await resolveFacilityId(req, API_BASE_URL);

        const hasExplicitDeptId = Boolean(
            String(body.department_id || body.departmentId || '').trim()
        );
        const deptLabel = String(body.department || body.dept || '').trim();
        const resolvedDeptId =
            hasExplicitDeptId
                ? String(body.department_id || body.departmentId || '').trim()
                : sessionFacilityId && deptLabel
                    ? await resolveDepartmentIdByName(req, sessionFacilityId, deptLabel)
                    : undefined;

        const email = String(body.email || '').trim();
        const phone = String(body.phone || '').trim();
        const hq = String(body.highest_qualification || body.highest_qualifications || '').trim();
        const departmentId = resolvedDeptId
            || String(body.department_id || body.departmentId || '').trim()
            || undefined;

        const forward: Record<string, unknown> = {};
        const copyString = (key: string, value: unknown) => {
            const v = String(value ?? '').trim();
            if (v) forward[key] = v;
        };
        copyString('first_name', body.first_name);
        copyString('middle_name', body.middle_name);
        copyString('last_name', body.last_name);
        if (email) forward.email = email;
        if (phone) forward.phone = phone;
        copyString('job_title', body.job_title || body.title);
        if (hq) forward.highest_qualification = hq;
        copyString('dob', body.dob);
        copyString('gender', body.gender);
        copyString('employee_id', body.employee_id);
        copyString('additional_title', body.additional_title);
        if (departmentId) forward.department_id = departmentId;
        if (body.patient_access !== undefined || body.can_access_patients !== undefined) {
            forward.patient_access = Boolean(body.patient_access ?? body.can_access_patients);
        }
        if (body.is_doctor !== undefined) {
            forward.is_doctor = Boolean(body.is_doctor);
        }
        if (body.account_expires_on) {
            forward.account_expires_on = String(body.account_expires_on).trim();
        }
        if (body.clear_account_expires_on) {
            forward.clear_account_expires_on = true;
        }

        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/staff/${id}`);


        if (upstream instanceof NextResponse) return upstream;


        const { url } = upstream;
        console.log('Proxy update staff member request to:', url);

        const res = await fetch(url, {
            method: 'PUT',
            headers: getProxyHeaders(req),
            body: JSON.stringify(forward),
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

// DELETE /staff/{id} - Delete a staff member
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const upstream = await buildTenantUpstreamUrl(req, API_BASE_URL, `/api/v1/staff/${id}`);

        if (upstream instanceof NextResponse) return upstream;

        const { url } = upstream;
        console.log('Proxy delete staff member request to:', url);

        const res = await fetch(url, {
            method: 'DELETE',
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
