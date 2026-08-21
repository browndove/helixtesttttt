'use client';

import { useState, lazy, Suspense, useEffect, useMemo } from 'react';
import InternalAdminShell from '@/components/InternalAdminShell';
import InternalDownloadsSidebar, {
    DownloadsSidebarProvider,
    type DownloadsDashboardTab,
} from '@/components/internal-downloads/InternalDownloadsSidebar';
import { filterDownloadAnalyticsByRange, downloadAnalyticsPresetRange, type DownloadAnalyticsData } from '@/lib/download-analytics-mock';
import { type PlatformFilterValue } from '@/components/internal-downloads/PlatformFilter';
import { DownloadsMobileTabs } from '@/components/internal-downloads/DownloadsWidgets';

const DownloadsOverviewPage = lazy(() => import('@/components/internal-downloads/DownloadsOverviewPage'));
const DownloadsAcquisitionPage = lazy(() => import('@/components/internal-downloads/DownloadsAcquisitionPage'));
const DownloadsRetentionPage = lazy(() => import('@/components/internal-downloads/DownloadsRetentionPage'));
const DownloadsMetricsPage = lazy(() => import('@/components/internal-downloads/DownloadsMetricsPage'));

function PageSkeleton() {
    return (
        <>
            <div className="downloads-page-toolbar">
                <div>
                    <div className="skeleton mb-2 h-6 w-48" />
                    <div className="skeleton h-4 w-64" />
                </div>
                <div className="skeleton h-9 w-40 rounded-lg" />
            </div>
            <div className="downloads-kpi-grid">
                {[0, 1, 2, 3].map((idx) => (
                    <div key={`kpi-skeleton-${idx}`} className="bg-primary rounded-[15px] shadow-soft p-6">
                        <div className="skeleton mb-4 h-10 w-10 rounded-[10px]" />
                        <div className="skeleton mb-3 h-4 w-28" />
                        <div className="skeleton mb-2 h-9 w-32" />
                        <div className="skeleton h-4 w-24" />
                    </div>
                ))}
            </div>
            <div className="dashboard-two-col">
                <div className="bg-primary rounded-[15px] shadow-soft p-6">
                    <div className="skeleton mb-4 h-6 w-44" />
                    <div className="skeleton h-[220px] w-full rounded-xl" />
                </div>
                <div className="bg-primary rounded-[15px] shadow-soft p-6">
                    <div className="skeleton mb-4 h-6 w-36" />
                    <div className="skeleton h-[220px] w-full rounded-xl" />
                </div>
            </div>
        </>
    );
}

const FETCH_DAYS = 90;
const INITIAL_RANGE = downloadAnalyticsPresetRange(FETCH_DAYS);

function InternalDownloadsAnalyticsContent() {
    const [activeTab, setActiveTab] = useState<DownloadsDashboardTab>('overview');
    const [platform, setPlatform] = useState<PlatformFilterValue>('all');
    const [dateFrom, setDateFrom] = useState(INITIAL_RANGE.from);
    const [dateTo, setDateTo] = useState(INITIAL_RANGE.to);
    const [downloadData, setDownloadData] = useState<DownloadAnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAnalytics = async () => {
        setError(null);
        if (!downloadData) setLoading(true);
        try {
            const res = await fetch(`/api/proxy/internal/download-analytics?days=${FETCH_DAYS}`, { cache: 'no-store' });
            const data = await res.json() as {
                analytics?: DownloadAnalyticsData;
                error?: string;
                missing?: string[];
                env?: Record<string, boolean>;
            };
            if (!res.ok || !data.analytics) {
                const missing = Array.isArray(data.missing) && data.missing.length > 0
                    ? `\n${data.missing.map((m) => `• ${m}`).join('\n')}`
                    : '';
                const envHint = data.env
                    ? `\nEnv present: ${Object.entries(data.env).map(([k, v]) => `${k}=${v ? 'yes' : 'no'}`).join(', ')}`
                    : '';
                throw new Error(`${data.error || 'Failed to load live download analytics'}.${missing}${envHint}`);
            }
            setDownloadData(data.analytics);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load live download analytics');
            setDownloadData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchAnalytics();
    }, []);

    const filteredData = useMemo(
        () => (downloadData ? filterDownloadAnalyticsByRange(downloadData, dateFrom, dateTo) : null),
        [downloadData, dateFrom, dateTo],
    );

    const pageProps = filteredData ? {
        data: filteredData,
        platform,
        onPlatformChange: setPlatform,
        dateFrom,
        dateTo,
        onDateRangeChange: (from: string, to: string) => {
            const start = from || to;
            const end = to || from || start;
            if (!start) return;
            setDateFrom(start <= end ? start : end);
            setDateTo(start <= end ? end : start);
        },
    } : null;

    return (
        <div className="internal-downloads-layout">
            <InternalDownloadsSidebar activeTab={activeTab} onTabChange={setActiveTab} />
            <div className="usage-dashboard-shell internal-downloads-shell">
                <div className="usage-inner">
                    <DownloadsMobileTabs activeTab={activeTab} onTabChange={setActiveTab} />
                    {loading && <PageSkeleton />}
                    {!loading && (error || !downloadData || !pageProps) && (
                        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">
                            <div className="font-semibold">Live download analytics unavailable</div>
                            <div className="mt-1 text-sm whitespace-pre-wrap">{error || 'No analytics returned from API.'}</div>
                            <button className="btn btn-sm btn-primary mt-3" onClick={() => void fetchAnalytics()}>
                                Retry
                            </button>
                        </div>
                    )}
                    {!loading && pageProps && (
                        <Suspense fallback={<PageSkeleton />}>
                            {activeTab === 'overview' && <DownloadsOverviewPage {...pageProps} />}
                            {activeTab === 'acquisition' && <DownloadsAcquisitionPage {...pageProps} />}
                            {activeTab === 'retention' && <DownloadsRetentionPage {...pageProps} />}
                            {activeTab === 'metrics' && <DownloadsMetricsPage {...pageProps} />}
                        </Suspense>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function InternalDownloadsAnalyticsPage() {
    return (
        <InternalAdminShell>
            <DownloadsSidebarProvider>
                <InternalDownloadsAnalyticsContent />
            </DownloadsSidebarProvider>
        </InternalAdminShell>
    );
}
