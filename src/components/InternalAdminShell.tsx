'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { API_ENDPOINTS } from '@/lib/config';
import './internal-admin-dashboard.css';

type NavLink = {
    label: string;
    href: string;
    icon?: string;
};

type NavGroup = {
    id: string;
    label: string;
    items: NavLink[];
};

const IN_APP_LINKS: NavLink[] = [
    { label: 'Facilities', href: '/internal/dashboard' },
    { label: 'Downloads Analytics', href: '/internal/downloads' },
];

export const EXTERNAL_LINKS: NavLink[] = [
    { label: 'Documentation', href: 'https://documentation.helixhealth.app/', icon: 'open_in_new' },
    { label: 'Test Admin', href: 'https://admintest.helixhealth.app/login', icon: 'open_in_new' },
    { label: 'Prod Admin', href: 'https://admin.helixhealth.app/login', icon: 'open_in_new' },
    { label: 'Test Analytics', href: 'https://analyticstest.helixhealth.app', icon: 'open_in_new' },
    { label: 'Prod Analytics', href: 'https://analytics.helixhealth.app', icon: 'open_in_new' },
    { label: 'Internal Analytics', href: 'https://analytics.helixhealth.app/internal/login?from=%2Finternal%2Fdashboard', icon: 'open_in_new' },
    { label: 'Field Implementation', href: 'https://field.helixhealth.app/login', icon: 'open_in_new' },
    { label: 'Onboarding admin', href: 'https://www.helixhealth.app/admin/index.html', icon: 'open_in_new' },
];

const NAV_GROUPS: NavGroup[] = [
    {
        id: 'internal',
        label: 'Internal',
        items: IN_APP_LINKS,
    },
    {
        id: 'admin',
        label: 'Admin',
        items: [
            { label: 'Test Admin', href: 'https://admintest.helixhealth.app/login', icon: 'open_in_new' },
            { label: 'Prod Admin', href: 'https://admin.helixhealth.app/login', icon: 'open_in_new' },
            { label: 'Onboarding admin', href: 'https://www.helixhealth.app/admin/index.html', icon: 'open_in_new' },
        ],
    },
    {
        id: 'analytics',
        label: 'Analytics',
        items: [
            { label: 'Test Analytics', href: 'https://analyticstest.helixhealth.app', icon: 'open_in_new' },
            { label: 'Prod Analytics', href: 'https://analytics.helixhealth.app', icon: 'open_in_new' },
            { label: 'Internal Analytics', href: 'https://analytics.helixhealth.app/internal/login?from=%2Finternal%2Fdashboard', icon: 'open_in_new' },
            { label: 'Documentation', href: 'https://documentation.helixhealth.app/', icon: 'open_in_new' },
            { label: 'Field Implementation', href: 'https://field.helixhealth.app/login', icon: 'open_in_new' },
        ],
    },
];

function isNavLinkActive(pathname: string, href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
}

export function getInternalNavLinks(pathname: string, includeExternalLinks = true): (NavLink & { active?: boolean })[] {
    const inAppLinks = IN_APP_LINKS.map((link) => ({
        ...link,
        active: isNavLinkActive(pathname, link.href),
    }));
    return includeExternalLinks ? [...inAppLinks, ...EXTERNAL_LINKS] : inAppLinks;
}

function InternalNavDropdown({
    group,
    pathname,
    isOpen,
    onToggle,
    onClose,
}: {
    group: NavGroup;
    pathname: string;
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;
}) {
    const rootRef = useRef<HTMLDivElement>(null);
    const items = group.items.map((link) => ({
        ...link,
        active: isNavLinkActive(pathname, link.href),
    }));
    const isGroupActive = items.some((link) => link.active);

    useEffect(() => {
        if (!isOpen) return undefined;

        const handlePointerDown = (event: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    return (
        <div className="internal-dash__nav-dropdown" ref={rootRef}>
            <button
                type="button"
                className={`internal-dash__nav-dropdown-trigger${isOpen ? ' internal-dash__nav-dropdown-trigger--open' : ''}${isGroupActive ? ' internal-dash__nav-dropdown-trigger--active' : ''}`}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                onClick={onToggle}
            >
                {group.label}
                <span className="material-icons-round internal-dash__nav-dropdown-chevron">expand_more</span>
            </button>
            {isOpen && (
                <div className="internal-dash__nav-dropdown-menu" role="menu">
                    {items.map((link) => (
                        <a
                            key={link.label}
                            href={link.href}
                            role="menuitem"
                            className={`internal-dash__nav-dropdown-item${link.active ? ' internal-dash__nav-dropdown-item--active' : ''}`}
                            target={link.href.startsWith('http') ? '_blank' : undefined}
                            rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                            onClick={onClose}
                        >
                            <span>{link.label}</span>
                            {link.icon && <span className="material-icons-round">{link.icon}</span>}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function InternalAdminShell({
    children,
    includeExternalLinks = true,
}: {
    children: React.ReactNode;
    includeExternalLinks?: boolean;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [openNavGroup, setOpenNavGroup] = useState<string | null>(null);
    const navGroups = includeExternalLinks ? NAV_GROUPS : NAV_GROUPS.filter((group) => group.id === 'internal');

    const logoutInternal = async () => {
        await fetch(API_ENDPOINTS.INTERNAL_EXIT_ACT_AS, { method: 'POST', credentials: 'include' }).catch(() => null);
        await fetch(API_ENDPOINTS.LOGOUT, { method: 'POST', credentials: 'include' }).catch(() => null);
        if (typeof window !== 'undefined') window.location.assign('/internal/login');
        else router.replace('/internal/login');
    };

    const sidebarLayout = !includeExternalLinks;

    return (
        <div className={`internal-dash${sidebarLayout ? ' internal-dash--sidebar-layout' : ''}`}>
            <nav className="internal-dash__navbar">
                <div className="internal-dash__navbar-inner">
                    <div className="internal-dash__brand">
                        <div className="internal-dash__brand-icon">
                            <img src="/brand-logo.svg" alt="Helix" width={20} height={17} />
                        </div>
                        <span className="internal-dash__brand-name">Helix Internal</span>
                    </div>

                    <div className="internal-dash__nav-links">
                        {navGroups.map((group) => (
                            <InternalNavDropdown
                                key={group.id}
                                group={group}
                                pathname={pathname}
                                isOpen={openNavGroup === group.id}
                                onToggle={() => setOpenNavGroup((current) => (current === group.id ? null : group.id))}
                                onClose={() => setOpenNavGroup(null)}
                            />
                        ))}
                    </div>

                    <div className="internal-dash__nav-right">
                        <button type="button" className="internal-dash__btn internal-dash__btn--ghost" onClick={logoutInternal}>
                            <span className="material-icons-round" style={{ fontSize: 16 }}>logout</span>
                            Sign out
                        </button>
                    </div>
                </div>
            </nav>

            {children}

            <footer className="internal-dash__footer">
                <div className="internal-dash__footer-inner">
                    <p className="internal-dash__footer-note">
                        Helix Internal · All access is logged and monitored
                    </p>
                </div>
            </footer>
        </div>
    );
}
