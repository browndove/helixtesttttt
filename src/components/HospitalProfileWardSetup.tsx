'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

type DeptNode = {
    id: string;
    name: string;
    type: 'dept' | 'unit' | 'floor' | 'ward';
    beds?: number;
    children?: DeptNode[];
};

const defaultTree: DeptNode[] = [
    {
        id: '1', name: 'Cardiology Department', type: 'dept',
        children: [
            {
                id: '1-1', name: 'Unit A (North Wing)', type: 'unit',
                children: [
                    { id: '1-1-f1', name: 'Floor 1', type: 'floor', children: [
                        { id: '1-1-1', name: 'Ward 101 (ICU)', type: 'ward', beds: 12 },
                        { id: '1-1-2', name: 'Ward 102 (General)', type: 'ward', beds: 24 },
                    ]},
                    { id: '1-1-f2', name: 'Floor 2', type: 'floor', children: [
                        { id: '1-1-3', name: 'Ward 103 (Step-Down)', type: 'ward', beds: 16 },
                    ]},
                ],
            },
            {
                id: '1-2', name: 'Unit B (South Wing)', type: 'unit',
                children: [
                    { id: '1-2-f1', name: 'Floor 1', type: 'floor', children: [
                        { id: '1-2-1', name: 'Ward 104 (Post-Op)', type: 'ward', beds: 18 },
                    ]},
                ],
            },
        ],
    },
    {
        id: '2', name: 'Neurology Department', type: 'dept',
        children: [
            {
                id: '2-1', name: 'Neuro ICU', type: 'unit',
                children: [
                    { id: '2-1-f1', name: 'Floor 2', type: 'floor', children: [
                        { id: '2-1-1', name: 'Ward 201 (Critical)', type: 'ward', beds: 8 },
                        { id: '2-1-2', name: 'Ward 202 (Monitoring)', type: 'ward', beds: 14 },
                    ]},
                ],
            },
        ],
    },
    {
        id: '3', name: 'Pediatrics Department', type: 'dept',
        children: [
            {
                id: '3-1', name: 'Unit B (East Wing)', type: 'unit',
                children: [
                    { id: '3-1-f1', name: 'Floor 3', type: 'floor', children: [
                        { id: '3-1-1', name: 'Ward 301 (General)', type: 'ward', beds: 20 },
                        { id: '3-1-2', name: 'Ward 302 (NICU)', type: 'ward', beds: 10 },
                    ]},
                ],
            },
        ],
    },
    {
        id: '4', name: 'Emergency Department', type: 'dept',
        children: [
            { id: '4-1', name: 'Trauma Bay', type: 'unit', children: [
                { id: '4-1-f1', name: 'Ground Floor', type: 'floor', children: [
                    { id: '4-1-1', name: 'Bay A (Resuscitation)', type: 'ward', beds: 6 },
                    { id: '4-1-2', name: 'Bay B (Acute)', type: 'ward', beds: 12 },
                ]},
            ]},
            { id: '4-2', name: 'Fast Track', type: 'unit', children: [
                { id: '4-2-f1', name: 'Ground Floor', type: 'floor', children: [
                    { id: '4-2-1', name: 'Minor Injuries', type: 'ward', beds: 8 },
                ]},
            ]},
        ],
    },
    {
        id: '5', name: 'Surgery Department', type: 'dept',
        children: [
            { id: '5-1', name: 'Operating Suites', type: 'unit', children: [
                { id: '5-1-f1', name: 'Floor 4', type: 'floor', children: [
                    { id: '5-1-1', name: 'OR Suite 1-4', type: 'ward', beds: 4 },
                    { id: '5-1-2', name: 'OR Suite 5-8', type: 'ward', beds: 4 },
                ]},
            ]},
            { id: '5-2', name: 'Recovery Unit', type: 'unit', children: [
                { id: '5-2-f1', name: 'Floor 4', type: 'floor', children: [
                    { id: '5-2-1', name: 'PACU', type: 'ward', beds: 16 },
                ]},
            ]},
        ],
    },
    {
        id: '6', name: 'Radiology Department', type: 'dept',
        children: [
            { id: '6-1', name: 'Imaging Center', type: 'unit', children: [] },
        ],
    },
];


