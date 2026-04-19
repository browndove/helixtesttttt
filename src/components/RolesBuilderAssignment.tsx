'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import TopBar from '@/components/TopBar';
import CustomSelect from '@/components/CustomSelect';
import { MacVibrancyToast, MacVibrancyToastPortal } from '@/components/MacVibrancyToast';
import { readCachedJson, writeCachedJson } from '@/lib/getJsonCache';
import {
    clampEscalationDelaySeconds,
    delayToSeconds,
    ESCALATION_DELAY_OPTIONS,
    MIN_ESCALATION_DELAY_SEC,
    secondsToDelay,
} from '@/lib/escalation-delays';
import {
    ROLES_CACHE_DEPTS,
    ROLES_CACHE_HOSPITAL,
    ROLES_CACHE_POLICIES,
    ROLES_CACHE_ROLES,
    ROLES_CACHE_STAFF,
    ROLES_PAGE_CACHE_TTL_MS,
} from '@/lib/rolesAdminCache';

type EscalationLevel = {
    level: number;
    target: string;
    delay: string;
};

type EscalationStep = {
    id: string;
    step_order: number;
    target_role_id: string;
    target_role_name?: string;
    target_user_id?: string | null;
    target_user_name?: string;
    timeout_seconds: number;
};

type Policy = {
    id: string;
    role_id: string;
    role_name?: string;
    user_id?: string | null;
    user_name?: string;
    initial_timeout_seconds: number;
    steps: EscalationStep[];
    created_at?: string;
    updated_at?: string;
};

function extractPolicies(raw: unknown): Policy[] {
    if (Array.isArray(raw)) return raw as Policy[];
    if (!raw || typeof raw !== 'object') return [];
    const obj = raw as Record<string, unknown>;
    const list = obj.data ?? obj.items ?? obj.policies ?? obj.results;
    return Array.isArray(list) ? (list as Policy[]) : [];
}

function stepsToLevels(steps: EscalationStep[], roleNameMap?: Map<string, string>): EscalationLevel[] {
    return steps
        .slice()
        .sort((a, b) => a.step_order - b.step_order)
        .map((s, i) => ({
            level: i + 1,
            target: s.target_role_name || (roleNameMap?.get(s.target_role_id) ?? ''),
            delay: secondsToDelay(s.timeout_seconds),
        }));
}

type RoutingRule = {
    id: string;
    label: string;
    desc: string;
    enabled: boolean;
};

type Role = {
    id: string;
    name: string;
    description: string;
    department: string;
    mandatory: boolean;
    enabled: boolean;
    priority: string;
    visible_in_directory: boolean;
    /** Whether this role is enabled for facility external communication (cross-facility messaging). */
    external_messaging?: boolean;
    sign_in_restricted?: boolean;
    sign_in_allowed_user_ids?: string[];
    signed_in_by?: string;
    signed_in_user?: {
        id?: string;
        first_name?: string;
        last_name?: string;
        name?: string;
        email?: string;
    };
    escalation_routing: RoutingRule[];
    escalation_levels: EscalationLevel[];
};

type StaffOption = {
    id: string;
    label: string;
};

function staffNameOnly(label: string): string {
    return label.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function splitRoleName(name: string): { prefix: string; suffix: string } {
    const trimmed = String(name || '').trim();
    if (!trimmed) return { prefix: '', suffix: '' };
    const [first, ...rest] = trimmed.split(' - ');
    if (rest.length === 0) {
        return { prefix: '', suffix: trimmed };
    }
    return {
        prefix: first.trim(),
        suffix: rest.join(' - ').trim(),
    };
}

/** Join prefix + suffix for compound role names; preserves user capitalization (trim only). */
function buildRoleName(prefix: string, suffix: string): string {
    const cleanPrefix = String(prefix || '').trim();
    const cleanSuffix = String(suffix || '').trim();
    if (cleanPrefix) {
        return cleanSuffix ? `${cleanPrefix} - ${cleanSuffix}` : cleanPrefix;
    }
    return cleanSuffix;
}

function normalizeRoleForUi<T extends Role>(role: T, deptIdToName: Map<string, string> = new Map()): T {
    const isCritical = role.priority?.toString().trim().toLowerCase() === 'critical';
    const priority = isCritical ? 'Critical' : 'Standard';
    const mandatory = isCritical;
    const rec = role as unknown as Record<string, unknown>;
    const department = resolveRoleDepartment(rec, deptIdToName);
    return {
        ...role,
        department,
        mandatory,
        enabled: role.enabled ?? true,
        visible_in_directory: role.visible_in_directory ?? true,
        priority,
    } as T;
}

type TemplateRole = {
    name: string;
    description: string;
    delay: string;
};

type RoleTemplate = {
    id: string;
    name: string;
    description: string;
    roles: TemplateRole[];
};

const roleTemplates: RoleTemplate[] = [
    {
        id: 'ed-critical',
        name: 'Emergency Department Critical',
        description: 'Creates 3 roles linked in an escalation chain for the Emergency Department.',
        roles: [
            { name: 'ED Doctor On-Call', description: 'Primary critical responder for Emergency Department cases.', delay: '30 sec' },
            { name: 'ED Supervisor', description: 'Escalation Level 1 — receives unacknowledged ED cases.', delay: '3 min' },
            { name: 'CEO', description: 'Final escalation — executive leadership for unresolved ED emergencies.', delay: '7 min' },
        ],
    },
    {
        id: 'inpatient-ward',
        name: 'Inpatient Ward Critical',
        description: 'Creates 3 roles linked in an escalation chain for inpatient wards (department-based).',
        roles: [
            { name: 'Doctor in Charge of Patient', description: 'Primary attending doctor responsible for the inpatient case.', delay: '30 sec' },
            { name: 'Department Lead', description: 'Escalation Level 1 — department lead for unacknowledged inpatient cases.', delay: '3 min' },
            { name: 'CEO', description: 'Final escalation — executive leadership for unresolved inpatient emergencies.', delay: '7 min' },
        ],
    },
    {
        id: 'icu-critical',
        name: 'ICU Critical',
        description: 'Creates 3 roles linked in an escalation chain for the Intensive Care Unit.',
        roles: [
            { name: 'ICU Doctor On-Call', description: 'Primary critical responder for ICU patient situations.', delay: '30 sec' },
            { name: 'ICU Department Lead', description: 'Escalation Level 1 — ICU lead for unacknowledged critical cases.', delay: '3 min' },
            { name: 'CEO', description: 'Final escalation — executive leadership for unresolved ICU emergencies.', delay: '7 min' },
        ],
    },
    {
        id: 'maternity',
        name: 'Maternity Ward Critical',
        description: 'Creates 3 roles linked in an escalation chain for the maternity and labor ward.',
        roles: [
            { name: 'OBGYN On-Call', description: 'Primary on-call OBGYN for maternity and labor ward cases.', delay: '30 sec' },
            { name: 'OBGYN Department Supervisor', description: 'Escalation Level 1 — OBGYN supervisor for unacknowledged cases.', delay: '3 min' },
            { name: 'CEO', description: 'Final escalation — executive leadership for unresolved maternity emergencies.', delay: '7 min' },
        ],
    },
    {
        id: 'pediatrics-nicu',
        name: 'Pediatrics Critical',
        description: 'Creates 3 roles linked in an escalation chain for pediatrics and neonatal intensive care.',
        roles: [
            { name: 'Peds Doctor On-Call', description: 'Primary on-call doctor for pediatric and NICU critical situations.', delay: '30 sec' },
            { name: 'Peds Unit Lead', description: 'Escalation Level 1 — pediatrics unit lead for unacknowledged cases.', delay: '3 min' },
            { name: 'CEO', description: 'Final escalation — executive leadership for unresolved pediatric emergencies.', delay: '7 min' },
        ],
    },
    {
        id: 'theatre-anaesthesia',
        name: 'Operating Theatre Critical',
        description: 'Creates 3 roles linked in an escalation chain for the operating theatre and anaesthesia.',
        roles: [
            { name: 'Anaesthesia On-Call', description: 'Primary on-call anaesthetist for operating theatre cases.', delay: '30 sec' },
            { name: 'Theatre Supervisor', description: 'Escalation Level 1 — senior theatre staff for unacknowledged cases.', delay: '3 min' },
            { name: 'CEO', description: 'Final escalation — executive leadership for unresolved theatre emergencies.', delay: '7 min' },
        ],
    },
    {
        id: 'ambulance-referral',
        name: 'Ambulance Transfers Critical',
        description: 'Creates 3 roles linked in an escalation chain for ambulance arrivals, referrals, and transfers.',
        roles: [
            { name: 'ED Triage On-Call', description: 'Primary triage responder for ambulance arrivals and referrals.', delay: '30 sec' },
            { name: 'ED Supervisor', description: 'Escalation Level 1 — ED supervisor for unacknowledged referral cases.', delay: '3 min' },
            { name: 'CEO', description: 'Final escalation — executive leadership for unresolved transfer emergencies.', delay: '7 min' },
        ],
    },
    {
        id: 'safety-threat',
        name: 'Safety Threat Escalation',
        description: 'Creates 3 roles linked in an escalation chain for non-clinical security incidents and threats.',
        roles: [
            { name: 'Safety Officer', description: 'Primary security responder for violence, threats, or safety incidents.', delay: '30 sec' },
            { name: 'Hospital Administrator On-Call', description: 'Escalation Level 1 — administrator for unacknowledged security incidents.', delay: '3 min' },
            { name: 'CEO', description: 'Final escalation — CEO for unresolved safety or threat situations.', delay: '5 min' },
        ],
    },
    {
        id: 'missing-child',
        name: 'Missing Child',
        description: 'Creates 3 roles linked in an escalation chain for missing child incidents.',
        roles: [
            { name: 'Ward Nurse In-Charge', description: 'Primary responder — ward nurse in charge during missing child incidents.', delay: '30 sec' },
            { name: 'Safety Officer', description: 'Escalation Level 1 — security supervisor for unresolved missing child cases.', delay: '2 min' },
            { name: 'Administrator On-Call', description: 'Final escalation — administrator for unresolved missing child incidents.', delay: '5 min' },
        ],
    },
];

const defaultRoutingRules: RoutingRule[] = [
    { id: 'by-dept', label: 'By Department', desc: 'Escalate to staff within the same department.', enabled: true },
    { id: 'by-floor', label: 'By Floor', desc: 'Escalate to nearest available staff on the same floor.', enabled: false },
    { id: 'by-ward', label: 'By Ward', desc: 'Route to staff assigned to the same ward or unit.', enabled: true },
    { id: 'by-role', label: 'By Role Hierarchy', desc: 'Escalate up the role hierarchy (e.g. Nurse → Charge Nurse → Attending).', enabled: true },
];

/** Level 1 = primary role; at most two further escalation targets (3 steps total). */
const ESCALATION_LADDER_MAX_LEVELS = 3;

/** Single primary row; user adds further targets with "Add escalation level". */
const defaultEscalationLevels: EscalationLevel[] = [
    { level: 1, target: '', delay: '30 sec' },
];

function clampEscalationLevels(levels: EscalationLevel[]): EscalationLevel[] {
    const sorted = [...levels].sort((a, b) => a.level - b.level);
    return sorted.slice(0, ESCALATION_LADDER_MAX_LEVELS).map((l, i) => ({ ...l, level: i + 1 }));
}

const escalationTargetOptions = ['Same Role', 'Supervisor', 'Department Head', 'Admin On-Call', 'Charge Nurse', 'Attending Physician', 'ED Doctor On-Call', 'ED Supervisor', 'CEO', 'Doctor in Charge of Patient', 'Department Lead', 'ICU Doctor On-Call', 'ICU Department Lead', 'OBGYN On-Call', 'OBGYN Department Supervisor', 'Peds Doctor On-Call', 'Peds Unit Lead', 'Anaesthesia On-Call', 'Theatre Supervisor', 'ED Triage On-Call', 'Safety Officer', 'Hospital Administrator On-Call', 'Ward Nurse In-Charge', 'Administrator On-Call'];

function extractDepartmentNames(raw: unknown): string[] {
    const list = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === 'object'
            ? ((raw as { items?: unknown; data?: unknown; departments?: unknown }).items
                || (raw as { items?: unknown; data?: unknown; departments?: unknown }).data
                || (raw as { items?: unknown; data?: unknown; departments?: unknown }).departments)
            : []);

    if (!Array.isArray(list)) return [];

    const names = list
        .map((d: unknown) => {
            if (!d || typeof d !== 'object') return '';
            const rec = d as Record<string, unknown>;
            const nameRaw = rec.name ?? rec.department_name;
            return typeof nameRaw === 'string' ? nameRaw.trim() : '';
        })
        .filter(Boolean);

    return Array.from(new Set(names));
}

