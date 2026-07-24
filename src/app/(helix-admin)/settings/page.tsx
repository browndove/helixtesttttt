'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { API_ENDPOINTS } from '@/lib/config';
import { clearAdminSidebarSession } from '@/lib/facilityDisplayCache';
import { readSettingsPageSnapshot, writeSettingsPageSnapshot, type SettingsPageSnapshotV1 } from '@/lib/settingsPageCache';
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
            const device = String(
                rec.device_label || rec.deviceLabel || rec.device || rec.device_name || rec.user_agent || '',
            ).trim() || 'Unknown Device';
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

/** Normalizes GET /facilities/{id} value to a boolean for UI; API uses strict true/false. */
function readScreenshotsAllowed(raw: unknown): boolean {
    if (raw == null || typeof raw !== 'object') return false;
    const v = (raw as Record<string, unknown>).screenshots_allowed;
    if (v === true) return true;
    if (v === false) return false;
    if (v === 1) return true;
    if (v === 0) return false;
    if (typeof v === 'string') {
        const t = v.trim().toLowerCase();
        if (t === 'true' || t === '1' || t === 'yes' || t === 'on') return true;
        if (t === 'false' || t === '0' || t === 'no' || t === 'off') return false;
    }
    return false;
}

type RetentionMonths = 1 | 3 | 6 | null;

const RETENTION_OPTIONS: Array<{ value: RetentionMonths; label: string }> = [
    { value: null, label: 'Off' },
    { value: 1, label: '1 month' },
    { value: 3, label: '3 months' },
    { value: 6, label: '6 months' },
];

function readConversationRetentionMonths(raw: unknown): RetentionMonths {
    if (raw == null || typeof raw !== 'object') return null;
    const v = (raw as Record<string, unknown>).conversation_retention_months;
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    if (n === 1 || n === 3 || n === 6) return n;
    return null;
}

function retentionLabel(months: RetentionMonths): string {
    if (months === null) return 'Off';
    return months === 1 ? '1 month' : `${months} months`;
}

function tryFacilityIdOnRecord(o: Record<string, unknown> | null | undefined): string {
    if (!o) return '';
    const id = [
        o.facility_id, o.facilityId, o.current_facility_id, o.currentFacilityId, o.hospital_id, o.hospitalId,
    ].find(v => typeof v === 'string' && v.trim());
    return typeof id === 'string' ? id.trim() : '';
}

/** Match Staff/Patients: me root, user, staff, data, nested facility. */
function extractFacilityIdFromMePayload(raw: unknown): string {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '';
    const me = raw as Record<string, unknown>;
    let out = tryFacilityIdOnRecord(me);
    if (out) return out;
    if (me.user && typeof me.user === 'object' && !Array.isArray(me.user)) {
        out = tryFacilityIdOnRecord(me.user as Record<string, unknown>);
        if (out) return out;
    }
    if (me.staff && typeof me.staff === 'object' && !Array.isArray(me.staff)) {
        out = tryFacilityIdOnRecord(me.staff as Record<string, unknown>);
        if (out) return out;
    }
    if (me.data && typeof me.data === 'object' && !Array.isArray(me.data)) {
        out = extractFacilityIdFromMePayload(me.data);
        if (out) return out;
    }
    if (me.facility && typeof me.facility === 'object' && !Array.isArray(me.facility)) {
        const f = me.facility as Record<string, unknown>;
        const id = [f.id, f.facility_id, f.facilityId].find(v => typeof v === 'string' && v.trim());
        if (typeof id === 'string') return id.trim();
    }
    return '';
}

function getFacilityIdFromFacilityPayload(raw: unknown): string {
    if (Array.isArray(raw)) {
        return raw.length > 0 ? getFacilityIdFromFacilityPayload(raw[0]) : '';
    }
    const rec = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const id = [rec.id, rec.facility_id, rec.facilityId].find(v => typeof v === 'string' && v.trim());
    return typeof id === 'string' ? id.trim() : '';
}

