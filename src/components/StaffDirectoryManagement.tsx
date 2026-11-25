'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import TopBar from '@/components/TopBar';
import CustomSelect from '@/components/CustomSelect';
import DatePicker from '@/components/DatePicker';
import { parseBulkUploadHistoryResponse, type BulkUploadHistoryEntry } from '@/lib/bulk-upload-history';
import ImportHistoryLedger from '@/components/ImportHistoryLedger';
import './staff-bulk-import.css';
import '@/components/glass/glass-page.css';
import '@/components/glass/staff-glass.css';
import '@/components/glass/staff-tabs-glass.css';
import { MacVibrancyToast, MacVibrancyToastPortal } from '@/components/MacVibrancyToast';
import { BulkImportErrorsSheet } from '@/components/BulkImportErrorsSheet';
import { readCachedJson, writeCachedJson } from '@/lib/getJsonCache';
import { useFacilityPresence } from '@/lib/useFacilityPresence';
import { formatLastSeenAgo, looksLikeEmployeeId, pickEmployeeIdFromRecord, staffLastSeenMs } from '@/lib/presence-store';
import { API_ENDPOINTS } from '@/lib/config';
import {
    sendStaffInviteEmails,
    type StaffInviteEmailError,
} from '@/lib/staff-invite-emails';
import { bulkImportToastHeadline } from '@/lib/bulk-import-toast';
import { fetchAllStaffPayload, STAFF_CACHE_LIST_KEY } from '@/lib/fetch-all-staff';
import {
    appendFacilityIdToProxyUrl,
    clearClientFacilityIdCache,
    getCachedClientFacilityId,
    isClientInternalSupportMode,
    readClientSupportModeFromDocument,
    readHelixFacilityIdFromDocument,
    resolveClientFacilityId,
} from '@/lib/facility-client';
import { fetchLoggedOutMatchKeys, isStaffLoggedOut } from '@/lib/logged-out-users';
import JoinRequestsPanel, { fetchPendingJoinCount } from '@/components/staff/JoinRequestsPanel';
import DirectoryReportsPanel, { fetchOpenDirectoryReportCount } from '@/components/staff/DirectoryReportsPanel';
import DirectoryReviewsPanel, { fetchOpenDirectoryReviewCount } from '@/components/staff/DirectoryReviewsPanel';
import { parseBulkNeedsReviewCount } from '@/lib/directory-reviews';
import { pickStaffPhotoUrl } from '@/lib/staff-photo';
import { parseCareUnits, type CareUnit } from '@/lib/care-units';
import AddStaffForm from '@/components/staff/AddStaffForm';

const STAFF_PAGE_CACHE_TTL_MS = 120_000;
const STAFF_CACHE_LIST = STAFF_CACHE_LIST_KEY;
const STAFF_CACHE_DEPTS = '/api/proxy/departments';

const STAFF_PASSWORD_RESET_ENABLED = true;

/** Appends ?facility_id= only for internal act-as; tenant admins use session-scoped proxy auth. */
function staffUrl(path: string): string {
    if (!readClientSupportModeFromDocument()) return path;
    const fid = getCachedClientFacilityId() || readHelixFacilityIdFromDocument();
    return appendFacilityIdToProxyUrl(path, fid);
}
/** Honorific / additional title (Dr, Prof, Consultant …). Aligned with settings job title. */
const STAFF_CREATE_TITLE_MAX_LEN = 50;

type StaffMember = {
    id: string;
    /** Auth / directory user id when different from staff row `id` (used for presence matching). */
    user_id?: string;
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
    /** Login username — used for presence matching, not shown as employee ID. */
    username?: string;
    /** Presence last seen from staff list API (`last_seen` field only). */
    last_seen?: string;
    /** First/last successful sign-in from the API (active + empty ⇒ set up, never signed in). */
    last_login_at?: string;
    /** How the person entered the facility directory. */
    source?: 'admin_created' | 'directory' | 'self_join';
    patient_access: boolean;
    /** When true, this staff member can manage schedules. */
    is_scheduler: boolean;
    role: 'staff' | 'admin';
    phone?: string;
    dob?: string;
    gender?: string;
    title?: string;
    /** Honorific / prefix title (e.g. Dr, Prof) — stored as additional_title in the API. */
    additional_title?: string;
    highest_qualification?: string;
    is_doctor?: boolean;
    /** When the backend sends the Helix / clinical role this user is currently signed into. */
    signed_in_role_name?: string;
    /** YYYY-MM-DD — date when staff access expires (optional, omit for indefinite). */
    account_expires_on?: string;
    /** ISO timestamp — when the account was actually expired by the system. */
    account_expired_at?: string;
    /** Profile picture URL, same field (and fallbacks) the leaderboard reads; used as-is. */
    profile_url?: string;
};

type SortKey = 'first_name' | 'last_name' | 'employee_id' | 'dept' | 'job_title' | 'status' | 'last_seen' | 'response_order';
type ColumnSortKey = Exclude<SortKey, 'response_order' | 'last_seen'>;
type ImportStatus = 'success' | 'error';

/** Parse `last_name-asc` style values (keys may contain `_`). */
function parseSortControlValue(v: string): { key: SortKey; dir: 'asc' | 'desc' } {
    const m = v.match(/^(.*)-(asc|desc)$/);
    if (!m) return { key: 'response_order', dir: 'asc' };
    return { key: m[1] as SortKey, dir: m[2] as 'asc' | 'desc' };
}

type StaffToastVariant = 'success' | 'error' | 'info';
type StaffTab = 'directory' | 'import' | 'join' | 'reports' | 'review';
/** Temporarily hide join-code / join-requests admin UI on Staff. Flip to true to restore. */
const SHOW_JOIN_REQUESTS_UI = true;
const SHOW_DIRECTORY_REPORTS_UI = true;
const SHOW_DIRECTORY_REVIEW_UI = true;
type StaffToastState = {
    message: string;
    variant: StaffToastVariant;
    opaque?: boolean;
    details?: string[];
    wide?: boolean;
};

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

const STAFF_PHONE_KEYS = [
    'phone',
    'phone_number',
    'mobile',
    'mobile_phone',
    'cell',
    'cell_phone',
    'contact_number',
    'contact_phone',
    'telephone',
    'tel',
] as const;

/** Directory list/detail: email may live on nested `user` / profile objects. */
function pickStaffEmail(r: Record<string, unknown>): string {
    const userRec = asRecord(r.user);
    const userEmail = userRec
        ? String(userRec.email || userRec.work_email || userRec.contact_email || '').trim()
        : '';
    if (userEmail) return userEmail;
    const top = String(r.email || r.work_email || r.contact_email || r.primary_email || '').trim();
    if (top) return top;
    for (const k of STAFF_DEPT_NEST_KEYS) {
        if (k === 'user') continue;
        const n = asRecord(r[k]);
        if (!n) continue;
        const nested = String(n.email || n.work_email || n.contact_email || '').trim();
        if (nested) return nested;
    }
    return '';
}

function pickStaffPhone(r: Record<string, unknown>): string {
    for (const k of STAFF_PHONE_KEYS) {
        const v = String(r[k] || '').trim();
        if (v) return v;
    }
    for (const nest of STAFF_DEPT_NEST_KEYS) {
        const n = asRecord(r[nest]);
        if (!n) continue;
        for (const k of STAFF_PHONE_KEYS) {
            const v = String(n[k] || '').trim();
            if (v) return v;
        }
    }
    return '';
}

/** Match UUID-shaped strings some APIs put in `department` instead of a nested object. */
const DEPT_ID_STRING_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET list (and some PUT bodies) often omit phone/email. Merging the refreshed row into the
 * open detail panel must not wipe contact fields the user already had loaded.
 */
function isUuidLike(value: string): boolean {
    return DEPT_ID_STRING_RE.test(value.trim());
}

function displayableEmployeeId(employeeId: string): string {
    const v = (employeeId || '').trim();
    if (!v || isUuidLike(v)) return '';
    return v;
}

/** parseStaffList uses row `id` when employee_id is omitted — treat that as "missing". */
function pickEmployeeId(prev: StaffMember, fromApi: StaffMember): string {
    const from = (fromApi.employee_id || '').trim();
    const prior = (prev.employee_id || '').trim();
    if (from && looksLikeEmployeeId(from) && from !== fromApi.id) return from;
    if (prior && looksLikeEmployeeId(prior)) return prior;
    return '';
}

/** One face in the Total staff stack: profile picture when it loads, initials otherwise. */
function StaffStackFace({ member }: { member: StaffMember }) {
    const [failed, setFailed] = useState(false);
    const name = [member.first_name, member.last_name].filter(Boolean).join(' ').trim() || 'Staff member';
    const initials = `${(member.first_name || '').trim().charAt(0)}${(member.last_name || '').trim().charAt(0)}`.toUpperCase() || '?';
    const url = member.profile_url && !failed ? member.profile_url : '';
    return (
        <span className="sx-faces__face" data-name={name} role={url ? undefined : 'img'} aria-label={url ? undefined : name}>
            {url ? (
                <img
                    className="sx-faces__img"
                    src={url}
                    alt={name}
                    width={32}
                    height={32}
                    loading="lazy"
                    decoding="async"
                    onError={() => setFailed(true)}
                />
            ) : initials}
        </span>
    );
}

/** Header sort affordance: blue arrow when this column sorts the list, faint hint on hover otherwise. */
function renderSortMark(active: boolean, dir: 'asc' | 'desc') {
    return (
        <span className={`sx-sort${active ? ' is-active' : ''}`} aria-hidden>
            <span className="material-icons-round">{active ? (dir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}</span>
        </span>
    );
}

function renderEmployeeIdCell(employeeId: string) {
    if (employeeId) return employeeId;
    return (
        <span
            title="No employee ID on file for this staff member"
            style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontWeight: 500 }}
        >
            Not assigned
        </span>
    );
}

function mergeStaffListRowIntoDetail(prev: StaffMember, fromList: StaffMember): StaffMember {
    const email = (fromList.email || '').trim() || (prev.email || '').trim();
    const phone = (fromList.phone || '').trim() || (prev.phone || '').trim();
    const signed =
        (fromList.signed_in_role_name || '').trim()
        || (prev.signed_in_role_name || '').trim()
        || undefined;
    const dept =
        (fromList.dept || '').trim() === 'Unassigned' && (prev.dept || '').trim()
            ? prev.dept
            : (fromList.dept || '').trim() || prev.dept;
    return {
        ...fromList,
        first_name: (fromList.first_name || '').trim() && fromList.first_name !== 'Unknown'
            ? fromList.first_name
            : prev.first_name,
        last_name: (fromList.last_name || '').trim() && fromList.last_name !== 'Staff'
            ? fromList.last_name
            : prev.last_name,
        job_title: (fromList.job_title || '').trim() && fromList.job_title !== 'Staff'
            ? fromList.job_title
            : prev.job_title,
        email,
        phone: phone || undefined,
        signed_in_role_name: signed,
        employee_id: pickEmployeeId(prev, fromList),
        additional_title: (fromList.additional_title || '').trim() || prev.additional_title,
        /** List payloads often omit qualification; keep the richer detail value. */
        highest_qualification: (fromList.highest_qualification || '').trim() || prev.highest_qualification,
        dept,
        department_id: (fromList.department_id || '').trim() || prev.department_id,
        profile_url: fromList.profile_url || prev.profile_url,
    };
}

/** Merge PUT/GET-by-id body into open detail without wiping list-only fields the API omitted. */
function mergeStaffPutResponse(prev: StaffMember, fromApi: StaffMember): StaffMember {
    return mergeStaffListRowIntoDetail(prev, fromApi);
}

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
            const userRec = asRecord(r.user);
            const userIdRaw = String(
                r.user_id
                || r.auth_user_id
                || r.account_user_id
                || r.helix_user_id
                || userRec?.id
                || userRec?.user_id
                || ''
            ).trim();
            const statusRaw = String(r.status || r.account_status || 'active').toLowerCase().trim();
            const normalizedStatus = normalizeStaffStatus(statusRaw);
            const sourceRaw = String(r.source || r.join_source || r.directory_source || '').toLowerCase().trim();
            const source = (['admin_created', 'directory', 'self_join'] as const).includes(
                sourceRaw as 'admin_created' | 'directory' | 'self_join',
            )
                ? (sourceRaw as 'admin_created' | 'directory' | 'self_join')
                : undefined;
            const deptSources = gatherStaffDeptSources(r);
            const { id: department_id, name: deptFromApi } = findDepartmentIdAndName(deptSources);
            return {
                id,
                user_id: userIdRaw || undefined,
                first_name: firstName,
                middle_name: String(r.middle_name || '').trim(),
                last_name: lastName,
                email: pickStaffEmail(r),
                job_title: String(r.job_title || r.role || 'Staff'),
                department_id,
                dept: deptFromApi,
                status: normalizedStatus,
                access: String(r.system_role || r.access || 'Staff'),
                employee_id: pickEmployeeIdFromRecord(r),
                username: String(r.username || '').trim() || undefined,
                last_seen: String(r.last_seen ?? '').trim() || undefined,
                last_login_at: String(r.last_login_at || r.lastLoginAt || '').trim() || undefined,
                profile_url: pickStaffPhotoUrl(r) || undefined,
                source,
                patient_access: Boolean(r.patient_access ?? r.can_access_patients ?? false),
                is_scheduler: Boolean(r.is_scheduler ?? r.scheduler ?? r.can_schedule ?? false),
                role: String(r.system_role || r.role || 'staff').toLowerCase().includes('admin') ? 'admin' as const : 'staff' as const,
                phone: pickStaffPhone(r),
                dob: String(r.dob || '').trim(),
                gender: String(r.gender || '').trim().toLowerCase(),
                title: String(r.title || r.job_title || '').trim(),
                additional_title: String(r.additional_title || r.title_prefix || '').trim() || undefined,
                highest_qualification: String(r.highest_qualifications || r.highest_qualification || r.qualification || '').trim(),
                is_doctor: Boolean(r.is_doctor ?? String(r.title_prefix || '').toLowerCase() === 'dr'),
                signed_in_role_name: (() => {
                    const activeRole = r.active_role;
                    const fromActiveRoleObject =
                        activeRole && typeof activeRole === 'object' && !Array.isArray(activeRole)
                            ? String(
                                (activeRole as Record<string, unknown>).name
                                ?? (activeRole as Record<string, unknown>).role_name
                                ?? (activeRole as Record<string, unknown>).title
                                ?? '',
                            ).trim() || undefined
                            : undefined;
                    const fromActiveRoleString =
                        typeof activeRole === 'string' ? String(activeRole).trim() || undefined : undefined;
                    const ur = userRec;
                    const fromUserRec = ur
                        ? (() => {
                            const uar = asRecord(ur.active_role ?? ur.activeRole);
                            return (
                                String(
                                    ur.signed_in_role_name
                                    || ur.signedInRoleName
                                    || ur.current_role_name
                                    || ur.currentRoleName
                                    || ur.active_role_name
                                    || ur.activeRoleName
                                    || ur.helix_role_name
                                    || ur.helixRoleName
                                    || ur.signed_into_role
                                    || ur.signedIntoRole
                                    || uar?.name
                                    || uar?.title
                                    || uar?.role_name
                                    || '',
                                ).trim() || undefined
                            );
                        })()
                        : undefined;
                    const v = r.active_role_name ?? r.signed_in_role_name ?? r.current_role_name ?? r.helix_role_name
                        ?? r.signed_into_role ?? r.active_helix_role ?? fromUserRec ?? fromActiveRoleObject ?? fromActiveRoleString;
                    if (v && typeof v === 'object' && !Array.isArray(v)) {
                        const o = v as Record<string, unknown>;
                        return String(o.name || o.role_name || o.title || '').trim() || undefined;
                    }
                    const s = String(v || '').trim();
                    return s || undefined;
                })(),
                account_expires_on: String(r.account_expires_on || '').trim() || undefined,
                account_expired_at: String(r.account_expired_at || '').trim() || undefined,
            };
        })
        .filter((s): s is StaffMember => Boolean(s));
}

function extractJsonArrayFromRecord(raw: unknown, keys: string[]): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== 'object') return [];
    const o = raw as Record<string, unknown>;
    for (const k of keys) {
        const v = o[k];
        if (Array.isArray(v)) return v;
    }
    return [];
}

function addLowerId(set: Set<string>, v: unknown) {
    if (v == null) return;
    const s = String(v).trim().toLowerCase();
    if (s) set.add(s);
}

/** Collect every id-like string on an active-role row the backend might use to tie a session to staff. */
function activeRoleRowStaffIdSet(r: Record<string, unknown>): Set<string> {
    const ids = new Set<string>();
    addLowerId(ids, r.staff_id);
    addLowerId(ids, r.staffId);
    addLowerId(ids, r.user_id);
    addLowerId(ids, r.userId);
    addLowerId(ids, r.account_id);
    addLowerId(ids, r.accountId);
    addLowerId(ids, r.signed_in_by);
    addLowerId(ids, r.signed_in_staff_id);
    addLowerId(ids, r.signedInStaffId);
    addLowerId(ids, r.member_id);
    addLowerId(ids, r.memberId);
    addLowerId(ids, r.employee_id);
    addLowerId(ids, r.employeeId);
    addLowerId(ids, r.username);
    addLowerId(ids, r.user_name);
    for (const key of ['signed_in_user', 'user', 'account', 'staff'] as const) {
        const raw = r[key];
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const o = raw as Record<string, unknown>;
        addLowerId(ids, o.id);
        addLowerId(ids, o.user_id);
        addLowerId(ids, o.userId);
        addLowerId(ids, o.staff_id);
        addLowerId(ids, o.staffId);
        addLowerId(ids, o.employee_id);
        addLowerId(ids, o.employeeId);
        addLowerId(ids, o.username);
        addLowerId(ids, o.email);
    }
    const assignee = asRecord(r.assigned_to ?? r.assignedTo ?? r.practitioner ?? r.member ?? r.assignee ?? r.assignee_staff);
    if (assignee) {
        addLowerId(ids, assignee.id);
        addLowerId(ids, assignee.user_id);
        addLowerId(ids, assignee.staff_id);
        addLowerId(ids, assignee.employee_id);
        addLowerId(ids, assignee.username);
        addLowerId(ids, assignee.email);
    }
    return ids;
}

function activeRoleRowDisplayName(r: Record<string, unknown>): string {
    const roleObj = asRecord(r.role);
    const helix = asRecord(r.helix_role ?? r.helixRole ?? r.active_role ?? r.activeRole);
    return String(
        r.role_name
        || r.roleName
        || r.role_title
        || r.roleTitle
        || r.display_name
        || r.displayName
        || r.helix_role_name
        || r.helixRoleName
        || r.signed_in_role_name
        || r.signedInRoleName
        || r.current_role_name
        || r.currentRoleName
        || (roleObj?.name ?? roleObj?.title ?? roleObj?.role_name ?? '')
        || (helix?.name ?? helix?.title ?? helix?.role_name ?? '')
        || r.name
        || r.title
        || '',
    ).trim();
}

/** Match GET /roles/active row to this staff member (ids, user, nested staff, email, username). */
function resolveHelixSignedInRoleName(activePayload: unknown, staff: StaffMember): string | null {
    const list = extractJsonArrayFromRecord(activePayload, [
        'items',
        'data',
        'roles',
        'active_roles',
        'activeRoles',
        'results',
        'records',
        'sessions',
        'assignments',
        'sign_ins',
        'signIns',
        'users',
        'active_role_sessions',
        'activeRoleSessions',
        'role_sessions',
        'roleSessions',
    ]);
    const staffIds = new Set<string>();
    for (const v of [staff.id, staff.user_id, staff.email, staff.employee_id]) {
        addLowerId(staffIds, v);
    }
    for (const row of list) {
        if (!row || typeof row !== 'object') continue;
        const r = row as Record<string, unknown>;
        const roleName = activeRoleRowDisplayName(r);
        if (!roleName) continue;
        const rowIds = activeRoleRowStaffIdSet(r);
        for (const sid of staffIds) {
            if (sid && rowIds.has(sid)) return roleName;
        }
        const suRaw = r.signed_in_user;
        const su = suRaw && typeof suRaw === 'object' && !Array.isArray(suRaw) ? suRaw as Record<string, unknown> : null;
        const suEmail = String(su?.email || '').trim().toLowerCase();
        const staffEmail = staff.email.trim().toLowerCase();
        if (staffEmail && suEmail && suEmail === staffEmail) return roleName;
    }
    return null;
}