function extractStaffOptions(raw: unknown): StaffOption[] {
    let list: unknown = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === 'object'
            ? ((raw as {
                items?: unknown;
                data?: unknown;
                staff?: unknown;
                results?: unknown;
                users?: unknown;
                rows?: unknown;
                records?: unknown;
            }).items
                || (raw as {
                    items?: unknown;
                    data?: unknown;
                    staff?: unknown;
                    results?: unknown;
                    users?: unknown;
                    rows?: unknown;
                    records?: unknown;
                }).data
                || (raw as {
                    items?: unknown;
                    data?: unknown;
                    staff?: unknown;
                    results?: unknown;
                    users?: unknown;
                    rows?: unknown;
                    records?: unknown;
                }).staff
                || (raw as {
                    items?: unknown;
                    data?: unknown;
                    staff?: unknown;
                    results?: unknown;
                    users?: unknown;
                    rows?: unknown;
                    records?: unknown;
                }).results
                || (raw as {
                    items?: unknown;
                    data?: unknown;
                    staff?: unknown;
                    results?: unknown;
                    users?: unknown;
                    rows?: unknown;
                    records?: unknown;
                }).users
                || (raw as {
                    items?: unknown;
                    data?: unknown;
                    staff?: unknown;
                    results?: unknown;
                    users?: unknown;
                    rows?: unknown;
                    records?: unknown;
                }).rows
                || (raw as {
                    items?: unknown;
                    data?: unknown;
                    staff?: unknown;
                    results?: unknown;
                    users?: unknown;
                    rows?: unknown;
                    records?: unknown;
                }).records)
            : []);
    if ((!Array.isArray(list) || list.length === 0) && raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const firstArray = Object.values(raw as Record<string, unknown>).find(v => Array.isArray(v));
        if (firstArray) list = firstArray;
    }
    if (!Array.isArray(list)) return [];
    const rows = list
        .map((item): StaffOption | null => {
            if (!item || typeof item !== 'object') return null;
            const r = item as Record<string, unknown>;
            const id = String(r.id || r.staff_id || '').trim();
            if (!id) return null;
            const first = String(r.first_name || '').trim();
            const last = String(r.last_name || '').trim();
            const full = String(r.name || `${first} ${last}`.trim()).trim();
            const email = String(r.email || '').trim();
            const label = full || email || id;
            return { id, label: email ? `${label} (${email})` : label };
        })
        .filter((s): s is StaffOption => Boolean(s));
    const seen = new Set<string>();
    return rows.filter(s => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
    });
}

function resolveRoleDepartment(
    role: Record<string, unknown>,
    deptMap: Map<string, string>
): string {
    const deptRaw = role.department;
    const deptName = String(role.department_name || '').trim();
    const deptId = String(role.department_id || role.departmentId || '').trim();

    if (deptRaw && typeof deptRaw === 'object' && !Array.isArray(deptRaw)) {
        const nested = deptRaw as Record<string, unknown>;
        const nestedName = String(nested.name || nested.department_name || '').trim();
        if (nestedName) return nestedName;
        const nestedId = String(nested.id || nested.department_id || '').trim();
        if (nestedId && deptMap.has(nestedId)) return deptMap.get(nestedId) || '';
    }

    if (typeof deptRaw === 'string' && deptRaw.trim()) {
        const raw = deptRaw.trim();
        if (deptMap.has(raw)) return deptMap.get(raw) || '';
        return raw;
    }

    // Some backend responses include both department_name and department object/string.
    // Prefer the concrete department field first, then fall back to department_name.
    if (deptName) return deptName;

    if (deptId && deptMap.has(deptId)) return deptMap.get(deptId) || '';
    return '';
}

