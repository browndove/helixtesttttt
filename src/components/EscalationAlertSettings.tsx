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
    ROLES_CACHE_POLICIES,
    ROLES_CACHE_ROLES,
    ROLES_PAGE_CACHE_TTL_MS,
} from '@/lib/rolesAdminCache';

type EscalationLevel = {
    level: number;
    target: string;
    target_role_id?: string;
    delay: string;
    stepId?: string;
};

type EscalationStep = {
    id: string;
    step_order: number;
    target_role_id: string;
    target_role_name: string;
    target_user_id?: string;
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

type Role = {
    id: string;
    name: string;
    description: string;
    department: string;
    mandatory: boolean;
    enabled: boolean;
    priority: string;
    escalation_levels: EscalationLevel[];
};

function resolveRoleDepartmentName(
    role: Record<string, unknown>,
    deptMap: Map<string, string>
): string {
    const deptRaw = role.department;
    const deptName = String(role.department_name || '').trim();
    const deptId = String(role.department_id || '').trim();

    if (deptName) return deptName;

    if (deptRaw && typeof deptRaw === 'object' && !Array.isArray(deptRaw)) {
        const nested = deptRaw as Record<string, unknown>;
        const nestedNameRaw = nested.name ?? nested.department_name;
        const nestedName = typeof nestedNameRaw === 'string' ? nestedNameRaw.trim() : '';
        if (nestedName) return nestedName;
        const nestedId = String(nested.id || nested.department_id || '').trim();
        if (nestedId && deptMap.has(nestedId)) return deptMap.get(nestedId) || '';
    }

    if (typeof deptRaw === 'string' && deptRaw.trim()) {
        const raw = deptRaw.trim();
        if (deptMap.has(raw)) return deptMap.get(raw) || '';
        return raw;
    }

    if (deptId && deptMap.has(deptId)) return deptMap.get(deptId) || '';
    return '';
}

function normalizeRoleForUi<T extends Role>(role: T): T {
    const isCritical = role.priority?.toString().trim().toLowerCase() === 'critical';
    const priority = isCritical ? 'Critical' : 'Standard';
    const mandatory = isCritical;
    return { ...role, mandatory, priority } as T;
}

type ChainGroup = {
    key: string;
    chainName: string;
    description: string;
    levels: EscalationLevel[];
    roles: Role[];
    department: string;
    enabled: boolean;
    primaryRoleId: string;
    policyId: string;
    initial_timeout_seconds: number;
};

type EscalationTemplate = {
    name: string;
    description: string;
    roleNames: string[];
};

const escalationTemplates: EscalationTemplate[] = [
    { name: 'Emergency Department Critical', description: 'Escalation chain for the Emergency Department.', roleNames: ['ED Doctor On-Call', 'ED Supervisor', 'CEO'] },
    { name: 'Inpatient Ward Critical', description: 'Escalation chain for inpatient wards.', roleNames: ['Doctor in Charge of Patient', 'Department Lead', 'CEO'] },
    { name: 'ICU Critical', description: 'Escalation chain for the Intensive Care Unit.', roleNames: ['ICU Doctor On-Call', 'ICU Department Lead', 'CEO'] },
    { name: 'Maternity Ward Critical', description: 'Escalation chain for the maternity and labor ward.', roleNames: ['OBGYN On-Call', 'OBGYN Department Supervisor', 'CEO'] },
    { name: 'Pediatrics Critical', description: 'Escalation chain for pediatrics and neonatal intensive care.', roleNames: ['Peds Doctor On-Call', 'Peds Unit Lead', 'CEO'] },
    { name: 'Operating Theatre Critical', description: 'Escalation chain for the operating theatre and anaesthesia.', roleNames: ['Anaesthesia On-Call', 'Theatre Supervisor', 'CEO'] },
    { name: 'Ambulance Transfers Critical', description: 'Escalation chain for ambulance arrivals, referrals, and transfers.', roleNames: ['ED Triage On-Call', 'ED Supervisor', 'CEO'] },
    { name: 'Safety Threat Escalation', description: 'Escalation chain for non-clinical security incidents and threats.', roleNames: ['Safety Officer', 'Hospital Administrator On-Call', 'CEO'] },
    { name: 'Missing Child', description: 'Escalation chain for missing child incidents.', roleNames: ['Ward Nurse In-Charge', 'Safety Officer', 'Administrator On-Call'] },
];

const levelColor = (i: number) => {
    if (i === 0) return '#6bb89c';
    if (i === 1) return '#c9a94e';
    return '#c26b6b';
};

function stepsToLevels(steps: EscalationStep[], roleNameMap?: Map<string, string>): EscalationLevel[] {
    return [...steps]
        .sort((a, b) => a.step_order - b.step_order)
        .map(s => ({
            level: s.step_order,
            target: s.target_role_name || s.target_user_name || (roleNameMap?.get(s.target_role_id) ?? ''),
            target_role_id: s.target_role_id || '',
            delay: secondsToDelay(s.timeout_seconds),
            stepId: s.id,
        }));
}

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

export default function EscalationAlertSettings() {
    const DESC_LIMIT = 200;
    const [roles, setRoles] = useState<Role[]>([]);
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [deptIdMap, setDeptIdMap] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(true);
    const [selectedChainKey, setSelectedChainKey] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [toast, setToast] = useState<string | null>(null);

    // Create form
    const [showCreate, setShowCreate] = useState(false);
    const [createStep, setCreateStep] = useState(0); // 0=basic, 1=levels, 2=summary
    /** Existing Critical role that owns this escalation (policy.role_id + ladder level 1). */
    const [createPrimaryRoleId, setCreatePrimaryRoleId] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newDept, setNewDept] = useState('');
    const [newLevels, setNewLevels] = useState<EscalationLevel[]>([
        { level: 1, target: '', delay: '30 sec' },
        { level: 2, target: '', delay: '3 min' },
    ]);

    // Edit modal
    const [editPolicyId, setEditPolicyId] = useState<string | null>(null);
    const [editRole, setEditRole] = useState<Role | null>(null);
    const [editStep, setEditStep] = useState(0);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editLevels, setEditLevels] = useState<EscalationLevel[]>([]);
    const [levelRoleSearch, setLevelRoleSearch] = useState<Record<number, string>>({});
    const [editSaving, setEditSaving] = useState(false);

    const closeEditModal = () => { setEditPolicyId(null); setEditRole(null); };

    // Delete confirm
    const [confirmDelete, setConfirmDelete] = useState<ChainGroup | null>(null);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const ingestEscalationPayloads = useCallback(
        (
            ok: { roles: boolean; depts: boolean; policies: boolean },
            parsed: {
                roles: unknown | null;
                departments: unknown | null;
                policiesListRaw: unknown | null;
                policiesResolved: Policy[] | null;
            },
        ) => {
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

            if (ok.roles && parsed.roles != null) {
                const data = parsed.roles;
                const rolesArr = Array.isArray(data) ? data : [];
                setRoles(rolesArr.map((r: Role & { department_id?: string; department_name?: string; department?: unknown }) => normalizeRoleForUi({
                    ...r,
                    department: resolveRoleDepartmentName(r as unknown as Record<string, unknown>, deptMap),
                    escalation_levels: r.escalation_levels?.length ? r.escalation_levels : [],
                })));
            }

            if (ok.policies) {
                let policiesArr: Policy[] = [];
                if (parsed.policiesResolved != null) {
                    policiesArr = parsed.policiesResolved;
                } else if (parsed.policiesListRaw != null) {
                    policiesArr = extractPolicies(parsed.policiesListRaw);
                }
                setPolicies(policiesArr);
            }
        },
        [],
    );

    useLayoutEffect(() => {
        const rolesJ = readCachedJson(ROLES_CACHE_ROLES, ROLES_PAGE_CACHE_TTL_MS);
        const deptsJ = readCachedJson(ROLES_CACHE_DEPTS, ROLES_PAGE_CACHE_TTL_MS);
        const policiesJ = readCachedJson(ROLES_CACHE_POLICIES, ROLES_PAGE_CACHE_TTL_MS);
        if (rolesJ == null || deptsJ == null || policiesJ == null) return;
        const basePolicies = extractPolicies(policiesJ);
        const mergedPolicies = basePolicies.map((p) => {
            const d = readCachedJson(`/api/proxy/escalation-policies/${p.id}`, ROLES_PAGE_CACHE_TTL_MS);
            if (d && typeof d === 'object') return { ...p, ...(d as Record<string, unknown>) } as Policy;
            return p;
        });
        ingestEscalationPayloads(
            { roles: true, depts: true, policies: true },
            {
                roles: rolesJ,
                departments: deptsJ,
                policiesListRaw: null,
                policiesResolved: mergedPolicies,
            },
        );
        setLoading(false);
    }, [ingestEscalationPayloads]);

    const fetchData = useCallback(async () => {
        try {
            const [rolesRes, deptsRes, policiesRes] = await Promise.all([
                fetch(ROLES_CACHE_ROLES),
                fetch(ROLES_CACHE_DEPTS),
                fetch(ROLES_CACHE_POLICIES),
            ]);
            const [rolesJson, deptsJson, policiesJson] = await Promise.all([
                rolesRes.ok ? rolesRes.json() : Promise.resolve(null),
                deptsRes.ok ? deptsRes.json() : Promise.resolve(null),
                policiesRes.ok ? policiesRes.json() : Promise.resolve(null),
            ]);

            if (rolesRes.ok && rolesJson != null) writeCachedJson(ROLES_CACHE_ROLES, rolesJson);
            if (deptsRes.ok && deptsJson != null) writeCachedJson(ROLES_CACHE_DEPTS, deptsJson);
            if (policiesRes.ok && policiesJson != null) writeCachedJson(ROLES_CACHE_POLICIES, policiesJson);

            let policiesResolved: Policy[] | null = null;
            if (policiesRes.ok && policiesJson != null) {
                let policiesArr = extractPolicies(policiesJson);
                const needsHydration = policiesArr.some(p => !p.steps || p.steps.length === 0);
                if (needsHydration && policiesArr.length > 0) {
                    const hydrated = await Promise.all(
                        policiesArr.map(async (p) => {
                            if (p.steps && p.steps.length > 0) return p;
                            try {
                                const res = await fetch(`/api/proxy/escalation-policies/${p.id}`);
                                if (res.ok) {
                                    const full = await res.json();
                                    writeCachedJson(`/api/proxy/escalation-policies/${p.id}`, full);
                                    return { ...p, ...full };
                                }
                            } catch { /* keep original */ }
                            return p;
                        }),
                    );
                    policiesArr = hydrated;
                }
                policiesResolved = policiesArr;
            }

            ingestEscalationPayloads(
                { roles: rolesRes.ok, depts: deptsRes.ok, policies: policiesRes.ok },
                {
                    roles: rolesJson,
                    departments: deptsJson,
                    policiesListRaw: policiesJson,
                    policiesResolved,
                },
            );
        } catch {
            showToast('Failed to load data');
        }
        setLoading(false);
    }, [ingestEscalationPayloads]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Build display rows from escalation policies (one policy = one row)
    const chainGroups = useMemo(() => {
        const roleMap = new Map(roles.map(r => [r.id, r]));
        const roleNameMap = new Map(roles.map(r => [r.id, r.name]));
        return policies.map(p => {
            const role = roleMap.get(p.role_id);
            const levels = stepsToLevels(p.steps || [], roleNameMap);
            const targetNames = levels.map(l => l.target).filter(Boolean);
            const chainName = role?.name || targetNames.join(' \u2192 ') || 'Unnamed Policy';
            const description = role?.description || `${levels.length} step escalation chain`;
            return {
                key: p.id,
                chainName,
                description,
                levels,
                roles: role ? [role] : [],
                department: role?.department || '',
                enabled: role?.enabled ?? true,
                primaryRoleId: p.role_id,
                policyId: p.id,
                initial_timeout_seconds: p.initial_timeout_seconds,
            } as ChainGroup;
        });
    }, [policies, roles]);

    // All roles with their details for target selection (includes ID for API calls)
    const allRolesForSelect = useMemo(() =>
        roles.map(r => ({ id: r.id, name: r.name, description: r.description, department: r.department })).sort((a, b) => a.name.localeCompare(b.name)),
    [roles]);

    // Departments for the create form (from DB, not from existing roles)

    const selectedChain = chainGroups.find(c => c.key === selectedChainKey) || null;

    const rolesForEscalation = useMemo(
        () => [...roles].sort((a, b) => a.name.localeCompare(b.name)),
        [roles],
    );

    const existingPolicyForCreateRole = useMemo(() => {
        if (!createPrimaryRoleId) return null;
        return policies.find(p => p.role_id === createPrimaryRoleId) || null;
    }, [createPrimaryRoleId, policies]);

    const filtered = chainGroups.filter(c => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            String(c.chainName ?? '').toLowerCase().includes(q)
            || String(c.department ?? '').toLowerCase().includes(q)
            || c.roles.some(r =>
                String(r.name ?? '').toLowerCase().includes(q)
                || String(r.description ?? '').toLowerCase().includes(q),
            )
        );
    });

    // --- Create ---
    const resetCreate = () => {
        setShowCreate(false); setCreateStep(0);
        setCreatePrimaryRoleId(''); setNewDesc(''); setNewDept('');
        setNewLevels([{ level: 1, target: '', delay: '30 sec' }, { level: 2, target: '', delay: '3 min' }]);
        setLevelRoleSearch({});
    };

    const applyCreatePrimaryRole = useCallback((roleId: string) => {
        setCreatePrimaryRoleId(roleId);
        if (!roleId.trim()) return;
        const role = roles.find(r => r.id === roleId);
        if (!role) return;
        setNewDept(role.department || '');
        setNewLevels(prev => {
            const rest = prev.slice(1);
            return [{ level: 1, target: role.name, target_role_id: role.id, delay: prev[0]?.delay || '30 sec' }, ...rest.map((l, i) => ({ ...l, level: i + 2 }))];
        });
    }, [roles]);

    const handleCreate = async () => {
        if (!createPrimaryRoleId.trim()) return;
        if (policies.some(p => p.role_id === createPrimaryRoleId)) {
            showToast('An escalation already exists for this role. Edit it instead.');
            return;
        }
        const primaryRole = roles.find(r => r.id === createPrimaryRoleId);
        if (!primaryRole) { showToast('Role not found'); return; }
        try {
            const resolvedDeptId = newDept.trim() ? (deptIdMap.get(newDept.trim()) || undefined) : undefined;
            if (newDesc.trim() || newDept.trim()) {
                await fetch(`/api/proxy/roles/${createPrimaryRoleId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: primaryRole.name,
                        description: newDesc.trim(),
                        ...(resolvedDeptId ? { department_id: resolvedDeptId } : {}),
                    }),
                });
            }

            const policyRes = await fetch('/api/proxy/escalation-policies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role_id: createPrimaryRoleId,
                    initial_timeout_seconds: clampEscalationDelaySeconds(delayToSeconds(newLevels[0]?.delay || '3 min')),
                }),
            });
            if (!policyRes.ok) { showToast('Failed to create escalation policy'); return; }
            const policy = await policyRes.json();

            const sortedTargets = newLevels
                .filter(l => l.target && l.target_role_id)
                .sort((a, b) => a.level - b.level);
            const steps = sortedTargets
                .map((l, idx, arr) => ({
                    target_role_id: l.target_role_id || allRolesForSelect.find(r => r.name === l.target)?.id || '',
                    timeout_seconds: arr.length > 1 && idx === arr.length - 1
                        ? MIN_ESCALATION_DELAY_SEC
                        : clampEscalationDelaySeconds(delayToSeconds(l.delay)),
                }))
                .filter(s => s.target_role_id);
            if (steps.length > 0) {
                const bulkRes = await fetch(`/api/proxy/escalation-policies/${policy.id}/steps/bulk`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ steps }),
                });
                if (!bulkRes.ok) {
                    console.error('[createPolicy] Bulk add failed:', await bulkRes.text().catch(() => ''));
                    showToast('Warning: steps may not have saved correctly');
                }
            }

            showToast(`Escalation created for "${primaryRole.name}"`);
            resetCreate();
            fetchData();
        } catch { showToast('Failed to create escalation'); }
    };

    // --- Edit ---
    const openEditChain = (chain: ChainGroup) => {
        const primary = chain.roles[0] || null;
        setEditPolicyId(chain.policyId);
        setEditRole(primary); setEditStep(0);
        setEditName(chain.chainName); setEditDesc(chain.description);
        const lvls = chain.levels.map(l => ({ ...l })).sort((a, b) => a.level - b.level);
        if (primary && lvls.length > 0) {
            lvls[0] = { ...lvls[0], target: primary.name, target_role_id: primary.id };
        }
        setEditLevels(lvls);
        setLevelRoleSearch({});
    };

    const openEditChainForPrimaryRole = (roleId: string) => {
        const chain = chainGroups.find(c => c.primaryRoleId === roleId);
        if (!chain) {
            showToast('Could not find that escalation configuration');
            return;
        }
        resetCreate();
        openEditChain(chain);
    };

    const handleSaveEdit = async () => {
        if (!editPolicyId) return;
        setEditSaving(true);
        try {
            // 1. Update policy initial timeout
            const putRes = await fetch(`/api/proxy/escalation-policies/${editPolicyId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    initial_timeout_seconds: clampEscalationDelaySeconds(delayToSeconds(
                        [...editLevels].sort((a, b) => a.level - b.level)[0]?.delay || '3 min',
                    )),
                }),
            });
            if (!putRes.ok) { showToast('Failed to update policy timeout'); setEditSaving(false); return; }

            // 2. Build new steps (validate before deleting old ones). Level 1 is always the policy primary role.
            const sortedForSave = [...editLevels].sort((a, b) => a.level - b.level);
            const levelsNormalized = sortedForSave.map(l => ({ ...l }));
            if (editRole && levelsNormalized.length > 0) {
                levelsNormalized[0] = {
                    ...levelsNormalized[0],
                    target: editRole.name,
                    target_role_id: editRole.id,
                };
            }
            const sortedTargets = levelsNormalized
                .filter(l => l.target)
                .sort((a, b) => a.level - b.level);
            const steps = sortedTargets
                .map((l, idx, arr) => {
                    const roleId = l.target_role_id || allRolesForSelect.find(r => r.name === l.target)?.id || '';
                    return {
                        target_role_id: roleId,
                        timeout_seconds: arr.length > 1 && idx === arr.length - 1
                            ? MIN_ESCALATION_DELAY_SEC
                            : clampEscalationDelaySeconds(delayToSeconds(l.delay)),
                    };
                })
                .filter(s => s.target_role_id);

            // 3. Delete existing steps
            const existing = policies.find(p => p.id === editPolicyId);
            if (existing?.steps) {
                for (const step of existing.steps) {
                    if (step.id) {
                        await fetch(`/api/proxy/escalation-policies/${editPolicyId}/steps/${step.id}`, { method: 'DELETE' });
                    }
                }
            }

            // 4. Bulk add new steps
            if (steps.length > 0) {
                const bulkRes = await fetch(`/api/proxy/escalation-policies/${editPolicyId}/steps/bulk`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ steps }),
                });
                if (!bulkRes.ok) {
                    console.error('[editPolicy] Bulk add failed:', await bulkRes.text().catch(() => ''));
                    showToast('Warning: steps may not have saved correctly');
                }
            }

            showToast(`"${editName}" updated`);
            closeEditModal();
            fetchData();
        } catch { showToast('Failed to save changes'); }
        setEditSaving(false);
    };

    // --- Delete ---
    const handleDeleteChain = async (chain: ChainGroup) => {
        try {
            // Delete the escalation policy (cascades to all steps)
            const res = await fetch(`/api/proxy/escalation-policies/${chain.policyId}`, { method: 'DELETE' });
            if (!res.ok) { showToast('Failed to delete policy'); setConfirmDelete(null); return; }
            if (selectedChainKey === chain.key) setSelectedChainKey(null);
            showToast(`"${chain.chainName}" deleted`);
            fetchData();
        } catch { showToast('Failed to delete'); }
        setConfirmDelete(null);
    };

    // --- Ladder editor ---
    const renderLadder = (
        levels: EscalationLevel[],
        setLevels: (l: EscalationLevel[]) => void,
        opts?: { lockFirstLevelRole?: boolean },
    ) => {
        const sorted = [...levels].sort((a, b) => a.level - b.level);
        const selectedTargets = new Set(levels.map(l => l.target).filter(Boolean));

        const MAX_STEPS = 3;
        const addLevel = () => {
            if (levels.length >= MAX_STEPS) return;
            const next = sorted.length > 0 ? sorted[sorted.length - 1].level + 1 : 1;
            setLevels([...levels, { level: next, target: '', delay: '5 min' }]);
        };
        const removeLevel = (num: number) => {
            const first = sorted[0];
            if (opts?.lockFirstLevelRole && first && num === first.level) return;
            const f = levels.filter(l => l.level !== num);
            setLevels(f.sort((a, b) => a.level - b.level).map((l, i) => ({ ...l, level: i + 1 })));
        };

        // Get available roles for a given level (exclude already-selected roles in other levels)
        const getAvailable = (currentTarget: string) => {
            return allRolesForSelect.filter(r => r.name === currentTarget || !selectedTargets.has(r.name));
        };

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Escalation Ladder</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {opts?.lockFirstLevelRole
                            ? 'Level 1 is the policy role (fixed). Change only its delay; use Add escalation level below for each further target.'
                            : 'Select a role for each escalation level. Each role can only appear once in the chain.'}
                    </div>
                </div>
                {sorted.map((lvl, i) => {
                    const lockPrimary = Boolean(opts?.lockFirstLevelRole && i === 0);
                    const hideDelayRow = sorted.length > 1 && i === sorted.length - 1;
                    const available = getAvailable(lvl.target);
                    const roleQuery = (levelRoleSearch[lvl.level] || '').trim().toLowerCase();
                    const filteredAvailable = roleQuery
                        ? available.filter(r =>
                            r.name.toLowerCase().includes(roleQuery)
                            || String(r.description || '').toLowerCase().includes(roleQuery))
                        : available;
                    const autoCompleteMatches = roleQuery ? filteredAvailable.slice(0, 6) : [];
                    return (
                        <div key={lvl.level} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            {/* Level indicator */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 30, flexShrink: 0, paddingTop: 10 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: levelColor(i), color: '#fff', fontSize: 12, fontWeight: 700, zIndex: 1 }}>{lvl.level}</span>
                                {i < sorted.length - 1 && <div style={{ width: 2, height: 16, background: 'var(--border-default)' }} />}
                            </div>
                            {/* Level card */}
                            <div style={{ flex: 1, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', overflow: 'hidden' }}>
                                {/* Role selector */}
                                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                                            {lockPrimary ? `Level ${lvl.level} — Role (primary)` : `Level ${lvl.level} — Target Role`}
                                        </span>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                                            {!lockPrimary && (
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    className="input"
                                                    value={levelRoleSearch[lvl.level] || ''}
                                                    onChange={e => setLevelRoleSearch(prev => ({ ...prev, [lvl.level]: e.target.value }))}
                                                    placeholder="Search roles..."
                                                    style={{ width: 180, height: 26, fontSize: 11, padding: '0 8px' }}
                                                />
                                                {roleQuery && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: 30,
                                                        right: 0,
                                                        width: 300,
                                                        maxHeight: 220,
                                                        overflowY: 'auto',
                                                        background: 'var(--surface-card)',
                                                        border: '1px solid var(--border-default)',
                                                        borderRadius: 'var(--radius-md)',
                                                        boxShadow: '0 8px 18px rgba(0,0,0,0.14)',
                                                        zIndex: 20,
                                                        padding: 4,
                                                    }}>
                                                        {autoCompleteMatches.length === 0 ? (
                                                            <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)' }}>No matching roles</div>
                                                        ) : autoCompleteMatches.map(r => (
                                                            <button
                                                                key={`${lvl.level}-${r.id}`}
                                                                type="button"
                                                                onClick={() => {
                                                                    const u = levels.map(l => l.level === lvl.level ? { ...l, target: r.name, target_role_id: r.id } : l);
                                                                    setLevels(u);
                                                                    setLevelRoleSearch(prev => ({ ...prev, [lvl.level]: '' }));
                                                                }}
                                                                style={{
                                                                    width: '100%',
                                                                    textAlign: 'left',
                                                                    border: '1px solid transparent',
                                                                    background: 'transparent',
                                                                    borderRadius: 'var(--radius-sm)',
                                                                    padding: '6px 8px',
                                                                    cursor: 'pointer',
                                                                }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                                                            >
                                                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</div>
                                                                {r.description && (
                                                                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                        {r.description}
                                                                    </div>
                                                                )}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            )}
                                            {sorted.length > 1 && !lockPrimary && (
                                                <button type="button" onClick={() => removeLevel(lvl.level)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'inline-flex', color: 'var(--text-muted)', borderRadius: 'var(--radius-sm)' }} title="Remove level" onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                                                    <span className="material-icons-round" style={{ fontSize: 14 }}>close</span>
                                                </button>
                                            )}
                                            {sorted.length > 1 && lockPrimary && (
                                                <span style={{ fontSize: 10, color: 'var(--text-disabled)' }} title="Primary level cannot be removed">—</span>
                                            )}
                                        </div>
                                    </div>
                                    {lockPrimary && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                            <span className="material-icons-round" style={{ fontSize: 18, color: levelColor(i) }}>lock</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{lvl.target || '(select Role in previous step)'}</div>
                                                <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Only the delay below can be changed for this level.</div>
                                            </div>
                                        </div>
                                    )}
                                    {!lockPrimary && lvl.target ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                            <span className="material-icons-round" style={{ fontSize: 18, color: levelColor(i) }}>person</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{lvl.target}</div>
                                                {(() => { const r = allRolesForSelect.find(r => r.name === lvl.target); return r?.description ? <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description}</div> : null; })()}
                                            </div>
                                            <button type="button" onClick={() => { const u = levels.map(l => l.level === lvl.level ? { ...l, target: '', target_role_id: undefined } : l); setLevels(u); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'inline-flex', color: 'var(--text-muted)' }} title="Change role">
                                                <span className="material-icons-round" style={{ fontSize: 14 }}>swap_horiz</span>
                                            </button>
                                        </div>
                                    ) : !lockPrimary ? (
                                        <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            {filteredAvailable.length === 0 ? (
                                                <div style={{ padding: '12px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>No more roles available</div>
                                            ) : filteredAvailable.map(r => (
                                                <button key={r.name} type="button" onClick={() => { const u = levels.map(l => l.level === lvl.level ? { ...l, target: r.name, target_role_id: r.id } : l); setLevels(u); }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 'var(--radius-sm)', background: 'transparent', border: '1px solid transparent', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s', width: '100%' }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                                                >
                                                    <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--text-muted)' }}>person_outline</span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</div>
                                                        {r.description && <div style={{ fontSize: 10.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description}</div>}
                                                    </div>
                                                    {r.department && <span style={{ fontSize: 10, color: 'var(--text-disabled)', flexShrink: 0 }}>{r.department}</span>}
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                                {/* Delay (hidden for final target when there is more than one level) */}
                                {hideDelayRow ? (
                                    <div style={{ padding: '8px 12px', background: 'var(--surface-2)', borderTop: '1px solid var(--border-subtle)' }}>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Final escalation target — no delay before another role.</span>
                                    </div>
                                ) : (
                                    <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)' }}>
                                        <span className="material-icons-round" style={{ fontSize: 14, color: 'var(--text-muted)' }}>schedule</span>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>Delay:</span>
                                        <CustomSelect
                                            value={lvl.delay}
                                            onChange={v => { const u = levels.map(l => l.level === lvl.level ? { ...l, delay: v } : l); setLevels(u); }}
                                            options={ESCALATION_DELAY_OPTIONS.map(d => ({ label: d, value: d }))}
                                            placeholder="Delay"
                                            style={{ width: 100 }}
                                            maxH={160}
                                            allowCustom
                                            customPlaceholder="e.g. 45 sec, 2 min, 1 hr"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                {sorted.length < MAX_STEPS && (
                    <button type="button" className="btn btn-secondary btn-xs" onClick={addLevel} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                        <span className="material-icons-round" style={{ fontSize: 13 }}>add</span>Add escalation level
                    </button>
                )}
                {/* Duplicate warning */}
                {(() => {
                    const targets = levels.map(l => l.target).filter(Boolean);
                    const dupes = targets.filter((t, i) => targets.indexOf(t) !== i);
                    if (dupes.length === 0) return null;
                    return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', marginTop: 4 }}>
                            <span className="material-icons-round" style={{ fontSize: 14, color: '#eab308' }}>warning</span>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Duplicate role detected: <strong>{[...new Set(dupes)].join(', ')}</strong>. Each role should only appear once.</span>
                        </div>
                    );
                })()}
            </div>
        );
    };

    // --- Summary renderer (colored circles) ---
    const renderSummary = (levels: EscalationLevel[], name: string) => {
        const sorted = [...levels].sort((a, b) => a.level - b.level);
        const effective = sorted.map((lvl, i) => (i === 0 && !lvl.target ? { ...lvl, target: name } : lvl));
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Summary</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Review the escalation chain for <strong>{name}</strong> before saving.</div>
                </div>

                {/* Visual chain */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '12px 0' }}>
                    {effective.map((lvl, i) => (
                        <div key={lvl.level} style={{ display: 'flex', alignItems: 'stretch', gap: 14 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36, flexShrink: 0 }}>
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: 32, height: 32, borderRadius: '50%',
                                    background: levelColor(i), color: '#fff',
                                    fontSize: 13, fontWeight: 700, zIndex: 1,
                                    boxShadow: `0 2px 8px ${levelColor(i)}40`,
                                }}>{lvl.level}</span>
                                {i < sorted.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--border-default)', minHeight: 16 }} />}
                            </div>
                            <div style={{
                                flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-md)',
                                background: 'var(--surface-card)', border: '1px solid var(--border-default)',
                                marginTop: i > 0 ? 6 : 0,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                    <span className="material-icons-round" style={{ fontSize: 16, color: levelColor(i) }}>person</span>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{lvl.target || '(not set)'}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                                    {!(effective.length > 1 && i === effective.length - 1) && (
                                        <span>Delay: <strong style={{ color: 'var(--text-secondary)' }}>{lvl.delay}</strong></span>
                                    )}
                                    <span style={{ color: levelColor(i), fontWeight: 600 }}>
                                        {i === 0 ? 'Initial Responder' : i === 1 ? 'First Escalation' : `Escalation Level ${lvl.level}`}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Empty target warning */}
                {effective.some(l => !l.target) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)' }}>
                        <span className="material-icons-round" style={{ fontSize: 14, color: '#eab308' }}>warning</span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Some levels have no role assigned. Go back to fix this before saving.</span>
                    </div>
                )}
            </div>
        );
    };

    // --- Read-only ladder (for detail panel) ---
    const renderLadderReadOnly = (levels: EscalationLevel[]) => {
        const sorted = [...levels].sort((a, b) => a.level - b.level);
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ marginBottom: 2 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Escalation Ladder</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>When a message goes unacknowledged, it escalates through these roles.</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {sorted.map((lvl, i) => (
                        <div key={lvl.level} style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 30, flexShrink: 0 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: levelColor(i), color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0, zIndex: 1, boxShadow: `0 1px 4px ${levelColor(i)}30` }}>{lvl.level}</span>
                                {i < sorted.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--border-default)', minHeight: 12 }} />}
                            </div>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', marginTop: i === 0 ? 0 : 4 }}>
                                <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, color: 'var(--text-primary)' }}>{lvl.target}</span>
                                {!(sorted.length > 1 && i === sorted.length - 1) && (
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{lvl.delay}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // --- Step indicator ---
    const renderSteps = (current: number, labels: string[]) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 20 }}>
            {labels.map((label, i) => (
                <div key={label} style={{ display: 'contents' }}>
                    {i > 0 && <div style={{ flex: '0 0 30px', height: 2, background: current > i ? 'var(--helix-primary)' : 'var(--border-subtle)', margin: '0 4px', borderRadius: 1 }} />}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', fontSize: 10, fontWeight: 700, background: current >= i ? 'var(--helix-primary)' : 'var(--surface-2)', color: current >= i ? '#fff' : 'var(--text-muted)', border: `2px solid ${current >= i ? 'var(--helix-primary)' : 'var(--border-default)'}` }}>{i + 1}</span>
                        <span style={{ fontSize: 11, fontWeight: current === i ? 700 : 500, color: current === i ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
                    </div>
                </div>
            ))}
        </div>
    );

    // Check if levels have duplicates
    const hasDuplicates = (levels: EscalationLevel[]) => {
        const targets = levels.map(l => l.target).filter(Boolean);
        return new Set(targets).size !== targets.length;
    };

    // Check if any level is effectively missing a role. When editing an existing
    // chain, level 1 is implicitly the primary role even if its target is blank.
    const hasMissingTargets = (levels: EscalationLevel[], primaryRoleName?: string | null) => {
        const sorted = [...levels].sort((a, b) => a.level - b.level);
        return sorted.some((lvl, i) => {
            if (i === 0 && primaryRoleName && primaryRoleName.trim()) return false;
            return !lvl.target;
        });
    };

    return (
        <>
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast} variant="success" dismissible={false} />
                </MacVibrancyToastPortal>
            )}

            {/* Edit Modal */}
            {editPolicyId && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
                    <div className="fade-in card" style={{ width: 560, maxHeight: '85vh', overflow: 'auto', padding: '28px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: 16, marginBottom: 16 }}>Edit Escalation Chain</h3>

                        {renderSteps(editStep, ['Basic Info', 'Escalation Levels', 'Summary'])}

                        {editStep === 0 && (
                            <>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div>
                                        <label className="label">Role Name</label>
                                        <input className="input" value={editName} readOnly disabled style={{ fontSize: 13 }} />
                                    </div>
                                    <div>
                                        <label className="label">Description</label>
                                        <textarea
                                            className="input"
                                            value={editDesc}
                                            readOnly
                                            disabled
                                            style={{ fontSize: 13, minHeight: 60, resize: 'vertical' }}
                                        />
                                        <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--text-muted)', textAlign: 'right' }}>
                                            {editDesc.length}/{DESC_LIMIT}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                        <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--danger)' }}>priority_high</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>Priority: Critical</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Only Critical roles have escalation chains.</div>
                                        </div>
                                        <span className="badge badge-critical" style={{ fontSize: 10 }}>Critical</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
                                    <button className="btn btn-secondary btn-sm" onClick={closeEditModal}>Cancel</button>
                                    <button className="btn btn-primary btn-sm" onClick={() => setEditStep(1)}>
                                        Next: Levels <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_forward</span>
                                    </button>
                                </div>
                            </>
                        )}

                        {editStep === 1 && (
                            <>
                                {renderLadder(editLevels, setEditLevels, { lockFirstLevelRole: true })}
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 18 }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setEditStep(0)}>
                                        <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_back</span> Back
                                    </button>
                                    <button className="btn btn-primary btn-sm" onClick={() => setEditStep(2)} disabled={hasDuplicates(editLevels)}>
                                        Next: Summary <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_forward</span>
                                    </button>
                                </div>
                            </>
                        )}

                        {editStep === 2 && (
                            <>
                                {renderSummary(editLevels, editName)}
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 18 }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setEditStep(1)}>
                                        <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_back</span> Back
                                    </button>
                                    <button className="btn btn-primary btn-sm" onClick={handleSaveEdit} disabled={editSaving || hasMissingTargets(editLevels, editName)}>
                                        <span className="material-icons-round" style={{ fontSize: 14 }}>check</span> {editSaving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Delete Confirm */}
            {confirmDelete && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
                    <div className="fade-in card" style={{ width: 400, padding: '24px 28px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: 16, marginBottom: 8 }}>Delete Escalation Chain</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
                            Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{confirmDelete.chainName}</strong>? This will remove the escalation policy and all its steps. This action cannot be undone.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteChain(confirmDelete)}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="app-main">
                <TopBar
                    title="Escalation Config"
                    subtitle="Manage escalation chains for Critical roles"
                    search={{ placeholder: 'Search escalations...', value: search, onChange: setSearch }}
                    actions={
                        <button className="btn btn-primary btn-sm" onClick={() => { if (showCreate) resetCreate(); else setShowCreate(true); }}>
                            <span className="material-icons-round" style={{ fontSize: 14 }}>{showCreate ? 'close' : 'add'}</span>
                            {showCreate ? 'Cancel' : 'New Escalation'}
                        </button>
                    }
                />

                <main style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>
                    {/* Info banner */}
                    <div className="fade-in" style={{ marginBottom: 18 }}>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 600 }}>
                            Escalation chains are configured for <strong style={{ color: 'var(--text-secondary)' }}>Critical (Mandatory)</strong> roles only.
                            When a message goes unacknowledged, it escalates through the role chain below.
                        </p>
                    </div>

                    {/* Create Form */}
                    {showCreate && (
                        <div className="fade-in card" style={{ marginBottom: 18, padding: '22px 24px', maxWidth: 580 }}>
                            <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Create Escalation</h4>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Choose an existing Critical role as the primary level, then set escalation targets and delays.</p>

                            {renderSteps(createStep, ['Basic Info', 'Escalation Levels', 'Summary'])}

                            {createStep === 0 && (
                                <>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <div>
                                            <label className="label">Role Name</label>
                                            <CustomSelect
                                                value={createPrimaryRoleId}
                                                onChange={v => { applyCreatePrimaryRole(v); }}
                                                options={rolesForEscalation.map(r => ({ label: r.name, value: r.id }))}
                                                placeholder="-- Select Critical role --"
                                            />
                                            {createPrimaryRoleId && existingPolicyForCreateRole && (
                                                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.28)' }}>
                                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                                                        An escalation configuration already exists for this role (primary level). You cannot create another here.
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary btn-sm"
                                                        style={{ marginTop: 8 }}
                                                        onClick={() => openEditChainForPrimaryRole(createPrimaryRoleId)}
                                                    >
                                                        Click here to edit that configuration
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <label className="label">Description</label>
                                            <textarea
                                                className="input"
                                                value={newDesc}
                                                maxLength={DESC_LIMIT}
                                                onChange={e => setNewDesc(e.target.value.slice(0, DESC_LIMIT))}
                                                placeholder="Describe when this escalation should trigger..."
                                                style={{ fontSize: 13, minHeight: 60, resize: 'vertical' }}
                                            />
                                            <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--text-muted)', textAlign: 'right' }}>
                                                {newDesc.length}/{DESC_LIMIT}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="label">Department (optional)</label>
                                            <CustomSelect
                                                value={newDept}
                                                onChange={v => setNewDept(v)}
                                                options={departments.map(d => ({ label: d, value: d }))}
                                                placeholder="-- Select Department --"
                                            />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                            <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--danger)' }}>priority_high</span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600 }}>Priority: Critical</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>This role will be mandatory and set to Critical priority.</div>
                                            </div>
                                            <span className="badge badge-critical" style={{ fontSize: 10 }}>Critical</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
                                        <button className="btn btn-secondary btn-sm" onClick={resetCreate}>Cancel</button>
                                        <button className="btn btn-primary btn-sm" onClick={() => setCreateStep(1)} disabled={!createPrimaryRoleId.trim() || Boolean(existingPolicyForCreateRole)}>
                                            Next: Levels <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_forward</span>
                                        </button>
                                    </div>
                                </> 
                            )}

                            {createStep === 1 && (
                                <>
                                    {renderLadder(newLevels, setNewLevels, { lockFirstLevelRole: Boolean(createPrimaryRoleId) })}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 18 }}>
                                        <button className="btn btn-secondary btn-sm" onClick={() => setCreateStep(0)}>
                                            <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_back</span> Back
                                        </button>
                                        <button className="btn btn-primary btn-sm" onClick={() => setCreateStep(2)} disabled={hasDuplicates(newLevels)}>
                                            Next: Summary <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_forward</span>
                                        </button>
                                    </div>
                                </>
                            )}

                            {createStep === 2 && (
                                <>
                                    {renderSummary(newLevels, roles.find(r => r.id === createPrimaryRoleId)?.name || 'Role')}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 18 }}>
                                        <button className="btn btn-secondary btn-sm" onClick={() => setCreateStep(1)}>
                                            <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_back</span> Back
                                        </button>
                                        <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={!createPrimaryRoleId.trim() || Boolean(existingPolicyForCreateRole) || newLevels.some(l => !l.target)}>
                                            <span className="material-icons-round" style={{ fontSize: 14 }}>check</span> Create Escalation
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Loading escalation data...</div>
                    )}

                    {/* Main Content: Table + Detail */}
                    {!loading && (
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: selectedChain ? 'minmax(0, 1fr) minmax(300px, 380px)' : '1fr',
                                gap: 20,
                                alignItems: 'start',
                                width: '100%',
                                minWidth: 0,
                            }}
                        >
                            {/* Escalations Table — scroll horizontally when detail panel narrows the list */}
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
                                    <table style={{ width: 'max-content', minWidth: 760, borderCollapse: 'collapse', tableLayout: 'auto' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Department</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Priority</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Levels</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Roles</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                                                    {search ? 'No escalations match your search.' : 'No Critical roles with escalation chains found. Create one or add escalation levels to existing Critical roles from the Roles page.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            filtered.map(chain => (
                                                <tr key={chain.key} onClick={() => setSelectedChainKey(chain.key)} style={{ cursor: 'pointer', background: selectedChainKey === chain.key ? '#edf1f7' : undefined, borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.1s' }}
                                                    onMouseEnter={e => { if (selectedChainKey !== chain.key) e.currentTarget.style.background = '#fafbfc'; }}
                                                    onMouseLeave={e => { if (selectedChainKey !== chain.key) e.currentTarget.style.background = 'transparent'; }}
                                                >
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{chain.chainName}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chain.description}</div>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', fontSize: 12, color: chain.department ? 'var(--text-secondary)' : 'var(--text-disabled)' }}>{chain.department || 'Unassigned'}</td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                        <span className="badge badge-critical" style={{ fontSize: 10 }}>Critical</span>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                        <span className="badge badge-info" style={{ fontSize: 10 }}>{chain.levels.length} levels</span>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                        <span className="badge badge-neutral" style={{ fontSize: 10 }}>{chain.roles.length} role{chain.roles.length > 1 ? 's' : ''}</span>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                                                            <button className="btn btn-secondary btn-xs" onClick={e => { e.stopPropagation(); openEditChain(chain); }}>
                                                                <span className="material-icons-round" style={{ fontSize: 13 }}>edit</span>
                                                            </button>
                                                            <button className="btn btn-danger btn-xs" onClick={e => { e.stopPropagation(); setConfirmDelete(chain); }}>
                                                                <span className="material-icons-round" style={{ fontSize: 13 }}>delete</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                                </div>
                                {filtered.length > 0 && (
                                    <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                                        Showing {filtered.length} of {chainGroups.length} escalation chains
                                    </div>
                                )}
                            </div>

                            {/* Detail Panel */}
                            {selectedChain && (
                                <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, alignSelf: 'start' }}>
                                    {/* Header */}
                                    <div className="card" style={{ padding: '18px 20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <h3 style={{ fontSize: 16, fontWeight: 700, wordBreak: 'break-word', margin: 0 }}>{selectedChain.chainName}</h3>
                                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{selectedChain.department || 'No department'}</p>
                                            </div>
                                            <button className="btn btn-primary btn-xs" style={{ flexShrink: 0 }} onClick={() => openEditChain(selectedChain)}>
                                                <span className="material-icons-round" style={{ fontSize: 13 }}>edit</span>Edit
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            <span className="badge badge-critical">Critical</span>
                                            <span className={`badge ${selectedChain.enabled ? 'badge-success' : 'badge-neutral'}`}>{selectedChain.enabled ? 'Active' : 'Disabled'}</span>
                                            <span className="badge badge-info">{selectedChain.levels.length} Levels</span>
                                            <span className="badge badge-neutral">{selectedChain.roles.length} Role{selectedChain.roles.length > 1 ? 's' : ''}</span>
                                        </div>
                                    </div>

                                    {/* Roles in this chain */}
                                    {selectedChain.roles.length > 0 && (
                                        <div className="card" style={{ padding: '16px 20px' }}>
                                            <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Associated Roles</h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {selectedChain.roles.map(r => (
                                                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                                        <span className="material-icons-round" style={{ fontSize: 15, color: 'var(--text-muted)' }}>person</span>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.name}</div>
                                                            {r.description && <div style={{ fontSize: 10.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description}</div>}
                                                        </div>
                                                        <span className={`badge ${r.enabled ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: 9 }}>{r.enabled ? 'Active' : 'Off'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Escalation Ladder (read-only with colored circles) */}
                                    <div className="card" style={{ padding: '16px 20px' }}>
                                        {renderLadderReadOnly(selectedChain.levels)}
                                    </div>

                                    {/* Quick Actions */}
                                    <div className="card" style={{ padding: '16px 20px' }}>
                                        <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Actions</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => openEditChain(selectedChain)}>
                                                <span className="material-icons-round" style={{ fontSize: 14 }}>edit</span>Edit Escalation
                                            </button>
                                            <button className="btn btn-danger btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setConfirmDelete(selectedChain)}>
                                                <span className="material-icons-round" style={{ fontSize: 14 }}>delete</span>Delete Escalation
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}
