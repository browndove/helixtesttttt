'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

type EscalationLevel = {
    level: number;
    target: string;
    delay: string;
};

type RoutingRule = {
    id: string;
    label: string;
    desc: string;
    enabled: boolean;
};

type Role = {
    id: string;
    name: string;
    department: string;
    mandatory: boolean;
    enabled: boolean;
    priority: string;
    visible_in_directory: boolean;
    escalation_routing: RoutingRule[];
    escalation_levels: EscalationLevel[];
};

const defaultRoutingRules: RoutingRule[] = [
    { id: 'by-dept', label: 'By Department', desc: 'Escalate to staff within the same department.', enabled: true },
    { id: 'by-floor', label: 'By Floor', desc: 'Escalate to nearest available staff on the same floor.', enabled: false },
    { id: 'by-ward', label: 'By Ward / Unit', desc: 'Route to staff assigned to the same ward or unit.', enabled: true },
    { id: 'by-role', label: 'By Role Hierarchy', desc: 'Escalate up the role hierarchy (e.g. Nurse → Charge Nurse → Attending).', enabled: true },
];

const defaultEscalationLevels: EscalationLevel[] = [
    { level: 1, target: 'Same Role', delay: '0 min' },
    { level: 2, target: 'Supervisor', delay: '3 min' },
    { level: 3, target: 'Department Head', delay: '7 min' },
    { level: 4, target: 'Admin / On-Call', delay: '12 min' },
];

const escalationTargetOptions = ['Same Role', 'Supervisor', 'Department Head', 'Admin / On-Call', 'Charge Nurse', 'Attending Physician'];
const delayOptions = ['0 min', '1 min', '2 min', '3 min', '5 min', '7 min', '10 min', '12 min', '15 min', '20 min'];

