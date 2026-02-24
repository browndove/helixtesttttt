'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

type Department = { id: string; name: string; floors: string[]; wards: string[] };

const initialDepts: Department[] = [
    { id: 'd1', name: 'Emergency Medicine', floors: ['Ground Floor'], wards: ['Emergency Bay A', 'Emergency Bay B', 'Triage'] },
    { id: 'd2', name: 'ICU', floors: ['Floor 2'], wards: ['ICU A', 'ICU B', 'Neuro ICU'] },
    { id: 'd3', name: 'Cardiology', floors: ['Floor 3'], wards: ['Cardiac Ward', 'Cath Lab'] },
    { id: 'd4', name: 'Pediatrics', floors: ['Floor 1'], wards: ['Peds General', 'NICU'] },
    { id: 'd5', name: 'Surgery', floors: ['Floor 2', 'Floor 3'], wards: ['Surgical Suite A', 'Surgical Suite B', 'Recovery'] },
];

export default function DashboardPage() {
    const [hospitalName, setHospitalName] = useState('Accra Medical Center');
    const [hospitalAddress, setHospitalAddress] = useState('Ridge, Accra, Greater Accra Region, Ghana');
    const [hospitalPhone, setHospitalPhone] = useState('+233 30 266 1111');
    const [hospitalEmail, setHospitalEmail] = useState('admin@accramedical.com.gh');
    const [departments, setDepartments] = useState(initialDepts);
    const [toast, setToast] = useState<string | null>(null);
    const [editingDept, setEditingDept] = useState<string | null>(null);
    const [newDeptName, setNewDeptName] = useState('');
    const [showAddDept, setShowAddDept] = useState(false);
    const [newWard, setNewWard] = useState('');
    const [newFloor, setNewFloor] = useState('');

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const licenseExpiry = new Date('2027-03-15');
    const now = new Date();
    const daysLeft = Math.ceil((licenseExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const licenseActive = daysLeft > 0;
    const licenseWarning = daysLeft > 0 && daysLeft <= 90;

    const addDepartment = () => {
        if (!newDeptName.trim()) return;
        setDepartments(prev => [...prev, { id: `d-${Date.now()}`, name: newDeptName, floors: [], wards: [] }]);
        showToast(`${newDeptName} added`);
        setNewDeptName('');
        setShowAddDept(false);
    };

    const removeDepartment = (id: string) => {
        const dept = departments.find(d => d.id === id);
        setDepartments(prev => prev.filter(d => d.id !== id));
        showToast(`${dept?.name} removed`);
        if (editingDept === id) setEditingDept(null);
    };

    const addWard = (deptId: string) => {
        if (!newWard.trim()) return;
        setDepartments(prev => prev.map(d => d.id === deptId ? { ...d, wards: [...d.wards, newWard] } : d));
        showToast(`Ward "${newWard}" added`);
        setNewWard('');
    };

    const removeWard = (deptId: string, ward: string) => {
        setDepartments(prev => prev.map(d => d.id === deptId ? { ...d, wards: d.wards.filter(w => w !== ward) } : d));
    };

    const addFloor = (deptId: string) => {
        if (!newFloor.trim()) return;
        setDepartments(prev => prev.map(d => d.id === deptId ? { ...d, floors: [...d.floors, newFloor] } : d));
        showToast(`Floor "${newFloor}" added`);
        setNewFloor('');
    };

    const removeFloor = (deptId: string, floor: string) => {
        setDepartments(prev => prev.map(d => d.id === deptId ? { ...d, floors: d.floors.filter(f => f !== floor) } : d));
    };

    const editDept = departments.find(d => d.id === editingDept);

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
                <TopBar title="Home" subtitle="Hospital Setup" actions={
                    <button className="btn btn-primary btn-sm" onClick={() => showToast('All settings saved')}>
                        <span className="material-icons-round" style={{ fontSize: 14 }}>save</span>Save Changes
                    </button>
                } />

                <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>

                    {/* Configuration Checklist */}
                    {(() => {
                        const configSteps = [
                            { label: 'Hospital Profile', desc: 'Name, address, contact details, logo', href: '', done: !!hospitalName.trim() && !!hospitalAddress.trim() },
                            { label: 'License', desc: 'Verify active license status', href: '', done: licenseActive },
                            { label: 'Departments, Floors & Wards', desc: 'Set up organizational structure', href: '', done: departments.length > 0 },
                            { label: 'Roles', desc: 'Define messaging roles and routing', href: '/roles', done: false },
                            { label: 'Staff Management', desc: 'Add staff members and assign roles', href: '/staff', done: false },
                            { label: 'Patients', desc: 'Register patients into the system', href: '/patients', done: false },
                            { label: 'Escalation Config', desc: 'Set up battery alerts and message routing', href: '/escalation', done: false },
                        ];
                        const completedCount = configSteps.filter(s => s.done).length;
                        return (
                            <div className="fade-in card" style={{ marginBottom: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                    <div>
                                        <h3 style={{ marginBottom: 2 }}>Configuration Checklist</h3>
                                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{completedCount} of {configSteps.length} completed</p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 120, height: 6, borderRadius: 3, background: 'var(--border-subtle)', overflow: 'hidden' }}>
                                            <div style={{ width: `${(completedCount / configSteps.length) * 100}%`, height: '100%', borderRadius: 3, background: 'var(--success)', transition: 'width 0.3s' }} />
                                        </div>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{Math.round((completedCount / configSteps.length) * 100)}%</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {configSteps.map(step => (
                                        <div key={step.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 'var(--radius-md)', background: step.done ? 'transparent' : 'var(--surface-2)', border: `1px solid ${step.done ? 'var(--border-subtle)' : 'var(--border-default)'}`, opacity: step.done ? 0.6 : 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <span className="material-icons-round" style={{ fontSize: 16, color: step.done ? 'var(--success)' : 'var(--text-disabled)' }}>
                                                    {step.done ? 'check_circle' : 'radio_button_unchecked'}
                                                </span>
                                                <div>
                                                    <div style={{ fontSize: 13, fontWeight: 600, textDecoration: step.done ? 'line-through' : 'none', color: step.done ? 'var(--text-muted)' : 'var(--text-primary)' }}>{step.label}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{step.desc}</div>
                                                </div>
                                            </div>
                                            {!step.done && step.href && (
                                                <a href={step.href} style={{ fontSize: 12, fontWeight: 600, color: 'var(--helix-primary)', textDecoration: 'none' }}>Configure</a>
                                            )}
                                            {step.done && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)' }}>Done</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                        {/* Left Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                            {/* Hospital Profile */}
                            <div className="fade-in delay-1 card">
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                    <span className="material-icons-round" style={{ fontSize: 20, color: 'var(--helix-primary)' }}>business</span>
                                    Hospital Profile
                                </h3>

                                <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
                                    {/* Logo Placeholder */}
                                    <div style={{ width: 80, height: 80, borderRadius: 12, border: '2px dashed var(--border-default)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--surface-2)', flexShrink: 0, transition: 'all 0.2s' }} onClick={() => showToast('Logo upload coming soon')}>
                                        <span className="material-icons-round" style={{ fontSize: 24, color: 'var(--text-disabled)' }}>add_photo_alternate</span>
                                        <span style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>Upload Logo</span>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ marginBottom: 10 }}>
                                            <label className="label">Hospital Name</label>
                                            <input className="input" value={hospitalName} onChange={e => setHospitalName(e.target.value)} style={{ fontSize: 13 }} />
                                        </div>
                                        <div>
                                            <label className="label">Address</label>
                                            <input className="input" value={hospitalAddress} onChange={e => setHospitalAddress(e.target.value)} style={{ fontSize: 13 }} />
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <label className="label">Phone</label>
                                        <input className="input" value={hospitalPhone} onChange={e => setHospitalPhone(e.target.value)} style={{ fontSize: 13 }} />
                                    </div>
                                    <div>
                                        <label className="label">Email</label>
                                        <input className="input" value={hospitalEmail} onChange={e => setHospitalEmail(e.target.value)} style={{ fontSize: 13 }} />
                                    </div>
                                </div>
                            </div>

                            {/* License Status */}
                            <div className="fade-in delay-2 card">
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                    <span className="material-icons-round" style={{ fontSize: 20, color: licenseWarning ? 'var(--warning)' : licenseActive ? 'var(--success)' : 'var(--critical)' }}>
                                        {licenseActive ? 'verified' : 'gpp_bad'}
                                    </span>
                                    License Status
                                </h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 'var(--radius-md)', background: licenseWarning ? 'var(--warning-bg)' : licenseActive ? 'var(--success-bg)' : 'var(--critical-bg)', border: `1px solid ${licenseWarning ? 'rgba(154,123,46,0.2)' : licenseActive ? '#d5e8dd' : 'rgba(140,90,94,0.2)'}` }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: 14, color: licenseActive ? 'var(--text-primary)' : 'var(--critical)' }}>
                                            {licenseActive ? 'Active License' : 'License Expired'}
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                                            Expires: {licenseExpiry.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                        </div>
                                        {licenseActive && (
                                            <div style={{ fontSize: 12, color: licenseWarning ? 'var(--warning)' : 'var(--success)', marginTop: 2, fontWeight: 600 }}>
                                                {daysLeft} days remaining {licenseWarning ? '— Renewal recommended' : ''}
                                            </div>
                                        )}
                                    </div>
                                    <button className="btn btn-secondary btn-sm" onClick={() => showToast('Renewal request sent')}>
                                        <span className="material-icons-round" style={{ fontSize: 14 }}>autorenew</span>
                                        {licenseWarning || !licenseActive ? 'Renew Now' : 'Manage'}
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                                    <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>License Type</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>Enterprise</div>
                                    </div>
                                    <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Max Users</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>500</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column — Departments, Floors, Wards */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            <div className="fade-in delay-1 card" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span className="material-icons-round" style={{ fontSize: 20, color: 'var(--info)' }}>domain</span>
                                        Departments, Floors &amp; Wards
                                    </h3>
                                    <button className="btn btn-primary btn-xs" onClick={() => setShowAddDept(!showAddDept)}>
                                        <span className="material-icons-round" style={{ fontSize: 14 }}>{showAddDept ? 'close' : 'add'}</span>
                                        {showAddDept ? 'Cancel' : 'Add Department'}
                                    </button>
                                </div>

                                {showAddDept && (
                                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                                        <input className="input" placeholder="Department name" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addDepartment()} style={{ fontSize: 12, flex: 1 }} />
                                        <button className="btn btn-primary btn-sm" onClick={addDepartment} disabled={!newDeptName.trim()}>Add</button>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
                                    {/* Department List */}
                                    <div style={{ width: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {departments.map(d => (
                                            <div key={d.id} onClick={() => { setEditingDept(d.id); setNewWard(''); setNewFloor(''); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: editingDept === d.id ? '#edf1f7' : 'transparent', border: `1px solid ${editingDept === d.id ? 'var(--helix-primary)' : 'transparent'}`, transition: 'all 0.15s' }}>
                                                <span className="material-icons-round" style={{ fontSize: 16, color: editingDept === d.id ? 'var(--helix-primary)' : 'var(--text-muted)' }}>domain</span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{d.floors.length} floors · {d.wards.length} wards</div>
                                                </div>
                                            </div>
                                        ))}
                                        {departments.length === 0 && (
                                            <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>No departments yet</div>
                                        )}
                                    </div>

                                    {/* Department Detail */}
                                    <div style={{ flex: 1, borderLeft: '1px solid var(--border-subtle)', paddingLeft: 14, overflowY: 'auto' }}>
                                        {editDept ? (
                                            <div className="fade-in" key={editDept.id}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                                    <h4 style={{ fontSize: 14, fontWeight: 700 }}>{editDept.name}</h4>
                                                    <button className="btn btn-danger btn-xs" onClick={() => removeDepartment(editDept.id)}>
                                                        <span className="material-icons-round" style={{ fontSize: 12 }}>delete</span>Remove
                                                    </button>
                                                </div>

                                                {/* Floors */}
                                                <div style={{ marginBottom: 16 }}>
                                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Floors</div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                                        {editDept.floors.map(f => (
                                                            <span key={f} className="badge badge-info" style={{ cursor: 'pointer' }} onClick={() => removeFloor(editDept.id, f)}>
                                                                {f} <span className="material-icons-round" style={{ fontSize: 11 }}>close</span>
                                                            </span>
                                                        ))}
                                                        {editDept.floors.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No floors added</span>}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <input className="input" placeholder="Add floor..." value={newFloor} onChange={e => setNewFloor(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFloor(editDept.id)} style={{ fontSize: 11, flex: 1, height: 28, padding: '4px 8px' }} />
                                                        <button className="btn btn-secondary btn-xs" onClick={() => addFloor(editDept.id)} disabled={!newFloor.trim()}>Add</button>
                                                    </div>
                                                </div>

                                                {/* Wards */}
                                                <div>
                                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Wards</div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                                        {editDept.wards.map(w => (
                                                            <span key={w} className="badge badge-neutral" style={{ cursor: 'pointer' }} onClick={() => removeWard(editDept.id, w)}>
                                                                {w} <span className="material-icons-round" style={{ fontSize: 11 }}>close</span>
                                                            </span>
                                                        ))}
                                                        {editDept.wards.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No wards added</span>}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <input className="input" placeholder="Add ward..." value={newWard} onChange={e => setNewWard(e.target.value)} onKeyDown={e => e.key === 'Enter' && addWard(editDept.id)} style={{ fontSize: 11, flex: 1, height: 28, padding: '4px 8px' }} />
                                                        <button className="btn btn-secondary btn-xs" onClick={() => addWard(editDept.id)} disabled={!newWard.trim()}>Add</button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 120 }}>
                                                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                                    <span className="material-icons-round" style={{ fontSize: 32, color: 'var(--text-disabled)', marginBottom: 6, display: 'block' }}>touch_app</span>
                                                    <div style={{ fontSize: 12 }}>Select a department to manage floors and wards</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
