'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

type Role = {
    id: string;
    name: string;
    department: string;
    mandatory: boolean;
    enabled: boolean;
    priority: string;
    alert_mode: string;
    visible_in_directory: boolean;
};

const alertModes = [
    { id: 'direct', label: 'Direct Alert', desc: 'Immediate alert to assigned device.' },
    { id: 'round-robin', label: 'Round Robin', desc: 'Cycles through available staff in pool.' },
    { id: 'broadcast', label: 'Broadcast', desc: 'Alerts all active staff simultaneously.' },
];

export default function RolesBuilderAssignment() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [toast, setToast] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleDept, setNewRoleDept] = useState('');
    const [newRoleMandatory, setNewRoleMandatory] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Edit modal state
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [editName, setEditName] = useState('');
    const [editDept, setEditDept] = useState('');
    const [editMandatory, setEditMandatory] = useState(false);
    const [editPriority, setEditPriority] = useState('Standard');
    const [editAlertMode, setEditAlertMode] = useState('direct');
    const [editEnabled, setEditEnabled] = useState(true);
    const [editVisible, setEditVisible] = useState(true);
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
            if (rolesRes.ok) setRoles(await rolesRes.json());
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

    const handleAddRole = async () => {
        if (!newRoleName.trim()) return;
        try {
            const res = await fetch('/api/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newRoleName.trim(), department: newRoleDept, mandatory: newRoleMandatory }),
            });
            if (res.ok) {
                const role = await res.json();
                setRoles(prev => [...prev, role]);
                showToast(`"${newRoleName}" added`);
                setNewRoleName('');
                setNewRoleDept('');
                setNewRoleMandatory(false);
                setShowAddForm(false);
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
            const res = await fetch(`/api/roles/${role.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: role.name, department: role.department, mandatory: !role.mandatory }),
            });
            if (res.ok) {
                const updated = await res.json();
                setRoles(prev => prev.map(r => r.id === role.id ? updated : r));
            }
        } catch { showToast('Failed to update role'); }
    };

    const openEditModal = (role: Role) => {
        setEditingRole(role);
        setEditName(role.name);
        setEditDept(role.department);
        setEditMandatory(role.mandatory);
        setEditPriority(role.priority || 'Standard');
        setEditAlertMode(role.alert_mode || 'direct');
        setEditEnabled(role.enabled);
        setEditVisible(role.visible_in_directory ?? true);
    };

    const handleSaveEdit = async () => {
        if (!editingRole || !editName.trim()) return;
        setEditSaving(true);
        try {
            const res = await fetch(`/api/roles/${editingRole.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName.trim(), department: editDept, mandatory: editMandatory, priority: editPriority, alert_mode: editAlertMode, enabled: editEnabled, visible_in_directory: editVisible }),
            });
            if (res.ok) {
                const updated = await res.json();
                setRoles(prev => prev.map(r => r.id === editingRole.id ? updated : r));
                showToast(`"${editName}" updated`);
                setEditingRole(null);
            }
        } catch { showToast('Failed to save changes'); }
        setEditSaving(false);
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
                    <div className="fade-in card" style={{ width: 440, padding: '28px 28px 24px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: 16, marginBottom: 20 }}>Edit Role</h3>

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

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                            <div>
                                <label className="label">Priority Level</label>
                                <select className="input" value={editPriority} onChange={e => setEditPriority(e.target.value)} style={{ fontSize: 13 }}>
                                    {['Critical', 'High', 'Standard'].map(p => <option key={p}>{p}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="label">Alert Mode</label>
                                <select className="input" value={editAlertMode} onChange={e => setEditAlertMode(e.target.value)} style={{ fontSize: 13 }}>
                                    {alertModes.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                <input type="checkbox" className="checkbox" checked={editMandatory} onChange={() => setEditMandatory(!editMandatory)} />
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>This role must always be filled</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Require at least one person assigned and signed in at all times.</div>
                                </div>
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
                            <button className="btn btn-primary btn-sm" onClick={handleSaveEdit} disabled={editSaving || !editName.trim()} style={{ opacity: editSaving ? 0.7 : 1 }}>
                                {editSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
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
                        <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
                            <span className="material-icons-round" style={{ fontSize: 14 }}>{showAddForm ? 'close' : 'add'}</span>
                            {showAddForm ? 'Cancel' : 'Add Role'}
                        </button>
                    }
                />

                <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>

                    {/* Add Role Form */}
                    {showAddForm && (
                        <div className="fade-in card" style={{ marginBottom: 18, padding: '18px 20px' }}>
                            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>New Role</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
                                <div>
                                    <label className="label">Role Name</label>
                                    <input className="input" placeholder="e.g. ED On-Call" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddRole()} style={{ fontSize: 13 }} />
                                </div>
                                <div>
                                    <label className="label">Department</label>
                                    <select className="input" value={newRoleDept} onChange={e => setNewRoleDept(e.target.value)} style={{ fontSize: 13 }}>
                                        <option value="">-- Select --</option>
                                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <button className="btn btn-primary btn-sm" onClick={handleAddRole} disabled={!newRoleName.trim()} style={{ height: 36 }}>Add Role</button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                                <input type="checkbox" className="checkbox" checked={newRoleMandatory} onChange={() => setNewRoleMandatory(!newRoleMandatory)} />
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>This role must always be filled</span>
                            </div>
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
                                        <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
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
                                        filteredRoles.map(role => (
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
                                        ))
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
                                            { label: 'Alert Mode', value: alertModes.find(m => m.id === selectedRole.alert_mode)?.label || 'Direct Alert', icon: 'notifications' },
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

                                {/* Alert Mode Detail */}
                                <div className="card" style={{ padding: '16px 20px' }}>
                                    <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Alert Mode</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {alertModes.map(m => (
                                            <div key={m.id} style={{
                                                padding: '10px 12px', borderRadius: 'var(--radius-md)',
                                                border: `1px solid ${selectedRole.alert_mode === m.id ? 'var(--helix-primary)' : 'var(--border-subtle)'}`,
                                                background: selectedRole.alert_mode === m.id ? '#edf1f7' : 'var(--surface-2)',
                                                opacity: selectedRole.alert_mode === m.id ? 1 : 0.5,
                                            }}>
                                                <div style={{ fontWeight: 600, fontSize: 12 }}>{m.label}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{m.desc}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

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