function isStaffOnline(s: StaffMember, online: Set<string>): boolean {
    const candidates = [s.user_id, s.id, s.email, s.employee_id].filter(Boolean) as string[];
    return candidates.some(c => online.has(c.trim().toLowerCase()));
}

/** Clinical / professional rank presets (optional field); custom values allowed via CustomSelect. */
const STAFF_RANK_OPTIONS = [
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

/** Physician degrees / titles — used to set is_doctor from highest qualification (no separate form field). */
function isDoctorFromHighestQualification(raw: string): boolean {
    const trimmed = raw.trim();
    if (!trimmed) return false;
    const collapsed = trimmed.toLowerCase().replace(/[\s.]/g, '');
    if (collapsed === 'mbbs' || collapsed === 'md' || collapsed === 'mbchb') return true;
    const lower = trimmed.toLowerCase();
    if (/\bdoctor\s+of\s+medicine\b/.test(lower)) return true;
    if (/\b(mbbs|mbchb)\b/.test(lower)) return true;
    if (/\bmd\b/.test(lower)) return true;
    return false;
}

/** Canonical staff statuses (stop reading expired/revoked/registered/inactive). */
const STAFF_STATUSES = [
    'in_directory',
    'pending_approval',
    'not_invited',
    'invited',
    'invite_expired',
    'active',
    'suspended',
    'disabled',
] as const;

type StaffStatus = (typeof STAFF_STATUSES)[number];

function normalizeStaffStatus(raw: string): StaffStatus {
    const t = raw.trim().toLowerCase();
    // One-release alias from the old invite-expired key.
    if (t === 'expired') return 'invite_expired';
    if ((STAFF_STATUSES as readonly string[]).includes(t)) return t as StaffStatus;
    return 'active';
}

const statusColors: Record<StaffStatus, { color: string; bg: string; label: string }> = {
    in_directory: { color: '#475569', bg: '#f1f5f9', label: 'In directory' },
    pending_approval: { color: '#b45309', bg: '#fffbeb', label: 'Pending approval' },
    not_invited: { color: '#64748b', bg: '#f1f5f9', label: 'Not invited' },
    invited: { color: 'var(--info)', bg: 'var(--info-bg)', label: 'Invited' },
    invite_expired: { color: 'var(--warning)', bg: 'var(--warning-bg)', label: 'Invite expired' },
    active: { color: 'var(--success)', bg: 'var(--success-bg)', label: 'Active' },
    suspended: { color: '#b45309', bg: '#fffbeb', label: 'Suspended' },
    disabled: { color: 'var(--critical)', bg: 'var(--critical-bg)', label: 'Disabled' },
};

const SOURCE_LABELS: Record<NonNullable<StaffMember['source']>, string> = {
    admin_created: 'Admin created',
    directory: 'Directory',
    self_join: 'Self-join',
};

/** Invite-lifecycle statuses that may show send/revoke/push actions. */
const INVITE_ACTION_STATUSES = ['not_invited', 'invited', 'invite_expired'] as const;
const ADMIN_PATCHABLE_STATUSES = ['active', 'suspended', 'disabled'] as const;
const STATUS_FILTER_KEYS = ['all', ...STAFF_STATUSES] as const;

type InviteRowFlags = { can_reinvite?: boolean; can_revoke?: boolean; can_push?: boolean };
type InviteSummaryCounts = Partial<Record<(typeof STATUS_FILTER_KEYS)[number], number>>;

function isInviteLifecycleStatus(status: string): boolean {
    return (INVITE_ACTION_STATUSES as readonly string[]).includes(normalizeStaffStatus(status));
}

function isAdminPatchableStatus(status: string): boolean {
    return (ADMIN_PATCHABLE_STATUSES as readonly string[]).includes(normalizeStaffStatus(status));
}

function hasSignedIn(s: StaffMember): boolean {
    return Boolean((s.last_login_at || '').trim() || (s.last_seen || '').trim());
}

function statusBadgeStyle(status: string, member?: StaffMember): { color: string; bg: string; label: string } {
    const st = normalizeStaffStatus(status);
    const base = statusColors[st] || statusColors.active;
    if (st === 'active' && member && !hasSignedIn(member)) {
        return { ...base, label: 'Set up, never signed in' };
    }
    return base;
}

function parseInviteSummary(raw: unknown): InviteSummaryCounts {
    if (!raw || typeof raw !== 'object') return {};
    const root = raw as Record<string, unknown>;
    const summary = root.summary && typeof root.summary === 'object' && !Array.isArray(root.summary)
        ? (root.summary as Record<string, unknown>)
        : root;
    const out: InviteSummaryCounts = {};
    for (const key of STAFF_STATUSES) {
        let n = readNumber(summary[key]);
        // One-release: old `expired` repeats invite_expired — prefer invite_expired.
        if (key === 'invite_expired' && n <= 0) n = readNumber(summary.expired);
        if (n > 0) out[key] = n;
    }
    // Do not read revoked / registered / inactive (always 0 in the new model).
    const explicitAll = readNumber(summary.all ?? summary.total ?? root.total);
    out.all = explicitAll > 0
        ? explicitAll
        : STAFF_STATUSES.reduce((sum, k) => sum + (out[k] ?? 0), 0);
    return out;
}

function parseInviteFlagsByStaffId(raw: unknown): Map<string, InviteRowFlags> {
    const map = new Map<string, InviteRowFlags>();
    if (!raw || typeof raw !== 'object') return map;
    const root = raw as Record<string, unknown>;
    const list = Array.isArray(root.data)
        ? root.data
        : Array.isArray(root.items)
            ? root.items
            : [];
    for (const row of list) {
        if (!row || typeof row !== 'object') continue;
        const rec = row as Record<string, unknown>;
        const id = String(rec.staff_id || rec.id || rec.user_id || '').trim();
        if (!id) continue;
        map.set(id, {
            can_reinvite: rec.can_reinvite === undefined ? undefined : Boolean(rec.can_reinvite),
            can_revoke: rec.can_revoke === undefined ? undefined : Boolean(rec.can_revoke),
            can_push: rec.can_push === undefined ? undefined : Boolean(rec.can_push),
        });
    }
    return map;
}

function statusAllowsReinvite(status: string): boolean {
    const st = normalizeStaffStatus(status);
    return st === 'not_invited' || st === 'invited' || st === 'invite_expired';
}

function statusAllowsRevoke(status: string): boolean {
    const st = normalizeStaffStatus(status);
    return st === 'invited' || st === 'invite_expired';
}

function statusAllowsPush(status: string): boolean {
    const st = normalizeStaffStatus(status);
    return st === 'invited' || st === 'invite_expired';
}

/** Directory rows have no email — they join from the app with the facility code. */
function canSendStaffInviteEmail(s: StaffMember): boolean {
    const st = normalizeStaffStatus(s.status);
    if (st === 'in_directory') return false;
    if (!s.email?.trim()) return false;
    return statusAllowsReinvite(st);
}

function canReinviteStaff(s: StaffMember, flags?: InviteRowFlags): boolean {
    if (normalizeStaffStatus(s.status) === 'in_directory') return false;
    if (flags?.can_reinvite !== undefined) return flags.can_reinvite;
    return statusAllowsReinvite(s.status) && Boolean(s.email?.trim());
}

function canRevokeStaffInvite(s: StaffMember, flags?: InviteRowFlags): boolean {
    if (flags?.can_revoke !== undefined) return flags.can_revoke;
    return statusAllowsRevoke(s.status);
}

function canPushStaffInvite(s: StaffMember, flags?: InviteRowFlags): boolean {
    if (flags?.can_push !== undefined) return flags.can_push;
    return statusAllowsPush(s.status);
}

function inviteEmailTooltip(s: StaffMember): string {
    const st = normalizeStaffStatus(s.status);
    if (st === 'in_directory') return 'Directory people join from the app with the facility code — no invite email';
    if (!s.email?.trim()) return 'No email on file';
    if (st === 'active') return 'Account already activated';
    if (st === 'pending_approval') return 'Waiting for join approval';
    if (st === 'suspended') return 'Account suspended';
    if (st === 'disabled') return 'Account disabled';
    if (st === 'not_invited') return 'Send invite email';
    if (st === 'invite_expired') return 'Resend invite email (expired)';
    if (st === 'invited') return 'Resend invite email';
    return 'Send invite email';
}

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

function staffDisplayInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

function summarizeBulkCreatedEntry(raw: unknown): { name: string; email: string; job: string; idShort: string } {
    if (!raw || typeof raw !== 'object') {
        return { name: 'New staff', email: '', job: '', idShort: '' };
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
    const idShort = id ? (id.length > 10 ? `${id.slice(0, 8)}…` : id) : '';
    return { name, email, job, idShort };
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
const STAFF_STICKY_W2 = 168;
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

const staffDetailActionBtn: CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-start',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    padding: '9px 12px',
    fontFamily: 'inherit',
    cursor: 'pointer',
    border: '1px solid rgba(27, 42, 68, 0.07)',
    background: 'rgba(255, 255, 255, 0.95)',
    boxShadow: '0 1px 2px rgba(27, 42, 68, 0.04)',
    color: '#16213a',
};

const staffDetailActionBtnDanger: CSSProperties = {
    ...staffDetailActionBtn,
    background: 'rgba(194, 65, 75, 0.06)',
    border: '1px solid rgba(194, 65, 75, 0.12)',
    boxShadow: 'none',
    color: '#b42318',
};

function StaffDetailFieldRow({
    icon,
    label,
    value,
    copyable,
    onCopy,
}: {
    icon: string;
    label: string;
    value?: string | null;
    copyable?: boolean;
    onCopy?: (value: string) => void;
}) {
    const display = (value ?? '').trim() || '—';
    const canCopy = Boolean(copyable && display !== '—' && onCopy);
    return (
        <div className="staff-detail-field-row">
            <span className="material-icons-round staff-detail-field-icon" aria-hidden>
                {icon}
            </span>
            <span className="staff-detail-field-label">{label}</span>
            <span
                className="staff-detail-field-value"
                title={display === '—' ? undefined : display}
                style={canCopy ? { display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 } : undefined}
            >
                <span style={canCopy ? { overflow: 'hidden', textOverflow: 'ellipsis' } : undefined}>
                    {display}
                </span>
                {canCopy ? (
                    <button
                        type="button"
                        aria-label={`Copy ${label}`}
                        title={`Copy ${label}`}
                        onClick={() => onCopy?.(display)}
                        style={{
                            flexShrink: 0,
                            border: 'none',
                            background: '#F3F4F6',
                            color: '#6B7280',
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            padding: 0,
                        }}
                    >
                        <span className="material-icons-round" style={{ fontSize: 14 }}>content_copy</span>
                    </button>
                ) : null}
            </span>
        </div>
    );
}

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
    const [editDob, setEditDob] = useState('');
    const [editGender, setEditGender] = useState('');
    const [editJobTitle, setEditJobTitle] = useState('');
    const [editAdditionalTitle, setEditAdditionalTitle] = useState('');
    const [editHighestQualification, setEditHighestQualification] = useState('');
    const [editDept, setEditDept] = useState('');
    const [editEmployeeId, setEditEmployeeId] = useState('');
    const [editAccountExpiresOn, setEditAccountExpiresOn] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);
    const [activeTab, setActiveTab] = useState<StaffTab>('directory');
    const [pendingJoinCount, setPendingJoinCount] = useState(0);
    const [directoryReportCount, setDirectoryReportCount] = useState(0);
    const [directoryReviewCount, setDirectoryReviewCount] = useState(0);
    const [bulkNeedsReview, setBulkNeedsReview] = useState(0);
    useEffect(() => {
        if (!SHOW_JOIN_REQUESTS_UI) {
            setPendingJoinCount(0);
            return;
        }
        let cancelled = false;
        void fetchPendingJoinCount().then(count => { if (!cancelled) setPendingJoinCount(count); });
        return () => { cancelled = true; };
    }, []);
    useEffect(() => {
        if (!SHOW_DIRECTORY_REPORTS_UI) {
            setDirectoryReportCount(0);
            return;
        }
        let cancelled = false;
        void fetchOpenDirectoryReportCount().then(count => { if (!cancelled) setDirectoryReportCount(count); });
        return () => { cancelled = true; };
    }, []);
    useEffect(() => {
        if (!SHOW_DIRECTORY_REVIEW_UI) {
            setDirectoryReviewCount(0);
            return;
        }
        let cancelled = false;
        void fetchOpenDirectoryReviewCount().then(count => { if (!cancelled) setDirectoryReviewCount(count); });
        return () => { cancelled = true; };
    }, []);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newFirstName, setNewFirstName] = useState('');
    const [newMiddleName, setNewMiddleName] = useState('');
    const [newLastName, setNewLastName] = useState('');
    const [newDob, setNewDob] = useState('');
    const [newEmployeeId, setNewEmployeeId] = useState('');
    /** Same as bulk `can_manage_schedule` — null until the admin chooses. */
    const [newCanManageSchedule, setNewCanManageSchedule] = useState<boolean | null>(null);
    /** patient_access for POST /staff/directory — null until the admin chooses Allow or Block. */
    const [newPatientAccess, setNewPatientAccess] = useState<'yes' | 'no' | null>(null);
    /** Care unit id, `not_applicable`, or '' (not set). Same values as self-join workstations. */
    const [newPrimaryWorkstation, setNewPrimaryWorkstation] = useState('');
    const [careUnits, setCareUnits] = useState<CareUnit[] | null>(null);
    const [directoryConflict, setDirectoryConflict] = useState<{
        reviewId: string;
        kind: string;
        name: string;
        problem: string;
    } | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>('response_order');
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
    const [pendingDelete, setPendingDelete] = useState<StaffMember | null>(null);
    const [pendingRemoteWipe, setPendingRemoteWipe] = useState<StaffMember | null>(null);
    const [remoteWipePending, setRemoteWipePending] = useState(false);
    const [remoteWipeConfirmText, setRemoteWipeConfirmText] = useState('');
    const [pendingPasswordReset, setPendingPasswordReset] = useState<StaffMember | null>(null);
    const [passwordResetPending, setPasswordResetPending] = useState(false);
    const [pendingInviteSend, setPendingInviteSend] = useState<StaffMember | null>(null);
    const [pendingPhoneUpdate, setPendingPhoneUpdate] = useState(false);
    const [editingContactEmail, setEditingContactEmail] = useState(false);
    const [contactEmailDraft, setContactEmailDraft] = useState('');
    const [savingContactEmail, setSavingContactEmail] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [requestPhoneUpdatePending, setRequestPhoneUpdatePending] = useState(false);
    const [detailSignedInRole, setDetailSignedInRole] = useState<string | null>(null);
    const [detailSignedInRoleLoading, setDetailSignedInRoleLoading] = useState(false);
    const [adding, setAdding] = useState(false);
    const [sendingInvites, setSendingInvites] = useState(false);
    const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(() => new Set());
    const [inviteSendErrors, setInviteSendErrors] = useState<StaffInviteEmailError[]>([]);
    const [inviteSummary, setInviteSummary] = useState<InviteSummaryCounts>({});
    const [inviteFlagsByStaffId, setInviteFlagsByStaffId] = useState<Map<string, InviteRowFlags>>(() => new Map());
    const [inviteActionPending, setInviteActionPending] = useState(false);
    const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
    const [deptIdToName, setDeptIdToName] = useState<Map<string, string>>(() => new Map());
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const detailPanelRef = useRef<HTMLDivElement | null>(null);
    const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { onlineIdSet, lastSeenByKey } = useFacilityPresence({ enabled: activeTab === 'directory' });

    // The panel sits below the header card and toolbar, so a fixed viewport height runs off-screen.
    // Fit it to the space left below its top edge; once it sticks while scrolling it grows back.
    const selectedId = selected?.id;
    useEffect(() => {
        const panel = detailPanelRef.current;
        if (!panel || activeTab !== 'directory') return;
        const scroller = panel.closest('main');
        let frame = 0;
        const fit = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const top = Math.max(0, panel.getBoundingClientRect().top);
                const height = `${Math.max(320, window.innerHeight - top - 16)}px`;
                panel.style.height = height;
                panel.style.maxHeight = height;
            });
        };
        fit();
        scroller?.addEventListener('scroll', fit, { passive: true });
        window.addEventListener('resize', fit);
        return () => {
            cancelAnimationFrame(frame);
            scroller?.removeEventListener('scroll', fit);
            window.removeEventListener('resize', fit);
        };
    }, [selectedId, activeTab, showAddForm, editingSelected]);
    const [loggedOutKeys, setLoggedOutKeys] = useState<Set<string>>(() => new Set());
    /** Internal support mode only — drives the Logged out filter pill (and related column). */
    const [loggedOutFilterEnabled, setLoggedOutFilterEnabled] = useState(false);
    /** httpOnly support cookie is invisible to document.cookie — resolve via act-as API. */
    const [internalSupportMode, setInternalSupportMode] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const support = await isClientInternalSupportMode();
            if (!cancelled) setInternalSupportMode(support);
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (activeTab !== 'directory') return;
        let cancelled = false;
        void (async () => {
            const support = await isClientInternalSupportMode();
            if (!support || cancelled) {
                if (!cancelled) {
                    setLoggedOutKeys(new Set());
                    setLoggedOutFilterEnabled(false);
                }
                return;
            }
            const facilityId = await resolveClientFacilityId();
            if (!facilityId || cancelled) {
                if (!cancelled) {
                    setLoggedOutKeys(new Set());
                    setLoggedOutFilterEnabled(false);
                }
                return;
            }
            try {
                const keys = await fetchLoggedOutMatchKeys(facilityId);
                if (!cancelled) {
                    setLoggedOutKeys(keys);
                    setLoggedOutFilterEnabled(true);
                }
            } catch {
                if (!cancelled) {
                    setLoggedOutKeys(new Set());
                    setLoggedOutFilterEnabled(false);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [activeTab]);

    useEffect(() => {
        if (!loggedOutFilterEnabled && statusFilter === 'logged_out') {
            setStatusFilter('all');
        }
    }, [loggedOutFilterEnabled, statusFilter]);

    const dismissToast = useCallback(() => {
        if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current);
            toastTimeoutRef.current = null;
        }
        setToast(null);
    }, []);

    const showToast = useCallback(
        (message: string, variant: StaffToastVariant = 'info', opaque = false, details?: string[], wide = false) => {
            if (toastTimeoutRef.current) {
                clearTimeout(toastTimeoutRef.current);
            }
            setToast({ message, variant, opaque, details, wide: wide || Boolean(details?.length) });
            toastTimeoutRef.current = setTimeout(() => {
                toastTimeoutRef.current = null;
                setToast(null);
            }, 4000);
        },
        [],
    );

    useEffect(() => () => {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    }, []);

    const dismissBulkErrors = useCallback(() => {
        setBulkResultErrors([]);
    }, []);

    const cancelStaffEdit = useCallback(() => {
        setEditingSelected(false);
        if (!selected) return;
        setEditFirstName(selected.first_name || '');
        setEditMiddleName(selected.middle_name || '');
        setEditLastName(selected.last_name || '');
        setEditEmail(selected.email || '');
        setEditDob(selected.dob || '');
        setEditGender(selected.gender || '');
        setEditJobTitle(selected.title || selected.job_title || '');
        setEditAdditionalTitle(selected.additional_title || '');
        setEditHighestQualification(selected.highest_qualification || '');
        setEditDept(selected.dept || '');
        setEditEmployeeId(displayableEmployeeId(selected.employee_id));
        setEditAccountExpiresOn(selected.account_expires_on || '');
    }, [selected]);

    const dismissInviteSendErrors = useCallback(() => {
        setInviteSendErrors([]);
    }, []);

    const toggleStaffRowSelected = useCallback((id: string, checked: boolean) => {
        setSelectedStaffIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (pendingRemoteWipe) {
                setPendingRemoteWipe(null);
                setRemoteWipeConfirmText('');
            } else if (pendingPasswordReset) {
                setPendingPasswordReset(null);
            } else if (pendingDelete) {
                setPendingDelete(null);
            } else if (pendingInviteSend) {
                setPendingInviteSend(null);
            } else if (pendingPhoneUpdate) {
                setPendingPhoneUpdate(false);
            } else if (bulkResultErrors.length > 0) {
                dismissBulkErrors();
            } else if (inviteSendErrors.length > 0) {
                dismissInviteSendErrors();
            } else if (toast) {
                dismissToast();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [toast, dismissToast, bulkResultErrors.length, dismissBulkErrors, inviteSendErrors.length, dismissInviteSendErrors, pendingRemoteWipe, pendingPasswordReset, pendingDelete, pendingInviteSend, pendingPhoneUpdate]);

    useEffect(() => {
        if (!selected) {
            setDetailSignedInRole(null);
            setDetailSignedInRoleLoading(false);
            return;
        }
        let canceled = false;
        setDetailSignedInRoleLoading(true);
        const fromList = selected.signed_in_role_name?.trim() || null;
        if (fromList) setDetailSignedInRole(fromList);
        else setDetailSignedInRole(null);
        void (async () => {
            try {
                const res = await fetch('/api/proxy/roles/active', { credentials: 'include' });
                const data = await res.json().catch(() => ({}));
                if (canceled) return;
                const resolvedApi = resolveHelixSignedInRoleName(data, selected);
                const trimmed = (resolvedApi || '').trim();
                const merged = trimmed || fromList || null;
                setDetailSignedInRole(merged);
            } catch {
                if (!canceled) setDetailSignedInRole(fromList);
            } finally {
                if (!canceled) setDetailSignedInRoleLoading(false);
            }
        })();
        return () => { canceled = true; };
    }, [selected]);

    const departments = useMemo(() => ['all', ...departmentOptions], [departmentOptions]);
    const deptNameToId = useMemo(() => {
        const m = new Map<string, string>();
        deptIdToName.forEach((name, id) => {
            m.set(name.trim().toLowerCase(), id);
        });
        return m;
    }, [deptIdToName]);

    // Match bulk upload: first + last + DOB + can_manage_schedule required; middle name + employee ID optional.
    const isAddFormComplete = useMemo(() => (
        Boolean(newFirstName.trim())
        && Boolean(newLastName.trim())
        && Boolean(newDob.trim())
        && newCanManageSchedule !== null
        && newPatientAccess !== null
    ), [newFirstName, newLastName, newDob, newCanManageSchedule, newPatientAccess]);

    const addFormMissingFields = useMemo(() => {
        const missing: string[] = [];
        if (!newFirstName.trim()) missing.push('First name');
        if (!newLastName.trim()) missing.push('Last name');
        if (!newDob.trim()) missing.push('Date of birth');
        if (newCanManageSchedule === null) missing.push('Can manage schedule');
        if (newPatientAccess === null) missing.push('Patient access');
        return missing;
    }, [newFirstName, newLastName, newDob, newCanManageSchedule, newPatientAccess]);

    const formatMissingFieldsToast = useCallback((missing: string[]) => {
        if (missing.length === 0) return 'Please fill all required fields before adding staff';
        const head = missing.slice(0, 4).join(', ');
        const rest = missing.length - 4;
        return rest > 0 ? `Missing: ${head} (+${rest} more)` : `Missing: ${head}`;
    }, []);

    const fetchStaff = useCallback(async () => {
        setFetchError(false);
        try {
            const { ok, data } = await fetchAllStaffPayload({ credentials: 'include' });
            if (ok && data != null) {
                writeCachedJson(STAFF_CACHE_LIST, data);
                const parsed = parseStaffList(data);
                setStaff(prev => {
                    if (prev.length === 0) return parsed;
                    const prevById = new Map(prev.map(s => [s.id, s]));
                    return parsed.map(s => {
                        const old = prevById.get(s.id);
                        return old ? mergeStaffListRowIntoDetail(old, s) : s;
                    });
                });
            } else {
                setFetchError(true);
            }
        } catch {
            setFetchError(true);
        }
        setLoading(false);
    }, []);

    const fetchInvites = useCallback(async () => {
        try {
            const res = await fetch(staffUrl(API_ENDPOINTS.STAFF_INVITES), { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            setInviteSummary(parseInviteSummary(data));
            setInviteFlagsByStaffId(parseInviteFlagsByStaffId(data));
        } catch {
            // best effort
        }
    }, []);

    const reportInviteSendResult = useCallback((result: Awaited<ReturnType<typeof sendStaffInviteEmails>>) => {
        if (result.emailNotConfigured) {
            showToast('Invite email is not configured on the server. Contact your administrator.', 'error');
            return;
        }
        if (result.errors.length > 0) {
            setInviteSendErrors(result.errors);
        }
        if (result.queued > 0) {
            const errNote = result.errors.length > 0 ? ` · ${result.errors.length} could not be queued` : '';
            showToast(`Queued ${result.queued} invite${result.queued === 1 ? '' : 's'}${errNote}`, result.errors.length > 0 ? 'info' : 'success');
            void fetchStaff();
            void fetchInvites();
        } else if (result.errors.length > 0) {
            showToast('No invites were queued. See errors in the panel.', 'error');
        } else if (!result.ok) {
            showToast('Failed to send invite emails', 'error');
        }
    }, [fetchInvites, fetchStaff, showToast]);

    const handleSendInviteEmails = useCallback(async (staffIds: string[], options?: { clearSelection?: boolean }) => {
        const ids = staffIds.map(id => id.trim()).filter(Boolean);
        if (ids.length === 0) return;
        setSendingInvites(true);
        try {
            const result = await sendStaffInviteEmails(ids);
            reportInviteSendResult(result);
            if (options?.clearSelection && result.queued > 0) {
                setSelectedStaffIds(new Set());
            }
        } catch {
            showToast('Failed to send invite emails', 'error');
        } finally {
            setSendingInvites(false);
        }
    }, [reportInviteSendResult, showToast]);

    const fetchDepartments = useCallback(async () => {
        try {
            const res = await fetch(staffUrl(STAFF_CACHE_DEPTS));
            if (!res.ok) return;
            const data = await res.json();
            writeCachedJson(STAFF_CACHE_DEPTS, data);
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

    useLayoutEffect(() => {
        const staffJ = readCachedJson(STAFF_CACHE_LIST, STAFF_PAGE_CACHE_TTL_MS);
        if (staffJ != null) {
            setStaff(parseStaffList(staffJ));
            setLoading(false);
        }
        const deptJ = readCachedJson(STAFF_CACHE_DEPTS, STAFF_PAGE_CACHE_TTL_MS);
        if (deptJ != null) {
            const list = extractDepartmentArray(deptJ);
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
        }
    }, []);

    useLayoutEffect(() => {
        if (readClientSupportModeFromDocument()) {
            void resolveClientFacilityId();
        } else {
            clearClientFacilityIdCache();
            void resolveClientFacilityId();
        }
    }, []);

    useEffect(() => { void fetchStaff(); }, [fetchStaff]);
    useEffect(() => { void fetchInvites(); }, [fetchInvites]);
    useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

    useEffect(() => {
        if (!showAddForm || careUnits !== null) return;
        let canceled = false;
        (async () => {
            try {
                const res = await fetch('/api/proxy/units', { credentials: 'include' });
                const data = res.ok ? await res.json() : [];
                if (!canceled) setCareUnits(parseCareUnits(data));
            } catch {
                if (!canceled) setCareUnits([]);
            }
        })();
        return () => { canceled = true; };
    }, [showAddForm, careUnits]);

    const workstationOptions = useMemo(() => {
        const units = [...(careUnits || [])].sort((a, b) => a.name.localeCompare(b.name));
        return [
            { label: 'Not applicable', value: 'not_applicable' },
            ...units.map(u => {
                const dept = u.department_name || (u.department_id ? deptIdToName.get(u.department_id.toLowerCase()) : '') || '';
                return { label: dept ? `${u.name} · ${dept}` : u.name, value: u.id, triggerLabel: u.name };
            }),
        ];
    }, [careUnits, deptIdToName]);

    useEffect(() => {
        if (editingSelected) return;
        setSelected(prev => {
            if (!prev) return null;
            const updated = staff.find(s => s.id === prev.id);
            if (!updated) return prev;
            return mergeStaffListRowIntoDetail(prev, updated);
        });
    }, [staff, editingSelected]);

    useEffect(() => {
        if (activeTab !== 'directory') return;
        const onVisible = () => {
            if (document.visibilityState !== 'visible') return;
            void fetchStaff();
            void fetchInvites();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [activeTab, fetchStaff]);

    useEffect(() => {
        setEditingContactEmail(false);
    }, [selected?.id]);

    useEffect(() => {
        if (!selected) {
            setEditingSelected(false);
            setEditingContactEmail(false);
            return;
        }
        setEditFirstName(selected.first_name || '');
        setEditMiddleName(selected.middle_name || '');
        setEditLastName(selected.last_name || '');
        if (!editingContactEmail) {
            setEditEmail(selected.email || '');
        }
        setEditDob(selected.dob || '');
        setEditGender(selected.gender || '');
        setEditJobTitle(selected.title || selected.job_title || '');
        setEditAdditionalTitle(selected.additional_title || '');
        setEditHighestQualification(selected.highest_qualification || '');
        setEditDept(selected.dept || '');
        setEditEmployeeId(displayableEmployeeId(selected.employee_id));
        setEditAccountExpiresOn(selected.account_expires_on || '');
    }, [selected, editingContactEmail]);

    const toggleSort = (key: Exclude<SortKey, 'response_order'>) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir(key === 'last_seen' ? 'desc' : 'asc'); }
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
            const created = Array.isArray(recPayload.created) ? [...recPayload.created] : [];
            const importErrors = parseBulkErrorRows(recPayload.errors);
            const needsReview = parseBulkNeedsReviewCount(data);
            setBulkResultCreated(created);
            setBulkResultErrors(importErrors);
            setBulkNeedsReview(needsReview);
            if (needsReview > 0) {
                setDirectoryReviewCount(prev => Math.max(prev, needsReview));
            }

            if (created.length > 0 || importErrors.length > 0 || needsReview > 0) {
                // Row-level failures use BulkImportErrorsSheet only (no red-accent error toast).
                if (created.length > 0 || needsReview > 0) {
                    const base = bulkImportToastHeadline(created.length, importErrors.length);
                    const toastMsg = needsReview > 0
                        ? `${base} · ${needsReview} need${needsReview === 1 ? 's' : ''} a directory decision`
                        : base;
                    showToast(
                        toastMsg,
                        importErrors.length > 0 || needsReview > 0 ? 'info' : 'success',
                    );
                }
            } else {
                const outcome = interpretStaffBulkResponse(res.ok, data);
                showToast(
                    outcome.toastText,
                    outcome.historyStatus === 'error'
                        ? 'error'
                        : outcome.historyWarnings > 0
                          ? 'info'
                          : 'success',
                    outcome.historyWarnings > 0 || outcome.historyStatus === 'error',
                );
            }

            const outcome = interpretStaffBulkResponse(res.ok, data);
            if (outcome.shouldClearFile) clearUploadedFile();
            if (outcome.shouldRefreshStaff) {
                setLoading(true);
                fetchStaff();
            }
            if (needsReview > 0 && SHOW_DIRECTORY_REVIEW_UI) {
                void fetchOpenDirectoryReviewCount().then(setDirectoryReviewCount);
            }
        } catch {
            setBulkResultCreated([]);
            setBulkResultErrors([]);
            setBulkNeedsReview(0);
            showToast('Bulk import failed', 'error', true);
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

    const filtered = useMemo(() => {
        const f = staffForList.filter(s => {
            const q = search.toLowerCase();
            const matchSearch = search === '' || s.first_name.toLowerCase().includes(q) || s.last_name.toLowerCase().includes(q) || s.dept.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.employee_id.toLowerCase().includes(q) || s.job_title.toLowerCase().includes(q);
            const matchDept = deptFilter === 'all' || s.dept === deptFilter;
            const matchStatus = statusFilter === 'logged_out'
                ? (!isStaffOnline(s, onlineIdSet) && isStaffLoggedOut(s, loggedOutKeys))
                : (statusFilter === 'all' || s.status === statusFilter);
            return matchSearch && matchDept && matchStatus;
        });
        if (sortKey === 'response_order') return f;
        if (sortKey === 'last_seen') {
            return [...f].sort((a, b) => {
                const av = staffLastSeenMs(a, lastSeenByKey) ?? 0;
                const bv = staffLastSeenMs(b, lastSeenByKey) ?? 0;
                if (av === bv) return 0;
                if (av === 0) return 1;
                if (bv === 0) return -1;
                return sortDir === 'asc' ? av - bv : bv - av;
            });
        }
        return [...f].sort((a, b) => {
            const av = a[sortKey as ColumnSortKey].toLowerCase();
            const bv = b[sortKey as ColumnSortKey].toLowerCase();
            return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        });
    }, [staffForList, search, deptFilter, statusFilter, sortKey, sortDir, lastSeenByKey, onlineIdSet, loggedOutKeys]);

    const staffTotalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / staffPageSize)), [filtered.length, staffPageSize]);
    const paginatedFiltered = useMemo(
        () => filtered.slice((staffPage - 1) * staffPageSize, staffPage * staffPageSize),
        [filtered, staffPage, staffPageSize]
    );

    const toggleSelectAllFiltered = useCallback(() => {
        setSelectedStaffIds(prev => {
            const filteredIds = filtered.map(s => s.id);
            const allSelected = filteredIds.length > 0 && filteredIds.every(id => prev.has(id));
            const next = new Set(prev);
            if (allSelected) {
                filteredIds.forEach(id => next.delete(id));
            } else {
                filteredIds.forEach(id => next.add(id));
            }
            return next;
        });
    }, [filtered]);

    const onlineInFiltered = useMemo(
        () => filtered.filter(s => isStaffOnline(s, onlineIdSet)).length,
        [filtered, onlineIdSet]
    );

    const invitableSelectedIds = useMemo(() => {
        const ids: string[] = [];
        for (const id of selectedStaffIds) {
            const member = staff.find(s => s.id === id);
            if (member && canSendStaffInviteEmail(member)) ids.push(id);
        }
        return ids;
    }, [selectedStaffIds, staff]);

    const statusCounts = useMemo(() => {
        const local: InviteSummaryCounts = { all: staff.length };
        for (const s of staff) {
            const key = normalizeStaffStatus(s.status);
            local[key] = (local[key] ?? 0) + 1;
        }
        if (Object.keys(inviteSummary).length === 0) return local;
        return {
            ...local,
            ...inviteSummary,
            // Prefer server totals when present (includes pending_approval not listed in GET /staff).
            all: inviteSummary.all ?? local.all ?? staff.length,
        };
    }, [staff, inviteSummary]);

    /**
     * Faces for the Total staff stack, chosen from the whole loaded directory (not the table's sort/filter):
     * up to 4 people with a picture, topped up with initials. Ordered by name so the stack never shuffles.
     */
    const stackFaces = useMemo(() => {
        const byName = (a: StaffMember, b: StaffMember) =>
            `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, undefined, { sensitivity: 'base' })
            || a.id.localeCompare(b.id);
        const withPhoto = staff.filter(m => m.profile_url).sort(byName).slice(0, 4);
        if (withPhoto.length >= 4) return withPhoto;
        const rest = staff.filter(m => !m.profile_url).sort(byName).slice(0, 4 - withPhoto.length);
        return [...withPhoto, ...rest];
    }, [staff]);

    const loggedOutCount = useMemo(
        () => staffForList.filter(s => !isStaffOnline(s, onlineIdSet) && isStaffLoggedOut(s, loggedOutKeys)).length,
        [staffForList, onlineIdSet, loggedOutKeys],
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
        setDirectoryConflict(null);
        try {
            const canManage = newCanManageSchedule === true;
            const employeeId = newEmployeeId.trim();
            const body: Record<string, unknown> = {
                first_name: newFirstName.trim(),
                last_name: newLastName.trim(),
                dob: newDob.trim(),
                can_manage_schedule: canManage,
            };
            const middleName = newMiddleName.trim();
            if (middleName) body.middle_name = middleName;
            if (employeeId) body.employee_id = employeeId;
            body.patient_access = newPatientAccess === 'yes';
            if (newPrimaryWorkstation) {
                body.primary_workstation_id = newPrimaryWorkstation;
                body.workstation_ids = [newPrimaryWorkstation];
            }

            const res = await fetch(staffUrl(API_ENDPOINTS.STAFF_DIRECTORY), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });

            const data = await res.json().catch(() => ({} as Record<string, unknown>));

            if (res.status === 409) {
                const reviewRec = (data.review && typeof data.review === 'object'
                    ? data.review
                    : data) as Record<string, unknown>;
                const reviewId = String(
                    data.review_id
                    || data.reviewId
                    || reviewRec.id
                    || '',
                ).trim();
                const kind = String(data.kind || reviewRec.kind || '').trim();
                const name = String(reviewRec.name || '').trim()
                    || `${newFirstName.trim()} ${newLastName.trim()}`.trim();
                const problem = String(
                    reviewRec.problem
                    || data.message
                    || data.detail
                    || data.error
                    || 'This person is already in the directory.',
                ).trim();
                setDirectoryConflict({
                    reviewId,
                    kind,
                    name,
                    problem,
                });
                showToast(problem, 'error');
                return;
            }

            if (!res.ok) {
                showToast(String(data.message || data.detail || data.error || 'Failed to add to directory'), 'error');
                return;
            }

            const created = parseStaffList([data])[0];
            const fallbackMember: StaffMember = {
                id: String(Date.now()),
                first_name: newFirstName.trim(),
                middle_name: newMiddleName.trim(),
                last_name: newLastName.trim(),
                email: '',
                job_title: '',
                title: '',
                dept: 'Unassigned',
                status: 'active',
                access: 'Staff',
                employee_id: employeeId,
                patient_access: newPatientAccess === 'yes',
                is_scheduler: canManage,
                role: 'staff',
                phone: '',
                dob: newDob.trim(),
            };

            const member: StaffMember = created
                ? {
                    ...created,
                    middle_name: created.middle_name || newMiddleName.trim(),
                    dob: created.dob || newDob.trim(),
                    employee_id: pickEmployeeId(
                        { ...created, employee_id: employeeId || created.employee_id },
                        created,
                    ) || employeeId,
                    is_scheduler: created.is_scheduler ?? canManage,
                    patient_access: created.patient_access
                        ?? newPatientAccess === 'yes',
                }
                : fallbackMember;

            setStaff(prev => [member, ...prev]);
            setShowAddForm(false);
            setNewFirstName('');
            setNewMiddleName('');
            setNewLastName('');
            setNewDob('');
            setNewEmployeeId('');
            setNewCanManageSchedule(null);
            setNewPatientAccess(null);
            setNewPrimaryWorkstation('');
            setDirectoryConflict(null);
            const displayName = `${newFirstName} ${newLastName}`.trim() || 'Staff member';
            showToast(`${displayName} added to the directory`, 'success');
            if (SHOW_DIRECTORY_REVIEW_UI) {
                void fetchOpenDirectoryReviewCount().then(setDirectoryReviewCount);
            }
        } catch {
            showToast('Failed to add to directory', 'error');
        } finally {
            setAdding(false);
        }
    };

    const confirmSendInviteAfterCreate = () => {
        if (!pendingInviteSend) return;
        const id = pendingInviteSend.id;
        setPendingInviteSend(null);
        void handleSendInviteEmails([id]);
    };

    const requestRemove = (id: string) => {
        const member = staff.find(s => s.id === id);
        if (!member) return;
        setPendingDelete(member);
    };

    const requestRemoteWipe = (member: StaffMember) => {
        setRemoteWipeConfirmText('');
        setPendingRemoteWipe(member);
    };

    const requestPasswordReset = (member: StaffMember) => {
        if (!STAFF_PASSWORD_RESET_ENABLED) return;
        const email = (member.email || '').trim();
        if (!email) {
            showToast('No email on file for this staff member.', 'error');
            return;
        }
        setPendingPasswordReset(member);
    };

    const confirmStaffPasswordReset = async () => {
        if (!pendingPasswordReset || passwordResetPending) return;
        const email = (pendingPasswordReset.email || '').trim().toLowerCase();
        if (!email) {
            showToast('No email on file for this staff member.', 'error');
            setPendingPasswordReset(null);
            return;
        }
        setPasswordResetPending(true);
        try {
            const res = await fetch(staffUrl(API_ENDPOINTS.ADMIN_RESET(pendingPasswordReset.id)), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const data = (await res.json().catch(() => ({}))) as {
                message?: string;
                error?: string;
                reason?: string;
                status?: string;
                code?: number;
            };
            const apiMessage = data.message || data.error || data.reason || '';
            const rejected = !res.ok || data.status === 'error' || (typeof data.code === 'number' && data.code >= 400);
            if (rejected) {
                showToast(apiMessage || 'Could not send password reset email.', 'error');
                return;
            }
            showToast(
                data.message || `Setup email sent to ${email}. They can set a new password from the web link.`,
                'success',
            );
            setPendingPasswordReset(null);
        } catch {
            showToast('Could not send password reset email.', 'error');
        } finally {
            setPasswordResetPending(false);
        }
    };

    const confirmRemoteWipe = async () => {
        if (!pendingRemoteWipe || remoteWipeConfirmText.trim().toUpperCase() !== 'WIPE') return;
        setRemoteWipePending(true);
        try {
            const res = await fetch(staffUrl(API_ENDPOINTS.STAFF_REMOTE_WIPE(pendingRemoteWipe.id)), {
                method: 'POST',
                credentials: 'include',
            });
            const data = (await res.json().catch(() => ({}))) as {
                message?: string;
                error?: string;
                reason?: string;
            };
            if (!res.ok) {
                const msg = data.message || data.error || data.reason || 'Remote wipe failed';
                showToast(msg, 'error');
                return;
            }
            showToast(data.message || 'Wipe started. Devices will sign out shortly.', 'success');
            setPendingRemoteWipe(null);
            setRemoteWipeConfirmText('');
        } catch {
            showToast('Remote wipe failed', 'error');
        } finally {
            setRemoteWipePending(false);
        }
    };

    const handleRemove = async () => {
        if (!pendingDelete) return;
        const member = pendingDelete;
        const id = member.id;
        setStaff(prev => prev.filter(s => s.id !== id));
        if (selected?.id === id) setSelected(null);
        setPendingDelete(null);
        showToast(`${member?.first_name} ${member?.last_name} removed`, 'success');
        try {
            await fetch(staffUrl(`/api/proxy/staff/${id}`), { method: 'DELETE' });
        } catch { /* optimistic — already removed locally */ }
    };

    const setAdminStatus = async (id: string, newStatus: 'active' | 'suspended' | 'disabled') => {
        const member = staff.find(s => s.id === id);
        if (!member || member.status === newStatus) return;
        const prevStatus = member.status;
        setStaff(prev => prev.map(s => (s.id === id ? { ...s, status: newStatus } : s)));
        setSelected(prev => (prev && prev.id === id ? { ...prev, status: newStatus } : prev));
        const label = statusBadgeStyle(newStatus).label;
        try {
            const res = await fetch(staffUrl(`/api/proxy/staff/${id}/status`), {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            if (!res.ok) {
                throw new Error(String(data.message || data.error || data.detail || 'status update failed'));
            }
            showToast(`${member.first_name} ${member.last_name} set to ${label}`, 'success');
            void fetchInvites();
            void fetchStaff();
        } catch (err) {
            setStaff(prev => prev.map(s => (s.id === id ? { ...s, status: prevStatus } : s)));
            setSelected(prev => (prev && prev.id === id ? { ...prev, status: prevStatus } : prev));
            showToast(err instanceof Error ? err.message : 'Failed to update status', 'error');
        }
    };

    const runInviteAction = async (action: 'revoke' | 'reinvite' | 'push', staffIds: string[]) => {
        if (staffIds.length === 0 || inviteActionPending) return;
        setInviteActionPending(true);
        try {
            const res = await fetch(staffUrl(API_ENDPOINTS.STAFF_INVITE_ACTIONS), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, staff_ids: staffIds }),
            });
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            if (!res.ok) {
                showToast(String(data.message || data.detail || data.error || 'Invite action failed'), 'error');
                return;
            }
            const actionLabel = action === 'revoke' ? 'Revoked' : action === 'reinvite' ? 'Reinvited' : 'Reminder sent';
            showToast(String(data.message || `${actionLabel} successfully`), 'success');
            void fetchStaff();
            void fetchInvites();
        } catch {
            showToast('Invite action failed', 'error');
        } finally {
            setInviteActionPending(false);
        }
    };

    const togglePatientAccess = async (id: string, currentAccess: boolean) => {
        const newVal = !currentAccess;
        const member = staff.find(s => s.id === id);
        setStaff(prev => prev.map(s => s.id === id ? { ...s, patient_access: newVal } : s));
        setSelected(prev => prev && prev.id === id ? { ...prev, patient_access: newVal } : prev);
        showToast(`Patient access ${newVal ? 'granted' : 'revoked'} for ${member?.first_name} ${member?.last_name}`, 'success');
        try {
            await fetch(staffUrl(`/api/proxy/staff/${id}`), {
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

    const toggleScheduler = async (id: string, current: boolean) => {
        const newVal = !current;
        const member = staff.find(s => s.id === id);
        setStaff(prev => prev.map(s => s.id === id ? { ...s, is_scheduler: newVal } : s));
        setSelected(prev => prev && prev.id === id ? { ...prev, is_scheduler: newVal } : prev);
        try {
            // Write `can_manage_schedule`; `is_scheduler` is read-only on the API (and true for admins).
            const res = await fetch(staffUrl(`/api/proxy/staff/${id}`), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ can_manage_schedule: newVal }),
            });
            if (!res.ok) {
                setStaff(prev => prev.map(s => s.id === id ? { ...s, is_scheduler: current } : s));
                setSelected(prev => prev && prev.id === id ? { ...prev, is_scheduler: current } : prev);
                const err = await res.json().catch(() => null) as { error?: string; message?: string; detail?: string } | null;
                const reason = res.status === 404 || res.status === 405
                    ? 'the server doesn’t accept this change yet'
                    : err?.message || err?.detail || err?.error || `error ${res.status}`;
                showToast(`Couldn’t update scheduler access: ${reason}`, 'error');
                return;
            }
            showToast(
                newVal
                    ? `${member?.first_name} ${member?.last_name} can now schedule`
                    : `Scheduler access removed for ${member?.first_name} ${member?.last_name}`,
                'success',
            );
        } catch {
            setStaff(prev => prev.map(s => s.id === id ? { ...s, is_scheduler: current } : s));
            setSelected(prev => prev && prev.id === id ? { ...prev, is_scheduler: current } : prev);
            showToast('Failed to update scheduler access', 'error');
        }
    };

    const assignRole = async (id: string, newRole: 'staff' | 'admin') => {
        const member = staff.find(s => s.id === id);
        const oldRole = member?.role || 'staff';
        setStaff(prev => prev.map(s => s.id === id ? { ...s, role: newRole } : s));
        setSelected(prev => prev && prev.id === id ? { ...prev, role: newRole } : prev);
        showToast(`${member?.first_name} ${member?.last_name} is now ${newRole === 'admin' ? 'an Admin' : 'Staff'}`, 'success');
        try {
            const res = await fetch(staffUrl(`/api/proxy/staff/${id}/assign-role`), {
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

    const saveContactEmail = async () => {
        if (!selected || savingContactEmail) return;
        const normalized = contactEmailDraft.trim().toLowerCase();
        if (!normalized) {
            showToast('Email is required', 'error');
            return;
        }
        if (normalized === (selected.email || '').trim().toLowerCase()) {
            setEditingContactEmail(false);
            return;
        }

        setSavingContactEmail(true);
        try {
            const getRes = await fetch(staffUrl(`/api/proxy/staff/${selected.id}`), { credentials: 'include' });
            let existing: Record<string, unknown> = {};
            if (getRes.ok) {
                const raw = await getRes.json().catch(() => ({}));
                existing = raw && typeof raw === 'object' && !Array.isArray(raw)
                    ? (raw as Record<string, unknown>)
                    : {};
            }

            const employeeFromExisting = String(existing.employee_id || '').trim();
            const employeeId = employeeFromExisting && !isUuidLike(employeeFromExisting)
                ? employeeFromExisting
                : (selected.employee_id && !isUuidLike(selected.employee_id) ? selected.employee_id : undefined);
            const hq = String(
                existing.highest_qualification || existing.highest_qualifications || selected.highest_qualification || '',
            ).trim();
            const payload: Record<string, unknown> = {
                first_name: String(existing.first_name || selected.first_name || '').trim(),
                middle_name: String(existing.middle_name || selected.middle_name || '').trim() || undefined,
                last_name: String(existing.last_name || selected.last_name || '').trim(),
                email: normalized,
                phone: String(existing.phone || selected.phone || '').trim() || undefined,
                dob: String(existing.dob || selected.dob || '').trim() || undefined,
                gender: String(existing.gender || selected.gender || '').trim() || undefined,
                job_title: String(existing.job_title || existing.title || selected.job_title || selected.title || '').trim(),
                highest_qualification: hq || undefined,
                department_id: selected.department_id || String(existing.department_id || '').trim() || undefined,
                patient_access: Boolean(
                    existing.patient_access ?? existing.can_access_patients ?? selected.patient_access ?? false,
                ),
            };
            if (employeeId) payload.employee_id = employeeId;
            if (hq) payload.is_doctor = Boolean(existing.is_doctor ?? isDoctorFromHighestQualification(hq));

            const res = await fetch(staffUrl(`/api/proxy/staff/${selected.id}`), {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({} as { message?: string; detail?: string; error?: string }));
                showToast(String(err.message || err.detail || err.error || 'Could not update email'), 'error');
                return;
            }

            let confirmedEmail = normalized;
            const verifyRes = await fetch(staffUrl(`/api/proxy/staff/${selected.id}`), { credentials: 'include' });
            if (verifyRes.ok) {
                const verifyRaw = await verifyRes.json().catch(() => ({}));
                const rec = verifyRaw && typeof verifyRaw === 'object' && !Array.isArray(verifyRaw)
                    ? (verifyRaw as Record<string, unknown>)
                    : {};
                const verifiedEmail = pickStaffEmail(rec).trim().toLowerCase();
                if (verifiedEmail && verifiedEmail !== normalized) {
                    showToast('Email could not be saved. Please try again.', 'error');
                    return;
                }
                if (verifiedEmail) confirmedEmail = verifiedEmail;
            }

            const mergedLocal: StaffMember = { ...selected, email: confirmedEmail };
            setStaff(prev => prev.map(s => (s.id === selected.id ? { ...s, email: confirmedEmail } : s)));
            setSelected(mergedLocal);
            setEditEmail(confirmedEmail);
            setEditingContactEmail(false);
            showToast('Email updated', 'success');
        } catch {
            showToast('Could not update email', 'error');
        } finally {
            setSavingContactEmail(false);
        }
    };

    const confirmRequestPhoneUpdate = async () => {
        if (!selected) return;
        setPendingPhoneUpdate(false);
        setRequestPhoneUpdatePending(true);
        try {
            let facilityId = '';
            const cookieMatch = document.cookie.match(/helix-facility=([^;]+)/);
            if (cookieMatch) facilityId = cookieMatch[1];

            const meRes = await fetch('/api/proxy/auth/me', { credentials: 'include' });
            if (meRes.ok && !facilityId) {
                const meData = await meRes.json().catch(() => ({}));
                facilityId = getFacilityIdFromAuthMe(meData);
            }
            if (!facilityId) {
                const hospitalRes = await fetch('/api/proxy/hospital', { credentials: 'include' });
                if (hospitalRes.ok) {
                    const hospitalData = await hospitalRes.json().catch(() => ({}));
                    facilityId = getFacilityIdFromFacilityPayload(hospitalData);
                }
            }
            if (!facilityId) {
                const facilitiesRes = await fetch('/api/proxy/facilities', { credentials: 'include' });
                if (facilitiesRes.ok) {
                    const facilitiesData = await facilitiesRes.json().catch(() => ([]));
                    facilityId = getFacilityIdFromFacilityPayload(facilitiesData);
                }
            }

            const qs = facilityId ? `?facility_id=${encodeURIComponent(facilityId)}` : '';
            const res = await fetch(`${API_ENDPOINTS.STAFF_REQUEST_PHONE_UPDATE(selected.id)}${qs}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: '{}',
            });
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            if (!res.ok) {
                showToast(String(data.message || data.detail || data.error || 'Could not send phone update request'), 'error');
                return;
            }
            showToast(String(data.message || 'If the staff member has contact details on file, they have been notified with a link to update their phone number.'), 'success');
        } catch {
            showToast('Could not send phone update request', 'error');
        } finally {
            setRequestPhoneUpdatePending(false);
        }
    };

    const handleSaveSelected = async () => {
        if (!selected) return;
        if (!editFirstName.trim() || !editLastName.trim() || !editEmail.trim()) {
            showToast('First name, last name, and email are required', 'error');
            return;
        }

        setSavingEdit(true);
        try {
            const editDerivedIsDoctor = isDoctorFromHighestQualification(editHighestQualification);
            const resolvedDeptId =
                deptNameToId.get(editDept.trim().toLowerCase()) || selected.department_id;
            const trimmedHq = editHighestQualification.trim();
            const trimmedAdditionalTitle = editAdditionalTitle.trim().slice(0, STAFF_CREATE_TITLE_MAX_LEN);
            const payload: Record<string, unknown> = {
                first_name: editFirstName.trim(),
                middle_name: editMiddleName.trim() || undefined,
                last_name: editLastName.trim(),
                email: editEmail.trim(),
                dob: editDob.trim() || undefined,
                gender: editGender.trim() || undefined,
                job_title: editJobTitle.trim(),
                additional_title: trimmedAdditionalTitle || undefined,
                highest_qualification: trimmedHq || undefined,
                department_id: resolvedDeptId || undefined,
                patient_access: selected.patient_access,
                ...(editAccountExpiresOn.trim()
                    ? { account_expires_on: editAccountExpiresOn.trim() }
                    : selected.account_expires_on
                        ? { clear_account_expires_on: true }
                        : {}),
            };
            const trimmedEmployeeId = editEmployeeId.trim();
            if (trimmedEmployeeId && !isUuidLike(trimmedEmployeeId)) {
                payload.employee_id = trimmedEmployeeId;
            }
            if (trimmedHq) payload.is_doctor = editDerivedIsDoctor;
            const res = await fetch(staffUrl(`/api/proxy/staff/${selected.id}`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({} as { message?: string; detail?: string; error?: string }));
                showToast(String(err.message || err.detail || err.error || 'Failed to update staff'), 'error');
                return;
            }

            const data = await res.json();
            const parsedRows = parseStaffList(data);
            const fromApi = parsedRows.find(s => s.id === selected.id);
            const trimmedEditDept = editDept.trim();
            const fallbackLocal: StaffMember = {
                ...selected,
                first_name: String(payload.first_name || '').trim(),
                middle_name: String(payload.middle_name || '').trim(),
                last_name: String(payload.last_name || '').trim(),
                email: String(payload.email || '').trim(),
                phone: selected.phone || '',
                dob: String(payload.dob || '').trim(),
                gender: String(payload.gender || '').trim(),
                title: String(payload.job_title || '').trim() || selected.title || '',
                job_title: String(payload.job_title || '').trim() || selected.job_title,
                additional_title: trimmedAdditionalTitle || undefined,
                highest_qualification: String(payload.highest_qualification || '').trim() || selected.highest_qualification || '',
                is_doctor: Boolean(payload.is_doctor ?? selected.is_doctor),
                dept: trimmedEditDept || selected.dept,
                department_id: resolvedDeptId,
                employee_id: trimmedEmployeeId && !isUuidLike(trimmedEmployeeId) ? trimmedEmployeeId : '',
                account_expires_on: editAccountExpiresOn.trim() || undefined,
            };
            let mergedLocal: StaffMember = fromApi
                ? mergeStaffPutResponse(selected, {
                    ...fromApi,
                    middle_name: fromApi.middle_name || String(payload.middle_name || '').trim() || selected.middle_name || '',
                    email: (fromApi.email || '').trim() || String(payload.email || '').trim() || selected.email,
                    phone: (fromApi.phone || '').trim() || (selected.phone || '').trim() || undefined,
                    signed_in_role_name: fromApi.signed_in_role_name ?? selected.signed_in_role_name,
                })
                : fallbackLocal;
            const apiReturnedDepartmentId = Boolean(fromApi?.department_id?.trim());
            if (fromApi && trimmedEditDept && !apiReturnedDepartmentId) {
                mergedLocal = { ...mergedLocal, dept: trimmedEditDept, department_id: resolvedDeptId };
            }
            if (trimmedEmployeeId && !isUuidLike(trimmedEmployeeId)) {
                mergedLocal = { ...mergedLocal, employee_id: trimmedEmployeeId };
            }
            if (trimmedAdditionalTitle) {
                mergedLocal = { ...mergedLocal, additional_title: trimmedAdditionalTitle };
            }
            if (trimmedHq) {
                mergedLocal = { ...mergedLocal, highest_qualification: trimmedHq };
            }
            setStaff(prev => prev.map(s => (s.id === selected.id ? mergeStaffPutResponse(s, mergedLocal) : s)));
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
            {inviteSendErrors.length > 0 && (
                <BulkImportErrorsSheet
                    errors={inviteSendErrors.map((e, i) => ({
                        row: i + 1,
                        email: e.email || e.staff_id || '—',
                        message: e.message,
                    }))}
                    onDismiss={dismissInviteSendErrors}
                    title="Invite email — not sent"
                    description={`${inviteSendErrors.length} staff member${inviteSendErrors.length === 1 ? '' : 's'} could not be queued. Fix the issue and try again.`}
                    titleId="staff-invite-errors-title"
                    descId="staff-invite-errors-desc"
                />
            )}
            {toast && (
                <MacVibrancyToastPortal className={toast.wide ? 'helix-mac-toast-portal--front' : undefined}>
                    <MacVibrancyToast
                        message={toast.message}
                        variant={toast.variant}
                        opaque={toast.opaque}
                        wide={toast.wide}
                        details={toast.details}
                        onDismiss={dismissToast}
                    />
                </MacVibrancyToastPortal>
            )}

            <div className="app-main gx-page">
                <TopBar
                    title="Staff Management"
                    subtitle={
                        SHOW_DIRECTORY_REVIEW_UI || SHOW_DIRECTORY_REPORTS_UI
                            ? 'Directory, import, join requests & reviews'
                            : SHOW_JOIN_REQUESTS_UI
                                ? 'Directory, import & join requests'
                                : 'Directory & import'
                    }
                    search={activeTab === 'directory' ? { placeholder: 'Search by name, dept, or email...', value: search, onChange: setSearch } : undefined}
                    actions={
                        <div style={{ display: 'flex', gap: 8 }}>
                            {activeTab === 'directory' && (
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => {
                                        setShowAddForm(prev => {
                                            const next = !prev;
                                            if (!next) setDirectoryConflict(null);
                                            return next;
                                        });
                                    }}
                                >
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>{showAddForm ? 'close' : 'add'}</span>
                                    {showAddForm ? 'Cancel' : 'Add Staff'}
                                </button>
                            )}
                        </div>
                    }
                />

                {/* Tabs */}
                <div className="sx-tabs-wrap">
                    <div className="sx-tabs" role="tablist" aria-label="Staff sections">
                        {([
                            ['directory', 'groups', 'Staff Directory'] as const,
                            ['import', 'upload_file', 'Bulk Import'] as const,
                            ...(SHOW_JOIN_REQUESTS_UI ? [['join', 'how_to_reg', 'Join Requests'] as const] : []),
                            ...(SHOW_DIRECTORY_REVIEW_UI ? [['review', 'rule', 'Directory Review'] as const] : []),
                            ...(SHOW_DIRECTORY_REPORTS_UI ? [['reports', 'report_problem', 'Directory Reports'] as const] : []),
                        ]).map(([id, icon, label]) => {
                            const count = id === 'join' ? pendingJoinCount : id === 'review' ? directoryReviewCount : id === 'reports' ? directoryReportCount : 0;
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === id}
                                    className={`sx-tab${activeTab === id ? ' is-active' : ''}`}
                                    onClick={() => setActiveTab(id as StaffTab)}
                                >
                                    <span className="sx-tab__icon"><span className="material-icons-round">{icon}</span></span>
                                    {label}
                                    {count > 0 && <span className="sx-tab__count">{count}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {activeTab === 'directory' ? (
                <main style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '16px 24px 20px', background: 'var(--bg-900)' }}>

                    {!showAddForm && (() => {
                        const total = statusCounts.all ?? staff.length;
                        const active = statusCounts.active ?? 0;
                        const online = staff.filter(m => isStaffOnline(m, onlineIdSet)).length;
                        const pendingParts = [
                            { key: 'in_directory', label: 'In directory', n: statusCounts.in_directory ?? 0, color: '#9aa4b4' },
                            { key: 'pending_approval', label: 'Pending approval', n: statusCounts.pending_approval ?? 0, color: '#b9832a' },
                            { key: 'not_invited', label: 'Not invited', n: statusCounts.not_invited ?? 0, color: '#f0c27a' },
                            { key: 'invited', label: 'Invited', n: statusCounts.invited ?? 0, color: '#f0a24a' },
                            { key: 'invite_expired', label: 'Invite expired', n: statusCounts.invite_expired ?? 0, color: '#d9771f' },
                        ];
                        const notJoined = pendingParts.reduce((sum, part) => sum + part.n, 0);
                        const activeBase = Math.max(total, active);
                        const activePct = activeBase > 0 ? Math.min(100, Math.round((active / activeBase) * 100)) : 0;
                        const faces = stackFaces;
                        const moreFaces = Math.max(0, total - faces.length);
                        const ringR = 22;
                        const ringC = 2 * Math.PI * ringR;
                        const show = (n: number) => (loading ? '—' : n.toLocaleString());
                        return (
                            <section className="sx-hero gx-reveal" aria-label="Staff overview">
                                <span className="material-icons-round sx-hero__mark" aria-hidden>groups</span>
                                <div className="sx-kpis">
                                    {/* Total staff — real faces from the directory */}
                                    <div className="sx-kpi sx-kpi--navy">
                                        <span className="sx-kpi__glow" aria-hidden />
                                        <span className="material-icons-round sx-kpi__mark" aria-hidden>groups</span>
                                        <div className="sx-kpi__top">
                                            <span className="sx-kpi__icon"><span className="material-icons-round">groups</span></span>
                                            <span className="sx-kpi__label">Total staff</span>
                                        </div>
                                        <div className="sx-kpi__body">
                                            <div className="sx-kpi__value">{show(total)}</div>
                                            <div className="sx-faces" role="group" aria-label={`${total} people in the directory`}>
                                                {faces.map(m => (
                                                    <StaffStackFace key={`${m.id}:${m.profile_url || ''}`} member={m} />
                                                ))}
                                                {moreFaces > 0 && (
                                                    <span className="sx-faces__face sx-faces__more" data-name={`${moreFaces} more`} aria-label={`${moreFaces} more`}>
                                                        +{moreFaces}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="sx-kpi__foot">In this facility&rsquo;s directory</div>
                                    </div>

                                    {/* Active — share of everyone */}
                                    <div className="sx-kpi sx-kpi--mint">
                                        <span className="sx-kpi__glow" aria-hidden />
                                        <span className="material-icons-round sx-kpi__mark" aria-hidden>verified</span>
                                        <div className="sx-kpi__top">
                                            <span className="sx-kpi__icon"><span className="material-icons-round">verified</span></span>
                                            <span className="sx-kpi__label">Active</span>
                                        </div>
                                        <div className="sx-kpi__body">
                                            <div className="sx-kpi__value">{show(active)}</div>
                                            <svg className="sx-ring" width={56} height={56} viewBox="0 0 56 56" role="img" aria-label={`${activePct}% of staff active`}>
                                                <circle cx={28} cy={28} r={ringR} fill="none" stroke="rgba(42, 154, 116, 0.14)" strokeWidth={6} />
                                                <circle
                                                    cx={28} cy={28} r={ringR} fill="none" stroke="#2a9a74" strokeWidth={6} strokeLinecap="round"
                                                    strokeDasharray={`${(activePct / 100) * ringC} ${ringC}`}
                                                    transform="rotate(-90 28 28)"
                                                />
                                                <text x={28} y={32} textAnchor="middle" className="sx-ring__text">{loading ? '—' : `${activePct}%`}</text>
                                            </svg>
                                        </div>
                                        <div className="sx-kpi__foot">Signed up and able to use Helix</div>
                                    </div>

                                    {/* Online now — live presence */}
                                    <div className="sx-kpi sx-kpi--sky">
                                        <span className="sx-kpi__glow" aria-hidden />
                                        <span className="material-icons-round sx-kpi__mark" aria-hidden>wifi_tethering</span>
                                        <div className="sx-kpi__top">
                                            <span className="sx-kpi__icon"><span className="material-icons-round">wifi_tethering</span></span>
                                            <span className="sx-kpi__label">Online now</span>
                                        </div>
                                        <div className="sx-kpi__body">
                                            <div className="sx-kpi__value">{show(online)}</div>
                                            <span className={`sx-radar${online > 0 ? ' is-live' : ''}`} aria-hidden>
                                                <span className="sx-radar__ring" />
                                                <span className="sx-radar__ring sx-radar__ring--2" />
                                                <span className="sx-radar__dot" />
                                            </span>
                                        </div>
                                        <div className="sx-kpi__foot">{loading ? 'Live sign-in activity' : `${online} of ${active} active staff`}</div>
                                    </div>

                                    {/* Not joined yet — where people are stuck */}
                                    <div className="sx-kpi sx-kpi--amber">
                                        <span className="sx-kpi__glow" aria-hidden />
                                        <span className="material-icons-round sx-kpi__mark" aria-hidden>hourglass_top</span>
                                        <div className="sx-kpi__top">
                                            <span className="sx-kpi__icon"><span className="material-icons-round">hourglass_top</span></span>
                                            <span className="sx-kpi__label">Not joined yet</span>
                                        </div>
                                        <div className="sx-kpi__body">
                                            <div className="sx-kpi__value">{show(notJoined)}</div>
                                        </div>
                                        <div
                                            className="sx-stack"
                                            role="img"
                                            aria-label={pendingParts.filter(part => part.n > 0).map(part => `${part.n} ${part.label.toLowerCase()}`).join(', ') || 'Everyone has joined'}
                                        >
                                            {notJoined > 0
                                                ? pendingParts.filter(part => part.n > 0).map(part => (
                                                    <span key={part.key} title={`${part.label}: ${part.n}`} style={{ flex: part.n, background: part.color }} />
                                                ))
                                                : <span style={{ flex: 1, background: 'rgba(42, 154, 116, 0.35)' }} />}
                                        </div>
                                        <div className="sx-kpi__foot">
                                            {notJoined > 0
                                                ? pendingParts.filter(part => part.n > 0).slice(0, 2).map(part => `${part.n} ${part.label.toLowerCase()}`).join(' · ')
                                                : 'Everyone has joined'}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        );
                    })()}

                    {/* Add Staff Form — POST /staff/directory */}
                    {showAddForm && (
                        <AddStaffForm
                            firstName={newFirstName}
                            middleName={newMiddleName}
                            lastName={newLastName}
                            dob={newDob}
                            employeeId={newEmployeeId}
                            canManageSchedule={newCanManageSchedule}
                            patientAccess={newPatientAccess}
                            primaryWorkstation={newPrimaryWorkstation}
                            onFirstName={setNewFirstName}
                            onMiddleName={setNewMiddleName}
                            onLastName={setNewLastName}
                            onDob={setNewDob}
                            onEmployeeId={setNewEmployeeId}
                            onCanManageSchedule={setNewCanManageSchedule}
                            onPatientAccess={setNewPatientAccess}
                            onPrimaryWorkstation={setNewPrimaryWorkstation}
                            workstationOptions={workstationOptions}
                            workstationsLoading={careUnits === null}
                            conflict={directoryConflict}
                            onOpenReview={SHOW_DIRECTORY_REVIEW_UI ? () => {
                                setActiveTab('review');
                                setShowAddForm(false);
                                setDirectoryConflict(null);
                            } : undefined}
                            missingFields={addFormMissingFields}
                            adding={adding}
                            onSubmit={handleAdd}
                            onCancel={() => {
                                setShowAddForm(false);
                                setDirectoryConflict(null);
                            }}
                        />
                    )}

                    {/* Filters & Sort */}
                    <div className="fade-in delay-1 sx-toolbar">
                        <div style={{ minWidth: 190 }}>
                            <CustomSelect
                                value={deptFilter}
                                onChange={setDeptFilter}
                                options={departments.map(d => ({ label: d === 'all' ? 'All Depts' : d, value: d }))}
                                placeholder="All Depts"
                            />
                        </div>
                        <div className="sx-divider" />
                        {!loading && onlineInFiltered > 0 && (
                            <div className="sx-online" title="From live sign-in activity for this facility">
                                <span className="sx-online__dot" aria-hidden />
                                {onlineInFiltered} online now
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {STATUS_FILTER_KEYS.map(key => {
                                const active = statusFilter === key;
                                const label = key === 'all'
                                    ? 'All'
                                    : (statusColors[key as StaffStatus]?.label || key);
                                const count = statusCounts[key] ?? 0;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        className={`sx-chip${active ? ' is-active' : ''}`}
                                        aria-pressed={active}
                                        onClick={() => setStatusFilter(key)}
                                    >
                                        {label}
                                        <span className="sx-chip__n">{count}</span>
                                    </button>
                                );
                            })}
                            {loggedOutFilterEnabled ? (
                                <button
                                    type="button"
                                    className={`sx-chip sx-chip--warn${statusFilter === 'logged_out' ? ' is-active' : ''}`}
                                    aria-pressed={statusFilter === 'logged_out'}
                                    onClick={() => setStatusFilter('logged_out')}
                                    title="Staff with no live mobile app session"
                                >
                                    Logged out
                                    <span className="sx-chip__n">{loggedOutCount}</span>
                                </button>
                            ) : null}
                        </div>
                        {selectedStaffIds.size > 0 && invitableSelectedIds.length > 0 && (
                            <button
                                type="button"
                                className="btn btn-primary btn-xs"
                                disabled={sendingInvites}
                                onClick={() => {
                                    void handleSendInviteEmails(invitableSelectedIds, { clearSelection: true });
                                }}
                            >
                                <span className="material-icons-round" style={{ fontSize: 14 }}>
                                    {sendingInvites ? 'hourglass_empty' : 'mail'}
                                </span>
                                {sendingInvites ? 'Sending…' : `Send invites (${invitableSelectedIds.length})`}
                            </button>
                        )}
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                            <span className="material-icons-round" style={{ fontSize: 14 }}>sort</span>
                            <CustomSelect
                                value={sortKey === 'response_order' ? 'response_order-asc' : `${sortKey}-${sortDir}`}
                                onChange={v => {
                                    const { key, dir } = parseSortControlValue(v);
                                    setSortKey(key);
                                    setSortDir(dir);
                                }}
                                options={[
                                    { label: 'Original order (default)', value: 'response_order-asc' },
                                    { label: 'Last seen (newest)', value: 'last_seen-desc' },
                                    { label: 'Last seen (oldest)', value: 'last_seen-asc' },
                                    { label: 'Last Name A-Z', value: 'last_name-asc' },
                                    { label: 'Last Name Z-A', value: 'last_name-desc' },
                                    { label: 'First Name A-Z', value: 'first_name-asc' },
                                    { label: 'First Name Z-A', value: 'first_name-desc' },
                                    { label: 'Department A-Z', value: 'dept-asc' },
                                    { label: 'Department Z-A', value: 'dept-desc' },
                                    { label: 'Rank A-Z', value: 'job_title-asc' },
                                    { label: 'Rank Z-A', value: 'job_title-desc' },
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
                        <div className="card sx-table-card" style={{ padding: 0, overflow: 'hidden', minWidth: 0, maxWidth: '100%' }}>
                            {selectedStaffIds.size > 0 && (
                                <div className="sx-selbar" role="status">
                                    <span className="sx-selbar__count">
                                        <span className="material-icons-round">check_circle</span>
                                        {selectedStaffIds.size} selected
                                    </span>
                                    <button type="button" className="sx-selbar__clear" onClick={() => setSelectedStaffIds(new Set())}>
                                        Clear selection
                                    </button>
                                </div>
                            )}
                            <div
                                className="table-wrapper staff-table-scroll"
                                style={{ minWidth: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
                            >
                                <table className="staff-table" style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'auto' }}>
                                    <thead>
                                        <tr>
                                            <th
                                                style={{
                                                    ...staffHeadCell,
                                                    width: 44,
                                                    minWidth: 44,
                                                    textAlign: 'center',
                                                    background: '#f7f9fc',
                                                    borderBottom: '1px solid var(--border-default)',
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    aria-label="Select all staff matching current filters"
                                                    checked={
                                                        filtered.length > 0
                                                        && filtered.every(s => selectedStaffIds.has(s.id))
                                                    }
                                                    onChange={toggleSelectAllFiltered}
                                                    onClick={e => e.stopPropagation()}
                                                />
                                            </th>
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
                                                    background: '#f7f9fc',
                                                    borderBottom: '1px solid var(--border-default)',
                                                }}
                                                className="sx-th-sort" aria-sort={sortKey === 'employee_id' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined} onClick={() => toggleSort('employee_id')}
                                            >
                                                Employee ID {renderSortMark(sortKey === 'employee_id', sortDir)}
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
                                                    background: '#f7f9fc',
                                                    borderBottom: '1px solid var(--border-default)',
                                                }}
                                                className="sx-th-sort" aria-sort={sortKey === 'first_name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined} onClick={() => toggleSort('first_name')}
                                            >
                                                First Name {renderSortMark(sortKey === 'first_name', sortDir)}
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
                                                    background: '#f7f9fc',
                                                    boxShadow: '4px 0 10px -4px rgba(15, 23, 42, 0.12)',
                                                    borderBottom: '1px solid var(--border-default)',
                                                }}
                                                className="sx-th-sort" aria-sort={sortKey === 'last_name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined} onClick={() => toggleSort('last_name')}
                                            >
                                                Last Name {renderSortMark(sortKey === 'last_name', sortDir)}
                                            </th>
                                            <th style={{ ...staffHeadCell, minWidth: 220, whiteSpace: 'nowrap', background: '#f7f9fc', borderBottom: '1px solid var(--border-default)' }}>Email</th>
                                            <th style={{ ...staffHeadCell, minWidth: 130, whiteSpace: 'nowrap', cursor: 'pointer', background: '#f7f9fc', borderBottom: '1px solid var(--border-default)' }} className="sx-th-sort" aria-sort={sortKey === 'job_title' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined} onClick={() => toggleSort('job_title')}>Rank {renderSortMark(sortKey === 'job_title', sortDir)}</th>
                                            <th style={{ ...staffHeadCell, minWidth: 160, whiteSpace: 'nowrap', cursor: 'pointer', background: '#f7f9fc', borderBottom: '1px solid var(--border-default)' }} className="sx-th-sort" aria-sort={sortKey === 'dept' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined} onClick={() => toggleSort('dept')}>Department {renderSortMark(sortKey === 'dept', sortDir)}</th>
                                            <th style={{ ...staffHeadCell, minWidth: 140, whiteSpace: 'nowrap', background: '#f7f9fc', borderBottom: '1px solid var(--border-default)' }}>Patient Access</th>
                                            <th style={{ ...staffHeadCell, minWidth: 120, whiteSpace: 'nowrap', background: '#f7f9fc', borderBottom: '1px solid var(--border-default)' }}>Scheduler</th>
                                            <th style={{ ...staffHeadCell, minWidth: 88, whiteSpace: 'nowrap', cursor: 'pointer', background: '#f7f9fc', borderBottom: '1px solid var(--border-default)' }} className="sx-th-sort" aria-sort={sortKey === 'status' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined} onClick={() => toggleSort('status')}>Status {renderSortMark(sortKey === 'status', sortDir)}</th>
                                            {loggedOutKeys.size > 0 ? (
                                                <th style={{ ...staffHeadCell, minWidth: 108, whiteSpace: 'nowrap', background: '#f7f9fc', borderBottom: '1px solid var(--border-default)' }} title="Mobile app session">Mobile</th>
                                            ) : null}
                                            <th style={{ ...staffHeadCell, minWidth: 88, whiteSpace: 'nowrap', cursor: 'pointer', background: '#f7f9fc', borderBottom: '1px solid var(--border-default)' }} className="sx-th-sort" aria-sort={sortKey === 'last_seen' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined} onClick={() => toggleSort('last_seen')}>Last seen {renderSortMark(sortKey === 'last_seen', sortDir)}</th>
                                            <th style={{ ...staffHeadCell, width: 72, minWidth: 72, background: '#f7f9fc', borderBottom: '1px solid var(--border-default)' }} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading && filtered.length === 0 && (
                                            <tr>
                                                <td colSpan={loggedOutKeys.size > 0 ? 13 : 12} className="sx-empty">
                                                    <span className="sx-empty__art"><span className="material-icons-round">hourglass_empty</span></span>
                                                    Loading staff from server...
                                                </td>
                                            </tr>
                                        )}
                                        {!loading && fetchError && filtered.length === 0 && (
                                            <tr>
                                                <td colSpan={loggedOutKeys.size > 0 ? 13 : 12} className="sx-empty">
                                                    <span className="sx-empty__art" style={{ color: '#c2414b' }}><span className="material-icons-round">cloud_off</span></span>
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
                                                <td colSpan={loggedOutKeys.size > 0 ? 13 : 12} className="sx-empty">
                                                    <span className="sx-empty__art"><span className="material-icons-round">person_search</span></span>
                                                    {search || deptFilter !== 'all' || statusFilter !== 'all' ? 'No staff match your filters.' : 'No staff members yet. Add staff above to get started.'}
                                                </td>
                                            </tr>
                                        )}
                                        {paginatedFiltered.map(s => {
                                            const st = statusBadgeStyle(s.status, s);
                                            const isSelected = selected?.id === s.id;
                                            const rowBg = isSelected ? '#eef4fb' : '#ffffff';
                                            const online = isStaffOnline(s, onlineIdSet);
                                            const loggedOut = !online && isStaffLoggedOut(s, loggedOutKeys);
                                            const lastSeenLabel = formatLastSeenAgo(staffLastSeenMs(s, lastSeenByKey));
                                            const neverSignedIn = normalizeStaffStatus(s.status) === 'active' && !hasSignedIn(s);
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
                                                            width: 44,
                                                            minWidth: 44,
                                                            textAlign: 'center',
                                                            background: rowBg,
                                                            borderBottom: '1px solid var(--border-subtle)',
                                                        }}
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            aria-label={`Select ${s.first_name} ${s.last_name}`}
                                                            checked={selectedStaffIds.has(s.id)}
                                                            onChange={e => toggleStaffRowSelected(s.id, e.target.checked)}
                                                        />
                                                    </td>
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
                                                        {s.employee_id ? <span className="sx-empid">{renderEmployeeIdCell(s.employee_id)}</span> : renderEmployeeIdCell(s.employee_id)}
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
                                                        <span className="sx-person">
                                                            <span className="sx-avatar" aria-hidden>
                                                                {`${(s.first_name || '').trim().charAt(0)}${(s.last_name || '').trim().charAt(0)}`.toUpperCase() || '?'}
                                                                {online && <span className="sx-avatar__online" />}
                                                            </span>
                                                            <span className="sx-name">{s.first_name}</span>
                                                        </span>
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
                                                        {(s.email || '').trim()
                                                            ? s.email
                                                            : <span className="sx-muted"><span className="material-icons-round">mail_outline</span>No email</span>}
                                                    </td>
                                                    <td style={{ ...staffBodyCell, minWidth: 130, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: rowBg, borderBottom: '1px solid var(--border-subtle)' }}>
                                                        {s.job_title}
                                                    </td>
                                                    <td style={{ ...staffBodyCell, minWidth: 160, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: rowBg, borderBottom: '1px solid var(--border-subtle)' }}>
                                                        {s.dept ? <span className="sx-dept"><span className="material-icons-round">apartment</span>{s.dept}</span> : <span className="sx-muted">—</span>}
                                                    </td>
                                                    <td style={{ ...staffBodyCell, minWidth: 140, background: rowBg, borderBottom: '1px solid var(--border-subtle)' }}>
                                                        <div className={`sx-flag sx-flag--ok${s.patient_access ? ' is-on' : ''}`}>
                                                            <span className="material-icons-round">{s.patient_access ? 'verified_user' : 'shield'}</span>
                                                            {s.patient_access ? 'Granted' : 'None'}
                                                        </div>
                                                    </td>
                                                    <td style={{ ...staffBodyCell, minWidth: 120, background: rowBg, borderBottom: '1px solid var(--border-subtle)' }}>
                                                        <div className={`sx-flag${s.is_scheduler ? ' is-on' : ''}`}>
                                                            <span className="material-icons-round">{s.is_scheduler ? 'event_available' : 'event_busy'}</span>
                                                            {s.is_scheduler ? 'Yes' : 'No'}
                                                        </div>
                                                    </td>
                                                    <td style={{ ...staffBodyCell, minWidth: 120, background: rowBg, borderBottom: '1px solid var(--border-subtle)' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                                                            <span className="sx-status" style={{ background: st.bg, color: st.color }} title={neverSignedIn ? 'Account is set up but has never signed in' : undefined}>
                                                                <span className="sx-status__dot" aria-hidden />
                                                                {st.label}
                                                            </span>
                                                            {s.source ? (
                                                                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
                                                                    {SOURCE_LABELS[s.source]}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                    {loggedOutKeys.size > 0 ? (
                                                        <td style={{ ...staffBodyCell, minWidth: 108, whiteSpace: 'nowrap', background: rowBg, borderBottom: '1px solid var(--border-subtle)' }}>
                                                            {loggedOut ? (
                                                                <span
                                                                    className="sx-status"
                                                                    title="No live mobile app session"
                                                                    style={{ background: '#fff4e0', color: '#92400E' }}
                                                                >
                                                                    <span className="sx-status__dot" aria-hidden />
                                                                    Logged out
                                                                </span>
                                                            ) : (
                                                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                                                            )}
                                                        </td>
                                                    ) : null}
                                                    <td style={{ ...staffBodyCell, minWidth: 76, background: rowBg, borderBottom: '1px solid var(--border-subtle)' }}>
                                                        <span
                                                            className={`sx-seen${online ? ' is-online' : neverSignedIn || lastSeenLabel === 'Never' ? ' is-never' : ''}`}
                                                            title={
                                                                neverSignedIn
                                                                    ? 'Set up, never signed in'
                                                                    : lastSeenLabel === 'Never'
                                                                        ? 'No last_seen on file'
                                                                        : `Last seen ${lastSeenLabel}`
                                                            }
                                                        >
                                                            {neverSignedIn ? 'Never' : lastSeenLabel}
                                                        </span>
                                                    </td>
                                                    <td style={{ ...staffBodyCell, width: 72, minWidth: 72, textAlign: 'center', background: rowBg, borderBottom: '1px solid var(--border-subtle)' }}>
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                                            <button
                                                                type="button"
                                                                className="sx-row-btn"
                                                                title={inviteEmailTooltip(s)}
                                                                disabled={sendingInvites || !canSendStaffInviteEmail(s)}
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    void handleSendInviteEmails([s.id]);
                                                                }}
                                                            >
                                                                <span
                                                                    className="material-icons-round"
                                                                    style={{
                                                                        color: canSendStaffInviteEmail(s)
                                                                            ? 'var(--helix-primary)'
                                                                            : 'var(--text-disabled)',
                                                                    }}
                                                                >
                                                                    mail
                                                                </span>
                                                            </button>
                                                            <button type="button" className="sx-row-btn" title="Remove staff" onClick={e => { e.stopPropagation(); requestRemove(s.id); }}>
                                                                <span className="material-icons-round" style={{ color: '#c2414b' }}>delete_outline</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="sx-foot">
                                {loading ? 'Loading staff...' : (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                        <span>
                                            Showing <strong className="sx-foot__strong">{filtered.length === 0 ? 0 : (staffPage - 1) * staffPageSize + 1}–{Math.min(staffPage * staffPageSize, filtered.length)}</strong> of <strong className="sx-foot__strong">{filtered.length}</strong> staff
                                        </span>
                                        <div className="sx-pager">
                                            <button type="button" aria-label="Previous page" disabled={staffPage <= 1} onClick={() => setStaffPage(p => Math.max(1, p - 1))}>
                                                <span className="material-icons-round">chevron_left</span>
                                            </button>
                                            <span className="sx-pager__label">Page {staffPage} of {staffTotalPages}</span>
                                            <button type="button" aria-label="Next page" disabled={staffPage >= staffTotalPages} onClick={() => setStaffPage(p => Math.min(staffTotalPages, p + 1))}>
                                                <span className="material-icons-round">chevron_right</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Staff detail — reference layout: pale pills, grouped sections, Helix signed-in role */}
                        {selected && (
                            <div
                                ref={detailPanelRef}
                                className={editingSelected ? 'staff-detail-panel sx-panel' : 'staff-detail-panel sx-panel slide-in-right'}
                                style={{
                                    alignSelf: 'start',
                                    position: 'sticky',
                                    top: 16,
                                    minWidth: 300,
                                    maxWidth: 400,
                                    width: '100%',
                                    minHeight: 0,
                                    height: 'min(calc(100dvh - 88px), calc(100vh - 88px))',
                                    maxHeight: 'min(calc(100dvh - 88px), calc(100vh - 88px))',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden',
                                    boxSizing: 'border-box',
                                    background: '#EDEEF2',
                                    borderRadius: 16,
                                    border: '1px solid #E4E7EC',
                                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif',
                                }}
                            >
                                {editingSelected && (
                                    <div
                                        className="staff-detail-edit-toolbar"
                                        style={{
                                            flexShrink: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            padding: '12px 14px',
                                            background: 'rgba(255, 255, 255, 0.92)',
                                            borderBottom: '1px solid rgba(27, 42, 68, 0.06)',
                                        }}
                                    >
                                        <p
                                            style={{
                                                flex: 1,
                                                minWidth: 0,
                                                margin: 0,
                                                fontSize: 14,
                                                fontWeight: 600,
                                                color: '#111827',
                                                lineHeight: 1.25,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                            title={`${editFirstName || selected.first_name} ${editLastName || selected.last_name}`}
                                        >
                                            {editFirstName || selected.first_name} {editLastName || selected.last_name}
                                        </p>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={cancelStaffEdit}
                                            disabled={savingEdit}
                                            style={{ flexShrink: 0 }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={handleSaveSelected}
                                            disabled={savingEdit}
                                            style={{ flexShrink: 0, gap: 4 }}
                                        >
                                            <span className="material-icons-round" style={{ fontSize: 14 }}>save</span>
                                            {savingEdit ? 'Saving…' : 'Save'}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-xs"
                                            aria-label="Close"
                                            onClick={() => { cancelStaffEdit(); setSelected(null); }}
                                            style={{
                                                width: 28,
                                                height: 28,
                                                borderRadius: '50%',
                                                display: 'grid',
                                                placeItems: 'center',
                                                padding: 0,
                                                color: '#9CA3AF',
                                                background: '#F3F4F6',
                                                flexShrink: 0,
                                            }}
                                        >
                                            <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
                                        </button>
                                    </div>
                                )}
                                <div
                                    className="staff-detail-scroll"
                                    style={{
                                        flex: '1 1 0',
                                        minHeight: 0,
                                        overflowY: 'auto',
                                        overflowX: 'hidden',
                                        WebkitOverflowScrolling: 'touch',
                                        overscrollBehavior: 'contain',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 12,
                                        padding: '10px 10px 12px',
                                        boxSizing: 'border-box',
                                    }}
                                    role="region"
                                    aria-label="Staff profile details"
                                >
                                {!editingSelected && (
                                <div className="sx-profile">
                                    <span className="sx-profile__glow" aria-hidden />
                                    <span className="material-icons-round sx-profile__mark" aria-hidden>badge</span>
                                    <div style={{ padding: '16px 14px 10px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                                        <span className="sx-avatar sx-avatar--lg" aria-hidden>
                                            {`${(selected.first_name || '').trim().charAt(0)}${(selected.last_name || '').trim().charAt(0)}`.toUpperCase() || '?'}
                                            {isStaffOnline(selected, onlineIdSet) && <span className="sx-avatar__online" />}
                                        </span>
                                        <div style={{ minWidth: 0, order: 3, flexBasis: '100%' }}>
                                            <h3 style={{ fontSize: 17, fontWeight: 750, letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0, color: '#16213a' }}>
                                                {selected.first_name} {selected.last_name}
                                            </h3>
                                            <div style={{ fontSize: 12, color: '#4a5872', marginTop: 3 }}>
                                                {selected.dept || 'Department'}{(editingSelected ? editEmployeeId : selected.employee_id) ? ` · ${editingSelected ? editEmployeeId : selected.employee_id}` : ''}
                                            </div>
                                            {internalSupportMode ? (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                                    <button
                                                        type="button"
                                                        disabled={!String(selected.user_id || '').trim()}
                                                        title={selected.user_id || 'No user ID on this record'}
                                                        onClick={() => {
                                                            const value = String(selected.user_id || '').trim();
                                                            if (!value) {
                                                                showToast('No User ID on this record', 'error');
                                                                return;
                                                            }
                                                            void navigator.clipboard.writeText(value).then(
                                                                () => showToast('User ID copied', 'success'),
                                                                () => showToast('Could not copy User ID', 'error'),
                                                            );
                                                        }}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                            border: '1px solid #D0D7E2',
                                                            borderRadius: 8,
                                                            padding: '4px 8px',
                                                            fontSize: 11,
                                                            fontWeight: 600,
                                                            fontFamily: 'inherit',
                                                            background: '#F8FAFC',
                                                            color: String(selected.user_id || '').trim() ? '#1E3A5F' : '#94A3B8',
                                                            cursor: String(selected.user_id || '').trim() ? 'pointer' : 'not-allowed',
                                                        }}
                                                    >
                                                        <span className="material-icons-round" style={{ fontSize: 13 }}>content_copy</span>
                                                        Copy User ID
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title={selected.id}
                                                        onClick={() => {
                                                            void navigator.clipboard.writeText(selected.id).then(
                                                                () => showToast('Staff ID copied', 'success'),
                                                                () => showToast('Could not copy Staff ID', 'error'),
                                                            );
                                                        }}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                            border: '1px solid #D0D7E2',
                                                            borderRadius: 8,
                                                            padding: '4px 8px',
                                                            fontSize: 11,
                                                            fontWeight: 600,
                                                            fontFamily: 'inherit',
                                                            background: '#F8FAFC',
                                                            color: '#1E3A5F',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        <span className="material-icons-round" style={{ fontSize: 13 }}>content_copy</span>
                                                        Copy Staff ID
                                                    </button>
                                                </div>
                                            ) : null}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, order: 2, marginLeft: 'auto', alignSelf: 'flex-start' }}>
                                            <button
                                                type="button"
                                                onClick={() => setEditingSelected(true)}
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                                    border: 'none', borderRadius: 10, padding: '7px 12px',
                                                    fontSize: 12, fontWeight: 650, fontFamily: 'inherit',
                                                    background: 'linear-gradient(145deg, #3a5480, #1b2a44)', color: '#fff', cursor: 'pointer',
                                                    boxShadow: '0 6px 14px -6px rgba(27, 42, 68, 0.6)',
                                                }}
                                            >
                                                <span className="material-icons-round" style={{ fontSize: 14 }}>edit</span>
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                aria-label="Close"
                                                onClick={() => { setEditingSelected(false); setSelected(null); }}
                                                style={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', padding: 0, color: '#4a5872', background: 'rgba(255, 255, 255, 0.8)', border: 'none', cursor: 'pointer' }}
                                            >
                                                <span className="material-icons-round" style={{ fontSize: 18 }}>close</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ padding: '2px 14px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {(() => {
                                            const st = statusBadgeStyle(selected.status, selected);
                                            return (
                                        <span
                                            className="sx-status"
                                            style={{ background: '#fff', color: st.color, boxShadow: '0 1px 2px rgba(27, 42, 68, 0.06)' }}
                                            title={
                                                normalizeStaffStatus(selected.status) === 'active' && !hasSignedIn(selected)
                                                    ? 'Account is set up but has never signed in'
                                                    : undefined
                                            }
                                        >
                                            <span className="sx-status__dot" aria-hidden />
                                            {st.label}
                                        </span>
                                            );
                                        })()}
                                        {selected.source ? (
                                            <span
                                                className="sx-pill"
                                                title="How this person entered the directory"
                                            >
                                                <span className="material-icons-round">login</span>
                                                {SOURCE_LABELS[selected.source]}
                                            </span>
                                        ) : null}
                                        {!isStaffOnline(selected, onlineIdSet) && isStaffLoggedOut(selected, loggedOutKeys) ? (
                                            <span
                                                title="No live mobile app session"
                                                className="sx-pill sx-pill--warn"
                                            >
                                                <span className="sx-status__dot" aria-hidden />
                                                Logged out
                                            </span>
                                        ) : null}
                                        <span className="sx-pill sx-pill--blue" title={selected.job_title}>
                                            <span className="material-icons-round">military_tech</span>
                                            {selected.job_title || 'Role'}
                                        </span>
                                        {detailSignedInRoleLoading ? (
                                            <span className="sx-pill">Loading…</span>
                                        ) : detailSignedInRole ? (
                                            <span className="sx-pill sx-pill--blue" title={detailSignedInRole}>
                                                <span className="material-icons-round">how_to_reg</span>
                                                {detailSignedInRole}
                                            </span>
                                        ) : (
                                            <span className="sx-pill"><span className="material-icons-round" style={{ color: '#8a95a8' }}>person_off</span>Not signed in</span>
                                        )}
                                        {(() => {
                                            const expiryStr = selected.account_expires_on || '';
                                            if (!expiryStr) return null;
                                            const daysUntilExpiry = Math.ceil((new Date(expiryStr).getTime() - Date.now()) / 86400000);
                                            const isExpiringSoon = daysUntilExpiry <= 30 && daysUntilExpiry > 0;
                                            const isExpired = daysUntilExpiry <= 0;
                                            if (!isExpired && !isExpiringSoon) return null;
                                            return (
                                                <span className="sx-pill sx-pill--bad">
                                                    {isExpired ? 'Expired' : `${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'day' : 'days'} left`}
                                                </span>
                                            );
                                        })()}
                                    </div>

                                </div>
                                )}

                                {/* Personal Information */}
                                <div className="sx-section">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                        <span className="material-icons-round sx-section__mark" aria-hidden>person</span>
                                        <span className="gx-ico"><span className="material-icons-round">person</span></span>
                                        <span className="sx-section__head" style={{ flex: 1 }}>Personal information</span>
                                        {!editingSelected && (
                                            <button
                                                type="button"
                                                onClick={() => setEditingSelected(true)}
                                                style={{ border: 'none', background: 'none', padding: 2, cursor: 'pointer', color: '#9CA3AF', display: 'inline-flex', alignItems: 'center', borderRadius: 4 }}
                                                title="Edit personal information"
                                            >
                                                <span className="material-icons-round" style={{ fontSize: 15 }}>edit</span>
                                            </button>
                                        )}
                                    </div>
                                    {!editingSelected ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {[
                                                { icon: 'badge', label: 'First name', value: selected.first_name },
                                                { icon: 'badge', label: 'Last name', value: selected.last_name },
                                                { icon: 'badge', label: 'Middle name', value: selected.middle_name },
                                                { icon: 'cake', label: 'Date of birth', value: selected.dob },
                                                { icon: 'wc', label: 'Gender', value: selected.gender ? (selected.gender.charAt(0).toUpperCase() + selected.gender.slice(1)) : '' },
                                            ].map(row => (
                                                <StaffDetailFieldRow
                                                    key={row.label}
                                                    icon={row.icon}
                                                    label={row.label}
                                                    value={row.value}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                <div style={{ minWidth: 0 }}>
                                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#9CA3AF', marginBottom: 4 }}>First name</label>
                                                    <input className="input" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} disabled={savingEdit} style={{ fontSize: 13, width: '100%', boxSizing: 'border-box', background: '#F5F6F8', border: '1px solid #E8EBF0', borderRadius: 8, padding: '7px 10px' }} />
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#9CA3AF', marginBottom: 4 }}>Last name</label>
                                                    <input className="input" value={editLastName} onChange={e => setEditLastName(e.target.value)} disabled={savingEdit} style={{ fontSize: 13, width: '100%', boxSizing: 'border-box', background: '#F5F6F8', border: '1px solid #E8EBF0', borderRadius: 8, padding: '7px 10px' }} />
                                                </div>
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#9CA3AF', marginBottom: 4 }}>Middle name</label>
                                                <input className="input" value={editMiddleName} onChange={e => setEditMiddleName(e.target.value)} disabled={savingEdit} style={{ fontSize: 13, width: '100%', boxSizing: 'border-box', background: '#F5F6F8', border: '1px solid #E8EBF0', borderRadius: 8, padding: '7px 10px' }} />
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                <div style={{ minWidth: 0 }}>
                                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#9CA3AF', marginBottom: 4 }}>Date of birth</label>
                                                    <DatePicker value={editDob} onChange={setEditDob} placeholder="Choose date" disabled={savingEdit} />
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#9CA3AF', marginBottom: 4 }}>Gender</label>
                                                    <CustomSelect value={editGender} onChange={v => setEditGender(v)} options={[{ label: 'Male', value: 'male' }, { label: 'Female', value: 'female' }, { label: 'Other', value: 'other' }]} placeholder="Choose" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Contact */}
                                <div className="sx-section">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                        <span className="material-icons-round sx-section__mark" aria-hidden>contact_mail</span>
                                        <span className="gx-ico"><span className="material-icons-round">contact_mail</span></span>
                                        <span className="sx-section__head" style={{ flex: 1 }}>Contact</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <div style={{ display: 'flex', alignItems: editingSelected || editingContactEmail ? 'stretch' : 'center', gap: 10, flexDirection: editingSelected || editingContactEmail ? 'column' : 'row' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                                                <span className="material-icons-round" style={{ fontSize: 16, color: '#2f6fb8', opacity: 0.75, flexShrink: 0 }}>mail</span>
                                                {editingSelected ? (
                                                    <input
                                                        className="input"
                                                        type="email"
                                                        value={editEmail}
                                                        onChange={e => setEditEmail(e.target.value)}
                                                        disabled={savingEdit}
                                                        placeholder="Work email"
                                                        style={{ fontSize: 13, width: '100%', boxSizing: 'border-box', background: '#F5F6F8', border: '1px solid #E8EBF0', borderRadius: 8, padding: '7px 10px', minWidth: 0 }}
                                                    />
                                                ) : editingContactEmail ? (
                                                    <input
                                                        className="input"
                                                        type="email"
                                                        value={contactEmailDraft}
                                                        onChange={e => setContactEmailDraft(e.target.value)}
                                                        disabled={savingContactEmail}
                                                        placeholder="Work email"
                                                        autoFocus
                                                        style={{ fontSize: 13, width: '100%', boxSizing: 'border-box', background: '#F5F6F8', border: '1px solid #E8EBF0', borderRadius: 8, padding: '7px 10px', minWidth: 0 }}
                                                    />
                                                ) : (
                                                    <span style={{ fontSize: 13, fontWeight: 500, color: '#111827', wordBreak: 'break-word', minWidth: 0, flex: 1 }}>
                                                        {(selected.email || editEmail || '').trim() || '—'}
                                                    </span>
                                                )}
                                                {!editingSelected && !editingContactEmail && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setContactEmailDraft((selected.email || editEmail || '').trim());
                                                            setEditingContactEmail(true);
                                                        }}
                                                        disabled={savingContactEmail}
                                                        className="sx-link"
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                            </div>
                                            {editingContactEmail && !editingSelected && (
                                                <div style={{ display: 'flex', gap: 8, paddingLeft: 26 }}>
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => setEditingContactEmail(false)}
                                                        disabled={savingContactEmail}
                                                        style={{ fontSize: 12, padding: '5px 10px' }}
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => { void saveContactEmail(); }}
                                                        disabled={savingContactEmail}
                                                        style={{ fontSize: 12, padding: '5px 10px' }}
                                                    >
                                                        {savingContactEmail ? 'Saving…' : 'Save'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {!editingSelected && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span className="material-icons-round" style={{ fontSize: 16, color: '#2f6fb8', opacity: 0.75, flexShrink: 0 }}>phone</span>
                                            <span style={{ fontSize: 13, fontWeight: 500, color: (selected.phone || '').trim() ? '#111827' : '#9CA3AF', fontStyle: (selected.phone || '').trim() ? 'normal' : 'italic', minWidth: 0, flex: 1 }}>
                                                {(selected.phone || '').trim() || 'Not on file'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setPendingPhoneUpdate(true)}
                                                disabled={requestPhoneUpdatePending}
                                                className="sx-link"
                                            >
                                                {requestPhoneUpdatePending ? 'Sending…' : 'Update'}
                                            </button>
                                        </div>
                                        )}
                                        {!editingSelected && (() => {
                                            const inviteMember = {
                                                ...selected,
                                                email: (selected.email || editEmail || '').trim(),
                                            };
                                            const selectedStatus = normalizeStaffStatus(selected.status);
                                            const inviteEnabled = canSendStaffInviteEmail(inviteMember);
                                            if (selectedStatus === 'in_directory') {
                                                return (
                                                    <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                                                        Directory people join from the Helix app with the facility code — no invite email.
                                                    </div>
                                                );
                                            }
                                            return (
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary btn-sm"
                                                    disabled={sendingInvites || !inviteEnabled}
                                                    title={inviteEmailTooltip(inviteMember)}
                                                    onClick={() => { void handleSendInviteEmails([selected.id]); }}
                                                    style={{
                                                        width: '100%',
                                                        justifyContent: 'center',
                                                        marginTop: 2,
                                                        borderRadius: 12,
                                                        fontSize: 12,
                                                        padding: '8px 12px',
                                                        opacity: inviteEnabled ? 1 : 0.42,
                                                        cursor: inviteEnabled && !sendingInvites ? 'pointer' : 'not-allowed',
                                                        color: inviteEnabled ? undefined : 'var(--text-disabled)',
                                                        borderColor: inviteEnabled ? undefined : 'var(--border-subtle)',
                                                    }}
                                                >
                                                    <span
                                                        className="material-icons-round"
                                                        style={{
                                                            fontSize: 15,
                                                            color: inviteEnabled ? undefined : 'var(--text-disabled)',
                                                        }}
                                                    >
                                                        {sendingInvites ? 'hourglass_empty' : 'mail'}
                                                    </span>
                                                    {sendingInvites
                                                        ? 'Sending invite…'
                                                        : selectedStatus === 'active'
                                                            ? 'Invite not needed'
                                                            : selectedStatus === 'invite_expired' || selectedStatus === 'invited'
                                                                ? 'Resend invite'
                                                                : 'Send invite email'}
                                                </button>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Employment */}
                                <div className="sx-section">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                        <span className="material-icons-round sx-section__mark" aria-hidden>business_center</span>
                                        <span className="gx-ico"><span className="material-icons-round">business_center</span></span>
                                        <span className="sx-section__head" style={{ flex: 1 }}>Employment</span>
                                    </div>
                                    {!editingSelected ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {([
                                                { icon: 'badge', label: 'Employee ID', value: selected.employee_id },
                                                ...(internalSupportMode
                                                    ? [
                                                        {
                                                            icon: 'fingerprint',
                                                            label: 'User ID',
                                                            value: selected.user_id || '',
                                                            copyable: true,
                                                        },
                                                        {
                                                            icon: 'tag',
                                                            label: 'Staff ID',
                                                            value: selected.id,
                                                            copyable: true,
                                                        },
                                                    ]
                                                    : []),
                                                { icon: 'apartment', label: 'Department', value: selected.dept },
                                                { icon: 'workspace_premium', label: 'Title', value: selected.additional_title },
                                                { icon: 'military_tech', label: 'Rank', value: selected.job_title },
                                                { icon: 'school', label: 'Qualification', value: selected.highest_qualification },
                                            ] as Array<{
                                                icon: string;
                                                label: string;
                                                value?: string;
                                                copyable?: boolean;
                                            }>).map(row => (
                                                <StaffDetailFieldRow
                                                    key={row.label}
                                                    icon={row.icon}
                                                    label={row.label}
                                                    value={row.value}
                                                    copyable={Boolean(row.copyable)}
                                                    onCopy={(value) => {
                                                        void navigator.clipboard.writeText(value).then(
                                                            () => showToast(`${row.label} copied`, 'success'),
                                                            () => showToast(`Could not copy ${row.label}`, 'error'),
                                                        );
                                                    }}
                                                />
                                            ))}
                                            {/* Account Expiry — inline editable */}
                                            <div className="staff-detail-field-row" style={{ alignItems: 'center' }}>
                                                <span className="material-icons-round staff-detail-field-icon" aria-hidden>event_busy</span>
                                                <span className="staff-detail-field-label">Expiry</span>
                                                <span className="staff-detail-field-value">
                                                    <DatePicker
                                                        value={editAccountExpiresOn}
                                                        onChange={(val) => {
                                                            setEditAccountExpiresOn(val);
                                                            void (async () => {
                                                                try {
                                                                    const res = await fetch(staffUrl(`/api/proxy/staff/${selected.id}`), {
                                                                        method: 'PUT',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify(val
                                                                            ? { account_expires_on: val }
                                                                            : { clear_account_expires_on: true }
                                                                        ),
                                                                    });
                                                                    if (res.ok) {
                                                                        const updated = { ...selected, account_expires_on: val || undefined };
                                                                        setSelected(updated);
                                                                        setStaff(prev => prev.map(s => s.id === selected.id ? updated : s));
                                                                        showToast(val ? `Expiry: ${new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : 'Expiry removed', 'success');
                                                                    } else {
                                                                        showToast('Failed to update expiry', 'error');
                                                                    }
                                                                } catch { showToast('Failed to update expiry', 'error'); }
                                                            })();
                                                        }}
                                                        placeholder="No expiry"
                                                        minDate={new Date().toISOString().slice(0, 10)}
                                                        flat
                                                    />
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            <div style={{ minWidth: 0 }}>
                                                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#9CA3AF', marginBottom: 4 }}>Employee ID</label>
                                                <input
                                                    className="input"
                                                    value={editEmployeeId}
                                                    onChange={e => setEditEmployeeId(e.target.value)}
                                                    disabled={savingEdit}
                                                    placeholder="e.g. HH-0206"
                                                    style={{ fontSize: 13, width: '100%', boxSizing: 'border-box', background: '#F5F6F8', border: '1px solid #E8EBF0', borderRadius: 8, padding: '7px 10px' }}
                                                />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#9CA3AF', marginBottom: 4 }}>Department</label>
                                                <CustomSelect value={editDept} onChange={setEditDept} options={departmentOptions.map(d => ({ label: d, value: d }))} placeholder="Choose department" />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#9CA3AF', marginBottom: 4 }}>Title</label>
                                                <input
                                                    className="input"
                                                    value={editAdditionalTitle}
                                                    onChange={e => setEditAdditionalTitle(e.target.value.slice(0, STAFF_CREATE_TITLE_MAX_LEN))}
                                                    disabled={savingEdit}
                                                    maxLength={STAFF_CREATE_TITLE_MAX_LEN}
                                                    placeholder="e.g. Dr, Prof"
                                                    style={{ fontSize: 13, width: '100%', boxSizing: 'border-box', background: '#F5F6F8', border: '1px solid #E8EBF0', borderRadius: 8, padding: '7px 10px' }}
                                                />
                                                <div style={{ marginTop: 4, fontSize: 10, color: '#9CA3AF' }}>
                                                    {editAdditionalTitle.length}/{STAFF_CREATE_TITLE_MAX_LEN}
                                                </div>
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#9CA3AF', marginBottom: 4 }}>Rank</label>
                                                <CustomSelect value={editJobTitle} onChange={setEditJobTitle} options={STAFF_RANK_OPTIONS.map(t => ({ label: t, value: t }))} placeholder="Choose rank" allowCustom customEntryTitle="Custom rank" customEntryHint="Not listed? Type here, then Enter." customPlaceholder="Type rank — Enter" />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#9CA3AF', marginBottom: 4 }}>Highest qualification</label>
                                                <CustomSelect value={editHighestQualification} onChange={setEditHighestQualification} options={QUALIFICATION_OPTIONS.map(q => ({ label: q, value: q }))} placeholder="Choose qualification" allowCustom customEntryTitle="Custom qualification" customEntryHint="Not listed below? Type here, then Enter." customPlaceholder="e.g. MBChB — Enter" />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#9CA3AF', marginBottom: 4 }}>Account Expiry Date</label>
                                                <DatePicker value={editAccountExpiresOn} onChange={setEditAccountExpiresOn} placeholder="No expiry" minDate={new Date().toISOString().slice(0, 10)} />
                                                <div style={{ marginTop: 4, fontSize: 10, color: '#9CA3AF' }}>Leave empty for indefinite access.</div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Patient Access */}
                                {!editingSelected && (
                                <div className="sx-section">
                                    <span className="material-icons-round sx-section__mark" aria-hidden style={{ fontSize: 70, bottom: -16 }}>health_and_safety</span>
                                    <div className="sx-toggle">
                                        <span className={`gx-option__icon`} style={selected.patient_access ? { color: '#fff', background: 'linear-gradient(145deg, #4fbf98, #2a9a74)', boxShadow: '0 6px 14px -6px rgba(42, 154, 116, 0.7)' } : undefined}>
                                            <span className="material-icons-round">{selected.patient_access ? 'verified_user' : 'shield'}</span>
                                        </span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 650, color: '#16213a' }}>Patient records</div>
                                            <div style={{ fontSize: 11, color: '#6B7280' }}>
                                                {selected.patient_access ? 'Access granted' : 'No access'}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => togglePatientAccess(selected.id, selected.patient_access)}
                                            className={`sx-toggle__btn${selected.patient_access ? ' sx-toggle__btn--off' : ''}`}
                                        >
                                            {selected.patient_access ? 'Remove' : 'Grant'}
                                        </button>
                                    </div>
                                </div>
                                )}

                                {/* Scheduler */}
                                {!editingSelected && (
                                <div className="sx-section">
                                    <span className="material-icons-round sx-section__mark" aria-hidden style={{ fontSize: 70, bottom: -16 }}>calendar_month</span>
                                    <div className="sx-toggle">
                                        <span className={`gx-option__icon`} style={selected.is_scheduler ? { color: '#fff', background: 'linear-gradient(145deg, #5a92d6, #2f6fb8)', boxShadow: '0 6px 14px -6px rgba(47, 111, 184, 0.7)' } : undefined}>
                                            <span className="material-icons-round">{selected.is_scheduler ? 'event_available' : 'event_busy'}</span>
                                        </span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 650, color: '#16213a' }}>Scheduler</div>
                                            <div style={{ fontSize: 11, color: '#6B7280' }}>
                                                {selected.role === 'admin'
                                                    ? 'Admins can always manage schedules'
                                                    : selected.is_scheduler ? 'Can create and manage schedules' : 'No scheduling access'}
                                            </div>
                                        </div>
                                        {/* Admins always count as schedulers, so their access can't be switched off here. */}
                                        {selected.role !== 'admin' && (
                                            <button
                                                type="button"
                                                onClick={() => toggleScheduler(selected.id, selected.is_scheduler)}
                                                className={`sx-toggle__btn${selected.is_scheduler ? ' sx-toggle__btn--off' : ''}`}
                                            >
                                                {selected.is_scheduler ? 'Remove' : 'Allow'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                )}

                                {/* System Role */}
                                {!editingSelected && (
                                <div className="sx-section">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                        <span className="material-icons-round sx-section__mark" aria-hidden>admin_panel_settings</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span className="gx-ico"><span className="material-icons-round">admin_panel_settings</span></span>
                                            <span className="sx-section__head">System role</span>
                                        </div>
                                        <span
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 700,
                                                letterSpacing: '0.05em',
                                                padding: '3px 9px',
                                                borderRadius: 20,
                                                background: selected.role === 'admin' ? 'rgba(27, 42, 68, 0.1)' : 'rgba(42, 154, 116, 0.12)',
                                                color: selected.role === 'admin' ? '#1b2a44' : '#17794f',
                                            }}
                                        >
                                            {selected.role === 'admin' ? 'Admin' : 'Staff'}
                                        </span>
                                    </div>
                                    <div className="sx-seg">
                                        {(['staff', 'admin'] as const).map(r => {
                                            const isActive = selected.role === r;
                                            const isAdmin = r === 'admin';
                                            return (
                                                <button
                                                    key={r}
                                                    type="button"
                                                    onClick={() => { if (!isActive) assignRole(selected.id, r); }}
                                                    style={{
                                                        flex: 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: 5,
                                                        padding: '6px 0',
                                                        borderRadius: 6,
                                                        fontSize: 12,
                                                        fontWeight: isActive ? 600 : 500,
                                                        border: 'none',
                                                        cursor: isActive ? 'default' : 'pointer',
                                                        background: isActive ? '#fff' : 'transparent',
                                                        color: isActive ? (isAdmin ? '#1b2a44' : '#17794f') : '#8a95a8',
                                                        boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                                        transition: 'all 0.18s ease',
                                                    }}
                                                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#374151'; }}
                                                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = '#9CA3AF'; }}
                                                >
                                                    <span className="material-icons-round" style={{ fontSize: 14 }}>
                                                        {isAdmin ? 'admin_panel_settings' : 'person'}
                                                    </span>
                                                    {isAdmin ? 'Admin' : 'Staff'}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                )}

                                {!editingSelected && (
                                <div className="sx-section">
                                    <span className="material-icons-round sx-section__mark" aria-hidden>bolt</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                        <span className="gx-ico"><span className="material-icons-round">bolt</span></span>
                                        <span className="sx-section__head">Actions</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                                        {(() => {
                                            const flags = inviteFlagsByStaffId.get(selected.id);
                                            const selectedStatus = normalizeStaffStatus(selected.status);
                                            const showInviteActions = isInviteLifecycleStatus(selected.status);
                                            const reinviteEnabled = showInviteActions && canReinviteStaff(selected, flags);
                                            const revokeEnabled = showInviteActions && canRevokeStaffInvite(selected, flags);
                                            const pushEnabled = showInviteActions && canPushStaffInvite(selected, flags);
                                            const hasEmail = Boolean((selected.email || '').trim());
                                            const passwordResetEnabled = STAFF_PASSWORD_RESET_ENABLED && hasEmail;
                                            const canDisableAccount = selectedStatus !== 'disabled';
                                            const showStandaloneDisable = canDisableAccount && !isAdminPatchableStatus(selected.status);
                                            return (
                                                <>
                                                    {reinviteEnabled && (
                                                        <button
                                                            type="button"
                                                            style={staffDetailActionBtn}
                                                            disabled={inviteActionPending}
                                                            onClick={() => { void runInviteAction('reinvite', [selected.id]); }}
                                                        >
                                                            <span className="material-icons-round" style={{ fontSize: 15 }}>mail</span>
                                                            {inviteActionPending
                                                                ? 'Sending…'
                                                                : selectedStatus === 'not_invited'
                                                                    ? 'Send invite'
                                                                    : 'Resend invite'}
                                                        </button>
                                                    )}
                                                    {pushEnabled && (
                                                        <button
                                                            type="button"
                                                            style={staffDetailActionBtn}
                                                            disabled={inviteActionPending}
                                                            onClick={() => { void runInviteAction('push', [selected.id]); }}
                                                        >
                                                            <span className="material-icons-round" style={{ fontSize: 15 }}>notifications_active</span>
                                                            {inviteActionPending ? 'Sending…' : 'Push reminder'}
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        style={{
                                                            ...staffDetailActionBtn,
                                                            opacity: passwordResetEnabled ? 1 : 0.42,
                                                            cursor: passwordResetEnabled ? 'pointer' : 'not-allowed',
                                                            color: passwordResetEnabled ? '#111827' : 'var(--text-disabled)',
                                                            border: '1px solid #E5E7EB',
                                                            outline: 'none',
                                                            boxShadow: 'none',
                                                        }}
                                                        disabled={!passwordResetEnabled}
                                                        title={
                                                            hasEmail
                                                                ? 'Send password reset email via admin-reset'
                                                                : 'No email on file'
                                                        }
                                                        onClick={() => requestPasswordReset(selected)}
                                                    >
                                                        <span className="material-icons-round" style={{ fontSize: 15 }}>lock_reset</span>
                                                        Reset password
                                                    </button>
                                                    {isAdminPatchableStatus(selected.status) && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 2 }}>
                                                            <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.04em' }}>
                                                                Account status
                                                            </span>
                                                            <div className="sx-seg">
                                                                {ADMIN_PATCHABLE_STATUSES.map(status => {
                                                                    const active = selected.status === status;
                                                                    const st = statusBadgeStyle(status);
                                                                    return (
                                                                        <button
                                                                            key={status}
                                                                            type="button"
                                                                            disabled={inviteActionPending}
                                                                            onClick={() => { void setAdminStatus(selected.id, status); }}
                                                                            style={{
                                                                                flex: 1,
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                gap: 4,
                                                                                padding: '6px 4px',
                                                                                borderRadius: 6,
                                                                                fontSize: 11,
                                                                                fontWeight: active ? 600 : 500,
                                                                                border: 'none',
                                                                                cursor: active ? 'default' : 'pointer',
                                                                                background: active ? '#fff' : 'transparent',
                                                                                color: active ? st.color : '#9CA3AF',
                                                                                boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                                                            }}
                                                                        >
                                                                            {st.label}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {revokeEnabled && (
                                                        <button
                                                            type="button"
                                                            style={staffDetailActionBtnDanger}
                                                            disabled={inviteActionPending}
                                                            title={
                                                                selectedStatus === 'invite_expired'
                                                                    ? 'Revoke the expired invite (returns to not invited)'
                                                                    : 'Cancel the pending invite'
                                                            }
                                                            onClick={() => { void runInviteAction('revoke', [selected.id]); }}
                                                        >
                                                            <span className="material-icons-round" style={{ fontSize: 15 }}>block</span>
                                                            {inviteActionPending ? 'Working…' : 'Revoke invite'}
                                                        </button>
                                                    )}
                                                    {showStandaloneDisable && (
                                                        <button
                                                            type="button"
                                                            style={staffDetailActionBtnDanger}
                                                            disabled={inviteActionPending}
                                                            title="Disable this account — blocks sign-in and registration"
                                                            onClick={() => { void setAdminStatus(selected.id, 'disabled'); }}
                                                        >
                                                            <span className="material-icons-round" style={{ fontSize: 15 }}>person_off</span>
                                                            Disable account
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        style={staffDetailActionBtnDanger}
                                                        onClick={() => requestRemoteWipe(selected)}
                                                    >
                                                        <span className="material-icons-round" style={{ fontSize: 15 }}>phonelink_erase</span>
                                                        Remote wipe devices
                                                    </button>
                                                    <button
                                                        type="button"
                                                        style={staffDetailActionBtnDanger}
                                                        onClick={() => { requestRemove(selected.id); }}
                                                    >
                                                        <span className="material-icons-round" style={{ fontSize: 15 }}>delete</span>
                                                        Remove staff
                                                    </button>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                                )}
                                </div>
                            </div>
                        )}
                    </div>
                </main>
                ) : SHOW_JOIN_REQUESTS_UI && activeTab === 'join' ? (
                <main style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '16px 24px 24px', background: 'var(--bg-900)' }}>
                    <JoinRequestsPanel onNotify={showToast} onCountChange={setPendingJoinCount} />
                </main>
                ) : SHOW_DIRECTORY_REVIEW_UI && activeTab === 'review' ? (
                <main style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '16px 24px 24px', background: 'var(--bg-900)' }}>
                    <DirectoryReviewsPanel
                        onNotify={showToast}
                        onCountChange={(count) => {
                            setDirectoryReviewCount(count);
                            if (count === 0) setBulkNeedsReview(0);
                        }}
                    />
                </main>
                ) : SHOW_DIRECTORY_REPORTS_UI && activeTab === 'reports' ? (
                <main style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '16px 24px 24px', background: 'var(--bg-900)' }}>
                    <DirectoryReportsPanel
                        onNotify={showToast}
                        onCountChange={setDirectoryReportCount}
                        onOpenDirectoryUser={(directoryUserId) => {
                            const target = String(directoryUserId || '').trim().toLowerCase();
                            if (!target) {
                                showToast('That report has no directory person linked.', 'error');
                                return;
                            }
                            const match = staff.find(s => {
                                const ids = [s.id, s.user_id, s.employee_id]
                                    .map(v => String(v || '').trim().toLowerCase())
                                    .filter(Boolean);
                                return ids.includes(target);
                            });
                            if (!match) {
                                showToast('Couldn’t find that person in the loaded directory. Search for them on Staff Directory.', 'error');
                                setActiveTab('directory');
                                return;
                            }
                            setSelected(match);
                            setEditingSelected(false);
                            setActiveTab('directory');
                            const label = [match.first_name, match.last_name].filter(Boolean).join(' ').trim() || 'staff member';
                            showToast(`Opened ${label}`, 'info');
                        }}
                    />
                </main>
                ) : (
                /* Bulk Import Tab */
                <main className="staff-bulk" style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '16px 24px 24px', background: 'var(--bg-900)' }}>
                    <section className="gx-hero st-hero gx-reveal">
                        <span className="material-icons-round gx-hero__mark" aria-hidden>upload_file</span>
                        <div className="gx-hero__id">
                            <span className="gx-hero__chip"><span className="material-icons-round">upload_file</span></span>
                            <div style={{ minWidth: 0 }}>
                                <div className="gx-kicker">Staff Management</div>
                                <h2 className="gx-title">Bulk import</h2>
                                <p className="gx-lede">
                                    Add many people to the staff directory from one file. Staff finish their email and profile when they join.
                                </p>
                            </div>
                        </div>
                        <div className="st-hero__actions">
                            <a
                                className="st-btn"
                                href="/templates/latest_bulk_upload.csv"
                                download="staff-directory-template.csv"
                                onClick={() => showToast('staff-directory-template.csv downloaded')}
                            >
                                <span className="material-icons-round" aria-hidden>download</span>
                                Download CSV template
                            </a>
                        </div>
                    </section>

                    <div className="fade-in delay-1 staff-bulk__panels">
                        <section className="staff-bulk__panel">
                            <span className="material-icons-round gx-mark" aria-hidden>cloud_upload</span>
                            <h3 className="staff-bulk__panel-title"><span className="gx-ico"><span className="material-icons-round">cloud_upload</span></span>Import records</h3>
                            <p className="staff-bulk__panel-desc">
                                Upload a staff directory file. Names and directory fields only — staff add email and profile details later.
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.txt,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                style={{ display: 'none' }}
                                onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    if (/\.xls$/i.test(file.name) && !/\.xlsx$/i.test(file.name)) {
                                        showToast('.xls files are not accepted. Use .csv or .xlsx.', 'error');
                                        e.target.value = '';
                                        return;
                                    }
                                    setUploadedFile(file);
                                }}
                            />
                            <div
                                className={[
                                    'staff-bulk__drop',
                                    dragOver ? 'staff-bulk__drop--over' : '',
                                    uploadedFile ? 'staff-bulk__drop--ready' : '',
                                ].filter(Boolean).join(' ')}
                                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={e => {
                                    e.preventDefault();
                                    setDragOver(false);
                                    const file = e.dataTransfer.files?.[0];
                                    if (!file) return;
                                    if (/\.xls$/i.test(file.name) && !/\.xlsx$/i.test(file.name)) {
                                        showToast('.xls files are not accepted. Use .csv or .xlsx.', 'error');
                                        return;
                                    }
                                    setUploadedFile(file);
                                }}
                                onClick={() => fileInputRef.current?.click()}
                                role="button"
                                tabIndex={0}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        fileInputRef.current?.click();
                                    }
                                }}
                            >
                                <div className="staff-bulk__drop-icon">
                                    <span className="material-icons-round" aria-hidden>
                                        {uploadedFile ? 'check_circle' : 'cloud_upload'}
                                    </span>
                                </div>
                                {uploadedFile ? (
                                    <>
                                        <div className="staff-bulk__drop-title">{uploadedFile.name}</div>
                                        <div className="staff-bulk__drop-meta">Ready to import</div>
                                    </>
                                ) : (
                                    <>
                                        <div className="staff-bulk__drop-title">Choose file or drag and drop here</div>
                                        <div className="staff-bulk__drop-formats">
                                            <span className="staff-bulk__format">.CSV</span>
                                            <span className="staff-bulk__format">.TXT</span>
                                            <span className="staff-bulk__format">.XLSX</span>
                                        </div>
                                        <div className="staff-bulk__drop-meta">UTF-8 · Max 50MB</div>
                                        <div className="staff-bulk__drop-note">
                                            Files are validated for duplicates prior to directory commit.
                                        </div>
                                    </>
                                )}
                            </div>
                            {uploadedFile ? (
                                <div className="staff-bulk__actions">
                                    <button type="button" className="st-btn st-btn--primary" style={{ flex: 1, height: 38 }} disabled={processing} onClick={handleBulkImport}>
                                        <span className="material-icons-round" style={{ fontSize: 16 }}>{processing ? 'hourglass_empty' : 'upload'}</span>
                                        {processing ? 'Importing…' : 'Import directory'}
                                    </button>
                                    <button type="button" className="st-btn" style={{ height: 38 }} onClick={clearUploadedFile} disabled={processing}>
                                        <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
                                        Clear
                                    </button>
                                </div>
                            ) : null}
                        </section>

                        <aside className="staff-bulk__panel">
                            <span className="material-icons-round gx-mark" aria-hidden>table_chart</span>
                            <h3 className="staff-bulk__panel-title"><span className="gx-ico"><span className="material-icons-round">table_chart</span></span>Data schema &amp; specs</h3>
                            <p className="staff-bulk__panel-desc">
                                Column order for the CSV template. Keep the sheet short.
                            </p>

                            <p className="staff-bulk__schema-label">Required headers · 4 columns</p>
                            <div className="staff-bulk__chips">
                                {['first_name', 'last_name', 'dob', 'can_manage_schedule'].map(col => (
                                    <span key={col} className="staff-bulk__chip staff-bulk__chip--required">{col}</span>
                                ))}
                            </div>
                            <p className="staff-bulk__hint">
                                DOB as YYYY-MM-DD or DD/MM/YYYY. Schedule as yes or no.
                            </p>

                            <p className="staff-bulk__schema-label">Optional headers · 2 columns</p>
                            <div className="staff-bulk__chips">
                                {['middle_name', 'employee_id'].map(col => (
                                    <span key={col} className="staff-bulk__chip">{col}</span>
                                ))}
                            </div>

                        </aside>
                    </div>

                    {SHOW_DIRECTORY_REVIEW_UI && bulkNeedsReview > 0 ? (
                        <section className="st-callout st-callout--info fade-in" style={{ marginBottom: 16, alignItems: 'center', padding: '14px 16px', borderRadius: 18, flexWrap: 'wrap' }}>
                            <span className="material-icons-round" aria-hidden>rule</span>
                            <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                                <strong style={{ fontSize: 13.5 }}>
                                    {bulkNeedsReview} {bulkNeedsReview === 1 ? 'row needs' : 'rows need'} a directory decision
                                </strong>
                                <div style={{ marginTop: 2 }}>
                                    Same employee ID, same name and date of birth, or incomplete rows from this upload.
                                </div>
                            </div>
                            <button type="button" className="st-btn st-btn--primary" onClick={() => setActiveTab('review')}>
                                Open Directory Review
                                <span className="material-icons-round" aria-hidden>arrow_forward</span>
                            </button>
                        </section>
                    ) : null}

                    {bulkResultCreated.length > 0 && (
                        <section
                            className="fade-in st-card staff-bulk-created"
                            aria-label={`${bulkResultCreated.length} staff added`}
                            style={{ marginBottom: 16 }}
                        >
                            <span className="material-icons-round gx-mark" aria-hidden>group_add</span>
                            <div className="st-card__head">
                                <div className="st-card__id">
                                    <span className="staff-bulk-created__count" aria-hidden>{bulkResultCreated.length}</span>
                                    <div style={{ minWidth: 0 }}>
                                        <h3 className="st-card__title">Added to directory</h3>
                                        <p className="st-card__sub">
                                            {bulkResultCreated.length === 1
                                                ? 'One person was imported. They can finish email and profile details when they join.'
                                                : `${bulkResultCreated.length} people were imported. They can finish email and profile details when they join.`}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <ul className="st-list">
                                {bulkResultCreated.map((raw, idx) => {
                                    const { name, email, idShort } = summarizeBulkCreatedEntry(raw);
                                    const initials = staffDisplayInitials(name);
                                    return (
                                        <li key={`created-${idx}-${email || name}`} className="st-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span className="st-avatar" aria-hidden>{initials}</span>
                                            <div style={{ flex: 1, minWidth: 0, fontWeight: 650, fontSize: 13.5, color: 'var(--text-primary)' }}>
                                                {name}
                                            </div>
                                            {idShort ? <span className="st-mono">{idShort}</span> : null}
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    )}

                    <div className="fade-in delay-3 staff-bulk__ledger">
                        <ImportHistoryLedger
                            entries={bulkHistory}
                            loading={bulkHistoryLoading}
                            emptyMessage="No staff imports found."
                        />
                    </div>

                    <footer className="staff-bulk__foot">
                        <span>Staff Directory · Bulk import</span>
                        <div className="staff-bulk__foot-links">
                            <a href="/templates/latest_bulk_upload.csv" download="staff-directory-template.csv">
                                CSV Specification
                            </a>
                        </div>
                    </footer>
                </main>
                )}
            </div>
            {pendingPhoneUpdate && selected && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="staff-phone-update-title"
                    onClick={() => setPendingPhoneUpdate(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(8, 12, 20, 0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1200,
                        padding: 16,
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: 440,
                            background: 'var(--surface-card)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
                            padding: '18px 18px 14px',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 10,
                                    background: 'rgba(37, 99, 235, 0.12)',
                                    color: '#2563eb',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                <span className="material-icons-round" style={{ fontSize: 18 }}>phone</span>
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div id="staff-phone-update-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Send phone update link?
                                </div>
                                <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    Send{' '}
                                    <strong>
                                        {[selected.first_name, selected.last_name].filter(Boolean).join(' ').trim() || 'this staff member'}
                                    </strong>{' '}
                                    a secure link to update their own phone number. They will only receive it if contact details on file allow delivery.
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setPendingPhoneUpdate(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={requestPhoneUpdatePending}
                                onClick={() => { void confirmRequestPhoneUpdate(); }}
                            >
                                {requestPhoneUpdatePending ? 'Sending…' : 'Send link'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {pendingInviteSend && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="staff-invite-send-title"
                    onClick={() => setPendingInviteSend(null)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(8, 12, 20, 0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1200,
                        padding: 16,
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: 440,
                            background: 'var(--surface-card)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
                            padding: '18px 18px 14px',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 10,
                                    background: 'rgba(37, 99, 235, 0.12)',
                                    color: '#2563eb',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                <span className="material-icons-round" style={{ fontSize: 18 }}>mail</span>
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div id="staff-invite-send-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Send invite email?
                                </div>
                                <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    <strong>
                                        {[pendingInviteSend.first_name, pendingInviteSend.last_name].filter(Boolean).join(' ').trim() || 'This staff member'}
                                    </strong>{' '}
                                    was created. Send the &ldquo;complete your account&rdquo; invite email now?
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setPendingInviteSend(null)}
                            >
                                Not now
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={sendingInvites}
                                onClick={confirmSendInviteAfterCreate}
                            >
                                {sendingInvites ? 'Sending…' : 'Send invite email'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {pendingPasswordReset && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="staff-password-reset-title"
                    onClick={() => { if (!passwordResetPending) setPendingPasswordReset(null); }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(8, 12, 20, 0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1200,
                        padding: 16,
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: 440,
                            background: 'var(--surface-card)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
                            padding: '18px 18px 14px',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 10,
                                    background: 'rgba(37, 99, 235, 0.12)',
                                    color: '#2563eb',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                <span className="material-icons-round" style={{ fontSize: 18 }}>lock_reset</span>
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div id="staff-password-reset-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Send password reset email?
                                </div>
                                <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    Helix will email a setup link to{' '}
                                    <strong>{(pendingPasswordReset.email || '').trim()}</strong>{' '}
                                    so{' '}
                                    <strong>
                                        {[pendingPasswordReset.first_name, pendingPasswordReset.last_name].filter(Boolean).join(' ').trim() || 'this staff member'}
                                    </strong>{' '}
                                    can set a new password on the web (valid 72 hours).
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={passwordResetPending}
                                onClick={() => setPendingPasswordReset(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={passwordResetPending}
                                onClick={() => { void confirmStaffPasswordReset(); }}
                            >
                                {passwordResetPending ? 'Sending…' : 'Send reset email'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {pendingRemoteWipe && (() => {
                const wipeTargetName =
                    [pendingRemoteWipe.first_name, pendingRemoteWipe.last_name].filter(Boolean).join(' ').trim()
                    || 'this staff member';
                const remoteWipeCanConfirm =
                    !remoteWipePending && remoteWipeConfirmText.trim().toUpperCase() === 'WIPE';
                return (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="staff-remote-wipe-title"
                    aria-describedby="staff-remote-wipe-desc"
                    onClick={() => {
                        if (remoteWipePending) return;
                        setPendingRemoteWipe(null);
                        setRemoteWipeConfirmText('');
                    }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(8, 12, 20, 0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1200,
                        padding: 16,
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: 480,
                            background: 'var(--surface-card)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
                            padding: '18px 18px 14px',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 10,
                                    background: 'rgba(198, 40, 40, 0.12)',
                                    color: '#c62828',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                <span className="material-icons-round" style={{ fontSize: 18 }}>phonelink_erase</span>
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div id="staff-remote-wipe-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Wipe devices for {wipeTargetName}?
                                </div>
                                <p
                                    id="staff-remote-wipe-desc"
                                    style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}
                                >
                                    Signs them out on all phones and clears local Helix app data. Their staff account stays active.
                                </p>
                            </div>
                        </div>
                        <label style={{ display: 'block', marginTop: 14, fontSize: 12, color: 'var(--text-secondary)' }}>
                            Type <strong>WIPE</strong> to confirm
                            <input
                                type="text"
                                value={remoteWipeConfirmText}
                                onChange={e => setRemoteWipeConfirmText(e.target.value)}
                                autoComplete="off"
                                disabled={remoteWipePending}
                                placeholder="WIPE"
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    marginTop: 6,
                                    padding: '8px 10px',
                                    fontSize: 13,
                                    borderRadius: 8,
                                    border: '1px solid var(--border-default)',
                                    fontFamily: 'inherit',
                                }}
                            />
                        </label>
                        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={remoteWipePending}
                                onClick={() => {
                                    setPendingRemoteWipe(null);
                                    setRemoteWipeConfirmText('');
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm"
                                disabled={!remoteWipeCanConfirm}
                                aria-label="Confirm remote wipe of mobile devices"
                                aria-disabled={!remoteWipeCanConfirm}
                                onClick={() => { void confirmRemoteWipe(); }}
                                style={{
                                    ...(remoteWipeCanConfirm ? staffDetailActionBtnDanger : staffDetailActionBtn),
                                    width: 'auto',
                                    opacity: remoteWipeCanConfirm ? 1 : 0.42,
                                    cursor: remoteWipeCanConfirm ? 'pointer' : 'not-allowed',
                                }}
                            >
                                {remoteWipePending ? 'Wiping…' : 'Wipe devices'}
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}
            {pendingDelete && (
                <div
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setPendingDelete(null)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(8, 12, 20, 0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1200,
                        padding: 16,
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: 440,
                            background: 'var(--surface-card)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
                            padding: '18px 18px 14px',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 10,
                                    background: 'rgba(198, 40, 40, 0.12)',
                                    color: '#c62828',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                <span className="material-icons-round" style={{ fontSize: 18 }}>warning</span>
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Confirm delete action
                                </div>
                                <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    Are you sure you want to delete{' '}
                                    <strong>
                                        {[pendingDelete.first_name, pendingDelete.last_name].filter(Boolean).join(' ').trim() || 'this staff member'}
                                    </strong>
                                    ?
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setPendingDelete(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={handleRemove}
                            >
                                Confirm Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                @media (max-width: 1024px) {
                    .staff-table-scroll {
                        overflow-x: auto !important;
                        overflow-y: hidden !important;
                        scrollbar-width: thin;
                    }
                    .staff-table {
                        width: max-content !important;
                        min-width: 1220px !important;
                        table-layout: auto !important;
                    }
                }
            `}</style>
        </>
    );
}
