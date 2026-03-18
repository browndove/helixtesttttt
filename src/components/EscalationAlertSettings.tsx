'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';
import CustomSelect from '@/components/CustomSelect';

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

const delayOptions = ['0 min', '1 min', '2 min', '3 min', '5 min', '7 min', '10 min', '12 min', '15 min', '20 min', '30 min'];

const levelColor = (i: number) => {
    if (i === 0) return '#6bb89c';
    if (i === 1) return '#c9a94e';
    return '#c26b6b';
};

function secondsToDelay(s: number): string {
    const mins = Math.round(s / 60);
    return `${mins} min`;
}

function delayToSeconds(d: string): number {
    const match = d.match(/(\d+)/);
    return match ? parseInt(match[1]) * 60 : 0;
}

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
            const rec = d as { name?: string; department_name?: string };
            return (rec.name || rec.department_name || '').trim();
        })
        .filter(Boolean);

    return Array.from(new Set(names));
}

export default function EscalationAlertSettings() {
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
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newDept, setNewDept] = useState('');
    const [newLevels, setNewLevels] = useState<EscalationLevel[]>([
        { level: 1, target: '', delay: '0 min' },
        { level: 2, target: '', delay: '3 min' },
    ]);

    // Edit modal
    const [editPolicyId, setEditPolicyId] = useState<string | null>(null);
    const [editRole, setEditRole] = useState<Role | null>(null);
    const [editStep, setEditStep] = useState(0);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editLevels, setEditLevels] = useState<EscalationLevel[]>([]);
    const [editSaving, setEditSaving] = useState(false);

    const closeEditModal = () => { setEditPolicyId(null); setEditRole(null); };

    // Delete confirm
    const [confirmDelete, setConfirmDelete] = useState<ChainGroup | null>(null);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const fetchData = useCallback(async () => {
        try {
            const [rolesRes, deptsRes, policiesRes] = await Promise.all([
                fetch('/api/proxy/roles'),
                fetch('/api/proxy/departments'),
                fetch('/api/proxy/escalation-policies'),
            ]);
            // Build department ID → name map
            let deptMap = new Map<string, string>();
            if (deptsRes.ok) {
                const depts = await deptsRes.json();
                setDepartments(extractDepartmentNames(depts));
                const list = Array.isArray(depts) ? depts : (depts?.items || depts?.data || depts?.departments || []);
                const nameToId = new Map<string, string>();
                if (Array.isArray(list)) {
                    for (const d of list) {
                        if (d && typeof d === 'object' && d.id) {
                            const name = d.name || d.department_name || '';
                            if (name) {
                                deptMap.set(d.id, name);
                                nameToId.set(name, d.id);
                            }
                        }
                    }
                }
                setDeptIdMap(nameToId);
            }
            if (rolesRes.ok) {
                const data = await rolesRes.json();
                const rolesArr = Array.isArray(data) ? data : [];
                setRoles(rolesArr.map((r: Role & { department_id?: string }) => normalizeRoleForUi({
                    ...r,
                    department: r.department || (r.department_id ? deptMap.get(r.department_id) || '' : ''),
                    escalation_levels: r.escalation_levels?.length ? r.escalation_levels : [],
                })));
            }
            if (policiesRes.ok) {
                const pData = await policiesRes.json();
                let policiesArr: Policy[] = Array.isArray(pData) ? pData : [];
                // Hydrate policies that are missing steps by fetching individually
                const needsHydration = policiesArr.some(p => !p.steps || p.steps.length === 0);
                if (needsHydration && policiesArr.length > 0) {
                    const hydrated = await Promise.all(
                        policiesArr.map(async (p) => {
                            if (p.steps && p.steps.length > 0) return p;
                            try {
                                const res = await fetch(`/api/proxy/escalation-policies/${p.id}`);
                                if (res.ok) {
                                    const full = await res.json();
                                    return { ...p, ...full };
                                }
                            } catch { /* keep original */ }
                            return p;
                        })
                    );
                    policiesArr = hydrated;
                }
                setPolicies(policiesArr);
            }
        } catch { showToast('Failed to load data'); }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Build display rows from escalation policies (one policy = one row)
    const chainGroups = useMemo(() => {
        const roleMap = new Map(roles.map(r => [r.id, r]));
        const roleNameMap = new Map(roles.map(r => [r.id, r.name]));
        return policies.map(p => {
            const role = roleMap.get(p.role_id);
            const levels = stepsToLevels(p.steps || [], roleNameMap);
            const targetNames = levels.map(l => l.target).filter(Boolean);
            const matchedTemplate = escalationTemplates.find(t =>
                t.roleNames.length === targetNames.length &&
                t.roleNames.every((name, idx) => name === targetNames[idx])
            );
            const chainName = matchedTemplate?.name || role?.name || targetNames.join(' \u2192 ') || 'Unnamed Policy';
            const description = matchedTemplate?.description || role?.description || `${levels.length} step escalation chain`;
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

    const filtered = chainGroups.filter(c => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return c.chainName.toLowerCase().includes(q) || c.department.toLowerCase().includes(q) || c.roles.some(r => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
    });

    // --- Create ---
    const resetCreate = () => {
        setShowCreate(false); setCreateStep(0);
        setNewName(''); setNewDesc(''); setNewDept('');
        setNewLevels([{ level: 1, target: '', delay: '0 min' }, { level: 2, target: '', delay: '3 min' }]);
    };

    const handleCreate = async () => {
        if (!newName.trim()) return;
        try {
            // 1. Create the role with Critical priority
            const roleRes = await fetch('/api/proxy/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName.trim(),
                    description: newDesc.trim(),
                    department_id: deptIdMap.get(newDept) || undefined,
                    priority: 'critical',
                }),
            });
            if (!roleRes.ok) { showToast('Failed to create role'); return; }
            const role = await roleRes.json();

            // 2. Create escalation policy for the role
            const policyRes = await fetch('/api/proxy/escalation-policies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role_id: role.id,
                    initial_timeout_seconds: Math.max(30, delayToSeconds(newLevels[0]?.delay || '3 min')),
                }),
            });
            if (!policyRes.ok) { showToast('Failed to create escalation policy'); return; }
            const policy = await policyRes.json();

            // 3. Bulk add escalation steps
            const steps = newLevels
                .filter(l => l.target)
                .map(l => ({
                    target_role_id: l.target_role_id || allRolesForSelect.find(r => r.name === l.target)?.id || '',
                    timeout_seconds: Math.max(30, delayToSeconds(l.delay)),
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

            showToast(`"${newName}" created`);
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
        setEditLevels(chain.levels.map(l => ({ ...l })));
    };

    const handleSaveEdit = async () => {
        if (!editPolicyId || !editName.trim()) return;
        setEditSaving(true);
        try {
            // 1. Update policy initial timeout
            const putRes = await fetch(`/api/proxy/escalation-policies/${editPolicyId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    initial_timeout_seconds: Math.max(30, delayToSeconds(editLevels[0]?.delay || '3 min')),
                }),
            });
            if (!putRes.ok) { showToast('Failed to update policy timeout'); setEditSaving(false); return; }

            // 2. Build new steps (validate before deleting old ones)
            const steps = editLevels
                .filter(l => l.target)
                .map(l => {
                    const roleId = l.target_role_id || allRolesForSelect.find(r => r.name === l.target)?.id || '';
                    return {
                        target_role_id: roleId,
                        timeout_seconds: Math.max(30, delayToSeconds(l.delay)),
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

            // 5. Update associated role name/description
            if (editRole) {
                await fetch(`/api/proxy/roles/${editRole.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: editName.trim(),
                        description: editDesc.trim(),
                    }),
                });
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
    const renderLadder = (levels: EscalationLevel[], setLevels: (l: EscalationLevel[]) => void) => {
        const sorted = [...levels].sort((a, b) => a.level - b.level);
        const selectedTargets = new Set(levels.map(l => l.target).filter(Boolean));

        const MAX_STEPS = 3;
        const addLevel = () => {
            if (levels.length >= MAX_STEPS) return;
            const next = sorted.length > 0 ? sorted[sorted.length - 1].level + 1 : 1;
            setLevels([...levels, { level: next, target: '', delay: '5 min' }]);
        };
        const removeLevel = (num: number) => {
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
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Select a role for each escalation level. Each role can only appear once in the chain.</div>
                </div>
                {sorted.map((lvl, i) => {
                    const available = getAvailable(lvl.target);
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
                                        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Level {lvl.level} — Target Role</span>
                                        {sorted.length > 1 && (
                                            <button type="button" onClick={() => removeLevel(lvl.level)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'inline-flex', color: 'var(--text-muted)', borderRadius: 'var(--radius-sm)' }} title="Remove level" onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                                                <span className="material-icons-round" style={{ fontSize: 14 }}>close</span>
                                            </button>
                                        )}
                                    </div>
                                    {lvl.target ? (
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
                                    ) : (
                                        <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            {available.length === 0 ? (
                                                <div style={{ padding: '12px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>No more roles available</div>
                                            ) : available.map(r => (
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
                                    )}
                                </div>
                                {/* Delay */}
                                <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)' }}>
                                    <span className="material-icons-round" style={{ fontSize: 14, color: 'var(--text-muted)' }}>schedule</span>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>Delay:</span>
                                    <CustomSelect
                                        value={lvl.delay}
                                        onChange={v => { const u = levels.map(l => l.level === lvl.level ? { ...l, delay: v } : l); setLevels(u); }}
                                        options={delayOptions.map(d => ({ label: d, value: d }))}
                                        placeholder="Delay"
                                        style={{ width: 100 }}
                                        maxH={160}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
                {sorted.length < MAX_STEPS && (
                    <button type="button" className="btn btn-secondary btn-xs" onClick={addLevel} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                        <span className="material-icons-round" style={{ fontSize: 13 }}>add</span>Add Level
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
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Summary</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Review the escalation chain for <strong>{name}</strong> before saving.</div>
                </div>

                {/* Visual chain */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '12px 0' }}>
                    {sorted.map((lvl, i) => (
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
                                    <span>Delay: <strong style={{ color: 'var(--text-secondary)' }}>{lvl.delay}</strong></span>
                                    <span style={{ color: levelColor(i), fontWeight: 600 }}>
                                        {i === 0 ? 'Initial Responder' : i === 1 ? 'First Escalation' : `Escalation Level ${lvl.level}`}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Empty target warning */}
                {sorted.some(l => !l.target) && (
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
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{lvl.delay}</span>
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

    return (
        <div className="app-shell">
            <Sidebar sections={navSections} />

            {toast && (
                <div className="toast-enter" style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '10px 18px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--success)' }}>check_circle</span>
                    {toast}
                </div>
            )}

            {/* Edit Modal */}
            {editPolicyId && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={closeEditModal}>
                    <div className="fade-in card" style={{ width: 560, maxHeight: '85vh', overflow: 'auto', padding: '28px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: 16, marginBottom: 16 }}>Edit Escalation Chain</h3>

                        {renderSteps(editStep, ['Basic Info', 'Escalation Levels', 'Summary'])}

                        {editStep === 0 && (
                            <>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div>
                                        <label className="label">Escalation Name</label>
                                        <input className="input" value={editName} onChange={e => setEditName(e.target.value)} style={{ fontSize: 13 }} />
                                    </div>
                                    <div>
                                        <label className="label">Description</label>
                                        <textarea className="input" value={editDesc} onChange={e => setEditDesc(e.target.value)} style={{ fontSize: 13, minHeight: 60, resize: 'vertical' }} />
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
                                    <button className="btn btn-primary btn-sm" onClick={() => setEditStep(1)} disabled={!editName.trim()}>
                                        Next: Levels <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_forward</span>
                                    </button>
                                </div>
                            </>
                        )}

                        {editStep === 1 && (
                            <>
                                {renderLadder(editLevels, setEditLevels)}
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
                                    <button className="btn btn-primary btn-sm" onClick={handleSaveEdit} disabled={editSaving || !editName.trim() || editLevels.some(l => !l.target)}>
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
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setConfirmDelete(null)}>
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

                <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>
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
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Define a new Critical role with an escalation chain.</p>

                            {renderSteps(createStep, ['Basic Info', 'Escalation Levels', 'Summary'])}

                            {createStep === 0 && (
                                <>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <div>
                                            <label className="label">Escalation Name</label>
                                            <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. ICU Critical Response" style={{ fontSize: 13 }} />
                                        </div>
                                        <div>
                                            <label className="label">Description</label>
                                            <textarea className="input" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Describe when this escalation should trigger..." style={{ fontSize: 13, minHeight: 60, resize: 'vertical' }} />
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
                                        <button className="btn btn-primary btn-sm" onClick={() => setCreateStep(1)} disabled={!newName.trim()}>
                                            Next: Levels <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_forward</span>
                                        </button>
                                    </div>
                                </> 
                            )}

                            {createStep === 1 && (
                                <>
                                    {renderLadder(newLevels, setNewLevels)}
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
                                    {renderSummary(newLevels, newName)}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 18 }}>
                                        <button className="btn btn-secondary btn-sm" onClick={() => setCreateStep(1)}>
                                            <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_back</span> Back
                                        </button>
                                        <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={!newName.trim() || newLevels.some(l => !l.target)}>
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
                        <div style={{ display: 'grid', gridTemplateColumns: selectedChain ? '1fr 380px' : '1fr', gap: 20 }}>
                            {/* Escalations Table */}
                            <div className="fade-in delay-1 card" style={{ padding: 0, overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Escalation Name</th>
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
                                {filtered.length > 0 && (
                                    <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)' }}>
                                        Showing {filtered.length} of {chainGroups.length} escalation chains
                                    </div>
                                )}
                            </div>

                            {/* Detail Panel */}
                            {selectedChain && (
                                <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
        </div>
    );
}
