/**
 * Facility directory mismatch reports from the mobile app.
 * Someone matched the wrong directory person and asked an admin to fix it.
 */

export type DirectoryReportShown = {
    directoryUserId: string;
    name: string;
    employeeId: string;
    dob: string;
};

export type DirectoryReport = {
    id: string;
    /** Lookup fields the person entered. Empty string means unused. */
    employeeId: string;
    firstName: string;
    lastName: string;
    dob: string;
    note: string;
    createdAt: string;
    shown: DirectoryReportShown;
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

function unwrapList(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    const rec = asRec(raw);
    if (!rec) return [];
    for (const key of ['items', 'reports', 'data', 'results', 'directory_reports']) {
        const v = rec[key];
        if (Array.isArray(v)) return v;
        const nested = asRec(v);
        if (nested) {
            for (const inner of ['items', 'reports', 'data', 'results']) {
                if (Array.isArray(nested[inner])) return nested[inner] as unknown[];
            }
        }
    }
    return [];
}

function personName(rec: Rec | null): string {
    if (!rec) return '';
    const full = str(rec, 'name', 'full_name', 'display_name');
    if (full) return full;
    const first = str(rec, 'first_name', 'firstName');
    const last = str(rec, 'last_name', 'lastName');
    return [first, last].filter(Boolean).join(' ').trim();
}

function parseShown(raw: unknown): DirectoryReportShown {
    const rec = asRec(raw);
    return {
        directoryUserId: str(rec, 'directory_user_id', 'directoryUserId', 'user_id', 'staff_id', 'id'),
        name: personName(rec) || 'Unknown person',
        employeeId: str(rec, 'employee_id', 'employeeId'),
        dob: str(rec, 'dob', 'date_of_birth', 'dateOfBirth'),
    };
}

function parseLookupFields(rec: Rec): {
    employeeId: string;
    firstName: string;
    lastName: string;
    dob: string;
} {
    // Prefer an explicit nested lookup / entered / query object when present.
    const nameObj = asRec(rec.name);
    const nestedCandidates = [
        asRec(rec.lookup),
        asRec(rec.entered),
        asRec(rec.query),
        asRec(rec.search),
        asRec(rec.criteria),
        asRec(rec.reported),
        asRec(rec.input),
        asRec(rec.fields),
        nameObj && (nameObj.first || nameObj.first_name || nameObj.last || nameObj.last_name)
            ? nameObj
            : null,
    ].filter(Boolean) as Rec[];

    const sources = [...nestedCandidates, rec];
    let employeeId = '';
    let firstName = '';
    let lastName = '';
    let dob = '';

    for (const src of sources) {
        if (!employeeId) {
            employeeId = str(
                src,
                'employee_id',
                'employeeId',
                'lookup_employee_id',
                'entered_employee_id',
            );
        }
        if (!firstName) {
            firstName = str(
                src,
                'first_name',
                'firstName',
                'given_name',
                'lookup_first_name',
                'entered_first_name',
                'first',
            );
        }
        if (!lastName) {
            lastName = str(
                src,
                'last_name',
                'lastName',
                'family_name',
                'lookup_last_name',
                'entered_last_name',
                'last',
            );
        }
        if (!dob) {
            dob = str(
                src,
                'dob',
                'date_of_birth',
                'dateOfBirth',
                'lookup_dob',
                'entered_dob',
                'birth_date',
                'birthdate',
            );
        }
    }

    // Some payloads send a single full name instead of first/last.
    if (!firstName && !lastName) {
        for (const src of sources) {
            const full = str(src, 'name', 'full_name', 'display_name', 'lookup_name', 'person_name');
            if (!full) continue;
            const parts = full.split(/\s+/).filter(Boolean);
            if (parts.length === 1) {
                firstName = parts[0];
            } else if (parts.length > 1) {
                firstName = parts[0];
                lastName = parts.slice(1).join(' ');
            }
            break;
        }
    }

    return { employeeId, firstName, lastName, dob };
}

function parseOne(raw: unknown, idx: number): DirectoryReport | null {
    const outer = asRec(raw);
    if (!outer) return null;
    // Some list rows wrap the report under `report` / `attributes`.
    const rec = asRec(outer.report) || asRec(outer.attributes) || outer;
    const shownRaw =
        rec.shown
        ?? rec.matched
        ?? rec.directory_person
        ?? rec.directory_user
        ?? outer.shown
        ?? outer.matched;
    const shown = parseShown(shownRaw);
    const id = str(rec, 'id', 'report_id', 'uuid') || str(outer, 'id', 'report_id', 'uuid') || `report-${idx}`;
    const lookup = parseLookupFields(rec);
    // If the inner object had no lookup fields, try the outer wrapper too.
    const fallback = (!lookup.employeeId && !lookup.firstName && !lookup.lastName && !lookup.dob)
        ? parseLookupFields(outer)
        : lookup;
    return {
        id,
        employeeId: fallback.employeeId,
        firstName: fallback.firstName,
        lastName: fallback.lastName,
        dob: fallback.dob,
        note: str(rec, 'note', 'message', 'comment', 'reason') || str(outer, 'note', 'message', 'comment', 'reason'),
        createdAt:
            str(rec, 'created_at', 'createdAt', 'reported_at', 'timestamp')
            || str(outer, 'created_at', 'createdAt', 'reported_at', 'timestamp'),
        shown,
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

/** Lookup label used when the person searched: employee ID, or name (+ DOB in the meta line). */
export function reportLookupLabel(report: DirectoryReport): string {
    if (report.employeeId) return report.employeeId;
    const name = [report.firstName, report.lastName].filter(Boolean).join(' ').trim();
    if (name) return name;
    if (report.dob) return report.dob;
    return '—';
}

export function reportLookupMeta(report: DirectoryReport): string {
    if (report.employeeId) return 'Employee ID';
    const name = [report.firstName, report.lastName].filter(Boolean).join(' ').trim();
    if (name && report.dob) return `DOB ${report.dob}`;
    if (name) return 'Name';
    if (report.dob) return 'Date of birth';
    return 'Name / date of birth';
}

export function reportSummaryLine(report: DirectoryReport): string {
    const lookup = reportLookupLabel(report);
    const shown = report.shown.name || 'a directory person';
    return `${lookup} matched ${shown}`;
}

export function reportNoteLabel(report: DirectoryReport): string {
    const note = report.note.replace(/\s+/g, ' ').trim();
    if (note) return note;
    return 'This is not their name';
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
    }
    return fallback;
}
