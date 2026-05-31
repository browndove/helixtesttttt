import { isClientInternalSupportMode, resolveClientFacilityId } from '@/lib/facility-client';

/** Page size for each GET /staff request while loading the full directory. */
export const STAFF_LIST_PAGE_SIZE = 100;

/** Cache key for the merged full staff list (not a real URL query). */
export const STAFF_CACHE_LIST_KEY = '/api/proxy/staff?all';

function staffListPageUrl(pageId: number, pageSize = STAFF_LIST_PAGE_SIZE, facilityId?: string): string {
    const params = new URLSearchParams({
        page_size: String(pageSize),
        page_id: String(pageId),
    });
    if (facilityId) params.set('facility_id', facilityId);
    return `/api/proxy/staff?${params.toString()}`;
}

function looksLikeStaffRecord(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const rec = value as Record<string, unknown>;
    const keys = ['id', 'staff_id', 'first_name', 'last_name', 'name', 'email', 'job_title', 'role', 'department', 'department_name', 'departments'];
    return keys.some(k => rec[k] !== undefined && rec[k] !== null && String(rec[k]).trim() !== '');
}

function extractStaffArrayFromPayload(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== 'object') return [];

    const obj = raw as Record<string, unknown>;
    const preferredKeys = ['items', 'data', 'staff', 'results', 'rows', 'records', 'users', 'members'];
    for (const key of preferredKeys) {
        const value = obj[key];
        if (Array.isArray(value)) return value;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const nested = value as Record<string, unknown>;
            for (const nestedKey of preferredKeys) {
                const nestedValue = nested[nestedKey];
                if (Array.isArray(nestedValue)) return nestedValue;
            }
        }
    }

    for (const value of Object.values(obj)) {
        if (!Array.isArray(value) || value.length === 0) continue;
        if (value.some(looksLikeStaffRecord)) return value;
    }

    if (looksLikeStaffRecord(obj)) return [obj];

    return [];
}

function readStaffListTotal(raw: unknown): number | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const o = raw as Record<string, unknown>;
    const candidates = [o.total, o.total_count, o.totalCount, o.count];
    for (const c of candidates) {
        const n = Number(c);
        if (Number.isFinite(n) && n >= 0) return n;
    }
    for (const nestKey of ['pagination', 'meta', 'page'] as const) {
        const nest = o[nestKey];
        if (!nest || typeof nest !== 'object') continue;
        const p = nest as Record<string, unknown>;
        for (const k of ['total', 'total_count', 'totalCount'] as const) {
            const n = Number(p[k]);
            if (Number.isFinite(n) && n >= 0) return n;
        }
    }
    return undefined;
}

const MAX_STAFF_PAGES = 500;

/**
 * Fetches every staff page until the API reports no more rows.
 * Returns a normalized `{ items: [...] }` payload for parseStaffList-style consumers.
 */
export async function fetchAllStaffPayload(
    init?: RequestInit,
): Promise<{ ok: boolean; data: unknown }> {
    const allRows: unknown[] = [];
    let pageId = 1;
    let reportedTotal: number | undefined;
    const facilityId = (await isClientInternalSupportMode())
        ? await resolveClientFacilityId()
        : undefined;

    while (pageId <= MAX_STAFF_PAGES) {
        const pageUrl = staffListPageUrl(pageId, STAFF_LIST_PAGE_SIZE, facilityId);
        const res = await fetch(pageUrl, init);
        if (!res.ok) {
            if (pageId === 1) return { ok: false, data: null };
            break;
        }

        let pageJson: unknown;
        try {
            pageJson = await res.json();
        } catch {
            if (pageId === 1) return { ok: false, data: null };
            break;
        }

        const pageRows = extractStaffArrayFromPayload(pageJson);
        if (reportedTotal === undefined) {
            reportedTotal = readStaffListTotal(pageJson);
        }

        allRows.push(...pageRows);

        if (pageRows.length === 0) break;
        if (pageRows.length < STAFF_LIST_PAGE_SIZE) break;
        if (reportedTotal !== undefined && allRows.length >= reportedTotal) break;

        pageId += 1;
    }

    return {
        ok: true,
        data: {
            items: allRows,
            total: reportedTotal ?? allRows.length,
        },
    };
}
