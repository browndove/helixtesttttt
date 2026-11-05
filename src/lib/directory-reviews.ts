/**
 * Facility directory reviews — bulk-upload rows that need an admin decision.
 * Same employee ID / same name+DOB / incomplete file row.
 */

export type DirectoryPersonSnapshot = {
    directoryUserId: string;
    firstName: string;
    middleName: string;
    lastName: string;
    employeeId: string;
    dob: string;
    canManageSchedule: boolean | null;
    /** True when the stored person has already joined / registered. */
    hasJoined: boolean;
};

export type DirectoryFileSnapshot = {
    firstName: string;
    middleName: string;
    lastName: string;
    employeeId: string;
    dob: string;
    canManageSchedule: boolean | null;
};

export type DirectoryReviewKind = 'same_employee_id' | 'same_name_dob' | 'incomplete' | 'other';

export type DirectoryReview = {
    id: string;
    kind: DirectoryReviewKind;
    reason: string;
    createdAt: string;
    directory: DirectoryPersonSnapshot | null;
    file: DirectoryFileSnapshot;
};

export type DirectoryResolveAction = 'dismiss' | 'replace' | 'add';

export type DirectoryResolvePayload = {
    action: DirectoryResolveAction;
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    employee_id?: string;
    dob?: string;
    can_manage_schedule?: boolean;
};

type Rec = Record<string, unknown>;

function asRec(value: unknown): Rec | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : null;
}

function str(rec: Rec | null, ...keys: string[]): string {
    if (!rec) return '';
    for (const key of keys) {
        const value = rec[key];
        if (typeof value === 'string') return value.trim();
        if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return '';
}

function bool(rec: Rec | null, ...keys: string[]): boolean | null {
    if (!rec) return null;
    for (const key of keys) {
        const value = rec[key];
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            const t = value.trim().toLowerCase();
            if (['true', 'yes', '1', 'y'].includes(t)) return true;
            if (['false', 'no', '0', 'n'].includes(t)) return false;
        }
        if (value === 1) return true;
        if (value === 0) return false;
    }
    return null;
}

function unwrapList(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    const rec = asRec(raw);
    if (!rec) return [];
    for (const key of ['items', 'reviews', 'data', 'results', 'directory_reviews', 'pending']) {
        const v = rec[key];
        if (Array.isArray(v)) return v;
        const nested = asRec(v);
        if (nested) {
            for (const inner of ['items', 'reviews', 'data', 'results']) {
                if (Array.isArray(nested[inner])) return nested[inner] as unknown[];
            }
        }
    }
    return [];
}

function parseKind(raw: string): DirectoryReviewKind {
    const t = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (
        t.includes('employee_id')
        || t.includes('same_employee')
        || t === 'employee_id_conflict'
        || t === 'duplicate_employee_id'
    ) {
        return 'same_employee_id';
    }
    if (
        t.includes('name_dob')
        || t.includes('same_name')
        || t.includes('name_and_dob')
        || t === 'duplicate_person'
    ) {
        return 'same_name_dob';
    }
    if (t.includes('incomplete') || t.includes('missing')) return 'incomplete';
    return 'other';
}

function parsePerson(raw: unknown): DirectoryPersonSnapshot | null {
    const rec = asRec(raw);
    if (!rec) return null;
    const firstName = str(rec, 'first_name', 'firstName');
    const lastName = str(rec, 'last_name', 'lastName');
    const directoryUserId = str(
        rec,
        'directory_user_id',
        'directoryUserId',
        'user_id',
        'staff_id',
        'id',
    );
    if (!directoryUserId && !firstName && !lastName && !str(rec, 'employee_id', 'employeeId')) {
        return null;
    }
    const joined = bool(
        rec,
        'has_joined',
        'hasJoined',
        'joined',
        'is_joined',
        'registered',
        'already_joined',
    );
    const status = str(rec, 'status', 'lifecycle_status').toLowerCase();
    const hasJoined =
        joined === true
        || ['registered', 'active', 'joined'].includes(status);

    return {
        directoryUserId,
        firstName,
        middleName: str(rec, 'middle_name', 'middleName'),
        lastName,
        employeeId: str(rec, 'employee_id', 'employeeId'),
        dob: str(rec, 'dob', 'date_of_birth', 'dateOfBirth'),
        canManageSchedule: bool(rec, 'can_manage_schedule', 'canManageSchedule', 'is_scheduler'),
        hasJoined,
    };
}

function parseFile(raw: unknown): DirectoryFileSnapshot {
    const rec = asRec(raw);
    return {
        firstName: str(rec, 'first_name', 'firstName'),
        middleName: str(rec, 'middle_name', 'middleName'),
        lastName: str(rec, 'last_name', 'lastName'),
        employeeId: str(rec, 'employee_id', 'employeeId'),
        dob: str(rec, 'dob', 'date_of_birth', 'dateOfBirth'),
        canManageSchedule: bool(rec, 'can_manage_schedule', 'canManageSchedule', 'is_scheduler'),
    };
}

