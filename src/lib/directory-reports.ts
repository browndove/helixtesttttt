/**
 * Facility directory mismatch reports from the mobile app ("Not me").
 * Admin compares entered vs directory, then merge / correct / dismiss.
 */

export type DirectoryReportPerson = {
    directoryUserId: string;
    firstName: string;
    middleName: string;
    lastName: string;
    employeeId: string;
    dob: string;
    hasAccount: boolean;
};

export type DirectoryReportEntered = {
    firstName: string;
    middleName: string;
    lastName: string;
    employeeId: string;
    dob: string;
};

export type DirectoryReportDifference = {
    field: string;
    entered: string;
    directory: string;
    differs: boolean;
};

export type DirectoryRelatedRequest = {
    requestId: string;
    firstName: string;
    middleName: string;
    lastName: string;
    dob: string;
    employeeId: string;
    email: string;
    phone: string;
    jobTitle: string;
    department: string;
};

export type DirectoryReportAction = 'dismiss' | 'correct_directory' | 'merge';

export type DirectoryReport = {
    id: string;
    note: string;
    createdAt: string;
    entered: DirectoryReportEntered;
    directory: DirectoryReportPerson;
    differences: DirectoryReportDifference[];
    relatedRequests: DirectoryRelatedRequest[];
    actions: DirectoryReportAction[];
};

export type DirectoryReportResolveAction = DirectoryReportAction;

export type DirectoryReportResolvePayload = {
    action: DirectoryReportResolveAction;
    request_id?: string;
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    dob?: string;
    employee_id?: string;
};

export type DirectoryReportForm = {
    firstName: string;
    middleName: string;
    lastName: string;
    employeeId: string;
    dob: string;
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

function bool(rec: Rec | null, ...keys: string[]): boolean {
    if (!rec) return false;
    for (const key of keys) {
        const value = rec[key];
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            const t = value.trim().toLowerCase();
            if (['true', 'yes', '1'].includes(t)) return true;
            if (['false', 'no', '0'].includes(t)) return false;
        }
        if (value === 1) return true;
        if (value === 0) return false;
    }
    return false;
}

function unwrapList(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    const rec = asRec(raw);
    if (!rec) return [];
    for (const key of ['reports', 'items', 'data', 'results', 'directory_reports']) {
        const v = rec[key];
        if (Array.isArray(v)) return v;
        const nested = asRec(v);
        if (nested) {
            for (const inner of ['reports', 'items', 'data', 'results']) {
                if (Array.isArray(nested[inner])) return nested[inner] as unknown[];
            }
        }
    }
    return [];
}

function parseEntered(raw: unknown): DirectoryReportEntered {
    const rec = asRec(raw);
    return {
        firstName: str(rec, 'first_name', 'firstName'),
        middleName: str(rec, 'middle_name', 'middleName'),
        lastName: str(rec, 'last_name', 'lastName'),
        employeeId: str(rec, 'employee_id', 'employeeId'),
        dob: str(rec, 'dob', 'date_of_birth', 'dateOfBirth'),
    };
}

function parseDirectory(raw: unknown): DirectoryReportPerson {
    const rec = asRec(raw);
    return {
        directoryUserId: str(rec, 'directory_user_id', 'directoryUserId', 'user_id', 'staff_id', 'id'),
        firstName: str(rec, 'first_name', 'firstName'),
        middleName: str(rec, 'middle_name', 'middleName'),
        lastName: str(rec, 'last_name', 'lastName'),
        employeeId: str(rec, 'employee_id', 'employeeId'),
        dob: str(rec, 'dob', 'date_of_birth', 'dateOfBirth'),
        hasAccount: bool(rec, 'has_account', 'hasAccount', 'has_joined', 'hasJoined'),
    };
}

function parseDifferences(raw: unknown, entered: DirectoryReportEntered, directory: DirectoryReportPerson): DirectoryReportDifference[] {
    if (Array.isArray(raw) && raw.length) {
        return raw.map(row => {
            const rec = asRec(row);
            const field = str(rec, 'field', 'name', 'key') || 'field';
            return {
                field,
                entered: str(rec, 'entered', 'incoming', 'left', 'value'),
                directory: str(rec, 'directory', 'stored', 'right', 'current'),
                differs: bool(rec, 'differs', 'different', 'changed') || (
                    str(rec, 'entered', 'incoming', 'left', 'value') !== str(rec, 'directory', 'stored', 'right', 'current')
                ),
            };
        });
    }
    // Synthesize when API omits differences.
    const fields: Array<{ field: string; entered: string; directory: string }> = [
        { field: 'first_name', entered: entered.firstName, directory: directory.firstName },
        { field: 'middle_name', entered: entered.middleName, directory: directory.middleName },
        { field: 'last_name', entered: entered.lastName, directory: directory.lastName },
        { field: 'employee_id', entered: entered.employeeId, directory: directory.employeeId },
        { field: 'dob', entered: entered.dob, directory: directory.dob },
    ];
    return fields.map(f => ({ ...f, differs: f.entered !== f.directory }));
}

