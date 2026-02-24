'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

type StaffMember = { name: string; role: string; status: 'online' | 'away' | 'offline' | 'vacant'; urgency?: 'Urgent' | 'Standard' };
type Unit = { name: string; staff: StaffMember[] };

function calcUnit(u: Unit) {
    const total = u.staff.length;
    const vacancies = u.staff.filter(m => m.status === 'vacant').length;
    const coverage = total > 0 ? Math.round(((total - vacancies) / total) * 100) : 100;
    const tag = vacancies === 0 ? 'full' : vacancies >= 2 ? 'critical' : 'gap';
    return { ...u, coverage, vacancies, tag };
}

const initialUnits: Unit[] = [
    {
        name: 'Emergency Dept - North',
        staff: [
            { name: 'Abena Osei (RN)', role: 'Triage Nurse', status: 'online' },
            { name: 'VACANT', role: 'Trauma Surgeon', status: 'vacant', urgency: 'Urgent' },
            { name: 'Dr. Kofi Adjei', role: 'Resident', status: 'online' },
        ],
    },
    {
        name: 'Intensive Care Unit',
        staff: [
            { name: 'Esi Appiah', role: 'Head Nurse', status: 'online' },
            { name: 'Yaw Darko', role: 'Respiratory Therapist', status: 'away' },
            { name: 'Dr. Akosua Frimpong', role: 'Intensivist', status: 'online' },
        ],
    },
    {
        name: 'Pediatrics Wing',
        staff: [
            { name: 'Adwoa Tetteh', role: 'Pediatric Nurse', status: 'online' },
            { name: 'VACANT', role: 'Child Life Specialist', status: 'vacant', urgency: 'Standard' },
            { name: 'Dr. Kwesi Owusu', role: 'Pediatrician', status: 'offline' },
        ],
    },
    {
        name: 'Cardiology - East',
        staff: [
            { name: 'Dr. Efua Adjei', role: 'Cardiologist', status: 'online' },
            { name: 'Nana Agyemang', role: 'Cardiac Nurse', status: 'online' },
            { name: 'Kwame Boateng', role: 'Technician', status: 'away' },
        ],
    },
    {
        name: 'Surgical Suite B',
        staff: [
            { name: 'VACANT', role: 'Lead Surgeon', status: 'vacant', urgency: 'Urgent' },
            { name: 'Ama Sarpong', role: 'Scrub Nurse', status: 'online' },
            { name: 'VACANT', role: 'Anesthesiologist', status: 'vacant', urgency: 'Urgent' },
        ],
    },
    {
        name: 'Neurology - West',
        staff: [
            { name: 'Dr. Yaa Amoako', role: 'Neurologist', status: 'online' },
            { name: 'Kojo Ankrah', role: 'Neuro Nurse', status: 'online' },
            { name: 'Dr. Kwame Asante', role: 'Fellow', status: 'online' },
        ],
    },
];

const fillNames = ['Dr. Ama Mensah', 'Dr. Kofi Boateng', 'Nurse Abena Darko', 'Dr. Kwame Ofori', 'Dr. Efua Quaye', 'Nurse Yaw Tetteh'];

const statusDot: Record<string, { color: string; label: string }> = {
    online: { color: '#5c8a6e', label: 'Online' },
    away: { color: '#c4a24e', label: 'Away' },
    offline: { color: '#94a3b8', label: 'Offline' },
};

