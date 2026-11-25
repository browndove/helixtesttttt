/**
 * Client for the scheduling API (/api/v1/scheduling/*) through the /api/proxy/scheduling pass-through.
 * Shapes follow the staging Swagger. facility_id is added by the proxy.
 */

export class SchedulingApiError extends Error {
    constructor(message: string, public status: number) {
        super(message);
    }
}

type Query = Record<string, string | number | null | undefined>;

export async function schedFetch<T>(
    path: string,
    { method = 'GET', query, body }: { method?: string; query?: Query; body?: unknown } = {},
): Promise<T> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query || {})) {
        if (v != null && v !== '') qs.set(k, String(v));
    }
    const res = await fetch(`/api/proxy/scheduling/${path}${qs.size ? `?${qs}` : ''}`, {
        method,
        credentials: 'include',
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data: unknown = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = null;
    }
    if (!res.ok) {
        const rec = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
        const msg = [rec.message, rec.detail, rec.error].find(v => typeof v === 'string' && v.trim()) as string | undefined;
        throw new SchedulingApiError(
            res.status === 403 ? 'You need schedule access to change this.' : msg || `Request failed (${res.status})`,
            res.status,
        );
    }
    return data as T;
}

export const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong');

/* ── Department settings ─────────────────────────────────────── */
export type WorkAreaKind = 'none' | 'zones' | 'wards' | 'places';

export type ScheduleSettings = {
    department_id: string;
    hours_per_week: number;
    max_shifts_per_week: number;
    monthly_hours_cap: number;
    target_headcount: number;
    overtime_enabled: boolean;
    overtime_after_hours_week: number;
    weekend_premium_enabled: boolean;
    weekend_premium_percent: number;
    allow_self_swap: boolean;
    enable_team_pairing: boolean;
    enforce_caps_hard: boolean;
    enforce_publish_lead_hard: boolean;
    publish_lead_days: number;
    notify_on_open_shift: boolean;
    notify_on_publish: boolean;
    require_section_on_publish: boolean;
    require_unit_on_assign: boolean;
    slot_pick_mode: string;
    default_section: string;
    work_area_kind: WorkAreaKind | string;
    work_areas: string[];
    updated_at?: string;
};

/* ── Roster settings (ten sections) ──────────────────────────── */
export type Seniority = 'senior' | 'mid' | 'junior';
export type RosterRank = { id: string; name: string; seniority: Seniority };
export type RosterApproval = { type: 'leave' | 'swap' | 'roster'; mode: 'any' | 'all'; approvers: string[] };
export type DaysOffRule = { consecutive_shifts: number; rest_days_after: number; shift_codes: string[] };
export type PairingValue = 'required' | 'allowed' | 'not_allowed';

export type RosterSettings = {
    department_id?: string;
    preparation_period: 'monthly' | 'weekly' | 'daily';
    workstation: { building: string; ward_unit: string };
    ranks: RosterRank[];
    require_senior_rank_id: string | null;
    pairing: Record<string, PairingValue>;
    max_hours_per_shift: number;
    excess_hours: { enabled: boolean; method: 'carry_forward' | 'spread' };
    rest: {
        min_rest_hours: number;
        max_consecutive_days: number;
        min_days_off: number;
        max_days_off: number;
        weekend_day_off: boolean;
        days_off_rules: DaysOffRule[];
    };
    approvals: RosterApproval[];
    staff_review: { enabled: boolean; opens_days_before: number; deadline_days_before: number };
    submission: {
        availability_opens_days_before: number;
        availability_deadline_days_before: number;
        annual_leave_opens_days_before_year_end: number;
        annual_leave_deadline_days_before_year_end: number;
    };
};

/* ── Shift codes and targets ─────────────────────────────────── */
export type ShiftType = {
    code: string;
    label: string;
    start_time: string;
    end_time: string;
    hours: number;
    is_working: boolean;
    sort_order: number;
    /** Built-in codes come back without a facility_id. */
    facility_id?: string | null;
};

