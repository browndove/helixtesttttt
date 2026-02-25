'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

type FloorItem = { id: string; name: string };
type WardItem = { id: string; name: string };
type Department = { id: string; name: string; floors: FloorItem[]; wards: WardItem[] };
type Hospital = { id: string; name: string; address: string; phone: string; email: string; license_type: string; license_expires_at: string; max_users: number };

export default function DashboardPage() {
    const [hospital, setHospital] = useState<Hospital | null>(null);
    const [hospitalName, setHospitalName] = useState('');
    const [hospitalAddress, setHospitalAddress] = useState('');
    const [hospitalPhone, setHospitalPhone] = useState('');
    const [hospitalEmail, setHospitalEmail] = useState('');
    const [departments, setDepartments] = useState<Department[]>([]);
    const [toast, setToast] = useState<string | null>(null);
    const [editingDept, setEditingDept] = useState<string | null>(null);
    const [newDeptName, setNewDeptName] = useState('');
    const [showAddDept, setShowAddDept] = useState(false);
    const [newWard, setNewWard] = useState('');
    const [newFloor, setNewFloor] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const fetchData = useCallback(async () => {
        try {
            const [hRes, dRes] = await Promise.all([
                fetch('/api/hospital'),
                fetch('/api/departments'),
            ]);
            if (hRes.ok) {
                const h = await hRes.json();
                setHospital(h);
                setHospitalName(h.name || '');
                setHospitalAddress(h.address || '');
                setHospitalPhone(h.phone || '');
                setHospitalEmail(h.email || '');
            }
            if (dRes.ok) {
                const d = await dRes.json();
                setDepartments(d);
            }
        } catch { showToast('Failed to load data'); }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const licenseExpiry = hospital?.license_expires_at ? new Date(hospital.license_expires_at) : new Date();
    const now = new Date();
    const daysLeft = Math.ceil((licenseExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const licenseActive = daysLeft > 0;
    const licenseWarning = daysLeft > 0 && daysLeft <= 90;

    const saveProfile = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/hospital', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: hospitalName, address: hospitalAddress, phone: hospitalPhone, email: hospitalEmail }),
            });
            if (res.ok) showToast('Profile saved');
            else showToast('Failed to save');
        } catch { showToast('Network error'); }
        setSaving(false);
    };

    const addDepartment = async () => {
        if (!newDeptName.trim()) return;
        try {
            const res = await fetch('/api/departments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newDeptName.trim() }),
            });
            if (res.ok) {
                const dept = await res.json();
                setDepartments(prev => [...prev, dept]);
                showToast(`${newDeptName} added`);
                setNewDeptName('');
                setShowAddDept(false);
            }
        } catch { showToast('Failed to add department'); }
    };

    const removeDepartment = async (id: string) => {
        const dept = departments.find(d => d.id === id);
        try {
            const res = await fetch(`/api/departments/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setDepartments(prev => prev.filter(d => d.id !== id));
                showToast(`${dept?.name} removed`);
                if (editingDept === id) setEditingDept(null);
            }
        } catch { showToast('Failed to remove department'); }
    };

    const addWard = async (deptId: string) => {
        if (!newWard.trim()) return;
        try {
            const res = await fetch(`/api/departments/${deptId}/wards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newWard.trim() }),
            });
            if (res.ok) {
                const ward = await res.json();
                setDepartments(prev => prev.map(d => d.id === deptId ? { ...d, wards: [...d.wards, ward] } : d));
                showToast(`Ward "${newWard}" added`);
                setNewWard('');
            }
        } catch { showToast('Failed to add ward'); }
    };

    const removeWard = async (deptId: string, wardId: string) => {
        try {
            const res = await fetch(`/api/departments/${deptId}/wards/${wardId}`, { method: 'DELETE' });
            if (res.ok) {
                setDepartments(prev => prev.map(d => d.id === deptId ? { ...d, wards: d.wards.filter(w => w.id !== wardId) } : d));
            }
        } catch { showToast('Failed to remove ward'); }
    };

    const addFloor = async (deptId: string) => {
        if (!newFloor.trim()) return;
        try {
            const res = await fetch(`/api/departments/${deptId}/floors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newFloor.trim() }),
            });
            if (res.ok) {
                const floor = await res.json();
                setDepartments(prev => prev.map(d => d.id === deptId ? { ...d, floors: [...d.floors, floor] } : d));
                showToast(`Floor "${newFloor}" added`);
                setNewFloor('');
            }
        } catch { showToast('Failed to add floor'); }
    };

    const removeFloor = async (deptId: string, floorId: string) => {
        try {
            const res = await fetch(`/api/departments/${deptId}/floors/${floorId}`, { method: 'DELETE' });
            if (res.ok) {
                setDepartments(prev => prev.map(d => d.id === deptId ? { ...d, floors: d.floors.filter(f => f.id !== floorId) } : d));
            }
        } catch { showToast('Failed to remove floor'); }
    };

    const editDept = departments.find(d => d.id === editingDept);

    if (loading) {
        const shimmer = {
            background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border-subtle) 50%, var(--surface-2) 75%)',
            backgroundSize: '400% 100%',
            animation: 'shimmer 1.4s ease infinite',
            borderRadius: 'var(--radius-md)',
        };
        const line = (w: string, h = 12) => <div style={{ ...shimmer, width: w, height: h, marginBottom: 8 }} />;
        return (
            <div className="app-shell">
                <Sidebar sections={navSections} />
                <div className="app-main">
                    <TopBar title="Home" subtitle="Hospital Setup" />
                    <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>
                        {/* Checklist skeleton */}
                        <div className="fade-in card" style={{ marginBottom: 20 }}>
                            {line('200px', 16)}
                            {line('120px', 10)}
                            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {[1, 2, 3, 4, 5].map(i => <div key={i} style={{ ...shimmer, height: 40, width: '100%' }} />)}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                {/* Hospital Profile skeleton */}
                                <div className="fade-in delay-1 card">
                                    {line('160px', 16)}
                                    <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                                        <div style={{ ...shimmer, width: 80, height: 80, borderRadius: 12, flexShrink: 0 }} />
                                        <div style={{ flex: 1 }}>
                                            {line('100%', 32)}
                                            {line('100%', 32)}
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                                        <div style={{ ...shimmer, height: 32 }} />
                                        <div style={{ ...shimmer, height: 32 }} />
                                    </div>
                                </div>
                                {/* License skeleton */}
                                <div className="fade-in delay-2 card">
                                    {line('140px', 16)}
                                    <div style={{ ...shimmer, height: 70, marginTop: 10 }} />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                                        <div style={{ ...shimmer, height: 48 }} />
                                        <div style={{ ...shimmer, height: 48 }} />
                                    </div>
                                </div>
                            </div>
                            {/* Departments skeleton */}
                            <div className="fade-in delay-1 card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                                    {line('220px', 16)}
                                    <div style={{ ...shimmer, width: 120, height: 28 }} />
                                </div>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <div style={{ width: 200, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {[1, 2, 3, 4, 5].map(i => <div key={i} style={{ ...shimmer, height: 44 }} />)}
                                    </div>
                                    <div style={{ flex: 1, borderLeft: '1px solid var(--border-subtle)', paddingLeft: 14 }}>
                                        <div style={{ ...shimmer, height: '100%', minHeight: 200 }} />
                                    </div>
                                </div>
                            </div>
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

            <div className="app-main">
                <TopBar title="Home" subtitle="Hospital Setup" actions={
                    <button className="btn btn-primary btn-sm" onClick={saveProfile} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
                        <span className="material-icons-round" style={{ fontSize: 14 }}>save</span>{saving ? 'Saving...' : 'Save Changes'}
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
                                        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{hospital?.license_type || 'Enterprise'}</div>
                                    </div>
                                    <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Max Users</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{hospital?.max_users || 500}</div>
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
                                    <button className="btn btn-primary btn-sm" onClick={() => setShowAddDept(!showAddDept)}>
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
                                                            <span key={f.id} className="badge badge-info" style={{ cursor: 'pointer' }} onClick={() => removeFloor(editDept.id, f.id)}>
                                                                {f.name} <span className="material-icons-round" style={{ fontSize: 11 }}>close</span>
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
                                                            <span key={w.id} className="badge badge-neutral" style={{ cursor: 'pointer' }} onClick={() => removeWard(editDept.id, w.id)}>
                                                                {w.name} <span className="material-icons-round" style={{ fontSize: 11 }}>close</span>
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
