'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

type Role = {
    id: string;
    name: string;
    dept: string;
    priority: string;
    type: 'duty-signin' | 'role-pool';
    routing: 'current-holder' | 'all-members';
    alertMode: string;
    enabled: boolean;
    visibleInDirectory: boolean;
    assigned: string[];
    perms: { label: string; enabled: boolean }[];
    color: string;
};

const defaultPerms = [
    { label: 'View Patient Records', enabled: true },
    { label: 'Edit Care Plans', enabled: true },
    { label: 'Administer Medication', enabled: false },
    { label: 'Discharge Patients', enabled: false },
    { label: 'Access Lab Results', enabled: true },
    { label: 'View Billing Info', enabled: false },
];

const initialRoles: Role[] = [
    { id: 'r1', name: 'Trauma Surgeon', dept: 'Emergency Medicine', priority: 'Critical', type: 'duty-signin', routing: 'current-holder', alertMode: 'direct', enabled: true, visibleInDirectory: true, assigned: ['44210'], perms: [...defaultPerms], color: '#8c5a5e' },
    { id: 'r2', name: 'ICU Charge Nurse', dept: 'ICU', priority: 'Critical', type: 'duty-signin', routing: 'current-holder', alertMode: 'direct', enabled: true, visibleInDirectory: true, assigned: ['44210', '84920'], perms: [...defaultPerms], color: '#4a6fa5' },
    { id: 'r3', name: 'On-Call Cardiologist', dept: 'Cardiology', priority: 'High', type: 'role-pool', routing: 'all-members', alertMode: 'round-robin', enabled: true, visibleInDirectory: true, assigned: ['55102', '66301'], perms: [...defaultPerms], color: '#5a7d8c' },
    { id: 'r4', name: 'Pediatrics Resident', dept: 'Pediatrics', priority: 'Standard', type: 'role-pool', routing: 'all-members', alertMode: 'broadcast', enabled: true, visibleInDirectory: false, assigned: ['77402'], perms: [...defaultPerms], color: '#5c8a6e' },
    { id: 'r5', name: 'Radiology Tech Lead', dept: 'Radiology', priority: 'Standard', type: 'duty-signin', routing: 'current-holder', alertMode: 'direct', enabled: false, visibleInDirectory: false, assigned: ['88503'], perms: [...defaultPerms], color: '#8a7d5c' },
];

const eligibleStaff = [
    { id: '84920', name: 'Dr. Ama Mensah', title: 'Senior Resident', dept: 'Cardiology', avatar: 'AM', color: '#4a6fa5' },
    { id: '44210', name: 'Nurse Kofi Boateng', title: 'Lead Nurse', dept: 'ICU', avatar: 'KB', color: '#5a7d8c' },
    { id: '11293', name: 'Dr. Kwame Asante', title: 'Attending', dept: 'Internal Med', avatar: 'KA', color: '#5c8a6e' },
    { id: '99201', name: 'Dr. Efua Adjei', title: 'Fellow', dept: 'Endocrinology', avatar: 'EA', color: '#8a7d5c' },
    { id: '55102', name: 'Dr. Akosua Frimpong', title: 'Cardiologist', dept: 'Cardiology', avatar: 'AF', color: '#4a6fa5' },
    { id: '66301', name: 'Yaw Darko', title: 'Cardiac Nurse', dept: 'Cardiology', avatar: 'YD', color: '#5a7d8c' },
    { id: '77402', name: 'Dr. Kwesi Owusu', title: 'Pediatrician', dept: 'Pediatrics', avatar: 'KO', color: '#5c8a6e' },
    { id: '88503', name: 'Adwoa Tetteh', title: 'Technician', dept: 'Radiology', avatar: 'AT', color: '#8a7d5c' },
];

const alertModes = [
    { id: 'direct', label: 'Direct Alert', desc: 'Immediate alert to assigned device.', icon: 'notifications_active' },
    { id: 'round-robin', label: 'Round Robin', desc: 'Cycles through available staff in pool.', icon: 'loop' },
    { id: 'broadcast', label: 'Broadcast', desc: 'Alerts all active staff simultaneously.', icon: 'campaign' },
];

const roleColors = ['#4a6fa5', '#5a7d8c', '#5c8a6e', '#8a7d5c', '#8c5a5e', '#6b7a8c', '#7a6b8c'];

