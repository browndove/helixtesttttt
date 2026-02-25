'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

const defaultRoutingRules = [
    { id: 'by-dept', label: 'By Department', desc: 'Messages are escalated to staff within the same department.', enabled: true },
    { id: 'by-floor', label: 'By Floor', desc: 'Messages are escalated to the nearest available staff on the same floor.', enabled: false },
    { id: 'by-ward', label: 'By Ward / Unit', desc: 'Messages are routed to staff assigned to the same ward or unit.', enabled: true },
    { id: 'by-role', label: 'By Role Hierarchy', desc: 'Messages escalate up the role hierarchy (e.g. Nurse → Charge Nurse → Attending).', enabled: true },
];

const escalationLevels = [
    { level: 1, target: 'Same Role', desc: 'Route to another staff member with the same role in the unit.', delay: '0 min' },
    { level: 2, target: 'Supervisor', desc: 'Escalate to the unit supervisor or charge nurse.', delay: '3 min' },
    { level: 3, target: 'Department Head', desc: 'Notify the department head or attending physician.', delay: '7 min' },
    { level: 4, target: 'Admin / On-Call', desc: 'Final escalation to hospital admin or on-call lead.', delay: '12 min' },
];

const scopeOptions = [
    { id: 'emergency', label: 'Emergency Dept', enabled: true },
    { id: 'icu', label: 'ICU', enabled: true },
    { id: 'cardiology', label: 'Cardiology', enabled: false },
    { id: 'pediatrics', label: 'Pediatrics', enabled: false },
    { id: 'surgery', label: 'Surgery', enabled: true },
    { id: 'neurology', label: 'Neurology', enabled: false },
    { id: 'radiology', label: 'Radiology', enabled: false },
];

export default function EscalationAlertSettings() {
    const [routingRules, setRoutingRules] = useState(defaultRoutingRules);
    const [scope, setScope] = useState(scopeOptions);
    const [toast, setToast] = useState<string | null>(null);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

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
                    title="Escalation Config"
                    subtitle="Device Alerts & Message Routing"
                    actions={
                        <button className="btn btn-primary btn-sm" onClick={() => showToast('Escalation settings saved')}>
                            <span className="material-icons-round" style={{ fontSize: 14 }}>save</span>Save Changes
                        </button>
                    }
                />
                <main style={{ flex: 1, overflow: 'auto', padding: '20px 24px', background: 'var(--bg-900)' }}>
                    <div className="fade-in" style={{ marginBottom: 20 }}>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 600 }}>
                            Configure how messages should be escalated across departments, floors, and wards.
                            <br /><span style={{ color: 'var(--text-secondary)' }}><strong>Note:</strong> Escalation rules are only applicable to Critical (Mandatory) roles.</span>
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            {/* Escalation Ladder */}
                            <div className="fade-in delay-1 card">
                                <h3 style={{ marginBottom: 4 }}>Escalation Ladder</h3>
                                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 14 }}>When a message goes unacknowledged, it escalates through these levels.</p>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '6px 10px', borderBottom: '1px solid var(--border-default)' }}>Level</th>
                                            <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '6px 10px', borderBottom: '1px solid var(--border-default)' }}>Target</th>
                                            <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '6px 10px', borderBottom: '1px solid var(--border-default)' }}>Delay</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {escalationLevels.map(lvl => (
                                            <tr key={lvl.level}>
                                                <td style={{ padding: '10px', fontSize: 13, fontWeight: 600, borderBottom: '1px solid var(--border-subtle)' }}>{lvl.level}</td>
                                                <td style={{ padding: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
                                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{lvl.target}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{lvl.desc}</div>
                                                </td>
                                                <td style={{ padding: '10px', fontSize: 12, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>+{lvl.delay}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                </main>
            </div>
        </div>
    );
}
