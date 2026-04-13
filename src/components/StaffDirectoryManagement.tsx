'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import TopBar from '@/components/TopBar';
import CustomSelect from '@/components/CustomSelect';
import DatePicker from '@/components/DatePicker';
import { formatGhanaPhoneInput, isValidGhanaPhone } from '@/lib/phone';
import { parseBulkUploadHistoryResponse, type BulkUploadHistoryEntry } from '@/lib/bulk-upload-history';
import { MacVibrancyToast, MacVibrancyToastPortal } from '@/components/MacVibrancyToast';
import { BulkImportErrorsSheet } from '@/components/BulkImportErrorsSheet';

type StaffMember = {
    id: string;
    first_name: string;
    middle_name?: string;
    last_name: string;
    email: string;
    job_title: string;
    dept: string;
    /** Present when API sends department as id only; used to resolve display name. */
    department_id?: string;
    status: string;
    access: string;
    employee_id: string;
    patient_access: boolean;
    role: 'staff' | 'admin';
    phone?: string;
    dob?: string;
    gender?: string;
    title?: string;
    highest_qualification?: string;
    is_doctor?: boolean;
};

type SortKey = 'first_name' | 'last_name' | 'employee_id' | 'dept' | 'job_title' | 'status';
type ImportStatus = 'success' | 'error';

type StaffToastVariant = 'success' | 'error' | 'info';
type StaffToastState = { message: string; variant: StaffToastVariant };

type BulkUploadSummary = {
    records: number;
    warnings: number;
    message: string;
};


function looksLikeStaffRecord(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const rec = value as Record<string, unknown>;
    const keys = ['id', 'staff_id', 'first_name', 'last_name', 'name', 'email', 'job_title', 'role', 'department', 'department_name', 'departments'];
    return keys.some(k => rec[k] !== undefined && rec[k] !== null && String(rec[k]).trim() !== '');
}

function asRecord(v: unknown): Record<string, unknown> | null {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    return v as Record<string, unknown>;
}

const STAFF_DEPT_NEST_KEYS = ['user', 'profile', 'staff', 'staff_member', 'account', 'person'] as const;

/** Match UUID-shaped strings some APIs put in `department` instead of a nested object. */
const DEPT_ID_STRING_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function gatherStaffDeptSources(r: Record<string, unknown>): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [r];
    for (const k of STAFF_DEPT_NEST_KEYS) {
        const n = asRecord(r[k]);
        if (n) out.push(n);
    }
    return out;
}

const DEPARTMENTS_ARRAY_KEYS = [
    'departments',
    'department_list',
    'departmentList',
    'assigned_departments',
    'assignedDepartments',
] as const;

/**
 * Staff API often returns `departments: [{ id, name }, ...]` instead of department_id / department_name.
 */
function pickFromDepartmentsArrays(n: Record<string, unknown>): { id?: string; name: string } | null {
    for (const key of DEPARTMENTS_ARRAY_KEYS) {
        const arr = n[key];
        if (!Array.isArray(arr) || arr.length === 0) continue;
        const names: string[] = [];
        let firstId: string | undefined;
        for (const item of arr) {
            const o = asRecord(item);
            if (!o) continue;
            const nm = String(o.name || o.department_name || o.departmentName || '').trim();
            if (nm) names.push(nm);
            const idi = String(o.id || o.department_id || o.departmentId || '').trim();
            if (idi && !firstId) firstId = idi;
        }
        if (names.length > 0) {
            return { id: firstId, name: names.join(', ') };
        }
        if (firstId) {
            return { id: firstId, name: 'Unassigned' };
        }
    }
    return null;
}

/** Resolve department id + display name from root and common nested payloads (user/profile/etc.). */
function findDepartmentIdAndName(sources: Record<string, unknown>[]): { id?: string; name: string } {
    for (const n of sources) {
        const fromList = pickFromDepartmentsArrays(n);
        if (fromList) return fromList;
    }

    let id: string | undefined;
    outerId: for (const n of sources) {
        const dObj = asRecord(n.department);
        const depStr = typeof n.department === 'string' ? n.department.trim() : '';
        const idCandidates = [
            n.department_id,
            n.departmentId,
            n.dept_id,
            n.deptId,
            n.primary_department_id,
            n.primaryDepartmentId,
            dObj?.id,
            dObj?.department_id,
            dObj?.departmentId,
            depStr && DEPT_ID_STRING_RE.test(depStr) ? depStr : '',
        ];
        for (const c of idCandidates) {
            const s = String(c ?? '').trim();
            if (s) {
                id = s;
                break outerId;
            }
        }
    }

    let name = '';
    for (const n of sources) {
        const topName = String(n.department_name || n.departmentName || '').trim();
        if (topName) {
            name = topName;
            break;
        }
        const dObj = asRecord(n.department);
        if (dObj) {
            const nn = String(dObj.name || dObj.department_name || dObj.departmentName || dObj.title || '').trim();
            if (nn) {
                name = nn;
                break;
            }
        }
        if (typeof n.department === 'string' && n.department.trim()) {
            const ds = n.department.trim();
            if (!DEPT_ID_STRING_RE.test(ds)) {
                name = ds;
                break;
            }
        }
        const dept = String(n.dept || '').trim();
        if (dept) {
            name = dept;
            break;
        }
    }

    return { id, name: name || 'Unassigned' };
}

function extractDepartmentArray(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== 'object') return [];
    const o = raw as Record<string, unknown>;
    for (const k of ['items', 'data', 'departments', 'results', 'rows', 'records']) {
        const v = o[k];
        if (Array.isArray(v)) return v;
    }
    return [];
}

function extractStaffArray(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== 'object') return [];

    const obj = raw as Record<string, unknown>;
    const preferredKeys = ['items', 'data', 'staff', 'results', 'rows', 'records', 'users', 'members'];
    for (const key of preferredKeys) {
        const value = obj[key];
        if (Array.isArray(value)) return value;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const nested = value as Record<string, unknown>;
            for (const nestedKey of preferredKeys) {
                const nestedValue = nested[nestedKey];
                if (Array.isArray(nestedValue)) return nestedValue;
            }
        }
    }

    // Final fallback: first array that looks like staff records.
    for (const value of Object.values(obj)) {
        if (!Array.isArray(value) || value.length === 0) continue;
        if (value.some(looksLikeStaffRecord)) return value;
    }

    // Single staff object (GET/PUT /staff/{id} response body).
    if (looksLikeStaffRecord(obj)) return [obj];

    return [];
}

function parseStaffList(raw: unknown): StaffMember[] {
    const list = extractStaffArray(raw);
    if (!Array.isArray(list)) return [];

    return list
        .map((row: unknown, idx): StaffMember | null => {
            if (!row || typeof row !== 'object') return null;
            const r = row as Record<string, unknown>;
            const first = String(r.first_name || '').trim();
            const last = String(r.last_name || '').trim();
            const full = String(r.name || '').trim();
            const [fullFirst = '', ...rest] = full.split(' ');
            const fullLast = rest.join(' ');
            const firstName = first || fullFirst || 'Unknown';
            const lastName = last || fullLast || 'Staff';
            const id = String(r.id || r.staff_id || `staff-${idx}`);
            const statusRaw = String(r.status || r.account_status || 'active').toLowerCase();
            const normalizedStatus = statusRaw.includes('disable') || statusRaw.includes('inactive') || statusRaw.includes('suspend')
                ? 'disabled'
                : 'active';
            const deptSources = gatherStaffDeptSources(r);
            const { id: department_id, name: deptFromApi } = findDepartmentIdAndName(deptSources);
            return {
                id,
                first_name: firstName,
                middle_name: String(r.middle_name || '').trim(),
                last_name: lastName,
                email: String(r.email || ''),
                job_title: String(r.job_title || r.role || 'Staff'),
                department_id,
                dept: deptFromApi,
                status: normalizedStatus,
                access: String(r.system_role || r.access || 'Staff'),
                employee_id: String(r.employee_id || r.username || id),
                patient_access: Boolean(r.patient_access ?? r.can_access_patients ?? false),
                role: String(r.system_role || r.role || 'staff').toLowerCase().includes('admin') ? 'admin' as const : 'staff' as const,
                phone: String(r.phone || '').trim(),
                dob: String(r.dob || '').trim(),
                gender: String(r.gender || '').trim().toLowerCase(),
                title: String(r.title || r.job_title || '').trim(),
                highest_qualification: String(r.highest_qualifications || r.highest_qualification || r.qualification || '').trim(),
                is_doctor: Boolean(r.is_doctor ?? String(r.title_prefix || '').toLowerCase() === 'dr'),
            };
        })
        .filter((s): s is StaffMember => Boolean(s));
}

const STAFF_TITLE_OPTIONS = [
    'House Officer',
    'Medical Officer',
    'Resident',
    'Specialist',
    'Consultant',
    'Chief of Surgery',
    'Nurse',
    'Pharmacist',
    'Physiotherapist',
    'Lab Scientist',
];

const QUALIFICATION_OPTIONS = ['MBBS', 'RN', 'MSc', 'PhD', 'MD', 'BPharm', 'BSc'];

const statusColors: Record<string, { color: string; bg: string; label: string }> = {
    active: { color: 'var(--success)', bg: 'var(--success-bg)', label: 'Active' },
    disabled: { color: 'var(--critical)', bg: 'var(--critical-bg)', label: 'Disabled' },
};


function readNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const n = Number(value);
        if (Number.isFinite(n)) return n;
    }
    return 0;
}