export default function SettingsPage() {
    const router = useRouter();
    const [initialSnapshot] = useState(readSettingsPageSnapshot);
    const hydratedFromCache = Boolean(initialSnapshot);
    const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' | 'info' } | null>(null);
    const [loadingSecurity, setLoadingSecurity] = useState(!initialSnapshot);
    const [savingSecurity, setSavingSecurity] = useState(false);
    const [loadingAdmins, setLoadingAdmins] = useState(!initialSnapshot);

    // Profile
    const [fullName, setFullName] = useState(initialSnapshot?.fullName ?? '');
    const [email, setEmail] = useState(initialSnapshot?.email ?? '');
    const [phone, setPhone] = useState(initialSnapshot?.phone ?? '');
    const [jobTitle, setJobTitle] = useState(initialSnapshot?.jobTitle ?? '');
    const [userRole, setUserRole] = useState(initialSnapshot?.userRole ?? 'Admin');
    const [currentUserId, setCurrentUserId] = useState(initialSnapshot?.currentUserId ?? '');
    const [savingProfile, setSavingProfile] = useState(false);

    // Security
    const [twoFactor, setTwoFactor] = useState(initialSnapshot?.twoFactor ?? false);
    const [sessionTimeout, setSessionTimeout] = useState(initialSnapshot?.sessionTimeout ?? '30');
    const [sessions, setSessions] = useState<SessionEntry[]>(initialSnapshot?.sessions ?? []);

    // Admins
    const [revokingAll, setRevokingAll] = useState(false);

    const [admins, setAdmins] = useState<Admin[]>(initialSnapshot?.admins ?? []);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteFirstName, setInviteFirstName] = useState('');
    const [inviteLastName, setInviteLastName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [invitePhone, setInvitePhone] = useState('');
    const [inviteJobTitle, setInviteJobTitle] = useState('Administrator');
    const [invitingAdmin, setInvitingAdmin] = useState(false);

    const [facilityId, setFacilityId] = useState(initialSnapshot?.facilityId ?? '');
    const [screenshotsAllowed, setScreenshotsAllowed] = useState(initialSnapshot?.screenshotsAllowed ?? false);
    const [savingScreenshots, setSavingScreenshots] = useState(false);
    const [retentionMonths, setRetentionMonths] = useState<RetentionMonths>(
        initialSnapshot?.conversationRetentionMonths ?? null,
    );
    const [savingRetention, setSavingRetention] = useState(false);
    const [pendingRetention, setPendingRetention] = useState<RetentionMonths | undefined>(undefined);

    const showToast = (message: string, variant: 'success' | 'error' | 'info' = 'success') => {
        setToast({ message, variant });
        setTimeout(() => setToast(null), 2500);
    };

    const savePersonalProfile = async () => {
        if (!currentUserId.trim()) {
            showToast('Could not resolve your account. Try signing in again.', 'error');
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
                showToast(String(errData.message || errData.detail || errData.error || 'Failed to save profile'), 'error');
                return;
            }
            setJobTitle(trimmedTitle);
            showToast('Profile updated');
            await loadSecurityData();
        } catch {
            showToast('Failed to save profile', 'error');
        } finally {
            setSavingProfile(false);
        }
    };

    const toggleScreenshotsAllowed = async () => {
        if (!facilityId.trim()) {
            showToast('Could not find facility. Try signing in again.', 'error');
            return;
        }
        const next: boolean = !screenshotsAllowed;
        setScreenshotsAllowed(next);
        setSavingScreenshots(true);
        try {
            // API: JSON booleans only — "screenshots_allowed": true or false (not strings)
            const payload: { screenshots_allowed: boolean } = { screenshots_allowed: next };
            const res = await fetch(API_ENDPOINTS.FACILITY(facilityId), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({} as Record<string, unknown>));
            if (!res.ok) {
                setScreenshotsAllowed(!next);
                showToast(String(data?.message || data?.detail || data?.error || 'Failed to update facility'), 'error');
                return;
            }
            if (data && typeof data === 'object' && 'screenshots_allowed' in data) {
                setScreenshotsAllowed(readScreenshotsAllowed(data));
            }
            showToast(next ? 'Screenshots allowed for this facility' : 'Screenshots disabled for this facility');
        } catch {
            setScreenshotsAllowed(!next);
            showToast('Failed to update facility', 'error');
        } finally {
            setSavingScreenshots(false);
        }
    };

    const applyConversationRetention = async (next: RetentionMonths) => {
        if (!facilityId.trim()) {
            showToast('Could not find facility. Try signing in again.', 'error');
            return;
        }
        const prev = retentionMonths;
        setRetentionMonths(next);
        setSavingRetention(true);
        setPendingRetention(undefined);
        try {
            const res = await fetch(API_ENDPOINTS.FACILITY_CONVERSATION_RETENTION(facilityId), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ conversation_retention_months: next }),
            });
            const data = await res.json().catch(() => ({} as Record<string, unknown>));
            if (!res.ok) {
                setRetentionMonths(prev);
                showToast(
                    String(
                        data?.message
                        || data?.detail
                        || data?.error
                        || data?.details
                        || 'Failed to update conversation retention',
                    ),
                    'error',
                );
                return;
            }
            const applied = readConversationRetentionMonths(data);
            // Prefer explicit response field; if omitted on success, keep the value we just saved.
            const nextApplied = 'conversation_retention_months' in data ? applied : next;
            setRetentionMonths(nextApplied);
            if (nextApplied === null) {
                showToast('Conversation retention turned off');
            } else if (prev !== null && nextApplied < prev) {
                showToast(`Retention set to ${retentionLabel(nextApplied)}. Older chats begin deleting in about 7 days.`);
            } else {
                showToast(`Conversation retention set to ${retentionLabel(nextApplied)}`);
            }
        } catch {
            setRetentionMonths(prev);
            showToast('Failed to update conversation retention', 'error');
        } finally {
            setSavingRetention(false);
        }
    };

    const requestConversationRetentionChange = (next: RetentionMonths) => {
        if (next === retentionMonths || savingRetention) return;
        const isShorten = next !== null && retentionMonths !== null && next < retentionMonths;
        const isTurnOff = next === null && retentionMonths !== null;
        if (isShorten || isTurnOff) {
            setPendingRetention(next);
            return;
        }
        void applyConversationRetention(next);
    };

    const loadSecurityData = useCallback(async (opts?: { background?: boolean }) => {
        const background = Boolean(opts?.background);
        if (!background) {
            setLoadingSecurity(true);
            setLoadingAdmins(true);
            setCurrentUserId('');
            setFacilityId('');
        }
        let nextCurrentUserId = '';
        let nextFullName = '';
        let nextEmail = '';
        let nextPhone = '';
        let nextJobTitle = '';
        let nextUserRole = 'Admin';
        let nextTwoFactor = false;
        let nextSessionTimeout = '30';
        try {
            const [meRes, sessionsRes] = await Promise.all([
                fetch(API_ENDPOINTS.AUTH_ME, { credentials: 'include' }),
                fetch(API_ENDPOINTS.AUTH_SESSIONS, { credentials: 'include' }),
            ]);
            // Parse session body in parallel with everything that follows (don’t block on it).
            const sessionsDataPromise: Promise<unknown> = sessionsRes.ok
                ? sessionsRes.json()
                : Promise.resolve(null);

            let resolvedFacilityId = '';
            let currentUser: Record<string, unknown> | null = null;

            if (meRes.ok) {
                const me = await meRes.json();
                resolvedFacilityId = extractFacilityIdFromMePayload(me);
                const user = me?.user && typeof me.user === 'object' ? me.user : me;
                currentUser = user && typeof user === 'object' ? user as Record<string, unknown> : null;
                const staffRec = me?.staff && typeof me.staff === 'object' ? me.staff as Record<string, unknown> : null;
                const staffId = String(staffRec?.id || staffRec?.staff_id || '').trim();
                const userId = String(user?.id || '').trim();
                nextCurrentUserId = (staffId || userId).trim();
                setCurrentUserId(staffId || userId);
                const first = String(user?.first_name || '').trim();
                const last = String(user?.last_name || '').trim();
                const derivedName = String(user?.name || `${first} ${last}`.trim());
                if (derivedName) {
                    setFullName(derivedName);
                    nextFullName = derivedName;
                }
                if (user?.email) {
                    setEmail(String(user.email));
                    nextEmail = String(user.email);
                }
                if (user?.phone) {
                    const f = formatGhanaPhoneInput(String(user.phone));
                    setPhone(f);
                    nextPhone = f;
                }
                if (user?.job_title || user?.title) {
                    const jt = String(user?.job_title || user?.title);
                    setJobTitle(jt);
                    nextJobTitle = jt;
                }
                if (user?.role) {
                    const rl = formatRoleLabel(String(user.role));
                    setUserRole(rl);
                    nextUserRole = rl;
                }
                nextTwoFactor = Boolean(
                    me?.otp_enabled
                    ?? me?.two_factor_enabled
                    ?? me?.two_factor
                    ?? me?.twoFactorEnabled
                    ?? false
                );
                setTwoFactor(nextTwoFactor);
                const timeoutVal = me?.inactivity_timeout_minutes ?? me?.session_timeout_minutes ?? me?.session_timeout;
                if (typeof timeoutVal === 'number' && timeoutVal > 0) {
                    setSessionTimeout(String(timeoutVal));
                    nextSessionTimeout = String(timeoutVal);
                }
                if (timeoutVal === 'never') {
                    setSessionTimeout('never');
                    nextSessionTimeout = 'never';
                }
            }

            if (!resolvedFacilityId && typeof document !== 'undefined') {
                const cookieM = document.cookie.match(/helix-facility=([^;]+)/);
                if (cookieM?.[1]) resolvedFacilityId = cookieM[1].trim();
            }
            if (!resolvedFacilityId) {
                const [hRes, fRes] = await Promise.all([
                    fetch('/api/proxy/hospital', { credentials: 'include' }),
                    fetch('/api/proxy/facilities', { credentials: 'include' }),
                ]);
                const [hospitalData, facilitiesData] = await Promise.all([
                    hRes.ok ? hRes.json() : Promise.resolve(null),
                    fRes.ok ? fRes.json() : Promise.resolve(null),
                ]);
                resolvedFacilityId
                    = getFacilityIdFromFacilityPayload(hospitalData) || getFacilityIdFromFacilityPayload(facilitiesData);
            }

            setFacilityId(resolvedFacilityId);

            const adminParams = new URLSearchParams({
                page_size: '100',
                page_id: '1',
            });
            if (resolvedFacilityId) adminParams.set('facility_id', resolvedFacilityId);

            const [facJson, staffRaw, sessionsData] = await Promise.all([
                resolvedFacilityId
                    ? fetch(API_ENDPOINTS.FACILITY(resolvedFacilityId), { credentials: 'include' })
                        .then(r => (r.ok ? r.json() : null))
                    : Promise.resolve(null),
                fetch(`/api/proxy/staff?${adminParams.toString()}`, { credentials: 'include' })
                    .then(r => (r.ok ? r.json() : null)),
                sessionsDataPromise,
            ]);

            const screenshotsForSnapshot
                = resolvedFacilityId && facJson && typeof facJson === 'object' ? readScreenshotsAllowed(facJson) : false;
            const retentionForSnapshot
                = resolvedFacilityId && facJson && typeof facJson === 'object'
                    ? readConversationRetentionMonths(facJson)
                    : null;
            if (resolvedFacilityId && facJson && typeof facJson === 'object') {
                setScreenshotsAllowed(screenshotsForSnapshot);
                setRetentionMonths(retentionForSnapshot);
            } else {
                setScreenshotsAllowed(false);
                setRetentionMonths(null);
            }

            let finalSessions: SessionEntry[] = [];
            if (sessionsData) {
                finalSessions = parseSessions(sessionsData);
                setSessions(finalSessions);
            } else {
                finalSessions = (readSettingsPageSnapshot()?.sessions as SessionEntry[] | undefined) ?? [];
            }

            let finalAdmins: Admin[] = [];
            if (staffRaw) {
                const parsedAdmins = parseAdmins(staffRaw);

                if (currentUser) {
                    const adminSelfId = String(currentUser.id || '').trim();
                    const userRoleRaw = String(currentUser.role || currentUser.system_role || '').trim();
                    if (adminSelfId && isAdminLikeRole(userRoleRaw) && !parsedAdmins.some(a => a.id === adminSelfId)) {
                        const first = String(currentUser.first_name || '').trim();
                        const last = String(currentUser.last_name || '').trim();
                        const derivedName = String(currentUser.name || `${first} ${last}`.trim() || 'Administrator');
                        parsedAdmins.unshift({
                            id: adminSelfId,
                            name: derivedName,
                            email: String(currentUser.email || ''),
                            role: normalizeAdminRole(userRoleRaw),
                            status: normalizeAdminStatus(String(currentUser.status || 'active')),
                            lastLogin: 'Current session',
                        });
                    }
                }

                finalAdmins = parsedAdmins;
                setAdmins(parsedAdmins);
            } else {
                if (!background) {
                    setAdmins([]);
                }
                finalAdmins = (readSettingsPageSnapshot()?.admins as Admin[] | undefined) ?? [];
            }

            if (meRes.ok) {
                const prev = readSettingsPageSnapshot();
                const shot: SettingsPageSnapshotV1 = {
                    v: 1,
                    currentUserId: nextCurrentUserId || (prev?.currentUserId ?? ''),
                    fullName: nextFullName || (prev?.fullName ?? ''),
                    email: nextEmail || (prev?.email ?? ''),
                    phone: nextPhone || (prev?.phone ?? ''),
                    jobTitle: nextJobTitle || (prev?.jobTitle ?? ''),
                    userRole: nextUserRole || (prev?.userRole ?? 'Admin'),
                    twoFactor: nextTwoFactor,
                    sessionTimeout: nextSessionTimeout,
                    sessions: finalSessions,
                    facilityId: resolvedFacilityId,
                    screenshotsAllowed: screenshotsForSnapshot,
                    conversationRetentionMonths: retentionForSnapshot,
                    admins: finalAdmins,
                };
                writeSettingsPageSnapshot(shot);
            }
        } catch {
            if (!background) {
                setAdmins([]);
            }
        } finally {
            setLoadingSecurity(false);
            setLoadingAdmins(false);
        }
    }, []);

    useEffect(() => { void loadSecurityData({ background: hydratedFromCache }); }, [loadSecurityData, hydratedFromCache]);

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
            showToast('Failed to save session settings', 'error');
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
            showToast('Failed to update 2FA', 'error');
        }
    };

    const revokeSession = async (sessionId: string) => {
        try {
            const res = await fetch(API_ENDPOINTS.AUTH_SESSION(sessionId), { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed');
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            showToast('Session revoked');
        } catch {
            showToast('Failed to revoke session', 'error');
        }
    };

    const revokeAllOtherSessions = async () => {
        const targets = sessions.filter(s => !s.current);
        if (targets.length === 0 || revokingAll) return;
        setRevokingAll(true);
        try {
            const results = await Promise.allSettled(
                targets.map(s => fetch(API_ENDPOINTS.AUTH_SESSION(s.id), { method: 'DELETE' })),
            );
            const revokedIds = new Set(
                targets.filter((_, i) => results[i].status === 'fulfilled' && (results[i] as PromiseFulfilledResult<Response>).value.ok).map(s => s.id),
            );
            setSessions(prev => prev.filter(s => s.current || !revokedIds.has(s.id)));
            if (revokedIds.size === targets.length) {
                showToast('Signed out of all other sessions');
            } else if (revokedIds.size > 0) {
                showToast(`Revoked ${revokedIds.size} of ${targets.length} sessions`, 'info');
            } else {
                showToast('Failed to revoke sessions', 'error');
            }
        } catch {
            showToast('Failed to revoke sessions', 'error');
        } finally {
            setRevokingAll(false);
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
            showToast('Please fill first name, last name, email, and phone', 'error');
            return;
        }
        if (!isValidGhanaPhone(invitePhone)) {
            showToast('Phone must be +233 followed by 9 digits', 'error');
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
                            showToast(String(promoteData?.message || promoteData?.detail || 'Failed to promote existing staff to admin'), 'error');
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

                showToast(String(data?.message || data?.detail || 'Staff with this email already exists'), 'error');
                return;
            }
            if (!res.ok) {
                showToast(String(data?.message || data?.detail || 'Failed to invite admin'), 'error');
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
            showToast('Failed to invite admin', 'error');
        } finally {
            setInvitingAdmin(false);
        }
    };

    const displayName = fullName.trim() || 'User';
    const initials = displayName.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const visibleSessions = useMemo(
        () => [...sessions].sort((a, b) => Number(b.current) - Number(a.current)),
        [sessions],
    );
    const otherSessionsCount = useMemo(() => sessions.filter(s => !s.current).length, [sessions]);

    return (
        <>
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast.message} variant={toast.variant} dismissible={false} />
                </MacVibrancyToastPortal>
            )}

            <div className="app-main">
                <TopBar title="Settings" subtitle="User & System Preferences" />

                <main style={{ flex: 1, overflow: 'auto', padding: '28px 28px 56px', background: 'var(--bg-900)' }}>
                    <div className="fade-in" style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

                        {/* Profile */}
                        <div className="settings-section">
                            <div className="settings-section__header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div style={{
                                        width: 52, height: 52, borderRadius: '50%',
                                        background: 'var(--helix-primary)', color: '#fff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 18, fontWeight: 700, letterSpacing: '0.02em', flexShrink: 0,
                                    }}>
                                        {initials}
                                    </div>
                                    <div>
                                        <h3 className="settings-section__title" style={{ fontSize: 15 }}>{displayName}</h3>
                                        <p className="settings-section__desc">{email || 'No email on file'}</p>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <span className="badge badge-info" style={{ fontSize: 10 }}>{userRole}</span>
                                    {jobTitle && (
                                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>{jobTitle}</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Facility */}
                        <div className="settings-section">
                            <div className="settings-section__header">
                                <div>
                                    <h3 className="settings-section__title">Facility</h3>
                                    <p className="settings-section__desc">Preferences that apply to every staff member at this facility.</p>
                                </div>
                            </div>
                            {loadingSecurity ? (
                                <div className="settings-row">
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading facility…</span>
                                </div>
                            ) : !facilityId ? (
                                <div className="settings-row">
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                                        Couldn&apos;t resolve your facility from your session. Use the facility switcher if your organization has one, or sign in again. If this persists, contact support.
                                    </span>
                                </div>
                            ) : (
                                <>
                                    {/* screenshots (GET/PUT /facilities/{id} screenshots_allowed) */}
                                    <div className="settings-row">
                                        <div>
                                            <div className="settings-row__label">Screenshot capture</div>
                                            <div className="settings-row__desc">
                                                {savingScreenshots
                                                    ? 'Saving…'
                                                    : screenshotsAllowed
                                                        ? 'Staff can capture screenshots in apps that respect this setting.'
                                                        : 'Screenshot capture is blocked in apps that respect this setting.'}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span className={`badge ${screenshotsAllowed ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: 10 }}>
                                                {screenshotsAllowed ? 'Allowed' : 'Blocked'}
                                            </span>
                                            <label className="toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={screenshotsAllowed}
                                                    disabled={savingScreenshots}
                                                    onChange={toggleScreenshotsAllowed}
                                                />
                                                <span className="toggle-slider" />
                                            </label>
                                        </div>
                                    </div>

                                    {/* conversation retention */}
                                    <div className="settings-row settings-row--wrap">
                                        <div style={{ marginBottom: 12 }}>
                                            <div className="settings-row__label">Conversation retention</div>
                                            <div className="settings-row__desc">
                                                Choose how long inactive conversations are kept before Helix removes them from everyone’s inbox.
                                                Activity means messaging — the clock resets when someone sends a message.
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                                            <div className="settings-pill-group" role="radiogroup" aria-label="Conversation retention period">
                                                {RETENTION_OPTIONS.map((opt) => {
                                                    const selected = retentionMonths === opt.value;
                                                    return (
                                                        <button
                                                            key={String(opt.value)}
                                                            type="button"
                                                            role="radio"
                                                            aria-checked={selected}
                                                            disabled={savingRetention}
                                                            onClick={() => requestConversationRetentionChange(opt.value)}
                                                            className={`settings-pill${selected ? ' active' : ''}`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {savingRetention && (
                                                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Saving…</span>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Security */}
                        <div className="settings-section">
                            <div className="settings-section__header">
                                <div>
                                    <h3 className="settings-section__title">Security</h3>
                                    <p className="settings-section__desc">Protect your account and control how long sessions stay active.</p>
                                </div>
                                <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                                    <span className="material-icons-round" style={{ fontSize: 13 }}>logout</span>
                                    Log out
                                </button>
                            </div>
                            <div className="settings-row">
                                <div>
                                    <div className="settings-row__label">Two-factor authentication</div>
                                    <div className="settings-row__desc">
                                        {twoFactor ? 'Your account is protected with an extra verification step.' : 'Add an extra verification step when signing in.'}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span className={`badge ${twoFactor ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: 10 }}>
                                        {twoFactor ? 'Enabled' : 'Disabled'}
                                    </span>
                                    <label className="toggle">
                                        <input type="checkbox" checked={twoFactor} onChange={toggleTwoFactor} />
                                        <span className="toggle-slider" />
                                    </label>
                                </div>
                            </div>
                            <div className="settings-row">
                                <div>
                                    <div className="settings-row__label">Auto sign-out</div>
                                    <div className="settings-row__desc">Sign out automatically after a period of inactivity.</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 150 }}>
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
                                    <button className="btn btn-primary btn-sm" onClick={saveSessionSettings} disabled={savingSecurity}>
                                        {savingSecurity ? 'Saving…' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Active sessions */}
                        <div className="settings-section">
                            <div className="settings-section__header">
                                <div>
                                    <h3 className="settings-section__title">Active sessions</h3>
                                    <p className="settings-section__desc">
                                        Devices currently signed in to your account.
                                        {!loadingSecurity && visibleSessions.length > 0 && ` ${visibleSessions.length} total.`}
                                    </p>
                                </div>
                                {otherSessionsCount > 1 && (
                                    <button className="btn btn-danger btn-sm" onClick={revokeAllOtherSessions} disabled={revokingAll}>
                                        <span className="material-icons-round" style={{ fontSize: 13 }}>logout</span>
                                        {revokingAll ? 'Revoking…' : `Revoke ${otherSessionsCount} others`}
                                    </button>
                                )}
                            </div>
                            {loadingSecurity ? (
                                <div className="settings-row">
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading sessions…</span>
                                </div>
                            ) : visibleSessions.length === 0 ? (
                                <div className="settings-row">
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No active sessions found</span>
                                </div>
                            ) : (
                                <div style={visibleSessions.length > 6 ? { maxHeight: 360, overflowY: 'auto' } : undefined}>
                                    {visibleSessions.map((s) => (
                                        <div className="settings-row" key={s.id}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                                <span className="material-icons-round" style={{ fontSize: 18, color: s.current ? 'var(--helix-primary)' : 'var(--text-muted)', flexShrink: 0 }}>
                                                    {s.device.includes('iPhone') ? 'phone_iphone' : 'laptop'}
                                                </span>
                                                <div style={{ minWidth: 0 }}>
                                                    <div className="settings-row__label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        {s.device}
                                                        {s.current && <span className="badge badge-info" style={{ fontSize: 9 }}>Current</span>}
                                                    </div>
                                                    <div className="settings-row__desc">{s.location} · {s.time}</div>
                                                </div>
                                            </div>
                                            {!s.current && (
                                                <button className="btn btn-danger btn-xs" onClick={() => revokeSession(s.id)} style={{ flexShrink: 0 }}>Revoke</button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Password */}
                        <div className="settings-section">
                            <div className="settings-section__header">
                                <div>
                                    <h3 className="settings-section__title">Password</h3>
                                    <p className="settings-section__desc">Choose a strong, unique password to keep your account secure.</p>
                                </div>
                            </div>
                            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                    Password must be at least 8 characters with one uppercase, one number, and one special character.
                                </div>
                                <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => showToast('Password updated')}>
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>lock_reset</span>
                                    Update Password
                                </button>
                            </div>
                        </div>

                        {/* Team */}
                        <div className="settings-section">
                            <div className="settings-section__header">
                                <div>
                                    <h3 className="settings-section__title">Team members</h3>
                                    <p className="settings-section__desc">{admins.length} admin {admins.length === 1 ? 'user' : 'users'} with access to this facility.</p>
                                </div>
                                <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(!showInvite)}>
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>{showInvite ? 'close' : 'person_add'}</span>
                                    {showInvite ? 'Cancel' : 'Invite Admin'}
                                </button>
                            </div>

                            {showInvite && (
                                <div style={{
                                    display: 'flex', flexDirection: 'column', gap: 10, padding: 18,
                                    background: 'var(--surface-2)', borderBottom: '1px solid var(--border-subtle)',
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

                            <div style={{ overflowX: 'auto', overflowY: admins.length > 6 ? 'auto' : 'visible', maxHeight: admins.length > 6 ? 360 : undefined }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                                            <th style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface-card)', padding: '10px 22px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }}>User</th>
                                            <th style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface-card)', padding: '10px 22px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }}>Role</th>
                                            <th style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface-card)', padding: '10px 22px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }}>Status</th>
                                            <th style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface-card)', padding: '10px 22px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }}>Last Login</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadingAdmins ? (
                                            <tr>
                                                <td colSpan={4} style={{ padding: '18px 22px', fontSize: 12, color: 'var(--text-muted)' }}>
                                                    Loading facility admins...
                                                </td>
                                            </tr>
                                        ) : admins.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} style={{ padding: '18px 22px', fontSize: 12, color: 'var(--text-muted)' }}>
                                                    No facility admins found
                                                </td>
                                            </tr>
                                        ) : admins.map(admin => {
                                            const adminInitials = admin.name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
                                            const isSelf = currentUserId !== '' && admin.id === currentUserId;
                                            return (
                                                <tr key={admin.id} className="settings-table-row" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                                    <td style={{ padding: '12px 22px' }}>
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
                                                    <td style={{ padding: '12px 22px' }}>
                                                        <span style={{
                                                            fontSize: 11, fontWeight: 600,
                                                            color: roleColors[admin.role] || 'var(--text-secondary)',
                                                            background: `${roleColors[admin.role] || 'var(--surface-3)'}15`,
                                                            padding: '3px 8px', borderRadius: 8,
                                                        }}>
                                                            {admin.role}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 22px' }}>
                                                        <span className={`badge ${admin.status === 'Active' ? 'badge-success' : admin.status === 'Invited' ? 'badge-info' : 'badge-neutral'}`} style={{ fontSize: 10 }}>
                                                            {admin.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 22px', fontSize: 12, color: 'var(--text-muted)' }}>
                                                        {admin.lastLogin}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}>
                                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    <strong>Role permissions:</strong> Super Admins have full access. Admins can manage staff and escalation. Editors can modify roles and settings. Viewers have read-only access.
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {pendingRetention !== undefined && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1100,
                        background: 'rgba(15, 23, 42, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 20,
                    }}
                    onClick={() => setPendingRetention(undefined)}
                >
                    <div
                        className="card"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="retention-confirm-title"
                        style={{ width: 'min(440px, 100%)', padding: 18, boxShadow: '0 18px 48px rgba(15,23,42,0.18)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 10,
                                    background: 'var(--warning-bg)',
                                    color: 'var(--warning)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                <span className="material-icons-round" style={{ fontSize: 18 }}>warning</span>
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div id="retention-confirm-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {pendingRetention === null
                                        ? 'Turn off conversation retention?'
                                        : `Shorten retention to ${retentionLabel(pendingRetention)}?`}
                                </div>
                                <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    {pendingRetention === null
                                        ? 'Inactive conversations will no longer be automatically removed from inboxes. Existing retention schedules may still finish for chats already marked to expire.'
                                        : 'Chats already past the new window will start deleting in about 7 days, not immediately.'}
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setPendingRetention(undefined)}
                                disabled={savingRetention}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                    if (pendingRetention === undefined) return;
                                    void applyConversationRetention(pendingRetention);
                                }}
                                disabled={savingRetention}
                            >
                                {savingRetention ? 'Saving…' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
