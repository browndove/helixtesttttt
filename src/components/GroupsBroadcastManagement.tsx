'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

const groups = [
    { id: '1', name: 'Emergency Dept — All Hands', desc: 'General broadcast for ED staff. Includes all on-call personnel.', members: 48, type: 'broadcast', priority: 'high', color: '#8c5a5e' },
    { id: '2', name: 'Code Blue Team — ICU', desc: 'Critical response unit for ICU', members: 12, type: 'response', priority: 'critical', color: '#4a6fa5' },
    { id: '3', name: 'Pediatrics Night Shift', desc: 'Overnight coverage for Peds wing', members: 9, type: 'shift', priority: 'normal', color: '#5c8a6e' },
    { id: '4', name: 'Surgical Residents', desc: 'General Surgery Residency Program', members: 22, type: 'department', priority: 'normal', color: '#8a7d5c' },
    { id: '5', name: 'Rapid Response Team', desc: 'Hospital-wide rapid response coordinators', members: 7, type: 'response', priority: 'critical', color: '#5a7d8c' },
];

const groupMembers = [
    { name: 'Dr. Ama Mensah', role: 'Attending', avatar: 'AM', color: '#4a6fa5', canBroadcast: true },
    { name: 'Nurse Yaw Darko', role: 'Lead Nurse', avatar: 'YD', color: '#5a7d8c', canBroadcast: false },
    { name: 'Dr. Efua Adjei', role: 'Resident', avatar: 'EA', color: '#5c8a6e', canBroadcast: false },
    { name: 'Nana Agyemang', role: 'Paramedic', avatar: 'NA', color: '#8a7d5c', canBroadcast: false },
];


const priorityMap: Record<string, { label: string; badge: string; color: string }> = {
    critical: { label: 'Critical', badge: 'badge-critical', color: 'var(--critical)' },
    high: { label: 'High', badge: 'badge-warning', color: 'var(--warning)' },
    normal: { label: 'Normal', badge: 'badge-neutral', color: 'var(--text-muted)' },
};

const typeIcon: Record<string, string> = {
    broadcast: 'campaign',
    response: 'emergency',
    shift: 'schedule',
    department: 'domain',
};

