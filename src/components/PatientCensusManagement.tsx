'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

type Patient = {
    mrn: string; name: string; age: number; ward: string; bed: string; admDate: string;
    status: string; physician: string; dx: string;
    careTeam: string[]; archived: boolean;
};

const allStaff = ['Dr. Adjei', 'Dr. Frimpong', 'Dr. Mensah', 'Dr. Owusu', 'Dr. Asante', 'Nurse Osei', 'Nurse Darko', 'Nurse Boateng'];
const allWards = ['ICU A', 'ICU B', 'Gen A', 'Gen B', 'Gen C', 'Cardio A', 'Cardio B', 'Neuro A', 'Neuro B', 'Surg A', 'Obs'];
const allBeds = ['Bed 1', 'Bed 2', 'Bed 3', 'Bed 4', 'Bed 5', 'Bed 6', 'Bed 7', 'Bed 8'];

const initialPatients: Patient[] = [
    { mrn: '88421', name: 'Mensah, Kwame', age: 67, ward: 'ICU A', bed: 'Bed 3', admDate: 'Nov 10', status: 'critical', physician: 'Dr. Adjei', dx: 'Sepsis', careTeam: ['Dr. Adjei', 'Nurse Osei'], archived: false },
    { mrn: '92104', name: 'Osei, Abena', age: 45, ward: 'Gen A', bed: 'Bed 1', admDate: 'Nov 12', status: 'stable', physician: 'Dr. Frimpong', dx: 'Community Pneumonia', careTeam: ['Dr. Frimpong'], archived: false },
    { mrn: '77210', name: 'Asante, Kofi', age: 52, ward: 'Cardio B', bed: 'Bed 2', admDate: 'Nov 11', status: 'monitoring', physician: 'Dr. Mensah', dx: 'ACS — Rule Out', careTeam: ['Dr. Mensah', 'Nurse Darko'], archived: false },
    { mrn: '88992', name: 'Boateng, Yaw', age: 78, ward: 'Gen C', bed: 'Bed 5', admDate: 'Nov 09', status: 'stable', physician: 'Dr. Owusu', dx: 'Hip Fracture (Post-Op)', careTeam: ['Dr. Owusu'], archived: false },
    { mrn: '66521', name: 'Darko, Ama', age: 31, ward: 'Obs', bed: 'Bed 1', admDate: 'Nov 13', status: 'discharge-ready', physician: 'Dr. Asante', dx: 'Appendectomy Recovery', careTeam: ['Dr. Asante'], archived: false },
    { mrn: '55102', name: 'Tetteh, Efua', age: 58, ward: 'ICU B', bed: 'Bed 4', admDate: 'Nov 08', status: 'critical', physician: 'Dr. Frimpong', dx: 'STEMI — Post PCI', careTeam: ['Dr. Frimpong', 'Nurse Boateng'], archived: false },
    { mrn: '44893', name: 'Appiah, Kwesi', age: 42, ward: 'Neuro A', bed: 'Bed 2', admDate: 'Nov 11', status: 'monitoring', physician: 'Dr. Mensah', dx: 'Ischemic Stroke', careTeam: ['Dr. Mensah'], archived: false },
    { mrn: '33210', name: 'Agyemang, Adwoa', age: 35, ward: 'Gen B', bed: 'Bed 3', admDate: 'Nov 13', status: 'stable', physician: 'Dr. Adjei', dx: 'Cholecystectomy Recovery', careTeam: ['Dr. Adjei'], archived: false },
    { mrn: '22781', name: 'Amoako, Nana', age: 71, ward: 'Cardio A', bed: 'Bed 1', admDate: 'Nov 07', status: 'discharge-ready', physician: 'Dr. Owusu', dx: 'CHF Exacerbation (Resolved)', careTeam: ['Dr. Owusu', 'Nurse Osei'], archived: false },
    { mrn: '11450', name: 'Ofori, Akwasi', age: 29, ward: 'Surg A', bed: 'Bed 6', admDate: 'Nov 12', status: 'stable', physician: 'Dr. Asante', dx: 'Appendicitis (Post-Op Day 1)', careTeam: ['Dr. Asante'], archived: false },
    { mrn: '99312', name: 'Ankrah, Kojo', age: 63, ward: 'Neuro B', bed: 'Bed 1', admDate: 'Nov 10', status: 'monitoring', physician: 'Dr. Frimpong', dx: 'TBI — Observation', careTeam: ['Dr. Frimpong'], archived: false },
    { mrn: '78654', name: 'Quaye, Akosua', age: 55, ward: 'Gen A', bed: 'Bed 4', admDate: 'Nov 14', status: 'stable', physician: 'Dr. Mensah', dx: 'Diabetic Ketoacidosis', careTeam: ['Dr. Mensah', 'Nurse Darko'], archived: false },
];

