'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

type AuditEntry = {
    id: string;
    timestamp: string;
    user: string;
    action: string;
    category: string;
    target: string;
    detail: string;
    ip: string;
    severity: 'info' | 'warning' | 'critical';
};

const auditData: AuditEntry[] = [
    { id: 'AUD-001', timestamp: '2024-11-14 08:12:03', user: 'Dr. Ama Mensah', action: 'Patient Discharged', category: 'patient', target: 'MRN 88421 — Mensah, Kwame', detail: 'Status changed from discharge-ready to discharged', ip: '10.0.12.44', severity: 'info' },
    { id: 'AUD-002', timestamp: '2024-11-14 07:58:21', user: 'Admin (Kwame Asante)', action: 'Break-Glass Access', category: 'access', target: 'Patient Thread — MRN 55102', detail: 'Emergency override: reason "Cardiac arrest response"', ip: '10.0.12.10', severity: 'critical' },
    { id: 'AUD-003', timestamp: '2024-11-14 07:45:10', user: 'System', action: 'Escalation Triggered', category: 'escalation', target: 'Sepsis Protocol — ICU B', detail: 'No acknowledgement after 5 min. Escalated to Dr. Frimpong.', ip: '—', severity: 'warning' },
    { id: 'AUD-004', timestamp: '2024-11-14 07:30:44', user: 'Dr. Kwame Asante', action: 'Role Assignment Changed', category: 'role', target: 'Trauma Surgeon role', detail: 'Assigned Nurse Kofi Boateng to role pool', ip: '10.0.12.10', severity: 'info' },
    { id: 'AUD-005', timestamp: '2024-11-14 07:22:18', user: 'Admin (Kwame Asante)', action: 'Staff Deactivated', category: 'staff', target: 'Nana Agyemang (EMP-13574)', detail: 'Account set to on-leave status', ip: '10.0.12.10', severity: 'warning' },
    { id: 'AUD-006', timestamp: '2024-11-14 07:15:02', user: 'Dr. Efua Adjei', action: 'Patient Record Merged', category: 'patient', target: 'MRN 33210 → MRN 22781', detail: 'Care teams combined. Source record deleted.', ip: '10.0.12.55', severity: 'critical' },
    { id: 'AUD-007', timestamp: '2024-11-14 06:50:33', user: 'System', action: 'Coverage Gap Detected', category: 'coverage', target: 'Surgical Suite B', detail: '2 vacant roles: Lead Surgeon, Anesthesiologist', ip: '—', severity: 'warning' },
    { id: 'AUD-008', timestamp: '2024-11-14 06:44:11', user: 'Admin (Kwame Asante)', action: 'Bulk Import Completed', category: 'import', target: 'staff_q4_import.csv', detail: '142 records imported, 2 warnings', ip: '10.0.12.10', severity: 'info' },
    { id: 'AUD-009', timestamp: '2024-11-14 06:30:00', user: 'Dr. Akosua Frimpong', action: 'Force Sign-Out', category: 'coverage', target: 'Yaw Darko — ICU', detail: 'Admin override: signed out from Respiratory Therapist role', ip: '10.0.12.22', severity: 'warning' },
    { id: 'AUD-010', timestamp: '2024-11-14 06:12:45', user: 'Admin (Kwame Asante)', action: 'Patient Record Deleted', category: 'patient', target: 'MRN 44100 — Test Patient', detail: 'Permanent deletion (admin-only). Reason: duplicate test record.', ip: '10.0.12.10', severity: 'critical' },
    { id: 'AUD-011', timestamp: '2024-11-13 22:05:18', user: 'Nurse Abena Osei', action: 'Care Team Updated', category: 'patient', target: 'MRN 88421 — Mensah, Kwame', detail: 'Added Nurse Darko to care team', ip: '10.0.12.38', severity: 'info' },
    { id: 'AUD-012', timestamp: '2024-11-13 21:30:00', user: 'System', action: 'Shift Change', category: 'coverage', target: 'All Units', detail: 'Night shift rotation initiated. 14 staff signed in.', ip: '—', severity: 'info' },
    { id: 'AUD-013', timestamp: '2024-11-13 18:22:09', user: 'Dr. Kwesi Owusu', action: 'Access Rule Modified', category: 'access', target: 'Resident role — Pediatrics', detail: 'Added "Edit Care Plans" permission', ip: '10.0.12.61', severity: 'info' },
    { id: 'AUD-014', timestamp: '2024-11-13 16:10:33', user: 'Admin (Kwame Asante)', action: 'Ward Created', category: 'config', target: 'Neuro B — Floor 3', detail: 'New ward added with 8 beds', ip: '10.0.12.10', severity: 'info' },
    { id: 'AUD-015', timestamp: '2024-11-13 14:55:00', user: 'Dr. Ama Mensah', action: 'Patient Admitted', category: 'patient', target: 'MRN 78654 — Quaye, Akosua', detail: 'Admitted to Gen A, Bed 4. Dx: Diabetic Ketoacidosis', ip: '10.0.12.44', severity: 'info' },
];

