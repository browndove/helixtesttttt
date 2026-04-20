'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { API_ENDPOINTS } from '@/lib/config';
import { clearAdminSidebarSession } from '@/lib/facilityDisplayCache';
import CustomSelect from '@/components/CustomSelect';
import { formatGhanaPhoneInput, isValidGhanaPhone } from '@/lib/phone';
import { MacVibrancyToast, MacVibrancyToastPortal } from '@/components/MacVibrancyToast';

type Admin = {
    id: string;
    name: string;
    email: string;
    role: 'Super Admin' | 'Admin' | 'Editor' | 'Viewer';
    status: 'Active' | 'Invited' | 'Disabled';
    lastLogin: string;
};

type SessionEntry = {
    id: string;
    device: string;
    location: string;
    time: string;
    current: boolean;
};

type StaffLite = {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    job_title: string;
    role: string;
    status: string;
};

/** Max length for job title on profile (aligned with staff update API). */
const JOB_TITLE_MAX_LENGTH = 80;

const roleColors: Record<string, string> = {
    'Super Admin': 'var(--helix-primary)',
    'Admin': 'var(--info)',
    'Editor': 'var(--warning)',
    'Viewer': 'var(--text-muted)',
};

function formatRoleLabel(role?: string): string {
    if (!role) return 'Admin';
    return role
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

function formatSessionTime(ts?: string): string {
    if (!ts) return 'Unknown';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function parseSessions(raw: unknown): SessionEntry[] {
    const list = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === 'object'
            ? ((raw as { items?: unknown; data?: unknown; sessions?: unknown }).items
                || (raw as { items?: unknown; data?: unknown; sessions?: unknown }).data
                || (raw as { items?: unknown; data?: unknown; sessions?: unknown }).sessions)
            : []);
    if (!Array.isArray(list)) return [];

    return list
        .map((s: unknown, idx): SessionEntry | null => {
            if (!s || typeof s !== 'object') return null;
            const rec = s as Record<string, unknown>;
            const device = String(rec.device || rec.user_agent || rec.device_name || 'Unknown Device');
            const location = String(rec.location || rec.ip || rec.ip_address || 'Unknown Location');
            const time = formatSessionTime(String(rec.last_active_at || rec.updated_at || rec.created_at || ''));
            const current = Boolean(rec.current ?? rec.is_current ?? false);
            return {
                id: String(rec.id || rec.session_id || `session-${idx}`),
                device,
                location,
                time: current ? 'Current session' : time,
                current,
            };
        })
        .filter((s): s is SessionEntry => Boolean(s));
}

function normalizeAdminRole(value?: string): Admin['role'] {
    const role = String(value || '').trim().toLowerCase();
    if (role === 'superadmin' || role === 'super_admin' || role === 'super-admin') return 'Super Admin';
    if (role === 'editor') return 'Editor';
    if (role === 'viewer') return 'Viewer';
    return 'Admin';
}

function isAdminLikeRole(value?: string): boolean {
    const role = String(value || '').trim().toLowerCase();
    return role.includes('admin');
}

function normalizeAdminStatus(value?: string): Admin['status'] {
    const status = String(value || '').trim().toLowerCase();
    if (status.includes('invite') || status.includes('pending')) return 'Invited';
    if (status.includes('disable') || status.includes('suspend')) return 'Disabled';
    return 'Active';
}

function parseAdmins(raw: unknown): Admin[] {
    const list = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === 'object'
            ? ((raw as { items?: unknown; data?: unknown; staff?: unknown }).items
                || (raw as { items?: unknown; data?: unknown; staff?: unknown }).data
                || (raw as { items?: unknown; data?: unknown; staff?: unknown }).staff)
            : []);
    if (!Array.isArray(list)) return [];

    return list
        .map((row: unknown, idx): Admin | null => {
            if (!row || typeof row !== 'object') return null;
            const r = row as Record<string, unknown>;
            const roleRaw = String(r.system_role || r.user_role || r.role || r.access || '').trim();
            if (!isAdminLikeRole(roleRaw)) return null;
            const first = String(r.first_name || '').trim();
            const last = String(r.last_name || '').trim();
            const derivedName = `${first} ${last}`.trim();
            const email = String(r.email || '').trim();
            const fallbackName = email.includes('@') ? email.split('@')[0] : `Admin ${idx + 1}`;
            const lastSeenRaw = String(r.last_login_at || r.last_login || r.last_seen_at || r.updated_at || '');

            return {
                id: String(r.id || r.staff_id || r.user_id || `admin-${idx}`),
                name: String(r.name || r.username || derivedName || fallbackName),
                email,
                role: normalizeAdminRole(roleRaw),
                status: normalizeAdminStatus(String(r.status || 'active')),
                lastLogin: lastSeenRaw ? formatSessionTime(lastSeenRaw) : 'Never',
            };
        })
        .filter((admin): admin is Admin => Boolean(admin));
}

