import { getProxyHeaders } from '@/lib/proxy-auth';
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
    job_title?: string;
    role?: string;
};

async function resolveDepartmentIdByName(req: NextRequest, facilityId: string, departmentName?: string): Promise<string | undefined> {
    if (!departmentName?.trim()) return undefined;

    try {
        const url = new URL(`${API_BASE_URL}/api/v1/departments`);
        url.searchParams.set('facility_id', facilityId);

        const res = await fetch(url.toString(), {
            method: 'GET',
            headers: getProxyHeaders(req),
        });
        if (!res.ok) return undefined;

        const data: unknown = await res.json();
        const list = Array.isArray(data)
            ? data
            : (data && typeof data === 'object'
                ? ((data as { items?: unknown; data?: unknown; departments?: unknown }).items
                    || (data as { items?: unknown; data?: unknown; departments?: unknown }).data
                    || (data as { items?: unknown; data?: unknown; departments?: unknown }).departments)
                : []);
        if (!Array.isArray(list)) return undefined;

        const normalizedName = departmentName.trim().toLowerCase();
        const matched = list.find((item: unknown) => {
            if (!item || typeof item !== 'object') return false;
            const rec = item as { name?: string; department_name?: string };
            const name = (rec.name || rec.department_name || '').trim().toLowerCase();
            return name === normalizedName;
        }) as { id?: string; department_id?: string } | undefined;

        return matched?.id || matched?.department_id;
    } catch {
        return undefined;
    }
}

// GET /staff - List staff members (paginated, with filters)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const url = new URL(`${API_BASE_URL}/api/v1/staff`);
        const facilityId = searchParams.get('facility_id') || await resolveFacilityId(req, API_BASE_URL);
        console.log('[listStaff] Resolved facilityId:', facilityId);
        if (facilityId) url.searchParams.set('facility_id', facilityId);

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
        const facilityId = body.facility_id || body.facilityId || await resolveFacilityId(req, API_BASE_URL);
        const departmentId = body.department_id
            || body.departmentId
            || (facilityId ? await resolveDepartmentIdByName(req, facilityId, body.department || body.dept) : undefined);
        const payload = {
            facility_id: facilityId,
            department_id: departmentId,
            first_name: (body.first_name || '').trim(),
            last_name: (body.last_name || '').trim(),
            email: (body.email || '').trim(),
            phone: (body.phone || '').trim(),
            job_title: (body.job_title || '').trim(),
            role: (body.role || 'staff').toLowerCase(),
        };
        const url = `${API_BASE_URL}/api/v1/staff`;

        console.log('Proxy create staff request to:', url);

        const res = await fetch(url, {
            method: 'POST',
            headers: getProxyHeaders(req),
            body: JSON.stringify(payload),
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