export default function RolesBuilderAssignment() {
    const DESC_LIMIT = 200;
    const [roles, setRoles] = useState<Role[]>([]);
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [deptIdMap, setDeptIdMap] = useState<Map<string, string>>(new Map());
    /** Department UUID → display name (resolveRoleDepartment expects id → name). */
    const departmentIdToName = useMemo(() => {
        const m = new Map<string, string>();
        deptIdMap.forEach((id, name) => {
            if (id && name) m.set(id, name);
        });
        return m;
    }, [deptIdMap]);
    const [toast, setToast] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Add Role multi-step form state
    const [showAddForm, setShowAddForm] = useState(false);
    const [addStep, setAddStep] = useState(2); // 2 = custom basic info, 3 = custom escalation settings
    const [selectedTemplate, setSelectedTemplate] = useState<RoleTemplate>(roleTemplates[0]);
    const [templateDept, setTemplateDept] = useState('');
    const [templateCreating, setTemplateCreating] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleDesc, setNewRoleDesc] = useState('');
    const [newRoleDept, setNewRoleDept] = useState('');
    const [newRoleMandatory, setNewRoleMandatory] = useState(false);
    const [newRestricted, setNewRestricted] = useState(false);
    const [newRoleExternalMessaging, setNewRoleExternalMessaging] = useState(false);
    const [newAllowedUserIds, setNewAllowedUserIds] = useState<string[]>([]);
    const [newRouting, setNewRouting] = useState<RoutingRule[]>([]);
    const [newEscLevels, setNewEscLevels] = useState<EscalationLevel[]>([]);

    // Edit modal state
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [editStep, setEditStep] = useState(1);
    const [editName, setEditName] = useState(''); // suffix / full name depending on prefix
    const [editPrefix, setEditPrefix] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editDept, setEditDept] = useState('');
    const [editMandatory, setEditMandatory] = useState(false);
    const [editRestricted, setEditRestricted] = useState(false);
    const [editAllowedUserIds, setEditAllowedUserIds] = useState<string[]>([]);
    const [editEnabled, setEditEnabled] = useState(true);
    const [editRouting, setEditRouting] = useState<RoutingRule[]>([]);
    const [editEscLevels, setEditEscLevels] = useState<EscalationLevel[]>([]);
    const [editSaving, setEditSaving] = useState(false);

    // Confirm delete state
    const [confirmDelete, setConfirmDelete] = useState<Role | null>(null);
    const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
    const [facilityExternalEnabled, setFacilityExternalEnabled] = useState(true);

    // Expanded chain indicator in table
    const [expandedChainRoleId, setExpandedChainRoleId] = useState<string | null>(null);
    // Expanded "other chains" in detail panel
    const [showOtherChains, setShowOtherChains] = useState(false);
    // Sign-in staff state
    const [showSignIn, setShowSignIn] = useState(false);
    const [signInUserId, setSignInUserId] = useState<string | null>(null);
    const [signInLoading, setSignInLoading] = useState(false);

    // Compute chain associations for every role: map role name → array of { source, levels }
    const chainsByRole = useMemo(() => {
        const map = new Map<string, { source: string; sourceId: string; levels: EscalationLevel[] }[]>();
        const seen = new Map<string, Set<string>>();
        for (const r of roles) {
            const levels = r.escalation_levels?.length ? r.escalation_levels : [];
            if (levels.length === 0) continue;
            const chainKey = levels.map(l => `${l.target}|${l.delay}`).join(';;');
            const chain = { source: r.name, sourceId: r.id, levels: levels.slice().sort((a, b) => a.level - b.level) };
            for (const lvl of levels) {
                const name = lvl.target.toLowerCase();
                if (!map.has(name)) { map.set(name, []); seen.set(name, new Set()); }
                if (!seen.get(name)!.has(chainKey)) {
                    seen.get(name)!.add(chainKey);
                    map.get(name)!.push(chain);
                }
            }
        }
        return map;
    }, [roles]);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const ingestRolesPagePayloads = useCallback(
        (
            ok: { roles: boolean; depts: boolean; policies: boolean; staff: boolean },
            parsed: {
                roles: unknown;
                departments: unknown;
                policies: unknown;
                staff: unknown;
                facility: unknown | null;
            },
        ) => {
            if (parsed.facility != null && typeof parsed.facility === 'object') {
                const rec = parsed.facility as Record<string, unknown>;
                const v = rec.external_messaging_enabled;
                setFacilityExternalEnabled(v !== false && v !== 'false' && v !== 0);
            }

            let deptMap = new Map<string, string>();
            if (ok.depts && parsed.departments != null) {
                const depts = parsed.departments;
                setDepartments(extractDepartmentNames(depts));
                const deptRec = depts as Record<string, unknown>;
                const list = Array.isArray(depts) ? depts : (deptRec.items || deptRec.data || deptRec.departments || []);
                const nameToId = new Map<string, string>();
                if (Array.isArray(list)) {
                    for (const d of list) {
                        if (!d || typeof d !== 'object') continue;
                        const rec = d as Record<string, unknown>;
                        const depId = typeof rec.id === 'string'
                            ? rec.id
                            : typeof rec.department_id === 'string'
                                ? rec.department_id
                                : '';
                        const nameRaw = rec.name ?? rec.department_name;
                        const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';
                        if (depId && name) {
                            deptMap.set(depId, name);
                            nameToId.set(name, depId);
                        }
                    }
                }
                setDeptIdMap(nameToId);
            }

            let policiesArr: Policy[] = [];
            if (ok.policies && parsed.policies != null) {
                policiesArr = extractPolicies(parsed.policies);
                setPolicies(policiesArr);
            }

            if (ok.staff && parsed.staff != null) {
                setStaffOptions(extractStaffOptions(parsed.staff));
            } else if (!ok.staff) {
                setStaffOptions([]);
            }

            if (ok.roles && parsed.roles != null) {
                const data = parsed.roles;
                const rolesArr = Array.isArray(data) ? data : [];
                const roleNameMap = new Map(rolesArr.map((r: Role) => [r.id, r.name]));
                const policyByRole = new Map(policiesArr.map(p => [p.role_id, p]));
                setRoles(rolesArr.map((r: Role & { department_id?: string; department_name?: string; department?: unknown }) => {
                    const policy = policyByRole.get(r.id);
                    const policyLevels = policy ? stepsToLevels(policy.steps || [], roleNameMap) : [];
                    const deptResolved = resolveRoleDepartment(r as unknown as Record<string, unknown>, deptMap);
                    return normalizeRoleForUi({
                        ...r,
                        department: deptResolved,
                        escalation_routing: r.escalation_routing || [],
                        escalation_levels: policyLevels,
                    }, deptMap);
                }));
            }
        },
        [],
    );

    useLayoutEffect(() => {
        const rolesJ = readCachedJson(ROLES_CACHE_ROLES, ROLES_PAGE_CACHE_TTL_MS);
        const deptsJ = readCachedJson(ROLES_CACHE_DEPTS, ROLES_PAGE_CACHE_TTL_MS);
        const policiesJ = readCachedJson(ROLES_CACHE_POLICIES, ROLES_PAGE_CACHE_TTL_MS);
        const staffJ = readCachedJson(ROLES_CACHE_STAFF, ROLES_PAGE_CACHE_TTL_MS);
        const hospitalJ = readCachedJson(ROLES_CACHE_HOSPITAL, ROLES_PAGE_CACHE_TTL_MS);
        if (rolesJ == null || deptsJ == null || policiesJ == null || staffJ == null || hospitalJ == null) {
            return;
        }
        let facilityJ: unknown | null = null;
        if (hospitalJ && typeof hospitalJ === 'object') {
            const fid = typeof (hospitalJ as Record<string, unknown>).id === 'string'
                ? (hospitalJ as Record<string, unknown>).id
                : '';
            if (fid) facilityJ = readCachedJson(`/api/proxy/facilities/${fid}`, ROLES_PAGE_CACHE_TTL_MS);
        }
        ingestRolesPagePayloads(
            { roles: true, depts: true, policies: true, staff: true },
            {
                roles: rolesJ,
                departments: deptsJ,
                policies: policiesJ,
                staff: staffJ,
                facility: facilityJ,
            },
        );
        setLoading(false);
    }, [ingestRolesPagePayloads]);

    const fetchData = useCallback(async () => {
        try {
            const [rolesRes, deptsRes, policiesRes, staffRes, hospitalRes] = await Promise.all([
                fetch(ROLES_CACHE_ROLES),
                fetch(ROLES_CACHE_DEPTS),
                fetch(ROLES_CACHE_POLICIES),
                fetch(ROLES_CACHE_STAFF),
                fetch(ROLES_CACHE_HOSPITAL),
            ]);

            const [rolesJson, deptsJson, policiesJson, staffJson, hospitalJson] = await Promise.all([
                rolesRes.ok ? rolesRes.json() : Promise.resolve(null),
                deptsRes.ok ? deptsRes.json() : Promise.resolve(null),
                policiesRes.ok ? policiesRes.json() : Promise.resolve(null),
                staffRes.ok ? staffRes.json() : Promise.resolve(null),
                hospitalRes.ok ? hospitalRes.json() : Promise.resolve(null),
            ]);

            let facilityJson: unknown | null = null;
            if (hospitalJson && typeof hospitalJson === 'object') {
                try {
                    const fid = typeof (hospitalJson as Record<string, unknown>).id === 'string'
                        ? (hospitalJson as Record<string, unknown>).id as string
                        : '';
                    if (fid) {
                        const facRes = await fetch(`/api/proxy/facilities/${fid}`);
                        if (facRes.ok) {
                            facilityJson = await facRes.json();
                        }
                    }
                } catch { /* best effort */ }
            }

            ingestRolesPagePayloads(
                {
                    roles: rolesRes.ok,
                    depts: deptsRes.ok,
                    policies: policiesRes.ok,
                    staff: staffRes.ok,
                },
                {
                    roles: rolesJson,
                    departments: deptsJson,
                    policies: policiesJson,
                    staff: staffJson,
                    facility: facilityJson,
                },
            );

            if (rolesRes.ok && rolesJson != null) writeCachedJson(ROLES_CACHE_ROLES, rolesJson);
            if (deptsRes.ok && deptsJson != null) writeCachedJson(ROLES_CACHE_DEPTS, deptsJson);
            if (policiesRes.ok && policiesJson != null) writeCachedJson(ROLES_CACHE_POLICIES, policiesJson);
            if (staffRes.ok && staffJson != null) writeCachedJson(ROLES_CACHE_STAFF, staffJson);
            if (hospitalRes.ok && hospitalJson != null) writeCachedJson(ROLES_CACHE_HOSPITAL, hospitalJson);
            if (facilityJson != null && hospitalJson && typeof hospitalJson === 'object') {
                const hid = typeof (hospitalJson as Record<string, unknown>).id === 'string'
                    ? (hospitalJson as Record<string, unknown>).id as string
                    : '';
                if (hid) writeCachedJson(`/api/proxy/facilities/${hid}`, facilityJson);
            }
        } catch {
            showToast('Failed to load data');
        }
        setLoading(false);
    }, [ingestRolesPagePayloads]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filteredRoles = roles.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.department.toLowerCase().includes(search.toLowerCase())
    );

    const selectedRole = roles.find(r => r.id === selectedId) || null;

    useEffect(() => {
        if (!selectedId) return;
        // Role list can omit full allowlist; fetch detail for accurate sign-in assignment view.
        fetch(`/api/proxy/roles/${selectedId}`)
            .then(async (res) => {
                if (!res.ok) return null;
                const detail = await res.json();
                return detail && typeof detail === 'object'
                    ? detail as Partial<Role> & { id: string }
                    : null;
            })
            .then((detail) => {
                if (!detail?.id) return;
                setRoles(prev => prev.map(r => (r.id === detail.id
                    ? (() => {
                        const detailRec = detail as Record<string, unknown>;
                        const resolvedDept = resolveRoleDepartment(detailRec, departmentIdToName) || (typeof r.department === 'string' ? r.department : '');
                        return normalizeRoleForUi({
                            ...r,
                            ...detail,
                            department: resolvedDept,
                            sign_in_allowed_user_ids: Array.isArray(detail.sign_in_allowed_user_ids) ? detail.sign_in_allowed_user_ids : (r.sign_in_allowed_user_ids || []),
                            sign_in_restricted: Boolean(detail.sign_in_restricted) || (Array.isArray(detail.sign_in_allowed_user_ids) && detail.sign_in_allowed_user_ids.length > 0),
                        } as Role, departmentIdToName);
                    })()
                    : r)));
            })
            .catch(() => {
                // best effort
            });
    }, [selectedId, departmentIdToName]);

    useEffect(() => {
        if (showAddForm && addStep === 3 && !newRoleMandatory) setAddStep(2);
    }, [showAddForm, addStep, newRoleMandatory]);

    useEffect(() => {
        if (editingRole && editStep === 2 && !editMandatory) setEditStep(1);
    }, [editingRole, editStep, editMandatory]);

    const resetAddForm = () => {
        setNewRoleName('');
        setNewRoleDesc('');
        setNewRoleDept('');
        setNewRoleMandatory(false);
        setNewRestricted(false);
        setNewRoleExternalMessaging(false);
        setNewAllowedUserIds([]);
        setNewRouting([]);
        setNewEscLevels([]);
        setAddStep(2);
        setShowAddForm(false);
    };

    const selectTemplate = (template: RoleTemplate) => {
        setSelectedTemplate(template);
        setTemplateDept('');
        setAddStep(1);
    };

    const selectCustomRole = () => {
        setSelectedTemplate(roleTemplates[0]);
        setNewRoleName('');
        setNewRoleDesc('');
        setNewRoleMandatory(false);
        setNewEscLevels(defaultEscalationLevels.map(l => ({ ...l })));
        setAddStep(2);
    };

    const handleCreateFromTemplate = async () => {
        if (!selectedTemplate) return;
        setTemplateCreating(true);
        try {
            const existingNames = new Set(roles.map(r => r.name.toLowerCase()));
            const createdRoles: Role[] = [];
            const skippedNames: string[] = [];

            // 1. Create all roles with Critical priority
            for (const tr of selectedTemplate.roles) {
                if (existingNames.has(tr.name.toLowerCase())) {
                    skippedNames.push(tr.name);
                    continue;
                }
                const res = await fetch('/api/proxy/roles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: tr.name,
                        description: tr.description,
                        department_id: deptIdMap.get(templateDept) || undefined,
                        priority: 'critical',
                    }),
                });
                if (res.ok) {
                    const role = await res.json();
                    createdRoles.push({
                        ...normalizeRoleForUi(role as Role, departmentIdToName),
                        escalation_routing: [],
                        escalation_levels: [],
                    });
                }
            }

            // 2. Create escalation policy for the first role and add steps
            if (createdRoles.length > 0) {
                const policyRes = await fetch('/api/proxy/escalation-policies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        role_id: createdRoles[0].id,
                        initial_timeout_seconds: clampEscalationDelaySeconds(delayToSeconds(selectedTemplate.roles[0]?.delay || '3 min')),
                    }),
                });
                if (policyRes.ok) {
                    const policy = await policyRes.json();
                    // Build steps: for each template role, find the created or existing role ID
                    const stepRows = selectedTemplate.roles
                        .map(tr => {
                            const created = createdRoles.find(r => r.name.toLowerCase() === tr.name.toLowerCase());
                            const existing = roles.find(r => r.name.toLowerCase() === tr.name.toLowerCase());
                            const roleId = created?.id || existing?.id;
                            return roleId ? { target_role_id: roleId, tr } : null;
                        })
                        .filter((row): row is { target_role_id: string; tr: (typeof selectedTemplate.roles)[number] } => Boolean(row));
                    const steps = stepRows.map((row, idx, arr) => ({
                        target_role_id: row.target_role_id,
                        timeout_seconds: arr.length > 1 && idx === arr.length - 1
                            ? MIN_ESCALATION_DELAY_SEC
                            : clampEscalationDelaySeconds(delayToSeconds(row.tr.delay)),
                    }));
                    if (steps.length > 0) {
                        await fetch(`/api/proxy/escalation-policies/${policy.id}/steps/bulk`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ steps }),
                        });
                    }
                }
            }

            setRoles(prev => [...prev, ...createdRoles]);
            if (skippedNames.length > 0 && createdRoles.length > 0) {
                showToast(`${createdRoles.length} created, ${skippedNames.length} skipped (already exist)`);
            } else if (skippedNames.length > 0 && createdRoles.length === 0) {
                showToast(`All roles already exist — nothing created`);
            } else {
                showToast(`${createdRoles.length} roles created from "${selectedTemplate.name}"`);
            }
            resetAddForm();
        } catch { showToast('Failed to create roles from template'); }
        setTemplateCreating(false);
    };

    const handleAddRole = async (withEscalations = true) => {
        if (!newRoleName.trim()) return;
        const fullRoleName = buildRoleName('', newRoleName);
        try {
            const res = await fetch('/api/proxy/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: fullRoleName,
                    description: newRoleDesc.trim(),
                    department_id: deptIdMap.get(newRoleDept) || undefined,
                    priority: newRoleMandatory ? 'critical' : 'standard',
                    sign_in_allowed_user_ids: newRestricted ? newAllowedUserIds : undefined,
                    external_messaging: newRoleExternalMessaging,
                }),
            });
            if (!res.ok) { showToast('Failed to add role'); return; }
            const role = await res.json();

            // Create escalation policy + steps for critical/mandatory roles (max 3 levels)
            const ladderLevels = clampEscalationLevels(newEscLevels);
            let policyLevels = ladderLevels;
            if (withEscalations && newRoleMandatory && ladderLevels.length > 0) {
                const policyRes = await fetch('/api/proxy/escalation-policies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        role_id: role.id,
                        initial_timeout_seconds: clampEscalationDelaySeconds(delayToSeconds(ladderLevels[0]?.delay || '3 min')),
                    }),
                });
                if (policyRes.ok) {
                    const policy = await policyRes.json();
                    const sortedLadder = ladderLevels.filter(l => l.target).sort((a, b) => a.level - b.level);
                    const steps = sortedLadder
                        .map((l, idx, arr) => {
                            const match = roles.find(r => r.name === l.target);
                            return {
                                target_role_id: match?.id || '',
                                target_role_name: l.target,
                                timeout_seconds: arr.length > 1 && idx === arr.length - 1
                                    ? MIN_ESCALATION_DELAY_SEC
                                    : clampEscalationDelaySeconds(delayToSeconds(l.delay)),
                            };
                        })
                        .filter(s => s.target_role_id);
                    if (steps.length > 0) {
                        await fetch(`/api/proxy/escalation-policies/${policy.id}/steps/bulk`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ steps }),
                        });
                    }
                    // Re-fetch policy to get steps with IDs
                    const updatedPolicyRes = await fetch(`/api/proxy/escalation-policies/by-role/${role.id}`);
                    if (updatedPolicyRes.ok) {
                        const updatedPolicy = await updatedPolicyRes.json();
                        const roleNameMap = new Map(roles.map(r => [r.id, r.name]));
                        policyLevels = stepsToLevels(updatedPolicy.steps || [], roleNameMap);
                    }
                }
            }

            setRoles(prev => [...prev, {
                ...normalizeRoleForUi(role as Role, departmentIdToName),
                sign_in_restricted: Boolean(role.sign_in_restricted),
                sign_in_allowed_user_ids: Array.isArray(role.sign_in_allowed_user_ids) ? role.sign_in_allowed_user_ids : [],
                external_messaging: Boolean((role as Role).external_messaging ?? newRoleExternalMessaging),
                escalation_routing: role.escalation_routing || newRouting,
                escalation_levels: policyLevels,
            }]);
            showToast(`"${fullRoleName}" created`);
            resetAddForm();
            fetchData();
        } catch { showToast('Failed to add role'); }
    };

    const handleRemoveRole = async (role: Role) => {
        try {
            const res = await fetch(`/api/proxy/roles/${role.id}`, { method: 'DELETE' });
            if (res.ok) {
                setRoles(prev => prev.filter(r => r.id !== role.id));
                showToast(`"${role.name}" removed`);
                setConfirmDelete(null);
            }
        } catch { showToast('Failed to remove role'); }
    };

    const handleToggleMandatory = async (role: Role) => {
        const newMandatory = !role.mandatory;
        // Optimistic update
        setRoles(prev => prev.map(r => r.id === role.id ? normalizeRoleForUi({ ...r, mandatory: newMandatory }, departmentIdToName) : r));
        try {
            const res = await fetch(`/api/proxy/roles/${role.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priority: newMandatory ? 'critical' : 'standard',
                }),
            });
            if (res.ok) {
                const updated = await res.json();
                setRoles(prev => prev.map(r => r.id === role.id ? normalizeRoleForUi({ ...r, ...updated } as Role, departmentIdToName) : r));
            } else {
                // Rollback on failure
                setRoles(prev => prev.map(r => r.id === role.id ? normalizeRoleForUi({ ...r, mandatory: role.mandatory }, departmentIdToName) : r));
                showToast('Failed to update role');
            }
        } catch {
            // Rollback on error
            setRoles(prev => prev.map(r => r.id === role.id ? normalizeRoleForUi({ ...r, mandatory: role.mandatory }, departmentIdToName) : r));
            showToast('Failed to update role');
        }
    };

    const openEditModal = (role: Role) => {
        setEditingRole(role);
        setEditStep(1);
        const { prefix, suffix } = splitRoleName(role.name);
        setEditPrefix(prefix);
        setEditName(prefix ? suffix : role.name);
        setEditDesc(role.description || '');
        setEditDept(role.department);
        setEditMandatory(Boolean(role.mandatory));
        const baseAllowed = Array.isArray(role.sign_in_allowed_user_ids) ? role.sign_in_allowed_user_ids : [];
        setEditRestricted(Boolean(role.sign_in_restricted) || baseAllowed.length > 0);
        setEditAllowedUserIds(baseAllowed);
        setEditEnabled(role.enabled ?? true);
        setEditRouting((role.escalation_routing || []).map(r => ({ ...r })));
        // Pre-fill level 1 with the role being edited if no levels exist
        const existing = (role.escalation_levels || []).map(l => ({ ...l }));
        if (existing.length > 0) {
            setEditEscLevels(clampEscalationLevels(existing));
        } else {
            setEditEscLevels([{ level: 1, target: role.name, delay: '5 min' }]);
        }
        // Pull full role details (includes full allowlist when restricted).
        fetch(`/api/proxy/roles/${role.id}`)
            .then(async (res) => {
                if (!res.ok) return null;
                const detail = await res.json();
                return detail && typeof detail === 'object' ? detail as { sign_in_restricted?: boolean; sign_in_allowed_user_ids?: string[] } : null;
            })
            .then((detail) => {
                if (!detail) return;
                const ids = Array.isArray(detail.sign_in_allowed_user_ids) ? detail.sign_in_allowed_user_ids : [];
                setEditRestricted(Boolean(detail.sign_in_restricted) || ids.length > 0);
                setEditAllowedUserIds(ids);
            })
            .catch(() => {
                // best effort
            });
    };

    const handleSaveEdit = async (withEscalations = true) => {
        if (!editingRole || !editName.trim()) return;
        const nextName = buildRoleName(editPrefix, editName);
        setEditSaving(true);
        try {
            const normalizedEditDept = editDept.trim();
            const resolvedEditDeptId = normalizedEditDept
                ? (
                    deptIdMap.get(normalizedEditDept)
                    || Array.from(deptIdMap.entries()).find(([name]) => name.trim().toLowerCase() === normalizedEditDept.toLowerCase())?.[1]
                )
                : undefined;
            console.log('[roles-ui][saveEdit] Department debug:', {
                roleId: editingRole.id,
                roleName: editingRole.name,
                selectedDepartment: normalizedEditDept,
                resolvedDepartmentId: resolvedEditDeptId,
                knownDepartments: departments,
            });
            // 1. Update the role itself
            const res = await fetch(`/api/proxy/roles/${editingRole.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: nextName,
                    description: editDesc.trim(),
                    department_id: resolvedEditDeptId,
                    // Match create-role behavior: prefer ID-based department updates.
                    department: !resolvedEditDeptId && normalizedEditDept ? normalizedEditDept : undefined,
                    priority: editMandatory ? 'critical' : 'standard',
                    sign_in_allowed_user_ids: editRestricted ? editAllowedUserIds : [],
                }),
            });
            if (!res.ok) { showToast('Failed to save changes'); setEditSaving(false); return; }
            const updated = await res.json();
            console.log('[roles-ui][saveEdit] Update response department:', {
                department: updated?.department,
                department_id: updated?.department_id,
                department_name: updated?.department_name,
            });

            // 2. Escalation policy: only Critical roles may have a chain; demoting to Standard removes it.
            const ladderLevels = clampEscalationLevels(editEscLevels);
            let finalLevels = ladderLevels;
            if (!editMandatory) {
                try {
                    const existingPolicyRes = await fetch(`/api/proxy/escalation-policies/by-role/${editingRole.id}`);
                    if (existingPolicyRes.ok) {
                        const existingPolicy = await existingPolicyRes.json();
                        if (existingPolicy?.id) {
                            await fetch(`/api/proxy/escalation-policies/${existingPolicy.id}`, { method: 'DELETE' });
                        }
                    }
                } catch {
                    // best effort
                }
                finalLevels = [];
            } else if (withEscalations && ladderLevels.length > 0) {
                // Check if a policy already exists for this role
                const existingPolicyRes = await fetch(`/api/proxy/escalation-policies/by-role/${editingRole.id}`);
                let policyId: string | null = null;

                if (existingPolicyRes.ok) {
                    const existingPolicy = await existingPolicyRes.json();
                    if (existingPolicy?.id) {
                        policyId = existingPolicy.id;
                        // Update timeout
                        await fetch(`/api/proxy/escalation-policies/${policyId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                initial_timeout_seconds: clampEscalationDelaySeconds(delayToSeconds(ladderLevels[0]?.delay || '3 min')),
                            }),
                        });
                        // Delete old steps
                        if (existingPolicy.steps) {
                            for (const step of existingPolicy.steps) {
                                await fetch(`/api/proxy/escalation-policies/${policyId}/steps/${step.id}`, { method: 'DELETE' });
                            }
                        }
                    }
                }

                // Create new policy if none exists
                if (!policyId) {
                    const policyRes = await fetch('/api/proxy/escalation-policies', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            role_id: editingRole.id,
                            initial_timeout_seconds: clampEscalationDelaySeconds(delayToSeconds(ladderLevels[0]?.delay || '3 min')),
                        }),
                    });
                    if (policyRes.ok) {
                        const policy = await policyRes.json();
                        policyId = policy.id;
                    }
                }

                // Bulk add new steps
                if (policyId) {
                    const sortedLadder = ladderLevels.filter(l => l.target).sort((a, b) => a.level - b.level);
                    const steps = sortedLadder
                        .map((l, idx, arr) => {
                            const match = roles.find(r => r.name === l.target);
                            return {
                                target_role_id: match?.id || '',
                                target_role_name: l.target,
                                timeout_seconds: arr.length > 1 && idx === arr.length - 1
                                    ? MIN_ESCALATION_DELAY_SEC
                                    : clampEscalationDelaySeconds(delayToSeconds(l.delay)),
                            };
                        })
                        .filter(s => s.target_role_id);
                    if (steps.length > 0) {
                        await fetch(`/api/proxy/escalation-policies/${policyId}/steps/bulk`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ steps }),
                        });
                    }
                    // Re-fetch to get fresh steps
                    const refreshRes = await fetch(`/api/proxy/escalation-policies/by-role/${editingRole.id}`);
                    if (refreshRes.ok) {
                        const refreshed = await refreshRes.json();
                        const roleNameMap = new Map(roles.map(r => [r.id, r.name]));
                        finalLevels = stepsToLevels(refreshed.steps || [], roleNameMap);
                    }
                }
            }

            setRoles(prev => prev.map(r => {
                if (r.id !== editingRole.id) return r;
                const updatedRec = (updated && typeof updated === 'object') ? updated as Record<string, unknown> : {};
                const prevDeptStr = typeof r.department === 'string'
                    ? r.department
                    : resolveRoleDepartment({ department: r.department as unknown } as Record<string, unknown>, departmentIdToName);
                const responseDeptName =
                    resolveRoleDepartment(updatedRec, departmentIdToName)
                    || editDept.trim()
                    || prevDeptStr;
                return {
                    ...normalizeRoleForUi({ ...r, ...updated } as Role, departmentIdToName),
                    department: responseDeptName,
                    sign_in_restricted: updated.sign_in_restricted !== undefined ? Boolean(updated.sign_in_restricted) : editRestricted,
                    sign_in_allowed_user_ids: Array.isArray(updated.sign_in_allowed_user_ids) ? updated.sign_in_allowed_user_ids : (editRestricted ? editAllowedUserIds : []),
                    escalation_routing: updated.escalation_routing || editRouting,
                    escalation_levels: finalLevels,
                };
            }));
            showToast(`"${editName}" updated`);
            setEditingRole(null);
            fetchData();
        } catch { showToast('Failed to save changes'); }
        setEditSaving(false);
    };

    const roleTargetOptions = useMemo(() => {
        const names = roles.map(r => r.name).filter(Boolean);
        return names.length > 0 ? Array.from(new Set(names)) : escalationTargetOptions;
    }, [roles]);

    const renderSignInRestriction = (
        restricted: boolean,
        setRestricted: (value: boolean) => void,
        allowedUserIds: string[],
        setAllowedUserIds: (ids: string[]) => void
    ) => {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Restricted Sign-in</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                            If enabled, only selected staff can sign into this facility role.
                        </div>
                    </div>
                    <label className="toggle">
                        <input
                            type="checkbox"
                            checked={restricted}
                            onChange={() => {
                                const next = !restricted;
                                setRestricted(next);
                                if (!next) setAllowedUserIds([]);
                            }}
                        />
                        <span className="toggle-slider" />
                    </label>
                </div>

                {restricted && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Select staff members allowed to hold this role.
                        </div>
                        <CustomSelect
                            value=""
                            onChange={(v) => {
                                if (!v) return;
                                if (!allowedUserIds.includes(v)) {
                                    setAllowedUserIds([...allowedUserIds, v]);
                                }
                            }}
                            options={staffOptions
                                .filter(s => !allowedUserIds.includes(s.id))
                                .map(s => ({ label: s.label, value: s.id }))}
                            placeholder={staffOptions.length > 0 ? '-- Add staff to allowlist --' : '-- No staff available --'}
                        />
                        {allowedUserIds.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {allowedUserIds.map(uid => {
                                    const staff = staffOptions.find(s => s.id === uid);
                                    return (
                                        <span key={uid} className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingRight: 4 }}>
                                            {staff?.label || uid}
                                            <button
                                                type="button"
                                                onClick={() => setAllowedUserIds(allowedUserIds.filter(id => id !== uid))}
                                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit', display: 'inline-flex', alignItems: 'center', padding: 0 }}
                                                title="Remove"
                                            >
                                                <span className="material-icons-round" style={{ fontSize: 12 }}>close</span>
                                            </button>
                                        </span>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                No staff selected yet.
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderEscalationLadder = (
        levels: EscalationLevel[],
        setLevels: (levels: EscalationLevel[]) => void,
        fixedFirstTarget?: string
    ) => {
        const sorted = [...levels].sort((a, b) => a.level - b.level);

        const handleAddLevel = () => {
            if (levels.length >= ESCALATION_LADDER_MAX_LEVELS) return;
            const nextLevel = sorted.length > 0 ? sorted[sorted.length - 1].level + 1 : 1;
            setLevels([...levels, { level: nextLevel, target: '', delay: '5 min' }]);
        };

        const handleRemoveLevel = (levelNum: number) => {
            const filtered = levels.filter(l => l.level !== levelNum);
            const renumbered = filtered.sort((a, b) => a.level - b.level).map((l, i) => ({ ...l, level: i + 1 }));
            setLevels(renumbered);
        };

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                <div style={{ marginBottom: 2 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Escalation Ladder</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Level 1 is always this role (primary receiver). Use <strong style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Add escalation level</strong> below to add each further target (up to three levels total).
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {sorted.map((lvl, i) => {
                        const hideDelayRow = sorted.length > 1 && i === sorted.length - 1;
                        return (
                        <div key={lvl.level} style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
                            {/* Level number + connector line */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: 'var(--helix-primary)', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0, zIndex: 1 }}>{lvl.level}</span>
                                {i < sorted.length - 1 && (
                                    <div style={{ width: 2, flex: 1, background: 'var(--border-default)', minHeight: 12 }} />
                                )}
                            </div>
                            {/* Row content */}
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginBottom: i < sorted.length - 1 ? 0 : 0, borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', marginTop: i === 0 ? 0 : 4 }}>
                                {lvl.level === 1 && fixedFirstTarget ? (
                                    <div
                                        style={{
                                            flex: 1,
                                            height: 36,
                                            padding: '0 10px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            border: '1px solid var(--border-default)',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'var(--surface-3)',
                                            color: 'var(--text-secondary)',
                                            fontSize: 13,
                                            fontWeight: 600,
                                        }}
                                        title="Level 1 is fixed to this role"
                                    >
                                        {fixedFirstTarget}
                                    </div>
                                ) : (
                                    <CustomSelect
                                        value={lvl.target}
                                        onChange={v => { const updated = levels.map(l => l.level === lvl.level ? { ...l, target: v } : l); setLevels(updated); }}
                                        options={roleTargetOptions.filter(t => t === lvl.target || !levels.some(l => l.target === t)).map(t => ({ label: t, value: t }))}
                                        placeholder="-- Select Role --"
                                        style={{ flex: 1 }}
                                    />
                                )}
                                {hideDelayRow ? (
                                    <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 100, flexShrink: 0, textAlign: 'center' }} title="No delay after the final target">—</span>
                                ) : (
                                    <CustomSelect
                                        value={lvl.delay}
                                        onChange={v => {
                                            const updated = levels.map(l =>
                                                l.level === lvl.level
                                                    ? {
                                                        ...l,
                                                        delay: v,
                                                        ...(l.level === 1 && fixedFirstTarget ? { target: fixedFirstTarget } : {}),
                                                    }
                                                    : l
                                            );
                                            setLevels(updated);
                                        }}
                                        options={ESCALATION_DELAY_OPTIONS.map(d => ({ label: d, value: d }))}
                                        placeholder="Delay"
                                        style={{ width: 100 }}
                                        maxH={160}
                                        allowCustom
                                        customPlaceholder="e.g. 45 sec, 2 min, 1 hr"
                                    />
                                )}
                                {sorted.length > 1 && lvl.level !== 1 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveLevel(lvl.level)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', borderRadius: 'var(--radius-sm)', transition: 'color 0.15s' }}
                                        title="Remove level"
                                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                                    >
                                        <span className="material-icons-round" style={{ fontSize: 15 }}>close</span>
                                    </button>
                                )}
                            </div>
                        </div>
                        );
                    })}
                </div>
                {sorted.length < ESCALATION_LADDER_MAX_LEVELS && (
                    <button
                        type="button"
                        className="btn btn-secondary btn-xs"
                        onClick={handleAddLevel}
                        style={{ alignSelf: 'flex-start', marginTop: 4 }}
                    >
                        <span className="material-icons-round" style={{ fontSize: 13 }}>add</span>
                        Add escalation level
                    </button>
                )}
            </div>
        );
    };

    // --- Step indicators ---
    const renderStepIndicator = (currentStep: number, isCritical: boolean) => {

        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 26, height: 26, borderRadius: '50%', fontSize: 12, fontWeight: 700,
                        background: currentStep >= 1 ? 'var(--helix-primary)' : 'var(--surface-2)',
                        color: currentStep >= 1 ? '#fff' : 'var(--text-muted)',
                        border: `2px solid ${currentStep >= 1 ? 'var(--helix-primary)' : 'var(--border-default)'}`,
                    }}>1</span>
                    <span style={{ fontSize: 12, fontWeight: currentStep === 1 ? 700 : 500, color: currentStep === 1 ? 'var(--text-primary)' : 'var(--text-muted)' }}>Basic Info</span>
                </div>
                <div style={{ flex: '0 0 40px', height: 2, background: currentStep >= 2 ? 'var(--helix-primary)' : 'var(--border-subtle)', margin: '0 8px', borderRadius: 1 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 26, height: 26, borderRadius: '50%', fontSize: 12, fontWeight: 700,
                        background: currentStep >= 2 ? 'var(--helix-primary)' : 'var(--surface-2)',
                        color: currentStep >= 2 ? '#fff' : 'var(--text-muted)',
                        border: `2px solid ${currentStep >= 2 ? 'var(--helix-primary)' : 'var(--border-default)'}`,
                    }}>2</span>
                    <span style={{ fontSize: 12, fontWeight: currentStep === 2 ? 700 : 500, color: currentStep === 2 ? 'var(--text-primary)' : 'var(--text-muted)' }}>Escalation Settings</span>
                </div>
            </div>
        );
    };


    if (loading) {
        const shimmer = {
            background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border-subtle) 50%, var(--surface-2) 75%)',
            backgroundSize: '400% 100%',
            animation: 'shimmer 1.4s ease infinite',
            borderRadius: 'var(--radius-md)',
        };
        return (
                <div className="app-main">
                    <TopBar title="Roles" subtitle="Role Management" />
                    <main style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>
                        <div className="fade-in card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                                <div style={{ ...shimmer, width: 200, height: 16 }} />
                                <div style={{ ...shimmer, width: 100, height: 32 }} />
                            </div>
                            <div style={{ ...shimmer, width: '100%', height: 36, marginBottom: 16 }} />
                            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} style={{ ...shimmer, height: 48, marginBottom: 8, width: '100%' }} />)}
                        </div>
                    </main>
                </div>
        );
    }

    return (
        <>
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast} variant="success" dismissible={false} />
                </MacVibrancyToastPortal>
            )}

            {/* Edit Modal */}
            {editingRole && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
                    <div className="fade-in card" style={{ width: 540, maxHeight: '85vh', overflow: 'auto', padding: '28px 28px 24px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: 16, marginBottom: 16 }}>Edit Role</h3>

                        {renderStepIndicator(editStep, editMandatory)}

                        {editStep === 1 && (
                            <>
                                <div style={{ marginBottom: 14 }}>
                                    <label className="label">Role Name</label>
                                    {editPrefix ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.45fr) minmax(0, 1fr)', gap: 8 }}>
                                            <input
                                                className="input"
                                                value={editPrefix}
                                                disabled
                                                style={{ fontSize: 13, backgroundColor: 'var(--surface-2)', cursor: 'not-allowed' }}
                                            />
                                            <input
                                                className="input"
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                placeholder="e.g. CEO"
                                                style={{ fontSize: 13 }}
                                            />
                                        </div>
                                    ) : (
                                        <input
                                            className="input"
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            placeholder="e.g. Charge Nurse"
                                            style={{ fontSize: 13 }}
                                        />
                                    )}
                                </div>

                                <div style={{ marginBottom: 14 }}>
                                    <label className="label">Description</label>
                                    <textarea
                                        className="input"
                                        value={editDesc}
                                        maxLength={DESC_LIMIT}
                                        onChange={e => setEditDesc(e.target.value.slice(0, DESC_LIMIT))}
                                        style={{ fontSize: 13, minHeight: 60, resize: 'vertical' }}
                                        placeholder="Describe this role..."
                                    />
                                    <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--text-muted)', textAlign: 'right' }}>
                                        {editDesc.length}/{DESC_LIMIT}
                                    </div>
                                </div>

                                <div style={{ marginBottom: 14 }}>
                                    <label className="label">Department</label>
                                    <CustomSelect
                                        value={editDept}
                                        onChange={v => setEditDept(v)}
                                        options={departments.map(d => ({ label: d, value: d }))}
                                        placeholder="-- Select Department --"
                                    />
                                </div>

                                {renderSignInRestriction(editRestricted, setEditRestricted, editAllowedUserIds, setEditAllowedUserIds)}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: editMandatory ? 'rgba(239,68,68,0.06)' : 'var(--surface-2)', border: `1px solid ${editMandatory ? 'rgba(239,68,68,0.25)' : 'var(--border-subtle)'}`, transition: 'all 0.2s' }}>
                                        <input type="checkbox" className="checkbox" checked={editMandatory} onChange={() => setEditMandatory(!editMandatory)} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>This role must always be filled</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Require at least one person assigned and signed in at all times. Escalation chains are only available for Critical roles.</div>
                                        </div>
                                        <span className={`badge ${editMandatory ? 'badge-critical' : 'badge-neutral'}`} style={{ fontSize: 10, flexShrink: 0 }}>
                                            {editMandatory ? 'Critical' : 'Standard'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>Enabled</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Role is active and can be assigned to staff.</div>
                                        </div>
                                        <label className="toggle">
                                            <input type="checkbox" checked={editEnabled} onChange={() => setEditEnabled(!editEnabled)} />
                                            <span className="toggle-slider" />
                                        </label>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingRole(null)}>Cancel</button>
                                    <>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => handleSaveEdit(false)}
                                            disabled={editSaving || !editName.trim()}
                                        >
                                            {editSaving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => {
                                                if (!editMandatory) {
                                                    showToast('Escalation is only available for Critical roles. Turn on “This role must always be filled” first.');
                                                    return;
                                                }
                                                setEditStep(2);
                                            }}
                                            disabled={!editName.trim()}
                                        >
                                            Next: Escalation Settings
                                            <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_forward</span>
                                        </button>
                                    </>
                                </div>
                            </>
                        )}

                        {editStep === 2 && (
                            <>
                                {renderEscalationLadder(editEscLevels, setEditEscLevels, editName || editingRole.name)}

                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 20 }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setEditStep(1)}>
                                        <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_back</span>
                                        Back
                                    </button>
                                    <button className="btn btn-primary btn-sm" onClick={() => handleSaveEdit()} disabled={editSaving || !editName.trim()} style={{ opacity: editSaving ? 0.7 : 1 }}>
                                        {editSaving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            {confirmDelete && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setConfirmDelete(null)}>
                    <div className="fade-in card" style={{ width: 400, padding: '24px 28px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: 16, marginBottom: 8 }}>Remove Role</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
                            Are you sure you want to remove <strong style={{ color: 'var(--text-primary)' }}>{confirmDelete.name}</strong>? This action cannot be undone.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleRemoveRole(confirmDelete)}>Remove</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="app-main">
                <TopBar
                    title="Roles"
                    subtitle="Role Management"
                    search={{ placeholder: 'Search roles...', value: search, onChange: setSearch }}
                    actions={
                        <button className="btn btn-primary btn-sm" onClick={() => { if (showAddForm) resetAddForm(); else { setShowAddForm(true); setAddStep(2); setNewEscLevels(defaultEscalationLevels.map(l => ({ ...l }))); } }}>
                            <span className="material-icons-round" style={{ fontSize: 14 }}>{showAddForm ? 'close' : 'add'}</span>
                            {showAddForm ? 'Cancel' : 'Add Role'}
                        </button>
                    }
                />

                <main style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>

                    {/* Add Role Multi-Step Form */}
                    {showAddForm && (
                        <div className="fade-in card" style={{ marginBottom: 18, padding: '22px 24px' }}>
                            <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Create New Role</h4>

                            {/* Step 0: Template Selection */}
                            {false && addStep === 0 && (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 14 }}>
                                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Select a template or create a custom role.</p>
                                        <span className="material-icons-round" title="Templates create multiple linked roles in an escalation chain. The first role is the primary responder — if they don't respond, it escalates to the next role." style={{ fontSize: 15, color: 'var(--text-disabled)', cursor: 'help' }}>info</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                                        {roleTemplates.map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => selectTemplate(t)}
                                                style={{
                                                    textAlign: 'left', padding: '12px 14px', borderRadius: 'var(--radius-md)',
                                                    background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
                                                    cursor: 'pointer', transition: 'all 0.15s',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--helix-primary)'; e.currentTarget.style.background = 'var(--surface-card)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
                                            >
                                                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{t.name}</div>
                                                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                                    {t.roles.map(r => r.name).join(' \u2192 ')}
                                                </div>
                                            </button>
                                        ))}
                                        <button
                                            onClick={selectCustomRole}
                                            style={{
                                                textAlign: 'left', padding: '12px 14px', borderRadius: 'var(--radius-md)',
                                                background: 'var(--surface-2)', border: '2px dashed var(--border-default)',
                                                cursor: 'pointer', transition: 'all 0.15s',
                                                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 6,
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--helix-primary)'; e.currentTarget.style.background = 'var(--surface-card)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
                                        >
                                            <span className="material-icons-round" style={{ fontSize: 20, color: 'var(--text-muted)' }}>add_circle_outline</span>
                                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>Custom Role</div>
                                            <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Create a single role manually</div>
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* Step 1: Template Confirmation — shows which roles will be created */}
                            {false && addStep === 1 && selectedTemplate && (() => {
                                const existingNames = new Set(roles.map(r => r.name.toLowerCase()));
                                const newCount = selectedTemplate.roles.filter(tr => !existingNames.has(tr.name.toLowerCase())).length;
                                const allExist = newCount === 0;
                                return (
                                <>
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, marginBottom: 16 }}>
                                        {allExist
                                            ? <>All roles in this template <strong style={{ color: 'var(--text-primary)' }}>already exist</strong>.</>
                                            : <>This will create <strong style={{ color: 'var(--text-primary)' }}>{newCount} role{newCount !== 1 ? 's' : ''}</strong>{newCount < selectedTemplate.roles.length ? ` (${selectedTemplate.roles.length - newCount} already exist)` : ''} linked in an escalation chain.</>
                                        }
                                    </p>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 18 }}>
                                        {selectedTemplate.roles.map((tr, i) => {
                                            const alreadyExists = existingNames.has(tr.name.toLowerCase());
                                            return (
                                            <div key={i} style={{ display: 'flex', alignItems: 'stretch', gap: 10, opacity: alreadyExists ? 0.5 : 1 }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 26, flexShrink: 0 }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: alreadyExists ? 'var(--surface-3)' : i === 0 ? 'var(--helix-primary)' : 'var(--surface-3)', color: alreadyExists ? 'var(--text-disabled)' : i === 0 ? '#fff' : 'var(--text-secondary)', fontSize: 10, fontWeight: 700, flexShrink: 0, zIndex: 1 }}>{i + 1}</span>
                                                    {i < selectedTemplate.roles.length - 1 && (
                                                        <div style={{ width: 2, flex: 1, background: 'var(--border-default)', minHeight: 10 }} />
                                                    )}
                                                </div>
                                                <div style={{ flex: 1, padding: '8px 14px', borderRadius: 'var(--radius-md)', background: alreadyExists ? 'transparent' : 'var(--surface-2)', border: `1px solid ${alreadyExists ? 'var(--border-subtle)' : 'var(--border-subtle)'}`, marginTop: i === 0 ? 0 : 4 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                                        <span style={{ fontSize: 13, fontWeight: 600, color: alreadyExists ? 'var(--text-disabled)' : 'var(--text-primary)', textDecoration: alreadyExists ? 'line-through' : 'none' }}>{tr.name}</span>
                                                        {alreadyExists
                                                            ? <span className="badge badge-neutral" style={{ fontSize: 9 }} title="This role already exists and will be part of the escalation chain — it won't be created again.">Already exists</span>
                                                            : <>
                                                                {i === 0 && <span className="badge badge-critical" style={{ fontSize: 9 }}>Primary</span>}
                                                                {i > 0 && i < selectedTemplate.roles.length - 1 && <span className="badge badge-warning" style={{ fontSize: 9 }}>Escalation Level {i}</span>}
                                                                {i === selectedTemplate.roles.length - 1 && i > 0 && <span className="badge badge-info" style={{ fontSize: 9 }}>Final Escalation</span>}
                                                            </>
                                                        }
                                                    </div>
                                                    {!alreadyExists && <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{tr.description}</div>}
                                                    {!alreadyExists && i > 0 && i < selectedTemplate.roles.length - 1 && (
                                                        <div style={{ fontSize: 10, color: 'var(--text-disabled)', marginTop: 3 }}>Escalates after +{tr.delay}</div>
                                                    )}
                                                </div>
                                            </div>
                                            );
                                        })}
                                    </div>

                                    <div style={{ marginBottom: 18 }}>
                                        <label className="label">Department (optional)</label>
                                        <CustomSelect
                                            value={templateDept}
                                            onChange={v => setTemplateDept(v)}
                                            options={departments.map(d => ({ label: d, value: d }))}
                                            placeholder="-- Select Department --"
                                        />
                                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>All roles in the chain will be assigned to this department.</div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedTemplate(roleTemplates[0]); setAddStep(0); }}>
                                            <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_back</span>
                                            Back
                                        </button>
                                        <button className="btn btn-primary btn-sm" onClick={handleCreateFromTemplate} disabled={templateCreating || allExist} style={{ opacity: (templateCreating || allExist) ? 0.5 : 1 }}>
                                            <span className="material-icons-round" style={{ fontSize: 14 }}>check</span>
                                            {templateCreating ? 'Creating...' : allExist ? 'All Roles Exist' : `Create ${newCount} Role${newCount !== 1 ? 's' : ''}`}
                                        </button>
                                    </div>
                                </>
                                );
                            })()}

                            {/* Step 2: Custom Role — Basic Info */}
                            {addStep === 2 && (
                                <>
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, marginBottom: 16 }}>Create a single custom role with its own settings.</p>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                                        <div>
                                            <label className="label">Role Name</label>
                                            <input
                                                className="input"
                                                placeholder="e.g. AMC - CEO"
                                                value={newRoleName}
                                                onChange={e => setNewRoleName(e.target.value)}
                                                style={{ fontSize: 13 }}
                                            />
                                        </div>
                                        <div>
                                            <label className="label">Department</label>
                                            <CustomSelect
                                                value={newRoleDept}
                                                onChange={v => setNewRoleDept(v)}
                                                options={departments.map(d => ({ label: d, value: d }))}
                                                placeholder="-- Select --"
                                            />
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: 14 }}>
                                        <label className="label">Description</label>
                                        <textarea
                                            className="input"
                                            value={newRoleDesc}
                                            maxLength={DESC_LIMIT}
                                            onChange={e => setNewRoleDesc(e.target.value.slice(0, DESC_LIMIT))}
                                            style={{ fontSize: 13, minHeight: 60, resize: 'vertical' }}
                                            placeholder="Describe this role..."
                                        />
                                        <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--text-muted)', textAlign: 'right' }}>
                                            {newRoleDesc.length}/{DESC_LIMIT}
                                        </div>
                                    </div>

                                    {renderSignInRestriction(newRestricted, setNewRestricted, newAllowedUserIds, setNewAllowedUserIds)}

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: newRoleExternalMessaging ? 'rgba(14,165,233,0.06)' : 'var(--surface-2)', border: `1px solid ${newRoleExternalMessaging ? 'rgba(14,165,233,0.22)' : 'var(--border-subtle)'}`, marginBottom: 14, transition: 'all 0.2s' }}>
                                        <input type="checkbox" className="checkbox" checked={newRoleExternalMessaging} onChange={() => setNewRoleExternalMessaging(!newRoleExternalMessaging)} />
                                        <span className="material-icons-round" style={{ fontSize: 18, color: newRoleExternalMessaging ? '#0ea5e9' : 'var(--text-muted)', flexShrink: 0 }}>forum</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>External communication</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Allow cross-facility messaging for this role when your facility has external communication enabled.</div>
                                        </div>
                                        <span className={`badge ${newRoleExternalMessaging ? 'badge-info' : 'badge-neutral'}`} style={{ fontSize: 10, flexShrink: 0 }}>
                                            {newRoleExternalMessaging ? 'On' : 'Off'}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: newRoleMandatory ? 'rgba(239,68,68,0.06)' : 'var(--surface-2)', border: `1px solid ${newRoleMandatory ? 'rgba(239,68,68,0.25)' : 'var(--border-subtle)'}`, marginBottom: 18, transition: 'all 0.2s' }}>
                                        <input type="checkbox" className="checkbox" checked={newRoleMandatory} onChange={() => setNewRoleMandatory(!newRoleMandatory)} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>This role must always be filled</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Marking as mandatory sets priority to Critical. Escalation chains are only available for Critical roles.</div>
                                        </div>
                                        <span className={`badge ${newRoleMandatory ? 'badge-critical' : 'badge-neutral'}`} style={{ fontSize: 10, flexShrink: 0 }}>
                                            {newRoleMandatory ? 'Critical' : 'Standard'}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <button className="btn btn-secondary btn-sm" onClick={resetAddForm}>
                                            <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_back</span>
                                            Cancel
                                        </button>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="btn btn-secondary btn-sm" onClick={() => handleAddRole(false)} disabled={!newRoleName.trim()}>
                                                <span className="material-icons-round" style={{ fontSize: 14 }}>skip_next</span>
                                                Skip Escalation
                                            </button>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => {
                                                    if (!newRoleMandatory) {
                                                        showToast('Escalation is only available for Critical roles. Turn on “This role must always be filled” first.');
                                                        return;
                                                    }
                                                    setAddStep(3);
                                                }}
                                                disabled={!newRoleName.trim()}
                                            >
                                                Next: Escalation Settings
                                                <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_forward</span>
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Step 3: Custom Role — Escalation Settings */}
                            {addStep === 3 && (
                                <>
                                    {renderEscalationLadder(newEscLevels, setNewEscLevels, newRoleName || 'This role')}

                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 20 }}>
                                        <button className="btn btn-secondary btn-sm" onClick={() => setAddStep(2)}>
                                            <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_back</span>
                                            Back
                                        </button>
                                        <button className="btn btn-primary btn-sm" onClick={() => handleAddRole()} disabled={!newRoleName.trim()}>
                                            <span className="material-icons-round" style={{ fontSize: 14 }}>check</span>
                                            Create Role
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: selectedRole ? 'minmax(0, 1fr) minmax(300px, 340px)' : '1fr',
                            gap: 20,
                            alignItems: 'start',
                            width: '100%',
                            minWidth: 0,
                        }}
                    >
                        {/* Roles Table — horizontal scroll when narrow; cells stay single-line */}
                        <div
                            className="fade-in delay-1 card"
                            style={{
                                padding: 0,
                                minWidth: 0,
                                maxWidth: '100%',
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            <div
                                style={{
                                    flex: '1 1 auto',
                                    overflowX: 'auto',
                                    overflowY: 'hidden',
                                    WebkitOverflowScrolling: 'touch',
                                    width: '100%',
                                    maxWidth: '100%',
                                    minWidth: 0,
                                }}
                            >
                            <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'auto' }}>
                                <thead>
                                    <tr>
                                        <th
                                            style={{
                                                padding: '12px 16px',
                                                textAlign: 'left',
                                                fontSize: 11,
                                                fontWeight: 600,
                                                color: 'var(--text-muted)',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                whiteSpace: 'nowrap',
                                                position: 'sticky',
                                                left: 0,
                                                zIndex: 5,
                                                background: '#ffffff',
                                                boxShadow: '4px 0 10px -4px rgba(15, 23, 42, 0.12)',
                                                borderBottom: '1px solid var(--border-default)',
                                            }}
                                        >
                                            Role Name
                                        </th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', background: '#ffffff', borderBottom: '1px solid var(--border-default)' }}>Department</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', background: '#ffffff', borderBottom: '1px solid var(--border-default)' }}>Priority</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', background: '#ffffff', borderBottom: '1px solid var(--border-default)' }}>Escalation</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', background: '#ffffff', borderBottom: '1px solid var(--border-default)' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRoles.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                                                {search ? 'No roles match your search.' : 'No roles configured yet. Click "Add Role" to get started.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRoles.map(role => {
                                            const activeRules = (role.escalation_routing || []).filter(r => r.enabled).length;
                                            const totalRules = (role.escalation_routing || []).length;
                                            const associatedChains = chainsByRole.get(role.name.toLowerCase()) || [];
                                            const chainCount = associatedChains.length;
                                            const isChainExpanded = expandedChainRoleId === role.id;
                                            return (
                                                <tr
                                                    key={role.id}
                                                    onClick={() => { setSelectedId(role.id); setShowOtherChains(false); setShowSignIn(false); setSignInUserId(null); }}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <td
                                                        style={{
                                                            padding: '12px 16px',
                                                            position: 'sticky',
                                                            left: 0,
                                                            zIndex: 2,
                                                            whiteSpace: 'nowrap',
                                                            verticalAlign: 'middle',
                                                            background: selectedId === role.id ? '#edf1f7' : '#ffffff',
                                                            boxShadow: '4px 0 10px -4px rgba(15, 23, 42, 0.1)',
                                                            borderBottom: '1px solid var(--border-subtle)',
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                                                            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{role.name}</div>
                                                            {!role.enabled && <span className="badge badge-neutral" style={{ fontSize: 9 }}>Disabled</span>}
                                                            {chainCount > 1 && (
                                                                <button
                                                                    onClick={e => { e.stopPropagation(); setExpandedChainRoleId(isChainExpanded ? null : role.id); }}
                                                                    style={{
                                                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                                                        background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                                                                        borderRadius: 10, padding: '2px 8px', cursor: 'pointer',
                                                                        fontSize: 10, fontWeight: 600, color: 'var(--helix-primary)',
                                                                        transition: 'all 0.15s',
                                                                    }}
                                                                    title={`Used in ${chainCount} escalation chains`}
                                                                >
                                                                    <span className="material-icons-round" style={{ fontSize: 12 }}>device_hub</span>
                                                                    {chainCount} Chains
                                                                </button>
                                                            )}
                                                        </div>
                                                        {isChainExpanded && chainCount > 1 && (
                                                            <div
                                                                onClick={e => e.stopPropagation()}
                                                                style={{
                                                                    position: 'absolute', top: '100%', left: 16, zIndex: 30,
                                                                    background: 'var(--surface-card)', border: '1px solid var(--border-default)',
                                                                    borderRadius: 'var(--radius-md)', boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                                                    padding: '8px 0', minWidth: 220, marginTop: 2,
                                                                }}
                                                            >
                                                                <div style={{ padding: '4px 12px 6px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                                    Escalation Chains ({chainCount})
                                                                </div>
                                                                {associatedChains.map((chain, ci) => {
                                                                    const isSelf = chain.sourceId === role.id;
                                                                    return (
                                                                        <button
                                                                            key={ci}
                                                                            onClick={e => {
                                                                                e.stopPropagation();
                                                                                setExpandedChainRoleId(null);
                                                                                setShowOtherChains(false);
                                                                                setSelectedId(chain.sourceId);
                                                                            }}
                                                                            style={{
                                                                                display: 'flex', alignItems: 'center', gap: 8,
                                                                                width: '100%', textAlign: 'left', padding: '7px 12px',
                                                                                background: 'transparent', border: 'none', cursor: 'pointer',
                                                                                fontSize: 12, color: 'var(--text-primary)', transition: 'background 0.1s',
                                                                            }}
                                                                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                                                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                                                        >
                                                                            <span className="material-icons-round" style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                                                                                {isSelf ? 'radio_button_checked' : 'arrow_forward'}
                                                                            </span>
                                                                            <span style={{ flex: 1, fontWeight: isSelf ? 600 : 400 }}>
                                                                                {chain.source} chain
                                                                            </span>
                                                                            {isSelf && <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 500 }}>Current</span>}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle', background: selectedId === role.id ? '#edf1f7' : '#ffffff', borderBottom: '1px solid var(--border-subtle)' }}>
                                                        <span style={{ fontSize: 13, color: role.department ? 'var(--text-secondary)' : 'var(--text-disabled)', whiteSpace: 'nowrap' }}>
                                                            {role.department || 'Unassigned'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle', background: selectedId === role.id ? '#edf1f7' : '#ffffff', borderBottom: '1px solid var(--border-subtle)' }}>
                                                        <span className={`badge ${role.priority === 'Critical' ? 'badge-critical' : role.priority === 'High' ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: 10 }}>
                                                            {role.priority || 'Standard'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'middle', background: selectedId === role.id ? '#edf1f7' : '#ffffff', borderBottom: '1px solid var(--border-subtle)' }}>
                                                        {role.priority === 'Critical' ? (
                                                            role.escalation_levels?.length > 0 ? (
                                                                <span className="badge badge-info" style={{ fontSize: 10 }}>
                                                                    {role.escalation_levels.length} steps
                                                                </span>
                                                            ) : (
                                                                <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>No policy</span>
                                                            )
                                                        ) : (
                                                            <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>N/A</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'middle', background: selectedId === role.id ? '#edf1f7' : '#ffffff', borderBottom: '1px solid var(--border-subtle)' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, flexWrap: 'nowrap' }}>
                                                            <button className="btn btn-secondary btn-xs" onClick={e => { e.stopPropagation(); openEditModal(role); }}>
                                                                <span className="material-icons-round" style={{ fontSize: 13 }}>edit</span>
                                                            </button>
                                                            <button className="btn btn-danger btn-xs" onClick={e => { e.stopPropagation(); setConfirmDelete(role); }}>
                                                                <span className="material-icons-round" style={{ fontSize: 13 }}>delete</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                            </div>
                            {filteredRoles.length > 0 && (
                                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                                    Showing {filteredRoles.length} of {roles.length} roles
                                </div>
                            )}
                        </div>

                        {/* Detail Panel */}
                        {selectedRole && (
                            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, alignSelf: 'start' }}>
                                {/* Role Header */}
                                <div className="card" style={{ padding: '18px 20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                <h3 style={{ fontSize: 16, fontWeight: 700, wordBreak: 'break-word', margin: 0 }}>{selectedRole.name}</h3>
                                                {(chainsByRole.get(selectedRole.name.toLowerCase()) || []).length > 1 && (
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 3,
                                                        background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                                                        borderRadius: 10, padding: '1px 7px',
                                                        fontSize: 10, fontWeight: 600, color: 'var(--helix-primary)',
                                                    }}>
                                                        <span className="material-icons-round" style={{ fontSize: 11 }}>device_hub</span>
                                                        {(chainsByRole.get(selectedRole.name.toLowerCase()) || []).length} Chains
                                                    </span>
                                                )}
                                            </div>
                                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{selectedRole.department || 'No department'}</p>
                                            {selectedRole.description && (
                                                <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.4 }}>{selectedRole.description}</p>
                                            )}
                                        </div>
                                        <button className="btn btn-primary btn-xs" style={{ flexShrink: 0 }} onClick={() => openEditModal(selectedRole)}>
                                            <span className="material-icons-round" style={{ fontSize: 13 }}>edit</span>Edit
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        <span className={`badge ${selectedRole.priority === 'Critical' ? 'badge-critical' : selectedRole.priority === 'High' ? 'badge-warning' : 'badge-neutral'}`}>{selectedRole.priority || 'Standard'}</span>
                                        <span className={`badge ${selectedRole.enabled ? 'badge-success' : 'badge-neutral'}`}>{selectedRole.enabled ? 'Active' : 'Disabled'}</span>
                                        {selectedRole.mandatory && <span className="badge badge-info">Mandatory</span>}
                                        {(selectedRole.sign_in_restricted || (selectedRole.sign_in_allowed_user_ids || []).length > 0) && <span className="badge badge-warning">Restricted Sign-in</span>}
                                    </div>
                                </div>

                                {/* Configuration Summary */}
                                <div className="card" style={{ padding: '16px 20px' }}>
                                    <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Configuration</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {[
                                            { label: 'Priority', value: selectedRole.priority || 'Standard', icon: 'flag' },
                                            { label: 'Status', value: selectedRole.enabled ? 'Active' : 'Disabled', icon: selectedRole.enabled ? 'check_circle' : 'cancel' },
                                            { label: 'Mandatory', value: selectedRole.mandatory ? 'Required' : 'Optional', icon: selectedRole.mandatory ? 'verified' : 'remove_circle_outline' },
                                            { label: 'Sign-in', value: (selectedRole.sign_in_restricted || (selectedRole.sign_in_allowed_user_ids || []).length > 0) ? 'Restricted' : 'Open', icon: 'security' },
                                            {
                                                label: 'External comm',
                                                value: !facilityExternalEnabled
                                                    ? 'Disabled'
                                                    : selectedRole.external_messaging ? 'Enabled' : 'Disabled',
                                                icon: 'forum',
                                            },
                                        ].map(row => (
                                            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--text-muted)', width: 20 }}>{row.icon}</span>
                                                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 80 }}>{row.label}</span>
                                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{row.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Sign-in Assignment Summary */}
                                <div className="card" style={{ padding: '16px 20px' }}>
                                    <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Sign-in Assignment</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                            <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--text-muted)', width: 20 }}>person_pin</span>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Currently signed in</div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 1 }}>
                                                    {(() => {
                                                        const su = selectedRole.signed_in_user;
                                                        if (su) {
                                                            const full = (su.name || `${su.first_name || ''} ${su.last_name || ''}`.trim() || '').trim();
                                                            return full || su.email || su.id || '—';
                                                        }
                                                        if (selectedRole.signed_in_by) {
                                                            const matched = staffOptions.find(s => s.id === selectedRole.signed_in_by);
                                                            return matched ? staffNameOnly(matched.label) : selectedRole.signed_in_by;
                                                        }
                                                        return 'No one signed in';
                                                    })()}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                            <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--text-muted)', width: 20 }}>verified_user</span>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Allowed staff</div>
                                                {(selectedRole.sign_in_allowed_user_ids || []).length > 0 ? (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                                        {(selectedRole.sign_in_allowed_user_ids || []).map(uid => {
                                                            const matched = staffOptions.find(s => s.id === uid);
                                                            return (
                                                                <span key={uid} className="badge badge-info">
                                                                    {matched ? staffNameOnly(matched.label) : uid}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 1 }}>
                                                        {(selectedRole.sign_in_restricted || false) ? 'No staff assigned' : 'Open to eligible staff'
                                                        }
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Sign In Staff Action */}
                                <div className="card" style={{ padding: '16px 20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showSignIn ? 12 : 0 }}>
                                        <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Sign In Staff</h4>
                                        <button
                                            className={`btn ${showSignIn ? 'btn-secondary' : 'btn-primary'} btn-xs`}
                                            onClick={() => { setShowSignIn(!showSignIn); setSignInUserId(null); }}
                                        >
                                            <span className="material-icons-round" style={{ fontSize: 13 }}>{showSignIn ? 'close' : 'login'}</span>
                                            {showSignIn ? 'Cancel' : 'Sign In'}
                                        </button>
                                    </div>
                                    {showSignIn && (
                                        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                Select a staff member to sign into this role. If someone is already signed in, they will be replaced.
                                            </div>
                                            <CustomSelect
                                                value={signInUserId || ''}
                                                onChange={v => setSignInUserId(v || null)}
                                                options={(() => {
                                                    const allowed = selectedRole.sign_in_allowed_user_ids || [];
                                                    const isRestricted = selectedRole.sign_in_restricted || allowed.length > 0;
                                                    const filtered = isRestricted ? staffOptions.filter(s => allowed.includes(s.id)) : staffOptions;
                                                    return filtered.map(s => ({ label: s.label, value: s.id }));
                                                })()}
                                                placeholder={(() => {
                                                    const allowed = selectedRole.sign_in_allowed_user_ids || [];
                                                    const isRestricted = selectedRole.sign_in_restricted || allowed.length > 0;
                                                    if (isRestricted && allowed.length === 0) return '-- No allowed staff configured --';
                                                    return '-- Select staff member --';
                                                })()}
                                            />
                                            {signInUserId && (() => {
                                                const staff = staffOptions.find(s => s.id === signInUserId);
                                                return (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--helix-primary)' }}>
                                                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--helix-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                                                            {staffNameOnly(staff?.label || '').split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{staffNameOnly(staff?.label || signInUserId)}</div>
                                                        </div>
                                                        <button
                                                            className="btn btn-primary btn-xs"
                                                            disabled={signInLoading}
                                                            onClick={async () => {
                                                                setSignInLoading(true);
                                                                try {
                                                                    const res = await fetch(`/api/proxy/roles/${selectedRole.id}/sign-in-user`, {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ user_id: signInUserId }),
                                                                    });
                                                                    if (!res.ok) {
                                                                        showToast('Failed to sign in staff');
                                                                        setSignInLoading(false);
                                                                        return;
                                                                    }
                                                                    const updated = await res.json();
                                                                    setRoles(prev => prev.map(r => r.id === selectedRole.id ? {
                                                                        ...r,
                                                                        signed_in_user: updated.signed_in_user || { id: signInUserId, first_name: staffNameOnly(staff?.label || '').split(' ')[0], last_name: staffNameOnly(staff?.label || '').split(' ').slice(1).join(' ') },
                                                                        signed_in_by: updated.signed_in_by || undefined,
                                                                    } : r));
                                                                    showToast(`${staffNameOnly(staff?.label || 'Staff')} signed into ${selectedRole.name}`);
                                                                    setShowSignIn(false);
                                                                    setSignInUserId(null);
                                                                } catch {
                                                                    showToast('Failed to sign in staff');
                                                                }
                                                                setSignInLoading(false);
                                                            }}
                                                            style={{ padding: '4px 12px' }}
                                                        >
                                                            <span className="material-icons-round" style={{ fontSize: 12 }}>login</span>
                                                            {signInLoading ? 'Signing in...' : 'Confirm'}
                                                        </button>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>

                                {/* Escalation Summary — own chain + collapsible other chains */}
                                {(() => {
                                    // Standard priority + not mandatory → no escalation
                                    if (selectedRole.priority !== 'Critical' && !selectedRole.mandatory) {
                                        return (
                                            <div className="card" style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: 'var(--surface-2)', border: '1px dashed var(--border-subtle)', boxShadow: 'none' }}>
                                                <span className="material-icons-round" style={{ fontSize: 28, color: 'var(--text-disabled)', marginBottom: 10 }}>notifications_off</span>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Escalation Disabled</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, maxWidth: 200, lineHeight: 1.4 }}>Only critical or mandatory roles can have escalation chains.</div>
                                            </div>
                                        );
                                    }
                                    const roleName = selectedRole.name.toLowerCase();
                                    const allChains: { source: string; sourceId: string; levels: EscalationLevel[] }[] = [];
                                    const seen = new Set<string>();
                                    for (const r of roles) {
                                        const levels = r.escalation_levels?.length ? r.escalation_levels : [];
                                        if (levels.length === 0) continue;
                                        const mentions = levels.some(l => l.target.toLowerCase() === roleName);
                                        if (!mentions && r.id !== selectedRole.id) continue;
                                        const key = levels.map(l => `${l.target}|${l.delay}`).join(';;');
                                        if (seen.has(key)) continue;
                                        seen.add(key);
                                        allChains.push({ source: r.name, sourceId: r.id, levels: levels.slice().sort((a, b) => a.level - b.level) });
                                    }
                                    if (allChains.length === 0) {
                                        if (selectedRole.escalation_levels?.length) {
                                            allChains.push({ source: selectedRole.name, sourceId: selectedRole.id, levels: selectedRole.escalation_levels.slice().sort((a, b) => a.level - b.level) });
                                        } else {
                                            return (
                                                <div className="card" style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: 'var(--surface-2)', border: '1px dashed var(--border-subtle)', boxShadow: 'none' }}>
                                                    <span className="material-icons-round" style={{ fontSize: 28, color: 'var(--text-disabled)', marginBottom: 10 }}>link_off</span>
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>No Escalation Policy</div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, maxWidth: 220, lineHeight: 1.4 }}>This role has no escalation policy configured yet. Create one in the Escalation Config page.</div>
                                                </div>
                                            );
                                        }
                                    }
                                    // Separate own chain from others
                                    const ownIdx = allChains.findIndex(c => c.sourceId === selectedRole.id);
                                    const ownChain = ownIdx >= 0 ? allChains[ownIdx] : allChains[0];
                                    const otherChains = allChains.filter((_, i) => i !== (ownIdx >= 0 ? ownIdx : 0));

                                    const renderLadder = (levels: EscalationLevel[]) => (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                            {levels.map((lvl, i, arr) => {
                                                const isCurrentRole = lvl.target.toLowerCase() === roleName;
                                                return (
                                                    <div key={lvl.level} style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 26, flexShrink: 0 }}>
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: isCurrentRole ? 'var(--helix-primary)' : 'var(--surface-3)', color: isCurrentRole ? '#fff' : 'var(--text-secondary)', fontSize: 10, fontWeight: 700, flexShrink: 0, zIndex: 1 }}>{lvl.level}</span>
                                                            {i < arr.length - 1 && (
                                                                <div style={{ width: 2, flex: 1, background: 'var(--border-default)', minHeight: 10 }} />
                                                            )}
                                                        </div>
                                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderRadius: 'var(--radius-md)', background: isCurrentRole ? 'rgba(59,130,246,0.08)' : 'var(--surface-2)', border: `1px solid ${isCurrentRole ? 'rgba(59,130,246,0.25)' : 'var(--border-subtle)'}`, marginTop: i === 0 ? 0 : 4 }}>
                                                            <span style={{ fontSize: 12, fontWeight: 600, color: isCurrentRole ? 'var(--helix-primary)' : 'var(--text-primary)' }}>
                                                                {lvl.target}
                                                                {isCurrentRole && <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 6, color: 'var(--text-muted)' }}>(this role)</span>}
                                                            </span>
                                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{lvl.delay}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );

                                    return (
                                        <>
                                            {/* Primary escalation chain */}
                                            <div className="card" style={{ padding: '16px 20px' }}>
                                                <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                                                    Escalation Chain
                                                </h4>
                                                {allChains.length > 1 && (
                                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span className="material-icons-round" style={{ fontSize: 14, color: 'var(--text-muted)' }}>device_hub</span>
                                                        {ownChain.source} chain
                                                        <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-muted)' }}>(Current)</span>
                                                    </div>
                                                )}
                                                {renderLadder(ownChain.levels)}
                                            </div>

                                            {/* Other chains indicator */}
                                            {otherChains.length > 0 && (
                                                <div className="card" style={{ padding: '14px 20px' }}>
                                                    <button
                                                        onClick={() => setShowOtherChains(prev => !prev)}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                            width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--helix-primary)' }}>device_hub</span>
                                                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                                                                Also used in {otherChains.length} other escalation chain{otherChains.length !== 1 ? 's' : ''}
                                                            </span>
                                                        </div>
                                                        <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--text-muted)', transition: 'transform 0.2s', transform: showOtherChains ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
                                                    </button>

                                                    {showOtherChains && (
                                                        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                                                            {otherChains.map((chain, ci) => (
                                                                <div key={ci}>
                                                                    <div
                                                                        style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                                                                        onClick={() => { setSelectedId(chain.sourceId); setShowOtherChains(false); }}
                                                                    >
                                                                        <span className="material-icons-round" style={{ fontSize: 14, color: 'var(--text-muted)' }}>arrow_forward</span>
                                                                        {chain.source} chain
                                                                        <span className="material-icons-round" style={{ fontSize: 12, color: 'var(--text-disabled)' }}>open_in_new</span>
                                                                    </div>
                                                                    {renderLadder(chain.levels)}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}

                                {/* Quick Actions */}
                                <div className="card" style={{ padding: '16px 20px' }}>
                                    <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Actions</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => openEditModal(selectedRole)}>
                                            <span className="material-icons-round" style={{ fontSize: 14 }}>edit</span>Edit Role
                                        </button>
                                        <button className="btn btn-danger btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setConfirmDelete(selectedRole)}>
                                            <span className="material-icons-round" style={{ fontSize: 14 }}>delete</span>Remove Role
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </>
    );
}
