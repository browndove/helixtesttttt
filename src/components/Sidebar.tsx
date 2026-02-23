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
}

export default function Sidebar({
    hospitalName = 'Korle Bu',
    hospitalSubtitle = 'Teaching Hospital',
    sections,
    footer,
}: SidebarProps) {
    const pathname = usePathname();

    return (
        <aside style={{
            width: 'var(--sidebar-width)',
            background: '#ffffff',
            borderRight: '1px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
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
        </aside>
    );
}
