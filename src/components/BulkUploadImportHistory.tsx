'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

const importHistory = [
    { id: 'IMP-001', file: 'staff_q4_import.csv', type: 'Staff', records: 142, status: 'success', warnings: 2, date: 'Nov 12, 2024 09:14', user: 'Dr. Kwame Asante' },
    { id: 'IMP-002', file: 'patients_oct_batch.xlsx', type: 'Patient', records: 890, status: 'success', warnings: 0, date: 'Oct 28, 2024 14:33', user: 'Admin' },
    { id: 'IMP-003', file: 'staff_roles_v2.csv', type: 'Staff', records: 34, status: 'error', warnings: 0, date: 'Oct 14, 2024 11:02', user: 'Admin' },
    { id: 'IMP-004', file: 'schedules_nov.csv', type: 'Schedule', records: 210, status: 'success', warnings: 5, date: 'Nov 01, 2024 08:45', user: 'Abena Osei' },
];

const previewRows = [
    { id: 'EMP-0841', name: 'Dr. Efua Adjei', role: 'Cardiologist', dept: 'Cardiology', shift: 'Day', status: 'ok' },
    { id: 'EMP-0295', name: 'Nurse Yaw Darko', role: 'Nurse', dept: 'ICU', shift: 'Night', status: 'ok' },
    { id: 'EMP-0512', name: 'Adwoa Tetteh', role: 'Technician', dept: 'Radiology', shift: 'Evening', status: 'warn' },
    { id: 'EMP-0189', name: 'Nana Agyemang', role: 'Nurse Practitioner', dept: 'Emergency', shift: 'Day', status: 'ok' },
];


