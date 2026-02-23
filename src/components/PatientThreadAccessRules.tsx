'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

const roles = [
    { id: 'admin', label: 'Administrator', color: '#8c5a5e' },
    { id: 'attendant', label: 'Attending Physician', color: '#4a6fa5' },
    { id: 'resident', label: 'Resident', color: '#5a7d8c' },
    { id: 'nurse', label: 'Nurse', color: '#5c8a6e' },
    { id: 'specialist', label: 'Specialist', color: '#8a7d5c' },
];

const departments = ['Emergency', 'ICU', 'Cardiology', 'Pediatrics', 'Radiology', 'Neurology'];

const accessTypes = [
    { id: 'read', label: 'Read Records', desc: 'View patient demographics, history, and notes.' },
    { id: 'write', label: 'Write Notes', desc: 'Add clinical notes and update care plans.' },
    { id: 'medication', label: 'Medication Orders', desc: 'Add, modify, or discontinue medication orders.' },
    { id: 'labs', label: 'Lab Results', desc: 'View and order laboratory tests.' },
    { id: 'imaging', label: 'Imaging & Radiology', desc: 'Request and review imaging studies.' },
    { id: 'billing', label: 'Billing Information', desc: 'Access financial and insurance records.' },
];

const justifications = [
    'Emergency Care Required',
    'On-Call Coverage',
    'Clinical Consultation',
    'Patient Consent Given',
];