export default function RolesBuilderAssignment() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [toast, setToast] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Add Role multi-step form state
    const [showAddForm, setShowAddForm] = useState(false);
    const [addStep, setAddStep] = useState(1); // 1 = basic info, 2 = escalation settings
    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleDept, setNewRoleDept] = useState('');
    const [newRoleMandatory, setNewRoleMandatory] = useState(false);
    const [newRouting, setNewRouting] = useState<RoutingRule[]>(defaultRoutingRules.map(r => ({ ...r })));
    const [newEscLevels, setNewEscLevels] = useState<EscalationLevel[]>(defaultEscalationLevels.map(l => ({ ...l })));

    // Edit modal state
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [editStep, setEditStep] = useState(1);
    const [editName, setEditName] = useState('');
    const [editDept, setEditDept] = useState('');
    const [editMandatory, setEditMandatory] = useState(false);
    const [editEnabled, setEditEnabled] = useState(true);
    const [editVisible, setEditVisible] = useState(true);
    const [editRouting, setEditRouting] = useState<RoutingRule[]>([]);
    const [editEscLevels, setEditEscLevels] = useState<EscalationLevel[]>([]);
    const [editSaving, setEditSaving] = useState(false);

    // Confirm delete state
    const [confirmDelete, setConfirmDelete] = useState<Role | null>(null);

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
                    escalation_routing: r.escalation_routing || defaultRoutingRules,
                    escalation_levels: r.escalation_levels || defaultEscalationLevels,
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

    const filteredRoles = roles.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.department.toLowerCase().includes(search.toLowerCase())
    );

    const selectedRole = roles.find(r => r.id === selectedId) || null;

    const resetAddForm = () => {
        setNewRoleName('');
        setNewRoleDept('');
        setNewRoleMandatory(false);
        setNewRouting(defaultRoutingRules.map(r => ({ ...r })));
        setNewEscLevels(defaultEscalationLevels.map(l => ({ ...l })));
        setAddStep(1);
        setShowAddForm(false);
    };

    const handleAddRole = async () => {
        if (!newRoleName.trim()) return;
        try {
            const res = await fetch('/api/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newRoleName.trim(),
                    department: newRoleDept,
                    mandatory: newRoleMandatory,
                    priority: newRoleMandatory ? 'Critical' : 'Standard',
                    escalation_routing: newRouting,
                    escalation_levels: newEscLevels,
                }),
            });
            if (res.ok) {
                const role = await res.json();
                setRoles(prev => [...prev, {
                    ...role,
                    escalation_routing: role.escalation_routing || newRouting,
                    escalation_levels: role.escalation_levels || newEscLevels,
                }]);
                showToast(`"${newRoleName}" created with escalation settings`);
                resetAddForm();
            }
        } catch { showToast('Failed to add role'); }
    };

    const handleRemoveRole = async (role: Role) => {
        try {
            const res = await fetch(`/api/roles/${role.id}`, { method: 'DELETE' });
            if (res.ok) {
                setRoles(prev => prev.filter(r => r.id !== role.id));
                showToast(`"${role.name}" removed`);
                setConfirmDelete(null);
            }
        } catch { showToast('Failed to remove role'); }
    };

    const handleToggleMandatory = async (role: Role) => {
        try {
            const newMandatory = !role.mandatory;
            const res = await fetch(`/api/roles/${role.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ...role, 
                    mandatory: newMandatory,
                    priority: newMandatory ? 'Critical' : 'Standard'
                }),
            });
            if (res.ok) {
                const updated = await res.json();
                setRoles(prev => prev.map(r => r.id === role.id ? { ...r, ...updated } : r));
            }
        } catch { showToast('Failed to update role'); }
    };

    const openEditModal = (role: Role) => {
        setEditingRole(role);
        setEditStep(1);
        setEditName(role.name);
        setEditDept(role.department);
        setEditMandatory(role.mandatory);
        setEditEnabled(role.enabled);
        setEditVisible(role.visible_in_directory ?? true);
        setEditRouting((role.escalation_routing || defaultRoutingRules).map(r => ({ ...r })));
        setEditEscLevels((role.escalation_levels || defaultEscalationLevels).map(l => ({ ...l })));
    };

    const handleSaveEdit = async () => {
        if (!editingRole || !editName.trim()) return;
        setEditSaving(true);
        try {
            const res = await fetch(`/api/roles/${editingRole.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editName.trim(),
                    department: editDept,
                    mandatory: editMandatory,
                    priority: editMandatory ? 'Critical' : 'Standard',
                    enabled: editEnabled,
                    visible_in_directory: editVisible,
                    escalation_routing: editRouting,
                    escalation_levels: editEscLevels,
                }),
            });
            if (res.ok) {
                const updated = await res.json();
                setRoles(prev => prev.map(r => r.id === editingRole.id ? {
                    ...r, ...updated,
                    escalation_routing: updated.escalation_routing || editRouting,
                    escalation_levels: updated.escalation_levels || editEscLevels,
                } : r));
                showToast(`"${editName}" updated`);
                setEditingRole(null);
            }
        } catch { showToast('Failed to save changes'); }
        setEditSaving(false);
    };

    // --- Shared Escalation Settings UI ---
    const renderRoutingRules = (rules: RoutingRule[], setRules: (rules: RoutingRule[]) => void) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ marginBottom: 2 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Message Routing Rules</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Define how unacknowledged messages get escalated.</div>
            </div>
            {rules.map((rule, i) => (
                <div key={rule.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: 'var(--radius-md)',
                    background: rule.enabled ? 'var(--surface-2)' : 'transparent',
                    border: `1px solid ${rule.enabled ? 'var(--border-default)' : 'var(--border-subtle)'}`,
                    opacity: rule.enabled ? 1 : 0.55, transition: 'all 0.2s',
                }}>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: 12.5 }}>{rule.label}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>{rule.desc}</div>
                    </div>
                    <label className="toggle">
                        <input type="checkbox" checked={rule.enabled} onChange={() => {
                            const updated = [...rules];
                            updated[i] = { ...rule, enabled: !rule.enabled };
                            setRules(updated);
                        }} />
                        <span className="toggle-slider" />
                    </label>
                </div>
            ))}
        </div>
    );

    const renderEscalationLadder = (levels: EscalationLevel[], setLevels: (levels: EscalationLevel[]) => void) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            <div style={{ marginBottom: 2 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Escalation Ladder</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>When a message goes unacknowledged, it escalates through these levels.</div>
            </div>
            <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--surface-2)' }}>
                            <th style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', padding: '8px 10px', borderBottom: '1px solid var(--border-default)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Level</th>
                            <th style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', padding: '8px 10px', borderBottom: '1px solid var(--border-default)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target</th>
                            <th style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', padding: '8px 10px', borderBottom: '1px solid var(--border-default)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Delay</th>
                        </tr>
                    </thead>
                    <tbody>
                        {levels.map((lvl, i) => (
                            <tr key={lvl.level}>
                                <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 700, borderBottom: i < levels.length - 1 ? '1px solid var(--border-subtle)' : 'none', width: 50 }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: 'var(--helix-primary)', color: '#fff', fontSize: 11, fontWeight: 700 }}>{lvl.level}</span>
                                </td>
                                <td style={{ padding: '8px 10px', borderBottom: i < levels.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                                    <select className="input" value={lvl.target} onChange={e => {
                                        const updated = [...levels];
                                        updated[i] = { ...lvl, target: e.target.value };
                                        setLevels(updated);
                                    }} style={{ fontSize: 12, height: 30, padding: '0 8px' }}>
                                        {escalationTargetOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </td>
                                <td style={{ padding: '8px 10px', borderBottom: i < levels.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                                    <select className="input" value={lvl.delay} onChange={e => {
                                        const updated = [...levels];
                                        updated[i] = { ...lvl, delay: e.target.value };
                                        setLevels(updated);
                                    }} style={{ fontSize: 12, height: 30, padding: '0 8px', width: 90 }}>
                                        {delayOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // --- Step indicators ---
    const renderStepIndicator = (currentStep: number, isCritical: boolean) => {
        if (!isCritical) return null;

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
            <div className="app-shell">
                <Sidebar sections={navSections} />
                <div className="app-main">
                    <TopBar title="Roles" subtitle="Role Management" />
                    <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>
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
            </div>
        );
    }

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
            {editingRole && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setEditingRole(null)}>
                    <div className="fade-in card" style={{ width: 540, maxHeight: '85vh', overflow: 'auto', padding: '28px 28px 24px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: 16, marginBottom: 16 }}>Edit Role</h3>

                        {renderStepIndicator(editStep, editMandatory)}

                        {editStep === 1 && (
                            <>
                                <div style={{ marginBottom: 14 }}>
                                    <label className="label">Role Name</label>
                                    <input className="input" value={editName} onChange={e => setEditName(e.target.value)} style={{ fontSize: 13 }} />
                                </div>

                                <div style={{ marginBottom: 14 }}>
                                    <label className="label">Department</label>
                                    <select className="input" value={editDept} onChange={e => setEditDept(e.target.value)} style={{ fontSize: 13 }}>
                                        <option value="">-- Select Department --</option>
                                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: editMandatory ? 'rgba(239,68,68,0.06)' : 'var(--surface-2)', border: `1px solid ${editMandatory ? 'rgba(239,68,68,0.25)' : 'var(--border-subtle)'}`, transition: 'all 0.2s' }}>
                                        <input type="checkbox" className="checkbox" checked={editMandatory} onChange={() => setEditMandatory(!editMandatory)} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>This role must always be filled</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Require at least one person assigned and signed in at all times.</div>
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
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>Show in Staff Directory</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Make this role visible and searchable.</div>
                                        </div>
                                        <label className="toggle">
                                            <input type="checkbox" checked={editVisible} onChange={() => setEditVisible(!editVisible)} />
                                            <span className="toggle-slider" />
                                        </label>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingRole(null)}>Cancel</button>
                                    {editMandatory ? (
                                        <button className="btn btn-primary btn-sm" onClick={() => setEditStep(2)} disabled={!editName.trim()}>
                                            Next: Escalation Settings
                                            <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_forward</span>
                                        </button>
                                    ) : (
                                        <button className="btn btn-primary btn-sm" onClick={handleSaveEdit} disabled={editSaving || !editName.trim()} style={{ opacity: editSaving ? 0.7 : 1 }}>
                                            {editSaving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    )}
                                </div>
                            </>
                        )}

                        {editStep === 2 && (
                            <>
                                {renderRoutingRules(editRouting, setEditRouting)}
                                {renderEscalationLadder(editEscLevels, setEditEscLevels)}

                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 20 }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setEditStep(1)}>
                                        <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_back</span>
                                        Back
                                    </button>
                                    <button className="btn btn-primary btn-sm" onClick={handleSaveEdit} disabled={editSaving || !editName.trim()} style={{ opacity: editSaving ? 0.7 : 1 }}>
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
                        <button className="btn btn-primary btn-sm" onClick={() => { if (showAddForm) resetAddForm(); else setShowAddForm(true); }}>
                            <span className="material-icons-round" style={{ fontSize: 14 }}>{showAddForm ? 'close' : 'add'}</span>
                            {showAddForm ? 'Cancel' : 'Add Role'}
                        </button>
                    }
                />

                <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>

                    {/* Add Role Multi-Step Form */}
                    {showAddForm && (
                        <div className="fade-in card" style={{ marginBottom: 18, padding: '22px 24px' }}>
                            <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Create New Role</h4>

                            {renderStepIndicator(addStep, newRoleMandatory)}

                            {addStep === 1 && (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                                        <div>
                                            <label className="label">Role Name</label>
                                            <input className="input" placeholder="e.g. ED On-Call" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} style={{ fontSize: 13 }} />
                                        </div>
                                        <div>
                                            <label className="label">Department</label>
                                            <select className="input" value={newRoleDept} onChange={e => setNewRoleDept(e.target.value)} style={{ fontSize: 13 }}>
                                                <option value="">-- Select --</option>
                                                {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: newRoleMandatory ? 'rgba(239,68,68,0.06)' : 'var(--surface-2)', border: `1px solid ${newRoleMandatory ? 'rgba(239,68,68,0.25)' : 'var(--border-subtle)'}`, marginBottom: 18, transition: 'all 0.2s' }}>
                                        <input type="checkbox" className="checkbox" checked={newRoleMandatory} onChange={() => setNewRoleMandatory(!newRoleMandatory)} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>This role must always be filled</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Marking as mandatory sets priority to Critical.</div>
                                        </div>
                                        <span className={`badge ${newRoleMandatory ? 'badge-critical' : 'badge-neutral'}`} style={{ fontSize: 10, flexShrink: 0 }}>
                                            {newRoleMandatory ? 'Critical' : 'Standard'}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        {newRoleMandatory ? (
                                            <button className="btn btn-primary btn-sm" onClick={() => setAddStep(2)} disabled={!newRoleName.trim()}>
                                                Next: Escalation Settings
                                                <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_forward</span>
                                            </button>
                                        ) : (
                                            <button className="btn btn-primary btn-sm" onClick={handleAddRole} disabled={!newRoleName.trim()}>
                                                <span className="material-icons-round" style={{ fontSize: 14 }}>check</span>
                                                Create Role
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}

                            {addStep === 2 && (
                                <>
                                    {renderRoutingRules(newRouting, setNewRouting)}
                                    {renderEscalationLadder(newEscLevels, setNewEscLevels)}

                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 20 }}>
                                        <button className="btn btn-secondary btn-sm" onClick={() => setAddStep(1)}>
                                            <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_back</span>
                                            Back
                                        </button>
                                        <button className="btn btn-primary btn-sm" onClick={handleAddRole} disabled={!newRoleName.trim()}>
                                            <span className="material-icons-round" style={{ fontSize: 14 }}>check</span>
                                            Create Role
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: selectedRole ? '1fr 340px' : '1fr', gap: 20 }}>
                        {/* Roles Table */}
                        <div className="fade-in delay-1 card" style={{ padding: 0, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role Name</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Department</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Priority</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mandatory</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Escalation</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRoles.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                                                {search ? 'No roles match your search.' : 'No roles configured yet. Click "Add Role" to get started.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRoles.map(role => {
                                            const activeRules = (role.escalation_routing || []).filter(r => r.enabled).length;
                                            const totalRules = (role.escalation_routing || []).length;
                                            return (
                                                <tr key={role.id} onClick={() => setSelectedId(role.id)} style={{ cursor: 'pointer', background: selectedId === role.id ? '#edf1f7' : undefined }}>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{role.name}</div>
                                                            {!role.enabled && <span className="badge badge-neutral" style={{ fontSize: 9 }}>Disabled</span>}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <span style={{ fontSize: 13, color: role.department ? 'var(--text-secondary)' : 'var(--text-disabled)' }}>
                                                            {role.department || 'Unassigned'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <span className={`badge ${role.priority === 'Critical' ? 'badge-critical' : role.priority === 'High' ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: 10 }}>
                                                            {role.priority || 'Standard'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                        <input
                                                            type="checkbox"
                                                            className="checkbox"
                                                            checked={role.mandatory}
                                                            onChange={e => { e.stopPropagation(); handleToggleMandatory(role); }}
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                        {role.priority === 'Critical' ? (
                                                            <span className="badge badge-info" style={{ fontSize: 10 }}>
                                                                {activeRules}/{totalRules} rules
                                                            </span>
                                                        ) : (
                                                            <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>N/A</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
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
                            {filteredRoles.length > 0 && (
                                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)' }}>
                                    Showing {filteredRoles.length} of {roles.length} roles
                                </div>
                            )}
                        </div>

                        {/* Detail Panel */}
                        {selectedRole && (
                            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {/* Role Header */}
                                <div className="card" style={{ padding: '18px 20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                                        <div>
                                            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{selectedRole.name}</h3>
                                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{selectedRole.department || 'No department'}</p>
                                        </div>
                                        <button className="btn btn-primary btn-xs" onClick={() => openEditModal(selectedRole)}>
                                            <span className="material-icons-round" style={{ fontSize: 13 }}>edit</span>Edit
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        <span className={`badge ${selectedRole.priority === 'Critical' ? 'badge-critical' : selectedRole.priority === 'High' ? 'badge-warning' : 'badge-neutral'}`}>{selectedRole.priority || 'Standard'}</span>
                                        <span className={`badge ${selectedRole.enabled ? 'badge-success' : 'badge-neutral'}`}>{selectedRole.enabled ? 'Active' : 'Disabled'}</span>
                                        {selectedRole.mandatory && <span className="badge badge-info">Mandatory</span>}
                                        {selectedRole.visible_in_directory && <span className="badge badge-neutral">In Directory</span>}
                                    </div>
                                </div>

                                {/* Configuration Summary */}
                                <div className="card" style={{ padding: '16px 20px' }}>
                                    <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Configuration</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {[
                                            { label: 'Priority', value: selectedRole.priority || 'Standard', icon: 'flag' },
                                            { label: 'Directory', value: selectedRole.visible_in_directory ? 'Visible' : 'Hidden', icon: selectedRole.visible_in_directory ? 'visibility' : 'visibility_off' },
                                            { label: 'Status', value: selectedRole.enabled ? 'Active' : 'Disabled', icon: selectedRole.enabled ? 'check_circle' : 'cancel' },
                                            { label: 'Mandatory', value: selectedRole.mandatory ? 'Required' : 'Optional', icon: selectedRole.mandatory ? 'verified' : 'remove_circle_outline' },
                                        ].map(row => (
                                            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--text-muted)', width: 20 }}>{row.icon}</span>
                                                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 80 }}>{row.label}</span>
                                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{row.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Escalation Summary */}
                                {selectedRole.priority === 'Critical' ? (
                                    <div className="card" style={{ padding: '16px 20px' }}>
                                        <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Escalation Settings</h4>

                                        {/* Routing Rules */}
                                        <div style={{ marginBottom: 14 }}>
                                            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Routing Rules</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                {(selectedRole.escalation_routing || defaultRoutingRules).map(rule => (
                                                    <span key={rule.id} className={`badge ${rule.enabled ? 'badge-info' : 'badge-neutral'}`} style={{ fontSize: 10 }}>
                                                        {rule.label}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Escalation Ladder */}
                                        <div>
                                            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Escalation Ladder</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {(selectedRole.escalation_levels || defaultEscalationLevels).map(lvl => (
                                                    <div key={lvl.level} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: 'var(--helix-primary)', color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{lvl.level}</span>
                                                        <span style={{ fontSize: 12, fontWeight: 600, flex: 1, color: 'var(--text-primary)' }}>{lvl.target}</span>
                                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{lvl.delay}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="card" style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: 'var(--surface-2)', border: '1px dashed var(--border-subtle)', boxShadow: 'none' }}>
                                        <span className="material-icons-round" style={{ fontSize: 28, color: 'var(--text-disabled)', marginBottom: 10 }}>notifications_off</span>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Escalation Disabled</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, maxWidth: 200, lineHeight: 1.4 }}>Only critical roles can have escalation messages.</div>
                                    </div>
                                )}

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
        </div>
    );
}
