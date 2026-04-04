import type { NextRequest } from 'next/server';
import { getProxyHeaders } from '@/lib/proxy-auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export async function resolveDepartmentIdByName(
    req: NextRequest,
    facilityId: string,
    departmentName?: string
): Promise<string | undefined> {
    if (!departmentName?.trim()) {
        // #region agent log
        void fetch('http://127.0.0.1:7426/ingest/00cfa10c-d013-4384-9106-545095334c7e', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f12e6f' },
            body: JSON.stringify({
                sessionId: 'f12e6f',
                runId: 'staff-dept-update',
                hypothesisId: 'H-B',
                location: 'proxy-resolve-department.ts:resolveDepartmentIdByName',
                message: 'dept-name-empty-skip',
                data: { skipped: true },
                timestamp: Date.now(),
            }),
        }).catch(() => {});
        // #endregion
        return undefined;
    }

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

        const resolvedId = matched?.id || matched?.department_id;
        // #region agent log
        void fetch('http://127.0.0.1:7426/ingest/00cfa10c-d013-4384-9106-545095334c7e', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f12e6f' },
            body: JSON.stringify({
                sessionId: 'f12e6f',
                runId: 'staff-dept-update',
                hypothesisId: 'H-B',
                location: 'proxy-resolve-department.ts:resolveDepartmentIdByName',
                message: 'dept-name-resolve',
                data: {
                    facilityIdLen: facilityId?.length ?? 0,
                    normalizedNameLen: normalizedName.length,
                    departmentsFetchOk: res.ok,
                    listLen: list.length,
                    matched: Boolean(matched),
                    resolvedIdLen: resolvedId?.length ?? 0,
                },
                timestamp: Date.now(),
            }),
        }).catch(() => {});
        // #endregion

        return resolvedId;
    } catch {
        // #region agent log
        void fetch('http://127.0.0.1:7426/ingest/00cfa10c-d013-4384-9106-545095334c7e', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f12e6f' },
            body: JSON.stringify({
                sessionId: 'f12e6f',
                runId: 'staff-dept-update',
                hypothesisId: 'H-B',
                location: 'proxy-resolve-department.ts:resolveDepartmentIdByName',
                message: 'dept-name-resolve-catch',
                data: { error: true },
                timestamp: Date.now(),
            }),
        }).catch(() => {});
        // #endregion
        return undefined;
    }
}
