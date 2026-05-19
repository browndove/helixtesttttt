import { API_ENDPOINTS } from '@/lib/config';
import { appendFacilityIdToProxyUrl, resolveClientFacilityId } from '@/lib/facility-client';

/**
 * GET /api/v1/presence/online is scoped by WebSocket `client` (defaults to app).
 * Admin UI users connect as client=admin; mobile/app users as client=app.
 * We merge both so directory and home show everyone currently online in the facility.
 */

const PRESENCE_CLIENTS = ['admin', 'app'] as const;

function presenceListFromPayload(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== 'object') return [];
    const rec = raw as Record<string, unknown>;

    for (const k of ['data', 'items', 'online', 'staff', 'users', 'results', 'presence', 'records', 'online_users', 'rows']) {
        const v = rec[k];
        if (Array.isArray(v)) return v;
    }

    const mergedTop: unknown[] = [];
    const ou = rec.online_users;
    if (ou && typeof ou === 'object' && !Array.isArray(ou)) {
        for (const v of Object.values(ou)) {
            if (Array.isArray(v)) mergedTop.push(...v);
        }
    }
    for (const k of ['admin', 'app']) {
        const v = rec[k];
        if (Array.isArray(v)) mergedTop.push(...v);
    }
    if (mergedTop.length) return mergedTop;

    const data = rec.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        const d = data as Record<string, unknown>;
        for (const k of ['users', 'online', 'staff', 'items', 'online_users', 'records']) {
            const v = d[k];
            if (Array.isArray(v)) return v;
        }
        const nestedOu = d.online_users;
        if (nestedOu && typeof nestedOu === 'object' && !Array.isArray(nestedOu)) {
            const nestedMerged: unknown[] = [];
            for (const v of Object.values(nestedOu)) {
                if (Array.isArray(v)) nestedMerged.push(...v);
            }
            if (nestedMerged.length) return nestedMerged;
        }
    }

    return [];
}

const PRESENCE_ID_FIELDS = [
    'id',
    'staff_id',
    'user_id',
    'auth_user_id',
    'account_id',
    'employee_id',
    'username',
    'personnel_id',
    'personnel_number',
    'staff_number',
] as const;

function addPresenceKeysFromRecord(rec: Record<string, unknown>, set: Set<string>): void {
    if (rec.online === false || rec.is_online === false || rec.connected === false) return;

    for (const k of PRESENCE_ID_FIELDS) {
        const v = String(rec[k] ?? '').trim();
        if (v) set.add(v.toLowerCase());
    }
    const em = String(rec.email ?? rec.work_email ?? '').trim().toLowerCase();
    if (em) set.add(em);

    for (const nest of ['staff', 'user', 'profile', 'staff_member', 'person', 'account'] as const) {
        const n = rec[nest];
        if (n && typeof n === 'object' && !Array.isArray(n)) {
            addPresenceKeysFromRecord(n as Record<string, unknown>, set);
        }
    }
}

/** Lowercase ids and emails for matching directory rows to presence payloads. */
export function extractOnlineStaffIdSet(raw: unknown): Set<string> {
    const list = presenceListFromPayload(raw);
    const set = new Set<string>();
    for (const item of list) {
        if (typeof item === 'string' || typeof item === 'number') {
            const t = String(item).trim().toLowerCase();
            if (t) set.add(t);
            continue;
        }
        if (!item || typeof item !== 'object') continue;
        addPresenceKeysFromRecord(item as Record<string, unknown>, set);
    }
    return set;
}

function presenceDedupeKey(item: unknown): string {
    if (typeof item === 'string' || typeof item === 'number') {
        return String(item).trim().toLowerCase();
    }
    if (!item || typeof item !== 'object') return '';
    const rec = item as Record<string, unknown>;
    return String(rec.id || rec.staff_id || rec.user_id || rec.email || '').trim().toLowerCase();
}

export async function fetchMergedFacilityPresenceOnline(): Promise<{ ok: boolean; items: unknown[] }> {
    const merged: unknown[] = [];
    const seen = new Set<string>();
    let ok = false;
    const base = API_ENDPOINTS.PRESENCE_ONLINE.split('?')[0];
    const facilityId = await resolveClientFacilityId();

    for (const client of PRESENCE_CLIENTS) {
        try {
            const params = new URLSearchParams({ client });
            if (facilityId) params.set('facility_id', facilityId);
            const url = appendFacilityIdToProxyUrl(`${base}?${params.toString()}`, facilityId);
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) continue;
            ok = true;
            const json: unknown = await res.json();
            for (const item of presenceListFromPayload(json)) {
                const dk = presenceDedupeKey(item);
                if (dk) {
                    if (seen.has(dk)) continue;
                    seen.add(dk);
                } else if (item && typeof item === 'object') {
                    const sig = JSON.stringify(item).slice(0, 160);
                    if (seen.has(sig)) continue;
                    seen.add(sig);
                }
                merged.push(item);
            }
        } catch {
            /* ignore */
        }
    }

    return { ok, items: merged };
}