export default function RolesBuilderAssignment() {
    const [roles, setRoles] = useState<Role[]>(initialRoles);
    const [selectedId, setSelectedId] = useState('r1');
    const [toast, setToast] = useState<string | null>(null);
    const [staffSearch, setStaffSearch] = useState('');
    const [roleSearch, setRoleSearch] = useState('');
    const [showNewForm, setShowNewForm] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const selected = roles.find(r => r.id === selectedId) || roles[0];

    const updateRole = (updates: Partial<Role>) => {
        setRoles(prev => prev.map(r => r.id === selectedId ? { ...r, ...updates } : r));
    };

    const toggleAssign = (staffId: string) => {
        updateRole({ assigned: selected.assigned.includes(staffId) ? selected.assigned.filter(x => x !== staffId) : [...selected.assigned, staffId] });
    };

    const togglePerm = (idx: number) => {
        const updated = [...selected.perms];
        updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled };
        updateRole({ perms: updated });
    };

    const handleCreateRole = () => {
        if (!newRoleName.trim()) return;
        const newRole: Role = {
            id: `r-${Date.now()}`,
            name: newRoleName,
            dept: 'Emergency Medicine',
            priority: 'Standard',
            type: 'duty-signin',
            routing: 'current-holder',
            alertMode: 'direct',
            enabled: true,
            visibleInDirectory: true,
            assigned: [],
            perms: defaultPerms.map(p => ({ ...p })),
            color: roleColors[roles.length % roleColors.length],
        };
        setRoles(prev => [...prev, newRole]);
        setSelectedId(newRole.id);
        setNewRoleName('');
        setShowNewForm(false);
        showToast(`Role "${newRoleName}" created`);
    };

    const handleDeleteRole = () => {
        const remaining = roles.filter(r => r.id !== selectedId);
        if (remaining.length === 0) return;
        setRoles(remaining);
        setSelectedId(remaining[0].id);
        showToast(`Role "${selected.name}" deleted`);
    };

    const filteredRoles = roles.filter(r => r.name.toLowerCase().includes(roleSearch.toLowerCase()));
    const filteredStaff = eligibleStaff.filter(s =>
        s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
        s.dept.toLowerCase().includes(staffSearch.toLowerCase())
    );

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <Sidebar hospitalName="Korle Bu" sections={navSections} footer={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="avatar" style={{ background: 'rgba(30,58,95,0.12)', color: 'var(--helix-primary-light)' }}>KA</div>
                    <div><div style={{ fontSize: 13, fontWeight: 600 }}>Kwame Asante</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>System Admin</div></div>
                </div>
            } />

            {/* Toast */}
            {toast && (
                <div className="toast-enter" style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '10px 18px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 8, }}>
                    <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--success)' }}>check_circle</span>
                    {toast}
                </div>
            )}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <TopBar
                    title="Roles Builder"
                    breadcrumbs={['Configuration', 'Roles']}
                    search={{ placeholder: 'Search roles or staff...', value: roleSearch, onChange: setRoleSearch }}
                    actions={
                        <button className="btn btn-primary btn-sm" onClick={() => setShowNewForm(!showNewForm)}>
                            <span className="material-icons-round" style={{ fontSize: 14 }}>{showNewForm ? 'close' : 'add'}</span>
                            {showNewForm ? 'Cancel' : 'New Role'}
                        </button>
                    }
                />
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Role List Sidebar */}
            <div style={{ width: 280, background: 'var(--bg-800)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {showNewForm && (
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}>
                        <input className="input" placeholder="Role name *" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateRole()} style={{ fontSize: 12, marginBottom: 8 }} />
                        <button className="btn btn-primary btn-xs" style={{ width: '100%', justifyContent: 'center' }} onClick={handleCreateRole} disabled={!newRoleName.trim()}>
                            <span className="material-icons-round" style={{ fontSize: 14 }}>add</span>Create Role
                        </button>
                    </div>
                )}

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {filteredRoles.map(r => (
                        <div
                            key={r.id}
                            onClick={() => setSelectedId(r.id)}
                            style={{
                                padding: '12px 16px', cursor: 'pointer',
                                background: selectedId === r.id ? '#edf1f7' : 'transparent',
                                borderBottom: '1px solid var(--border-subtle)',
                                borderLeft: selectedId === r.id ? '3px solid var(--helix-primary)' : '3px solid transparent',
                                transition: 'all 0.15s', opacity: r.enabled ? 1 : 0.5,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${r.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span className="material-icons-round" style={{ fontSize: 16, color: r.color }}>{r.type === 'duty-signin' ? 'login' : 'groups'}</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{r.dept} · {r.assigned.length} staff</div>
                                </div>
                                {!r.enabled && <span className="badge badge-neutral" style={{ fontSize: 9 }}>Disabled</span>}
                            </div>
                        </div>
                    ))}
                    <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)' }}>{filteredRoles.length} of {roles.length} roles</div>
                </div>
            </div>

            {/* Main Editor */}
            <main style={{ flex: 1, overflow: 'auto', padding: '20px 20px', background: 'var(--bg-900)' }}>
                <div className="fade-in" key={selected.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <h1 style={{ fontSize: '1.4rem' }}>{selected.name}</h1>
                                {!selected.enabled && <span className="badge badge-neutral">Disabled</span>}
                                {selected.visibleInDirectory && <span className="badge badge-success" style={{ fontSize: 10 }}>In Directory</span>}
                            </div>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{selected.dept} · {selected.priority} Priority · {selected.type === 'duty-signin' ? 'Duty Sign-In' : 'Role Pool'}</p>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => { updateRole({ enabled: !selected.enabled }); showToast(selected.enabled ? `"${selected.name}" disabled` : `"${selected.name}" enabled`); }}>
                                <span className="material-icons-round" style={{ fontSize: 14 }}>{selected.enabled ? 'toggle_off' : 'toggle_on'}</span>
                                {selected.enabled ? 'Disable' : 'Enable'}
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={handleDeleteRole}>
                                <span className="material-icons-round" style={{ fontSize: 14 }}>delete</span>Delete
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => showToast(`Role "${selected.name}" saved with ${selected.assigned.length} staff assigned`)}>
                                <span className="material-icons-round" style={{ fontSize: 14 }}>save</span>Save Role
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                        {/* Left Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            {/* Role Details */}
                            <div className="fade-in delay-1 card">
                                <h3 style={{ marginBottom: 14 }}>Role Details</h3>
                                <div style={{ marginBottom: 12 }}>
                                    <label className="label">Role Name</label>
                                    <input className="input" value={selected.name} onChange={e => updateRole({ name: e.target.value })} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    <div>
                                        <label className="label">Department</label>
                                        <select className="input" value={selected.dept} onChange={e => updateRole({ dept: e.target.value })}>
                                            {['Emergency Medicine', 'Trauma Center', 'ICU', 'Cardiology', 'Pediatrics', 'Radiology', 'Internal Med', 'Surgery'].map(d => <option key={d}>{d}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label">Priority Level</label>
                                        <select className="input" value={selected.priority} onChange={e => updateRole({ priority: e.target.value })}>
                                            {['Critical', 'High', 'Standard'].map(p => <option key={p}>{p}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Role Type & Routing */}
                            <div className="fade-in delay-2 card">
                                <h3 style={{ marginBottom: 14 }}>Role Type & Message Routing</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                                    {[
                                        { id: 'duty-signin' as const, label: 'Duty Sign-In Role', desc: 'Staff must sign in/out of this role. Only one holder at a time.', icon: 'login' },
                                        { id: 'role-pool' as const, label: 'Role Pool', desc: 'Multiple staff can be assigned. Messages go to available members.', icon: 'groups' },
                                    ].map(t => (
                                        <label key={t.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                                            borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.15s',
                                            border: `1px solid ${selected.type === t.id ? 'var(--helix-primary)' : 'var(--border-subtle)'}`,
                                            background: selected.type === t.id ? '#edf1f7' : 'var(--surface-2)',
                                        }}>
                                            <input type="radio" name="roleType" checked={selected.type === t.id} onChange={() => updateRole({ type: t.id })} style={{ accentColor: 'var(--helix-primary)' }} />
                                            <span className="material-icons-round" style={{ color: selected.type === t.id ? 'var(--helix-primary-light)' : 'var(--text-muted)', fontSize: 18 }}>{t.icon}</span>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{t.label}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.desc}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                <label className="label">Message Routing</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {[
                                        { id: 'current-holder' as const, label: 'Current Duty Holder Only', desc: 'Messages sent only to whoever is currently signed into this role.', icon: 'person' },
                                        { id: 'all-members' as const, label: 'All Role Members', desc: 'Messages sent to all staff assigned to this role.', icon: 'group' },
                                    ].map(rt => (
                                        <label key={rt.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                                            borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.15s',
                                            border: `1px solid ${selected.routing === rt.id ? 'var(--helix-accent)' : 'var(--border-subtle)'}`,
                                            background: selected.routing === rt.id ? '#edf1f7' : 'var(--surface-2)',
                                        }}>
                                            <input type="radio" name="routing" checked={selected.routing === rt.id} onChange={() => updateRole({ routing: rt.id })} style={{ accentColor: 'var(--helix-accent)' }} />
                                            <span className="material-icons-round" style={{ color: selected.routing === rt.id ? 'var(--helix-accent)' : 'var(--text-muted)', fontSize: 18 }}>{rt.icon}</span>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{rt.label}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rt.desc}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Alert Mode */}
                            <div className="fade-in delay-3 card">
                                <h3 style={{ marginBottom: 14 }}>Alert Mode</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {alertModes.map(m => (
                                        <label key={m.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                                            borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.15s',
                                            border: `1px solid ${selected.alertMode === m.id ? 'var(--helix-primary)' : 'var(--border-subtle)'}`,
                                            background: selected.alertMode === m.id ? '#edf1f7' : 'var(--surface-2)',
                                        }}>
                                            <input type="radio" name="alertMode" checked={selected.alertMode === m.id} onChange={() => updateRole({ alertMode: m.id })} style={{ accentColor: 'var(--helix-primary)' }} />
                                            <span className="material-icons-round" style={{ color: selected.alertMode === m.id ? 'var(--helix-primary-light)' : 'var(--text-muted)', fontSize: 18 }}>{m.icon}</span>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{m.label}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.desc}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Directory Visibility + Permissions */}
                            <div className="fade-in delay-4 card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                    <h3>Directory & Permissions</h3>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', marginBottom: 14 }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>Show in Staff Directory</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Make this role visible and searchable in the directory.</div>
                                    </div>
                                    <label className="toggle">
                                        <input type="checkbox" checked={selected.visibleInDirectory} onChange={() => { updateRole({ visibleInDirectory: !selected.visibleInDirectory }); showToast(selected.visibleInDirectory ? 'Hidden from directory' : 'Visible in directory'); }} />
                                        <span className="toggle-slider" />
                                    </label>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {selected.perms.map((p, i) => (
                                        <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.label}</span>
                                            <label className="toggle">
                                                <input type="checkbox" checked={p.enabled} onChange={() => togglePerm(i)} />
                                                <span className="toggle-slider" />
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right: Staff Assignment */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            <div className="fade-in delay-2 card" style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                    <h3>Staff Assignment</h3>
                                    <span className="badge badge-info">{eligibleStaff.length} Available</span>
                                </div>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>Assign eligible employees to this role.</p>

                                <input className="input" placeholder="Search staff..." value={staffSearch} onChange={e => setStaffSearch(e.target.value)} style={{ marginBottom: 14, fontSize: 13 }} />

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {filteredStaff.map(s => {
                                        const isAssigned = selected.assigned.includes(s.id);
                                        return (
                                            <div key={s.id} style={{
                                                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px',
                                                borderRadius: 'var(--radius-md)', background: 'var(--surface-2)',
                                                border: `1px solid ${isAssigned ? 'var(--helix-primary)' : 'var(--border-subtle)'}`,
                                                transition: 'all 0.15s',
                                            }}>
                                                <div className="avatar" style={{ background: `${s.color}20`, color: s.color, fontSize: 12, width: 36, height: 36 }}>{s.avatar}</div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {s.id} · {s.title} · {s.dept}</div>
                                                </div>
                                                <button
                                                    className={`btn btn-sm ${isAssigned ? 'btn-secondary' : 'btn-primary'}`}
                                                    onClick={() => toggleAssign(s.id)}
                                                >
                                                    {isAssigned ? 'Unassign' : 'Assign'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--info-bg)', border: '1px solid rgba(30,58,95,0.12)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--helix-primary-light)' }}>info</span>
                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                        <strong style={{ color: 'var(--text-primary)' }}>{selected.assigned.length} staff member{selected.assigned.length !== 1 ? 's' : ''}</strong> currently linked to this role.
                                    </span>
                                </div>
                            </div>

                            {/* Role Summary Card */}
                            <div className="fade-in delay-3 card" style={{ padding: '14px 18px' }}>
                                <h3 style={{ marginBottom: 12 }}>Role Summary</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {[
                                        { label: 'Type', value: selected.type === 'duty-signin' ? 'Duty Sign-In' : 'Role Pool', icon: selected.type === 'duty-signin' ? 'login' : 'groups' },
                                        { label: 'Routing', value: selected.routing === 'current-holder' ? 'Current Holder' : 'All Members', icon: selected.routing === 'current-holder' ? 'person' : 'group' },
                                        { label: 'Alert', value: alertModes.find(m => m.id === selected.alertMode)?.label || '', icon: alertModes.find(m => m.id === selected.alertMode)?.icon || 'notifications' },
                                        { label: 'Directory', value: selected.visibleInDirectory ? 'Visible' : 'Hidden', icon: selected.visibleInDirectory ? 'visibility' : 'visibility_off' },
                                        { label: 'Status', value: selected.enabled ? 'Active' : 'Disabled', icon: selected.enabled ? 'check_circle' : 'cancel' },
                                    ].map(row => (
                                        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--text-muted)' }}>{row.icon}</span>
                                            <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 70 }}>{row.label}</span>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{row.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
                </div>
            </div>
        </div>
    );
}
