'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { API_ENDPOINTS } from '@/lib/config';
import { useAuth } from '@/lib/useAuth';
import {
    isLikelyFacilityDisplayName,
    readCachedSidebarUser,
    readFacilityDisplayName,
    writeCachedSidebarUser,
    writeFacilityDisplayName,
} from '@/lib/facilityDisplayCache';
import { clearClientFacilityIdCache, primeClientFacilityId } from '@/lib/facility-client';
import { invalidateRolesPageCache } from '@/lib/rolesAdminCache';

interface NavItem {
    icon: string;
    label: string;
    href: string;
}

interface SidebarSection {
    title?: string;
    items: NavItem[];
}

interface SidebarProps {
    hospitalName?: string;
    hospitalSubtitle?: string;
    sections: SidebarSection[];
    footer?: React.ReactNode;
    adminName?: string;
    adminRole?: string;
}

function formatRoleLabel(role?: string): string {
    if (!role) return 'Admin';
    return role
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

function getFacilityNameFromPayload(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null;

    if (Array.isArray(data)) {
        const first = data[0];
        if (first && typeof first === 'object') {
            const rec = first as Record<string, unknown>;
            const name = String(rec.name || '').trim();
            return name || null;
        }
        return null;
    }

    const rec = data as Record<string, unknown>;
    const directName = String(rec.name || rec.facility_name || rec.hospital_name || '').trim();
    if (directName) return directName;

    const nested = rec.data;
    if (nested && typeof nested === 'object') {
        const nestedRec = nested as Record<string, unknown>;
        const nestedName = String(nestedRec.name || nestedRec.facility_name || nestedRec.hospital_name || '').trim();
        if (nestedName) return nestedName;
    }

    const items = rec.items;
    if (Array.isArray(items) && items[0] && typeof items[0] === 'object') {
        const first = items[0] as Record<string, unknown>;
        const name = String(first.name || first.facility_name || first.hospital_name || '').trim();
        if (name) return name;
    }

    return null;
}

export default function Sidebar({
    hospitalName: hospitalNameProp,
    hospitalSubtitle = 'Admin Portal',
    sections,
    footer,
    adminName: adminNameProp,
    adminRole,
}: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const isSettingsActive = pathname === '/settings';
    const [sessionUser, setSessionUser] = useState<{ name: string; email: string; role: string } | null>(null);
    const [facilityName, setFacilityName] = useState<string | null>(null);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const [supportMode, setSupportMode] = useState(false);
    const [supportFacilityName, setSupportFacilityName] = useState<string | null>(null);
    const [endingSupportMode, setEndingSupportMode] = useState(false);
    const { logout } = useAuth();

    // After SSR/hydration, apply session cache before paint (avoids "Facility" / "User" flashes).
    useLayoutEffect(() => {
        const cachedFacility = readFacilityDisplayName();
        if (cachedFacility) setFacilityName(cachedFacility);
        const cachedUser = readCachedSidebarUser();
        if (cachedUser) {
            setSessionUser({
                name: cachedUser.name,
                email: cachedUser.email,
                role: cachedUser.role,
            });
        }

        // Support-mode context comes from internal act-as proxy (reads secure cookies server-side).
        void fetch(API_ENDPOINTS.INTERNAL_ACT_AS, { credentials: 'include' })
            .then(async (res) => {
                if (!res.ok) return null;
                return res.json() as Promise<{ support_mode?: boolean; facility_name?: string }>;
            })
            .then((ctx) => {
                if (!ctx) return;
                const inSupport = Boolean(ctx.support_mode);
                setSupportMode(inSupport);
                setSupportFacilityName(ctx.facility_name || null);
                const fid = String((ctx as { facility_id?: string }).facility_id || '').trim();
                if (inSupport && fid) primeClientFacilityId(fid);
            })
            .catch(() => {
                setSupportMode(false);
                setSupportFacilityName(null);
            });
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadSidebarContext = async () => {
            try {
                const meRes = await fetch(API_ENDPOINTS.AUTH_ME);
                if (!meRes.ok) return;
                const meData = await meRes.json();
                const user = meData?.user && typeof meData.user === 'object' ? meData.user : meData;
                if (!user || typeof user !== 'object') return;

                const firstName = String(user.first_name || '').trim();
                const lastName = String(user.last_name || '').trim();
                const fallbackName = `${firstName} ${lastName}`.trim();
                const name = String(user.name || fallbackName || '').trim();

                const role = formatRoleLabel(String(user.role || user.system_role || 'Admin'));
                if (!cancelled && name) {
                    const nextUser = {
                        name,
                        email: String(user.email || ''),
                        role,
                    };
                    setSessionUser(nextUser);
                    writeCachedSidebarUser(nextUser);
                }

                const facilityNameFromUser = String(
                    user.facility_name
                    || user.current_facility_name
                    || user.facilityName
                    || user.currentFacilityName
                    || (user.facility && typeof user.facility === 'object' ? (user.facility as Record<string, unknown>).name : '')
                    || ''
                ).trim();
                if (!cancelled && facilityNameFromUser && isLikelyFacilityDisplayName(facilityNameFromUser)) {
                    setFacilityName(facilityNameFromUser);
                    writeFacilityDisplayName(facilityNameFromUser);
                }

                // Fetch hospital name from hospital proxy (most reliable for current facility)
                try {
                    const hospitalRes = await fetch(API_ENDPOINTS.HOSPITAL);
                    if (hospitalRes.ok) {
                        const hospitalData = await hospitalRes.json();
                        const resolvedName = getFacilityNameFromPayload(hospitalData);
                        if (!cancelled && resolvedName && isLikelyFacilityDisplayName(resolvedName)) {
                            setFacilityName(resolvedName);
                            writeFacilityDisplayName(resolvedName);
                        }
                    }
                } catch { /* best effort */ }

            } catch {
                // Best-effort only: keep fallbacks when backend context is unavailable.
            }
        };

        loadSidebarContext();
        return () => { cancelled = true; };
    }, []);

    // Warm the client router cache for common admin routes so clicks feel instant.
    useEffect(() => {
        const hrefs = new Set<string>();
        for (const section of sections) {
            for (const item of section.items) hrefs.add(item.href);
        }
        hrefs.add('/settings');
        for (const href of hrefs) router.prefetch(href);
    }, [router, sections]);

    const hospitalName = facilityName || hospitalNameProp || 'Facility';
    const adminName = adminNameProp || sessionUser?.name || 'User';
    const resolvedAdminRole = adminRole || sessionUser?.role || 'Admin';

    // Generate initials from name
    const initials = adminName
        .split(' ')
        .filter(Boolean)
        .map(w => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    const handleSettingsClick = () => {
        setProfileMenuOpen(false);
        if (pathname !== '/settings') {
            router.push('/settings');
        }
    };

    const handleLogoutClick = async () => {
        if (loggingOut) return;
        setLoggingOut(true);
        try {
            await logout();
        } finally {
            setLoggingOut(false);
            setProfileMenuOpen(false);
        }
    };

    const handleExitSupportMode = async () => {
        if (endingSupportMode) return;
        setEndingSupportMode(true);
        try {
            await fetch(API_ENDPOINTS.INTERNAL_EXIT_ACT_AS, {
                method: 'POST',
                credentials: 'include',
            });
        } finally {
            invalidateRolesPageCache();
            clearClientFacilityIdCache();
            if (typeof window !== 'undefined') {
                window.location.assign('/internal/dashboard');
            } else {
                router.replace('/internal/dashboard');
            }
            setEndingSupportMode(false);
        }
    };

    return (
        <aside className="app-sidebar" style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
        }}>
            {/* Brand */}
            <div className="sidebar-brand">
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <div className="sidebar-brand__logo">
                        <img
                            src="/brand-logo.svg"
                            alt="Helix logo"
                            width={28}
                            height={28}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {hospitalName}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {hospitalSubtitle}
                        </div>
                    </div>
                </div>
                {supportMode && (
                    <div style={{
                        marginTop: 12,
                        padding: '10px 12px',
                        borderRadius: 14,
                        background: 'var(--helix-primary)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        boxShadow: '0 6px 16px rgba(27,42,68,0.22)',
                    }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.65 }}>
                                Support mode
                            </div>
                            <div style={{ fontSize: 11.5, marginTop: 2, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {supportFacilityName || facilityName || 'Selected facility'}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => { void handleExitSupportMode(); }}
                            disabled={endingSupportMode}
                            style={{
                                border: 'none',
                                background: 'rgba(255,255,255,0.16)',
                                color: '#fff',
                                borderRadius: 9,
                                fontSize: 11,
                                fontWeight: 600,
                                fontFamily: 'inherit',
                                padding: '5px 10px',
                                flexShrink: 0,
                                cursor: endingSupportMode ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {endingSupportMode ? 'Exiting…' : 'Exit'}
                        </button>
                    </div>
                )}
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 10px 10px' }}>
                {sections.map((section, si) => (
                    <div key={si} style={{ marginBottom: 18 }}>
                        {section.title && (
                            <div className="sidebar-section-title">
                                {section.title}
                            </div>
                        )}
                        {section.items.map((item) => {
                            const active = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    prefetch
                                    className="nav-item sidebar-nav-link"
                                    data-active={active}
                                    aria-current={active ? 'page' : undefined}
                                >
                                    <span className="sidebar-nav-link__icon">
                                        <span className="material-icons-round">{item.icon}</span>
                                    </span>
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* Footer */}
            {footer && (
                <div style={{
                    padding: '14px 18px',
                    borderTop: '1px solid var(--border-subtle)',
                }}>
                    {footer}
                </div>
            )}

            {/* Profile Bar + menu */}
            <div style={{ position: 'relative' }}>
                <button
                    type="button"
                    className="sidebar-profile"
                    data-active={isSettingsActive || profileMenuOpen}
                    onClick={() => setProfileMenuOpen(o => !o)}
                >
                    <div style={{
                        width: 34, height: 34,
                        borderRadius: 11,
                        background: 'var(--helix-primary)',
                        color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
                        flexShrink: 0,
                    }}>
                        {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <div style={{
                            fontSize: 12.5, fontWeight: 600,
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                            {adminName}
                        </div>
                        <div style={{
                            fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500,
                        }}>
                            {resolvedAdminRole}
                        </div>
                    </div>
                    <span className="material-icons-round" style={{
                        fontSize: 17,
                        color: isSettingsActive ? 'var(--helix-primary)' : 'var(--text-muted)',
                        flexShrink: 0,
                        transform: profileMenuOpen ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.15s',
                    }}>
                        settings
                    </span>
                </button>

                {profileMenuOpen && (
                    <>
                        <div
                            style={{
                                position: 'absolute',
                                bottom: '100%',
                                left: 8,
                                right: 8,
                                marginBottom: 2,
                                background: 'var(--surface-card)',
                                border: '1px solid var(--border-default)',
                                borderRadius: 14,
                                boxShadow: '0 12px 32px rgba(27,42,68,0.18)',
                                overflow: 'hidden',
                                zIndex: 40,
                            }}
                        >
                            <button
                                type="button"
                                className="sidebar-menu-item"
                                onClick={handleSettingsClick}
                                style={{ borderBottom: '1px solid var(--border-subtle)' }}
                            >
                                <span className="material-icons-round" style={{ fontSize: 16 }}>settings</span>
                                Settings
                            </button>
                            <button
                                type="button"
                                className="sidebar-menu-item"
                                onClick={handleLogoutClick}
                                disabled={loggingOut}
                                style={{
                                    cursor: loggingOut ? 'not-allowed' : 'pointer',
                                    color: 'var(--critical)',
                                }}
                            >
                                <span className="material-icons-round" style={{ fontSize: 16 }}>logout</span>
                                {loggingOut ? 'Logging out…' : 'Logout'}
                            </button>
                        </div>
                        <div
                            style={{
                                position: 'fixed',
                                inset: 0,
                                zIndex: 30,
                            }}
                            onClick={() => setProfileMenuOpen(false)}
                        />
                    </>
                )}
            </div>
        </aside>
    );
}
