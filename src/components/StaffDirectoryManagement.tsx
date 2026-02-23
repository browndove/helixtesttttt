'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

type StaffMember = { id: number; name: string; email: string; role: string; dept: string; status: string; access: string; avatar: string; color: string };

const initialStaff: StaffMember[] = [
    { id: 1, name: 'Dr. Ama Mensah', email: 'a.mensah@kbth.gov.gh', role: 'Senior Resident', dept: 'Cardiology', status: 'active', access: 'Administrator', avatar: 'AM', color: '#4a6fa5' },
    { id: 2, name: 'Dr. Kwame Asante', email: 'k.asante@kbth.gov.gh', role: 'Attending Physician', dept: 'Internal Med', status: 'active', access: 'Supervisor', avatar: 'KA', color: '#5a7d8c' },
    { id: 3, name: 'Abena Osei', email: 'a.osei@kbth.gov.gh', role: 'Head Nurse', dept: 'ICU', status: 'active', access: 'Staff', avatar: 'AO', color: '#5c8a6e' },
    { id: 4, name: 'Kofi Boateng', email: 'k.boateng@kbth.gov.gh', role: 'Resident', dept: 'Pediatrics', status: 'on-leave', access: 'Staff', avatar: 'KB', color: '#8a7d5c' },
    { id: 5, name: 'Dr. Efua Adjei', email: 'e.adjei@kbth.gov.gh', role: 'Cardiologist', dept: 'Cardiology', status: 'active', access: 'Supervisor', avatar: 'EA', color: '#4a6fa5' },
    { id: 6, name: 'Yaw Darko', email: 'y.darko@kbth.gov.gh', role: 'Lead Nurse', dept: 'Emergency', status: 'active', access: 'Staff', avatar: 'YD', color: '#5a7d8c' },
    { id: 7, name: 'Dr. Akosua Frimpong', email: 'a.frimpong@kbth.gov.gh', role: 'Intensivist', dept: 'ICU', status: 'active', access: 'Supervisor', avatar: 'AF', color: '#5c8a6e' },
    { id: 8, name: 'Adwoa Tetteh', email: 'a.tetteh@kbth.gov.gh', role: 'Technician', dept: 'Radiology', status: 'active', access: 'Staff', avatar: 'AT', color: '#8a7d5c' },
    { id: 9, name: 'Dr. Kwesi Owusu', email: 'k.owusu@kbth.gov.gh', role: 'Pediatrician', dept: 'Pediatrics', status: 'active', access: 'Supervisor', avatar: 'KO', color: '#4a6fa5' },
    { id: 10, name: 'Esi Appiah', email: 'e.appiah@kbth.gov.gh', role: 'Pediatric Nurse', dept: 'Pediatrics', status: 'active', access: 'Staff', avatar: 'EA', color: '#5a7d8c' },
    { id: 11, name: 'Nana Agyemang', email: 'n.agyemang@kbth.gov.gh', role: 'Paramedic', dept: 'Emergency', status: 'on-leave', access: 'Staff', avatar: 'NA', color: '#5c8a6e' },
    { id: 12, name: 'Dr. Yaa Amoako', email: 'y.amoako@kbth.gov.gh', role: 'Surgeon', dept: 'Surgery', status: 'active', access: 'Administrator', avatar: 'YA', color: '#8a7d5c' },
];

const accessLevels = [
    { id: 'admin', label: 'Administrator', desc: 'Full system access including user management.' },
    { id: 'supervisor', label: 'Supervisor', desc: 'Can manage schedules and unit staff.' },
    { id: 'staff', label: 'Staff', desc: 'View-only access for schedules and patients.' },
];

const statusColors: Record<string, { color: string; bg: string; label: string }> = {
    active: { color: 'var(--success)', bg: 'var(--success-bg)', label: 'Active' },
    'on-leave': { color: 'var(--warning)', bg: 'var(--warning-bg)', label: 'On Leave' },
};

const colors = ['#4a6fa5', '#5a7d8c', '#5c8a6e', '#8a7d5c'];

