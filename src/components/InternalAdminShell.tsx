'use client';

import { usePathname, useRouter } from 'next/navigation';
import { API_ENDPOINTS } from '@/lib/config';
import './internal-admin-dashboard.css';

type NavLink = {
    label: string;
    href: string;
    icon?: string;
};

const IN_APP_LINKS: NavLink[] = [
    { label: 'Facilities', href: '/internal/dashboard' },
    { label: 'Downloads Analytics', href: '/internal/downloads' },
];

export const EXTERNAL_LINKS: NavLink[] = [
    { label: 'Test Admin', href: 'https://admintest.helixhealth.app/login', icon: 'open_in_new' },
    { label: 'Prod Admin', href: 'https://admin.helixhealth.app/login', icon: 'open_in_new' },
    { label: 'Test Analytics', href: 'https://analyticstest.helixhealth.app', icon: 'open_in_new' },
    { label: 'Prod Analytics', href: 'https://analytics.helixhealth.app', icon: 'open_in_new' },
    { label: 'Internal Analytics', href: 'https://analytics.helixhealth.app/internal/login?from=%2Finternal%2Fdashboard', icon: 'open_in_new' },
    { label: 'Field Implementation', href: 'https://field.helixhealth.app/login', icon: 'open_in_new' },
    { label: 'Onboarding admin', href: 'https://www.helixhealth.app/admin/index.html', icon: 'open_in_new' },
];

export function getInternalNavLinks(pathname: string, includeExternalLinks = true): (NavLink & { active?: boolean })[] {
    const inAppLinks = IN_APP_LINKS.map((link) => ({
        ...link,
        active: pathname === link.href || pathname.startsWith(`${link.href}/`),
    }));
    return includeExternalLinks ? [...inAppLinks, ...EXTERNAL_LINKS] : inAppLinks;
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
    const navLinks = getInternalNavLinks(pathname, includeExternalLinks);

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
                        {navLinks.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                className={`internal-dash__nav-link${link.active ? ' internal-dash__nav-link--active' : ''}`}
                                target={link.href.startsWith('http') ? '_blank' : undefined}
                                rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                            >
                                {link.label}
                                {link.icon && <span className="material-icons-round">{link.icon}</span>}
                            </a>
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
