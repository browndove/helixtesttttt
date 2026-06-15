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

/** Parse presence `last_seen` only. */
export function lastSeenMsFromRecord(rec: Record<string, unknown>): number | undefined {
    const raw = String(rec.last_seen ?? '').trim();
    if (!raw) return undefined;
    const ts = Date.parse(raw);
    return Number.isFinite(ts) ? ts : undefined;
}

/** Format presence `last_seen` for staff directory rows. */
export function formatLastSeenAgo(tsMs?: number): string {
    if (tsMs === undefined || !Number.isFinite(tsMs) || tsMs <= 0) return 'Never';
    const diffMs = Date.now() - tsMs;
    if (diffMs < 0) return 'Just now';
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 8) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
    const years = Math.floor(days / 365);
    return `${years} year${years === 1 ? '' : 's'} ago`;
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

/** Build last-seen index (ms) from presence `last_seen` keyed by user id / email / username. */
export function lastSeenIndexFromPresencePayload(payload: unknown): Map<string, number> {
    const map = new Map<string, number>();
    for (const item of presenceListFromPayload(payload)) {
        if (!item || typeof item !== 'object') continue;
        const rec = item as Record<string, unknown>;
        const ts = lastSeenMsFromRecord(rec);
        if (ts === undefined) continue;
        for (const k of presenceKeysForUser(rec)) {
            const prev = map.get(k);
            if (prev === undefined || ts > prev) map.set(k, ts);
        }
    }
    return map;
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

/** Merge presence `last_seen` from a WS event into the last-seen index. */
export function applyPresenceUserToggleToLastSeen(
    prev: Map<string, number>,
    data: Record<string, unknown>,
): Map<string, number> {
    const ts = lastSeenMsFromRecord(data);
    if (ts === undefined) return prev;

    const keys = presenceKeysForUser(data);
    if (keys.length === 0) return prev;

    const next = new Map(prev);
    for (const k of keys) {
        const existing = next.get(k);
        if (existing === undefined || ts > existing) next.set(k, ts);
    }
    return next;
}

/** Resolve `last_seen` for a staff directory row (staff list + presence updates). */
export function staffLastSeenMs(
    staff: {
        id: string;
        user_id?: string;
        email?: string;
        employee_id?: string;
        username?: string;
        last_seen?: string;
    },
    lastSeenByKey: Map<string, number>,
): number | undefined {
    let best: number | undefined;
    if (staff.last_seen) {
        const fromStaff = Date.parse(staff.last_seen);
        if (Number.isFinite(fromStaff)) best = fromStaff;
    }
    for (const k of [staff.user_id, staff.id, staff.email, staff.employee_id, staff.username]) {
        if (!k) continue;
        const ts = lastSeenByKey.get(k.trim().toLowerCase());
        if (ts !== undefined && (best === undefined || ts > best)) best = ts;
    }
    return best;
}
