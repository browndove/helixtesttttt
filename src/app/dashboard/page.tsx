'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

type FloorItem = { id: string; name: string };
type WardItem = { id: string; name: string };
type Department = { id: string; name: string; floors: FloorItem[]; wards: WardItem[] };
type Hospital = { id: string; name: string; address: string; phone: string; email: string; license_type: string; license_expires_at: string; max_users: number };

const DUMMY_FLOORS: FloorItem[] = [
    { id: 'dummy-floor-ground', name: 'Ground Floor' },
    { id: 'dummy-floor-first', name: 'First Floor' },
];

const DUMMY_WARDS: WardItem[] = [
    { id: 'dummy-ward-a', name: 'Ward A' },
    { id: 'dummy-ward-b', name: 'Ward B' },
];

function normalizeDepartment(raw: Partial<Department>): Department {
    return {
        id: raw.id || '',
        name: raw.name || 'Unnamed Department',
        // Temporary fallback until backend guarantees nested collections.
        floors: Array.isArray(raw.floors) ? raw.floors : DUMMY_FLOORS,
        wards: Array.isArray(raw.wards) ? raw.wards : DUMMY_WARDS,
    };
}

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

    // Hospital-wide settings
    const [screenshotsAllowed, setScreenshotsAllowed] = useState(false);
    const [ipMode, setIpMode] = useState<'whitelist' | 'blacklist'>('whitelist');
    const [ipList, setIpList] = useState<string[]>([]);
    const [newIp, setNewIp] = useState('');
    const [retentionPeriod, setRetentionPeriod] = useState('90');
    const [externalMessaging, setExternalMessaging] = useState(false);
    const [allowedExternalDomains, setAllowedExternalDomains] = useState<string[]>([]);
    const [newDomain, setNewDomain] = useState('');
    const [settingsChanged, setSettingsChanged] = useState(false);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const fetchData = useCallback(async () => {
        try {
            // Fetch hospital/facility first
            const hRes = await fetch('/api/proxy/hospital');
            let facilityId = '';
            if (hRes.ok) {
                const h = await hRes.json();
                setHospital(h);
                setHospitalName(h.name || '');
                setHospitalAddress(h.address || '');
                setHospitalPhone(h.phone || '');
                setHospitalEmail(h.email || '');
                facilityId = h.id || '';
            }
            // Fetch departments scoped to this facility
            const deptUrl = facilityId
                ? `/api/proxy/departments?facility_id=${facilityId}`
                : '/api/proxy/departments';
            const dRes = await fetch(deptUrl);
            if (dRes.ok) {
                const d = await dRes.json();
                setDepartments(Array.isArray(d) ? d.map(normalizeDepartment) : []);
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

    const addDepartment = async () => {
        if (!newDeptName.trim()) return;
        try {
            const res = await fetch('/api/proxy/departments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newDeptName.trim(),
                    description: '',
                    facility_id: hospital?.id || '',
                }),
            });
            if (res.ok) {
                const dept = await res.json();
                setDepartments(prev => [...prev, normalizeDepartment(dept)]);
                showToast(`${newDeptName} added`);
                setNewDeptName('');
                setShowAddDept(false);
            }
        } catch { showToast('Failed to add department'); }
    };

    const removeDepartment = async (id: string) => {
        const dept = departments.find(d => d.id === id);
        try {
            const res = await fetch(`/api/proxy/departments/${id}`, { method: 'DELETE' });
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
            const res = await fetch(`/api/proxy/departments/${deptId}/wards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newWard.trim() }),
            });
            if (res.ok) {
                const ward = await res.json();
                setDepartments(prev => prev.map(d => d.id === deptId ? { ...d, wards: [...(d.wards || []), ward] } : d));
                showToast(`Ward "${newWard}" added`);
                setNewWard('');
            }
        } catch { showToast('Failed to add ward'); }
    };

    const removeWard = async (deptId: string, wardId: string) => {
        try {
            const res = await fetch(`/api/proxy/departments/${deptId}/wards/${wardId}`, { method: 'DELETE' });
            if (res.ok) {
                setDepartments(prev => prev.map(d => d.id === deptId ? { ...d, wards: (d.wards || []).filter(w => w.id !== wardId) } : d));
            }
        } catch { showToast('Failed to remove ward'); }
    };

    const addFloor = async (deptId: string) => {
        if (!newFloor.trim()) return;
        try {
            const res = await fetch(`/api/proxy/departments/${deptId}/floors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newFloor.trim() }),
            });
            if (res.ok) {
                const floor = await res.json();
                setDepartments(prev => prev.map(d => d.id === deptId ? { ...d, floors: [...(d.floors || []), floor] } : d));
                showToast(`Floor "${newFloor}" added`);
                setNewFloor('');
            }
        } catch { showToast('Failed to add floor'); }
    };

    const removeFloor = async (deptId: string, floorId: string) => {
        try {
            const res = await fetch(`/api/proxy/departments/${deptId}/floors/${floorId}`, { method: 'DELETE' });
            if (res.ok) {
                setDepartments(prev => prev.map(d => d.id === deptId ? { ...d, floors: (d.floors || []).filter(f => f.id !== floorId) } : d));
            }
        } catch { showToast('Failed to remove floor'); }
    };

    // Settings helpers
    const addIp = () => {
        const ip = newIp.trim();
        if (!ip || ipList.includes(ip)) return;
        setIpList(prev => [...prev, ip]);
        setNewIp('');
        setSettingsChanged(true);
    };
    const removeIp = (ip: string) => { setIpList(prev => prev.filter(i => i !== ip)); setSettingsChanged(true); };
    const addDomainEntry = () => {
        const d = newDomain.trim().toLowerCase();
        if (!d || allowedExternalDomains.includes(d)) return;
        setAllowedExternalDomains(prev => [...prev, d]);
        setNewDomain('');
        setSettingsChanged(true);
    };
    const removeDomainEntry = (d: string) => { setAllowedExternalDomains(prev => prev.filter(x => x !== d)); setSettingsChanged(true); };
    const saveSettings = () => { setSettingsChanged(false); showToast('Settings saved successfully'); };

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
                <TopBar title="Home" subtitle="Hospital Setup" />

                <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>
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
                                    <div style={{ width: 80, height: 80, borderRadius: 12, border: '2px dashed var(--border-default)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'default', background: 'var(--surface-2)', flexShrink: 0, transition: 'all 0.2s' }}>
                                        <span className="material-icons-round" style={{ fontSize: 24, color: 'var(--text-disabled)' }}>add_photo_alternate</span>
                                        <span style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>Logo</span>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ marginBottom: 10 }}>
                                            <label className="label">Hospital Name</label>
                                            <input className="input" value={hospitalName} readOnly disabled style={{ fontSize: 13 }} />
                                        </div>
                                        <div>
                                            <label className="label">Address</label>
                                            <input className="input" value={hospitalAddress} readOnly disabled style={{ fontSize: 13 }} />
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <label className="label">Phone</label>
                                        <input className="input" value={hospitalPhone} readOnly disabled style={{ fontSize: 13 }} />
                                    </div>
                                    <div>
                                        <label className="label">Email</label>
                                        <input className="input" value={hospitalEmail} readOnly disabled style={{ fontSize: 13 }} />
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
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{(d.floors || []).length} floors · {(d.wards || []).length} wards</div>
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

                    {/* Hospital-Wide Settings */}
                    <div className="fade-in delay-2" style={{ marginTop: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                    <span className="material-icons-round" style={{ fontSize: 22, color: 'var(--helix-primary)' }}>admin_panel_settings</span>
                                    Hospital-Wide Settings
                                </h3>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Security, compliance, and messaging policies that apply across all departments</p>
                            </div>
                            {settingsChanged && (
                                <button className="btn btn-primary btn-sm" onClick={saveSettings}>
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>save</span> Save Settings
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                            {/* Left Settings Column */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                                {/* Screenshot Control */}
                                <div className="card">
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 36, height: 36, borderRadius: 10, background: screenshotsAllowed ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span className="material-icons-round" style={{ fontSize: 20, color: screenshotsAllowed ? 'var(--success)' : 'var(--danger)' }}>
                                                    {screenshotsAllowed ? 'screenshot_monitor' : 'no_photography'}
                                                </span>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 14, fontWeight: 700 }}>Screenshot Control</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Allow or block screen captures within the app</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 'var(--radius-md)', background: screenshotsAllowed ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.04)', border: `1px solid ${screenshotsAllowed ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)'}` }}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>
                                                Screenshots {screenshotsAllowed ? 'Allowed' : 'Blocked'}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                                {screenshotsAllowed ? 'Users can capture screen content' : 'Screen capture is disabled for all users'}
                                            </div>
                                        </div>
                                        <div
                                            onClick={() => { setScreenshotsAllowed(!screenshotsAllowed); setSettingsChanged(true); }}
                                            style={{ width: 44, height: 24, borderRadius: 12, background: screenshotsAllowed ? 'var(--success)' : 'var(--border-default)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                                        >
                                            <div style={{ width: 18, height: 18, borderRadius: 9, background: '#fff', position: 'absolute', top: 3, left: screenshotsAllowed ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                        </div>
                                    </div>
                                    <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span className="material-icons-round" style={{ fontSize: 14, color: 'var(--info)' }}>info</span>
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>This policy applies to all mobile and desktop clients connected to Helix</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Message Retention Period */}
                                <div className="card">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span className="material-icons-round" style={{ fontSize: 20, color: '#6366f1' }}>schedule</span>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 700 }}>Message Retention</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>How long messages are stored before auto-deletion</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {[
                                            { value: '30', label: '30 Days', desc: 'Minimum retention — aggressive cleanup' },
                                            { value: '90', label: '90 Days', desc: 'Recommended for most facilities' },
                                            { value: '180', label: '180 Days', desc: 'Extended retention for compliance' },
                                            { value: '365', label: '1 Year', desc: 'Full annual retention' },
                                            { value: 'forever', label: 'Indefinite', desc: 'Messages are never auto-deleted' },
                                        ].map(opt => (
                                            <div
                                                key={opt.value}
                                                onClick={() => { setRetentionPeriod(opt.value); setSettingsChanged(true); }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                                    background: retentionPeriod === opt.value ? 'rgba(99,102,241,0.06)' : 'transparent',
                                                    border: `1px solid ${retentionPeriod === opt.value ? 'rgba(99,102,241,0.3)' : 'var(--border-subtle)'}`,
                                                    transition: 'all 0.15s',
                                                }}
                                            >
                                                <div style={{
                                                    width: 16, height: 16, borderRadius: 8, border: `2px solid ${retentionPeriod === opt.value ? '#6366f1' : 'var(--border-default)'}`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                }}>
                                                    {retentionPeriod === opt.value && <div style={{ width: 8, height: 8, borderRadius: 4, background: '#6366f1' }} />}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opt.desc}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right Settings Column */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                                {/* IP Whitelist / Blacklist */}
                                <div className="card">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span className="material-icons-round" style={{ fontSize: 20, color: '#f59e0b' }}>vpn_lock</span>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 14, fontWeight: 700 }}>Network Access Control</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Restrict access by IP address</div>
                                        </div>
                                    </div>

                                    {/* Mode selector */}
                                    <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
                                        {(['whitelist', 'blacklist'] as const).map(mode => (
                                            <button
                                                key={mode}
                                                onClick={() => { setIpMode(mode); setSettingsChanged(true); }}
                                                style={{
                                                    flex: 1, padding: '8px 12px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                                                    background: ipMode === mode ? (mode === 'whitelist' ? 'var(--success)' : 'var(--danger)') : 'var(--surface-2)',
                                                    color: ipMode === mode ? '#fff' : 'var(--text-secondary)',
                                                    transition: 'all 0.15s',
                                                }}
                                            >
                                                <span className="material-icons-round" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>
                                                    {mode === 'whitelist' ? 'check_circle' : 'block'}
                                                </span>
                                                {mode === 'whitelist' ? 'Whitelist' : 'Blacklist'}
                                            </button>
                                        ))}
                                    </div>

                                    <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: ipMode === 'whitelist' ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.04)', border: `1px solid ${ipMode === 'whitelist' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)'}`, marginBottom: 12 }}>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            {ipMode === 'whitelist' ? 'Only listed IPs will be allowed to access the system' : 'Listed IPs will be blocked from accessing the system'}
                                        </span>
                                    </div>

                                    {/* IP input */}
                                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                                        <input className="input" placeholder="e.g. 192.168.1.0/24" value={newIp} onChange={e => setNewIp(e.target.value)} onKeyDown={e => e.key === 'Enter' && addIp()} style={{ fontSize: 12, flex: 1 }} />
                                        <button className="btn btn-secondary btn-sm" onClick={addIp} disabled={!newIp.trim()}>
                                            <span className="material-icons-round" style={{ fontSize: 14 }}>add</span> Add
                                        </button>
                                    </div>

                                    {/* IP list */}
                                    <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {ipList.map(ip => (
                                            <div key={ip} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span className="material-icons-round" style={{ fontSize: 14, color: ipMode === 'whitelist' ? 'var(--success)' : 'var(--danger)' }}>
                                                        {ipMode === 'whitelist' ? 'check_circle' : 'block'}
                                                    </span>
                                                    <code style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-primary)' }}>{ip}</code>
                                                </div>
                                                <button onClick={() => removeIp(ip)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                                    <span className="material-icons-round" style={{ fontSize: 14, color: 'var(--text-muted)' }}>close</span>
                                                </button>
                                            </div>
                                        ))}
                                        {ipList.length === 0 && (
                                            <div style={{ padding: '14px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                                                No IP addresses configured — all traffic is {ipMode === 'whitelist' ? 'blocked' : 'allowed'}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* External Hospital Messaging */}
                                <div className="card">
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(14,165,233,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span className="material-icons-round" style={{ fontSize: 20, color: '#0ea5e9' }}>forum</span>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 14, fontWeight: 700 }}>External Messaging</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Cross-facility and external communications</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 'var(--radius-md)', background: externalMessaging ? 'rgba(14,165,233,0.06)' : 'var(--surface-2)', border: `1px solid ${externalMessaging ? 'rgba(14,165,233,0.2)' : 'var(--border-subtle)'}`, marginBottom: 14 }}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>
                                                External Messaging {externalMessaging ? 'Enabled' : 'Disabled'}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                                {externalMessaging ? 'Staff can communicate with approved external facilities' : 'All messaging is restricted to this facility only'}
                                            </div>
                                        </div>
                                        <div
                                            onClick={() => { setExternalMessaging(!externalMessaging); setSettingsChanged(true); }}
                                            style={{ width: 44, height: 24, borderRadius: 12, background: externalMessaging ? '#0ea5e9' : 'var(--border-default)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                                        >
                                            <div style={{ width: 18, height: 18, borderRadius: 9, background: '#fff', position: 'absolute', top: 3, left: externalMessaging ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                        </div>
                                    </div>

                                    {externalMessaging && (
                                        <div className="fade-in">
                                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Approved External Domains</div>
                                            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                                                <input className="input" placeholder="e.g. partner-hospital.helix.health" value={newDomain} onChange={e => setNewDomain(e.target.value)} onKeyDown={e => e.key === 'Enter' && addDomainEntry()} style={{ fontSize: 12, flex: 1 }} />
                                                <button className="btn btn-secondary btn-sm" onClick={addDomainEntry} disabled={!newDomain.trim()}>
                                                    <span className="material-icons-round" style={{ fontSize: 14 }}>add</span> Add
                                                </button>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                {allowedExternalDomains.map(d => (
                                                    <span key={d} className="badge badge-info" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => removeDomainEntry(d)}>
                                                        <span className="material-icons-round" style={{ fontSize: 12 }}>language</span>
                                                        {d}
                                                        <span className="material-icons-round" style={{ fontSize: 11 }}>close</span>
                                                    </span>
                                                ))}
                                                {allowedExternalDomains.length === 0 && (
                                                    <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--text-muted)' }}>No external domains approved yet</div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {!externalMessaging && (
                                        <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span className="material-icons-round" style={{ fontSize: 14, color: 'var(--warning)' }}>lock</span>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Enable to allow cross-facility messaging with approved partners</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
