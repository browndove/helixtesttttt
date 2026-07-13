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
import {
    PlatformFilter,
    dailyInstallRows,
    platformFilterLabel,
    platformInstallTotals,
    regionalPlatformRows,
    type PlatformFilterValue,
} from '@/components/internal-downloads/PlatformFilter';

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

function RealInsightsSidebar({
    data,
    platform,
}: {
    data: DownloadAnalyticsData;
    platform: PlatformFilterValue;
}) {
    const topRegions = regionalPlatformRows(data, platform).slice(0, 5);
    const reviews = [...data.reviews].filter((r) => {
        if (platform === 'ios') return r.source !== 'android';
        if (platform === 'android') return r.source === 'android';
        return true;
    });
    const hasReviewSnippets = reviews.length > 0;
    const iosCount = reviews.filter((r) => r.source !== 'android').length;
    const androidCount = reviews.filter((r) => r.source === 'android').length;
    const reviewSummaryLabel = hasReviewSnippets
        ? [
            iosCount > 0 ? `${iosCount} App Store` : null,
            androidCount > 0 ? `${androidCount} Play Store` : null,
        ].filter(Boolean).join(' · ') + ` review${reviews.length === 1 ? '' : 's'}`
        : data.rating_count > 0
            ? `${data.rating_count.toLocaleString()} rating${data.rating_count === 1 ? '' : 's'}`
            : 'No reviews';

    return (
        <div className="internal-downloads-insights-sidebar">
            <div className="bg-primary rounded-[15px] shadow-soft p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-text-primary">Devices by Region</h3>
                    <span className="text-xs text-text-muted">{platformFilterLabel(platform)}</span>
                </div>
                {topRegions.length === 0 ? (
                    <div className="text-sm text-text-muted">No regional data available.</div>
                ) : (
                    <div className="space-y-3">
                        {topRegions.map((region) => (
                            <div key={region.name} className="rounded-lg border border-border-subtle bg-secondary p-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-text-primary">{region.name}</span>
                                    <span className="text-xs text-text-muted">{fmt(region.total)}</span>
                                </div>
                                <div className="mt-1 flex items-center justify-between text-xs text-text-muted">
                                    {platform !== 'ios' && <span>Android: {fmt(region.android)}</span>}
                                    {platform !== 'android' && <span>iOS: {fmt(region.ios)}</span>}
                                </div>
                            </div>
                        ))}
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
                            : 'No reviews available yet.'}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {reviews.map((review, idx) => {
                            const isAndroid = review.source === 'android';
                            return (
                                <div key={`${review.author}-${review.date}-${idx}`} className="rounded-lg border border-border-subtle bg-secondary p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-sm font-medium text-text-primary truncate">{review.author}</span>
                                            <span
                                                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${isAndroid ? 'bg-[rgba(0,200,179,0.12)] text-[#089A8A]' : 'bg-[rgba(41,128,211,0.12)] text-[#2980D3]'}`}
                                            >
                                                {isAndroid ? 'Play Store' : 'App Store'}
                                            </span>
                                        </div>
                                        <span className="text-xs text-text-muted shrink-0">{review.rating.toFixed(1)}★</span>
                                    </div>
                                    <div className="mt-1 text-xs text-text-muted line-clamp-2">{review.comment}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

function InternalDownloadsAnalyticsContent() {
    const [activeTab, setActiveTab] = useState<DownloadsDashboardTab>('overview');
    const [platform, setPlatform] = useState<PlatformFilterValue>('all');
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
    const installTotals = useMemo(
        () => (downloadData ? platformInstallTotals(downloadData, platform) : { ios: 0, android: 0, total: 0 }),
        [downloadData, platform],
    );
    const filteredDaily = useMemo(
        () => (downloadData ? dailyInstallRows(downloadData, platform) : []),
        [downloadData, platform],
    );
    const dailyInstallSeries = useMemo(
        () => filteredDaily.map((row) => ({
            day: row.day,
            total_messages: row.total,
            critical_messages: row.ios,
            standard_messages: row.android,
        })),
        [filteredDaily],
    );
    const dailyStoreInstallSeries = useMemo(
        () => filteredDaily.map((row) => ({
            day: row.day,
            total_messages: row.total,
            critical_messages: row.ios,
            standard_messages: row.android,
        })),
        [filteredDaily],
    );
    const versionInstallRoles = useMemo(() => {
        if (!downloadData || platform === 'android') return [];
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
    }, [downloadData, platform]);
    const regionalPlatform = useMemo(
        () => (downloadData ? regionalPlatformRows(downloadData, platform) : []),
        [downloadData, platform],
    );
    const ratingKpi = useMemo(() => {
        const ios = downloadData?.avg_rating ?? 0;
        const android = downloadData?.android_avg_rating ?? 0;
        const iosReviewCount = downloadData?.reviews.filter((r) => r.source !== 'android').length ?? 0;
        const androidReviewCount = downloadData?.android_rating_count
            ?? (downloadData?.reviews.filter((r) => r.source === 'android').length ?? 0);
        if (platform === 'android') {
            return {
                value: android > 0 ? android.toFixed(1) : 'N/A',
                changeValue: String(androidReviewCount),
                changeLabel: 'Play reviews',
                infoText: 'Average from the Google Play ratings report.',
            };
        }
        if (platform === 'ios') {
            return {
                value: ios > 0 ? ios.toFixed(1) : 'N/A',
                changeValue: String(iosReviewCount),
                changeLabel: 'App Store reviews',
                infoText: `Average from ${(downloadData?.rating_count ?? 0).toLocaleString()} App Store ratings.`,
            };
        }
        return {
            value: ios > 0 ? ios.toFixed(1) : android > 0 ? android.toFixed(1) : 'N/A',
            changeValue: android > 0 ? `★ ${android.toFixed(1)}` : '—',
            changeLabel: 'Play Store',
            infoText: `App Store ${ios > 0 ? ios.toFixed(1) : 'N/A'} · Play Store ${android > 0 ? android.toFixed(1) : 'N/A'}.`,
        };
    }, [downloadData, platform]);
    const installChartTitle = platform === 'all'
        ? 'Installs Over Past 7 Days'
        : `${platformFilterLabel(platform)} Installs Over Past 7 Days`;
    const storeChartTitle = platform === 'all'
        ? 'App Store installs vs Play Store installs'
        : `${platformFilterLabel(platform)} installs`;
    const storeChartSubtitle = platform === 'all' ? 'Last 7 days · iOS + Android' : 'Last 7 days';
    const regionSubtitle = platform === 'all'
        ? 'iOS vs Android by country'
        : `${platformFilterLabel(platform)} installs by country`;
    const regionBadgeLabel = platform === 'ios' ? 'iOS' : platform === 'android' ? 'Android' : 'Android';

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
                            {activeTab === 'acquisition' && (
                                <DownloadsAcquisitionPage
                                    data={downloadData}
                                    platform={platform}
                                    onPlatformChange={setPlatform}
                                />
                            )}
                        </Suspense>
                    )}

                    {activeTab === 'overview' && (
                        <>
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h1 className="text-lg font-semibold text-text-primary">Downloads Overview</h1>
                                    <p className="mt-1 text-sm text-text-muted">
                                        {platformFilterLabel(platform)} installs over the last {windowDays} days.
                                    </p>
                                </div>
                                <PlatformFilter value={platform} onChange={setPlatform} />
                            </div>

                            <div className="usage-kpi-grid">
                                <KpiCard
                                    icon={<FaDownload className="h-5 w-5 text-accent-primary" />}
                                    iconBgColor="bg-[rgba(36,132,199,0.1)]"
                                    label="Total Installs"
                                    value={fmt(installTotals.total)}
                                    footer={
                                        platform === 'all' ? (
                                            <PlatformBreakdown
                                                ios={installTotals.ios}
                                                android={installTotals.android}
                                            />
                                        ) : undefined
                                    }
                                    change={platform !== 'all' ? {
                                        value: platform === 'ios' ? 'App Store' : 'Play Store',
                                        label: platformFilterLabel(platform),
                                        trend: 'up',
                                    } : undefined}
                                    infoText={
                                        platform === 'all'
                                            ? 'Combined App Store and Play Store installs in the selected period.'
                                            : `${platformFilterLabel(platform)} installs in the selected period.`
                                    }
                                    animationDelay={0}
                                />
                                <KpiCard
                                    icon={<FaMobileScreen className="h-5 w-5 text-accent-green" />}
                                    iconBgColor="bg-[rgba(0,200,179,0.1)]"
                                    label={platform === 'android' ? 'Play Store Installs' : 'App Store Installs'}
                                    value={fmt(platform === 'android' ? installTotals.android : installTotals.ios)}
                                    change={{
                                        value: platform === 'all'
                                            ? fmt(installTotals.android)
                                            : fmt(installTotals.total),
                                        label: platform === 'all' ? 'Android' : 'Selected',
                                        trend: 'up',
                                    }}
                                    infoText={
                                        platform === 'android'
                                            ? 'Install units from Google Play Console reports.'
                                            : platform === 'ios'
                                                ? 'Install units from Apple Sales Reports.'
                                                : 'App Store installs; Android shown in the change label.'
                                    }
                                    animationDelay={1}
                                />
                                <KpiCard
                                    icon={<FaStar className="h-5 w-5 text-accent-orange" />}
                                    iconBgColor="bg-[rgba(232,155,0,0.1)]"
                                    label="Avg Rating"
                                    value={ratingKpi.value}
                                    change={{ value: ratingKpi.changeValue, label: ratingKpi.changeLabel, trend: 'up' }}
                                    infoText={ratingKpi.infoText}
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
                                            title={installChartTitle}
                                            infoText={`${platformFilterLabel(platform)} install units over the last seven days.`}
                                            seriesName="Installs"
                                            valueKey="total_messages"
                                            fixedPeriod="7d"
                                            hidePeriodSelector
                                        />
                                    </div>
                                    <div className="dashboard-two-col">
                                        <div className="animate-slide-in-up stagger-3 min-h-[340px] h-full">
                                            {platform === 'android' ? (
                                                <div className="bg-primary rounded-[15px] shadow-soft p-6 h-full flex flex-col justify-center">
                                                    <h3 className="text-sm font-semibold text-text-primary mb-2">Version Installs</h3>
                                                    <p className="text-sm text-text-muted">
                                                        Per-version install breakdown is available for App Store (iOS) only. Switch the filter to iOS or All to view versions.
                                                    </p>
                                                </div>
                                            ) : (
                                                <RoleCriticalTraffic roles={versionInstallRoles} title="Version Installs" showDetails={false} />
                                            )}
                                        </div>
                                        <div className="animate-slide-in-up stagger-4 min-h-[340px] h-full">
                                            <OutstandingReimbursement
                                                title="Installs by Region"
                                                subtitle={regionSubtitle}
                                                badgeLabel={regionBadgeLabel}
                                                platformItems={regionalPlatform}
                                            />
                                        </div>
                                    </div>
                                    <div className="animate-slide-in-up stagger-5">
                                        <DailyPatientFlow
                                            isFullscreen={flowFullscreen}
                                            onToggleFullscreen={() => setFlowFullscreen(!flowFullscreen)}
                                            dailyVolume={dailyStoreInstallSeries}
                                            title={storeChartTitle}
                                            subtitle={storeChartSubtitle}
                                            infoText={
                                                platform === 'all'
                                                    ? 'App Store install units versus Play Store installs over the last seven days.'
                                                    : `${platformFilterLabel(platform)} installs over the last seven days.`
                                            }
                                            primarySeriesLabel="Android"
                                            secondarySeriesLabel="iOS"
                                            tooltipUnitLabel="installs"
                                        />
                                    </div>
                                </div>
                                <div className="usage-main-grid__sidebar">
                                    <div className="animate-slide-in-right stagger-3">
                                        <RealInsightsSidebar data={downloadData} platform={platform} />
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
