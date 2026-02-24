'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

type StaffMember = { id: number; name: string; email: string; role: string; dept: string; status: string; access: string };

const initialStaff: StaffMember[] = [
    { id: 1, name: 'Dr. Ama Mensah', email: 'a.mensah@accramedical.com.gh', role: 'Senior Resident', dept: 'Cardiology', status: 'active', access: 'Administrator' },
    { id: 2, name: 'Dr. Kwame Asante', email: 'k.asante@accramedical.com.gh', role: 'Attending Physician', dept: 'Internal Med', status: 'active', access: 'Supervisor' },
    { id: 3, name: 'Abena Osei', email: 'a.osei@accramedical.com.gh', role: 'Head Nurse', dept: 'ICU', status: 'active', access: 'Staff' },
    { id: 4, name: 'Kofi Boateng', email: 'k.boateng@accramedical.com.gh', role: 'Resident', dept: 'Pediatrics', status: 'disabled', access: 'Staff' },
    { id: 5, name: 'Dr. Efua Adjei', email: 'e.adjei@accramedical.com.gh', role: 'Cardiologist', dept: 'Cardiology', status: 'active', access: 'Supervisor' },
    { id: 6, name: 'Yaw Darko', email: 'y.darko@accramedical.com.gh', role: 'Lead Nurse', dept: 'Emergency', status: 'active', access: 'Staff' },
    { id: 7, name: 'Dr. Akosua Frimpong', email: 'a.frimpong@accramedical.com.gh', role: 'Intensivist', dept: 'ICU', status: 'active', access: 'Supervisor' },
    { id: 8, name: 'Adwoa Tetteh', email: 'a.tetteh@accramedical.com.gh', role: 'Technician', dept: 'Radiology', status: 'active', access: 'Staff' },
    { id: 9, name: 'Dr. Kwesi Owusu', email: 'k.owusu@accramedical.com.gh', role: 'Pediatrician', dept: 'Pediatrics', status: 'active', access: 'Supervisor' },
    { id: 10, name: 'Esi Appiah', email: 'e.appiah@accramedical.com.gh', role: 'Pediatric Nurse', dept: 'Pediatrics', status: 'active', access: 'Staff' },
    { id: 11, name: 'Nana Agyemang', email: 'n.agyemang@accramedical.com.gh', role: 'Paramedic', dept: 'Emergency', status: 'disabled', access: 'Staff' },
    { id: 12, name: 'Dr. Yaa Amoako', email: 'y.amoako@accramedical.com.gh', role: 'Surgeon', dept: 'Surgery', status: 'active', access: 'Administrator' },
];

const statusColors: Record<string, { color: string; bg: string; label: string }> = {
    active: { color: 'var(--success)', bg: 'var(--success-bg)', label: 'Active' },
    disabled: { color: 'var(--critical)', bg: 'var(--critical-bg)', label: 'Disabled' },
};

const accessBadge: Record<string, string> = { Administrator: 'badge-info', Supervisor: 'badge-warning', Staff: 'badge-neutral' };

const importHistory = [
    { id: 'IMP-001', file: 'staff_q4_import.csv', records: 142, status: 'success', warnings: 2, date: 'Nov 12, 2024', user: 'Dr. Kwame Asante' },
    { id: 'IMP-002', file: 'nurses_batch_oct.xlsx', records: 34, status: 'success', warnings: 0, date: 'Oct 28, 2024', user: 'Admin' },
    { id: 'IMP-003', file: 'staff_roles_v2.csv', records: 18, status: 'error', warnings: 0, date: 'Oct 14, 2024', user: 'Admin' },
];

