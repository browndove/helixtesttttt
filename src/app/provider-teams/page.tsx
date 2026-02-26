'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

type Member = {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    status: 'Active' | 'On Leave' | 'Off Duty';
};

type Team = {
    id: string;
    name: string;
    department: string;
    description: string;
    lead: string;
    members: Member[];
    createdAt: string;
};

const mockTeams: Team[] = [
    {
        id: '1',
        name: 'Emergency Response Unit',
        department: 'Emergency',
        description: 'Primary emergency response team handling critical cases and trauma.',
        lead: 'Kwame Asante',
        createdAt: '2025-11-10',
        members: [
            { id: 'm1', firstName: 'Kwame', lastName: 'Asante', role: 'Team Lead', status: 'Active' },
            { id: 'm2', firstName: 'Ama', lastName: 'Serwaa', role: 'Charge Nurse', status: 'Active' },
            { id: 'm3', firstName: 'Kofi', lastName: 'Darko', role: 'Resident', status: 'Active' },
            { id: 'm4', firstName: 'Yaa', lastName: 'Amponsah', role: 'Nurse', status: 'On Leave' },
        ],
    },
    {
        id: '2',
        name: 'ICU Care Team',
        department: 'ICU',
        description: 'Intensive care unit team for critically ill patients.',
        lead: 'Ama Mensah',
        createdAt: '2025-12-01',
        members: [
            { id: 'm5', firstName: 'Ama', lastName: 'Mensah', role: 'Team Lead', status: 'Active' },
            { id: 'm6', firstName: 'Kofi', lastName: 'Mensah', role: 'Intensivist', status: 'Active' },
            { id: 'm7', firstName: 'Efua', lastName: 'Darko', role: 'ICU Nurse', status: 'Active' },
        ],
    },
    {
        id: '3',
        name: 'Surgical Team A',
        department: 'Surgery',
        description: 'General and specialized surgery team.',
        lead: 'James Owusu',
        createdAt: '2026-01-15',
        members: [
            { id: 'm8', firstName: 'James', lastName: 'Owusu', role: 'Team Lead', status: 'Active' },
            { id: 'm9', firstName: 'Akua', lastName: 'Boateng', role: 'Surgeon', status: 'Active' },
            { id: 'm10', firstName: 'Kwesi', lastName: 'Appiah', role: 'Anesthesiologist', status: 'Off Duty' },
            { id: 'm11', firstName: 'Adwoa', lastName: 'Frimpong', role: 'Scrub Nurse', status: 'Active' },
            { id: 'm12', firstName: 'Yaw', lastName: 'Mensah', role: 'Resident', status: 'Active' },
        ],
    },
    {
        id: '4',
        name: 'Pediatrics Team',
        department: 'Pediatrics',
        description: 'Pediatric care team for children and adolescents.',
        lead: 'Abena Osei',
        createdAt: '2026-02-01',
        members: [
            { id: 'm13', firstName: 'Abena', lastName: 'Osei', role: 'Team Lead', status: 'Active' },
            { id: 'm14', firstName: 'Kojo', lastName: 'Asante', role: 'Pediatrician', status: 'Active' },
        ],
    },
];

const departments = ['All', 'Emergency', 'ICU', 'Surgery', 'Pediatrics', 'Radiology', 'Oncology'];
const roleOptions = ['Team Lead', 'Charge Nurse', 'Nurse', 'Resident', 'Surgeon', 'Intensivist', 'ICU Nurse', 'Anesthesiologist', 'Scrub Nurse', 'Pediatrician', 'Physician'];

const statusColor: Record<string, string> = {
    Active: 'var(--success)',
    'On Leave': 'var(--warning)',
    'Off Duty': 'var(--text-muted)',
};

