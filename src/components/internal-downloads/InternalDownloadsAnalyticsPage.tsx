'use client';

import { useState, lazy, Suspense, useEffect, useMemo } from 'react';
import InternalAdminShell from '@/components/InternalAdminShell';
import { filterDownloadAnalyticsByRange, downloadAnalyticsAllTimeRange, type DownloadAnalyticsData } from '@/lib/download-analytics-mock';
import DownloadsComingSoon from '@/components/internal-downloads/DownloadsComingSoon';

/** Flip to true to serve the live dashboard instead of the placeholder. */
const DOWNLOADS_ANALYTICS_ENABLED: boolean = true;

const DownloadsSinglePage = lazy(() => import('@/components/internal-downloads/DownloadsSinglePage'));

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

const FETCH_DAYS = 400;

function InternalDownloadsAnalyticsContent() {
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
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
            const range = downloadAnalyticsAllTimeRange(data.analytics);
            setDownloadData(data.analytics);
            setDateFrom(range.from);
            setDateTo(range.to);
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

    const allTimeRange = useMemo(
        () => (downloadData ? downloadAnalyticsAllTimeRange(downloadData) : { from: '', to: '' }),
        [downloadData],
    );

    const filteredData = useMemo(
        () => (downloadData && dateFrom && dateTo ? filterDownloadAnalyticsByRange(downloadData, dateFrom, dateTo) : null),
        [downloadData, dateFrom, dateTo],
    );

    const pageProps = filteredData ? {
        data: filteredData,
        dateFrom,
        dateTo,
        allTimeFrom: allTimeRange.from,
        allTimeTo: allTimeRange.to,
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
            <div className="usage-dashboard-shell internal-downloads-shell">
                <div className="usage-inner">
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
                            <DownloadsSinglePage {...pageProps} />
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
            {DOWNLOADS_ANALYTICS_ENABLED ? <InternalDownloadsAnalyticsContent /> : <DownloadsComingSoon />}
        </InternalAdminShell>
    );
}
