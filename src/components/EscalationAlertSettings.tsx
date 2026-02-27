'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

type EscalationLevel = {
    level: number;
    target: string;
    delay: string;
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

type ChainGroup = {
    key: string;
    chainName: string;
    description: string;
    levels: EscalationLevel[];
    roles: Role[];
    department: string;
    enabled: boolean;
    primaryRoleId: string;
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

export default function EscalationAlertSettings() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
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
    const [editRole, setEditRole] = useState<Role | null>(null);
    const [editStep, setEditStep] = useState(0);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editLevels, setEditLevels] = useState<EscalationLevel[]>([]);
    const [editSaving, setEditSaving] = useState(false);

    // Delete confirm
    const [confirmDelete, setConfirmDelete] = useState<ChainGroup | null>(null);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const fetchData = useCallback(async () => {
        try {
            const [rolesRes, deptsRes] = await Promise.all([
                fetch('/api/roles'),
                fetch('/api/departments'),
            ]);
            if (rolesRes.ok) {
                const data = await rolesRes.json();
                setRoles(data.map((r: Role) => ({
                    ...r,
                    escalation_levels: r.escalation_levels?.length ? r.escalation_levels : [],
                })));
            }
            if (deptsRes.ok) {
                const depts = await deptsRes.json();
                setDepartments(depts.map((d: { name: string }) => d.name));
            }
        } catch { showToast('Failed to load data'); }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Only show Critical/mandatory roles that have escalation chains
    const criticalRoles = useMemo(() =>
        roles.filter(r => r.priority === 'Critical' && r.mandatory && r.escalation_levels.length > 0),
    [roles]);

    // Group roles by their escalation chain signature (same targets+delays = same chain)
    const chainGroups = useMemo(() => {
        const groups = new Map<string, ChainGroup>();
        for (const role of criticalRoles) {
            const sorted = [...role.escalation_levels].sort((a, b) => a.level - b.level);
            const key = sorted.map(l => `${l.target}|${l.delay}`).join('::');
            if (!groups.has(key)) {
                // Try to match to a known template by role names
                const targetNames = sorted.map(l => l.target).filter(Boolean);
                const matchedTemplate = escalationTemplates.find(t =>
                    t.roleNames.length === targetNames.length &&
                    t.roleNames.every((name, idx) => name === targetNames[idx])
                );
                const chainName = matchedTemplate?.name || targetNames.join(' \u2192 ') || 'Unnamed Chain';
                const description = matchedTemplate?.description || `${targetNames.length} step escalation chain`;
                groups.set(key, {
                    key,
                    chainName,
                    description,
                    levels: sorted,
                    roles: [],
                    department: role.department || '',
                    enabled: role.enabled,
                    primaryRoleId: role.id,
                });
            }
            groups.get(key)!.roles.push(role);
        }
        return Array.from(groups.values());
    }, [criticalRoles]);

    // All roles with their details for target selection
    const allRolesForSelect = useMemo(() =>
        roles.map(r => ({ name: r.name, description: r.description, department: r.department })).sort((a, b) => a.name.localeCompare(b.name)),
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
            const res = await fetch('/api/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName.trim(),
                    description: newDesc.trim(),
                    department: newDept,
                    mandatory: true,
                    priority: 'Critical',
                    escalation_levels: newLevels,
                }),
            });
            if (res.ok) {
                const role = await res.json();
                setRoles(prev => [...prev, { ...role, escalation_levels: role.escalation_levels || newLevels }]);
                showToast(`"${newName}" created`);
                resetCreate();
            }
        } catch { showToast('Failed to create escalation'); }
    };

    // --- Edit ---
    const openEditChain = (chain: ChainGroup) => {
        const primary = chain.roles[0];
        setEditRole(primary); setEditStep(0);
        setEditName(chain.chainName); setEditDesc(chain.description);
        setEditLevels(chain.levels.map(l => ({ ...l })));
    };

    const handleSaveEdit = async () => {
        if (!editRole || !editName.trim()) return;
        setEditSaving(true);
        try {
            const res = await fetch(`/api/roles/${editRole.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editName.trim(),
                    description: editDesc.trim(),
                    department: editRole.department,
                    mandatory: true,
                    priority: 'Critical',
                    enabled: editRole.enabled,
                    visible_in_directory: true,
                    escalation_routing: [],
                    escalation_levels: editLevels,
                }),
            });
            if (res.ok) {
                const updated = await res.json();
                setRoles(prev => prev.map(r => r.id === editRole.id ? {
                    ...r, ...updated,
                    escalation_levels: updated.escalation_levels?.length ? updated.escalation_levels : editLevels,
                } : r));
                showToast(`"${editName}" updated`);
                setEditRole(null);
            }
        } catch { showToast('Failed to save changes'); }
        setEditSaving(false);
    };

    // --- Delete ---
    const handleDeleteChain = async (chain: ChainGroup) => {
        try {
            // Delete all roles in this chain group
            const ids = chain.roles.map(r => r.id);
            for (const id of ids) {
                await fetch(`/api/roles/${id}`, { method: 'DELETE' });
            }
            setRoles(prev => prev.filter(r => !ids.includes(r.id)));
            if (selectedChainKey === chain.key) setSelectedChainKey(null);
            showToast(`"${chain.chainName}" deleted (${ids.length} role${ids.length > 1 ? 's' : ''})`);
        } catch { showToast('Failed to delete'); }
        setConfirmDelete(null);
    };

    // --- Ladder editor ---
    const renderLadder = (levels: EscalationLevel[], setLevels: (l: EscalationLevel[]) => void) => {
        const sorted = [...levels].sort((a, b) => a.level - b.level);
        const selectedTargets = new Set(levels.map(l => l.target).filter(Boolean));

        const addLevel = () => {
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
                                            <button type="button" onClick={() => { const u = levels.map(l => l.level === lvl.level ? { ...l, target: '' } : l); setLevels(u); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'inline-flex', color: 'var(--text-muted)' }} title="Change role">
                                                <span className="material-icons-round" style={{ fontSize: 14 }}>swap_horiz</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            {available.length === 0 ? (
                                                <div style={{ padding: '12px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>No more roles available</div>
                                            ) : available.map(r => (
                                                <button key={r.name} type="button" onClick={() => { const u = levels.map(l => l.level === lvl.level ? { ...l, target: r.name } : l); setLevels(u); }}
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
                                    <select className="input" value={lvl.delay} onChange={e => { const u = levels.map(l => l.level === lvl.level ? { ...l, delay: e.target.value } : l); setLevels(u); }} style={{ fontSize: 12, height: 28, padding: '0 8px', width: 90 }}>
                                        {delayOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <button type="button" className="btn btn-secondary btn-xs" onClick={addLevel} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                    <span className="material-icons-round" style={{ fontSize: 13 }}>add</span>Add Level
                </button>
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
            {editRole && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setEditRole(null)}>
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
                                    <button className="btn btn-secondary btn-sm" onClick={() => setEditRole(null)}>Cancel</button>
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
                            Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{confirmDelete.chainName}</strong>? This will remove {confirmDelete.roles.length} associated role{confirmDelete.roles.length > 1 ? 's' : ''} and the escalation chain. This action cannot be undone.
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
                                            <select className="input" value={newDept} onChange={e => setNewDept(e.target.value)} style={{ fontSize: 13 }}>
                                                <option value="">-- Select Department --</option>
                                                {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
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