function parseRelated(raw: unknown): DirectoryRelatedRequest[] {
    if (!Array.isArray(raw)) return [];
    return raw.map(row => {
        const rec = asRec(row);
        return {
            requestId: str(rec, 'request_id', 'requestId', 'id'),
            firstName: str(rec, 'first_name', 'firstName'),
            middleName: str(rec, 'middle_name', 'middleName'),
            lastName: str(rec, 'last_name', 'lastName'),
            dob: str(rec, 'dob', 'date_of_birth', 'dateOfBirth'),
            employeeId: str(rec, 'employee_id', 'employeeId'),
            email: str(rec, 'email'),
            phone: str(rec, 'phone'),
            jobTitle: str(rec, 'job_title', 'jobTitle', 'title'),
            department: str(rec, 'department', 'department_name'),
        };
    }).filter(r => r.requestId);
}

function parseActions(raw: unknown): DirectoryReportAction[] {
    const allowed = new Set<DirectoryReportAction>(['dismiss', 'correct_directory', 'merge']);
    if (!Array.isArray(raw)) return ['dismiss', 'correct_directory', 'merge'];
    const out: DirectoryReportAction[] = [];
    for (const item of raw) {
        const v = String(item || '').trim().toLowerCase() as DirectoryReportAction;
        if (allowed.has(v) && !out.includes(v)) out.push(v);
    }
    return out.length ? out : ['dismiss'];
}

function parseOne(raw: unknown, idx: number): DirectoryReport | null {
    const rec = asRec(raw);
    if (!rec) return null;

    const entered = parseEntered(
        rec.entered ?? rec.lookup ?? rec.query ?? rec.shown_entered ?? {
            first_name: rec.first_name,
            last_name: rec.last_name,
            employee_id: rec.employee_id,
            dob: rec.dob,
            middle_name: rec.middle_name,
        },
    );
    const directory = parseDirectory(
        rec.directory ?? rec.shown ?? rec.matched ?? rec.directory_person ?? rec.directory_user,
    );
    const id = str(rec, 'id', 'report_id', 'uuid') || `report-${idx}`;

    return {
        id,
        note: str(rec, 'note', 'message', 'comment', 'reason'),
        createdAt: str(rec, 'created_at', 'createdAt', 'reported_at', 'timestamp'),
        entered,
        directory,
        differences: parseDifferences(rec.differences, entered, directory),
        relatedRequests: parseRelated(rec.related_requests ?? rec.relatedRequests ?? rec.join_requests),
        actions: parseActions(rec.actions),
    };
}

export function parseDirectoryReportsResponse(raw: unknown): {
    reports: DirectoryReport[];
    openCount: number;
} {
    const reports = unwrapList(raw)
        .map((row, idx) => parseOne(row, idx))
        .filter((row): row is DirectoryReport => Boolean(row));

    const rec = asRec(raw);
    const openFromApi = Number(rec?.open_count ?? rec?.openCount ?? rec?.count);
    const openCount = Number.isFinite(openFromApi) && openFromApi >= 0 ? openFromApi : reports.length;

    return { reports, openCount };
}

export function personDisplayName(p: { firstName: string; middleName?: string; lastName: string }): string {
    return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ').trim() || '—';
}

export function fieldLabel(field: string): string {
    const t = field.trim().toLowerCase();
    if (t === 'first_name' || t === 'firstname') return 'First name';
    if (t === 'middle_name' || t === 'middlename') return 'Middle name';
    if (t === 'last_name' || t === 'lastname') return 'Last name';
    if (t === 'employee_id' || t === 'employeeid') return 'Employee ID';
    if (t === 'dob' || t === 'date_of_birth') return 'Date of birth';
    return field.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
}

export function formFromEntered(entered: DirectoryReportEntered): DirectoryReportForm {
    return {
        firstName: entered.firstName,
        middleName: entered.middleName,
        lastName: entered.lastName,
        employeeId: entered.employeeId,
        dob: entered.dob,
    };
}

export function buildReportResolveBody(
    action: DirectoryReportResolveAction,
    form: DirectoryReportForm,
    requestId?: string,
): DirectoryReportResolvePayload {
    if (action === 'dismiss') return { action: 'dismiss' };
    const body: DirectoryReportResolvePayload = {
        action,
        first_name: form.firstName.trim(),
        middle_name: form.middleName.trim(),
        last_name: form.lastName.trim(),
        dob: form.dob.trim(),
    };
    const employeeId = form.employeeId.trim();
    if (employeeId) body.employee_id = employeeId;
    if (action === 'merge' && requestId) body.request_id = requestId;
    return body;
}

export function formatReportWhen(iso: string): string {
    if (!iso) return '';
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return iso;
    const d = new Date(t);
    const diffMs = Date.now() - t;
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
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

/** True when 409 means only dismiss remains viable (directory person already has an account). */
export function isAccountAlreadyExistsConflict(message: string): boolean {
    const t = message.toLowerCase();
    return t.includes('already has an account') || t.includes('already joined');
}