const statusMap: Record<string, { label: string; color: string; bg: string; badge: string }> = {
    critical: { label: 'Critical', color: 'var(--critical)', bg: 'var(--critical-bg)', badge: 'badge-critical' },
    monitoring: { label: 'Monitoring', color: 'var(--warning)', bg: 'var(--warning-bg)', badge: 'badge-warning' },
    stable: { label: 'Stable', color: 'var(--success)', bg: 'var(--success-bg)', badge: 'badge-success' },
    'discharge-ready': { label: 'D/C Ready', color: 'var(--helix-accent)', bg: 'rgba(74,111,165,0.1)', badge: 'badge-info' },
    discharged: { label: 'Discharged', color: 'var(--text-muted)', bg: 'var(--surface-2)', badge: 'badge-neutral' },
    archived: { label: 'Archived', color: 'var(--text-muted)', bg: 'var(--surface-2)', badge: 'badge-neutral' },
};

const stats = [
    { label: 'Total Active', value: '142', icon: 'personal_injury', color: 'var(--helix-primary)' },
    { label: 'Critical', value: '8', icon: 'monitor_heart', color: 'var(--critical)' },
    { label: 'Admissions Today', value: '14', icon: 'login', color: 'var(--helix-accent)' },
    { label: 'D/C Ready', value: '11', icon: 'check_circle', color: 'var(--success)' },
    { label: 'Avg LOS (days)', value: '4.2', icon: 'schedule', color: 'var(--warning)', sub: '−0.3 from last week' },
];