export default function StaffDirectoryManagement() {
    const [staff, setStaff] = useState(initialStaff);
    const [search, setSearch] = useState('');
    const [toast, setToast] = useState<string | null>(null);
    const [deptFilter, setDeptFilter] = useState('all');
    const [selected, setSelected] = useState<StaffMember | null>(null);
    const [activeTab, setActiveTab] = useState<'directory' | 'import'>('directory');
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState('');
    const [newDept, setNewDept] = useState('Cardiology');
    const [dragOver, setDragOver] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<string | null>(null);
    const [bulkHistory, setBulkHistory] = useState(importHistory);
    const [processing, setProcessing] = useState(false);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const departments = ['all', ...Array.from(new Set(staff.map(s => s.dept)))];

    const filtered = staff.filter(s => {
        const matchSearch = search === '' || s.name.toLowerCase().includes(search.toLowerCase()) || s.dept.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
        const matchDept = deptFilter === 'all' || s.dept === deptFilter;
        return matchSearch && matchDept;
    });

    const handleAdd = () => {
        if (!newName.trim() || !newEmail.trim()) return;
        const newMember: StaffMember = { id: Date.now(), name: newName, email: newEmail, role: newRole || 'Staff', dept: newDept, status: 'active', access: 'Staff' };
        setStaff(prev => [newMember, ...prev]);
        setShowAddForm(false);
        setNewName(''); setNewEmail(''); setNewRole('');
        showToast(`${newName} added to staff`);
    };

    const handleRemove = (id: number) => {
        const member = staff.find(s => s.id === id);
        setStaff(prev => prev.filter(s => s.id !== id));
        if (selected?.id === id) setSelected(null);
        showToast(`${member?.name} removed`);
    };

    const toggleStatus = (id: number) => {
        setStaff(prev => prev.map(s => s.id === id ? { ...s, status: s.status === 'active' ? 'disabled' : 'active' } : s));
        const member = staff.find(s => s.id === id);
        showToast(member?.status === 'active' ? `${member?.name} disabled` : `${member?.name} enabled`);
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
                <main style={{ flex: 1, overflow: 'auto', padding: '20px 24px', background: 'var(--bg-900)' }}>

                    {/* Add Staff Form */}
                    {showAddForm && (
                        <div className="fade-in card" style={{ marginBottom: 18, padding: '18px 20px' }}>
                            <h3 style={{ fontSize: 14, marginBottom: 12 }}>New Staff Member</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                                <div><label className="label">Full Name *</label><input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" style={{ fontSize: 12 }} /></div>
                                <div><label className="label">Email *</label><input className="input" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email address" style={{ fontSize: 12 }} /></div>
                                <div><label className="label">Job Title</label><input className="input" value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="e.g. Nurse" style={{ fontSize: 12 }} /></div>
                                <div><label className="label">Department</label><select className="input" value={newDept} onChange={e => setNewDept(e.target.value)} style={{ fontSize: 12 }}>{['Cardiology', 'ICU', 'Emergency', 'Pediatrics', 'Internal Med', 'Radiology', 'Surgery'].map(d => <option key={d}>{d}</option>)}</select></div>
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={!newName.trim() || !newEmail.trim()}>
                                <span className="material-icons-round" style={{ fontSize: 14 }}>person_add</span>Add Staff
                            </button>
                        </div>
                    )}

                    {/* Filters */}
                    <div className="fade-in delay-1" style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
                        {departments.map(d => (
                            <button key={d} className="btn btn-secondary btn-xs" onClick={() => setDeptFilter(d)}
                                style={{ background: deptFilter === d ? '#edf1f7' : undefined, borderColor: deptFilter === d ? 'var(--helix-primary)' : undefined, color: deptFilter === d ? 'var(--helix-primary)' : undefined, fontWeight: deptFilter === d ? 600 : 400 }}>
                                {d === 'all' ? 'All Departments' : d}
                            </button>
                        ))}
                    </div>

                    {/* Table + Detail */}
                    <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 340px' : '1fr', gap: 20 }}>
                        <div className="fade-in delay-2 card" style={{ padding: 0, overflow: 'hidden' }}>
                            <div className="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Role</th>
                                            <th>Department</th>
                                            <th>Access</th>
                                            <th>Status</th>
                                            <th style={{ width: 40 }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(s => {
                                            const st = statusColors[s.status] || statusColors.active;
                                            return (
                                                <tr key={s.id} onClick={() => setSelected(selected?.id === s.id ? null : s)} style={{ cursor: 'pointer', background: selected?.id === s.id ? 'rgba(30,58,95,0.05)' : undefined }}>
                                                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                                                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.email}</td>
                                                    <td style={{ color: 'var(--text-secondary)' }}>{s.role}</td>
                                                    <td style={{ color: 'var(--text-secondary)' }}>{s.dept}</td>
                                                    <td><span className={`badge ${accessBadge[s.access] || 'badge-neutral'}`}>{s.access}</span></td>
                                                    <td><span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                                                    <td>
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
                                Showing {filtered.length} of {staff.length} staff
                            </div>
                        </div>

                        {/* Detail Panel */}
                        {selected && (
                            <div className="slide-in-right" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div className="card" style={{ padding: '18px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                                        <div>
                                            <h3 style={{ fontSize: 15 }}>{selected.name}</h3>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{selected.role} · {selected.dept}</div>
                                        </div>
                                        <button className="btn btn-ghost btn-xs" onClick={() => setSelected(null)}>
                                            <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {[
                                            { label: 'Email', value: selected.email, icon: 'mail' },
                                            { label: 'Department', value: selected.dept, icon: 'domain' },
                                            { label: 'Job Title', value: selected.role, icon: 'badge' },
                                            { label: 'Access Level', value: selected.access, icon: 'admin_panel_settings' },
                                            { label: 'Employee ID', value: `#EMP-${selected.id * 1234}`, icon: 'fingerprint' },
                                        ].map(row => (
                                            <div key={row.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                                <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--text-disabled)', marginTop: 1 }}>{row.icon}</span>
                                                <div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{row.label}</div>
                                                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, marginTop: 1 }}>{row.value}</div>
                                                </div>
                                            </div>
                                        ))}
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
                <main style={{ flex: 1, overflow: 'auto', padding: '20px 24px', background: 'var(--bg-900)' }}>
                    <div className="fade-in" style={{ marginBottom: 20 }}>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 540 }}>Upload a CSV or Excel file to bulk-add staff members. Download a template first to ensure proper formatting.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: 20, marginBottom: 24 }}>
                        <div className="fade-in delay-1 card">
                            <h3 style={{ marginBottom: 14 }}>Upload Staff File</h3>
                            <div
                                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={e => { e.preventDefault(); setDragOver(false); setUploadedFile(e.dataTransfer.files[0]?.name || null); }}
                                onClick={() => setUploadedFile('staff_q4_import.csv')}
                                style={{ border: `2px dashed ${dragOver ? 'var(--helix-primary)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-lg)', padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(30,58,95,0.05)' : 'var(--surface-2)', transition: 'all 0.2s' }}>
                                <div style={{ width: 52, height: 52, background: uploadedFile ? 'var(--success-bg)' : 'rgba(30,58,95,0.1)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                                    <span className="material-icons-round" style={{ fontSize: 26, color: uploadedFile ? 'var(--success)' : 'var(--helix-primary-light)' }}>{uploadedFile ? 'check_circle' : 'cloud_upload'}</span>
                                </div>
                                {uploadedFile ? (
                                    <><div style={{ fontWeight: 600, color: 'var(--success)' }}>{uploadedFile}</div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>File ready for import</div></>
                                ) : (
                                    <><div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Click to upload or drag and drop</div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>CSV, XLSX or XLS (max. 50MB)</div></>
                                )}
                            </div>
                            {uploadedFile && (
                                <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                                    <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={processing} onClick={() => {
                                        setProcessing(true);
                                        setTimeout(() => {
                                            setBulkHistory(prev => [{ id: `IMP-${String(prev.length + 1).padStart(3, '0')}`, file: uploadedFile, records: 4, status: 'success', warnings: 1, date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }), user: 'Admin' }, ...prev]);
                                            setUploadedFile(null); setProcessing(false);
                                            showToast('Import completed: 4 records processed');
                                        }, 1200);
                                    }}>
                                        <span className="material-icons-round" style={{ fontSize: 16 }}>{processing ? 'hourglass_empty' : 'upload'}</span>{processing ? 'Processing...' : 'Process Import'}
                                    </button>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setUploadedFile(null)}><span className="material-icons-round" style={{ fontSize: 16 }}>close</span></button>
                                </div>
                            )}
                        </div>

                        <div className="fade-in delay-2 card">
                            <h3 style={{ marginBottom: 14 }}>Download Template</h3>
                            {[
                                { icon: 'badge', label: 'Staff Template', desc: 'Name, Role, Dept, Email, Shift', color: '#4a6fa5' },
                                { icon: 'calendar_month', label: 'Schedule Template', desc: 'Shifts, assignments, rotations', color: '#5c8a6e' },
                            ].map(t => (
                                <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: 8, cursor: 'pointer', background: 'var(--surface-2)' }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 9, background: `${t.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span className="material-icons-round" style={{ fontSize: 18, color: t.color }}>{t.icon}</span>
                                    </div>
                                    <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{t.label}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.desc}</div></div>
                                    <button className="btn btn-ghost btn-xs" onClick={() => showToast(`${t.label} downloaded`)}><span className="material-icons-round" style={{ fontSize: 16, color: 'var(--text-muted)' }}>download</span></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="fade-in delay-3 card">
                        <h3 style={{ marginBottom: 14 }}>Import History</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {bulkHistory.map(h => (
                                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: h.status === 'success' ? 'var(--success-bg)' : 'var(--error-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span className="material-icons-round" style={{ fontSize: 18, color: h.status === 'success' ? 'var(--success)' : 'var(--error)' }}>{h.status === 'success' ? 'check_circle' : 'error'}</span>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{h.file}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{h.records} records · {h.date} · {h.user}</div>
                                    </div>
                                    {h.warnings > 0 && <span className="badge badge-warning">{h.warnings} warnings</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </main>
                )}
            </div>
        </div>
    );
}
