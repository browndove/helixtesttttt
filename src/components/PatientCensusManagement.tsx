'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

type Patient = { id: string; mrn: string; name: string; dob: string; gender: string; ward: string; dept: string; status: string; admitted: string };

const initialPatients: Patient[] = [
    { id: 'p1', mrn: 'MRN-88421', name: 'Kwame Mensah', dob: '1978-03-12', gender: 'Male', ward: 'ICU A', dept: 'ICU', status: 'admitted', admitted: '2024-11-10' },
    { id: 'p2', mrn: 'MRN-55102', name: 'Akosua Quaye', dob: '1990-07-25', gender: 'Female', ward: 'Cardiac Ward', dept: 'Cardiology', status: 'admitted', admitted: '2024-11-12' },
    { id: 'p3', mrn: 'MRN-33210', name: 'Yaw Boateng', dob: '1965-01-08', gender: 'Male', ward: 'Emergency Bay A', dept: 'Emergency', status: 'admitted', admitted: '2024-11-14' },
    { id: 'p4', mrn: 'MRN-22781', name: 'Esi Darko', dob: '2002-11-30', gender: 'Female', ward: 'Peds General', dept: 'Pediatrics', status: 'discharged', admitted: '2024-11-08' },
    { id: 'p5', mrn: 'MRN-78654', name: 'Kofi Agyemang', dob: '1955-06-17', gender: 'Male', ward: 'Surgical Suite A', dept: 'Surgery', status: 'admitted', admitted: '2024-11-13' },
    { id: 'p6', mrn: 'MRN-44100', name: 'Abena Tetteh', dob: '1988-09-22', gender: 'Female', ward: 'ICU B', dept: 'ICU', status: 'admitted', admitted: '2024-11-11' },
    { id: 'p7', mrn: 'MRN-66201', name: 'Nana Osei', dob: '1972-04-05', gender: 'Male', ward: 'Neuro ICU', dept: 'ICU', status: 'admitted', admitted: '2024-11-09' },
    { id: 'p8', mrn: 'MRN-91003', name: 'Efua Appiah', dob: '1995-12-14', gender: 'Female', ward: 'Cardiac Ward', dept: 'Cardiology', status: 'discharged', admitted: '2024-11-06' },
    { id: 'p9', mrn: 'MRN-12480', name: 'Kwesi Frimpong', dob: '1983-08-19', gender: 'Male', ward: 'Emergency Bay B', dept: 'Emergency', status: 'admitted', admitted: '2024-11-14' },
    { id: 'p10', mrn: 'MRN-70055', name: 'Adwoa Amoako', dob: '2010-02-28', gender: 'Female', ward: 'NICU', dept: 'Pediatrics', status: 'admitted', admitted: '2024-11-13' },
];

const statusStyle: Record<string, { color: string; bg: string; label: string }> = {
    admitted: { color: 'var(--success)', bg: 'var(--success-bg)', label: 'Admitted' },
    discharged: { color: 'var(--text-muted)', bg: 'var(--surface-2)', label: 'Discharged' },
};