const categories = [
    { id: 'all', label: 'All Events' },
    { id: 'patient', label: 'Patient' },
    { id: 'access', label: 'Access' },
    { id: 'coverage', label: 'Coverage' },
    { id: 'staff', label: 'Staff' },
    { id: 'role', label: 'Roles' },
    { id: 'escalation', label: 'Escalation' },
    { id: 'import', label: 'Import' },
    { id: 'config', label: 'Config' },
];

const severityStyle: Record<string, { color: string; bg: string; icon: string; badge: string }> = {
    info: { color: 'var(--helix-accent)', bg: '#edf1f7', icon: 'info', badge: 'badge-info' },
    warning: { color: 'var(--warning)', bg: 'var(--warning-bg)', icon: 'warning', badge: 'badge-warning' },
    critical: { color: 'var(--critical)', bg: 'var(--critical-bg)', icon: 'error', badge: 'badge-critical' },
};

export default function AuditLog() {
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [severityFilter, setSeverityFilter] = useState<'all' | 'info' | 'warning' | 'critical'>('all');
    const [selected, setSelected] = useState<AuditEntry | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const filtered = auditData.filter(e => {
        const matchSearch = search === '' ||
            e.action.toLowerCase().includes(search.toLowerCase()) ||
            e.user.toLowerCase().includes(search.toLowerCase()) ||
            e.target.toLowerCase().includes(search.toLowerCase()) ||
            e.id.toLowerCase().includes(search.toLowerCase());
        const matchCat = category === 'all' || e.category === category;
        const matchSev = severityFilter === 'all' || e.severity === severityFilter;
        return matchSearch && matchCat && matchSev;
    });

    const criticalCount = auditData.filter(e => e.severity === 'critical').length;
    const warningCount = auditData.filter(e => e.severity === 'warning').length;
    const todayCount = auditData.filter(e => e.timestamp.startsWith('2024-11-14')).length;

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <Sidebar hospitalName="Korle Bu" sections={navSections} />

            {toast && (
                <div className="toast-enter" style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '10px 18px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 8, }}>
                    <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--success)' }}>check_circle</span>
                    {toast}
                </div>
            )}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <TopBar
                    title="Audit Log"
                    breadcrumbs={['Admin', 'Compliance']}
                    search={{ placeholder: 'Search events, users, targets...', value: search, onChange: setSearch }}
                    actions={
                        <button className="btn btn-secondary btn-sm" onClick={() => showToast('Audit log exported as CSV')}>
                            <span className="material-icons-round" style={{ fontSize: 15 }}>download</span>Export
                        </button>
                    }
                />

                <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>

                    {/* Stat Cards */}
                    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                        <div className="card" style={{ padding: '18px 20px' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Total Events</div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>{auditData.length}</div>
                        </div>
                        <div className="card" style={{ padding: '18px 20px' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Today</div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>{todayCount}</div>
                        </div>
                        <div className="card" style={{ padding: '18px 20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Critical</div>
                                {criticalCount > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: '#8c5a5e', background: '#fdf2f2', padding: '1px 7px', borderRadius: 10 }}>Review</span>}
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>{criticalCount}</div>
                        </div>
                        <div className="card" style={{ padding: '18px 20px' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Warnings</div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>{warningCount}</div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="fade-in delay-1" style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                            {categories.map(c => (
                                <button key={c.id} className="btn btn-secondary btn-xs" onClick={() => setCategory(c.id)}
                                    style={{
                                        background: category === c.id ? '#edf1f7' : undefined,
                                        borderColor: category === c.id ? 'var(--helix-primary)' : undefined,
                                        color: category === c.id ? 'var(--helix-primary)' : undefined,
                                        fontWeight: category === c.id ? 600 : 400,
                                    }}>
                                    {c.label}
                                </button>
                            ))}
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
                            {(['all', 'info', 'warning', 'critical'] as const).map(s => (
                                <button key={s} className="btn btn-secondary btn-xs" onClick={() => setSeverityFilter(s)}
                                    style={{
                                        background: severityFilter === s ? '#edf1f7' : undefined,
                                        borderColor: severityFilter === s ? 'var(--helix-primary)' : undefined,
                                        color: severityFilter === s ? 'var(--helix-primary)' : undefined,
                                        fontWeight: severityFilter === s ? 600 : 400,
                                    }}>
                                    {s === 'all' ? 'All Severity' : s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Table + Detail */}
                    <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>
                        <div className="fade-in delay-2 card" style={{ padding: 0, overflow: 'hidden' }}>
                            <div className="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ width: 40 }}></th>
                                            <th>Timestamp</th>
                                            <th>User</th>
                                            <th>Action</th>
                                            <th>Target</th>
                                            <th>Severity</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(e => {
                                            const sev = severityStyle[e.severity];
                                            return (
                                                <tr key={e.id} onClick={() => setSelected(selected?.id === e.id ? null : e)}
                                                    style={{ cursor: 'pointer', background: selected?.id === e.id ? 'rgba(30,58,95,0.05)' : undefined }}>
                                                    <td>
                                                        <div style={{ width: 28, height: 28, borderRadius: 7, background: sev.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <span className="material-icons-round" style={{ fontSize: 15, color: sev.color }}>{sev.icon}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)' }}>{e.timestamp}</div>
                                                    </td>
                                                    <td style={{ fontWeight: 600 }}>{e.user}</td>
                                                    <td>{e.action}</td>
                                                    <td style={{ color: 'var(--text-secondary)', maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.target}</td>
                                                    <td><span className={`badge ${sev.badge}`}>{e.severity}</span></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)' }}>
                                Showing {filtered.length} of {auditData.length} events
                            </div>
                        </div>

                        {/* Detail Panel */}
                        {selected && (
                            <div className="slide-in-right" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div className="card" style={{ padding: '18px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                                        <div>
                                            <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', marginBottom: 4 }}>{selected.id}</div>
                                            <h3 style={{ fontSize: 15 }}>{selected.action}</h3>
                                        </div>
                                        <button className="btn btn-ghost btn-xs" onClick={() => setSelected(null)}>
                                            <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {[
                                            { label: 'Timestamp', value: selected.timestamp, icon: 'schedule' },
                                            { label: 'User', value: selected.user, icon: 'person' },
                                            { label: 'Target', value: selected.target, icon: 'gps_fixed' },
                                            { label: 'Category', value: selected.category.charAt(0).toUpperCase() + selected.category.slice(1), icon: 'label' },
                                            { label: 'IP Address', value: selected.ip, icon: 'lan' },
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
                                    <h3 style={{ fontSize: 14, marginBottom: 10 }}>Detail</h3>
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{selected.detail}</p>
                                    <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                                        <span className={`badge ${severityStyle[selected.severity].badge}`}>{selected.severity}</span>
                                    </div>
                                </div>

                                <div className="card" style={{ padding: '18px' }}>
                                    <h3 style={{ fontSize: 14, marginBottom: 10 }}>Actions</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => showToast('Event flagged for review')}>
                                            <span className="material-icons-round" style={{ fontSize: 15 }}>flag</span>Flag for Review
                                        </button>
                                        <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => showToast('Event exported')}>
                                            <span className="material-icons-round" style={{ fontSize: 15 }}>download</span>Export Event
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