function parseBulkUploadSummary(raw: unknown): BulkUploadSummary {
    const rec = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const data = rec.data && typeof rec.data === 'object' && !Array.isArray(rec.data) ? (rec.data as Record<string, unknown>) : null;
    const nested = [rec, data].filter(Boolean) as Record<string, unknown>[];
    const firstNum = (keys: string[]) => {
        for (const obj of nested) {
            for (const k of keys) {
                const v = readNumber(obj[k]);
                if (v > 0) return v;
            }
        }
        return 0;
    };
    let records = firstNum([
        'records_processed',
        'processed',
        'created',
        'created_count',
        'success_count',
        'imported',
        'staff_created',
        'total_records',
        'total',
        'count',
    ]);
    for (const obj of nested) {
        if (Array.isArray(obj.created)) {
            records = Math.max(records, obj.created.length);
        }
    }
    let warnings = 0;
    for (const obj of nested) {
        if (Array.isArray(obj.warnings)) {
            warnings = obj.warnings.length;
            break;
        }
        if (Array.isArray(obj.errors)) {
            warnings = obj.errors.length;
            break;
        }
        const w = [obj.warnings_count, obj.warning_count, obj.failed_count, obj.error_count]
            .map(readNumber)
            .find(v => v > 0);
        if (w !== undefined && w > 0) {
            warnings = w;
            break;
        }
    }
    const message = String(rec.message || rec.detail || data?.message || rec.status || '').trim();
    return { records, warnings, message };
}

type StaffBulkImportRowError = { row: number; email: string; message: string };

function parseBulkErrorRows(raw: unknown): StaffBulkImportRowError[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((e, i) => {
        if (!e || typeof e !== 'object') {
            return { row: i + 2, email: '', message: String(e) };
        }
        const er = e as Record<string, unknown>;
        const rowRaw = er.row;
        const rowNum =
            typeof rowRaw === 'number' && Number.isFinite(rowRaw)
                ? rowRaw
                : typeof rowRaw === 'string' && rowRaw.trim() !== '' && Number.isFinite(Number(rowRaw))
                  ? Number(rowRaw)
                  : i + 2;
        return {
            row: rowNum,
            email: String(er.email || '').trim(),
            message: String(er.message || er.detail || er.error || '').trim() || 'Unknown error',
        };
    });
}

function summarizeBulkCreatedEntry(raw: unknown): { name: string; email: string; meta: string } {
    if (!raw || typeof raw !== 'object') {
        return { name: 'New staff', email: '', meta: '' };
    }
    const r = raw as Record<string, unknown>;
    const nest = (k: string): Record<string, unknown> | null => {
        const v = r[k];
        return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    };
    const staff = nest('staff') || nest('staff_member') || nest('user') || r;
    const first = String(staff.first_name || r.first_name || '').trim();
    const last = String(staff.last_name || r.last_name || '').trim();
    const name =
        [first, last].filter(Boolean).join(' ') ||
        String(staff.name || r.name || 'Staff member').trim();
    const email = String(staff.email || r.email || '').trim();
    const job = String(staff.job_title || r.job_title || staff.title || r.title || '').trim();
    const id = String(r.id || staff.id || r.staff_id || '').trim();
    const meta = [job, id ? `ID ${id.length > 10 ? `${id.slice(0, 8)}…` : id}` : ''].filter(Boolean).join(' · ');
    return { name, email, meta };
}

type StaffBulkInterpret = {
    toastText: string;
    historyStatus: ImportStatus;
    historyRecords: number;
    historyWarnings: number;
    shouldRefreshStaff: boolean;
    shouldClearFile: boolean;
};

/** Backend often returns HTTP 400 with body { created: [], errors: [{ row, email, message }, ...] } — not a transport failure. */
function interpretStaffBulkResponse(resOk: boolean, raw: unknown): StaffBulkInterpret {
    const rec = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const created = Array.isArray(rec.created) ? rec.created : [];
    const errors = Array.isArray(rec.errors) ? rec.errors : [];
    const nCreated = created.length;
    const nErrors = errors.length;

    if (nCreated > 0 || nErrors > 0) {
        let toastText: string;
        if (nCreated > 0 && nErrors > 0) {
            toastText = `${nCreated} added · ${nErrors} row(s) failed (errors in top-right panel).`;
        } else if (nCreated > 0) {
            toastText = `Imported ${nCreated} staff member(s). See created rows below.`;
        } else {
            toastText = `No rows imported · ${nErrors} issue(s) in the top-right panel.`;
        }
        return {
            toastText,
            historyStatus: nCreated > 0 ? 'success' : 'error',
            historyRecords: nCreated,
            historyWarnings: nErrors,
            shouldRefreshStaff: nCreated > 0,
            shouldClearFile: nCreated > 0,
        };
    }

    const parsed = parseBulkUploadSummary(raw);
    if (resOk) {
        return {
            toastText: parsed.message || (parsed.records > 0 ? `Import completed: ${parsed.records} records processed` : 'Import completed.'),
            historyStatus: 'success',
            historyRecords: parsed.records,
            historyWarnings: parsed.warnings,
            shouldRefreshStaff: true,
            shouldClearFile: true,
        };
    }
    return {
        toastText: String(rec.message || rec.detail || rec.error || parsed.message || 'Bulk import failed'),
        historyStatus: 'error',
        historyRecords: parsed.records,
        historyWarnings: parsed.warnings,
        shouldRefreshStaff: false,
        shouldClearFile: false,
    };
}

function getFacilityIdFromAuthMe(raw: unknown): string {
    const rec = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const user = rec.user && typeof rec.user === 'object' ? rec.user as Record<string, unknown> : null;
    const rootCandidates = [rec.facility_id, rec.facilityId, rec.current_facility_id, rec.currentFacilityId];
    const userCandidates = user ? [user.facility_id, user.facilityId, user.current_facility_id, user.currentFacilityId] : [];
    const resolved = [...rootCandidates, ...userCandidates].find(v => typeof v === 'string' && v.trim());
    return typeof resolved === 'string' ? resolved.trim() : '';
}

function getFacilityIdFromFacilityPayload(raw: unknown): string {
    if (Array.isArray(raw)) {
        const first = raw[0];
        return getFacilityIdFromFacilityPayload(first);
    }
    const rec = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const id = [rec.id, rec.facility_id, rec.facilityId]
        .find(v => typeof v === 'string' && v.trim());
    return typeof id === 'string' ? id.trim() : '';
}

/** Fixed widths for sticky cols 1–3 so horizontal `left` offsets match (Employee ID, First, Last). */
const STAFF_STICKY_W1 = 112;
const STAFF_STICKY_W2 = 128;
const STAFF_STICKY_W3 = 144;

const staffHeadCell: CSSProperties = {
    padding: '11px 16px',
    fontSize: 10.5,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--text-muted)',
    verticalAlign: 'middle',
    boxSizing: 'border-box',
    textAlign: 'left',
};

const staffBodyCell: CSSProperties = {
    padding: '13px 16px',
    boxSizing: 'border-box',
    verticalAlign: 'middle',
    fontSize: 13,
    color: 'var(--text-secondary)',
};