export default function PatientCensusManagement() {
    const [patients, setPatients] = useState(initialPatients);
    const [search, setSearch] = useState('');
    const [deptFilter, setDeptFilter] = useState('all');
    const [toast, setToast] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showBulk, setShowBulk] = useState(false);
    const [newName, setNewName] = useState('');
    const [newMrn, setNewMrn] = useState('');
    const [newDob, setNewDob] = useState('');
    const [newGender, setNewGender] = useState('Male');
    const [newWard, setNewWard] = useState('ICU A');
    const [newDept, setNewDept] = useState('ICU');
    const [dragOver, setDragOver] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const departments = ['all', ...Array.from(new Set(patients.map(p => p.dept)))];

    const filtered = patients.filter(p => {
        const matchSearch = search === '' || p.name.toLowerCase().includes(search.toLowerCase()) || p.mrn.toLowerCase().includes(search.toLowerCase()) || p.ward.toLowerCase().includes(search.toLowerCase());
        const matchDept = deptFilter === 'all' || p.dept === deptFilter;
        return matchSearch && matchDept;
    });

    const handleAdd = () => {
        if (!newName.trim() || !newMrn.trim()) return;
        const patient: Patient = { id: `p-${Date.now()}`, mrn: newMrn, name: newName, dob: newDob || '1990-01-01', gender: newGender, ward: newWard, dept: newDept, status: 'admitted', admitted: new Date().toISOString().split('T')[0] };
        setPatients(prev => [patient, ...prev]);
        showToast(`${newName} added`);
        setNewName(''); setNewMrn(''); setNewDob('');
        setShowAddForm(false);
    };

    const handleRemove = (id: string) => {
        const p = patients.find(x => x.id === id);
        setPatients(prev => prev.filter(x => x.id !== id));
        showToast(`${p?.name} removed`);
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
                    title="Patients"
                    subtitle="Patient Directory"
                    search={{ placeholder: 'Search by name, MRN, or ward...', value: search, onChange: setSearch }}
                    actions={
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setShowBulk(!showBulk); setShowAddForm(false); }}>
                                <span className="material-icons-round" style={{ fontSize: 14 }}>upload_file</span>Bulk Add
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => { setShowAddForm(!showAddForm); setShowBulk(false); }}>
                                <span className="material-icons-round" style={{ fontSize: 14 }}>{showAddForm ? 'close' : 'add'}</span>
                                {showAddForm ? 'Cancel' : 'Add Patient'}
                            </button>
                        </div>
                    }
                />

                <main style={{ flex: 1, overflow: 'auto', padding: '20px 24px', background: 'var(--bg-900)' }}>

                    {/* Add Patient Form */}
                    {showAddForm && (
                        <div className="fade-in card" style={{ marginBottom: 18, padding: '18px 20px' }}>
                            <h3 style={{ fontSize: 14, marginBottom: 12 }}>New Patient</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                                <div><label className="label">Full Name *</label><input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Patient name" style={{ fontSize: 12 }} /></div>
                                <div><label className="label">MRN *</label><input className="input" value={newMrn} onChange={e => setNewMrn(e.target.value)} placeholder="MRN-XXXXX" style={{ fontSize: 12 }} /></div>
                                <div><label className="label">Date of Birth</label><input className="input" type="date" value={newDob} onChange={e => setNewDob(e.target.value)} style={{ fontSize: 12 }} /></div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                                <div><label className="label">Gender</label><select className="input" value={newGender} onChange={e => setNewGender(e.target.value)} style={{ fontSize: 12 }}><option>Male</option><option>Female</option></select></div>
                                <div><label className="label">Department</label><select className="input" value={newDept} onChange={e => setNewDept(e.target.value)} style={{ fontSize: 12 }}>{['ICU', 'Cardiology', 'Emergency', 'Pediatrics', 'Surgery'].map(d => <option key={d}>{d}</option>)}</select></div>
                                <div><label className="label">Ward</label><input className="input" value={newWard} onChange={e => setNewWard(e.target.value)} placeholder="Ward name" style={{ fontSize: 12 }} /></div>
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={!newName.trim() || !newMrn.trim()}>
                                <span className="material-icons-round" style={{ fontSize: 14 }}>person_add</span>Add Patient
                            </button>
                        </div>
                    )}

                    {/* Bulk Upload */}
                    {showBulk && (
                        <div className="fade-in card" style={{ marginBottom: 18, padding: '18px 20px' }}>
                            <h3 style={{ fontSize: 14, marginBottom: 12 }}>Bulk Add Patients</h3>
                            <div
                                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={e => { e.preventDefault(); setDragOver(false); setUploadedFile(e.dataTransfer.files[0]?.name || null); }}
                                onClick={() => setUploadedFile('patients_batch.csv')}
                                style={{ border: `2px dashed ${dragOver ? 'var(--helix-primary)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-lg)', padding: '30px 20px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(30,58,95,0.05)' : 'var(--surface-2)', transition: 'all 0.2s' }}>
                                <div style={{ width: 44, height: 44, background: uploadedFile ? 'var(--success-bg)' : 'rgba(30,58,95,0.1)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                                    <span className="material-icons-round" style={{ fontSize: 22, color: uploadedFile ? 'var(--success)' : 'var(--helix-primary-light)' }}>{uploadedFile ? 'check_circle' : 'cloud_upload'}</span>
                                </div>
                                {uploadedFile ? (
                                    <><div style={{ fontWeight: 600, color: 'var(--success)', fontSize: 13 }}>{uploadedFile}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>File ready for import</div></>
                                ) : (
                                    <><div style={{ fontWeight: 600, fontSize: 13 }}>Click to upload or drag and drop</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>CSV or XLSX (max. 50MB)</div></>
                                )}
                            </div>
                            {uploadedFile && (
                                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                                    <button className="btn btn-primary btn-sm" disabled={processing} onClick={() => {
                                        setProcessing(true);
                                        setTimeout(() => {
                                            setPatients(prev => [
                                                { id: `p-${Date.now()}`, mrn: 'MRN-99001', name: 'Ama Owusu', dob: '1992-05-10', gender: 'Female', ward: 'ICU A', dept: 'ICU', status: 'admitted', admitted: '2024-11-14' },
                                                { id: `p-${Date.now() + 1}`, mrn: 'MRN-99002', name: 'Yaw Adjei', dob: '1980-11-22', gender: 'Male', ward: 'Emergency Bay A', dept: 'Emergency', status: 'admitted', admitted: '2024-11-14' },
                                                ...prev,
                                            ]);
                                            setUploadedFile(null); setProcessing(false); setShowBulk(false);
                                            showToast('Bulk import completed: 2 patients added');
                                        }, 1200);
                                    }}>
                                        <span className="material-icons-round" style={{ fontSize: 14 }}>{processing ? 'hourglass_empty' : 'upload'}</span>{processing ? 'Processing...' : 'Import'}
                                    </button>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setUploadedFile(null)}><span className="material-icons-round" style={{ fontSize: 14 }}>close</span></button>
                                </div>
                            )}
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

                    {/* Patient Table */}
                    <div className="fade-in delay-2 card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>MRN</th>
                                        <th>Name</th>
                                        <th>Gender</th>
                                        <th>Date of Birth</th>
                                        <th>Department</th>
                                        <th>Ward</th>
                                        <th>Admitted</th>
                                        <th>Status</th>
                                        <th style={{ width: 40 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(p => {
                                        const st = statusStyle[p.status] || statusStyle.admitted;
                                        return (
                                            <tr key={p.id}>
                                                <td><code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{p.mrn}</code></td>
                                                <td style={{ fontWeight: 600 }}>{p.name}</td>
                                                <td style={{ color: 'var(--text-secondary)' }}>{p.gender}</td>
                                                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.dob}</td>
                                                <td style={{ color: 'var(--text-secondary)' }}>{p.dept}</td>
                                                <td style={{ color: 'var(--text-secondary)' }}>{p.ward}</td>
                                                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.admitted}</td>
                                                <td><span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                                                <td>
                                                    <button className="btn btn-ghost btn-xs" onClick={() => handleRemove(p.id)}>
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
                            Showing {filtered.length} of {patients.length} patients
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
