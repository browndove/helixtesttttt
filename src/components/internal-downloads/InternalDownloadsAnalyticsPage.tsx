'use client';

import { useMemo, useState, lazy, Suspense, useEffect } from 'react';
import {
    KpiCard,
    RevenueChart,
    RoleCriticalTraffic,
    DailyPatientFlow,
    RoleMetricsModal,
} from '@/components/ugmc-dashboard/executive-overview/components';
import { OutstandingReimbursement } from '@/components/ugmc-dashboard/billing-finance/components';
import { FaDownload, FaMobileScreen, FaStar, FaShieldHalved } from 'react-icons/fa6';
import InternalAdminShell from '@/components/InternalAdminShell';
import InternalDownloadsSidebar, {
    DownloadsSidebarProvider,
    type DownloadsDashboardTab,
} from '@/components/internal-downloads/InternalDownloadsSidebar';
import {
    mapDownloadAnalyticsToUgmc,
    type DownloadAnalyticsData,
} from '@/lib/download-analytics-mock';
import { PlatformBreakdown } from '@/components/internal-downloads/PlatformBreakdown';

const DownloadsAcquisitionPage = lazy(() => import('@/components/internal-downloads/DownloadsAcquisitionPage'));

function fmt(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

function OverviewSkeleton() {
    return (
        <>
            <div className="usage-kpi-grid">
                {[0, 1, 2, 3].map((idx) => (
                    <div key={`kpi-skeleton-${idx}`} className="bg-primary rounded-[15px] shadow-soft p-6">
                        <div className="skeleton h-10 w-10 rounded-[10px] mb-4" />
                        <div className="skeleton h-4 w-28 mb-3" />
                        <div className="skeleton h-9 w-32 mb-2" />
                        <div className="skeleton h-4 w-24" />
                    </div>
                ))}
            </div>

            <div className="usage-main-grid internal-downloads-overview-grid">
                <div className="usage-main-grid__primary">
                    <div className="bg-primary rounded-[15px] shadow-soft p-6">
                        <div className="skeleton h-6 w-44 mb-4" />
                        <div className="skeleton h-[260px] w-full rounded-xl" />
                    </div>
                    <div className="dashboard-two-col">
                        <div className="bg-primary rounded-[15px] shadow-soft p-6">
                            <div className="skeleton h-6 w-36 mb-4" />
                            <div className="skeleton h-[220px] w-full rounded-xl" />
                        </div>
                        <div className="bg-primary rounded-[15px] shadow-soft p-6">
                            <div className="skeleton h-6 w-36 mb-4" />
                            <div className="skeleton h-[220px] w-full rounded-xl" />
                        </div>
                    </div>
                    <div className="bg-primary rounded-[15px] shadow-soft p-6">
                        <div className="skeleton h-6 w-44 mb-4" />
                        <div className="skeleton h-[220px] w-full rounded-xl" />
                    </div>
                </div>
                <div className="usage-main-grid__sidebar">
                    <div className="bg-primary rounded-[15px] shadow-soft p-6">
                        <div className="skeleton h-6 w-32 mb-4" />
                        <div className="space-y-3">
                            {[0, 1, 2, 3].map((idx) => (
                                <div key={`alert-skeleton-${idx}`} className="skeleton h-10 w-full rounded-lg" />
                            ))}
                        </div>
                    </div>
                    <div className="bg-primary rounded-[15px] shadow-soft p-6">
                        <div className="skeleton h-6 w-32 mb-4" />
                        <div className="space-y-3">
                            {[0, 1, 2, 3].map((idx) => (
                                <div key={`live-skeleton-${idx}`} className="skeleton h-10 w-full rounded-lg" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

function RealInsightsSidebar({ data }: { data: DownloadAnalyticsData }) {
    const topRegions = [...data.regions]
        .sort((a, b) => {
            const aTotal = (a.ios_installs ?? a.installs) + (a.android_installs ?? 0);
            const bTotal = (b.ios_installs ?? b.installs) + (b.android_installs ?? 0);
            return bTotal - aTotal;
        })
        .slice(0, 5);
    const reviews = [...data.reviews];
    const hasReviewSnippets = reviews.length > 0;
    const reviewSummaryLabel = hasReviewSnippets
        ? `${reviews.length} App Store review${reviews.length === 1 ? '' : 's'}`
        : data.rating_count > 0
            ? `${data.rating_count.toLocaleString()} rating${data.rating_count === 1 ? '' : 's'}`
            : 'No reviews';

    return (
        <div className="internal-downloads-insights-sidebar">
            <div className="bg-primary rounded-[15px] shadow-soft p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-text-primary">Devices by Region</h3>
                    <span className="text-xs text-text-muted">iOS vs Android</span>
                </div>
                {topRegions.length === 0 ? (
                    <div className="text-sm text-text-muted">No regional data available.</div>
                ) : (
                    <div className="space-y-3">
                        {topRegions.map((region) => {
                            const iosInstalls = region.ios_installs ?? region.installs;
                            const androidInstalls = region.android_installs ?? 0;
                            return (
                            <div key={region.region} className="rounded-lg border border-border-subtle bg-secondary p-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-text-primary">{region.region}</span>
                                    <span className="text-xs text-text-muted">{region.share_percent.toFixed(1)}%</span>
                                </div>
                                <div className="mt-1 flex items-center justify-between text-xs text-text-muted">
                                    <span>Android: {fmt(androidInstalls)}</span>
                                    <span>iOS: {fmt(iosInstalls)}</span>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="bg-primary rounded-[15px] shadow-soft p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-text-primary">Recent Reviews</h3>
                    <span className="text-xs text-text-muted">{reviewSummaryLabel}</span>
                </div>
                {!hasReviewSnippets ? (
                    <div className="text-sm text-text-muted">
                        {data.rating_count > 0
                            ? `Found ${data.rating_count.toLocaleString()} App Store rating${data.rating_count === 1 ? '' : 's'}, but no written review text is available yet.`
                            : 'No App Store reviews available yet.'}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {reviews.map((review, idx) => (
                            <div key={`${review.author}-${review.date}-${idx}`} className="rounded-lg border border-border-subtle bg-secondary p-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-text-primary truncate pr-2">{review.author}</span>
                                    <span className="text-xs text-text-muted">{review.rating.toFixed(1)}★</span>
                                </div>
                                <div className="mt-1 text-xs text-text-muted line-clamp-2">{review.comment}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function InternalDownloadsAnalyticsContent() {
    const [activeTab, setActiveTab] = useState<DownloadsDashboardTab>('overview');
    const [revenueFullscreen, setRevenueFullscreen] = useState(false);
    const [flowFullscreen, setFlowFullscreen] = useState(false);
    const [roleMetricsModalOpen, setRoleMetricsModalOpen] = useState(false);
    const [downloadData, setDownloadData] = useState<DownloadAnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const windowDays = 30;

    const fetchAnalytics = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/proxy/internal/download-analytics?days=${windowDays}`, { cache: 'no-store' });
            const data = await res.json() as {
                analytics?: DownloadAnalyticsData;
                error?: string;
            };
            if (!res.ok || !data.analytics) {
                throw new Error(data.error || 'Failed to load live download analytics');
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

    const ugmcData = useMemo(
        () => (downloadData ? mapDownloadAnalyticsToUgmc(downloadData) : null),
        [downloadData],
    );
    const dailyInstallSeries = useMemo(() => {
        if (!downloadData) return [];
        return downloadData.daily_downloads.map((row) => ({
            day: row.day,
            total_messages: row.installs,
            critical_messages: row.installs,
            standard_messages: row.updates,
        }));
    }, [downloadData]);
    const dailyStoreInstallSeries = useMemo(() => {
        if (!downloadData) return [];
        return downloadData.daily_downloads.map((row) => ({
            day: row.day,
            total_messages: row.installs,
            critical_messages: row.installs, // App Store installs
            standard_messages: row.play_installs ?? 0, // Play Store installs
        }));
    }, [downloadData]);
    const versionInstallRoles = useMemo(() => {
        if (!downloadData) return [];
        return downloadData.version_breakdown.map((version, idx) => ({
            role_id: `version-${idx}`,
            role_name: version.version,
            department_name: 'App versions',
            // RoleCriticalTraffic renders bar/badge from escalation_rate_percent.
            // For downloads overview, use install share (%) as that primary metric.
            escalation_rate_percent: version.share_percent,
            critical_messages: version.installs,
            escalated_critical_messages: 0,
            avg_reply_response_minutes_critical: undefined,
        }));
    }, [downloadData]);
    const regionalPlatform = useMemo(() => {
        if (!downloadData) return [];
        return downloadData.regions
            .slice(0, 6)
            .map((region) => ({
                name: region.region,
                ios: region.ios_installs ?? region.installs,
                android: region.android_installs ?? 0,
            }));
    }, [downloadData]);

    if (loading) {
        return (
            <div className="internal-downloads-layout">
                <InternalDownloadsSidebar activeTab={activeTab} onTabChange={setActiveTab} />
                <div className="usage-dashboard-shell internal-downloads-shell">
                    <div className="usage-inner">
                        <OverviewSkeleton />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !downloadData || !ugmcData) {
        return (
            <div className="internal-downloads-layout">
                <InternalDownloadsSidebar activeTab={activeTab} onTabChange={setActiveTab} />
                <div className="usage-dashboard-shell internal-downloads-shell">
                    <div className="usage-inner">
                        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">
                            <div className="font-semibold">Live download analytics unavailable</div>
                            <div className="mt-1 text-sm">{error || 'No analytics returned from API.'}</div>
                            <button className="btn btn-sm btn-primary mt-3" onClick={() => void fetchAnalytics()}>
                                Retry
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="internal-downloads-layout">
            <InternalDownloadsSidebar activeTab={activeTab} onTabChange={setActiveTab} />

            <div className="usage-dashboard-shell internal-downloads-shell">
                <div className="usage-inner">
                    {activeTab !== 'overview' && (
                        <Suspense fallback={
                            <div className="flex items-center justify-center py-20">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
                            </div>
                        }>
                            {activeTab === 'acquisition' && <DownloadsAcquisitionPage data={downloadData} />}
                        </Suspense>
                    )}

                    {activeTab === 'overview' && (
                        <>
                            <div className="usage-kpi-grid">
                                <KpiCard
                                    icon={<FaDownload className="h-5 w-5 text-accent-primary" />}
                                    iconBgColor="bg-[rgba(36,132,199,0.1)]"
                                    label="Total Downloads"
                                    value={fmt(downloadData.total_downloads)}
                                    footer={
                                        <PlatformBreakdown
                                            ios={downloadData.total_installs}
                                            android={downloadData.total_play_installs ?? 0}
                                        />
                                    }
                                    infoText="Total app downloads across all channels in the selected period."
                                    animationDelay={0}
                                />
                                <KpiCard
                                    icon={<FaMobileScreen className="h-5 w-5 text-accent-green" />}
                                    iconBgColor="bg-[rgba(0,200,179,0.1)]"
                                    label="Installed Units"
                                    value={fmt(downloadData.total_installs)}
                                    change={{ value: fmt(downloadData.total_downloads), label: 'Downloads', trend: 'up' }}
                                    infoText="Install units from Apple Sales Reports."
                                    animationDelay={1}
                                />
                                <KpiCard
                                    icon={<FaStar className="h-5 w-5 text-accent-orange" />}
                                    iconBgColor="bg-[rgba(232,155,0,0.1)]"
                                    label="Avg Rating"
                                    value={downloadData.avg_rating.toFixed(1)}
                                    change={{ value: String(downloadData.reviews.length), label: 'Reviews', trend: 'up' }}
                                    infoText={`Average from ${downloadData.rating_count.toLocaleString()} App Store ratings.`}
                                    animationDelay={2}
                                />
                                <KpiCard
                                    icon={<FaShieldHalved className="h-5 w-5 text-accent-violet" />}
                                    iconBgColor="bg-[rgba(105,116,247,0.1)]"
                                    label="Crash-Free"
                                    value={downloadData.crash_free_rate_percent > 0 ? `${downloadData.crash_free_rate_percent.toFixed(1)}%` : 'N/A'}
                                    change={{
                                        value: downloadData.crash_reports.length > 0
                                            ? String(downloadData.crash_reports.reduce((s, c) => s + c.count, 0))
                                            : 'N/A',
                                        label: downloadData.crash_reports.length > 0 ? 'Crashes' : 'No crash report',
                                        trend: 'down',
                                    }}
                                    infoText="Crash-free sessions from App Store Connect Analytics Reports when available."
                                    animationDelay={3}
                                />
                            </div>

                            <div className="usage-main-grid internal-downloads-overview-grid">
                                <div className="usage-main-grid__primary">
                                    <div className="animate-slide-in-up stagger-2">
                                        <RevenueChart
                                            isFullscreen={revenueFullscreen}
                                            onToggleFullscreen={() => setRevenueFullscreen(!revenueFullscreen)}
                                            dailyVolume={dailyInstallSeries}
                                            title="Installs Over Past 7 Days"
                                            infoText="Install units over the last seven days."
                                            seriesName="Installs"
                                            valueKey="total_messages"
                                            fixedPeriod="7d"
                                            hidePeriodSelector
                                        />
                                    </div>
                                    <div className="dashboard-two-col">
                                        <div className="animate-slide-in-up stagger-3 min-h-[340px] h-full">
                                            <RoleCriticalTraffic roles={versionInstallRoles} title="Version Installs" showDetails={false} />
                                        </div>
                                        <div className="animate-slide-in-up stagger-4 min-h-[340px] h-full">
                                            <OutstandingReimbursement
                                                title="Installs by Region"
                                                subtitle="iOS vs Android by country"
                                                badgeLabel="Android"
                                                platformItems={regionalPlatform}
                                            />
                                        </div>
                                    </div>
                                    <div className="animate-slide-in-up stagger-5">
                                        <DailyPatientFlow
                                            isFullscreen={flowFullscreen}
                                            onToggleFullscreen={() => setFlowFullscreen(!flowFullscreen)}
                                            dailyVolume={dailyStoreInstallSeries}
                                            title="App Store installs vs Play Store installs"
                                            subtitle="Last 7 days"
                                            infoText="App Store install units versus Play Store installs over the last seven days."
                                            primarySeriesLabel="Play Store"
                                            secondarySeriesLabel="App Store"
                                            tooltipUnitLabel="installs"
                                        />
                                    </div>
                                </div>
                                <div className="usage-main-grid__sidebar">
                                    <div className="animate-slide-in-right stagger-3">
                                        <RealInsightsSidebar data={downloadData} />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    <RoleMetricsModal
                        isOpen={roleMetricsModalOpen}
                        onClose={() => setRoleMetricsModalOpen(false)}
                        roles={ugmcData.role_metrics || []}
                    />
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
