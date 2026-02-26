'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

export default function Sidebar({
    hospitalName = 'Accra Medical Center',
    hospitalSubtitle = 'Admin Portal',
    sections,
    footer,
    adminName = 'Dr. Kwame Asante',
    adminRole = 'Super Admin',
}: SidebarProps) {
    const pathname = usePathname();
    const isSettingsActive = pathname === '/settings';

    // Generate initials from name
    const initials = adminName
        .split(' ')
        .filter(Boolean)
        .map(w => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    return (
        <aside className="app-sidebar" style={{
            background: '#ffffff',
            borderRight: '1px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            position: 'sticky',
            top: 0,
            overflow: 'hidden',
        }}>
            {/* Brand */}
            <div style={{
                padding: '22px 18px 18px',
                borderBottom: '1px solid var(--border-default)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <div style={{
                        width: 34, height: 34,
                        background: 'var(--helix-primary)',
                        borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        <span className="material-icons-round" style={{ fontSize: 18, color: '#fff' }}>local_hospital</span>
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
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

            {/* Profile Bar */}
            <Link href="/settings" style={{ textDecoration: 'none' }}>
                <div
                    style={{
                        padding: '12px 14px',
                        borderTop: '1px solid var(--border-default)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: 'pointer',
                        background: isSettingsActive ? '#f0f4f8' : 'transparent',
                        transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!isSettingsActive) e.currentTarget.style.background = '#f5f7fa'; }}
                    onMouseLeave={e => { if (!isSettingsActive) e.currentTarget.style.background = 'transparent'; }}
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
                    <div style={{ flex: 1, minWidth: 0 }}>
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
                            {adminRole}
                        </div>
                    </div>
                    <span className="material-icons-round" style={{
                        fontSize: 16,
                        color: isSettingsActive ? 'var(--helix-primary)' : 'var(--text-disabled)',
                        flexShrink: 0,
                    }}>
                        settings
                    </span>
                </div>
            </Link>
        </aside>
    );
}
