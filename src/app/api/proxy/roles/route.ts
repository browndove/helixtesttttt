import { getProxyHeaders } from '@/lib/proxy-auth';
import { resolveFacilityId } from '@/lib/proxy-facility';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

type IncomingRoleBody = {
    name?: string;
    description?: string;
    facility_id?: string;
    facilityId?: string;
    department_id?: string;
    departmentId?: string;
    department?: string;
    priority?: string;
    mandatory?: boolean;
    sign_in_allowed_user_ids?: string[];
    external_messaging?: boolean;
    is_transfer_role?: boolean;
    enabled?: boolean;
};

async function resolveDepartmentIdByName(req: NextRequest, facilityId: string, departmentName?: string): Promise<string | undefined> {
    if (!departmentName?.trim()) {
        console.log('[resolveDept] No department name provided');
        return undefined;
    }

    try {
        const url = new URL(`${API_BASE_URL}/api/v1/departments`);
        url.searchParams.set('facility_id', facilityId);

        console.log('[resolveDept] Fetching departments from:', url.toString());

        const res = await fetch(url.toString(), {
            method: 'GET',
            headers: getProxyHeaders(req),
        });
        if (!res.ok) {
            console.log('[resolveDept] Backend returned status:', res.status);
            return undefined;
        }

        const data: unknown = await res.json();
        console.log('[resolveDept] Raw departments response:', JSON.stringify(data).substring(0, 500));

        if (!Array.isArray(data)) {
            console.log('[resolveDept] Response is not an array');
            return undefined;
        }

        const normalizedName = departmentName.trim().toLowerCase();
        console.log('[resolveDept] Looking for department:', normalizedName, 'in', data.length, 'departments');

        const matched = data.find((item: unknown) => {
            if (!item || typeof item !== 'object') return false;
            const rec = item as { name?: string; department_name?: string };
            const itemName = rec.name || rec.department_name || '';
            return itemName.trim().toLowerCase() === normalizedName;
        }) as { id?: string } | undefined;

        console.log('[resolveDept] Matched:', matched ? JSON.stringify(matched).substring(0, 200) : 'none');
        return matched?.id;
    } catch (err) {
        console.error('[resolveDept] Error:', err);
        return undefined;
    }
}

function normalizePriority(priority?: string): 'critical' | 'standard' {
    return priority?.trim().toLowerCase() === 'critical' ? 'critical' : 'standard';
}

function resolvePriority(body: IncomingRoleBody): 'critical' | 'standard' {
    if (typeof body.mandatory === 'boolean') {
        return body.mandatory ? 'critical' : 'standard';
    }
    return normalizePriority(body.priority);
}

// GET /roles - List roles (query params: facility_id, department_id, priority)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const url = new URL(`${API_BASE_URL}/api/v1/roles`);

        const facilityId = searchParams.get('facility_id') || await resolveFacilityId(req, API_BASE_URL);
        const departmentId = searchParams.get('department_id');
        const priority = searchParams.get('priority');

        if (facilityId) url.searchParams.set('facility_id', facilityId);
        if (departmentId) url.searchParams.set('department_id', departmentId);
        if (priority) url.searchParams.set('priority', priority);

        console.log('Proxy list roles request to:', url.toString());

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

// POST /roles - Create a role
export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as IncomingRoleBody;
        console.log('[createRole] Incoming body:', JSON.stringify({ name: body.name, department: body.department, department_id: body.department_id, facility_id: body.facility_id }));
        const facilityId = body.facility_id || body.facilityId || await resolveFacilityId(req, API_BASE_URL);
        console.log('[createRole] Resolved facilityId:', facilityId);
        const departmentIdFromBody = body.department_id || body.departmentId;
        const departmentId = facilityId
            ? (departmentIdFromBody || await resolveDepartmentIdByName(req, facilityId, body.department))
            : departmentIdFromBody;
        console.log('[createRole] Resolved departmentId:', departmentId);
        const payload: Record<string, unknown> = {
            name: body.name,
            description: body.description || '',
            facility_id: facilityId,
            department: body.department,
            department_id: departmentId,
            priority: resolvePriority(body),
            sign_in_allowed_user_ids: Array.isArray(body.sign_in_allowed_user_ids)
                ? body.sign_in_allowed_user_ids
                : undefined,
        };
        if (Object.prototype.hasOwnProperty.call(body, 'external_messaging')) {
            payload.external_messaging = Boolean(body.external_messaging);
        }
        if (Object.prototype.hasOwnProperty.call(body, 'is_transfer_role')) {
            payload.is_transfer_role = Boolean(body.is_transfer_role);
        }
        if (Object.prototype.hasOwnProperty.call(body, 'enabled')) {
            payload.enabled = Boolean(body.enabled);
        }
        const url = `${API_BASE_URL}/api/v1/roles`;

        console.log('[createRole] Final payload:', JSON.stringify(payload));

        const res = await fetch(url, {
            method: 'POST',
            headers: getProxyHeaders(req),
            body: JSON.stringify(payload),
        });
        const text = await res.text();
        console.log('Backend response status:', res.status);
        if (!res.ok) {
            console.error('[createRole] Backend error body:', text.slice(0, 800));
        }

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