export default function PatientThreadAccessRules() {
    const [selectedRole, setSelectedRole] = useState('attendant');
    const [selectedDepts, setSelectedDepts] = useState(['Emergency', 'ICU']);
    const [perms, setPerms] = useState<Record<string, boolean>>({
        read: true, write: true, medication: false, labs: true, imaging: false, billing: false,
    });
    const [breakGlass, setBreakGlass] = useState(false);
    const [supervApproval, setSupervApproval] = useState(true);
    const [careTeamOnly, setCareTeamOnly] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };
    const toggleDept = (d: string) => setSelectedDepts(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
    const currentRole = roles.find(r => r.id === selectedRole);
    const enabledPerms = Object.entries(perms).filter(([, v]) => v).length;

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <Sidebar hospitalName="Korle Bu" sections={navSections} />

            {/* Toast */}
            {toast && (
                <div className="toast-enter" style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '10px 18px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 8, }}>
                    <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--success)' }}>check_circle</span>
                    {toast}
                </div>
            )}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <TopBar
                    title="Access Rules"
                    breadcrumbs={['Admin', 'Security']}
                    actions={
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => showToast(`Preview: ${currentRole?.label} — ${enabledPerms} permissions, ${selectedDepts.length} depts, break-glass ${breakGlass ? 'ON' : 'OFF'}`)}>Preview</button>
                            <button className="btn btn-primary btn-sm" onClick={() => showToast('Access rules saved successfully')}><span className="material-icons-round" style={{ fontSize: 14 }}>save</span>Save Rules</button>
                        </div>
                    }
                />
            <main style={{ flex: 1, overflow: 'auto', padding: '20px 24px', background: 'var(--bg-900)' }}>

                {/* Role Selector Row */}
                <div className="fade-in delay-1" style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                    {roles.map(r => (
                        <button
                            key={r.id}
                            onClick={() => setSelectedRole(r.id)}
                            className="btn btn-sm"
                            style={{
                                border: `1px solid ${selectedRole === r.id ? r.color : 'var(--border-default)'}`,
                                background: selectedRole === r.id ? `${r.color}15` : 'var(--surface-2)',
                                color: selectedRole === r.id ? r.color : 'var(--text-secondary)',
                            }}
                        >
                            <span className="material-icons-round" style={{ fontSize: 14 }}>badge</span>
                            {r.label}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Left: Scope & Permissions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        {/* Applicable Units */}
                        <div className="fade-in delay-2 card">
                            <h3 style={{ marginBottom: 12 }}>Applicable Units</h3>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Select which departments this role rule applies to.</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {departments.map(d => (
                                    <button
                                        key={d}
                                        onClick={() => toggleDept(d)}
                                        className="btn btn-sm"
                                        style={{
                                            border: `1px solid ${selectedDepts.includes(d) ? 'var(--helix-primary)' : 'var(--border-default)'}`,
                                            background: selectedDepts.includes(d) ? 'rgba(30,58,95,0.1)' : 'var(--surface-2)',
                                            color: selectedDepts.includes(d) ? 'var(--helix-primary-light)' : 'var(--text-secondary)',
                                        }}
                                    >
                                        {selectedDepts.includes(d) && <span className="material-icons-round" style={{ fontSize: 13 }}>check</span>}
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Data Visibility Permissions */}
                        <div className="fade-in delay-3 card">
                            <h3 style={{ marginBottom: 14 }}>Data Visibility Permissions</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {accessTypes.map(a => (
                                    <div key={a.id} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px',
                                        borderRadius: 'var(--radius-md)', background: 'var(--surface-2)',
                                        border: `1px solid ${perms[a.id] ? 'rgba(30,58,95,0.2)' : 'var(--border-subtle)'}`,
                                        transition: 'all 0.15s',
                                    }}>
                                        <label className="toggle" style={{ marginTop: 2 }}>
                                            <input type="checkbox" checked={!!perms[a.id]} onChange={() => setPerms(p => ({ ...p, [a.id]: !p[a.id] }))} />
                                            <span className="toggle-slider" />
                                        </label>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 13 }}>{a.label}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{a.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Break-Glass */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <div className="fade-in delay-2 card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <h3>Emergency Override</h3>
                                <label className="toggle">
                                    <input type="checkbox" checked={breakGlass} onChange={() => setBreakGlass(!breakGlass)} />
                                    <span className="toggle-slider" />
                                </label>
                            </div>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                                Configure break-glass protocols and data visibility for emergency situations within the clinical workflow.
                            </p>

                            {breakGlass && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div>
                                        <label className="label">Required Justification Reasons</label>
                                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Users must select one of these reasons to proceed.</p>
                                        {justifications.map(j => (
                                            <label key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer' }}>
                                                <input type="checkbox" className="checkbox" defaultChecked />
                                                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{j}</span>
                                            </label>
                                        ))}
                                    </div>

                                    <div>
                                        <label className="label" htmlFor="override-duration">Auto-Revoke After</label>
                                        <select id="override-duration" className="input">
                                            <option>30 minutes</option>
                                            <option>1 hour</option>
                                            <option>4 hours</option>
                                            <option>Until end of shift</option>
                                        </select>
                                        <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                                            <span className="material-icons-round" style={{ fontSize: 14, color: 'var(--helix-primary-light)' }}>info</span>
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Access will automatically revoke after this period.</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>Require Supervisor Approval</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Before granting any override access</div>
                                        </div>
                                        <label className="toggle">
                                            <input type="checkbox" checked={supervApproval} onChange={() => setSupervApproval(!supervApproval)} />
                                            <span className="toggle-slider" />
                                        </label>
                                    </div>
                                </div>
                            )}

                            {!breakGlass && (
                                <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                                    Enable break-glass to configure emergency override settings.
                                </div>
                            )}
                        </div>

                        {/* Access Scope */}
                        <div className="fade-in delay-3 card">
                            <h3 style={{ marginBottom: 12 }}>Access Scope</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {[
                                    { id: 'unit', label: 'Unit-Based Access', desc: 'Staff can access threads for patients in their assigned unit.', active: !careTeamOnly },
                                    { id: 'careteam', label: 'Care-Team Only', desc: 'Only staff explicitly assigned to the patient\u2019s care team can access the thread.', active: careTeamOnly },
                                ].map(mode => (
                                    <label key={mode.id} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px',
                                        borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.15s',
                                        border: `1px solid ${mode.active ? 'var(--helix-primary)' : 'var(--border-subtle)'}`,
                                        background: mode.active ? 'rgba(30,58,95,0.06)' : 'var(--surface-2)',
                                    }}>
                                        <input type="radio" name="accessScope" checked={mode.active} onChange={() => { setCareTeamOnly(mode.id === 'careteam'); showToast(`Access scope: ${mode.label}`); }} style={{ marginTop: 3, accentColor: 'var(--helix-primary)' }} />
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 13 }}>{mode.label}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{mode.desc}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            {careTeamOnly && (
                                <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6, background: 'var(--info-bg)', border: '1px solid rgba(30,58,95,0.15)', fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <span className="material-icons-round" style={{ fontSize: 14, color: 'var(--helix-primary-light)' }}>info</span>
                                    Care team membership is managed per-patient in the Patient Census page.
                                </div>
                            )}
                        </div>

                        {/* Security Warning */}
                        <div className="fade-in delay-3" style={{
                            padding: '14px 16px',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--warning-bg)',
                            border: '1px solid rgba(154,123,46,0.25)',
                            display: 'flex', gap: 10,
                        }}>
                            <span className="material-icons-round" style={{ fontSize: 20, color: 'var(--warning)', flexShrink: 0, marginTop: 1 }}>security</span>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--warning)' }}>Security Warning</div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>
                                    Enabling break-glass access without supervisor approval may expose sensitive patient data. Ensure audit logs are reviewed daily.
                                </div>
                            </div>
                        </div>

                        {/* Active Rule Sets */}
                        <div className="fade-in delay-4 card">
                            <h3 style={{ marginBottom: 12 }}>Active Rule Sets</h3>
                            {['Admin', 'Security'].map(rs => (
                                <div key={rs} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '9px 12px', borderRadius: 8, background: 'var(--surface-2)',
                                    border: '1px solid var(--border-subtle)', marginBottom: 6,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--helix-primary-light)' }}>policy</span>
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>{rs} Rule Set</span>
                                    </div>
                                    <span className="badge badge-success">Active</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
            </div>
        </div>
    );
}
