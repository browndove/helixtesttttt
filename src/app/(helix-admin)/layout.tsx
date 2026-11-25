'use client';

import { useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import { sectionsForMode } from '@/components/navSections';
import { usePortalMode } from '@/lib/portal-mode';

/**
 * Single shell for logged-in admin routes so Sidebar does not remount on every
 * client navigation (avoids facility name flashing back to the fallback).
 */
export default function HelixAdminLayout({ children }: { children: React.ReactNode }) {
    const portalMode = usePortalMode();
    const sections = useMemo(() => sectionsForMode(portalMode), [portalMode]);
    return (
        <div className="app-shell">
            <Sidebar sections={sections} />
            {children}
        </div>
    );
}