export default function StaffDirectoryManagement() {
    const [staff, setStaff] = useState(initialStaff);
    const [selected, setSelected] = useState(staff[1]);
    const [search, setSearch] = useState('');
    const [accessLevel, setAccessLevel] = useState('supervisor');
    const [toast, setToast] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState('');
    const [newDept, setNewDept] = useState('Cardiology');
    const [dirty, setDirty] = useState(false);
    const [deptFilter, setDeptFilter] = useState('all');

    useEffect(() => { setAccessLevel(selected.access === 'Administrator' ? 'admin' : selected.access === 'Supervisor' ? 'supervisor' : 'staff'); }, [selected]);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const departments = ['all', ...Array.from(new Set(staff.map(s => s.dept)))];

    const filtered = staff.filter(s => {
        const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.dept.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
        const matchDept = deptFilter === 'all' || s.dept === deptFilter;
        return matchSearch && matchDept;
    });

    const handleSave = () => {
        const accessMap: Record<string, string> = { admin: 'Administrator', supervisor: 'Supervisor', staff: 'Staff' };
        setStaff(prev => prev.map(s => s.id === selected.id ? { ...s, access: accessMap[accessLevel] } : s));
        setSelected(prev => ({ ...prev, access: accessMap[accessLevel] }));
        setDirty(false);
        showToast('Profile saved successfully');
    };

    const handleAdd = () => {
        if (!newName.trim() || !newEmail.trim()) return;
        const avatar = newName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        const newMember: StaffMember = {
            id: Date.now(), name: newName, email: newEmail, role: newRole || 'Staff', dept: newDept,
            status: 'active', access: 'Staff', avatar, color: colors[staff.length % colors.length],
        };
        setStaff(prev => [newMember, ...prev]);
        setSelected(newMember);
        setShowAddForm(false);
        setNewName(''); setNewEmail(''); setNewRole('');
        showToast(`${newName} added to staff`);
    };

    const handleDelete = () => {
        const remaining = staff.filter(s => s.id !== selected.id);
        if (remaining.length === 0) return;
        setStaff(remaining);
        setSelected(remaining[0]);
        showToast('Staff member removed');
    };

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <Sidebar sections={navSections} footer={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="avatar" style={{ background: '#1c1f35', color: 'var(--helix-primary-light)', border: '1px solid var(--border-default)' }}>AU</div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Admin User</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Hospital Admin</div>
                    </div>
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
                    title="Staff Management"
                    breadcrumbs={['Dashboard', 'Staff Directory']}
                    search={{ placeholder: 'Search by name, ID, or email...', value: search, onChange: setSearch }}
                    actions={
                        <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
                            <span className="material-icons-round" style={{ fontSize: 14 }}>add</span>
                            {showAddForm ? 'Cancel' : 'Add Staff Member'}
                        </button>
                    }
                />
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Staff List Panel */}
            <div style={{ width: 300, background: 'var(--bg-800)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {departments.map(d => (
                            <button key={d} className="btn btn-secondary btn-xs" onClick={() => setDeptFilter(d)}
                                style={{ background: deptFilter === d ? '#edf1f7' : undefined, borderColor: deptFilter === d ? 'var(--helix-primary)' : undefined, color: deptFilter === d ? 'var(--helix-primary)' : undefined, fontSize: 10, padding: '2px 7px' }}>
                                {d === 'all' ? 'All' : d}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Add Form */}
                {showAddForm && (
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>New Staff Member</div>
                        <input className="input" placeholder="Full name *" value={newName} onChange={e => setNewName(e.target.value)} style={{ fontSize: 12, marginBottom: 6 }} />
                        <input className="input" placeholder="Email *" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={{ fontSize: 12, marginBottom: 6 }} />
                        <input className="input" placeholder="Job title" value={newRole} onChange={e => setNewRole(e.target.value)} style={{ fontSize: 12, marginBottom: 6 }} />
                        <select className="input" value={newDept} onChange={e => setNewDept(e.target.value)} style={{ fontSize: 12, marginBottom: 8 }}>
                            {['Cardiology', 'ICU', 'Emergency', 'Pediatrics', 'Internal Med', 'Radiology', 'Surgery'].map(d => <option key={d}>{d}</option>)}
                        </select>
                        <button className="btn btn-primary btn-xs" style={{ width: '100%', justifyContent: 'center' }} onClick={handleAdd} disabled={!newName.trim() || !newEmail.trim()}>
                            <span className="material-icons-round" style={{ fontSize: 14 }}>person_add</span>Add Staff
                        </button>
                    </div>
                )}

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {filtered.map(s => {
                        const st = statusColors[s.status] || statusColors.active;
                        return (
                            <div key={s.id} onClick={() => setSelected(s)} style={{
                                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer',
                                background: selected.id === s.id ? '#edf1f7' : 'transparent',
                                borderBottom: '1px solid var(--border-subtle)',
                                borderLeft: selected.id === s.id ? '3px solid var(--helix-primary)' : '3px solid transparent',
                                transition: 'all 0.15s',
                            }}>
                                <div className="avatar" style={{ background: `${s.color}22`, color: s.color, fontSize: 12, width: 36, height: 36 }}>{s.avatar}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.color, flexShrink: 0 }} />
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.role} · {s.dept}</div>
                                </div>
                            </div>
                        );
                    })}
                    <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)' }}>Showing {filtered.length} of {staff.length} staff</div>
                </div>
            </div>

            {/* Edit Panel */}
            <main style={{ flex: 1, overflow: 'auto', padding: '20px 20px', background: 'var(--bg-900)' }}>
                <div className="fade-in" key={selected.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                        <div><h2 style={{ fontSize: '1rem' }}>Edit Profile</h2><p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Update staff details</p></div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-danger btn-sm" onClick={handleDelete}>
                                <span className="material-icons-round" style={{ fontSize: 14 }}>delete</span>Remove
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setDirty(false); showToast('Changes discarded'); }}>Cancel</button>
                            <button className="btn btn-primary btn-sm" onClick={handleSave}>
                                <span className="material-icons-round" style={{ fontSize: 14 }}>save</span>Save
                            </button>
                        </div>
                    </div>

                    <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div className="avatar" style={{ width: 52, height: 52, background: `${selected.color}22`, color: selected.color, fontSize: 18 }}>{selected.avatar}</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.name}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{selected.role} · {selected.dept}</div>
                        </div>
                        <span className="badge" style={{ background: statusColors[selected.status]?.bg, color: statusColors[selected.status]?.color }}>
                            {statusColors[selected.status]?.label}
                        </span>
                    </div>

                    {/* 2-column grid for form + access */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
                        <div className="card" style={{ marginBottom: 0 }}>
                            <h3 style={{ marginBottom: 14 }}>Personal Information</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                {[
                                    { label: 'First Name', val: selected.name.split(' ')[0], id: 'fname' },
                                    { label: 'Last Name', val: selected.name.split(' ').slice(-1)[0], id: 'lname' },
                                    { label: 'Email', val: selected.email, id: 'semail' },
                                    { label: 'Department', val: selected.dept, id: 'sdept' },
                                    { label: 'Job Title', val: selected.role, id: 'srole' },
                                    { label: 'Employee ID', val: '#EMP-' + selected.id * 1234, id: 'empid' },
                                ].map(f => (
                                    <div key={f.id}>
                                        <label className="label" htmlFor={f.id}>{f.label}</label>
                                        <input id={f.id} className="input" defaultValue={f.val} onChange={() => setDirty(true)} style={{ fontSize: 13 }} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className="card">
                                <h3 style={{ marginBottom: 14 }}>Access Level</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {accessLevels.map(level => (
                                        <label key={level.id} htmlFor={`access-${level.id}`} style={{
                                            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 13px',
                                            borderRadius: 'var(--radius-md)',
                                            border: `1px solid ${accessLevel === level.id ? 'var(--helix-primary)' : 'var(--border-subtle)'}`,
                                            background: accessLevel === level.id ? '#edf1f7' : 'var(--surface-2)',
                                            cursor: 'pointer', transition: 'all 0.15s',
                                        }}>
                                            <input id={`access-${level.id}`} type="radio" name="access" value={level.id} checked={accessLevel === level.id} onChange={() => { setAccessLevel(level.id); setDirty(true); }} style={{ marginTop: 3, accentColor: 'var(--helix-primary)' }} />
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{level.label}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{level.desc}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="card">
                                <h3 style={{ marginBottom: 14 }}>Quick Actions</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => showToast('Password reset email sent')}>
                                        <span className="material-icons-round" style={{ fontSize: 15 }}>lock_reset</span>Reset Password
                                    </button>
                                    <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => {
                                        const newStatus = selected.status === 'active' ? 'on-leave' : 'active';
                                        setStaff(prev => prev.map(s => s.id === selected.id ? { ...s, status: newStatus } : s));
                                        setSelected(prev => ({ ...prev, status: newStatus }));
                                        showToast(`Status changed to ${newStatus === 'active' ? 'Active' : 'On Leave'}`);
                                    }}>
                                        <span className="material-icons-round" style={{ fontSize: 15 }}>{selected.status === 'active' ? 'toggle_off' : 'toggle_on'}</span>
                                        {selected.status === 'active' ? 'Set On Leave' : 'Set Active'}
                                    </button>
                                    <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => showToast('Audit log exported')}>
                                        <span className="material-icons-round" style={{ fontSize: 15 }}>history</span>View Audit Log
                                    </button>
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
