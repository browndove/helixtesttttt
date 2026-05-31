import { API_ENDPOINTS } from '@/lib/config';
import { isClientInternalSupportMode, resolveClientFacilityId } from '@/lib/facility-client';

/**
 * GET /api/v1/presence/online — app/admin online users for a facility.
 * Response: { facility_id, users: [{ user_id, first_name, last_name, username, job_title, online_on }] }
 */

export type PresenceOnlineUser = {
    user_id: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    job_title?: string;
    online_on?: string[];
    online?: boolean;
};

function isRecordOnline(rec: Record<string, unknown>): boolean {
    if (rec.online === false || rec.is_online === false || rec.connected === false) return false;
    const on = rec.online_on;
    if (Array.isArray(on) && on.length === 0) return false;
    return true;
}

/** Extract user rows from REST / WS presence payloads. */
export function presenceListFromPayload(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== 'object') return [];
    const rec = raw as Record<string, unknown>;

    const users = rec.users;
    if (Array.isArray(users)) return users;

    for (const k of ['data', 'items', 'online', 'staff', 'results', 'presence', 'records', 'online_users', 'rows']) {
        const v = rec[k];
        if (Array.isArray(v)) return v;
    }

    const data = rec.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        const d = data as Record<string, unknown>;
        if (Array.isArray(d.users)) return d.users;
        for (const k of ['users', 'online', 'staff', 'items', 'online_users', 'records']) {
            const v = d[k];
            if (Array.isArray(v)) return v;
        }
    }

    return [];
}

const PRESENCE_ID_FIELDS = [
    'user_id',
    'id',
    'staff_id',
    'auth_user_id',
    'account_id',
    'employee_id',
    'username',
    'personnel_id',
    'personnel_number',
    'staff_number',
] as const;

function addPresenceKeysFromRecord(rec: Record<string, unknown>, set: Set<string>): void {
    if (!isRecordOnline(rec)) return;

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

/** Lowercase ids, usernames, and emails for matching directory rows to presence payloads. */
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
    return String(rec.user_id || rec.id || rec.staff_id || rec.username || rec.email || '').trim().toLowerCase();
}

/**
 * Initial online roster for the admin portal (REST).
 * Tenant admins omit facility_id — the proxy resolves it from the session token.
 */
export async function fetchFacilityPresenceOnline(): Promise<{
    ok: boolean;
    items: PresenceOnlineUser[];
    facility_id?: string;
}> {
    const params = new URLSearchParams({ client: 'admin' });

    if (await isClientInternalSupportMode()) {
        const facilityId = await resolveClientFacilityId();
        if (facilityId) params.set('facility_id', facilityId);
    }

    const base = API_ENDPOINTS.PRESENCE_ONLINE.split('?')[0];
    const url = `${base}?${params.toString()}`;

    try {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) return { ok: false, items: [] };

        const json: unknown = await res.json();
        const facility_id =
            json && typeof json === 'object' && !Array.isArray(json)
                ? String((json as Record<string, unknown>).facility_id || '').trim() || undefined
                : undefined;

        const merged: PresenceOnlineUser[] = [];
        const seen = new Set<string>();

        for (const item of presenceListFromPayload(json)) {
            if (!item || typeof item !== 'object') continue;
            const rec = item as Record<string, unknown>;
            if (!isRecordOnline(rec)) continue;

            const dk = presenceDedupeKey(rec);
            if (dk) {
                if (seen.has(dk)) continue;
                seen.add(dk);
            }

            merged.push({
                user_id: String(rec.user_id || rec.id || rec.staff_id || dk || ''),
                first_name: String(rec.first_name || '').trim() || undefined,
                last_name: String(rec.last_name || '').trim() || undefined,
                username: String(rec.username || '').trim() || undefined,
                job_title: String(rec.job_title || '').trim() || undefined,
                online_on: Array.isArray(rec.online_on) ? rec.online_on.map(String) : undefined,
                online: true,
            });
        }

        return { ok: true, items: merged, facility_id };
    } catch {
        return { ok: false, items: [] };
    }
}

/** @deprecated Use fetchFacilityPresenceOnline — kept for existing imports. */
export async function fetchMergedFacilityPresenceOnline(): Promise<{ ok: boolean; items: unknown[] }> {
    const result = await fetchFacilityPresenceOnline();
    return { ok: result.ok, items: result.items };
}
