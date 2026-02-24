'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

const defaultBatterySettings = {
    enabled: true,
    warningThreshold: 20,
    criticalThreshold: 5,
    notifyUser: true,
    notifyAdmin: true,
    notifyOnCharge: false,
};

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
    const [battery, setBattery] = useState(defaultBatterySettings);
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
                            Configure device battery alerts and how messages should be escalated across departments, floors, and wards.
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                        {/* Left Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            {/* Device Low Battery */}
                            <div className="fade-in delay-1 card">
                                <h3 style={{ marginBottom: 4 }}>Device Low Battery</h3>
                                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 14 }}>Alert staff and admins when a device battery drops below configured thresholds.</p>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 'var(--radius-md)', background: battery.enabled ? 'var(--surface-2)' : 'transparent', border: `1px solid ${battery.enabled ? 'var(--border-default)' : 'var(--border-subtle)'}`, marginBottom: 14 }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>Enable Battery Alerts</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Monitor all registered devices for low battery.</div>
                                    </div>
                                    <label className="toggle">
                                        <input type="checkbox" checked={battery.enabled} onChange={() => { setBattery(prev => ({ ...prev, enabled: !prev.enabled })); showToast(battery.enabled ? 'Battery alerts disabled' : 'Battery alerts enabled'); }} />
                                        <span className="toggle-slider" />
                                    </label>
                                </div>

                                {battery.enabled && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <div>
                                                <label className="label">Warning Threshold</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <input className="input" type="number" value={battery.warningThreshold} min={5} max={50} onChange={e => setBattery(prev => ({ ...prev, warningThreshold: Number(e.target.value) }))} style={{ fontSize: 12, height: 32 }} />
                                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>%</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="label">Critical Threshold</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <input className="input" type="number" value={battery.criticalThreshold} min={1} max={20} onChange={e => setBattery(prev => ({ ...prev, criticalThreshold: Number(e.target.value) }))} style={{ fontSize: 12, height: 32 }} />
                                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>%</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {[
                                                { key: 'notifyUser' as const, label: 'Notify Device User', desc: 'Send an in-app alert to the staff member using the device.' },
                                                { key: 'notifyAdmin' as const, label: 'Notify Admin', desc: 'Send a notification to the hospital admin dashboard.' },
                                                { key: 'notifyOnCharge' as const, label: 'Alert When Charging', desc: 'Send a confirmation when the device is plugged in.' },
                                            ].map(item => (
                                                <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{item.label}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{item.desc}</div>
                                                    </div>
                                                    <label className="toggle">
                                                        <input type="checkbox" checked={battery[item.key]} onChange={() => { setBattery(prev => ({ ...prev, [item.key]: !prev[item.key] })); showToast('Battery setting updated'); }} />
                                                        <span className="toggle-slider" />
                                                    </label>
                                                </div>
                                            ))}
                                        </div>

                                        <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Warning at <strong>{battery.warningThreshold}%</strong>, critical alert at <strong>{battery.criticalThreshold}%</strong></span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            {/* Role Mapping / Routing */}
                            <div className="fade-in delay-1 card">
                                <h3 style={{ marginBottom: 4 }}>Message Routing Rules</h3>
                                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 14 }}>Define how unacknowledged or urgent messages get escalated. Select which dimensions to route by.</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {routingRules.map((rule, i) => (
                                        <div key={rule.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 12px', borderRadius: 'var(--radius-md)', background: rule.enabled ? 'var(--surface-2)' : 'transparent', border: `1px solid ${rule.enabled ? 'var(--border-default)' : 'var(--border-subtle)'}`, opacity: rule.enabled ? 1 : 0.6, transition: 'all 0.2s' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{rule.label}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{rule.desc}</div>
                                            </div>
                                            <label className="toggle">
                                                <input type="checkbox" checked={rule.enabled} onChange={() => {
                                                    const updated = [...routingRules];
                                                    updated[i] = { ...rule, enabled: !rule.enabled };
                                                    setRoutingRules(updated);
                                                    showToast(`${rule.label} ${!rule.enabled ? 'enabled' : 'disabled'}`);
                                                }} />
                                                <span className="toggle-slider" />
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Escalation Ladder */}
                            <div className="fade-in delay-2 card">
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

                            {/* Scope */}
                            <div className="fade-in delay-3 card">
                                <h3 style={{ marginBottom: 4 }}>Apply to Departments</h3>
                                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>Select which departments these escalation rules apply to.</p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {scope.map((dept, i) => (
                                        <button key={dept.id} className={`badge ${dept.enabled ? 'badge-info' : 'badge-neutral'}`} style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                                            onClick={() => {
                                                const updated = [...scope];
                                                updated[i] = { ...dept, enabled: !dept.enabled };
                                                setScope(updated);
                                                showToast(`${dept.label} ${!dept.enabled ? 'added' : 'removed'}`);
                                            }}>
                                            {dept.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