export default function GroupsBroadcastManagement() {
    const [groupList, setGroupList] = useState(groups);
    const [selected, setSelected] = useState(groups[0]);
    const [broadcastText, setBroadcastText] = useState('');
    const [memberLogic, setMemberLogic] = useState('all');
    const [toast, setToast] = useState<string | null>(null);
    const [members, setMembers] = useState(groupMembers);
    const [sentCount, setSentCount] = useState(0);
    const [searchGroups, setSearchGroups] = useState('');

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const filteredGroups = groupList.filter(g => g.name.toLowerCase().includes(searchGroups.toLowerCase()));

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <Sidebar hospitalName="Korle Bu" hospitalSubtitle="Teaching Hospital" sections={navSections} footer={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="avatar" style={{ background: 'rgba(30,58,95,0.2)', color: 'var(--helix-primary-light)' }}>KA</div>
                    <div><div style={{ fontSize: 13, fontWeight: 600 }}>Kwame Asante</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>System Admin</div></div>
                </div>
            } />

            {/* Toast */}
            {toast && (
                <div className="toast-enter" style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '10px 18px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 8, }}>
                    <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--success)' }}>check_circle</span>
                    {toast}
                </div>
            )}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <TopBar
                    title="Group Management"
                    breadcrumbs={['Dashboard', 'Broadcast Groups']}
                    search={{ placeholder: 'Search groups...', value: searchGroups, onChange: setSearchGroups }}
                    actions={
                        <button className="btn btn-primary btn-sm" onClick={() => {
                            const newG = { id: String(Date.now()), name: 'New Group', desc: 'Untitled broadcast group', members: 0, type: 'broadcast' as const, priority: 'normal' as const, color: '#4a6fa5' };
                            setGroupList(prev => [newG, ...prev]);
                            setSelected(newG);
                            showToast('New group created');
                        }}><span className="material-icons-round" style={{ fontSize: 14 }}>add</span>New Group</button>
                    }
                />
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Group List */}
            <div style={{ width: 300, background: 'var(--bg-800)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {filteredGroups.map(g => (
                        <div
                            key={g.id}
                            onClick={() => setSelected(g)}
                            style={{
                                padding: '12px 16px', cursor: 'pointer',
                                background: selected.id === g.id ? 'rgba(30,58,95,0.07)' : 'transparent',
                                borderBottom: '1px solid var(--border-subtle)',
                                borderLeft: selected.id === g.id ? '3px solid var(--helix-primary)' : '3px solid transparent',
                                transition: 'all 0.15s',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${g.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span className="material-icons-round" style={{ fontSize: 17, color: g.color }}>{typeIcon[g.type]}</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.desc}</div>
                                    <div style={{ display: 'flex', gap: 6, marginTop: 5, alignItems: 'center' }}>
                                        <span className="material-icons-round" style={{ fontSize: 12, color: 'var(--text-muted)' }}>group</span>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.members} members</span>
                                        <span className={`badge ${priorityMap[g.priority].badge}`} style={{ fontSize: 9, padding: '1px 6px' }}>{priorityMap[g.priority].label}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Detail Panel */}
            <main style={{ flex: 1, overflow: 'auto', padding: '20px 20px', background: 'var(--bg-900)' }}>
                <div className="fade-in">
                    {/* Group Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 24 }}>
                        <div style={{ width: 50, height: 50, borderRadius: 14, background: `${selected.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="material-icons-round" style={{ fontSize: 26, color: selected.color }}>{typeIcon[selected.type]}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                            <h1 style={{ fontSize: '1.4rem' }}>{selected.name}</h1>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{selected.desc}</p>
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <span className={`badge ${priorityMap[selected.priority].badge}`}>{priorityMap[selected.priority].label}</span>
                                <span className="badge badge-neutral">{selected.members} Members</span>
                                <span className="badge badge-info">{selected.type}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => showToast('Editing group settings')}><span className="material-icons-round" style={{ fontSize: 15 }}>edit</span>Edit</button>
                            <button className="btn btn-danger btn-sm" onClick={() => {
                                const remaining = groupList.filter(g => g.id !== selected.id);
                                if (remaining.length === 0) return;
                                setGroupList(remaining);
                                setSelected(remaining[0]);
                                showToast('Group deleted');
                            }}><span className="material-icons-round" style={{ fontSize: 15 }}>delete</span>Delete</button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20 }}>
                        {/* Members */}
                        <div className="card" style={{ marginBottom: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--helix-primary-light)' }}>engineering</span>
                                    Membership Logic
                                </h3>
                                <button className="btn btn-primary btn-xs" onClick={() => {
                                    const names = ['Dr. Kofi Boateng', 'Nurse Abena Sarpong', 'Dr. Kwesi Owusu', 'Tech Adwoa Tetteh'];
                                    const n = names[members.length % names.length];
                                    const avatar = n.split(' ').slice(-2).map(x => x[0]).join('');
                                    setMembers(prev => [...prev, { name: n, role: 'Staff', avatar, color: '#4a6fa5', canBroadcast: false }]);
                                    showToast(`${n} added to group`);
                                }}><span className="material-icons-round" style={{ fontSize: 14 }}>person_add</span>Add</button>
                            </div>

                            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                                {['all', 'on-call', 'shift'].map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => setMemberLogic(mode)}
                                        className="btn btn-sm btn-secondary"
                                        style={{ background: memberLogic === mode ? 'rgba(30,58,95,0.1)' : undefined, borderColor: memberLogic === mode ? 'var(--helix-primary)' : undefined, color: memberLogic === mode ? 'var(--helix-primary-light)' : undefined }}
                                    >
                                        {mode === 'all' ? 'All Members' : mode === 'on-call' ? 'On-Call Only' : 'Current Shift'}
                                    </button>
                                ))}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {members.map(m => (
                                    <div key={m.name} style={{
                                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                                        borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
                                    }}>
                                        <div className="avatar" style={{ background: `${m.color}20`, color: m.color, fontSize: 12, width: 34, height: 34 }}>{m.avatar}</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.role}</div>
                                        </div>
                                        {m.canBroadcast && <span className="badge badge-warning" style={{ fontSize: 10 }}>Can Broadcast</span>}
                                        <button className="btn btn-ghost btn-xs" onClick={() => {
                                            setMembers(prev => prev.filter(x => x.name !== m.name));
                                            showToast(`${m.name} removed`);
                                        }}><span className="material-icons-round" style={{ fontSize: 14 }}>close</span></button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Broadcast + Permissions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            {/* Send Broadcast */}
                            <div className="card">
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                    <span className="material-icons-round" style={{ fontSize: 16, color: selected.color }}>campaign</span>
                                    Send Broadcast
                                </h3>
                                <textarea
                                    className="input"
                                    placeholder="Type your broadcast message..."
                                    value={broadcastText}
                                    onChange={e => setBroadcastText(e.target.value)}
                                    rows={4}
                                    style={{ resize: 'vertical', fontSize: 13, lineHeight: 1.5 }}
                                />
                                <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <select className="input" style={{ flex: 1, fontSize: 12, padding: '5px 10px' }}>
                                        <option>Standard Priority</option>
                                        <option>Urgent</option>
                                        <option>Critical</option>
                                    </select>
                                    <button className="btn btn-primary btn-sm" disabled={!broadcastText} onClick={() => {
                                        setSentCount(prev => prev + 1);
                                        showToast(`Broadcast sent to ${selected.members} members`);
                                        setBroadcastText('');
                                    }}>
                                        <span className="material-icons-round" style={{ fontSize: 15 }}>send</span>
                                        Send{sentCount > 0 ? ` (${sentCount})` : ''}
                                    </button>
                                </div>
                                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: 'var(--warning-bg)', border: '1px solid rgba(154,123,46,0.2)', fontSize: 11, color: 'var(--text-secondary)' }}>
                                    Changes to criticality will affect notification sounds for recipients.
                                </div>
                            </div>

                            {/* Broadcast Permissions */}
                            <div className="card">
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                    <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--helix-primary-light)' }}>lock_person</span>
                                    Broadcast Permissions
                                </h3>
                                {[
                                    { label: 'All Members Can Broadcast', note: 'Any member can send group messages.' },
                                    { label: 'Admins Only', note: 'Restrict broadcasts to admin roles.' },
                                    { label: 'Require Approval', note: 'Messages need approval before sending.' },
                                ].map((p, i) => (
                                    <label key={p.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', cursor: 'pointer', borderBottom: i < 2 ? '1px solid var(--border-subtle)' : 'none' }}>
                                        <input type="radio" name="broadcast-perm" defaultChecked={i === 0} style={{ marginTop: 4, accentColor: 'var(--helix-primary)' }} />
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{p.note}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
                </div>
            </div>
        </div>
    );
}
