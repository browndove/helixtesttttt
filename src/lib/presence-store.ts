import { extractOnlineStaffIdSet, presenceListFromPayload } from '@/lib/presence-online';

/** Presence match keys for a single user row (lowercase). */
export function presenceKeysForUser(rec: Record<string, unknown>): string[] {
    const keys = new Set<string>();
    for (const k of ['user_id', 'id', 'staff_id', 'username', 'email', 'work_email'] as const) {
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