export default function PatientCensusManagement() {
    const [patients, setPatients] = useState(initialPatients);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selected, setSelected] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState('admDate');
    const [showAdmitForm, setShowAdmitForm] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [mergeTarget, setMergeTarget] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [newWard, setNewWard] = useState('Gen A');
    const [newDx, setNewDx] = useState('');

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const activePatients = patients.filter(p => showArchived ? p.archived : !p.archived);
    const filtered = activePatients.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.mrn.includes(search);
        const matchStatus = filterStatus === 'all' || p.status === filterStatus;
        return matchSearch && matchStatus;
    }).sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return 0;
    });

    const selectedPatient = selected ? patients.find(p => p.mrn === selected) : null;

    const updatePatient = (mrn: string, updates: Partial<Patient>) => {
        setPatients(prev => prev.map(p => p.mrn === mrn ? { ...p, ...updates } : p));
    };

    const handleAdmit = () => {
        if (!newName.trim()) return;
        const mrn = String(10000 + Math.floor(Math.random() * 89999));
        const newP: Patient = { mrn, name: newName, age: 30 + Math.floor(Math.random() * 50), ward: newWard, bed: 'Bed 1', admDate: 'Nov 14', status: 'stable', physician: 'Dr. Adjei', dx: newDx || 'Pending Assessment', careTeam: ['Dr. Adjei'], archived: false };
        setPatients(prev => [newP, ...prev]);
        setShowAdmitForm(false);
        setNewName(''); setNewDx('');
        showToast(`${newName} admitted (MRN: ${mrn})`);
    };

    const handleMarkDCReady = (mrn: string) => {
        updatePatient(mrn, { status: 'discharge-ready' });
        showToast('Patient marked as discharge-ready');
    };

    const handleDischarge = (mrn: string) => {
        updatePatient(mrn, { status: 'discharged' });
        setSelected(null);
        showToast('Patient discharged successfully');
    };

    const handleArchive = (mrn: string) => {
        updatePatient(mrn, { archived: true, status: 'archived' });
        setSelected(null);
        showToast('Patient archived');
    };

    const handleSafeDelete = (mrn: string) => {
        setPatients(prev => prev.filter(p => p.mrn !== mrn));
        setSelected(null);
        setConfirmDelete(null);
        showToast('Patient record permanently deleted (audit logged)');
    };

    const handleMerge = (sourceMrn: string, targetMrn: string) => {
        const source = patients.find(p => p.mrn === sourceMrn);
        const target = patients.find(p => p.mrn === targetMrn);
        if (!source || !target) return;
        const mergedTeam = Array.from(new Set([...target.careTeam, ...source.careTeam]));
        updatePatient(targetMrn, { careTeam: mergedTeam });
        setPatients(prev => prev.filter(p => p.mrn !== sourceMrn));
        setSelected(targetMrn);
        setMergeTarget(null);
        showToast(`Merged ${source.name} into ${target.name} (audit logged)`);
    };

    const toggleCareTeam = (mrn: string, staff: string) => {
        const p = patients.find(pt => pt.mrn === mrn);
        if (!p) return;
        const updated = p.careTeam.includes(staff) ? p.careTeam.filter(s => s !== staff) : [...p.careTeam, staff];
        updatePatient(mrn, { careTeam: updated });
    };

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <Sidebar hospitalName="Korle Bu" sections={navSections} footer={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="avatar" style={{ background: 'rgba(30,58,95,0.2)', color: 'var(--helix-primary-light)' }}>AM</div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Dr. Ama Mensah</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Chief Resident</div>
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

            {/* Confirm Delete Modal */}
            {confirmDelete && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card modal-content" style={{ maxWidth: 400, padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <span className="material-icons-round" style={{ fontSize: 24, color: 'var(--critical)' }}>warning</span>
                            <h3>Permanently Delete Record?</h3>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                            This will permanently remove MRN <strong>{confirmDelete}</strong> from the system. This action is audited and cannot be undone. Consider archiving instead.
                        </p>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleSafeDelete(confirmDelete)}>
                                <span className="material-icons-round" style={{ fontSize: 14 }}>delete_forever</span>Delete Permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <TopBar
                    title="Patient Census"
                    breadcrumbs={['Dashboard', 'Acute Care']}
                    search={{ placeholder: 'Search patients...', value: search, onChange: setSearch }}
                    actions={
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setShowArchived(!showArchived); setSelected(null); }}>
                                <span className="material-icons-round" style={{ fontSize: 15 }}>{showArchived ? 'folder_open' : 'archive'}</span>
                                {showArchived ? 'Active' : 'Archived'}
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => setShowAdmitForm(!showAdmitForm)}>
                                <span className="material-icons-round" style={{ fontSize: 15 }}>{showAdmitForm ? 'close' : 'add'}</span>
                                {showAdmitForm ? 'Cancel' : 'Add Patient'}
                            </button>
                        </div>
                    }
                />
            <main style={{ flex: 1, overflow: 'auto', padding: '20px 24px', background: 'var(--bg-900)' }}>

                {/* Admit Form */}
                {showAdmitForm && (
                    <div className="fade-in card" style={{ marginBottom: 18, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 160 }}>
                            <label className="label">Patient Name</label>
                            <input className="input" placeholder="Last, First" value={newName} onChange={e => setNewName(e.target.value)} style={{ fontSize: 13 }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 120 }}>
                            <label className="label">Ward</label>
                            <select className="input" value={newWard} onChange={e => setNewWard(e.target.value)} style={{ fontSize: 13 }}>
                                {allWards.map(w => <option key={w}>{w}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: 1, minWidth: 160 }}>
                            <label className="label">Diagnosis</label>
                            <input className="input" placeholder="Primary diagnosis" value={newDx} onChange={e => setNewDx(e.target.value)} style={{ fontSize: 13 }} />
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={handleAdmit} disabled={!newName.trim()} style={{ height: 36 }}>
                            <span className="material-icons-round" style={{ fontSize: 15 }}>person_add</span>Admit
                        </button>
                    </div>
                )}

                {/* Stats */}
                {!showArchived && (
                    <div className="fade-in delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }}>
                        {stats.map(s => (
                            <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontSize: 23, fontWeight: 800, color: s.color }}>{s.value}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{s.label}</div>
                                        {s.sub && <div style={{ fontSize: 10, color: 'var(--success)', marginTop: 2 }}>{s.sub}</div>}
                                    </div>
                                    <span className="material-icons-round" style={{ fontSize: 20, color: s.color, opacity: 0.7 }}>{s.icon}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Filters */}
                <div className="fade-in delay-2" style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
                    {!showArchived && (
                        <div style={{ display: 'flex', gap: 6 }}>
                            {['all', 'critical', 'monitoring', 'stable', 'discharge-ready', 'discharged'].map(f => (
                                <button key={f} onClick={() => setFilterStatus(f)} className="btn btn-secondary btn-xs"
                                    style={{ background: filterStatus === f ? 'rgba(30,58,95,0.12)' : undefined, borderColor: filterStatus === f ? 'var(--helix-primary)' : undefined, color: filterStatus === f ? 'var(--helix-primary-light)' : undefined }}>
                                    {f === 'all' ? 'All' : statusMap[f]?.label}
                                </button>
                            ))}
                        </div>
                    )}
                    <select className="input" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 'auto', fontSize: 13, padding: '5px 28px 5px 10px', marginLeft: 'auto' }}>
                        <option value="admDate">Sort: Admission Date</option>
                        <option value="name">Sort: Name</option>
                    </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: selectedPatient ? '1fr 340px' : '1fr', gap: 20 }}>
                    {/* Table */}
                    <div className="fade-in delay-3 card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>MRN</th>
                                        <th>Patient</th>
                                        <th>Age</th>
                                        <th>Ward / Bed</th>
                                        <th>Diagnosis</th>
                                        <th>Physician</th>
                                        <th>Status</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(p => {
                                        const s = statusMap[p.status] || statusMap.stable;
                                        return (
                                            <tr key={p.mrn} onClick={() => setSelected(selected === p.mrn ? null : p.mrn)}
                                                style={{ cursor: 'pointer', background: selected === p.mrn ? 'rgba(30,58,95,0.05)' : undefined }}>
                                                <td><code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{p.mrn}</code></td>
                                                <td style={{ fontWeight: 600 }}>{p.name}</td>
                                                <td>{p.age}</td>
                                                <td><span style={{ fontSize: 12 }}>{p.ward}</span> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {p.bed}</span></td>
                                                <td style={{ color: 'var(--text-secondary)', maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.dx}</td>
                                                <td>{p.physician}</td>
                                                <td><span className={`badge ${s.badge}`}>{s.label}</span></td>
                                                <td>
                                                    <button className="btn btn-ghost btn-xs" onClick={e => { e.stopPropagation(); setSelected(p.mrn); }}>
                                                        <span className="material-icons-round" style={{ fontSize: 14 }}>edit</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Showing {filtered.length} of {activePatients.length} {showArchived ? 'archived' : 'active'}</span>
                            <div style={{ display: 'flex', gap: 4 }}>
                                {['chevron_left', 'chevron_right'].map(icon => (
                                    <button key={icon} className="btn btn-secondary btn-xs"><span className="material-icons-round" style={{ fontSize: 16 }}>{icon}</span></button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Edit Panel */}
                    {selectedPatient && (
                        <div className="slide-in-right" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {/* Patient Header */}
                            <div className="card" style={{ padding: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <div>
                                        <h3>{selectedPatient.name}</h3>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>MRN: {selectedPatient.mrn} · Age {selectedPatient.age}</div>
                                    </div>
                                    <button className="btn btn-ghost btn-xs" onClick={() => setSelected(null)}>
                                        <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
                                    </button>
                                </div>

                                {/* Editable Fields */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div>
                                        <label className="label">Patient Name</label>
                                        <input className="input" value={selectedPatient.name} onChange={e => updatePatient(selectedPatient.mrn, { name: e.target.value })} style={{ fontSize: 12 }} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                        <div>
                                            <label className="label">Ward</label>
                                            <select className="input" value={selectedPatient.ward} onChange={e => updatePatient(selectedPatient.mrn, { ward: e.target.value })} style={{ fontSize: 12 }}>
                                                {allWards.map(w => <option key={w}>{w}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label">Bed</label>
                                            <select className="input" value={selectedPatient.bed} onChange={e => updatePatient(selectedPatient.mrn, { bed: e.target.value })} style={{ fontSize: 12 }}>
                                                {allBeds.map(b => <option key={b}>{b}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label">Diagnosis</label>
                                        <input className="input" value={selectedPatient.dx} onChange={e => updatePatient(selectedPatient.mrn, { dx: e.target.value })} style={{ fontSize: 12 }} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                        <div>
                                            <label className="label">Status</label>
                                            <select className="input" value={selectedPatient.status} onChange={e => updatePatient(selectedPatient.mrn, { status: e.target.value })} style={{ fontSize: 12 }}>
                                                {['critical', 'monitoring', 'stable', 'discharge-ready'].map(s => <option key={s} value={s}>{statusMap[s]?.label || s}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label">Physician</label>
                                            <select className="input" value={selectedPatient.physician} onChange={e => updatePatient(selectedPatient.mrn, { physician: e.target.value })} style={{ fontSize: 12 }}>
                                                {allStaff.filter(s => s.startsWith('Dr.')).map(s => <option key={s}>{s}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={() => showToast(`${selectedPatient.name} updated`)}>
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>save</span>Save Changes
                                </button>
                            </div>

                            {/* Care Team */}
                            <div className="card" style={{ padding: '16px' }}>
                                <h3 style={{ marginBottom: 10, fontSize: 14 }}>Care Team</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {allStaff.map(staff => {
                                        const isOn = selectedPatient.careTeam.includes(staff);
                                        return (
                                            <div key={staff} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 6, background: isOn ? 'rgba(30,58,95,0.06)' : 'transparent', border: `1px solid ${isOn ? 'rgba(30,58,95,0.2)' : 'var(--border-subtle)'}` }}>
                                                <span style={{ fontSize: 12, fontWeight: isOn ? 600 : 400, color: isOn ? 'var(--text-primary)' : 'var(--text-muted)' }}>{staff}</span>
                                                <button className={`btn btn-xs ${isOn ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => { toggleCareTeam(selectedPatient.mrn, staff); showToast(isOn ? `${staff} removed from care team` : `${staff} added to care team`); }}>
                                                    <span className="material-icons-round" style={{ fontSize: 13 }}>{isOn ? 'remove' : 'add'}</span>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="card" style={{ padding: '16px' }}>
                                <h3 style={{ marginBottom: 10, fontSize: 14 }}>Actions</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {!selectedPatient.archived && selectedPatient.status !== 'discharged' && (
                                        <>
                                            {selectedPatient.status !== 'discharge-ready' ? (
                                                <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => handleMarkDCReady(selectedPatient.mrn)}>
                                                    <span className="material-icons-round" style={{ fontSize: 15 }}>pending_actions</span>Mark D/C Ready
                                                </button>
                                            ) : (
                                                <button className="btn btn-primary btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => handleDischarge(selectedPatient.mrn)}>
                                                    <span className="material-icons-round" style={{ fontSize: 15 }}>logout</span>Discharge Patient
                                                </button>
                                            )}
                                            <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => handleArchive(selectedPatient.mrn)}>
                                                <span className="material-icons-round" style={{ fontSize: 15 }}>archive</span>Archive Patient
                                            </button>
                                            <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => setMergeTarget(mergeTarget ? null : selectedPatient.mrn)}>
                                                <span className="material-icons-round" style={{ fontSize: 15 }}>merge</span>{mergeTarget ? 'Cancel Merge' : 'Merge Records'}
                                            </button>
                                        </>
                                    )}
                                    <button className="btn btn-danger btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => setConfirmDelete(selectedPatient.mrn)}>
                                        <span className="material-icons-round" style={{ fontSize: 15 }}>delete_forever</span>Safe Delete (Admin)
                                    </button>
                                </div>

                                {mergeTarget === selectedPatient.mrn && (
                                    <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--warning-bg)', border: '1px solid rgba(154,123,46,0.2)' }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', marginBottom: 8 }}>Merge into another patient:</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            {patients.filter(p => p.mrn !== selectedPatient.mrn && !p.archived).slice(0, 5).map(p => (
                                                <button key={p.mrn} className="btn btn-ghost btn-xs" style={{ justifyContent: 'flex-start', fontSize: 12 }} onClick={() => handleMerge(selectedPatient.mrn, p.mrn)}>
                                                    <span className="material-icons-round" style={{ fontSize: 13 }}>arrow_forward</span>
                                                    {p.name} ({p.mrn})
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>
            </div>
        </div>
    );
}
