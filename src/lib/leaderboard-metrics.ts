export type LeaderboardEntry = {
    rank: number;
    user_id: string;
    name: string;
    job_title: string;
    profile_url: string;
    is_doctor: boolean;
    points: number;
    is_me: boolean;
};

export type LeaderboardFacility = {
    facility_id: string;
    facility_name: string;
    facility_points: number;
    ranked_users: number;
    top: LeaderboardEntry[];
};

export type LeaderboardMetrics = {
    enabled: boolean;
    month: string;
    from: string;
    to: string;
    limit: number;
    include_internal: boolean;
    total_facilities: number;
    facilities: LeaderboardFacility[];
};

export type PointBreakdownRow = {
    key: string;
    label: string;
    points: number;
    count: number | null;
};

export type LedgerEvent = {
    id: string;
    label: string;
    points: number;
    at: string;
};

export type LeaderboardUserDetail = {
    name: string;
    job_title: string;
    profile_url: string;
    rank: number | null;
    points: number | null;
    month: string;
    breakdown: PointBreakdownRow[];
    events: LedgerEvent[];
    eventsTotal: number | null;
};

function asRecord(raw: unknown): Record<string, unknown> | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    return raw as Record<string, unknown>;
}

function num(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
    return null;
}

function str(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function bool(value: unknown): boolean {
    return value === true || value === 'true' || value === 1;
}

export function readApiError(raw: unknown, fallback: string): string {
    const rec = asRecord(raw);
    if (!rec) return fallback;
    const message = str(rec.message) || str(rec.error);
    const detail = str(rec.detail) || str(rec.details);
    if (message && detail && detail !== message) return `${message}: ${detail}`;
    return message || detail || fallback;
}

function unwrapPayload(raw: unknown): Record<string, unknown> | null {
    const rec = asRecord(raw);
    if (!rec) return null;
    const nested = asRecord(rec.data) || asRecord(rec.result);
    if (nested && (Array.isArray(nested.facilities) || nested.user_id || nested.breakdown || nested.events || nested.ledger)) {
        return nested;
    }
    return rec;
}

export function parseLeaderboardMetrics(raw: unknown): LeaderboardMetrics | null {
    const rec = unwrapPayload(raw);
    if (!rec) return null;

    const facilities = Array.isArray(rec.facilities)
        ? rec.facilities
            .map((row) => parseFacility(row))
            .filter((row): row is LeaderboardFacility => Boolean(row))
            .sort((a, b) => b.facility_points - a.facility_points || a.facility_name.localeCompare(b.facility_name))
        : [];

    return {
        enabled: rec.enabled !== false,
        month: str(rec.month),
        from: str(rec.from),
        to: str(rec.to),
        limit: num(rec.limit) ?? facilities[0]?.top.length ?? 0,
        include_internal: bool(rec.include_internal),
        total_facilities: num(rec.total_facilities) ?? facilities.length,
        facilities,
    };
}

function parseFacility(raw: unknown): LeaderboardFacility | null {
    const rec = asRecord(raw);
    if (!rec) return null;
    const facilityId = str(rec.facility_id || rec.id);
    const facilityName = str(rec.facility_name || rec.name);
    if (!facilityId || !facilityName) return null;

    const top = Array.isArray(rec.top)
        ? rec.top
            .map((row, index) => parseEntry(row, index))
            .filter((row): row is LeaderboardEntry => Boolean(row))
            .sort((a, b) => a.rank - b.rank || b.points - a.points || a.name.localeCompare(b.name))
        : [];

    return {
        facility_id: facilityId,
        facility_name: facilityName,
        facility_points: num(rec.facility_points) ?? 0,
        ranked_users: num(rec.ranked_users) ?? top.length,
        top,
    };
}

function parseEntry(raw: unknown, index: number): LeaderboardEntry | null {
    const rec = asRecord(raw);
    if (!rec) return null;
    const userId = str(rec.user_id || rec.id);
    if (!userId) return null;
    const name = str(rec.name || rec.full_name) || 'Unnamed staff';
    return {
        rank: num(rec.rank) ?? index + 1,
        user_id: userId,
        name,
        job_title: str(rec.job_title || rec.title || rec.role),
        profile_url: str(rec.profile_url || rec.avatar_url || rec.photo_url),
        is_doctor: bool(rec.is_doctor),
        points: num(rec.points) ?? 0,
        is_me: bool(rec.is_me),
    };
}

const BREAKDOWN_KEYS = ['breakdown', 'by_event_type', 'event_types', 'points_by_type', 'categories'];
const LEDGER_KEYS = ['events', 'point_events', 'ledger', 'history'];

export function parseLeaderboardUser(raw: unknown): LeaderboardUserDetail | null {
    const rec = unwrapPayload(raw);
    if (!rec) return null;

    const user = asRecord(rec.user) || asRecord(rec.profile) || {};
    const monthly = asRecord(rec.monthly) || asRecord(rec.summary) || {};
    const ledger = parseLedger(rec);

    return {
        name: str(rec.name || user.name || user.full_name) || 'Unnamed staff',
        job_title: str(rec.job_title || rec.title || user.job_title || user.title),
        profile_url: str(rec.profile_url || rec.avatar_url || user.profile_url || user.avatar_url),
        rank: num(rec.rank ?? monthly.rank ?? user.rank),
        points: num(rec.points ?? rec.monthly_points ?? rec.total_points ?? monthly.points ?? monthly.total),
        month: str(rec.month || monthly.month),
        breakdown: parseBreakdown(rec),
        events: ledger.events,
        eventsTotal: ledger.total,
    };
}

function parseBreakdown(rec: Record<string, unknown>): PointBreakdownRow[] {
    const list = firstArray(rec, BREAKDOWN_KEYS);
    return list
        .map((row, index) => {
            const item = asRecord(row);
            if (!item) return null;
            const key = str(item.event_type || item.type || item.key || item.id) || `row-${index}`;
            const label = displayLabel(str(item.label || item.name || item.title || item.event_type || item.type || key));
            const points = num(item.points ?? item.total ?? item.score ?? item.value);
            if (points == null && !label) return null;
            return {
                key,
                label,
                points: points ?? 0,
                count: num(item.count ?? item.events ?? item.event_count),
            };
        })
        .filter((row): row is PointBreakdownRow => Boolean(row))
        .sort((a, b) => b.points - a.points || a.label.localeCompare(b.label));
}

function parseLedger(rec: Record<string, unknown>): { events: LedgerEvent[]; total: number | null } {
    let total = num(rec.events_total ?? rec.total_events ?? rec.total);
    let list = firstArray(rec, LEDGER_KEYS);

    if (list.length === 0) {
        for (const key of LEDGER_KEYS) {
            const nested = asRecord(rec[key]);
            if (!nested) continue;
            total = total ?? num(nested.total ?? nested.count);
            const nestedList = Array.isArray(nested.items)
                ? nested.items
                : Array.isArray(nested.events)
                    ? nested.events
                    : Array.isArray(nested.rows)
                        ? nested.rows
                        : Array.isArray(nested.data)
                            ? nested.data
                            : [];
            if (nestedList.length > 0) {
                list = nestedList;
                break;
            }
        }
    }

    const events = list
        .map((row, index) => {
            const item = asRecord(row);
            if (!item) return null;
            const label = displayLabel(str(
                item.label || item.name || item.event_type || item.type || item.description || item.reason,
            ));
            const points = num(item.points ?? item.delta ?? item.amount ?? item.value);
            if (!label && points == null) return null;
            const at = str(item.created_at || item.occurred_at || item.at || item.timestamp || item.time);
            const id = str(item.id || item.event_id) || `${label}-${at}-${index}`;
            return { id, label: label || 'Point event', points: points ?? 0, at };
        })
        .filter((row): row is LedgerEvent => Boolean(row));

    return { events, total };
}

function firstArray(rec: Record<string, unknown>, keys: string[]): unknown[] {
    for (const key of keys) {
        if (Array.isArray(rec[key])) return rec[key] as unknown[];
    }
    return [];
}

function displayLabel(raw: string): string {
    const text = raw.trim();
    if (!text) return '';
    if (/\s/.test(text)) return text;
    const spaced = text
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .trim()
        .toLowerCase();
    if (!spaced) return '';
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function formatPoints(value: number): string {
    if (!Number.isFinite(value)) return '0.000';
    return value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export function currentUtcMonth(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function shiftUtcMonth(month: string, delta: number): string {
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (!match) return currentUtcMonth();
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + delta, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(month: string): string {
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (!match) return month;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function formatWindow(from: string, to: string): string {
    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
    end.setUTCDate(end.getUTCDate() - 1);
    const day = (date: Date) => date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    });
    return `${day(start)} – ${day(end)}, ${end.getUTCFullYear()} UTC`;
}

export function formatWhen(iso: string): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return `${date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
    })} UTC`;
}

export function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