function TreeNode({ node, depth = 0, onDelete }: { node: DeptNode; depth?: number; onDelete: (id: string) => void }) {
    const [open, setOpen] = useState(depth < 2);
    const [hovered, setHovered] = useState(false);
    const hasChildren = node.children && node.children.length > 0;

    const typeIcon = node.type === 'dept' ? 'account_tree' : node.type === 'unit' ? 'layers' : node.type === 'floor' ? 'stairs' : 'bed';
    const typeColor = node.type === 'dept' ? 'var(--helix-primary-light)' : node.type === 'unit' ? 'var(--helix-accent)' : node.type === 'floor' ? 'var(--warning)' : 'var(--success)';

    return (
        <div>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: `8px 12px 8px ${12 + depth * 20}px`,
                    borderRadius: 8,
                    cursor: hasChildren ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                    background: hovered ? 'var(--surface-hover)' : 'transparent',
                }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onClick={() => hasChildren && setOpen(!open)}
            >
                {hasChildren && (
                    <span className="material-icons-round" style={{ fontSize: 14, color: 'var(--text-muted)', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>
                        chevron_right
                    </span>
                )}
                {!hasChildren && <div style={{ width: 14 }} />}
                <span className="material-icons-round" style={{ fontSize: 16, color: typeColor }}>{typeIcon}</span>
                <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{node.name}</span>
                {node.beds !== undefined && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>{node.beds} beds</span>
                )}
                {hovered && (
                    <button
                        className="btn btn-ghost btn-xs"
                        onClick={e => { e.stopPropagation(); onDelete(node.id); }}
                    >
                        <span className="material-icons-round" style={{ fontSize: 14, color: 'var(--critical)' }}>close</span>
                    </button>
                )}
            </div>
            {open && hasChildren && (
                <div>
                    {node.children!.map(child => (
                        <TreeNode key={child.id} node={child} depth={depth + 1} onDelete={onDelete} />
                    ))}
                </div>
            )}
        </div>
    );
}

function removeNode(nodes: DeptNode[], id: string): DeptNode[] {
    return nodes.filter(n => n.id !== id).map(n => ({
        ...n,
        children: n.children ? removeNode(n.children, id) : undefined,
    }));
}

function countNodes(nodes: DeptNode[], type: string): number {
    let count = 0;
    for (const n of nodes) {
        if (n.type === type) count++;
        if (n.children) count += countNodes(n.children, type);
    }
    return count;
}

function countBeds(nodes: DeptNode[]): number {
    let count = 0;
    for (const n of nodes) {
        if (n.beds) count += n.beds;
        if (n.children) count += countBeds(n.children);
    }
    return count;
}