export default function StaffDirectoryManagement() {
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(false);
    const [search, setSearch] = useState('');
    const [toast, setToast] = useState<StaffToastState | null>(null);
    const [deptFilter, setDeptFilter] = useState('all');
    const [selected, setSelected] = useState<StaffMember | null>(null);
    const [editingSelected, setEditingSelected] = useState(false);
    const [editFirstName, setEditFirstName] = useState('');
    const [editMiddleName, setEditMiddleName] = useState('');
    const [editLastName, setEditLastName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editPhone, setEditPhone] = useState('+233');
    const [editDob, setEditDob] = useState('');
    const [editGender, setEditGender] = useState('');
    const [editJobTitle, setEditJobTitle] = useState('');
    const [editHighestQualification, setEditHighestQualification] = useState('');
    const [editIsDoctor, setEditIsDoctor] = useState<'dr' | 'other'>('other');
    const [editDept, setEditDept] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);
    const [activeTab, setActiveTab] = useState<'directory' | 'import'>('directory');
    const [showAddForm, setShowAddForm] = useState(false);
    const [newFirstName, setNewFirstName] = useState('');
    const [newMiddleName, setNewMiddleName] = useState('');
    const [newLastName, setNewLastName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPhone, setNewPhone] = useState('+233');
    const [newDob, setNewDob] = useState('');
    const [newGender, setNewGender] = useState('');
    const [newRole, setNewRole] = useState('');
    const [newHighestQualification, setNewHighestQualification] = useState('');
    const [newIsDoctor, setNewIsDoctor] = useState<'dr' | 'other' | ''>('');
    const [newDept, setNewDept] = useState('');
    const [newPatientAccess, setNewPatientAccess] = useState(true);
    const [sortKey, setSortKey] = useState<SortKey>('last_name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [statusFilter, setStatusFilter] = useState('all');
    const [staffPage, setStaffPage] = useState(1);
    const staffPageSize = 15;
    const [dragOver, setDragOver] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [bulkHistory, setBulkHistory] = useState<BulkUploadHistoryEntry[]>([]);
    const [bulkHistoryLoading, setBulkHistoryLoading] = useState(false);
    const [bulkResultCreated, setBulkResultCreated] = useState<unknown[]>([]);
    const [bulkResultErrors, setBulkResultErrors] = useState<StaffBulkImportRowError[]>([]);
    const [processing, setProcessing] = useState(false);
    const [adding, setAdding] = useState(false);
    const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
    const [deptIdToName, setDeptIdToName] = useState<Map<string, string>>(() => new Map());
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const dismissToast = useCallback(() => {
        setToast(null);
    }, []);

    const showToast = useCallback((message: string, variant: StaffToastVariant = 'info') => {
        setToast({ message, variant });
    }, []);

    const dismissBulkErrors = useCallback(() => {
        setBulkResultErrors([]);
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (bulkResultErrors.length > 0) {
                dismissBulkErrors();
            } else if (toast) {
                dismissToast();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [toast, dismissToast, bulkResultErrors.length, dismissBulkErrors]);

    const departments = useMemo(() => ['all', ...departmentOptions], [departmentOptions]);
    const deptNameToId = useMemo(() => {
        const m = new Map<string, string>();
        deptIdToName.forEach((name, id) => {
            m.set(name.trim().toLowerCase(), id);
        });
        return m;
    }, [deptIdToName]);

    // #region agent log
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const runId = 'post-fix-4-unified-scroll';
        const post = (hypothesisId: string, message: string, data: Record<string, unknown>) => {
            fetch('http://127.0.0.1:7426/ingest/00cfa10c-d013-4384-9106-545095334c7e', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f12e6f' },
                body: JSON.stringify({
                    sessionId: 'f12e6f',
                    runId,
                    hypothesisId,
                    location: 'StaffDirectoryManagement.tsx:staff-table-debug',
                    message,
                    data,
                    timestamp: Date.now(),
                }),
            }).catch(() => {});
        };
        const raf = requestAnimationFrame(() => {
            if (!selected) {
                post('H3', 'selection-cleared', { selectedNull: true });
                return;
            }
            const row = document.querySelector('.staff-split-row[data-selected="true"]');
            const c1 = row?.children[0] as HTMLElement | undefined;
            const c3 = row?.children[2] as HTMLElement | undefined;
            const c4 = row?.children[3] as HTMLElement | undefined;
            post('H3', 'dom-after-select', {
                selectedId: selected.id,
                hasRow: Boolean(row),
                dataSelectedAttr: row?.getAttribute('data-selected') ?? null,
                layout: 'unified-scroll',
            });
            if (!row || !c1 || !c3 || !c4) {
                post('H1', 'missing-row-or-cells', { hasRow: Boolean(row), hasC1: Boolean(c1), hasC3: Boolean(c3), hasC4: Boolean(c4) });
                return;
            }
            const s1 = window.getComputedStyle(c1);
            const s3 = window.getComputedStyle(c3);
            const s4 = window.getComputedStyle(c4);
            const str = row ? window.getComputedStyle(row) : null;
            post('H1', 'computed-style-frozen-vs-email', {
                bg1: s1.backgroundColor,
                bg3: s3.backgroundColor,
                bg4: s4.backgroundColor,
                z1: s1.zIndex,
                z3: s3.zIndex,
                z4: s4.zIndex,
                pos1: s1.position,
                pos3: s3.position,
                pos4: s4.position,
                overflow4: s4.overflow,
                whiteSpace4: s4.whiteSpace,
                textOverflow4: s4.textOverflow,
                rowBg: str?.backgroundColor ?? null,
            });
            const r1 = c1.getBoundingClientRect();
            const r3 = c3.getBoundingClientRect();
            const r4 = c4.getBoundingClientRect();
            post('H5', 'cell-geometry', {
                w1: r1.width,
                w3: r3.width,
                w4: r4.width,
                right3: r3.right,
                left4: r4.left,
                gapPx: r4.left - r3.right,
            });
            const root = document.querySelector('.staff-table-scroll');
            const transforms: { depth: number; tag: string; cls: string; t: string }[] = [];
            let el: HTMLElement | null = root?.parentElement ?? null;
            let depth = 0;
            while (el && depth < 14) {
                const st = window.getComputedStyle(el);
                if (st.transform && st.transform !== 'none') {
                    transforms.push({ depth, tag: el.tagName, cls: String(el.className).slice(0, 100), t: st.transform.slice(0, 80) });
                }
                el = el.parentElement;
                depth += 1;
            }
            post('H4', 'ancestors-with-transform', { count: transforms.length, transforms });
        });
        return () => cancelAnimationFrame(raf);
    }, [selected]);
    // #endregion

    const isAddFormComplete = useMemo(() => (
        Boolean(newFirstName.trim())
        && Boolean(newLastName.trim())
        && Boolean(newEmail.trim())
        && Boolean(newPhone.trim())
        && Boolean(newDob.trim())
        && Boolean(newGender.trim())
        && Boolean(newRole.trim())
        && Boolean(newHighestQualification.trim())
        && Boolean(newIsDoctor)
        && Boolean(newDept.trim())
        && isValidGhanaPhone(newPhone)
    ), [
        newFirstName,
        newLastName,
        newEmail,
        newPhone,
        newDob,
        newGender,
        newRole,
        newHighestQualification,
        newIsDoctor,
        newDept,
    ]);

    const addFormMissingFields = useMemo(() => {
        const missing: string[] = [];
        if (!newFirstName.trim()) missing.push('First name');
        if (!newLastName.trim()) missing.push('Last name');
        if (!newEmail.trim()) missing.push('Email');
        if (!newPhone.trim()) missing.push('Phone');
        if (newPhone.trim() && !isValidGhanaPhone(newPhone)) missing.push('Phone format (+233 + 9 digits)');
        if (!newDob.trim()) missing.push('DOB');
        if (!newGender.trim()) missing.push('Gender');
        if (!newRole.trim()) missing.push('Title');
        if (!newHighestQualification.trim()) missing.push('Highest qualification');
        if (!newIsDoctor) missing.push('Is doctor');
        if (!newDept.trim()) missing.push('Department');
        return missing;
    }, [
        newFirstName,
        newLastName,
        newEmail,
        newPhone,
        newDob,
        newGender,
        newRole,
        newHighestQualification,
        newIsDoctor,
        newDept,
    ]);

    const formatMissingFieldsToast = useCallback((missing: string[]) => {
        if (missing.length === 0) return 'Please fill all required fields before adding staff';
        const head = missing.slice(0, 4).join(', ');
        const rest = missing.length - 4;
        return rest > 0 ? `Missing: ${head} (+${rest} more)` : `Missing: ${head}`;
    }, []);

    const fetchStaff = useCallback(async () => {
        setFetchError(false);
        try {
            const res = await fetch('/api/proxy/staff?page_size=100&page_id=1');
            if (res.ok) {
                const data = await res.json();
                const parsed = parseStaffList(data);
                setStaff(parsed);
            } else {
                setFetchError(true);
            }
        } catch {
            setFetchError(true);
        }
        setLoading(false);
    }, []);

    const fetchDepartments = useCallback(async () => {
        try {
            const res = await fetch('/api/proxy/departments');
            if (!res.ok) return;
            const data = await res.json();
            const list = extractDepartmentArray(data);
            const idToName = new Map<string, string>();
            const names: string[] = [];
            for (const d of list) {
                if (!d || typeof d !== 'object') continue;
                const r = d as Record<string, unknown>;
                const id = String(r.id || r.department_id || r.uuid || '').trim();
                const name = String(r.name || r.department_name || r.departmentName || r.title || '').trim();
                if (name) names.push(name);
                if (id && name) idToName.set(id.toLowerCase(), name);
            }
            setDeptIdToName(idToName);
            setDepartmentOptions(Array.from(new Set(names)));
        } catch {
            // best effort
        }
    }, []);

    useEffect(() => { fetchStaff(); }, [fetchStaff]);
    useEffect(() => { fetchDepartments(); }, [fetchDepartments]);
    useEffect(() => {
        if (!newDept && departmentOptions.length > 0) setNewDept(departmentOptions[0]);
    }, [newDept, departmentOptions]);
    useEffect(() => {
        if (!selected) {
            setEditingSelected(false);
            return;
        }
        setEditFirstName(selected.first_name || '');
        setEditMiddleName(selected.middle_name || '');
        setEditLastName(selected.last_name || '');
        setEditEmail(selected.email || '');
        setEditPhone(selected.phone ? formatGhanaPhoneInput(selected.phone) : '+233');
        setEditDob(selected.dob || '');
        setEditGender(selected.gender || '');
        setEditJobTitle(selected.title || selected.job_title || '');
        setEditHighestQualification(selected.highest_qualification || '');
        setEditIsDoctor(selected.is_doctor ? 'dr' : 'other');
        setEditDept(selected.dept || '');
    }, [selected]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const clearUploadedFile = () => {
        setUploadedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const fetchBulkHistory = useCallback(async () => {
        setBulkHistoryLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('kind', 'staff');
            const res = await fetch(`/api/proxy/bulk-upload-history?${params.toString()}`, { credentials: 'include' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setBulkHistory([]);
                return;
            }
            setBulkHistory(parseBulkUploadHistoryResponse(data));
        } catch {
            setBulkHistory([]);
        } finally {
            setBulkHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab !== 'import') return;
        void fetchBulkHistory();
    }, [activeTab, fetchBulkHistory]);

    const handleBulkImport = async () => {
        if (!uploadedFile) return;
        setProcessing(true);
        setBulkResultCreated([]);
        setBulkResultErrors([]);
        try {
            let facilityId = '';

            // Priority 0: Read from helix-facility cookie (set by facility selector)
            const cookieMatch = document.cookie.match(/helix-facility=([^;]+)/);
            if (cookieMatch) facilityId = cookieMatch[1];

            const meRes = await fetch('/api/proxy/auth/me');
            if (meRes.ok) {
                const meData = await meRes.json().catch(() => ({}));
                if (!facilityId) facilityId = getFacilityIdFromAuthMe(meData);
            }
            if (!facilityId) {
                const hospitalRes = await fetch('/api/proxy/hospital');
                if (hospitalRes.ok) {
                    const hospitalData = await hospitalRes.json().catch(() => ({}));
                    facilityId = getFacilityIdFromFacilityPayload(hospitalData);
                }
            }
            if (!facilityId) {
                const facilitiesRes = await fetch('/api/proxy/facilities');
                if (facilitiesRes.ok) {
                    const facilitiesData = await facilitiesRes.json().catch(() => ([]));
                    facilityId = getFacilityIdFromFacilityPayload(facilitiesData);
                }
            }
            if (!facilityId) {
                showToast('Unable to determine facility for bulk upload', 'error');
                return;
            }

            const formData = new FormData();
            // API: multipart field "file" (CSV or Excel) + "facility_id" (UUID). Role is always staff on the server.
            formData.append('facility_id', facilityId);
            formData.append('file', uploadedFile, uploadedFile.name);

            const res = await fetch('/api/proxy/staff/bulk', {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });
            const data = await res.json().catch(() => ({}));
            const recPayload =
                data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
            setBulkResultCreated(Array.isArray(recPayload.created) ? [...recPayload.created] : []);
            setBulkResultErrors(parseBulkErrorRows(recPayload.errors));

            const outcome = interpretStaffBulkResponse(res.ok, data);

            showToast(
                outcome.toastText,
                outcome.historyStatus === 'error'
                    ? 'error'
                    : outcome.historyWarnings > 0
                      ? 'info'
                      : 'success'
            );
            if (outcome.shouldClearFile) clearUploadedFile();
            if (outcome.shouldRefreshStaff) {
                setLoading(true);
                fetchStaff();
            }
        } catch {
            setBulkResultCreated([]);
            setBulkResultErrors([]);
            showToast('Bulk import failed', 'error');
        } finally {
            setProcessing(false);
            void fetchBulkHistory();
        }
    };

    const staffForList = useMemo(() => {
        if (deptIdToName.size === 0) return staff;
        return staff.map(s => {
            const rawId = s.department_id?.trim();
            if (!rawId) return s;
            const name = deptIdToName.get(rawId.toLowerCase());
            if (!name) return s;
            if (s.dept && s.dept !== 'Unassigned') return s;
            return { ...s, dept: name };
        });
    }, [staff, deptIdToName]);

    const filtered = staffForList.filter(s => {
        const q = search.toLowerCase();
        const matchSearch = search === '' || s.first_name.toLowerCase().includes(q) || s.last_name.toLowerCase().includes(q) || s.dept.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.employee_id.toLowerCase().includes(q) || s.job_title.toLowerCase().includes(q);
        const matchDept = deptFilter === 'all' || s.dept === deptFilter;
        const matchStatus = statusFilter === 'all' || s.status === statusFilter;
        return matchSearch && matchDept && matchStatus;
    }).sort((a, b) => {
        const av = a[sortKey].toLowerCase();
        const bv = b[sortKey].toLowerCase();
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    const staffTotalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / staffPageSize)), [filtered.length, staffPageSize]);
    const paginatedFiltered = useMemo(
        () => filtered.slice((staffPage - 1) * staffPageSize, staffPage * staffPageSize),
        [filtered, staffPage, staffPageSize]
    );

    useEffect(() => {
        setStaffPage(1);
    }, [search, deptFilter, statusFilter, sortKey, sortDir]);

    useEffect(() => {
        if (staffPage > staffTotalPages) setStaffPage(staffTotalPages);
    }, [staffPage, staffTotalPages]);

    const handleAdd = async () => {
        if (!isAddFormComplete) {
            showToast(formatMissingFieldsToast(addFormMissingFields), 'error');
            return;
        }
        setAdding(true);
        try {
            const res = await fetch('/api/proxy/staff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: newFirstName.trim(),
                    middle_name: newMiddleName.trim() || undefined,
                    last_name: newLastName.trim(),
                    email: newEmail.trim(),
                    phone: newPhone.trim() ? formatGhanaPhoneInput(newPhone) : '',
                    dob: newDob.trim() || undefined,
                    gender: newGender.trim() || undefined,
                    title: (newRole || 'Staff').trim(),
                    job_title: (newRole || 'Staff').trim(),
                    highest_qualification: newHighestQualification.trim() || undefined,
                    is_doctor: newIsDoctor === 'dr',
                    patient_access: newPatientAccess,
                    role: 'staff',
                    department: newDept,
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({} as { message?: string; detail?: string; error?: string }));
                showToast(String(err.message || err.detail || err.error || 'Failed to add staff'), 'error');
                return;
            }

            const data = await res.json();
            const created = parseStaffList([data])[0];
            const fallbackMember: StaffMember = {
                id: String(Date.now()),
                first_name: newFirstName.trim(),
                middle_name: newMiddleName.trim(),
                last_name: newLastName.trim(),
                email: newEmail.trim(),
                job_title: (newRole || 'Staff').trim(),
                title: (newRole || 'Staff').trim(),
                highest_qualification: newHighestQualification.trim(),
                is_doctor: newIsDoctor === 'dr',
                dept: newDept,
                status: 'active',
                access: 'Staff',
                employee_id: '',
                patient_access: newPatientAccess,
                role: 'staff',
                phone: newPhone.trim() ? formatGhanaPhoneInput(newPhone) : '',
                dob: newDob.trim(),
                gender: newGender.trim(),
            };

            // Merge form values into parsed result for fields the backend may not return
            const member: StaffMember = created
                ? {
                    ...created,
                    middle_name: created.middle_name || newMiddleName.trim(),
                    dept: (!created.dept || created.dept === 'Unassigned') ? newDept : created.dept,
                    highest_qualification: created.highest_qualification || newHighestQualification.trim(),
                    dob: created.dob || newDob.trim(),
                    gender: created.gender || newGender.trim(),
                    is_doctor: created.is_doctor || newIsDoctor === 'dr',
                    patient_access: created.patient_access ?? newPatientAccess,
                }
                : fallbackMember;

            setStaff(prev => [member, ...prev]);
            setShowAddForm(false);
            setNewFirstName('');
            setNewMiddleName('');
            setNewLastName('');
            setNewEmail('');
            setNewPhone('+233');
            setNewDob('');
            setNewGender('');
            setNewRole('');
            setNewHighestQualification('');
            setNewIsDoctor('');
            setNewPatientAccess(true);
            showToast(`${newFirstName} ${newLastName} added to staff`, 'success');
        } catch {
            showToast('Failed to add staff', 'error');
        } finally {
            setAdding(false);
        }
    };

    const handleRemove = async (id: string) => {
        const member = staff.find(s => s.id === id);
        setStaff(prev => prev.filter(s => s.id !== id));
        if (selected?.id === id) setSelected(null);
        showToast(`${member?.first_name} ${member?.last_name} removed`, 'success');
        try {
            await fetch(`/api/proxy/staff/${id}`, { method: 'DELETE' });
        } catch { /* optimistic — already removed locally */ }
    };

    const toggleStatus = async (id: string) => {
        const member = staff.find(s => s.id === id);
        const newStatus = member?.status === 'active' ? 'disabled' : 'active';
        setStaff(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
        showToast(newStatus === 'disabled' ? `${member?.first_name} ${member?.last_name} disabled` : `${member?.first_name} ${member?.last_name} enabled`, 'success');
        try {
            await fetch(`/api/proxy/staff/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
        } catch { /* optimistic — already updated locally */ }
    };

    const togglePatientAccess = async (id: string, currentAccess: boolean) => {
        const newVal = !currentAccess;
        const member = staff.find(s => s.id === id);
        setStaff(prev => prev.map(s => s.id === id ? { ...s, patient_access: newVal } : s));
        setSelected(prev => prev && prev.id === id ? { ...prev, patient_access: newVal } : prev);
        showToast(`Patient access ${newVal ? 'granted' : 'revoked'} for ${member?.first_name} ${member?.last_name}`, 'success');
        try {
            await fetch(`/api/proxy/staff/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patient_access: newVal }),
            });
        } catch {
            // Rollback on failure
            setStaff(prev => prev.map(s => s.id === id ? { ...s, patient_access: currentAccess } : s));
            setSelected(prev => prev && prev.id === id ? { ...prev, patient_access: currentAccess } : prev);
            showToast('Failed to update patient access', 'error');
        }
    };

    const assignRole = async (id: string, newRole: 'staff' | 'admin') => {
        const member = staff.find(s => s.id === id);
        const oldRole = member?.role || 'staff';
        setStaff(prev => prev.map(s => s.id === id ? { ...s, role: newRole } : s));
        setSelected(prev => prev && prev.id === id ? { ...prev, role: newRole } : prev);
        showToast(`${member?.first_name} ${member?.last_name} is now ${newRole === 'admin' ? 'an Admin' : 'Staff'}`, 'success');
        try {
            const res = await fetch(`/api/proxy/staff/${id}/assign-role`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole }),
            });
            if (!res.ok) {
                setStaff(prev => prev.map(s => s.id === id ? { ...s, role: oldRole } : s));
                setSelected(prev => prev && prev.id === id ? { ...prev, role: oldRole } : prev);
                showToast('Failed to assign role', 'error');
            }
        } catch {
            setStaff(prev => prev.map(s => s.id === id ? { ...s, role: oldRole } : s));
            setSelected(prev => prev && prev.id === id ? { ...prev, role: oldRole } : prev);
            showToast('Failed to assign role', 'error');
        }
    };

    const handleSaveSelected = async () => {
        if (!selected) return;
        if (!editFirstName.trim() || !editLastName.trim() || !editEmail.trim()) {
            showToast('First name, last name, and email are required', 'error');
            return;
        }
        if (editPhone.trim() && !isValidGhanaPhone(editPhone)) {
            showToast('Phone must be +233 followed by 9 digits', 'error');
            return;
        }

        setSavingEdit(true);
        try {
            const payload = {
                first_name: editFirstName.trim(),
                middle_name: editMiddleName.trim() || undefined,
                last_name: editLastName.trim(),
                email: editEmail.trim(),
                phone: editPhone.trim() ? formatGhanaPhoneInput(editPhone) : '',
                dob: editDob.trim() || undefined,
                gender: editGender.trim() || undefined,
                title: editJobTitle.trim(),
                job_title: editJobTitle.trim(),
                highest_qualification: editHighestQualification.trim() || undefined,
                is_doctor: editIsDoctor === 'dr',
                department: editDept.trim(),
                status: selected.status,
                role: selected.role,
                patient_access: selected.patient_access,
            };
            // #region agent log
            {
                const dk = editDept.trim().toLowerCase();
                fetch('http://127.0.0.1:7426/ingest/00cfa10c-d013-4384-9106-545095334c7e', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f12e6f' },
                    body: JSON.stringify({
                        sessionId: 'f12e6f',
                        runId: 'staff-dept-update',
                        hypothesisId: 'H-A',
                        location: 'StaffDirectoryManagement.tsx:handleSaveSelected',
                        message: 'client-put-payload',
                        data: {
                            staffIdSuffix: selected.id.slice(-10),
                            departmentFieldLen: editDept.trim().length,
                            deptNameInLocalMap: deptNameToId.has(dk),
                            mapSize: deptNameToId.size,
                            payloadHasDepartmentKey: 'department' in payload && Boolean(String(payload.department || '').trim()),
                            selectedHadDepartmentId: Boolean(selected.department_id?.trim()),
                        },
                        timestamp: Date.now(),
                    }),
                }).catch(() => {});
            }
            // #endregion
            const res = await fetch(`/api/proxy/staff/${selected.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({} as { message?: string; detail?: string; error?: string }));
                // #region agent log
                fetch('http://127.0.0.1:7426/ingest/00cfa10c-d013-4384-9106-545095334c7e', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f12e6f' },
                    body: JSON.stringify({
                        sessionId: 'f12e6f',
                        runId: 'staff-dept-update',
                        hypothesisId: 'H-E',
                        location: 'StaffDirectoryManagement.tsx:handleSaveSelected',
                        message: 'client-put-not-ok',
                        data: {
                            status: res.status,
                            errKeys: err && typeof err === 'object' ? Object.keys(err as object) : [],
                        },
                        timestamp: Date.now(),
                    }),
                }).catch(() => {});
                // #endregion
                showToast(String(err.message || err.detail || err.error || 'Failed to update staff'), 'error');
                return;
            }

            const data = await res.json();
            const parsedRows = parseStaffList(data);
            const fromApi = parsedRows.find(s => s.id === selected.id);
            // #region agent log
            fetch('http://127.0.0.1:7426/ingest/00cfa10c-d013-4384-9106-545095334c7e', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f12e6f' },
                body: JSON.stringify({
                    sessionId: 'f12e6f',
                    runId: 'staff-dept-update',
                    hypothesisId: 'H-D',
                    location: 'StaffDirectoryManagement.tsx:handleSaveSelected',
                    message: 'client-after-put-parse',
                    data: {
                        parsedRowsLen: parsedRows.length,
                        fromApiFound: Boolean(fromApi),
                        fromApiDeptLen: fromApi?.dept?.length ?? 0,
                        fromApiHasDeptId: Boolean(fromApi?.department_id?.trim()),
                        dataTopKeys: data && typeof data === 'object' ? Object.keys(data as object).slice(0, 20) : [],
                    },
                    timestamp: Date.now(),
                }),
            }).catch(() => {});
            // #endregion
            const resolvedDeptId =
                deptNameToId.get(editDept.trim().toLowerCase()) || selected.department_id;
            const fallbackLocal: StaffMember = {
                ...selected,
                first_name: payload.first_name,
                middle_name: payload.middle_name || '',
                last_name: payload.last_name,
                email: payload.email,
                phone: payload.phone,
                dob: payload.dob || '',
                gender: payload.gender || '',
                title: payload.title || selected.title || '',
                job_title: payload.job_title || selected.job_title,
                highest_qualification: payload.highest_qualification || selected.highest_qualification || '',
                is_doctor: payload.is_doctor,
                dept: editDept.trim() || selected.dept,
                department_id: resolvedDeptId,
            };
            const updatedLocal: StaffMember = fromApi
                ? {
                    ...selected,
                    ...fromApi,
                    middle_name: fromApi.middle_name || payload.middle_name || selected.middle_name || '',
                }
                : fallbackLocal;
            // Backend PUT 200 body often omits department fields; parseStaffList defaults dept to "Unassigned".
            const trimmedEditDept = editDept.trim();
            const apiReturnedDepartmentId = Boolean(fromApi?.department_id?.trim());
            const mergedLocal: StaffMember =
                fromApi && trimmedEditDept && !apiReturnedDepartmentId
                    ? { ...updatedLocal, dept: trimmedEditDept, department_id: resolvedDeptId }
                    : updatedLocal;
            // #region agent log
            fetch('http://127.0.0.1:7426/ingest/00cfa10c-d013-4384-9106-545095334c7e', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f12e6f' },
                body: JSON.stringify({
                    sessionId: 'f12e6f',
                    runId: 'staff-dept-update',
                    hypothesisId: 'H-D',
                    location: 'StaffDirectoryManagement.tsx:handleSaveSelected',
                    message: 'client-merge-dept-overlay',
                    data: {
                        overlayApplied: Boolean(fromApi && trimmedEditDept && !apiReturnedDepartmentId),
                        apiReturnedDepartmentId,
                        trimmedEditDeptLen: trimmedEditDept.length,
                    },
                    timestamp: Date.now(),
                }),
            }).catch(() => {});
            // #endregion
            setStaff(prev => prev.map(s => (s.id === selected.id ? { ...s, ...mergedLocal } : s)));
            setSelected(mergedLocal);
            setEditingSelected(false);
            showToast('Staff updated', 'success');
        } catch {
            showToast('Failed to update staff', 'error');
        } finally {
            setSavingEdit(false);
        }
    };

    return (
        <>
            {bulkResultErrors.length > 0 && (
                <BulkImportErrorsSheet
                    errors={bulkResultErrors}
                    onDismiss={dismissBulkErrors}
                    title="Bulk import — rows not imported"
                    description={`${bulkResultErrors.length} row${bulkResultErrors.length === 1 ? '' : 's'} in this file were skipped. Correct the sheet and try again, or add these people individually.`}
                    titleId="staff-bulk-errors-title"
                    descId="staff-bulk-errors-desc"
                />
            )}
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast.message} variant={toast.variant} onDismiss={dismissToast} />
                </MacVibrancyToastPortal>
            )}

            <div className="app-main">
                <TopBar
                    title="Staff Management"
                    subtitle="Directory & Import"
                    search={activeTab === 'directory' ? { placeholder: 'Search by name, dept, or email...', value: search, onChange: setSearch } : undefined}
                    actions={
                        <div style={{ display: 'flex', gap: 8 }}>
                            {activeTab === 'directory' && (
                                <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>{showAddForm ? 'close' : 'add'}</span>
                                    {showAddForm ? 'Cancel' : 'Add Staff'}
                                </button>
                            )}
                        </div>
                    }
                />

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-default)', padding: '0 24px', background: '#fff' }}>
                    {([['directory', 'groups', 'Staff Directory'], ['import', 'upload_file', 'Bulk Import']] as const).map(([id, icon, label]) => (
                        <button key={id} onClick={() => setActiveTab(id as 'directory' | 'import')}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', fontSize: 13, fontWeight: activeTab === id ? 600 : 500, color: activeTab === id ? 'var(--helix-primary)' : 'var(--text-muted)', background: 'transparent', border: 'none', borderBottom: activeTab === id ? '2px solid var(--helix-primary)' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
                            <span className="material-icons-round" style={{ fontSize: 16 }}>{icon}</span>{label}
                        </button>
                    ))}
                </div>

                {activeTab === 'directory' ? (
                <main style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '20px 24px', background: 'var(--bg-900)' }}>

                    {/* Add Staff Form */}
                    {showAddForm && (
                        <div className="fade-in card" style={{ marginBottom: 18, padding: '18px 20px' }}>
                            <h3 style={{ fontSize: 14, marginBottom: 12 }}>New Staff Member</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 14 }}>
                                <div><label className="label">First Name *</label><input className="input" value={newFirstName} onChange={e => setNewFirstName(e.target.value)} placeholder="First name" style={{ fontSize: 12 }} /></div>
                                <div><label className="label">Middle Name (Optional)</label><input className="input" value={newMiddleName} onChange={e => setNewMiddleName(e.target.value)} placeholder="Middle name" style={{ fontSize: 12 }} /></div>
                                <div><label className="label">Last Name *</label><input className="input" value={newLastName} onChange={e => setNewLastName(e.target.value)} placeholder="Last name" style={{ fontSize: 12 }} /></div>
                                <div><label className="label">Email *</label><input className="input" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email address" style={{ fontSize: 12 }} /></div>
                                <div>
                                    <label className="label">Phone *</label>
                                    <input
                                        className="input"
                                        value={newPhone}
                                        onChange={e => setNewPhone(formatGhanaPhoneInput(e.target.value))}
                                        placeholder="+233241234567"
                                        maxLength={13}
                                        style={{ fontSize: 12 }}
                                    />
                                    <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--text-muted)' }}>
                                        Use +233 followed by 9 digits
                                    </div>
                                </div>
                                <div>
                                    <label className="label">DOB *</label>
                                    <DatePicker value={newDob} onChange={setNewDob} placeholder="Select DOB" />
                                </div>
                                <div>
                                    <label className="label">Gender *</label>
                                    <CustomSelect
                                        value={newGender}
                                        onChange={v => setNewGender(v)}
                                        options={[
                                            { label: 'Male', value: 'male' },
                                            { label: 'Female', value: 'female' },
                                            { label: 'Other', value: 'other' },
                                        ]}
                                        placeholder="-- Select --"
                                    />
                                </div>
                                <div>
                                    <label className="label">Title *</label>
                                    <CustomSelect
                                        value={newRole}
                                        onChange={v => setNewRole(v)}
                                        options={STAFF_TITLE_OPTIONS.map(t => ({ label: t, value: t }))}
                                        placeholder="-- Select Title --"
                                        allowCustom
                                        customPlaceholder="Type title and press Enter"
                                    />
                                </div>
                                <div>
                                    <label className="label">Highest Qualification *</label>
                                    <CustomSelect
                                        value={newHighestQualification}
                                        onChange={v => setNewHighestQualification(v)}
                                        options={QUALIFICATION_OPTIONS.map(q => ({ label: q, value: q }))}
                                        placeholder="-- Select Qualification --"
                                        allowCustom
                                        customPlaceholder="Type qualification and press Enter"
                                    />
                                </div>
                                <div>
                                    <label className="label">Is Doctor *</label>
                                    <CustomSelect
                                        value={newIsDoctor}
                                        onChange={v => setNewIsDoctor(v === 'dr' || v === 'other' ? v : '')}
                                        options={[
                                            { label: 'Dr.', value: 'dr' },
                                            { label: 'Other', value: 'other' },
                                        ]}
                                        placeholder="-- Select --"
                                    />
                                </div>
                                <div>
                                    <label className="label">Department *</label>
                                    <CustomSelect
                                        value={newDept}
                                        onChange={v => setNewDept(v)}
                                        options={departmentOptions.map(d => ({ label: d, value: d }))}
                                        placeholder="-- Select --"
                                    />
                                </div>
                                <div><label className="label">Patient Access</label><CustomSelect value={newPatientAccess ? 'yes' : 'no'} onChange={v => setNewPatientAccess(v === 'yes')} options={[{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]} placeholder="-- Select --" /></div>
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={adding}>
                                <span className="material-icons-round" style={{ fontSize: 14 }}>{adding ? 'hourglass_empty' : 'person_add'}</span>{adding ? 'Adding...' : 'Add Staff'}
                            </button>
                        </div>
                    )}

                    {/* Filters & Sort */}
                    <div className="fade-in delay-1" style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 240 }}>
                            <CustomSelect
                                value={deptFilter}
                                onChange={setDeptFilter}
                                options={departments.map(d => ({ label: d === 'all' ? 'All Depts' : d, value: d }))}
                                placeholder="All Depts"
                            />
                        </div>
                        <div style={{ width: 1, height: 20, background: 'var(--border-subtle)' }} />
                        <div style={{ display: 'flex', gap: 5 }}>
                            {['all', 'active', 'disabled'].map(s => (
                                <button key={s} className="btn btn-secondary btn-xs" onClick={() => setStatusFilter(s)}
                                    style={{ background: statusFilter === s ? '#edf1f7' : undefined, borderColor: statusFilter === s ? 'var(--helix-primary)' : undefined, color: statusFilter === s ? 'var(--helix-primary)' : undefined, fontWeight: statusFilter === s ? 600 : 400 }}>
                                    {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                            ))}
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                            <span className="material-icons-round" style={{ fontSize: 14 }}>sort</span>
                            <CustomSelect
                                value={`${sortKey}-${sortDir}`}
                                onChange={v => { const [k, d] = v.split('-'); setSortKey(k as SortKey); setSortDir(d as 'asc' | 'desc'); }}
                                options={[
                                    { label: 'Last Name A-Z', value: 'last_name-asc' },
                                    { label: 'Last Name Z-A', value: 'last_name-desc' },
                                    { label: 'First Name A-Z', value: 'first_name-asc' },
                                    { label: 'First Name Z-A', value: 'first_name-desc' },
                                    { label: 'Department A-Z', value: 'dept-asc' },
                                    { label: 'Department Z-A', value: 'dept-desc' },
                                    { label: 'Job Title A-Z', value: 'job_title-asc' },
                                    { label: 'Employee ID A-Z', value: 'employee_id-asc' },
                                    { label: 'Status A-Z', value: 'status-asc' },
                                ]}
                                style={{ minWidth: 160 }}
                                maxH={200}
                            />
                        </div>
                    </div>

                    {/* Table + Detail */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: selected ? 'minmax(0, 1fr) minmax(300px, 340px)' : '1fr',
                            gap: 20,
                            alignItems: 'start',
                            width: '100%',
                            minWidth: 0,
                        }}
                    >
                        {/* No fade-in/transform on this card — CSS animation breaks position:sticky masking during horizontal scroll */}
                        <div className="card" style={{ padding: 0, overflow: 'hidden', minWidth: 0, maxWidth: '100%' }}>
                            <div
                                className="table-wrapper staff-table-scroll"
                                style={{ minWidth: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
                            >
                                <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'auto' }}>
                                    <thead>
                                        <tr>
                                            <th
                                                style={{
                                                    ...staffHeadCell,
                                                    width: STAFF_STICKY_W1,
                                                    minWidth: STAFF_STICKY_W1,
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap',
                                                    position: 'sticky',
                                                    left: 0,
                                                    zIndex: 5,
                                                    background: '#fafbfc',
                                                    borderBottom: '1px solid var(--border-default)',
                                                }}
                                                onClick={() => toggleSort('employee_id')}
                                            >
                                                Employee ID {sortKey === 'employee_id' && (sortDir === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th
                                                style={{
                                                    ...staffHeadCell,
                                                    width: STAFF_STICKY_W2,
                                                    minWidth: STAFF_STICKY_W2,
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap',
                                                    position: 'sticky',
                                                    left: STAFF_STICKY_W1,
                                                    zIndex: 5,
                                                    background: '#fafbfc',
                                                    borderBottom: '1px solid var(--border-default)',
                                                }}
                                                onClick={() => toggleSort('first_name')}
                                            >
                                                First Name {sortKey === 'first_name' && (sortDir === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th
                                                style={{
                                                    ...staffHeadCell,
                                                    width: STAFF_STICKY_W3,
                                                    minWidth: STAFF_STICKY_W3,
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap',
                                                    position: 'sticky',
                                                    left: STAFF_STICKY_W1 + STAFF_STICKY_W2,
                                                    zIndex: 5,
                                                    background: '#fafbfc',
                                                    boxShadow: '4px 0 10px -4px rgba(15, 23, 42, 0.12)',
                                                    borderBottom: '1px solid var(--border-default)',
                                                }}
                                                onClick={() => toggleSort('last_name')}
                                            >
                                                Last Name {sortKey === 'last_name' && (sortDir === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th style={{ ...staffHeadCell, minWidth: 220, whiteSpace: 'nowrap', background: '#fafbfc', borderBottom: '1px solid var(--border-default)' }}>Email</th>
                                            <th style={{ ...staffHeadCell, minWidth: 130, whiteSpace: 'nowrap', cursor: 'pointer', background: '#fafbfc', borderBottom: '1px solid var(--border-default)' }} onClick={() => toggleSort('job_title')}>Job Title {sortKey === 'job_title' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                                            <th style={{ ...staffHeadCell, minWidth: 160, whiteSpace: 'nowrap', cursor: 'pointer', background: '#fafbfc', borderBottom: '1px solid var(--border-default)' }} onClick={() => toggleSort('dept')}>Department {sortKey === 'dept' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                                            <th style={{ ...staffHeadCell, minWidth: 140, whiteSpace: 'nowrap', background: '#fafbfc', borderBottom: '1px solid var(--border-default)' }}>Patient Access</th>
                                            <th style={{ ...staffHeadCell, minWidth: 88, whiteSpace: 'nowrap', cursor: 'pointer', background: '#fafbfc', borderBottom: '1px solid var(--border-default)' }} onClick={() => toggleSort('status')}>Status {sortKey === 'status' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                                            <th style={{ ...staffHeadCell, width: 44, minWidth: 44, background: '#fafbfc', borderBottom: '1px solid var(--border-default)' }} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading && filtered.length === 0 && (
                                            <tr>
                                                <td colSpan={9} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                                                    <span className="material-icons-round" style={{ fontSize: 24, display: 'block', marginBottom: 8, opacity: 0.4 }}>hourglass_empty</span>
                                                    Loading staff from server...
                                                </td>
                                            </tr>
                                        )}
                                        {!loading && fetchError && filtered.length === 0 && (
                                            <tr>
                                                <td colSpan={9} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                                                    <span className="material-icons-round" style={{ fontSize: 24, display: 'block', marginBottom: 8, color: 'var(--critical)' }}>cloud_off</span>
                                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Could not load staff</div>
                                                    <div style={{ marginBottom: 12 }}>The server is unreachable. Check your connection and try again.</div>
                                                    <button className="btn btn-primary btn-sm" onClick={() => { setLoading(true); fetchStaff(); }}>
                                                        <span className="material-icons-round" style={{ fontSize: 14 }}>refresh</span> Retry
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
                                        {!loading && !fetchError && filtered.length === 0 && (
                                            <tr>
                                                <td colSpan={9} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                                                    <span className="material-icons-round" style={{ fontSize: 24, display: 'block', marginBottom: 8, opacity: 0.4 }}>person_off</span>
                                                    {search || deptFilter !== 'all' || statusFilter !== 'all' ? 'No staff match your filters.' : 'No staff members yet. Add staff above to get started.'}
                                                </td>
                                            </tr>
                                        )}
                                        {paginatedFiltered.map(s => {
                                            const st = statusColors[s.status] || statusColors.active;
                                            const isSelected = selected?.id === s.id;
                                            const rowBg = isSelected ? '#edf1f7' : '#ffffff';
                                            return (
                                                <tr
                                                    key={s.id}
                                                    className="staff-split-row"
                                                    data-selected={isSelected ? 'true' : undefined}
                                                    onClick={() => setSelected(isSelected ? null : s)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <td
                                                        style={{
                                                            ...staffBodyCell,
                                                            width: STAFF_STICKY_W1,
                                                            minWidth: STAFF_STICKY_W1,
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                            fontFamily: "'Montserrat', sans-serif",
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            position: 'sticky',
                                                            left: 0,
                                                            zIndex: 2,
                                                            background: rowBg,
                                                            borderBottom: '1px solid var(--border-subtle)',
                                                        }}
                                                    >
                                                        {s.employee_id}
                                                    </td>
                                                    <td
                                                        style={{
                                                            ...staffBodyCell,
                                                            width: STAFF_STICKY_W2,
                                                            minWidth: STAFF_STICKY_W2,
                                                            fontWeight: 500,
                                                            color: 'var(--text-primary)',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            position: 'sticky',
                                                            left: STAFF_STICKY_W1,
                                                            zIndex: 2,
                                                            background: rowBg,
                                                            borderBottom: '1px solid var(--border-subtle)',
                                                        }}
                                                    >
                                                        {s.first_name}
                                                    </td>
                                                    <td
                                                        style={{
                                                            ...staffBodyCell,
                                                            width: STAFF_STICKY_W3,
                                                            minWidth: STAFF_STICKY_W3,
                                                            fontWeight: 600,
                                                            color: 'var(--text-primary)',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            position: 'sticky',
                                                            left: STAFF_STICKY_W1 + STAFF_STICKY_W2,
                                                            zIndex: 2,
                                                            background: rowBg,
                                                            boxShadow: '4px 0 10px -4px rgba(15, 23, 42, 0.1)',
                                                            borderBottom: '1px solid var(--border-subtle)',
                                                        }}
                                                    >
                                                        {s.last_name}
                                                    </td>
                                                    <td style={{ ...staffBodyCell, minWidth: 220, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, background: rowBg, borderBottom: '1px solid var(--border-subtle)' }}>
                                                        {s.email}
                                                    </td>
                                                    <td style={{ ...staffBodyCell, minWidth: 130, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: rowBg, borderBottom: '1px solid var(--border-subtle)' }}>
                                                        {s.job_title}
                                                    </td>
                                                    <td style={{ ...staffBodyCell, minWidth: 160, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: rowBg, borderBottom: '1px solid var(--border-subtle)' }}>
                                                        {s.dept}
                                                    </td>
                                                    <td style={{ ...staffBodyCell, minWidth: 140, background: rowBg, borderBottom: '1px solid var(--border-subtle)' }}>
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px 3px 6px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.patient_access ? 'rgba(34,139,34,0.08)' : 'rgba(120,120,120,0.08)', color: s.patient_access ? '#2d8a4e' : '#888', border: `1px solid ${s.patient_access ? 'rgba(34,139,34,0.18)' : 'rgba(120,120,120,0.15)'}` }}>
                                                            <span className="material-icons-round" style={{ fontSize: 13 }}>{s.patient_access ? 'verified_user' : 'shield'}</span>
                                                            {s.patient_access ? 'Granted' : 'None'}
                                                        </div>
                                                    </td>
                                                    <td style={{ ...staffBodyCell, minWidth: 88, background: rowBg, borderBottom: '1px solid var(--border-subtle)' }}>
                                                        <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                                                    </td>
                                                    <td style={{ ...staffBodyCell, width: 44, minWidth: 44, textAlign: 'center', background: rowBg, borderBottom: '1px solid var(--border-subtle)' }}>
                                                        <button className="btn btn-ghost btn-xs" onClick={e => { e.stopPropagation(); handleRemove(s.id); }}>
                                                            <span className="material-icons-round" style={{ fontSize: 14, color: 'var(--text-muted)' }}>delete</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)' }}>
                                {loading ? 'Loading staff...' : (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                        <span>
                                            Showing {filtered.length === 0 ? 0 : (staffPage - 1) * staffPageSize + 1}
                                            -
                                            {Math.min(staffPage * staffPageSize, filtered.length)} of {filtered.length}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <button className="btn btn-secondary btn-xs" disabled={staffPage <= 1} onClick={() => setStaffPage(p => Math.max(1, p - 1))}>
                                                Prev
                                            </button>
                                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Page {staffPage} / {staffTotalPages}</span>
                                            <button className="btn btn-secondary btn-xs" disabled={staffPage >= staffTotalPages} onClick={() => setStaffPage(p => Math.min(staffTotalPages, p + 1))}>
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Detail Panel */}
                        {selected && (
                            <div className="slide-in-right" style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, alignSelf: 'start' }}>
                                <div className="card" style={{ padding: '20px 22px', overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 8 }}>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <h3 style={{ fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.first_name} {selected.last_name}</h3>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.job_title} · {selected.dept}</div>
                                        </div>
                                        <button className="btn btn-ghost btn-xs" style={{ flexShrink: 0 }} onClick={() => { setEditingSelected(false); setSelected(null); }}>
                                            <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                            Profile Details
                                        </div>
                                        <button
                                            className="btn btn-secondary btn-xs"
                                            onClick={() => setEditingSelected(v => !v)}
                                            disabled={savingEdit}
                                        >
                                            <span className="material-icons-round" style={{ fontSize: 14 }}>{editingSelected ? 'close' : 'edit'}</span>
                                            {editingSelected ? 'Cancel Edit' : 'Edit'}
                                        </button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px 14px' }}>
                                        <div style={{ minWidth: 0 }}>
                                            <label className="label">First Name</label>
                                            <input className="input" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} disabled={!editingSelected || savingEdit} style={{ fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <label className="label">Middle Name (Optional)</label>
                                            <input className="input" value={editMiddleName} onChange={e => setEditMiddleName(e.target.value)} disabled={!editingSelected || savingEdit} style={{ fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <label className="label">Last Name</label>
                                            <input className="input" value={editLastName} onChange={e => setEditLastName(e.target.value)} disabled={!editingSelected || savingEdit} style={{ fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
                                        </div>
                                        <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
                                            <label className="label">Email</label>
                                            <input className="input" value={editEmail} onChange={e => setEditEmail(e.target.value)} disabled={true} style={{ fontSize: 12, width: '100%', boxSizing: 'border-box', textOverflow: 'ellipsis' }} />
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <label className="label">Phone</label>
                                            <input className="input" value={editPhone} onChange={e => setEditPhone(formatGhanaPhoneInput(e.target.value))} disabled={!editingSelected || savingEdit} style={{ fontSize: 12, width: '100%', boxSizing: 'border-box', textOverflow: 'ellipsis' }} />
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <label className="label">DOB</label>
                                            <DatePicker
                                                value={editDob}
                                                onChange={setEditDob}
                                                placeholder="Select DOB"
                                                disabled={!editingSelected || savingEdit}
                                            />
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <label className="label">Gender</label>
                                            <div style={{ opacity: !editingSelected || savingEdit ? 0.65 : 1, pointerEvents: !editingSelected || savingEdit ? 'none' : 'auto' }}>
                                                <CustomSelect
                                                    value={editGender}
                                                    onChange={v => setEditGender(v)}
                                                    options={[
                                                        { label: 'Male', value: 'male' },
                                                        { label: 'Female', value: 'female' },
                                                        { label: 'Other', value: 'other' },
                                                    ]}
                                                    placeholder="-- Select --"
                                                />
                                            </div>
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <label className="label">Department</label>
                                            <div style={{ opacity: !editingSelected || savingEdit ? 0.65 : 1, pointerEvents: !editingSelected || savingEdit ? 'none' : 'auto' }}>
                                                <CustomSelect
                                                    value={editDept}
                                                    onChange={setEditDept}
                                                    options={departmentOptions
                                                        .map(d => ({ label: d, value: d }))}
                                                    placeholder="-- Select Department --"
                                                />
                                            </div>
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <label className="label">Title</label>
                                            <div style={{ opacity: !editingSelected || savingEdit ? 0.65 : 1, pointerEvents: !editingSelected || savingEdit ? 'none' : 'auto' }}>
                                                <CustomSelect
                                                    value={editJobTitle}
                                                    onChange={setEditJobTitle}
                                                    options={STAFF_TITLE_OPTIONS.map(t => ({ label: t, value: t }))}
                                                    placeholder="-- Select Title --"
                                                    allowCustom
                                                    customPlaceholder="Type title and press Enter"
                                                />
                                            </div>
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <label className="label">Highest Qualification</label>
                                            <div style={{ opacity: !editingSelected || savingEdit ? 0.65 : 1, pointerEvents: !editingSelected || savingEdit ? 'none' : 'auto' }}>
                                                <CustomSelect
                                                    value={editHighestQualification}
                                                    onChange={setEditHighestQualification}
                                                    options={QUALIFICATION_OPTIONS.map(q => ({ label: q, value: q }))}
                                                    placeholder="-- Select Qualification --"
                                                    allowCustom
                                                    customPlaceholder="Type qualification and press Enter"
                                                />
                                            </div>
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <label className="label">Is Doctor</label>
                                            <div style={{ opacity: !editingSelected || savingEdit ? 0.65 : 1, pointerEvents: !editingSelected || savingEdit ? 'none' : 'auto' }}>
                                                <CustomSelect
                                                    value={editIsDoctor}
                                                    onChange={v => setEditIsDoctor((v === 'dr' ? 'dr' : 'other'))}
                                                    options={[
                                                        { label: 'Dr.', value: 'dr' },
                                                        { label: 'Other', value: 'other' },
                                                    ]}
                                                    placeholder="-- Select --"
                                                />
                                            </div>
                                        </div>
                                        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, gap: 8 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                                <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--text-disabled)', flexShrink: 0 }}>fingerprint</span>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Employee ID</div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.employee_id}</div>
                                                </div>
                                            </div>
                                            {editingSelected && (
                                                <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={handleSaveSelected} disabled={savingEdit}>
                                                    <span className="material-icons-round" style={{ fontSize: 14 }}>{savingEdit ? 'hourglass_empty' : 'save'}</span>
                                                    {savingEdit ? 'Saving...' : 'Save Changes'}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Patient Access - toggleable */}
                                    <div style={{ marginTop: 6, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: selected.patient_access ? 'rgba(34,139,34,0.05)' : 'rgba(120,120,120,0.04)', border: `1px solid ${selected.patient_access ? 'rgba(34,139,34,0.15)' : 'rgba(120,120,120,0.12)'}`, transition: 'all 0.2s' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span className="material-icons-round" style={{ fontSize: 18, color: selected.patient_access ? '#2d8a4e' : '#999' }}>{selected.patient_access ? 'verified_user' : 'shield'}</span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: selected.patient_access ? '#2d8a4e' : '#888' }}>Patient Records Access</div>
                                                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>{selected.patient_access ? 'Can view and manage patient records.' : 'No access to patient records.'}</div>
                                            </div>
                                            <button type="button" onClick={() => togglePatientAccess(selected.id, selected.patient_access)}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 14, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em', cursor: 'pointer', transition: 'all 0.15s', border: `1px solid ${selected.patient_access ? 'rgba(34,139,34,0.25)' : 'rgba(120,120,120,0.2)'}`, background: selected.patient_access ? 'rgba(34,139,34,0.12)' : 'rgba(120,120,120,0.1)', color: selected.patient_access ? '#2d8a4e' : '#888' }}
                                                onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
                                                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                                            >
                                                <span className="material-icons-round" style={{ fontSize: 12 }}>{selected.patient_access ? 'toggle_on' : 'toggle_off'}</span>
                                                {selected.patient_access ? 'GRANTED' : 'NONE'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* System Role */}
                                <div className="card" style={{ padding: '18px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span className="material-icons-round" style={{ fontSize: 15, color: 'var(--text-muted)' }}>admin_panel_settings</span>
                                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>System Role</span>
                                        </div>
                                        <span style={{
                                            fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', padding: '2px 8px', borderRadius: 10,
                                            background: selected.role === 'admin' ? 'rgba(99,102,241,0.1)' : 'rgba(34,139,34,0.08)',
                                            color: selected.role === 'admin' ? 'var(--helix-primary)' : '#2d8a4e',
                                        }}>
                                            {selected.role === 'admin' ? 'ADMIN' : 'STAFF'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 3, gap: 2 }}>
                                        {(['staff', 'admin'] as const).map(r => {
                                            const isActive = selected.role === r;
                                            const isAdmin = r === 'admin';
                                            return (
                                                <button
                                                    key={r}
                                                    type="button"
                                                    onClick={() => { if (!isActive) assignRole(selected.id, r); }}
                                                    style={{
                                                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                        padding: '7px 0', borderRadius: 6, fontSize: 12, fontWeight: isActive ? 600 : 500,
                                                        border: 'none', cursor: isActive ? 'default' : 'pointer',
                                                        background: isActive ? 'var(--surface-card)' : 'transparent',
                                                        color: isActive ? (isAdmin ? 'var(--helix-primary)' : '#2d8a4e') : 'var(--text-muted)',
                                                        boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                                        transition: 'all 0.18s ease',
                                                    }}
                                                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-primary)'; }}
                                                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-muted)'; }}
                                                >
                                                    <span className="material-icons-round" style={{ fontSize: 14 }}>
                                                        {isAdmin ? 'shield' : 'person'}
                                                    </span>
                                                    {isAdmin ? 'Admin' : 'Staff'}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.4 }}>
                                        {selected.role === 'admin'
                                            ? 'Full access to manage staff, roles, and system settings.'
                                            : 'Standard access based on assigned clinical roles.'}
                                    </div>
                                </div>

                                <div className="card" style={{ padding: '18px' }}>
                                    <h3 style={{ fontSize: 14, marginBottom: 10 }}>Actions</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => showToast('Password reset email sent')}>
                                            <span className="material-icons-round" style={{ fontSize: 15 }}>lock_reset</span>Reset Password
                                        </button>
                                        <button className={`btn ${selected.status === 'active' ? 'btn-danger' : 'btn-secondary'} btn-sm`} style={{ justifyContent: 'flex-start' }} onClick={() => { toggleStatus(selected.id); setSelected(prev => prev ? { ...prev, status: prev.status === 'active' ? 'disabled' : 'active' } : null); }}>
                                            <span className="material-icons-round" style={{ fontSize: 15 }}>{selected.status === 'active' ? 'block' : 'check_circle'}</span>
                                            {selected.status === 'active' ? 'Disable Account' : 'Enable Account'}
                                        </button>
                                        <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => { handleRemove(selected.id); }}>
                                            <span className="material-icons-round" style={{ fontSize: 15 }}>delete</span>Remove Staff
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
                ) : (
                /* Bulk Import Tab */
                <main style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '20px 24px', background: 'var(--bg-900)' }}>
                    <p className="fade-in" style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                        Upload a CSV or Excel file (.xlsx, .xls). Download the CSV template for column order.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: 20, marginBottom: 24 }}>
                        <div className="fade-in delay-1 card">
                            <h3 style={{ marginBottom: 14 }}>Upload Staff File</h3>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                style={{ display: 'none' }}
                                onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) setUploadedFile(file);
                                }}
                            />
                            <div
                                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={e => {
                                    e.preventDefault();
                                    setDragOver(false);
                                    const file = e.dataTransfer.files?.[0];
                                    if (file) setUploadedFile(file);
                                }}
                                onClick={() => fileInputRef.current?.click()}
                                style={{ border: `2px dashed ${dragOver ? 'var(--helix-primary)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-lg)', padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(30,58,95,0.05)' : 'var(--surface-2)', transition: 'all 0.2s' }}>
                                <div style={{ width: 52, height: 52, background: uploadedFile ? 'var(--success-bg)' : 'rgba(30,58,95,0.1)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                                    <span className="material-icons-round" style={{ fontSize: 26, color: uploadedFile ? 'var(--success)' : 'var(--helix-primary-light)' }}>{uploadedFile ? 'check_circle' : 'cloud_upload'}</span>
                                </div>
                                {uploadedFile ? (
                                    <><div style={{ fontWeight: 600, color: 'var(--success)' }}>{uploadedFile.name}</div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>File ready for import</div></>
                                ) : (
                                    <><div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Click to upload or drag and drop</div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>CSV, XLSX or XLS (max. 50MB)</div></>
                                )}
                            </div>
                            {uploadedFile && (
                                <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                                    <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={processing} onClick={handleBulkImport}>
                                        <span className="material-icons-round" style={{ fontSize: 16 }}>{processing ? 'hourglass_empty' : 'upload'}</span>{processing ? 'Processing...' : 'Process Import'}
                                    </button>
                                    <button className="btn btn-secondary btn-sm" onClick={clearUploadedFile}><span className="material-icons-round" style={{ fontSize: 16 }}>close</span></button>
                                </div>
                            )}
                        </div>

                        <div className="fade-in delay-2 card">
                            <h3 style={{ marginBottom: 14 }}>Download Template</h3>
                            {[
                                {
                                    icon: 'badge',
                                    label: 'latest_bulk_upload.csv',
                                    desc: 'email, first_name, last_name, job_title, middle_name, phone, dob, gender, department_id, patient_access, employee_id, highest_qualifications, is_doctor',
                                    color: '#4a6fa5',
                                    href: '/templates/latest_bulk_upload.csv',
                                    downloadName: 'latest_bulk_upload.csv',
                                },
                            ].map(t => (
                                <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: 8, cursor: 'pointer', background: 'var(--surface-2)' }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 9, background: `${t.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span className="material-icons-round" style={{ fontSize: 18, color: t.color }}>{t.icon}</span>
                                    </div>
                                    <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{t.label}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.desc}</div></div>
                                    <a
                                        className="btn btn-ghost btn-xs"
                                        href={t.href}
                                        download={t.downloadName}
                                        onClick={() => showToast(`${t.downloadName} downloaded`)}
                                    >
                                        <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--text-muted)' }}>download</span>
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>

                    {bulkResultCreated.length > 0 && (
                        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
                            <div>
                                <h3 style={{ marginBottom: 12, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                                    Created staff ({bulkResultCreated.length})
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {bulkResultCreated.map((raw, idx) => {
                                        const { name, email, meta } = summarizeBulkCreatedEntry(raw);
                                        return (
                                            <div
                                                key={`created-${idx}-${email || name}`}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: 12,
                                                    padding: '14px 16px',
                                                    borderRadius: 'var(--radius-lg)',
                                                    background: 'var(--surface-card)',
                                                    border: '1px solid var(--border-subtle)',
                                                    borderLeft: '4px solid var(--success)',
                                                    boxShadow: 'var(--shadow-soft)',
                                                }}
                                            >
                                                <span className="material-icons-round" style={{ fontSize: 22, color: 'var(--success)', flexShrink: 0, marginTop: 1 }} aria-hidden>
                                                    person_add
                                                </span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{name}</div>
                                                    {email ? (
                                                        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{email}</div>
                                                    ) : null}
                                                    {meta ? (
                                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{meta}</div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="fade-in delay-3 card">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                            <h3 style={{ margin: 0 }}>Import history</h3>
                            <span
                                title="This page only shows staff bulk imports"
                                style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: '6px 12px',
                                    borderRadius: 8,
                                    textTransform: 'capitalize',
                                    color: '#fff',
                                    background: 'var(--helix-primary)',
                                    border: '1px solid var(--helix-primary)',
                                    userSelect: 'none',
                                    pointerEvents: 'none',
                                }}
                            >
                                Staff
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {bulkHistoryLoading && (
                                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                                    Loading history…
                                </div>
                            )}
                            {!bulkHistoryLoading && bulkHistory.length === 0 && (
                                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                                    No staff imports found.
                                </div>
                            )}
                            {!bulkHistoryLoading &&
                                bulkHistory.map(h => (
                                    <div
                                        key={h.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 14,
                                            padding: '12px 14px',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'var(--surface-2)',
                                            border: '1px solid var(--border-subtle)',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: 9,
                                                flexShrink: 0,
                                                background: h.status === 'success' ? 'var(--success-bg)' : 'var(--error-bg)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <span
                                                className="material-icons-round"
                                                style={{ fontSize: 18, color: h.status === 'success' ? 'var(--success)' : 'var(--error)' }}
                                            >
                                                {h.status === 'success' ? 'check_circle' : 'error'}
                                            </span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: 13, wordBreak: 'break-word' }}>{h.file}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                                                {h.records} records · {h.date} · {h.user}
                                            </div>
                                        </div>
                                        {h.warnings > 0 && <span className="badge badge-warning">{h.warnings} warnings</span>}
                                    </div>
                                ))}
                        </div>
                    </div>
                </main>
                )}
            </div>
        </>
    );
}
