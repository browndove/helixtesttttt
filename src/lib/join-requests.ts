/**
 * Facility join code + join request parsing.
 * The API documents these responses only as free-form objects, so readers accept the common key spellings.
 */

export type JoinCodeInfo = {
    code: string;
    usesEmployeeIds: boolean;
    expiresAt?: string;
};

export type JoinRequest = {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email?: string;
    phone?: string;
    employeeId?: string;
    /** True/false when the API says whether the employee ID matched the directory; undefined when unknown. */
    employeeMatched?: boolean;
    role?: string;
    department?: string;
    submittedAt?: string;
    status?: string;
};

type Rec = Record<string, unknown>;

function asRec(value: unknown): Rec | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : null;
}

function str(rec: Rec | null, ...keys: string[]): string {
    if (!rec) return '';
    for (const key of keys) {
        const value = rec[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
        if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return '';
}

function bool(rec: Rec | null, ...keys: string[]): boolean | undefined {
    if (!rec) return undefined;
    for (const key of keys) {
        const value = rec[key];
        if (typeof value === 'boolean') return value;
        if (value === 'true' || value === 1) return true;
        if (value === 'false' || value === 0) return false;
    }
    return undefined;
}

/** Unwraps `{ data: … }` / `{ join_code: … }` envelopes. */
function unwrap(raw: unknown, ...keys: string[]): Rec | null {
    let rec = asRec(raw);
    for (let depth = 0; rec && depth < 3; depth += 1) {
        const nested = keys.map(key => asRec(rec?.[key])).find(Boolean);
        if (!nested) break;
        rec = nested;
    }
    return rec;
}

export function parseJoinCode(raw: unknown): JoinCodeInfo | null {
    const outer = asRec(raw);
    const rec = unwrap(raw, 'data', 'join_code', 'joinCode', 'result');
    const code = str(rec, 'code', 'join_code', 'joinCode', 'access_code', 'accessCode', 'facility_code')
        || str(outer, 'join_code', 'code', 'access_code', 'facility_code');
    if (!code) return null;
    return {
        code,
        usesEmployeeIds: bool(rec, 'uses_employee_ids', 'usesEmployeeIds', 'requires_employee_id', 'require_employee_id')
            ?? bool(outer, 'uses_employee_ids', 'usesEmployeeIds')
            ?? false,
        expiresAt: str(rec, 'expires_at', 'expiresAt') || undefined,
    };
}

function parseOne(raw: unknown): JoinRequest | null {
    const rec = asRec(raw);
    if (!rec) return null;
    const profile = asRec(rec.profile) || asRec(rec.user) || asRec(rec.applicant);
    const pick = (...keys: string[]) => str(rec, ...keys) || str(profile, ...keys);
    const id = str(rec, 'id', 'request_id', 'requestId', 'join_request_id');
    if (!id) return null;
    const firstName = pick('first_name', 'firstName', 'given_name');
    const lastName = pick('last_name', 'lastName', 'family_name', 'surname');
    const fullName = pick('full_name', 'fullName', 'name', 'display_name')
        || [firstName, lastName].filter(Boolean).join(' ')
        || pick('email')
        || 'Unnamed applicant';
    return {
        id,
        firstName,
        lastName,
        fullName,
        email: pick('email', 'email_address') || undefined,
        phone: pick('phone', 'phone_number', 'phoneNumber', 'mobile') || undefined,
        employeeId: pick('employee_id', 'employeeId', 'staff_id', 'staff_number') || undefined,
        employeeMatched: bool(rec, 'employee_matched', 'employee_id_matched', 'matched', 'directory_match')
            ?? (rec.matched_staff_id || rec.staff_id ? true : undefined),
        role: pick('role', 'role_name', 'requested_role', 'job_title', 'title', 'cadre') || undefined,
        department: pick('department', 'department_name', 'unit', 'ward') || undefined,
        submittedAt: str(rec, 'created_at', 'submitted_at', 'requested_at', 'createdAt') || undefined,
        status: str(rec, 'status', 'state') || undefined,
    };
}

export function parseJoinRequests(raw: unknown): JoinRequest[] {
    const rec = asRec(raw);
    const candidates: unknown[] = [
        raw,
        rec?.data,
        rec?.items,
        rec?.requests,
        rec?.join_requests,
        rec?.joinRequests,
        rec?.results,
        asRec(rec?.data)?.items,
        asRec(rec?.data)?.requests,
        asRec(rec?.data)?.join_requests,
    ];
    const list = candidates.find(Array.isArray) as unknown[] | undefined;
    if (!list) return [];
    return list
        .map(parseOne)
        .filter((item): item is JoinRequest => !!item)
        .filter(item => !item.status || /pending|waiting|submitted|awaiting|new/i.test(item.status));
}

export function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function timeAgo(iso?: string): string {
    if (!iso) return '';
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return '';
    const diff = Math.max(0, Date.now() - ms);
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function apiErrorMessage(data: unknown, fallback: string): string {
    const rec = asRec(data);
    return str(rec, 'message', 'detail', 'error', 'reason') || fallback;
}
