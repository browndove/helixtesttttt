import { getProxyHeaders } from '@/lib/proxy-auth';
import { resolveFacilityId } from '@/lib/proxy-facility';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

type RoleUpdateBody = {
    priority?: string;
    mandatory?: boolean;
    department_id?: string;
    departmentId?: string;
    department?: string;
    sign_in_allowed_user_ids?: string[];
    [key: string]: unknown;
};

async function resolveDepartmentIdByName(
    req: NextRequest,
    facilityId: string,
    departmentName?: string
): Promise<string | undefined> {
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
        const name = departmentName.trim().toLowerCase();
        const match = list.find((item: unknown) => {
            if (!item || typeof item !== 'object') return false;
            const rec = item as { name?: string; department_name?: string };
            return String(rec.name || rec.department_name || '').trim().toLowerCase() === name;
        }) as { id?: string; department_id?: string } | undefined;
        return match?.id || match?.department_id;
    } catch {
        return undefined;
    }
}

function normalizePriority(priority?: string): 'critical' | 'standard' {
    return priority?.trim().toLowerCase() === 'critical' ? 'critical' : 'standard';
}

function resolvePriority(body: RoleUpdateBody): 'critical' | 'standard' {
    if (typeof body.mandatory === 'boolean') {
        return body.mandatory ? 'critical' : 'standard';
    }
    return normalizePriority(body.priority);
}

// GET /roles/{id} - Get a role
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const url = `${API_BASE_URL}/api/v1/roles/${id}`;

        console.log('Proxy get role request to:', url);

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

// PUT /roles/{id} - Update a role
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json() as RoleUpdateBody;
        // Forward supported editable fields for role updates.
        const payload: Record<string, unknown> = {};
        if (body.name !== undefined) payload.name = body.name;
        if (body.description !== undefined) payload.description = body.description;
        if (body.department !== undefined) payload.department = body.department;
        let resolvedDepartmentId = body.department_id || body.departmentId;
        if (!resolvedDepartmentId && body.department?.trim()) {
            try {
                const facilityId = await resolveFacilityId(req, API_BASE_URL);
                if (facilityId) {
                    resolvedDepartmentId = await resolveDepartmentIdByName(req, facilityId, body.department);
                }
            } catch {
                // best effort resolution
            }
        }
        if (resolvedDepartmentId !== undefined) payload.department_id = resolvedDepartmentId;
        if (Object.prototype.hasOwnProperty.call(body, 'sign_in_allowed_user_ids')) {
            payload.sign_in_allowed_user_ids = Array.isArray(body.sign_in_allowed_user_ids)
                ? body.sign_in_allowed_user_ids
                : [];
        }
        if (Object.prototype.hasOwnProperty.call(body, 'mandatory') || Object.prototype.hasOwnProperty.call(body, 'priority')) {
            payload.priority = resolvePriority(body);
        }
        const url = `${API_BASE_URL}/api/v1/roles/${id}`;

        console.log('Proxy update role request to:', url);

        const res = await fetch(url, {
            method: 'PUT',
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

// DELETE /roles/{id} - Delete a role
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const url = `${API_BASE_URL}/api/v1/roles/${id}`;

        console.log('Proxy delete role request to:', url);

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