export default function LiveDutyCoverageMonitor() {
    const [units, setUnits] = useState(initialUnits);
    const [filter, setFilter] = useState<'all' | 'critical' | 'full'>('all');
    const [toast, setToast] = useState<string | null>(null);
    const [showAssignForm, setShowAssignForm] = useState(false);
    const [assignName, setAssignName] = useState('');
    const [assignUnit, setAssignUnit] = useState('');
    const [assignRole, setAssignRole] = useState('');
    const [lastRefresh, setLastRefresh] = useState(new Date());

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const computed = units.map(calcUnit);
    const totalStaff = computed.reduce((a, u) => a + u.staff.filter(s => s.status !== 'vacant').length, 0);
    const totalRoles = computed.reduce((a, u) => a + u.staff.length, 0);
    const totalVacant = computed.reduce((a, u) => a + u.vacancies, 0);
    const coverageRatio = totalRoles > 0 ? Math.round(((totalRoles - totalVacant) / totalRoles) * 100) : 100;

    const filtered = filter === 'all' ? computed
        : filter === 'critical' ? computed.filter(u => u.tag === 'critical' || u.tag === 'gap')
        : computed.filter(u => u.tag === 'full');

    const handleFillGap = (unitName: string) => {
        setUnits(prev => prev.map(u => {
            if (u.name !== unitName) return u;
            const idx = u.staff.findIndex(m => m.status === 'vacant');
            if (idx === -1) return u;
            const newStaff = [...u.staff];
            const name = fillNames[Math.floor(Math.random() * fillNames.length)];
            newStaff[idx] = { name, role: newStaff[idx].role, status: 'online' };
            return { ...u, staff: newStaff };
        }));
        showToast('Vacancy filled successfully');
    };

    const handleAssign = () => {
        if (!assignName.trim() || !assignUnit) return;
        setUnits(prev => prev.map(u => {
            if (u.name !== assignUnit) return u;
            return { ...u, staff: [...u.staff, { name: assignName, role: assignRole || 'Staff', status: 'online' as const }] };
        }));
        setShowAssignForm(false);
        setAssignName(''); setAssignRole('');
        showToast(`${assignName} assigned to ${assignUnit}`);
    };

    const handleForceSignOut = (unitName: string, staffIdx: number) => {
        setUnits(prev => prev.map(u => {
            if (u.name !== unitName) return u;
            const newStaff = [...u.staff];
            const member = newStaff[staffIdx];
            newStaff[staffIdx] = { name: 'VACANT', role: member.role, status: 'vacant', urgency: 'Standard' };
            return { ...u, staff: newStaff };
        }));
        showToast('Staff member signed out (admin override)');
    };

    return (
        <div className="app-shell">
            <Sidebar hospitalName="Accra Medical Center" sections={navSections} />

            {toast && (
                <div className="toast-enter" style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '10px 18px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 8, }}>
                    <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--success)' }}>check_circle</span>
                    {toast}
                </div>
            )}

            <div className="app-main">
                <TopBar
                    title="Duty Monitor"
                    breadcrumbs={['Dashboard']}
                    actions={
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setLastRefresh(new Date()); showToast('Data refreshed'); }}>
                                <span className="material-icons-round" style={{ fontSize: 15 }}>refresh</span>Refresh
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => { setShowAssignForm(!showAssignForm); }}>
                                <span className="material-icons-round" style={{ fontSize: 15 }}>{showAssignForm ? 'close' : 'add'}</span>
                                {showAssignForm ? 'Cancel' : 'Assign Coverage'}
                            </button>
                        </div>
                    }
                />

                <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>

                    {/* Assign Form */}
                    {showAssignForm && (
                        <div className="fade-in card" style={{ marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 160 }}>
                                <label className="label">Staff Name</label>
                                <input className="input" placeholder="Full name" value={assignName} onChange={e => setAssignName(e.target.value)} style={{ fontSize: 13 }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 140 }}>
                                <label className="label">Role</label>
                                <input className="input" placeholder="e.g. Nurse" value={assignRole} onChange={e => setAssignRole(e.target.value)} style={{ fontSize: 13 }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 160 }}>
                                <label className="label">Unit</label>
                                <select className="input" value={assignUnit} onChange={e => setAssignUnit(e.target.value)} style={{ fontSize: 13 }}>
                                    <option value="">Select unit...</option>
                                    {units.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
                                </select>
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={handleAssign} disabled={!assignName.trim() || !assignUnit} style={{ height: 36 }}>
                                <span className="material-icons-round" style={{ fontSize: 15 }}>person_add</span>Assign
                            </button>
                        </div>
                    )}

                    {/* Stat Cards */}
                    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
                        <div className="card" style={{ padding: '20px 22px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Active Staff</div>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#5c8a6e', background: '#f0f7f2', padding: '2px 8px', borderRadius: 10 }}>+12%</span>
                            </div>
                            <div style={{ marginTop: 8 }}>
                                <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{totalStaff}</span>
                                <span style={{ fontSize: 13, color: 'var(--text-disabled)', marginLeft: 6 }}>/ {totalRoles} total</span>
                            </div>
                        </div>

                        <div className="card" style={{ padding: '20px 22px', borderColor: totalVacant > 0 ? 'rgba(30,58,95,0.15)' : undefined }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Critical Gaps</div>
                                {totalVacant > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: '#8c5a5e', background: '#fdf2f2', padding: '2px 8px', borderRadius: 10 }}>Urgent</span>}
                            </div>
                            <div style={{ marginTop: 8 }}>
                                <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{totalVacant}</span>
                                <span style={{ fontSize: 13, color: 'var(--text-disabled)', marginLeft: 6 }}>roles vacant</span>
                            </div>
                        </div>

                        <div className="card" style={{ padding: '20px 22px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Coverage Ratio</div>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#5a7d8c', background: '#f0f4f8', padding: '2px 8px', borderRadius: 10 }}>-1%</span>
                            </div>
                            <div style={{ marginTop: 8 }}>
                                <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{coverageRatio}%</span>
                                <span style={{ fontSize: 13, color: 'var(--text-disabled)', marginLeft: 6 }}>facility wide</span>
                            </div>
                        </div>

                        <div className="card" style={{ padding: '20px 22px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Requests</div>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#8a7d5c', background: '#faf8f0', padding: '2px 8px', borderRadius: 10 }}>Pending</span>
                            </div>
                            <div style={{ marginTop: 8 }}>
                                <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>8</span>
                                <span style={{ fontSize: 13, color: 'var(--text-disabled)', marginLeft: 6 }}>needs review</span>
                            </div>
                        </div>
                    </div>

                    {/* Section Header + Filter Pills */}
                    <div className="fade-in delay-1" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Unit Status Overview</h2>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {([['all', 'All Units'], ['critical', 'Critical Only'], ['full', 'Fully Staffed']] as const).map(([key, label]) => (
                                <button key={key} className="btn btn-secondary btn-xs" onClick={() => setFilter(key)}
                                    style={{
                                        background: filter === key ? '#edf1f7' : undefined,
                                        borderColor: filter === key ? 'var(--helix-primary)' : undefined,
                                        color: filter === key ? 'var(--helix-primary)' : undefined,
                                        fontWeight: filter === key ? 600 : 400,
                                    }}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Unit Cards Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                        {filtered.map((unit, i) => (
                            <div key={unit.name} className={`card fade-in delay-${Math.min(i + 1, 4)}`} style={{
                                padding: 0, overflow: 'hidden',
                                borderColor: unit.tag === 'critical' ? 'rgba(140,90,94,0.25)' : undefined,
                            }}>
                                {/* Unit Header */}
                                <div style={{ padding: '16px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{unit.name}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                            <span style={{
                                                width: 7, height: 7, borderRadius: '50%',
                                                background: unit.tag === 'full' ? '#5c8a6e' : unit.tag === 'critical' ? '#8c5a5e' : '#c4a24e',
                                            }} />
                                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                {unit.tag === 'full' ? `${unit.coverage}% Coverage` : `Critical Gaps (${unit.coverage}%)`}
                                            </span>
                                        </div>
                                    </div>
                                    <button className="btn btn-ghost btn-xs" onClick={() => showToast(`${unit.name} options`)}>
                                        <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--text-muted)' }}>more_horiz</span>
                                    </button>
                                </div>

                                {/* Staff Rows */}
                                <div style={{ padding: '0 0 8px' }}>
                                    {unit.staff.map((member, mi) => (
                                        <div key={`${member.name}-${mi}`} style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '10px 20px',
                                            borderTop: '1px solid var(--border-subtle)',
                                        }}>
                                            {member.status === 'vacant' ? (
                                                <div style={{
                                                    width: 36, height: 36, borderRadius: '50%',
                                                    border: '2px dashed rgba(140,90,94,0.35)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                }}>
                                                    <span className="material-icons-round" style={{ fontSize: 16, color: '#8c5a5e' }}>person_off</span>
                                                </div>
                                            ) : (
                                                <div style={{
                                                    width: 36, height: 36, borderRadius: '50%',
                                                    background: '#edf1f7', color: 'var(--helix-primary)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 12, fontWeight: 600, flexShrink: 0,
                                                }}>
                                                    {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                </div>
                                            )}

                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    fontSize: 13, fontWeight: 600,
                                                    color: member.status === 'vacant' ? '#8c5a5e' : 'var(--text-primary)',
                                                }}>
                                                    {member.status === 'vacant' ? 'VACANT' : member.name}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{member.role}</div>
                                            </div>

                                            {member.status === 'vacant' ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{
                                                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                                                        background: member.urgency === 'Urgent' ? '#fdf2f2' : '#f0f4f8',
                                                        color: member.urgency === 'Urgent' ? '#8c5a5e' : '#5a7d8c',
                                                    }}>{member.urgency}</span>
                                                    <button className="btn btn-primary btn-xs" onClick={() => handleFillGap(unit.name)}>Assign</button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ fontSize: 12, fontWeight: 500, color: statusDot[member.status].color }}>
                                                        {statusDot[member.status].label}
                                                    </span>
                                                    <button className="btn btn-ghost btn-xs" title="Force sign-out" onClick={() => handleForceSignOut(unit.name, mi)} style={{ opacity: 0.4 }}>
                                                        <span className="material-icons-round" style={{ fontSize: 13, color: 'var(--text-muted)' }}>logout</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            </div>
        </div>
    );
}
