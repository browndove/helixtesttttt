'use client';

import Sidebar from '@/components/Sidebar';
import navSections from '@/components/navSections';

/**
 * Single shell for logged-in admin routes so Sidebar does not remount on every
 * client navigation (avoids facility name flashing back to the fallback).
 */
export default function HelixAdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="app-shell">
            <Sidebar sections={navSections} />
            {children}
        </div>
    );
}