/** The list endpoint returns loose objects; hours may be a number, a string or a pg numeric. */
export function normalizeShiftType(raw: Record<string, unknown>): ShiftType {
    const h = raw.hours;
    let hours = 0;
    if (typeof h === 'number') hours = h;
    else if (typeof h === 'string') hours = Number(h) || 0;
    else if (h && typeof h === 'object') {
        const n = h as { int?: unknown; exp?: unknown };
        if (typeof n.int === 'number' && typeof n.exp === 'number') hours = n.int * 10 ** n.exp;
    }
    const str = (v: unknown) => (typeof v === 'string' ? v : '');
    return {
        code: str(raw.code),
        label: str(raw.label),
        start_time: str(raw.start_time).slice(0, 5),
        end_time: str(raw.end_time).slice(0, 5),
        hours,
        is_working: raw.is_working !== false,
        sort_order: typeof raw.sort_order === 'number' ? raw.sort_order : 0,
        facility_id: typeof raw.facility_id === 'string' && raw.facility_id ? raw.facility_id : null,
    };
}

export type ShiftTarget = { code: string; role_id?: string; weekday?: number; target: number };

/* ── Roster (department staff) ───────────────────────────────── */
export type RosterMember = {
    user_id: string;
    display_name: string;
    first_name: string;
    last_name: string;
    job_title: string;
    position_title: string;
    phone: string;
    primary_section: string;
    rank_id: string;
    rank_name: string;
    seniority: string;
    pair_user_id: string;
    can_manage_schedule: boolean;
    joined_at: string;
    roles: { id: string; name: string }[];
};

export type PoolMember = {
    user_id: string;
    display_name: string;
    first_name: string;
    last_name: string;
    job_title: string;
    position_title: string;
    departments: string[];
};

/* ── Clock-in ────────────────────────────────────────────────── */
export type ClockSettings = {
    mode: string;
    time_zone: string;
    early_arrival_minutes: number;
    short_tolerance_minutes: number;
    auto_close_minutes: number;
    clock_out_reminder_minutes: number;
    boundary_enabled: boolean;
    boundary: { center_lat: number; center_lng: number; radius_m: number } | null;
    updated_at?: string;
    updated_by?: string;
};

/* ── Attendance ──────────────────────────────────────────────── */
export type AttendanceRecord = {
    id: string;
    assignment_id: string;
    staff_id: string;
    staff_name: string;
    code: string;
    label: string;
    section: string;
    work_date: string;
    starts_at: string;
    ends_at: string;
    in_at: string;
    out_at: string;
    in_method: string;
    out_method: string;
    in_location?: { lat: number; lng: number; accuracy_m: number } | null;
    out_location?: { lat: number; lng: number; accuracy_m: number } | null;
    mark: string;
    needs_review: boolean;
    scheduled_minutes: number;
    worked_minutes: number;
    correction_reason: string;
    counted_from: string;
};

export type AttendanceCell = { assignment_id: string; record_id: string; code: string; mark: string; work_date: string };

export type AttendanceWeek = {
    week_start: string;
    days: string[];
    rows: { staff_id: string; display_name: string; cells: AttendanceCell[] }[];
    exceptions: AttendanceRecord[];
    summary: { shifts: number; missed: number; short: number; needs_review: number };
};

/* ── Audit and overview ──────────────────────────────────────── */
export type AuditEntry = {
    id: string;
    action: string;
    actor_id: string;
    entity_type: string;
    entity_id: string;
    created_at: string;
    reason: string;
    old_value: unknown;
    new_value: unknown;
};

export type RosterOverview = {
    department_id: string;
    month: string;
    status: 'not_started' | 'draft' | 'published' | string;
    period_id: string;
    published_at: string;
    last_edited_at: string;
    has_unpublished_changes: boolean;
    days_until_start: number;
    on_leave: number;
    availability: { asked: boolean; replied: number; total: number; closes_at: string } | null;
};

/* ── Small helpers ───────────────────────────────────────────── */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function personName(m: { display_name?: string; first_name?: string; last_name?: string }): string {
    return m.display_name?.trim() || [m.first_name, m.last_name].filter(Boolean).join(' ') || 'Unnamed';
}

export function initialsOf(name: string): string {
    return name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

/** Local YYYY-MM-DD (not UTC, so late-evening dates don't roll over). */
export function isoDate(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function mondayOf(d: Date): Date {
    const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
    return out;
}

export function formatDateTime(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function formatMinutes(min: number): string {
    if (!min) return '0h';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
}
