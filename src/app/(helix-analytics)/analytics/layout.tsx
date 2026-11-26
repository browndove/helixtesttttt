'use client';

import { Suspense } from 'react';
import Sidebar from '@/components/Sidebar';
import { analyticsNavSections } from '@/components/navSections';
import AnalyticsProvider from './AnalyticsProvider';
import { AnalyticsSidebarFooter, AnalyticsTopBar } from './AnalyticsChrome';
import './analytics.css';
import '@/components/analytics/glass/analytics-glass.css';

/**
 * Analytics section shell: its own sidebar (analytics pages + way back to admin) in place of
 * the admin portal nav, with one shared data provider so page switches don't refetch.
 */
export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={null}>
            <AnalyticsProvider>
                <div className="app-shell">
                    <Sidebar sections={analyticsNavSections} hospitalSubtitle="Analytics" footer={<AnalyticsSidebarFooter />} />
                    <div className="app-main">
                        <AnalyticsTopBar />
                        <main className="analytics-page">{children}</main>
                    </div>
                </div>
            </AnalyticsProvider>
        </Suspense>
    );
}