function parseOne(raw: unknown, idx: number): DirectoryReview | null {
    const rec = asRec(raw);
    if (!rec) return null;
    const id = str(rec, 'id', 'review_id', 'uuid') || `review-${idx}`;
    const kind = parseKind(str(rec, 'kind', 'type', 'reason_code', 'conflict_type', 'category'));
    const directory =
        parsePerson(rec.directory ?? rec.stored ?? rec.existing ?? rec.current ?? rec.matched)
        ?? parsePerson(rec.directory_person)
        ?? null;
    const fileRaw = rec.file ?? rec.incoming ?? rec.upload ?? rec.row ?? rec.proposed ?? rec;
    const file = parseFile(fileRaw);
    // If top-level had no nested file object, avoid treating directory fields as file when directory exists
    const fileFromNested = asRec(rec.file ?? rec.incoming ?? rec.upload ?? rec.row ?? rec.proposed);
    const resolvedFile = fileFromNested ? file : (directory ? {
        firstName: str(rec, 'file_first_name', 'incoming_first_name') || file.firstName,
        middleName: str(rec, 'file_middle_name', 'incoming_middle_name') || file.middleName,
        lastName: str(rec, 'file_last_name', 'incoming_last_name') || file.lastName,
        employeeId: str(rec, 'file_employee_id', 'incoming_employee_id') || file.employeeId,
        dob: str(rec, 'file_dob', 'incoming_dob') || file.dob,
        canManageSchedule: file.canManageSchedule,
    } : file);

    return {
        id,
        kind: directory ? kind : (kind === 'other' ? 'incomplete' : kind),
        reason: str(rec, 'reason', 'message', 'detail', 'description'),
        createdAt: str(rec, 'created_at', 'createdAt', 'updated_at'),
        directory,
        file: resolvedFile,
    };
}

export function parseDirectoryReviewsResponse(raw: unknown): {
    reviews: DirectoryReview[];
    openCount: number;
} {
    const reviews = unwrapList(raw)
        .map((row, idx) => parseOne(row, idx))
        .filter((row): row is DirectoryReview => Boolean(row));

    const rec = asRec(raw);
    const openFromApi = Number(
        rec?.open_count
        ?? rec?.openCount
        ?? rec?.pending_count
        ?? rec?.needs_review
        ?? rec?.count,
    );
    const openCount = Number.isFinite(openFromApi) && openFromApi >= 0 ? openFromApi : reviews.length;
    return { reviews, openCount };
}

/** Count of reviews needing a decision from a staff bulk-upload response. */
export function parseBulkNeedsReviewCount(raw: unknown): number {
    const rec = asRec(raw);
    if (!rec) return 0;
    for (const key of [
        'needs_review',
        'needs_review_count',
        'pending_reviews',
        'review_count',
        'directory_reviews_count',
        'open_reviews',
        'open_count',
    ]) {
        const n = Number(rec[key]);
        if (Number.isFinite(n) && n > 0) return Math.floor(n);
    }
    for (const key of ['directory_reviews', 'reviews', 'pending_directory_reviews']) {
        if (Array.isArray(rec[key])) return rec[key].length;
    }
    const nested = asRec(rec.meta) || asRec(rec.summary);
    if (nested) return parseBulkNeedsReviewCount(nested);
    return 0;
}

export function personDisplayName(p: { firstName: string; middleName?: string; lastName: string }): string {
    return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ').trim() || '—';
}

export function kindLabel(kind: DirectoryReviewKind): string {
    if (kind === 'same_employee_id') return 'Same employee ID';
    if (kind === 'same_name_dob') return 'Same name & date of birth';
    if (kind === 'incomplete') return 'Incomplete row';
    return 'Needs review';
}

export function kindHint(review: DirectoryReview): string {
    if (review.reason) return review.reason;
    if (review.kind === 'same_employee_id') {
        return 'This employee ID is already in the directory. Keep the stored person, or use the file when they have not joined.';
    }
    if (review.kind === 'same_name_dob') {
        return 'Same name and date of birth. Keep the directory, use the file, or add as a new person if the employee IDs differ.';
    }
    if (review.kind === 'incomplete') {
        return 'Fill first name, last name, date of birth, and schedule access to add — or discard the row.';
    }
    return 'Choose how to resolve this row.';
}

export function canAddAsNew(review: DirectoryReview): boolean {
    if (review.kind === 'incomplete') return true;
    if (review.kind !== 'same_name_dob') return false;
    const stored = review.directory?.employeeId || '';
    const incoming = review.file.employeeId || '';
    return Boolean(incoming) && stored !== incoming;
}

export function canReplace(review: DirectoryReview): boolean {
    if (!review.directory) return false;
    if (review.directory.hasJoined) return false;
    return review.kind === 'same_employee_id' || review.kind === 'same_name_dob' || review.kind === 'other';
}

export function incompleteFormReady(form: {
    firstName: string;
    lastName: string;
    dob: string;
    canManageSchedule: boolean | null;
}): boolean {
    return Boolean(
        form.firstName.trim()
        && form.lastName.trim()
        && form.dob.trim()
        && form.canManageSchedule !== null,
    );
}

export function buildResolveBody(
    action: DirectoryResolveAction,
    form: {
        firstName: string;
        middleName: string;
        lastName: string;
        employeeId: string;
        dob: string;
        canManageSchedule: boolean | null;
    },
): DirectoryResolvePayload {
    if (action === 'dismiss') return { action: 'dismiss' };
    const body: DirectoryResolvePayload = {
        action,
        first_name: form.firstName.trim(),
        middle_name: form.middleName.trim(),
        last_name: form.lastName.trim(),
        dob: form.dob.trim(),
        can_manage_schedule: form.canManageSchedule === true,
    };
    // Blank employee_id must not erase an ID already stored — omit the field.
    const employeeId = form.employeeId.trim();
    if (employeeId) body.employee_id = employeeId;
    return body;
}

export function apiErrorMessage(data: unknown, fallback: string): string {
    const rec = asRec(data);
    if (!rec) return fallback;
    for (const key of ['error', 'message', 'detail', 'details']) {
        const v = rec[key];
        if (typeof v === 'string' && v.trim()) return v.trim();
        if (Array.isArray(v) && v.length) {
            const first = v[0];
            if (typeof first === 'string' && first.trim()) return first.trim();
            const nested = asRec(first);
            const msg = str(nested, 'message', 'detail', 'error');
            if (msg) return msg;
        }
    }
    return fallback;
}
