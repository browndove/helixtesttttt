'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

type Admin = {
    id: string;
    name: string;
    email: string;
    role: 'Super Admin' | 'Admin' | 'Editor' | 'Viewer';
    status: 'Active' | 'Invited' | 'Disabled';
    lastLogin: string;
};

const mockAdmins: Admin[] = [
    { id: '1', name: 'Dr. Kwame Asante', email: 'k.asante@accramedical.com', role: 'Super Admin', status: 'Active', lastLogin: '2 hours ago' },
    { id: '2', name: 'Ama Mensah', email: 'a.mensah@accramedical.com', role: 'Admin', status: 'Active', lastLogin: '1 day ago' },
    { id: '3', name: 'Kofi Boateng', email: 'k.boateng@accramedical.com', role: 'Editor', status: 'Active', lastLogin: '3 days ago' },
    { id: '4', name: 'Efua Darko', email: 'e.darko@accramedical.com', role: 'Viewer', status: 'Invited', lastLogin: 'Never' },
];

const roleColors: Record<string, string> = {
    'Super Admin': 'var(--helix-primary)',
    'Admin': 'var(--info)',
    'Editor': 'var(--warning)',
    'Viewer': 'var(--text-muted)',
};

export default function SettingsPage() {
    const [toast, setToast] = useState<string | null>(null);

    // Profile
    const [fullName, setFullName] = useState('Dr. Kwame Asante');
    const [email, setEmail] = useState('k.asante@accramedical.com');
    const [phone, setPhone] = useState('+233 24 123 4567');
    const [jobTitle, setJobTitle] = useState('Chief Medical Officer');

    // Security
    const [twoFactor, setTwoFactor] = useState(false);
    const [sessionTimeout, setSessionTimeout] = useState('30');

    // Admins
    const [admins] = useState<Admin[]>(mockAdmins);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<Admin['role']>('Admin');

    // Active tab
    const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'admins'>('profile');

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const tabs = [
        { id: 'profile' as const, label: 'Profile', icon: 'person' },
        { id: 'security' as const, label: 'Security', icon: 'shield' },
        { id: 'admins' as const, label: 'Admin Users', icon: 'admin_panel_settings' },
    ];

    const initials = fullName.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

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
                <TopBar title="Settings" subtitle="User & System Preferences" />

                <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>
                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: 3, width: 'fit-content' }}>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '8px 16px', borderRadius: 'var(--radius-sm)',
                                    fontSize: 12.5, fontWeight: activeTab === tab.id ? 600 : 500,
                                    color: activeTab === tab.id ? 'var(--helix-primary)' : 'var(--text-secondary)',
                                    background: activeTab === tab.id ? '#fff' : 'transparent',
                                    border: activeTab === tab.id ? '1px solid var(--border-default)' : '1px solid transparent',
                                    boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                                    cursor: 'pointer', transition: 'all 0.15s',
                                }}
                            >
                                <span className="material-icons-round" style={{ fontSize: 15, opacity: activeTab === tab.id ? 1 : 0.55 }}>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Profile Tab */}
                    {activeTab === 'profile' && (
                        <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 900 }}>
                            {/* Profile Card */}
                            <div className="card" style={{ gridColumn: '1 / -1' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                                    <div style={{
                                        width: 64, height: 64, borderRadius: '50%',
                                        background: 'var(--helix-primary)', color: '#fff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 22, fontWeight: 700, letterSpacing: '0.02em', flexShrink: 0,
                                    }}>
                                        {initials}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{fullName}</h3>
                                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{jobTitle} · Super Admin</p>
                                    </div>
                                    <button className="btn btn-secondary btn-sm" onClick={() => showToast('Photo upload coming soon')}>
                                        <span className="material-icons-round" style={{ fontSize: 14 }}>add_a_photo</span>
                                        Change Photo
                                    </button>
                                </div>
                            </div>

                            {/* Personal Info */}
                            <div className="card">
                                <h3 style={{ marginBottom: 16 }}>Personal Information</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div>
                                        <label className="label">Full Name</label>
                                        <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} style={{ fontSize: 13 }} />
                                    </div>
                                    <div>
                                        <label className="label">Job Title</label>
                                        <input className="input" value={jobTitle} onChange={e => setJobTitle(e.target.value)} style={{ fontSize: 13 }} />
                                    </div>
                                    <div>
                                        <label className="label">Email</label>
                                        <input className="input" value={email} onChange={e => setEmail(e.target.value)} type="email" style={{ fontSize: 13 }} />
                                    </div>
                                    <div>
                                        <label className="label">Phone</label>
                                        <input className="input" value={phone} onChange={e => setPhone(e.target.value)} style={{ fontSize: 13 }} />
                                    </div>
                                </div>
                                <button className="btn btn-primary btn-sm" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={() => showToast('Profile updated')}>
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>save</span>
                                    Save Changes
                                </button>
                            </div>

                            {/* Password */}
                            <div className="card">
                                <h3 style={{ marginBottom: 16 }}>Change Password</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div>
                                        <label className="label">Current Password</label>
                                        <input className="input" type="password" placeholder="Enter current password" style={{ fontSize: 13 }} />
                                    </div>
                                    <div>
                                        <label className="label">New Password</label>
                                        <input className="input" type="password" placeholder="Enter new password" style={{ fontSize: 13 }} />
                                    </div>
                                    <div>
                                        <label className="label">Confirm New Password</label>
                                        <input className="input" type="password" placeholder="Confirm new password" style={{ fontSize: 13 }} />
                                    </div>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
                                    Password must be at least 8 characters with one uppercase, one number, and one special character.
                                </div>
                                <button className="btn btn-secondary btn-sm" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }} onClick={() => showToast('Password updated')}>
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>lock_reset</span>
                                    Update Password
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Security Tab */}
                    {activeTab === 'security' && (
                        <div className="fade-in" style={{ maxWidth: 600 }}>
                            <div className="card" style={{ marginBottom: 16 }}>
                                <h3 style={{ marginBottom: 16 }}>Two-Factor Authentication</h3>
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '12px 14px', borderRadius: 'var(--radius-md)',
                                    background: twoFactor ? 'var(--success-bg)' : 'var(--surface-2)',
                                    border: `1px solid ${twoFactor ? '#d5e8dd' : 'var(--border-default)'}`,
                                    transition: 'all 0.2s',
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 13, color: twoFactor ? 'var(--success)' : 'var(--text-primary)' }}>
                                            {twoFactor ? '2FA is Enabled' : '2FA is Disabled'}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                            {twoFactor ? 'Your account is protected with two-factor authentication.' : 'Enable 2FA for extra security on your account.'}
                                        </div>
                                    </div>
                                    <label className="toggle">
                                        <input type="checkbox" checked={twoFactor} onChange={() => { setTwoFactor(!twoFactor); showToast(twoFactor ? '2FA disabled' : '2FA enabled'); }} />
                                        <span className="toggle-slider" />
                                    </label>
                                </div>
                            </div>

                            <div className="card" style={{ marginBottom: 16 }}>
                                <h3 style={{ marginBottom: 16 }}>Session Settings</h3>
                                <div>
                                    <label className="label">Auto-logout after inactivity</label>
                                    <select className="input" value={sessionTimeout} onChange={e => setSessionTimeout(e.target.value)} style={{ fontSize: 13 }}>
                                        <option value="15">15 minutes</option>
                                        <option value="30">30 minutes</option>
                                        <option value="60">1 hour</option>
                                        <option value="120">2 hours</option>
                                        <option value="never">Never</option>
                                    </select>
                                </div>
                                <button className="btn btn-primary btn-sm" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={() => showToast('Session settings saved')}>
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>save</span>
                                    Save Security Settings
                                </button>
                            </div>

                            <div className="card">
                                <h3 style={{ marginBottom: 16 }}>Active Sessions</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {[
                                        { device: 'Chrome on macOS', location: 'Accra, Ghana', time: 'Current session', current: true },
                                        { device: 'Safari on iPhone', location: 'Accra, Ghana', time: '2 hours ago', current: false },
                                    ].map((s, i) => (
                                        <div key={i} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '10px 12px', borderRadius: 'var(--radius-md)',
                                            background: s.current ? 'rgba(59,130,246,0.06)' : 'var(--surface-2)',
                                            border: `1px solid ${s.current ? 'rgba(59,130,246,0.2)' : 'var(--border-subtle)'}`,
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <span className="material-icons-round" style={{ fontSize: 18, color: s.current ? 'var(--helix-primary)' : 'var(--text-muted)' }}>
                                                    {s.device.includes('iPhone') ? 'phone_iphone' : 'laptop'}
                                                </span>
                                                <div>
                                                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                                                        {s.device}
                                                        {s.current && <span className="badge badge-info" style={{ fontSize: 9, marginLeft: 6 }}>Current</span>}
                                                    </div>
                                                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{s.location} · {s.time}</div>
                                                </div>
                                            </div>
                                            {!s.current && (
                                                <button className="btn btn-danger btn-xs" onClick={() => showToast('Session revoked')}>Revoke</button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Admins Tab */}
                    {activeTab === 'admins' && (
                        <div className="fade-in" style={{ maxWidth: 800 }}>
                            <div className="card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <div>
                                        <h3 style={{ marginBottom: 2 }}>Hospital Administrators</h3>
                                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{admins.length} admin users</p>
                                    </div>
                                    <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(!showInvite)}>
                                        <span className="material-icons-round" style={{ fontSize: 14 }}>{showInvite ? 'close' : 'person_add'}</span>
                                        {showInvite ? 'Cancel' : 'Invite Admin'}
                                    </button>
                                </div>

                                {showInvite && (
                                    <div style={{
                                        display: 'flex', gap: 8, marginBottom: 16, padding: 14,
                                        background: 'var(--surface-2)', borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border-default)',
                                    }}>
                                        <input
                                            className="input"
                                            placeholder="Email address"
                                            value={inviteEmail}
                                            onChange={e => setInviteEmail(e.target.value)}
                                            style={{ fontSize: 12, flex: 1 }}
                                        />
                                        <select
                                            className="input"
                                            value={inviteRole}
                                            onChange={e => setInviteRole(e.target.value as Admin['role'])}
                                            style={{ fontSize: 12, width: 140 }}
                                        >
                                            <option value="Admin">Admin</option>
                                            <option value="Editor">Editor</option>
                                            <option value="Viewer">Viewer</option>
                                        </select>
                                        <button className="btn btn-primary btn-sm" onClick={() => { showToast(`Invite sent to ${inviteEmail}`); setInviteEmail(''); setShowInvite(false); }} disabled={!inviteEmail.trim()}>
                                            <span className="material-icons-round" style={{ fontSize: 14 }}>send</span>
                                            Send Invite
                                        </button>
                                    </div>
                                )}

                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                                            <th style={{ padding: '8px 12px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }}>User</th>
                                            <th style={{ padding: '8px 12px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }}>Role</th>
                                            <th style={{ padding: '8px 12px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }}>Status</th>
                                            <th style={{ padding: '8px 12px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }}>Last Login</th>
                                            <th style={{ padding: '8px 12px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {admins.map(admin => {
                                            const adminInitials = admin.name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
                                            const isSelf = admin.id === '1';
                                            return (
                                                <tr key={admin.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                                    <td style={{ padding: '12px 12px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <div style={{
                                                                width: 30, height: 30, borderRadius: '50%',
                                                                background: roleColors[admin.role] || 'var(--surface-3)',
                                                                color: '#fff',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: 10, fontWeight: 700, flexShrink: 0,
                                                            }}>
                                                                {adminInitials}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                                                                    {admin.name}
                                                                    {isSelf && <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 4 }}>(You)</span>}
                                                                </div>
                                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{admin.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px 12px' }}>
                                                        <span style={{
                                                            fontSize: 11, fontWeight: 600,
                                                            color: roleColors[admin.role] || 'var(--text-secondary)',
                                                            background: `${roleColors[admin.role] || 'var(--surface-3)'}15`,
                                                            padding: '3px 8px', borderRadius: 8,
                                                        }}>
                                                            {admin.role}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 12px' }}>
                                                        <span className={`badge ${admin.status === 'Active' ? 'badge-success' : admin.status === 'Invited' ? 'badge-info' : 'badge-neutral'}`} style={{ fontSize: 10 }}>
                                                            {admin.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                                                        {admin.lastLogin}
                                                    </td>
                                                    <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                                                        {!isSelf && (
                                                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                                                <button className="btn btn-secondary btn-xs" onClick={() => showToast(`Editing ${admin.name}`)}>
                                                                    <span className="material-icons-round" style={{ fontSize: 12 }}>edit</span>
                                                                </button>
                                                                <button className="btn btn-danger btn-xs" onClick={() => showToast(`${admin.name} removed`)}>
                                                                    <span className="material-icons-round" style={{ fontSize: 12 }}>delete</span>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                        <strong>Role Permissions:</strong> Super Admins have full access. Admins can manage staff and escalation. Editors can modify roles and settings. Viewers have read-only access.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
