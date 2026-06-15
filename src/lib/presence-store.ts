import { extractOnlineStaffIdSet, presenceListFromPayload } from '@/lib/presence-online';

const LAST_SEEN_FIELDS = [
    'last_seen',
    'last_seen_at',
    'last_activity_at',
    'last_active_at',
    'last_login_at',
    'last_login',
    'online_since',
    'signed_in_at',
    'updated_at',
] as const;

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

export function pickLastActivityFromRecord(r: Record<string, unknown>): string {
    const sources = [r];
    for (const nest of ['user', 'profile', 'staff', 'staff_member', 'account'] as const) {
        const n = r[nest];
        if (n && typeof n === 'object' && !Array.isArray(n)) sources.push(n as Record<string, unknown>);
    }
    for (const src of sources) {
        for (const field of LAST_SEEN_FIELDS) {
            const raw = String(src[field] ?? '').trim();
            if (raw) return raw;
        }
    }
    return '';
}

/** Format a last-seen timestamp for staff directory offline rows. */
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

export function lastSeenMsFromRecord(rec: Record<string, unknown>): number | undefined {
    for (const field of LAST_SEEN_FIELDS) {
        const raw = String(rec[field] ?? '').trim();
        if (!raw) continue;
        const ts = Date.parse(raw);
        if (Number.isFinite(ts)) return ts;
    }
    const onlineOn = rec.online_on;
    if (Array.isArray(onlineOn)) {
        let best: number | undefined;
        for (const entry of onlineOn) {
            const ts = Date.parse(String(entry ?? '').trim());
            if (Number.isFinite(ts) && (best === undefined || ts > best)) best = ts;
        }
        if (best !== undefined) return best;
    }
    if (rec.online === true || rec.is_online === true || rec.connected === true) {
        return Date.now();
    }
    const on = rec.online_on;
    if (Array.isArray(on) && on.length > 0) return Date.now();
    return undefined;
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

/** Build last-seen index (ms) keyed by user id / email / username. */
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

/** Merge a WS presence event into the last-seen index. */
export function applyPresenceUserToggleToLastSeen(
    prev: Map<string, number>,
    data: Record<string, unknown>,
): Map<string, number> {
    const keys = presenceKeysForUser(data);
    if (keys.length === 0) return prev;

    const ts = lastSeenMsFromRecord(data)
        ?? (data.online === false ? Date.now() : undefined);
    if (ts === undefined) return prev;

    const next = new Map(prev);
    for (const k of keys) {
        const existing = next.get(k);
        if (existing === undefined || ts > existing) next.set(k, ts);
    }
    return next;
}

/** Resolve the best last-seen timestamp for a staff directory row. */
export function staffLastSeenMs(
    staff: {
        id: string;
        user_id?: string;
        email?: string;
        employee_id?: string;
        username?: string;
        last_activity_at?: string;
    },
    lastSeenByKey: Map<string, number>,
): number | undefined {
    let best: number | undefined;
    if (staff.last_activity_at) {
        const local = Date.parse(staff.last_activity_at);
        if (Number.isFinite(local)) best = local;
    }
    for (const k of [staff.user_id, staff.id, staff.email, staff.employee_id, staff.username]) {
        if (!k) continue;
        const ts = lastSeenByKey.get(k.trim().toLowerCase());
        if (ts !== undefined && (best === undefined || ts > best)) best = ts;
    }
    return best;
}

/** Build last-seen index from parsed staff directory rows. */
export function lastSeenIndexFromStaffMembers(
    staff: Array<{
        id: string;
        user_id?: string;
        email?: string;
        employee_id?: string;
        username?: string;
        last_activity_at?: string;
    }>,
): Map<string, number> {
    const map = new Map<string, number>();
    for (const member of staff) {
        const raw = member.last_activity_at?.trim();
        if (!raw) continue;
        const ts = Date.parse(raw);
        if (!Number.isFinite(ts)) continue;
        for (const k of [member.user_id, member.id, member.email, member.employee_id, member.username]) {
            if (!k) continue;
            const key = k.trim().toLowerCase();
            const prev = map.get(key);
            if (prev === undefined || ts > prev) map.set(key, ts);
        }
    }
    return map;
}
