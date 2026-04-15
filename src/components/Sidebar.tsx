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

    return (
        <aside className="app-sidebar" style={{
            background: '#ffffff',
            borderRight: '1px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
        }}>
            {/* Brand */}
            <div style={{
                padding: '22px 18px 18px',
                borderBottom: '1px solid var(--border-default)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <div style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        overflow: 'hidden',
                    }}>
                        <img
                            src="/helix-logo.png"
                            alt="Helix logo"
                            width={34}
                            height={34}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {hospitalName}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {hospitalSubtitle}
                        </div>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, overflowY: 'auto', padding: '14px 10px' }}>
                {sections.map((section, si) => (
                    <div key={si} style={{ marginBottom: 22 }}>
                        {section.title && (
                            <div style={{
                                padding: '0 8px',
                                marginBottom: 6,
                                fontSize: 10,
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                color: 'var(--text-muted)',
                            }}>
                                {section.title}
                            </div>
                        )}
                        {section.items.map((item) => {
                            const active = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="nav-item"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '9px 12px',
                                        borderRadius: 'var(--radius-md)',
                                        marginBottom: 2,
                                        fontSize: 13,
                                        fontWeight: active ? 600 : 500,
                                        color: active ? 'var(--helix-primary)' : 'var(--text-secondary)',
                                        background: active ? '#f0f4f8' : 'transparent',
                                        border: 'none',
                                        textDecoration: 'none',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!active) {
                                            (e.currentTarget as HTMLElement).style.background = '#f5f7fa';
                                            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!active) {
                                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                                            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                                        }
                                    }}
                                >
                                    <span className="material-icons-round" style={{ fontSize: 18, opacity: active ? 1 : 0.55 }}>
                                        {item.icon}
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
                    borderTop: '1px solid var(--border-default)',
                }}>
                    {footer}
                </div>
            )}

            {/* Profile Bar + menu */}
            <div style={{ position: 'relative', borderTop: '1px solid var(--border-default)' }}>
                <button
                    type="button"
                    onClick={() => setProfileMenuOpen(o => !o)}
                    style={{
                        width: '100%',
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: 'pointer',
                        background: isSettingsActive ? '#f0f4f8' : 'transparent',
                        border: 'none',
                        outline: 'none',
                        transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!isSettingsActive) e.currentTarget.style.background = '#f5f7fa'; }}
                    onMouseLeave={e => { if (!isSettingsActive && !profileMenuOpen) e.currentTarget.style.background = 'transparent'; }}
                >
                    <div style={{
                        width: 32, height: 32,
                        borderRadius: '50%',
                        background: isSettingsActive ? 'var(--helix-primary)' : 'var(--surface-3)',
                        color: isSettingsActive ? '#fff' : 'var(--text-secondary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
                        flexShrink: 0,
                        transition: 'all 0.15s',
                    }}>
                        {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <div style={{
                            fontSize: 12.5, fontWeight: 600,
                            color: isSettingsActive ? 'var(--helix-primary)' : 'var(--text-primary)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                            {adminName}
                        </div>
                        <div style={{
                            fontSize: 10, color: 'var(--text-muted)', fontWeight: 500,
                        }}>
                            {resolvedAdminRole}
                        </div>
                    </div>
                    <span className="material-icons-round" style={{
                        fontSize: 16,
                        color: isSettingsActive ? 'var(--helix-primary)' : 'var(--text-disabled)',
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
                                marginBottom: 6,
                                background: 'var(--surface-card)',
                                border: '1px solid var(--border-default)',
                                borderRadius: 'var(--radius-md)',
                                boxShadow: '0 6px 18px rgba(15,23,42,0.18)',
                                overflow: 'hidden',
                                zIndex: 40,
                            }}
                        >
                            <button
                                type="button"
                                onClick={handleSettingsClick}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    fontSize: 13,
                                    color: 'var(--text-primary)',
                                    borderBottom: '1px solid var(--border-subtle)',
                                    textAlign: 'left',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                            >
                                <span className="material-icons-round" style={{ fontSize: 16 }}>settings</span>
                                Settings
                            </button>
                            <button
                                type="button"
                                onClick={handleLogoutClick}
                                disabled={loggingOut}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: loggingOut ? 'not-allowed' : 'pointer',
                                    fontSize: 13,
                                    color: 'var(--critical)',
                                    textAlign: 'left',
                                }}
                                onMouseEnter={e => { if (!loggingOut) e.currentTarget.style.background = 'var(--surface-2)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
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