export default function BulkUploadImportHistory() {
    const [dragOver, setDragOver] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<string | null>(null);
    const [entityType, setEntityType] = useState('staff');
    const [toast, setToast] = useState<string | null>(null);
    const [history, setHistory] = useState(importHistory);
    const [processing, setProcessing] = useState(false);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <Sidebar hospitalSubtitle="Clinical Admin" sections={navSections} footer={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="avatar" style={{ background: 'rgba(30,58,95,0.2)', color: 'var(--helix-primary-light)' }}>KA</div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Kwame Asante</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>System Admin</div>
                    </div>
                </div>
            } />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <TopBar
                    title="Bulk Upload"
                    breadcrumbs={['Admin', 'Data Import']}
                    actions={
                        <a href="#history" className="btn btn-secondary btn-sm">
                            <span className="material-icons-round" style={{ fontSize: 15 }}>history</span>
                            View History
                        </a>
                    }
                />
            <main style={{ flex: 1, overflow: 'auto', padding: '20px 24px', background: 'var(--bg-900)' }}>

                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: 20, marginBottom: 24 }}>
                    {/* Upload Zone */}
                    <div className="fade-in delay-1 card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h2 style={{ fontSize: '1rem' }}>Upload Data File</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <label className="label" style={{ margin: 0 }}>Entity Type:</label>
                                <select className="input" value={entityType} onChange={e => setEntityType(e.target.value)} style={{ width: 'auto', fontSize: 13, padding: '5px 28px 5px 10px' }}>
                                    <option value="staff">Staff</option>
                                    <option value="patient">Patient</option>
                                    <option value="schedule">Schedule</option>
                                </select>
                            </div>
                        </div>

                        <div
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={e => { e.preventDefault(); setDragOver(false); setUploadedFile(e.dataTransfer.files[0]?.name || null); }}
                            onClick={() => setUploadedFile('staff_q4_import.csv')}
                            style={{
                                border: `2px dashed ${dragOver ? 'var(--helix-primary)' : 'var(--border-default)'}`,
                                borderRadius: 'var(--radius-lg)',
                                padding: '40px 20px',
                                textAlign: 'center',
                                cursor: 'pointer',
                                background: dragOver ? 'rgba(30,58,95,0.05)' : 'var(--surface-2)',
                                transition: 'all 0.2s',
                            }}
                        >
                            <div style={{
                                width: 52, height: 52,
                                background: uploadedFile ? 'var(--success-bg)' : 'rgba(30,58,95,0.1)',
                                borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 14px',
                            }}>
                                <span className="material-icons-round" style={{ fontSize: 26, color: uploadedFile ? 'var(--success)' : 'var(--helix-primary-light)' }}>
                                    {uploadedFile ? 'check_circle' : 'cloud_upload'}
                                </span>
                            </div>
                            {uploadedFile ? (
                                <>
                                    <div style={{ fontWeight: 600, color: 'var(--success)' }}>{uploadedFile}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>File ready for import</div>
                                </>
                            ) : (
                                <>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Click to upload or drag and drop</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>CSV, XLSX or XLS (max. 50MB)</div>
                                </>
                            )}
                        </div>

                        {uploadedFile && (
                            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={processing} onClick={() => {
                                    setProcessing(true);
                                    setTimeout(() => {
                                        const newEntry = { id: `IMP-${String(history.length + 1).padStart(3, '0')}`, file: uploadedFile!, type: entityType.charAt(0).toUpperCase() + entityType.slice(1), records: 4, status: 'success', warnings: 1, date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), user: 'Kwame Asante' };
                                        setHistory(prev => [newEntry, ...prev]);
                                        setUploadedFile(null);
                                        setProcessing(false);
                                        showToast(`Import completed: ${newEntry.records} records processed`);
                                    }, 1200);
                                }}>
                                    <span className="material-icons-round" style={{ fontSize: 16 }}>{processing ? 'hourglass_empty' : 'upload'}</span>
                                    {processing ? 'Processing...' : 'Process Import'}
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setUploadedFile(null)}>
                                    <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Templates */}
                    <div className="fade-in delay-2 card">
                        <h3 style={{ marginBottom: 14 }}>Data Templates</h3>
                        {[
                            { icon: 'badge', label: 'Staff Template', desc: 'ID, Name, Role, Dept, Shift', color: '#4a6fa5' },
                            { icon: 'person', label: 'Patient Template', desc: 'Standard demographics format', color: '#5a7d8c' },
                            { icon: 'calendar_month', label: 'Schedule Template', desc: 'Shifts, assignments, rotations', color: '#5c8a6e' },
                        ].map(t => (
                            <div key={t.label} style={{
                                display: 'flex', alignItems: 'center', gap: 12, padding: '12px',
                                borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                                marginBottom: 8, cursor: 'pointer', transition: 'border-color 0.15s',
                                background: 'var(--surface-2)',
                            }}>
                                <div style={{ width: 36, height: 36, borderRadius: 9, background: `${t.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span className="material-icons-round" style={{ fontSize: 18, color: t.color }}>{t.icon}</span>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.label}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.desc}</div>
                                </div>
                                <button className="btn btn-ghost btn-xs" onClick={() => showToast(`${t.label} downloaded`)}>
                                    <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--text-muted)' }}>download</span>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Validation Preview */}
                {uploadedFile && (
                    <div className="fade-in delay-2 card" style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <div>
                                <h3>Validation Preview</h3>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Showing 1-4 of 4 records</div>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <span className="badge badge-success">4 Valid</span>
                                <span className="badge badge-warning">2 Warnings</span>
                            </div>
                        </div>
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Employee ID</th>
                                        <th>Name</th>
                                        <th>Role</th>
                                        <th>Department</th>
                                        <th>Shift</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewRows.map(r => (
                                        <tr key={r.id}>
                                            <td><code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{r.id}</code></td>
                                            <td>{r.name}</td>
                                            <td style={{ color: 'var(--text-secondary)' }}>{r.role}</td>
                                            <td style={{ color: 'var(--text-secondary)' }}>{r.dept}</td>
                                            <td style={{ color: 'var(--text-secondary)' }}>{r.shift}</td>
                                            <td>
                                                {r.status === 'ok'
                                                    ? <span className="badge badge-success">Valid</span>
                                                    : <span className="badge badge-warning">Warning</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Import History */}
                <div id="history" className="fade-in delay-3 card">
                    <h3 style={{ marginBottom: 14 }}>Import History</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {history.map(h => (
                            <div key={h.id} style={{
                                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
                                borderRadius: 'var(--radius-md)', background: 'var(--surface-2)',
                                border: '1px solid var(--border-subtle)',
                            }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                                    background: h.status === 'success' ? 'var(--success-bg)' : 'var(--error-bg)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <span className="material-icons-round" style={{ fontSize: 18, color: h.status === 'success' ? 'var(--success)' : 'var(--error)' }}>
                                        {h.status === 'success' ? 'check_circle' : 'error'}
                                    </span>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{h.file}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                                        {h.records} records · {h.type} · {h.date} · {h.user}
                                    </div>
                                </div>
                                {h.warnings > 0 && <span className="badge badge-warning">{h.warnings} warnings</span>}
                                <button className="btn btn-ghost btn-xs" onClick={() => showToast(`${h.file}: ${h.records} records, ${h.warnings} warnings`)}>Details</button>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
            </div>
        </div>
    );
}
