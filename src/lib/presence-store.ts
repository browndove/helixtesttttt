import { extractOnlineStaffIdSet, presenceListFromPayload } from '@/lib/presence-online';

/** Employee IDs look like HH-0206 — not login usernames such as prince.nedjoh4. */
export function looksLikeEmployeeId(value: string): boolean {
    const v = value.trim();
    if (!v) return false;
    if (v.includes('@')) return false;
    if (isUuidLike(v)) return false;
    if (/^[A-Za-z]{2,}[-–]\d/.test(v)) return true;
    if (/^\d+$/.test(v)) return true;
    if (/^[A-Za-z0-9._-]+$/.test(v) && v.includes('.')) return false;
    return v.length >= 2;
}

function isUuidLike(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

export function pickEmployeeIdFromRecord(r: Record<string, unknown>): string {
    const sources = [r];
    for (const nest of ['user', 'profile', 'staff', 'staff_member', 'account'] as const) {
        const n = r[nest];
        if (n && typeof n === 'object' && !Array.isArray(n)) sources.push(n as Record<string, unknown>);
    }
    for (const src of sources) {
        for (const k of ['employee_id', 'personnel_number', 'staff_number', 'employee_number'] as const) {
            const v = String(src[k] ?? '').trim();
            if (v && looksLikeEmployeeId(v)) return v;
        }
    }
    return '';
}

/** Presence match keys for a single user row (lowercase). */
export function presenceKeysForUser(rec: Record<string, unknown>): string[] {
    const keys = new Set<string>();
    for (const k of ['user_id', 'id', 'staff_id', 'username', 'email', 'work_email', 'employee_id'] as const) {
        const v = String(rec[k] ?? '').trim().toLowerCase();
        if (v) keys.add(v);
    }
    return [...keys];
}

/** Build online id set from a REST or WS roster snapshot. */
export function onlineSetFromPresenceSnapshot(payload: unknown): Set<string> {
    return extractOnlineStaffIdSet({ users: presenceListFromPayload(payload) });
}

/** Apply single-user presence toggle from WS `presence` event. */
export function applyPresenceUserToggle(
    prev: Set<string>,
    data: Record<string, unknown>,
): Set<string> {
    const online = data.online === true;
    const keys = presenceKeysForUser(data);
    if (keys.length === 0) return prev;

    const next = new Set(prev);
    for (const k of keys) {
        if (online) next.add(k);
        else next.delete(k);
    }
    return next;
}