function parseStaffLite(raw: unknown): StaffLite[] {
    const list = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === 'object'
            ? ((raw as { items?: unknown; data?: unknown; staff?: unknown }).items
                || (raw as { items?: unknown; data?: unknown; staff?: unknown }).data
                || (raw as { items?: unknown; data?: unknown; staff?: unknown }).staff)
            : []);
    if (!Array.isArray(list)) return [];

    return list
        .map((row: unknown, idx): StaffLite | null => {
            if (!row || typeof row !== 'object') return null;
            const r = row as Record<string, unknown>;
            return {
                id: String(r.id || r.staff_id || `staff-${idx}`),
                email: String(r.email || '').trim(),
                first_name: String(r.first_name || '').trim(),
                last_name: String(r.last_name || '').trim(),
                phone: String(r.phone || '').trim(),
                job_title: String(r.job_title || '').trim(),
                role: String(r.role || r.system_role || '').trim(),
                status: String(r.status || '').trim(),
            };
        })
        .filter((staff): staff is StaffLite => staff !== null && staff.email.length > 0);
}

export default function SettingsPage() {
    const router = useRouter();
    const [toast, setToast] = useState<string | null>(null);
    const [loadingSecurity, setLoadingSecurity] = useState(true);
    const [savingSecurity, setSavingSecurity] = useState(false);
    const [loadingAdmins, setLoadingAdmins] = useState(true);

    // Profile
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [userRole, setUserRole] = useState('Admin');
    const [currentUserId, setCurrentUserId] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);

    // Security
    const [twoFactor, setTwoFactor] = useState(false);
    const [sessionTimeout, setSessionTimeout] = useState('30');
    const [sessions, setSessions] = useState<SessionEntry[]>([]);

    // Admins
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteFirstName, setInviteFirstName] = useState('');
    const [inviteLastName, setInviteLastName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [invitePhone, setInvitePhone] = useState('');
    const [inviteJobTitle, setInviteJobTitle] = useState('Administrator');
    const [invitingAdmin, setInvitingAdmin] = useState(false);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const savePersonalProfile = async () => {
        if (!currentUserId.trim()) {
            showToast('Could not resolve your account. Try signing in again.');
            return;
        }
        const trimmedTitle = jobTitle.trim().slice(0, JOB_TITLE_MAX_LENGTH);
        const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        setSavingProfile(true);
        try {
            let existing: Record<string, unknown> = {};
            const getRes = await fetch(`/api/proxy/staff/${currentUserId}`);
            if (getRes.ok) {
                const raw = await getRes.json();
                existing = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
            }

            const body: Record<string, unknown> = {
                first_name: firstName || String(existing.first_name || '').trim(),
                last_name: lastName || String(existing.last_name || '').trim(),
                email: email.trim() || String(existing.email || '').trim(),
                phone: formatGhanaPhoneInput(phone) || String(existing.phone || '').trim(),
                job_title: trimmedTitle,
                role: String(existing.role || existing.system_role || 'admin').toLowerCase() || 'admin',
                status: String(existing.status || 'active'),
            };

            const putRes = await fetch(`/api/proxy/staff/${currentUserId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const errData = await putRes.json().catch(() => ({} as { message?: string; detail?: string; error?: string }));
            if (!putRes.ok) {
                showToast(String(errData.message || errData.detail || errData.error || 'Failed to save profile'));
                return;
            }
            setJobTitle(trimmedTitle);
            showToast('Profile updated');
            await loadSecurityData();
        } catch {
            showToast('Failed to save profile');
        } finally {
            setSavingProfile(false);
        }
    };

    const loadSecurityData = useCallback(async () => {
        setLoadingSecurity(true);
        setLoadingAdmins(true);
        setCurrentUserId('');
        try {
            const [meRes, sessionsRes] = await Promise.all([
                fetch(API_ENDPOINTS.AUTH_ME),
                fetch(API_ENDPOINTS.AUTH_SESSIONS),
            ]);
            let resolvedFacilityId = '';
            let currentUser: Record<string, unknown> | null = null;

            if (meRes.ok) {
                const me = await meRes.json();
                const user = me?.user && typeof me.user === 'object' ? me.user : me;
                currentUser = user && typeof user === 'object' ? user as Record<string, unknown> : null;
                const staffRec = me?.staff && typeof me.staff === 'object' ? me.staff as Record<string, unknown> : null;
                const staffId = String(staffRec?.id || staffRec?.staff_id || '').trim();
                const userId = String(user?.id || '').trim();
                setCurrentUserId(staffId || userId);
                const first = String(user?.first_name || '').trim();
                const last = String(user?.last_name || '').trim();
                const derivedName = String(user?.name || `${first} ${last}`.trim());
                if (derivedName) setFullName(derivedName);
                if (user?.email) setEmail(String(user.email));
                if (user?.phone) setPhone(formatGhanaPhoneInput(String(user.phone)));
                if (user?.job_title || user?.title) setJobTitle(String(user?.job_title || user?.title));
                if (user?.role) setUserRole(formatRoleLabel(String(user.role)));
                resolvedFacilityId = String(
                    user?.facility_id
                    || user?.facilityId
                    || user?.hospital_id
                    || user?.hospitalId
                    || ''
                );
                setTwoFactor(Boolean(
                    me?.otp_enabled
                    ?? me?.two_factor_enabled
                    ?? me?.two_factor
                    ?? me?.twoFactorEnabled
                    ?? false
                ));
                const timeoutVal = me?.inactivity_timeout_minutes ?? me?.session_timeout_minutes ?? me?.session_timeout;
                if (typeof timeoutVal === 'number' && timeoutVal > 0) setSessionTimeout(String(timeoutVal));
                if (timeoutVal === 'never') setSessionTimeout('never');
            }

            if (sessionsRes.ok) {
                const rawSessions = await sessionsRes.json();
                setSessions(parseSessions(rawSessions));
            }

            const adminParams = new URLSearchParams({
                page_size: '100',
                page_id: '1',
            });
            if (resolvedFacilityId) adminParams.set('facility_id', resolvedFacilityId);
            const adminsRes = await fetch(`/api/proxy/staff?${adminParams.toString()}`);
            if (adminsRes.ok) {
                const rawAdmins = await adminsRes.json();
                const parsedAdmins = parseAdmins(rawAdmins);

                if (currentUser) {
                    const userId = String(currentUser.id || '').trim();
                    const userRoleRaw = String(currentUser.role || currentUser.system_role || '').trim();
                    if (userId && isAdminLikeRole(userRoleRaw) && !parsedAdmins.some(a => a.id === userId)) {
                        const first = String(currentUser.first_name || '').trim();
                        const last = String(currentUser.last_name || '').trim();
                        const derivedName = String(currentUser.name || `${first} ${last}`.trim() || 'Administrator');
                        parsedAdmins.unshift({
                            id: userId,
                            name: derivedName,
                            email: String(currentUser.email || ''),
                            role: normalizeAdminRole(userRoleRaw),
                            status: normalizeAdminStatus(String(currentUser.status || 'active')),
                            lastLogin: 'Current session',
                        });
                    }
                }

                setAdmins(parsedAdmins);
            } else {
                setAdmins([]);
            }
        } catch {
            // Keep existing defaults if backend fetch fails.
            setAdmins([]);
        } finally {
            setLoadingSecurity(false);
            setLoadingAdmins(false);
        }
    }, []);

    useEffect(() => { loadSecurityData(); }, [loadSecurityData]);

    const saveSessionSettings = async () => {
        setSavingSecurity(true);
        try {
            const payload = {
                session_timeout_minutes: sessionTimeout === 'never' ? null : Number(sessionTimeout),
            };
            const res = await fetch(API_ENDPOINTS.AUTH_SETTINGS, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error('Failed');
            showToast('Session settings saved');
        } catch {
            showToast('Failed to save session settings');
        } finally {
            setSavingSecurity(false);
        }
    };

    const toggleTwoFactor = async () => {
        const next = !twoFactor;
        setTwoFactor(next);
        try {
            const res = await fetch(API_ENDPOINTS.AUTH_SETTINGS, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ two_factor_enabled: next }),
            });
            if (!res.ok) throw new Error('Failed');
            showToast(next ? '2FA enabled' : '2FA disabled');
        } catch {
            setTwoFactor(!next);
            showToast('Failed to update 2FA');
        }
    };

    const revokeSession = async (sessionId: string) => {
        try {
            const res = await fetch(API_ENDPOINTS.AUTH_SESSION(sessionId), { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed');
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            showToast('Session revoked');
        } catch {
            showToast('Failed to revoke session');
        }
    };

    const handleLogout = async () => {
        try {
            await fetch(API_ENDPOINTS.LOGOUT, { method: 'POST' });
        } catch {
            // Continue logout UX even if request fails.
        }
        clearAdminSidebarSession();
        router.replace('/login');
    };

    const sendPasswordResetEmail = async (targetEmail: string): Promise<boolean> => {
        try {
            const res = await fetch(API_ENDPOINTS.REQUEST_RESET, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: targetEmail }),
            });
            return res.ok;
        } catch {
            return false;
        }
    };

    const handleInviteAdmin = async () => {
        if (!inviteFirstName.trim() || !inviteLastName.trim() || !inviteEmail.trim() || !invitePhone.trim()) {
            showToast('Please fill first name, last name, email, and phone');
            return;
        }
        if (!isValidGhanaPhone(invitePhone)) {
            showToast('Phone must be +233 followed by 9 digits');
            return;
        }

        setInvitingAdmin(true);
        try {
            const emailNormalized = inviteEmail.trim().toLowerCase();
            const res = await fetch('/api/proxy/staff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: inviteFirstName.trim(),
                    last_name: inviteLastName.trim(),
                    email: inviteEmail.trim(),
                    phone: formatGhanaPhoneInput(invitePhone),
                    job_title: inviteJobTitle.trim() || 'Administrator',
                    role: 'admin',
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (res.status === 409) {
                const lookupParams = new URLSearchParams({
                    page_size: '100',
                    page_id: '1',
                    search: inviteEmail.trim(),
                });
                const lookupRes = await fetch(`/api/proxy/staff?${lookupParams.toString()}`);
                if (lookupRes.ok) {
                    const lookupRaw = await lookupRes.json();
                    const existing = parseStaffLite(lookupRaw)
                        .find((s) => s.email.trim().toLowerCase() === emailNormalized);

                    if (existing) {
                        if (isAdminLikeRole(existing.role)) {
                            const resetSent = await sendPasswordResetEmail(inviteEmail.trim());
                            showToast(
                                resetSent
                                    ? `${inviteEmail} is already an admin. Password reset email sent.`
                                    : `${inviteEmail} is already an admin`
                            );
                            return;
                        }

                        const promoteRes = await fetch(`/api/proxy/staff/${existing.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                first_name: inviteFirstName.trim() || existing.first_name,
                                last_name: inviteLastName.trim() || existing.last_name,
                                email: inviteEmail.trim(),
                                phone: invitePhone.trim() ? formatGhanaPhoneInput(invitePhone) : existing.phone,
                                job_title: inviteJobTitle.trim() || existing.job_title || 'Administrator',
                                role: 'admin',
                                status: existing.status || 'active',
                            }),
                        });
                        const promoteData = await promoteRes.json().catch(() => ({}));
                        if (!promoteRes.ok) {
                            showToast(String(promoteData?.message || promoteData?.detail || 'Failed to promote existing staff to admin'));
                            return;
                        }

                        const resetSent = await sendPasswordResetEmail(inviteEmail.trim());
                        showToast(
                            resetSent
                                ? `${inviteEmail} promoted to admin. Password reset email sent.`
                                : `${inviteEmail} promoted to admin`
                        );
                        setInviteFirstName('');
                        setInviteLastName('');
                        setInviteEmail('');
                        setInvitePhone('');
                        setInviteJobTitle('Administrator');
                        setShowInvite(false);
                        await loadSecurityData();
                        return;
                    }
                }

                showToast(String(data?.message || data?.detail || 'Staff with this email already exists'));
                return;
            }
            if (!res.ok) {
                showToast(String(data?.message || data?.detail || 'Failed to invite admin'));
                return;
            }

            showToast(`Invite sent to ${inviteEmail}`);
            setInviteFirstName('');
            setInviteLastName('');
            setInviteEmail('');
            setInvitePhone('');
            setInviteJobTitle('Administrator');
            setShowInvite(false);
            await loadSecurityData();
        } catch {
            showToast('Failed to invite admin');
        } finally {
            setInvitingAdmin(false);
        }
    };

    const displayName = fullName.trim() || 'User';
    const initials = displayName.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const visibleSessions = useMemo(() => sessions, [sessions]);

    return (
        <>
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast} variant="success" dismissible={false} />
                </MacVibrancyToastPortal>
            )}

            <div className="app-main">
                <TopBar title="Settings" subtitle="User & System Preferences" />

                <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>
                    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, width: '100%' }}>
                            {/* Profile Header */}
                            <div className="card" style={{ gridColumn: '1 / -1' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{
                                        width: 64, height: 64, borderRadius: '50%',
                                        background: 'var(--helix-primary)', color: '#fff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 22, fontWeight: 700, letterSpacing: '0.02em', flexShrink: 0,
                                    }}>
                                        {initials}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{displayName}</h3>
                                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{jobTitle || 'No title'} · {userRole}</p>
                                    </div>
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
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                                            <label className="label" htmlFor="settings-job-title" style={{ marginBottom: 0 }}>Job Title</label>
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }} id="settings-job-title-hint">
                                                {jobTitle.length}/{JOB_TITLE_MAX_LENGTH}
                                            </span>
                                        </div>
                                        <input
                                            id="settings-job-title"
                                            className="input"
                                            value={jobTitle}
                                            maxLength={JOB_TITLE_MAX_LENGTH}
                                            onChange={e => setJobTitle(e.target.value.slice(0, JOB_TITLE_MAX_LENGTH))}
                                            placeholder="e.g. Medical Officer"
                                            aria-describedby="settings-job-title-hint"
                                            style={{ fontSize: 13 }}
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Email</label>
                                        <input className="input" value={email} onChange={e => setEmail(e.target.value)} type="email" style={{ fontSize: 13 }} />
                                    </div>
                                    <div>
                                        <label className="label">Phone</label>
                                        <input className="input" value={phone} onChange={e => setPhone(formatGhanaPhoneInput(e.target.value))} style={{ fontSize: 13 }} />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}
                                    onClick={savePersonalProfile}
                                    disabled={savingProfile}
                                >
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>save</span>
                                    {savingProfile ? 'Saving…' : 'Save Changes'}
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

                            {/* Security section */}
                            <div className="card" style={{ gridColumn: '1 / -1' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <h3>Two-Factor Authentication</h3>
                                    <button className="btn btn-danger btn-xs" onClick={handleLogout}>
                                        <span className="material-icons-round" style={{ fontSize: 12 }}>logout</span>
                                        Logout
                                    </button>
                                </div>
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
                                        <input type="checkbox" checked={twoFactor} onChange={toggleTwoFactor} />
                                        <span className="toggle-slider" />
                                    </label>
                                </div>
                            </div>

                            <div className="card">
                                <h3 style={{ marginBottom: 16 }}>Session Settings</h3>
                                <div>
                                    <label className="label">Auto-logout after inactivity</label>
                                    <CustomSelect
                                        value={sessionTimeout}
                                        onChange={v => setSessionTimeout(v)}
                                        options={[
                                            { label: '15 minutes', value: '15' },
                                            { label: '30 minutes', value: '30' },
                                            { label: '1 hour', value: '60' },
                                            { label: '2 hours', value: '120' },
                                            { label: 'Never', value: 'never' },
                                        ]}
                                    />
                                </div>
                                <button className="btn btn-primary btn-sm" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={saveSessionSettings} disabled={savingSecurity}>
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>save</span>
                                    {savingSecurity ? 'Saving...' : 'Save Security Settings'}
                                </button>
                            </div>

                            <div className="card">
                                <h3 style={{ marginBottom: 16 }}>Active Sessions</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {loadingSecurity ? (
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading sessions...</div>
                                    ) : visibleSessions.length === 0 ? (
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No active sessions found</div>
                                    ) : visibleSessions.map((s) => (
                                        <div key={s.id} style={{
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
                                                <button className="btn btn-danger btn-xs" onClick={() => revokeSession(s.id)}>Revoke</button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Admins section */}
                            <div className="card" style={{ gridColumn: '1 / -1' }}>
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
                                        display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, padding: 14,
                                        background: 'var(--surface-2)', borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border-default)',
                                    }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                            <input
                                                className="input"
                                                placeholder="First name"
                                                value={inviteFirstName}
                                                onChange={e => setInviteFirstName(e.target.value)}
                                                style={{ fontSize: 12 }}
                                            />
                                            <input
                                                className="input"
                                                placeholder="Last name"
                                                value={inviteLastName}
                                                onChange={e => setInviteLastName(e.target.value)}
                                                style={{ fontSize: 12 }}
                                            />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                            <input
                                                className="input"
                                                placeholder="Email address"
                                                value={inviteEmail}
                                                onChange={e => setInviteEmail(e.target.value)}
                                                style={{ fontSize: 12 }}
                                            />
                                            <input
                                                className="input"
                                                placeholder="+233201234567"
                                                value={invitePhone}
                                                onChange={e => setInvitePhone(formatGhanaPhoneInput(e.target.value))}
                                                style={{ fontSize: 12 }}
                                            />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                                            <input
                                                className="input"
                                                placeholder="Job title (e.g., Hospital Administrator)"
                                                value={inviteJobTitle}
                                                onChange={e => setInviteJobTitle(e.target.value)}
                                                style={{ fontSize: 12 }}
                                            />
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={handleInviteAdmin}
                                                disabled={invitingAdmin || !inviteFirstName.trim() || !inviteLastName.trim() || !inviteEmail.trim() || !invitePhone.trim()}
                                            >
                                                <span className="material-icons-round" style={{ fontSize: 14 }}>send</span>
                                                {invitingAdmin ? 'Sending...' : 'Send Invite'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                                            <th style={{ padding: '8px 12px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }}>User</th>
                                            <th style={{ padding: '8px 12px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }}>Role</th>
                                            <th style={{ padding: '8px 12px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }}>Status</th>
                                            <th style={{ padding: '8px 12px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }}>Last Login</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadingAdmins ? (
                                            <tr>
                                                <td colSpan={4} style={{ padding: '16px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                                                    Loading facility admins...
                                                </td>
                                            </tr>
                                        ) : admins.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} style={{ padding: '16px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                                                    No facility admins found
                                                </td>
                                            </tr>
                                        ) : admins.map(admin => {
                                            const adminInitials = admin.name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
                                            const isSelf = currentUserId !== '' && admin.id === currentUserId;
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
                </main>
            </div>
        </>
    );
}
