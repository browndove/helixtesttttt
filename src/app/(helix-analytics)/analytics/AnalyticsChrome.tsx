'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import TopBar from '@/components/TopBar';
import CalendarRangePicker from '@/components/analytics/CalendarRangePicker';
import { analyticsNavSections } from '@/components/navSections';
import { useAnalytics } from './AnalyticsProvider';

const PAGE_TITLES = new Map(analyticsNavSections.flatMap(section => section.items).map(item => [item.href, item.label]));

function formatRangeLabel(dateFrom: string, dateTo: string, windowDays: number | undefined): string {
    if (dateFrom && dateTo) {
        const from = new Date(`${dateFrom}T00:00:00`);
        const to = new Date(`${dateTo}T00:00:00`);
        if (dateFrom === dateTo) {
            return from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        return `${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return windowDays === 0 ? 'Today' : `Last ${windowDays ?? 30} days`;
}

/** Page title + shared date range for every analytics page. */
export function AnalyticsTopBar() {
    const pathname = usePathname();
    const { data, dateFrom, dateTo, setRange } = useAnalytics();
    return (
        <TopBar
            title={PAGE_TITLES.get(pathname) ?? 'Analytics'}
            subtitle={formatRangeLabel(dateFrom, dateTo, data?.window_days)}
            actions={<CalendarRangePicker from={dateFrom} to={dateTo} onChange={setRange} />}
        />
    );
}

/** Analytics sidebar footer: report export and the way back to the admin portal. */
export function AnalyticsSidebarFooter() {
    const { openReport } = useAnalytics();
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button type="button" className="nav-item analytics-footer-link" onClick={openReport}>
                <span className="material-icons-round">download</span>
                Generate report
            </button>
            <Link href="/home" className="nav-item analytics-footer-link">
                <span className="material-icons-round">arrow_back</span>
                Back to Admin
            </Link>
        </div>
    );
}
