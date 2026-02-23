'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

const alertTypes = [
    { id: 'sepsis', icon: 'biotech', label: 'Sepsis Protocol', color: '#8c5a5e', active: true },
    { id: 'code-blue', icon: 'monitor_heart', label: 'Code Blue', color: '#4a6fa5', active: false },
    { id: 'fall', icon: 'elderly', label: 'Fall Risk', color: '#8a7d5c', active: false },
    { id: 'med', icon: 'medication', label: 'Medication Due', color: '#5c8a6e', active: false },
    { id: 'battery', icon: 'battery_alert', label: 'Device Low Battery', color: '#94a3b8', active: false },
    { id: 'role-map', icon: 'group', label: 'Role Mapping', color: '#5a7d8c', active: false },
    { id: 'shift', icon: 'schedule', label: 'Shift Schedules', color: '#7a6b8c', active: false },
];


const channels = [
    { id: 'push', icon: 'phone_android', label: 'Push Notification', enabled: true },
    { id: 'sms', icon: 'sms', label: 'SMS Alert', enabled: true },
    { id: 'pager', icon: 'pager', label: 'Pager', enabled: false },
    { id: 'email', icon: 'mail', label: 'Email', enabled: false },
    { id: 'overhead', icon: 'volume_up', label: 'Overhead PA', enabled: true },
];

const allDepts = ['Emergency Dept', 'ICU', 'Trauma Center', 'Cardiology', 'Neurology', 'Pediatrics', 'Surgery', 'Radiology'];

