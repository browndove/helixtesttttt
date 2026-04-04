import { getProxyHeaders } from '@/lib/proxy-auth';
import { resolveDepartmentIdByName } from '@/lib/proxy-resolve-department';
import { resolveFacilityId } from '@/lib/proxy-facility';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// GET /staff/{id} - Get a staff member
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const url = `${API_BASE_URL}/api/v1/staff/${id}`;

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

        const forward: Record<string, unknown> = { ...body };
        if (resolvedDeptId) {
            forward.department_id = resolvedDeptId;
            forward.departmentId = resolvedDeptId;
            forward.departments = [{ id: resolvedDeptId }];
        }

        // #region agent log
        void fetch('http://127.0.0.1:7426/ingest/00cfa10c-d013-4384-9106-545095334c7e', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f12e6f' },
            body: JSON.stringify({
                sessionId: 'f12e6f',
                runId: 'staff-dept-update',
                hypothesisId: 'H-C',
                location: 'proxy/staff/[id]/route.ts:PUT',
                message: 'forward-after-dept-resolve',
                data: {
                    staffIdSuffix: String(id).slice(-10),
                    hasExplicitDeptId,
                    deptLabelLen: deptLabel.length,
                    hasSessionFacilityId: Boolean(sessionFacilityId),
                    resolvedDeptId: Boolean(resolvedDeptId),
                    forwardKeys: Object.keys(forward).slice(0, 24),
                },
                timestamp: Date.now(),
            }),
        }).catch(() => {});
        // #endregion

        const url = `${API_BASE_URL}/api/v1/staff/${id}`;

        console.log('Proxy update staff member request to:', url);

        const res = await fetch(url, {
            method: 'PUT',
            headers: getProxyHeaders(req),
            body: JSON.stringify(forward),
        });

        const text = await res.text();
        console.log('Backend response status:', res.status);

        // #region agent log
        void fetch('http://127.0.0.1:7426/ingest/00cfa10c-d013-4384-9106-545095334c7e', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f12e6f' },
            body: JSON.stringify({
                sessionId: 'f12e6f',
                runId: 'staff-dept-update',
                hypothesisId: 'H-E',
                location: 'proxy/staff/[id]/route.ts:PUT',
                message: 'upstream-put-response',
                data: {
                    staffIdSuffix: String(id).slice(-10),
                    status: res.status,
                    responseBodyLen: text.length,
                    ok: res.ok,
                },
                timestamp: Date.now(),
            }),
        }).catch(() => {});
        // #endregion

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
        const url = `${API_BASE_URL}/api/v1/staff/${id}`;

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
