import { getProxyHeaders } from '@/lib/proxy-auth';
import { resolveFacilityId } from '@/lib/proxy-facility';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

type IncomingTeamBody = {
    name?: string;
    description?: string;
    facility_id?: string;
    facilityId?: string;
    department_id?: string;
    departmentId?: string;
    department?: string;
    lead_id?: string;
    leadId?: string;
    is_resuscitation_team?: boolean;
    isResuscitationTeam?: boolean;
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

        const normalized = departmentName.trim().toLowerCase();
        const matched = list.find((item: unknown) => {
            if (!item || typeof item !== 'object') return false;
            const rec = item as { name?: string; department_name?: string };
            const name = (rec.name || rec.department_name || '').trim().toLowerCase();
            return name === normalized;
        }) as { id?: string; department_id?: string } | undefined;

        return matched?.id || matched?.department_id;
    } catch {
        return undefined;
    }
}

// GET /teams - List provider teams (query params: facility_id, department_id)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const url = new URL(`${API_BASE_URL}/api/v1/teams`);

        const facilityId = searchParams.get('facility_id') || await resolveFacilityId(req, API_BASE_URL);
        const departmentId = searchParams.get('department_id');

        if (facilityId) url.searchParams.set('facility_id', facilityId);
        if (departmentId) url.searchParams.set('department_id', departmentId);

        console.log('Proxy list teams request to:', url.toString());

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

// POST /teams - Create a provider team
export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as IncomingTeamBody;
        const facilityId = body.facility_id || body.facilityId || await resolveFacilityId(req, API_BASE_URL);
        const departmentIdFromBody = body.department_id || body.departmentId;
        const departmentId = facilityId
            ? (departmentIdFromBody || await resolveDepartmentIdByName(req, facilityId, body.department))
            : departmentIdFromBody;
        const isResuscitation =
            typeof body.is_resuscitation_team === 'boolean'
                ? body.is_resuscitation_team
                : typeof body.isResuscitationTeam === 'boolean'
                    ? body.isResuscitationTeam
                    : false;
        const payload = {
            name: body.name,
            description: body.description || '',
            facility_id: facilityId,
            department_id: departmentId,
            lead_id: body.lead_id || body.leadId,
            is_resuscitation_team: isResuscitation,
        };
        const url = `${API_BASE_URL}/api/v1/teams`;

        console.log('Proxy create team request to:', url);

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
