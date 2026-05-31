import { extractOnlineStaffIdSet, presenceListFromPayload } from '@/lib/presence-online';
import { presenceKeysForUser } from '@/lib/presence-store';

export type TeamPresenceMember = {
    id: string;
    name: string;
    initials: string;
    role: string;
    when: string;
    status: 'online' | 'recent' | 'away';
};

function formatWhenLabel(dateLike: string, online: boolean): string {
    if (online && !dateLike) return 'Active now';
    if (!dateLike) return 'No recent activity';
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return online ? 'Active now' : 'No recent activity';
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (online && mins < 15) return 'Active now';
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

function isPresenceRecordOnline(rec: Record<string, unknown>): boolean {
    if (rec.online === false || rec.is_online === false || rec.connected === false) return false;
    if (rec.online === true || rec.is_online === true || rec.connected === true) return true;
    const on = rec.online_on;
    return Array.isArray(on) && on.length > 0;
}

function activityTimestamp(rec: Record<string, unknown>, online: boolean): number {
    const whenRaw = String(
        rec.last_seen
        || rec.last_seen_at
        || rec.last_activity_at
        || rec.last_login_at
        || rec.last_login
        || rec.online_since
        || rec.signed_in_at
        || rec.updated_at
        || '',
    ).trim();
    const ts = whenRaw ? Date.parse(whenRaw) : NaN;
    if (online && Number.isNaN(ts)) return Date.now();
    return Number.isFinite(ts) ? ts : 0;
}

function presenceStatus(rec: Record<string, unknown>, online: boolean): TeamPresenceMember['status'] {
    if (online) return 'online';
    const whenRaw = String(rec.last_seen || rec.last_seen_at || rec.last_login_at || '').trim();
    const ts = whenRaw ? Date.parse(whenRaw) : NaN;
    if (!Number.isFinite(ts)) return 'away';
    const diffMin = (Date.now() - ts) / 60000;
    if (diffMin <= 120) return 'recent';
    return 'away';
}

function memberFromRecord(rec: Record<string, unknown>, onlineOverride?: boolean): TeamPresenceMember & { _ts: number } {
    const first = String(rec.first_name || '').trim();
    const last = String(rec.last_name || '').trim();
    const fullName = String(
        rec.name
        || rec.display_name
        || `${first} ${last}`.trim()
        || rec.email
        || 'Staff member',
    );
    const initials = (first && last
        ? `${first[0]}${last[0]}`
        : String(fullName).split(/\s+/).map((p) => p[0] || '').slice(0, 2).join('')
    ).toUpperCase() || 'S';
    const roleRaw = String(rec.job_title || rec.title || rec.system_role || rec.role || 'Staff').trim();
    const role = roleRaw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const online = onlineOverride ?? isPresenceRecordOnline(rec);
    const whenRaw = String(
        rec.last_seen
        || rec.last_seen_at
        || rec.last_activity_at
        || rec.last_login_at
        || rec.last_login
        || '',
    ).trim();
    const id = String(rec.user_id || rec.id || rec.staff_id || fullName);
    return {
        id,
        name: fullName,
        initials,
        role,
        when: formatWhenLabel(whenRaw, online),
        status: presenceStatus(rec, online),
        _ts: activityTimestamp(rec, online),
    };
}

/** Parse WS `presence_online_users` or similar — includes online and offline with last_seen. */
export function parsePresenceRosterToTeamPresence(raw: unknown, max: number): TeamPresenceMember[] {
    const list = presenceListFromPayload(raw);
    return list
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        .map((rec) => memberFromRecord(rec))
        .sort((a, b) => b._ts - a._ts)
        .slice(0, max)
        .map(({ _ts, ...rest }) => {
            void _ts;
            return rest;
        });
}

/** Merge staff directory + presence into the N most recently active members (online or offline). */
export function buildRecentTeamPresence(
    staffItems: unknown[],
    presenceItems: unknown[],
    max: number,
): TeamPresenceMember[] {
    const onlineKeys = extractOnlineStaffIdSet({ users: presenceItems });
    const presenceRows = presenceListFromPayload({ users: presenceItems });
    const presenceByKey = new Map<string, Record<string, unknown>>();
    for (const item of presenceRows) {
        if (!item || typeof item !== 'object') continue;
        const rec = item as Record<string, unknown>;
        for (const k of presenceKeysForUser(rec)) presenceByKey.set(k, rec);
    }

    const rows: (TeamPresenceMember & { _ts: number })[] = [];
    const seenIds = new Set<string>();

    const push = (row: TeamPresenceMember & { _ts: number }) => {
        if (seenIds.has(row.id)) return;
        seenIds.add(row.id);
        rows.push(row);
    };

    for (const s of staffItems) {
        if (!s || typeof s !== 'object') continue;
        const staffRec = s as Record<string, unknown>;
        const keys = presenceKeysForUser(staffRec);
        const matchedPresence = keys.map((k) => presenceByKey.get(k)).find(Boolean);
        const merged: Record<string, unknown> = matchedPresence
            ? { ...staffRec, ...matchedPresence }
            : { ...staffRec };
        const online = keys.some((k) => onlineKeys.has(k)) || isPresenceRecordOnline(merged);
        push(memberFromRecord(merged, online));
    }

    for (const item of presenceRows) {
        if (!item || typeof item !== 'object') continue;
        const rec = item as Record<string, unknown>;
        const row = memberFromRecord(rec);
        if (!seenIds.has(row.id)) push(row);
    }

    rows.sort((a, b) => b._ts - a._ts);

    if (rows.length < max) {
        for (const s of staffItems) {
            if (rows.length >= max) break;
            if (!s || typeof s !== 'object') continue;
            const staffRec = s as Record<string, unknown>;
            const id = String(staffRec.user_id || staffRec.id || staffRec.staff_id || '').trim();
            if (!id || seenIds.has(id)) continue;
            const row = memberFromRecord({ ...staffRec, online: false }, false);
            push({ ...row, _ts: 0, when: 'No recent activity', status: 'away' });
        }
    }

    return rows
        .slice(0, max)
        .map(({ _ts, ...rest }) => {
            void _ts;
            return rest;
        });
}

/** Update a roster record from a WS `presence` event and return the merged list. */
export function applyPresenceEventToRoster(
    roster: Record<string, unknown>[],
    data: Record<string, unknown>,
): Record<string, unknown>[] {
    const keys = new Set(presenceKeysForUser(data));
    const userId = String(data.user_id || data.id || '').trim().toLowerCase();
    let found = false;
    const next = roster.map((rec) => {
        const recKeys = presenceKeysForUser(rec);
        if (recKeys.some((k) => keys.has(k)) || recKeys.includes(userId)) {
            found = true;
            return { ...rec, ...data };
        }
        return rec;
    });
    if (!found) next.push(data);
    return next;
}