export default function ProviderTeamsPage() {
    const [teams, setTeams] = useState<Team[]>(mockTeams);
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [deptFilter, setDeptFilter] = useState('All');
    const [toast, setToast] = useState<string | null>(null);

    // Create team
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDept, setNewDept] = useState('Emergency');
    const [newDesc, setNewDesc] = useState('');

    // Add member
    const [showAddMember, setShowAddMember] = useState(false);
    const [memberFirstName, setMemberFirstName] = useState('');
    const [memberLastName, setMemberLastName] = useState('');
    const [memberRole, setMemberRole] = useState(roleOptions[0]);

    // Edit team
    const [editingTeam, setEditingTeam] = useState(false);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editDept, setEditDept] = useState('');

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const selectedTeam = teams.find(t => t.id === selectedTeamId) || null;

    const filtered = teams.filter(t => {
        if (deptFilter !== 'All' && t.department !== deptFilter) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            return t.name.toLowerCase().includes(q) ||
                t.department.toLowerCase().includes(q) ||
                t.lead.toLowerCase().includes(q) ||
                t.members.some(m => `${m.firstName} ${m.lastName}`.toLowerCase().includes(q));
        }
        return true;
    });

    const handleCreateTeam = () => {
        if (!newName.trim()) return;
        const team: Team = {
            id: Date.now().toString(),
            name: newName.trim(),
            department: newDept,
            description: newDesc.trim(),
            lead: 'Unassigned',
            createdAt: new Date().toISOString().split('T')[0],
            members: [],
        };
        setTeams(prev => [...prev, team]);
        setShowCreate(false);
        setNewName('');
        setNewDesc('');
        showToast(`Team "${team.name}" created`);
    };

    const handleDeleteTeam = (id: string) => {
        const team = teams.find(t => t.id === id);
        setTeams(prev => prev.filter(t => t.id !== id));
        if (selectedTeamId === id) setSelectedTeamId(null);
        showToast(`Team "${team?.name}" deleted`);
    };

    const handleAddMember = () => {
        if (!memberFirstName.trim() || !memberLastName.trim() || !selectedTeam) return;
        const member: Member = {
            id: Date.now().toString(),
            firstName: memberFirstName.trim(),
            lastName: memberLastName.trim(),
            role: memberRole,
            status: 'Active',
        };
        setTeams(prev => prev.map(t =>
            t.id === selectedTeam.id
                ? { ...t, members: [...t.members, member] }
                : t
        ));
        setShowAddMember(false);
        setMemberFirstName('');
        setMemberLastName('');
        setMemberRole(roleOptions[0]);
        showToast(`${member.firstName} ${member.lastName} added`);
    };

    const handleRemoveMember = (memberId: string) => {
        if (!selectedTeam) return;
        const member = selectedTeam.members.find(m => m.id === memberId);
        setTeams(prev => prev.map(t =>
            t.id === selectedTeam.id
                ? { ...t, members: t.members.filter(m => m.id !== memberId) }
                : t
        ));
        showToast(`${member?.firstName} ${member?.lastName} removed`);
    };

    const handleSaveEdit = () => {
        if (!selectedTeam || !editName.trim()) return;
        setTeams(prev => prev.map(t =>
            t.id === selectedTeam.id
                ? { ...t, name: editName.trim(), description: editDesc.trim(), department: editDept }
                : t
        ));
        setEditingTeam(false);
        showToast('Team updated');
    };

    const openEdit = () => {
        if (!selectedTeam) return;
        setEditName(selectedTeam.name);
        setEditDesc(selectedTeam.description);
        setEditDept(selectedTeam.department);
        setEditingTeam(true);
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
                <TopBar title="Provider Teams" subtitle="Manage clinical teams and their members" />

                <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>
                    {/* Filters + Create */}
                    <div className="fade-in" style={{ display: 'flex', gap: 12, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 300 }}>
                            <span className="material-icons-round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--text-disabled)', pointerEvents: 'none' }}>search</span>
                            <input
                                className="input"
                                placeholder="Search teams or members..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ paddingLeft: 34, fontSize: 12.5, height: 36, width: '100%' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: 3 }}>
                            {departments.map(d => (
                                <button
                                    key={d}
                                    onClick={() => setDeptFilter(d)}
                                    style={{
                                        padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                                        fontSize: 11, fontWeight: deptFilter === d ? 600 : 500,
                                        color: deptFilter === d ? 'var(--helix-primary)' : 'var(--text-secondary)',
                                        background: deptFilter === d ? '#fff' : 'transparent',
                                        border: deptFilter === d ? '1px solid var(--border-default)' : '1px solid transparent',
                                        boxShadow: deptFilter === d ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                                        cursor: 'pointer', transition: 'all 0.15s',
                                    }}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>

                        <div style={{ marginLeft: 'auto' }}>
                            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>
                                <span className="material-icons-round" style={{ fontSize: 14 }}>{showCreate ? 'close' : 'add'}</span>
                                {showCreate ? 'Cancel' : 'New Team'}
                            </button>
                        </div>
                    </div>

                    {/* Create Team Form */}
                    {showCreate && (
                        <div className="fade-in card" style={{ marginBottom: 18, maxWidth: 520 }}>
                            <h3 style={{ marginBottom: 14 }}>Create Team</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div>
                                    <label className="label">Team Name</label>
                                    <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Cardiology Team B" style={{ fontSize: 13 }} />
                                </div>
                                <div>
                                    <label className="label">Department</label>
                                    <select className="input" value={newDept} onChange={e => setNewDept(e.target.value)} style={{ fontSize: 13 }}>
                                        {departments.filter(d => d !== 'All').map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Description</label>
                                    <input className="input" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Brief description of the team" style={{ fontSize: 13 }} />
                                </div>
                            </div>
                            <button className="btn btn-primary btn-sm" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} onClick={handleCreateTeam} disabled={!newName.trim()}>
                                Create Team
                            </button>
                        </div>
                    )}

                    {/* Main Content: Teams List + Detail */}
                    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: selectedTeam ? '1fr 1fr' : '1fr', gap: 20 }}>
                        {/* Teams List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {filtered.length === 0 ? (
                                <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>No teams found</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Try adjusting your search or filters</div>
                                </div>
                            ) : (
                                filtered.map(team => {
                                    const isSelected = selectedTeamId === team.id;
                                    const activeCount = team.members.filter(m => m.status === 'Active').length;
                                    return (
                                        <div
                                            key={team.id}
                                            className="card"
                                            onClick={() => { setSelectedTeamId(isSelected ? null : team.id); setEditingTeam(false); setShowAddMember(false); }}
                                            style={{
                                                cursor: 'pointer', transition: 'all 0.15s',
                                                border: isSelected ? '1px solid var(--helix-primary)' : '1px solid var(--border-default)',
                                                background: isSelected ? 'rgba(59,130,246,0.03)' : 'var(--surface-card)',
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                        <h3 style={{ fontSize: 14, fontWeight: 700 }}>{team.name}</h3>
                                                        <span style={{
                                                            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8,
                                                            background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)',
                                                        }}>
                                                            {team.department}
                                                        </span>
                                                    </div>
                                                    <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.4 }}>{team.description}</p>
                                                    <div style={{ display: 'flex', gap: 16, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                                                        <span><strong>{team.members.length}</strong> members</span>
                                                        <span><strong>{activeCount}</strong> active</span>
                                                        <span>Lead: <strong>{team.lead}</strong></span>
                                                    </div>
                                                </div>
                                                <button
                                                    className="btn btn-danger btn-xs"
                                                    onClick={e => { e.stopPropagation(); handleDeleteTeam(team.id); }}
                                                    title="Delete team"
                                                >
                                                    <span className="material-icons-round" style={{ fontSize: 12 }}>delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Detail Panel */}
                        {selectedTeam && (
                            <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: 24 }}>
                                {editingTeam ? (
                                    <>
                                        <h3 style={{ marginBottom: 14 }}>Edit Team</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            <div>
                                                <label className="label">Team Name</label>
                                                <input className="input" value={editName} onChange={e => setEditName(e.target.value)} style={{ fontSize: 13 }} />
                                            </div>
                                            <div>
                                                <label className="label">Department</label>
                                                <select className="input" value={editDept} onChange={e => setEditDept(e.target.value)} style={{ fontSize: 13 }}>
                                                    {departments.filter(d => d !== 'All').map(d => (
                                                        <option key={d} value={d}>{d}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="label">Description</label>
                                                <input className="input" value={editDesc} onChange={e => setEditDesc(e.target.value)} style={{ fontSize: 13 }} />
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                                            <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSaveEdit} disabled={!editName.trim()}>Save</button>
                                            <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setEditingTeam(false)}>Cancel</button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                            <div>
                                                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{selectedTeam.name}</h3>
                                                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedTeam.department} · Created {selectedTeam.createdAt}</p>
                                            </div>
                                            <button className="btn btn-secondary btn-xs" onClick={openEdit}>
                                                <span className="material-icons-round" style={{ fontSize: 12 }}>edit</span>
                                                Edit
                                            </button>
                                        </div>

                                        {selectedTeam.description && (
                                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>{selectedTeam.description}</p>
                                        )}

                                        {/* Members */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                            <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                                                Members ({selectedTeam.members.length})
                                            </h4>
                                            <button className="btn btn-primary btn-xs" onClick={() => setShowAddMember(!showAddMember)}>
                                                <span className="material-icons-round" style={{ fontSize: 12 }}>{showAddMember ? 'close' : 'person_add'}</span>
                                                {showAddMember ? 'Cancel' : 'Add'}
                                            </button>
                                        </div>

                                        {showAddMember && (
                                            <div style={{
                                                display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, padding: 12,
                                                background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)',
                                            }}>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <div style={{ flex: 1 }}>
                                                        <label className="label">First Name</label>
                                                        <input className="input" value={memberFirstName} onChange={e => setMemberFirstName(e.target.value)} placeholder="First name" style={{ fontSize: 12 }} />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <label className="label">Last Name</label>
                                                        <input className="input" value={memberLastName} onChange={e => setMemberLastName(e.target.value)} placeholder="Last name" style={{ fontSize: 12 }} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="label">Role</label>
                                                    <select className="input" value={memberRole} onChange={e => setMemberRole(e.target.value)} style={{ fontSize: 12 }}>
                                                        {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                                                    </select>
                                                </div>
                                                <button className="btn btn-primary btn-xs" style={{ width: '100%', justifyContent: 'center' }} onClick={handleAddMember} disabled={!memberFirstName.trim() || !memberLastName.trim()}>
                                                    Add Member
                                                </button>
                                            </div>
                                        )}

                                        {selectedTeam.members.length === 0 ? (
                                            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                                                No members yet. Add the first member above.
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {selectedTeam.members.map(member => (
                                                    <div key={member.id} style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                        padding: '8px 10px', borderRadius: 'var(--radius-md)',
                                                        background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <div style={{
                                                                width: 28, height: 28, borderRadius: '50%',
                                                                background: 'var(--helix-primary)', color: '#fff',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: 10, fontWeight: 700, flexShrink: 0,
                                                            }}>
                                                                {member.firstName[0]}{member.lastName[0]}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: 12, fontWeight: 600 }}>{member.firstName} {member.lastName}</div>
                                                                <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                                                                    {member.role}
                                                                    <span style={{ marginLeft: 8, color: statusColor[member.status], fontWeight: 600 }}>{member.status}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            className="btn btn-danger btn-xs"
                                                            onClick={() => handleRemoveMember(member.id)}
                                                            title="Remove member"
                                                        >
                                                            <span className="material-icons-round" style={{ fontSize: 12 }}>close</span>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