export default function EscalationAlertSettings() {
    const [active, setActive] = useState('sepsis');
    const [depts, setDepts] = useState(['Emergency Dept', 'ICU', 'Trauma Center']);
    const [ch, setCh] = useState(channels);
    const [timeout, setTimeout_] = useState('5');
    const [toast, setToast] = useState<string | null>(null);
    const [steps, setSteps] = useState([
        { step: 'Primary Responder', desc: 'Initial notification sent immediately', delay: '0 min', icon: 'person' },
        { step: 'Escalation Manager', desc: 'Notify unit supervisor', delay: '5 min', icon: 'supervisor_account' },
        { step: 'Department Head', desc: 'Escalate to department lead', delay: '10 min', icon: 'manage_accounts' },
    ]);
    const [showAddDept, setShowAddDept] = useState(false);
    const [triggerRules, setTriggerRules] = useState([
        { id: 'unack-msg', icon: 'mark_chat_unread', label: 'Unacknowledged Message', desc: 'Escalate when a critical message goes unread past the threshold.', color: 'var(--critical)', enabled: true, threshold: '5', thresholdLabel: 'After' },
        { id: 'coverage-gap', icon: 'person_off', label: 'Coverage Gap Detected', desc: 'Fire when a required role has no one signed in during a scheduled shift.', color: 'var(--warning)', enabled: true, threshold: '3', thresholdLabel: 'Grace period' },
        { id: 'patient-status', icon: 'emergency', label: 'Patient Status Change', desc: 'Trigger when a patient is marked critical, code blue, or rapid response.', color: '#8c5a5e', enabled: true, threshold: undefined, thresholdLabel: undefined },
        { id: 'handoff-overdue', icon: 'swap_horiz', label: 'Overdue Shift Handoff', desc: 'Alert when a shift handoff has not been completed past the expected time.', color: 'var(--info)', enabled: false, threshold: '15', thresholdLabel: 'Overdue by' },
        { id: 'manual', icon: 'touch_app', label: 'Manual Staff Trigger', desc: 'Allow any staff member to manually activate this escalation protocol.', color: 'var(--helix-accent)', enabled: true, threshold: undefined, thresholdLabel: undefined },
    ]);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };
    const currentAlert = alertTypes.find(a => a.id === active)!;
    const availableDepts = allDepts.filter(d => !depts.includes(d));

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <Sidebar hospitalName="Korle Bu" hospitalSubtitle="Teaching Hospital" sections={navSections} />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <TopBar
                    title="Escalation Settings"
                    breadcrumbs={['Configuration', 'Protocols']}
                    actions={
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => showToast(`Preview: ${currentAlert.label} protocol with ${steps.length} steps, ${depts.length} departments`)}>Preview</button>
                            <button className="btn btn-primary btn-sm" onClick={() => showToast('Protocol saved successfully')}><span className="material-icons-round" style={{ fontSize: 14 }}>save</span>Save Protocol</button>
                        </div>
                    }
                />
            <main style={{ flex: 1, overflow: 'auto', padding: '20px 24px', background: 'var(--bg-900)' }}>

                {/* Protocol Selector */}
                {/* Toast */}
                {toast && (
                    <div className="toast-enter" style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '10px 18px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 8, }}>
                        <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--success)' }}>check_circle</span>
                        {toast}
                    </div>
                )}

                <div className="fade-in delay-1" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                    {alertTypes.map(a => (
                        <button
                            key={a.id}
                            onClick={() => setActive(a.id)}
                            className="btn btn-secondary btn-sm"
                            style={{
                                border: `1px solid ${active === a.id ? a.color : 'var(--border-default)'}`,
                                background: active === a.id ? `${a.color}15` : 'var(--surface-2)',
                                color: active === a.id ? a.color : 'var(--text-secondary)',
                            }}
                        >
                            <span className="material-icons-round" style={{ fontSize: 15 }}>{a.icon}</span>
                            {a.label}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Left Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        {/* Alert Trigger Rules */}
                        <div className="fade-in delay-2 card">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ width: 22, height: 22, background: 'var(--info-bg)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>1</span>
                                Alert Trigger Rules
                            </h3>
                            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 14 }}>Define when this protocol should fire. Enable the conditions that apply.</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {triggerRules.map((rule, i) => (
                                    <div key={rule.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 12px', borderRadius: 'var(--radius-md)', background: rule.enabled ? 'var(--surface-2)' : 'transparent', border: `1px solid ${rule.enabled ? 'var(--border-default)' : 'var(--border-subtle)'}`, opacity: rule.enabled ? 1 : 0.6, transition: 'all 0.2s' }}>
                                        <label className="toggle" style={{ marginTop: 2 }}>
                                            <input type="checkbox" checked={rule.enabled} onChange={() => {
                                                const updated = [...triggerRules];
                                                updated[i] = { ...rule, enabled: !rule.enabled };
                                                setTriggerRules(updated);
                                                showToast(`${rule.label} ${!rule.enabled ? 'enabled' : 'disabled'}`);
                                            }} />
                                            <span className="toggle-slider" />
                                        </label>
                                        <span className="material-icons-round" style={{ fontSize: 18, color: rule.enabled ? rule.color : 'var(--text-disabled)', marginTop: 1 }}>{rule.icon}</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: 13, color: rule.enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>{rule.label}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{rule.desc}</div>
                                            {rule.enabled && rule.threshold && (
                                                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{rule.thresholdLabel}</span>
                                                    <input className="input" type="number" defaultValue={rule.threshold} min={1} max={120} style={{ width: 64, fontSize: 12, padding: '4px 8px', height: 28 }} />
                                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>min</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: 14 }}>
                                <label className="label">Apply to Departments</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {depts.map(d => (
                                        <span key={d} className="badge badge-info" style={{ cursor: 'pointer' }} onClick={() => { setDepts(prev => prev.filter(x => x !== d)); showToast(`${d} removed`); }}>
                                            {d}
                                            <span className="material-icons-round" style={{ fontSize: 11 }}>close</span>
                                        </span>
                                    ))}
                                    {showAddDept && availableDepts.length > 0 ? (
                                        <select className="input" style={{ fontSize: 11, padding: '2px 6px', width: 'auto' }} onChange={e => { if (e.target.value) { setDepts(prev => [...prev, e.target.value]); setShowAddDept(false); showToast(`${e.target.value} added`); } }} defaultValue="">
                                            <option value="" disabled>Select...</option>
                                            {availableDepts.map(d => <option key={d}>{d}</option>)}
                                        </select>
                                    ) : (
                                        <button className="badge badge-neutral" style={{ cursor: 'pointer' }} onClick={() => setShowAddDept(true)}><span className="material-icons-round" style={{ fontSize: 11 }}>add</span>Add</button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Escalation Steps */}
                        <div className="fade-in delay-3 card">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                <span style={{ width: 22, height: 22, background: 'var(--info-bg)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>2</span>
                                Escalation Steps
                            </h3>
                            {steps.map((step, i) => {
                                const stepColors = [currentAlert.color, 'var(--warning)', '#8c5a5e', '#7a6b8c', '#5c8a6e'];
                                const color = stepColors[i % stepColors.length];
                                return (
                                    <div key={step.step} style={{
                                        display: 'flex', gap: 12, padding: '12px',
                                        borderRadius: 'var(--radius-md)', background: 'var(--surface-2)',
                                        border: '1px solid var(--border-subtle)', marginBottom: 8,
                                    }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <span className="material-icons-round" style={{ fontSize: 16, color }}>{step.icon}</span>
                                            </div>
                                            {i < steps.length - 1 && <div style={{ width: 1, height: 16, background: 'var(--border-default)' }} />}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{step.step}</div>
                                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                                    <span className="badge badge-neutral" style={{ fontSize: 10 }}>+{step.delay}</span>
                                                    {steps.length > 1 && (
                                                        <button className="btn btn-ghost btn-xs" onClick={() => { setSteps(prev => prev.filter((_, j) => j !== i)); showToast(`${step.step} removed`); }}>
                                                            <span className="material-icons-round" style={{ fontSize: 12, color: 'var(--critical)' }}>close</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{step.desc}</div>
                                        </div>
                                    </div>
                                );
                            })}
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--helix-primary-light)' }} onClick={() => {
                                const delay = `${steps.length * 5} min`;
                                setSteps(prev => [...prev, { step: `Level ${prev.length + 1} Responder`, desc: 'Additional escalation level', delay, icon: 'group' }]);
                                showToast('Escalation step added');
                            }}>
                                <span className="material-icons-round" style={{ fontSize: 16 }}>add</span>
                                Add Escalation Step
                            </button>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        {/* Delivery Channels */}
                        <div className="fade-in delay-2 card">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                <span style={{ width: 22, height: 22, background: 'var(--info-bg)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>3</span>
                                Delivery Channels
                            </h3>
                            {ch.map((c, i) => (
                                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < ch.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                                    <span className="material-icons-round" style={{ fontSize: 18, color: c.enabled ? 'var(--helix-primary-light)' : 'var(--text-muted)' }}>{c.icon}</span>
                                    <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text-secondary)' }}>{c.label}</span>
                                    <label className="toggle">
                                        <input type="checkbox" checked={c.enabled} onChange={() => {
                                            const updated = [...ch];
                                            updated[i] = { ...c, enabled: !c.enabled };
                                            setCh(updated);
                                        }} />
                                        <span className="toggle-slider" />
                                    </label>
                                </div>
                            ))}
                        </div>

                        {/* Timeout Config */}
                        <div className="fade-in delay-3 card">
                            <h3 style={{ marginBottom: 14 }}>Acknowledgement Timeout</h3>
                            <div style={{ marginBottom: 14 }}>
                                <label className="label" htmlFor="ack-timeout">Auto-escalate after (minutes)</label>
                                <input id="ack-timeout" className="input" type="number" value={timeout} onChange={e => setTimeout_(e.target.value)} min={1} max={60} />
                            </div>
                            <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--info-bg)', border: '1px solid rgba(30,58,95,0.15)', display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--helix-primary-light)' }}>info</span>
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Access will automatically escalate after {timeout} minute{parseInt(timeout) !== 1 ? 's' : ''} without acknowledgement.</span>
                            </div>
                        </div>

                        {/* Fallback Rules */}
                        <div className="fade-in delay-3 card">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                <span style={{ width: 22, height: 22, background: 'var(--warning-bg)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--warning)' }}>!</span>
                                Fallback Rules
                            </h3>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>What happens when nobody is signed into the required role.</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {[
                                    { id: 'broadcast-pool', label: 'Broadcast to Role Pool', desc: 'Alert all eligible staff assigned to this role.', icon: 'campaign', defaultChecked: true },
                                    { id: 'notify-admin', label: 'Notify Unit Admin', desc: 'Send urgent notification to the unit administrator.', icon: 'admin_panel_settings', defaultChecked: true },
                                    { id: 'page-oncall', label: 'Page On-Call Supervisor', desc: 'Escalate to the on-call supervisor via pager/SMS.', icon: 'pager', defaultChecked: false },
                                    { id: 'auto-assign', label: 'Auto-Assign Next Available', desc: 'Automatically assign the next available staff from the pool.', icon: 'auto_fix_high', defaultChecked: false },
                                ].map(fb => (
                                    <div key={fb.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                        <label className="toggle" style={{ marginTop: 2 }}>
                                            <input type="checkbox" defaultChecked={fb.defaultChecked} onChange={() => showToast(`Fallback rule updated`)} />
                                            <span className="toggle-slider" />
                                        </label>
                                        <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--text-muted)', marginTop: 1 }}>{fb.icon}</span>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 13 }}>{fb.label}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{fb.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: 12 }}>
                                <label className="label">Fallback Trigger Delay</label>
                                <select className="input" defaultValue="5" style={{ fontSize: 12 }}>
                                    <option value="0">Immediately (0 min)</option>
                                    <option value="2">After 2 minutes</option>
                                    <option value="5">After 5 minutes</option>
                                    <option value="10">After 10 minutes</option>
                                </select>
                                <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 6, background: 'var(--warning-bg)', border: '1px solid rgba(154,123,46,0.2)', fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <span className="material-icons-round" style={{ fontSize: 14, color: 'var(--warning)' }}>info</span>
                                    Fallback activates if no one signs into the role within this window after a shift starts.
                                </div>
                            </div>
                        </div>

                        {/* Version Info */}
                        <div className="fade-in delay-4 card" style={{ padding: '14px 18px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Configuration</div>
                                    <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--helix-primary-light)' }}>CFG-9921-X</code>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Last modified</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Oct 24, 2023 14:30</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>by Dr. Ama Mensah</div>
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