export default function HospitalProfileWardSetup() {
    const [tree, setTree] = useState(defaultTree);
    const [toast, setToast] = useState<string | null>(null);
    const [editingProfile, setEditingProfile] = useState(false);
    const [hospitalName, setHospitalName] = useState('Accra Medical Center Medical Center');
    const [hospitalPhone, setHospitalPhone] = useState('+233 30 266 5401');
    const [hospitalEmail, setHospitalEmail] = useState('admin@kbth.gov.gh');
    const [hospitalAddress, setHospitalAddress] = useState('Guggisberg Ave, Accra, Greater Accra Region, Ghana');
    const [newDeptName, setNewDeptName] = useState('');
    const [showAddDept, setShowAddDept] = useState(false);
    const [treeSearch, setTreeSearch] = useState('');

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const handleDeleteNode = (id: string) => {
        setTree(prev => removeNode(prev, id));
        showToast('Item removed from hierarchy');
    };

    const handleAddDept = () => {
        if (!newDeptName.trim()) return;
        const newNode: DeptNode = { id: `new-${Date.now()}`, name: newDeptName, type: 'dept', children: [] };
        setTree(prev => [...prev, newNode]);
        setNewDeptName('');
        setShowAddDept(false);
        showToast(`${newDeptName} added`);
    };

    const deptCount = countNodes(tree, 'dept');
    const wardCount = countNodes(tree, 'ward');
    const totalBeds = countBeds(tree);

    return (
        <div className="app-shell">
            <Sidebar sections={navSections} />

            {/* Toast */}
            {toast && (
                <div className="toast-enter" style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '10px 18px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 8, }}>
                    <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--success)' }}>check_circle</span>
                    {toast}
                </div>
            )}

            <div className="app-main">
                <TopBar
                    title="Hospital Setup"
                    breadcrumbs={['Admin', 'Configuration']}
                    actions={
                        <button className="btn btn-primary btn-sm" onClick={() => showToast('All changes saved')}>
                            <span className="material-icons-round" style={{ fontSize: 15 }}>save</span>
                            Save Changes
                        </button>
                    }
                />
            <main style={{ flex: 1, overflow: 'auto', padding: '20px 24px', background: 'var(--bg-900)' }}>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20, alignItems: 'start' }}>
                    {/* Profile Card */}
                    <div>
                        <div className="fade-in delay-1 card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(30,58,95,0.15), rgba(74,111,165,0.08))',
                                padding: '24px 20px',
                                borderBottom: '1px solid var(--border-subtle)',
                            }}>
                                <div className="badge badge-success" style={{ marginBottom: 10 }}>Active License</div>
                                <h2>{hospitalName}</h2>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginTop: 4 }}>
                                    License #GH-9822-X
                                </div>
                            </div>

                            {editingProfile ? (
                                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div>
                                        <label className="label">Hospital Name</label>
                                        <input className="input" value={hospitalName} onChange={e => setHospitalName(e.target.value)} style={{ fontSize: 13 }} />
                                    </div>
                                    <div>
                                        <label className="label">Address</label>
                                        <input className="input" value={hospitalAddress} onChange={e => setHospitalAddress(e.target.value)} style={{ fontSize: 13 }} />
                                    </div>
                                    <div>
                                        <label className="label">Phone</label>
                                        <input className="input" value={hospitalPhone} onChange={e => setHospitalPhone(e.target.value)} style={{ fontSize: 13 }} />
                                    </div>
                                    <div>
                                        <label className="label">Email</label>
                                        <input className="input" value={hospitalEmail} onChange={e => setHospitalEmail(e.target.value)} style={{ fontSize: 13 }} />
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                        <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setEditingProfile(false); showToast('Profile updated'); }}>
                                            <span className="material-icons-round" style={{ fontSize: 14 }}>save</span>Save
                                        </button>
                                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingProfile(false)}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {[
                                        { icon: 'location_on', label: hospitalAddress },
                                        { icon: 'phone', label: hospitalPhone },
                                        { icon: 'email', label: hospitalEmail },
                                        { icon: 'bed', label: `${totalBeds} Licensed Beds` },
                                        { icon: 'local_hospital', label: 'National Referral Centre' },
                                    ].map(row => (
                                        <div key={row.icon} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                            <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--helix-primary-light)', marginTop: 1 }}>{row.icon}</span>
                                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{row.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8 }}>
                                <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setEditingProfile(!editingProfile)}>
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>{editingProfile ? 'close' : 'edit'}</span>
                                    {editingProfile ? 'Cancel' : 'Edit Profile'}
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => showToast('Logo upload coming soon')}>
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>upload</span>
                                    Logo
                                </button>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="fade-in delay-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            {[
                                { label: 'Departments', value: String(deptCount) },
                                { label: 'Wards', value: String(wardCount) },
                                { label: 'Total Beds', value: String(totalBeds) },
                                { label: 'Active Staff', value: '892' },
                            ].map(s => (
                                <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{s.value}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Hierarchy Tree */}
                    <div className="fade-in delay-2 card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div>
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className="material-icons-round" style={{ color: 'var(--helix-primary-light)' }}>account_tree</span>
                                    Structure & Hierarchy
                                </h2>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                                    Define departments, wards, and bed allocations.
                                </p>
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={() => setShowAddDept(!showAddDept)}>
                                <span className="material-icons-round" style={{ fontSize: 14 }}>{showAddDept ? 'close' : 'add'}</span>
                                {showAddDept ? 'Cancel' : 'Add'}
                            </button>
                        </div>

                        {showAddDept && (
                            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                <input className="input" placeholder="New department name..." value={newDeptName} onChange={e => setNewDeptName(e.target.value)} style={{ fontSize: 13, flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleAddDept()} />
                                <button className="btn btn-primary btn-sm" onClick={handleAddDept} disabled={!newDeptName.trim()}>
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>add</span>Add
                                </button>
                            </div>
                        )}

                        <div style={{ marginBottom: 12 }}>
                            <input className="input" placeholder="Search departments, units, wards..." value={treeSearch} onChange={e => setTreeSearch(e.target.value)} style={{ fontSize: 13 }} />
                        </div>

                        <div style={{
                            background: 'var(--surface-2)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-subtle)',
                            overflow: 'hidden',
                        }}>
                            {tree.filter(node => !treeSearch || node.name.toLowerCase().includes(treeSearch.toLowerCase())).map(node => (
                                <div key={node.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <TreeNode node={node} onDelete={handleDeleteNode} />
                                </div>
                            ))}
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddDept(true)} style={{
                                width: '100%', justifyContent: 'flex-start',
                                padding: '12px 16px', borderRadius: 0,
                                color: 'var(--helix-primary-light)',
                            }}>
                                <span className="material-icons-round" style={{ fontSize: 16 }}>add_circle_outline</span>
                                New Department
                            </button>
                        </div>
                    </div>
                </div>
            </main>
            </div>
        </div>
    );
}
