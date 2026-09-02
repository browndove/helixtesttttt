'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { RevenueChart } from '@/components/ugmc-dashboard/executive-overview/components';
import { OutstandingReimbursement } from '@/components/ugmc-dashboard/billing-finance/components';
import { FaAndroid, FaApple, FaDownload, FaShieldHalved, FaStar, FaTrash } from 'react-icons/fa6';
import type { DownloadAnalyticsData, StoreAnalytics } from '@/lib/download-analytics-mock';
import { regionalPlatformRows } from '@/components/internal-downloads/PlatformFilter';
import {
    BreakdownCard,
    ChipBreakdown,
    DateRangeFilter,
    DownloadsKpiCard,
    MetricSnapshotRow,
    OptInBadge,
    PageToolbar,
    dailyToChart,
    downloadsDateRangeLabel,
    fmtMetric,
    labelPlayLanguage,
    labelPlayOsVersion,
    mergeDailySeries,
    mergeNamedCounts,
    resolveStores,
} from '@/components/internal-downloads/DownloadsWidgets';
import InfoTooltip from '@/components/info-tooltip';
import { ANALYTICS_CHART_DEFS, ASC_METRIC_DEFS, PLAY_METRIC_DEFS, storeMetricInfo } from '@/lib/app-store-metric-defs';

/**
 * Titled group of figures for a single store. The two stores are never merged
 * into one number here — where the metrics differ in meaning (funnels, install
 * base) they sit in parallel panels so the label always names its source.
 */
function StorePanel({
    store,
    title,
    subtitle,
    infoText,
    items,
    badge,
}: {
    store: 'ios' | 'android';
    title: string;
    subtitle: string;
    infoText: string;
    items: { label: string; value: string; info: string }[];
    badge?: ReactNode;
}) {
    return (
        <div className="bg-primary rounded-[15px] shadow-soft p-5 sm:p-6">
            <div className="mb-4">
                <div className="flex items-center gap-2">
                    {store === 'ios'
                        ? <FaApple className="h-4 w-4 text-text-secondary" />
                        : <FaAndroid className="h-4 w-4 text-accent-green" />}
                    <h3 className="text-sm font-bold text-text-primary">{title}</h3>
                    <InfoTooltip text={infoText} />
                    {badge}
                </div>
                <p className="mt-1 text-xs text-text-muted">{subtitle}</p>
            </div>
            <MetricSnapshotRow items={items} />
        </div>
    );
}

/**
 * Tooltip text for a panel covering one store only. storeMetricInfo() always
 * emits both store headings, which leaves a stray "no matching metric" line on
 * a panel that never claimed to cover the other store.
 */
function storePanelInfo(store: 'ios' | 'android', body: string): string {
    const heading = store === 'ios' ? 'iOS · App Store Connect' : 'Android · Google Play';
    return `${heading}\n${body.trim()}`;
}

function SectionHeading({ title, note }: { title: string; note: string }) {
    return (
        <div className="mt-2">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.08em] text-text-muted">{title}</h2>
            <p className="mt-1 text-xs text-text-muted">{note}</p>
        </div>
    );
}

function meanRating(ios: StoreAnalytics, android: StoreAnalytics): number {
    const parts = [ios.avg_rating, android.avg_rating].filter((n) => n > 0);
    if (parts.length === 0) return 0;
    return parts.reduce((sum, n) => sum + n, 0) / parts.length;
}

export default function DownloadsSinglePage({
    data,
    dateFrom,
    dateTo,
    allTimeFrom,
    allTimeTo,
    onDateRangeChange,
}: {
    data: DownloadAnalyticsData;
    dateFrom: string;
    dateTo: string;
    allTimeFrom: string;
    allTimeTo: string;
    onDateRangeChange: (from: string, to: string) => void;
}) {
    const { ios, android } = resolveStores(data);
    const [installsFullscreen, setInstallsFullscreen] = useState(false);
    const [updatesFullscreen, setUpdatesFullscreen] = useState(false);
    const [crashFullscreen, setCrashFullscreen] = useState(false);
    const rangeLabel = downloadsDateRangeLabel(dateFrom, dateTo, { from: allTimeFrom, to: allTimeTo });

    const androidUninstalls = android.device_uninstalls || android.user_uninstalls;

    const kpis = [
        {
            key: 'installs',
            label: 'New installs',
            value: fmtMetric(ios.first_time_downloads + android.device_installs),
            icon: <FaDownload className="h-5 w-5 text-accent-primary" />,
            bg: 'bg-[rgba(36,132,199,0.1)]',
            info: storeMetricInfo(ASC_METRIC_DEFS.first_time_downloads, PLAY_METRIC_DEFS.device_acquisition),
            ios: fmtMetric(ios.first_time_downloads),
            android: fmtMetric(android.device_installs),
            note: 'iOS first-time downloads plus Play install events. The two count differently — iOS per Apple Account, Play per device — so the total is indicative, not exact.',
        },
        {
            key: 'updates',
            label: 'Updates',
            value: fmtMetric(ios.updates + android.upgrades),
            icon: <FaDownload className="h-5 w-5 text-accent-green" />,
            bg: 'bg-[rgba(0,200,179,0.1)]',
            info: storeMetricInfo(ASC_METRIC_DEFS.updates, PLAY_METRIC_DEFS.device_updates),
            ios: fmtMetric(ios.updates),
            android: fmtMetric(android.upgrades),
            note: 'iOS updates include auto-updates; Play counts devices that installed a new version.',
        },
        {
            key: 'uninstalls',
            label: 'Uninstalls',
            value: fmtMetric(ios.deletions + androidUninstalls),
            icon: <FaTrash className="h-5 w-5 text-accent-orange" />,
            bg: 'bg-[rgba(232,155,0,0.1)]',
            info: storeMetricInfo(ASC_METRIC_DEFS.deletions, PLAY_METRIC_DEFS.device_loss),
            ios: fmtMetric(ios.deletions),
            android: fmtMetric(androidUninstalls),
            note: 'Play also treats a device dormant for 30 days as lost, so Android runs higher than an explicit delete.',
        },
        {
            key: 'rating',
            label: 'Average rating',
            value: fmtMetric(meanRating(ios, android), 'rating'),
            icon: <FaStar className="h-5 w-5 text-accent-violet" />,
            bg: 'bg-[rgba(105,116,247,0.1)]',
            info: storeMetricInfo(ASC_METRIC_DEFS.avg_rating, PLAY_METRIC_DEFS.average_rating),
            ios: fmtMetric(ios.avg_rating, 'rating'),
            android: fmtMetric(android.avg_rating, 'rating'),
            note: 'Unweighted mean of the two store averages. Play does not report a ratings count, so the averages cannot be weighted by volume.',
        },
    ];

    const installSeries = useMemo(
        () => mergeDailySeries(ios.daily, android.daily, 'first_time_downloads', 'device_installs'),
        [ios.daily, android.daily],
    );
    const updateSeries = useMemo(
        () => mergeDailySeries(ios.daily, android.daily, 'updates', 'upgrades'),
        [ios.daily, android.daily],
    );
    const crashSeries = useMemo(
        () => mergeDailySeries(ios.daily, android.daily, 'crashes', 'crashes'),
        [ios.daily, android.daily],
    );
    const anrSeries = useMemo(() => dailyToChart(android.daily, 'anrs'), [android.daily]);

    const regions = regionalPlatformRows(data, 'all');

    const sharedSources = mergeNamedCounts(ios.breakdowns.sources, android.breakdowns.sources);
    const sharedDevices = mergeNamedCounts(ios.breakdowns.devices, android.breakdowns.devices);
    const sharedVersions = mergeNamedCounts(
        ios.breakdowns.versions.map((row) => ({ name: `iOS ${row.name}`, count: row.count })),
        android.breakdowns.versions.map((row) => ({ name: `Android ${row.name}`, count: row.count })),
    );
    const sharedOsVersions = mergeNamedCounts(
        ios.breakdowns.platform_versions.map((row) => ({ name: `iOS ${row.name}`, count: row.count })),
        android.breakdowns.platform_versions.map((row) => ({
            name: labelPlayOsVersion(row.name),
            count: row.count,
        })),
    );
    const crashesByVersion = mergeNamedCounts(
        ios.breakdowns.crashes_by_version.map((row) => ({ name: `iOS ${row.name}`, count: row.count })),
        android.breakdowns.crashes_by_version.map((row) => ({ name: `Android ${row.name}`, count: row.count })),
    );

    const reviews = data.reviews.slice(0, 6);
    const freshness = [
        ios.data_through ? `iOS through ${ios.data_through}` : null,
        android.data_through ? `Android through ${android.data_through}` : null,
    ].filter(Boolean).join(' · ');

    return (
        <div className="flex w-full min-w-0 flex-col gap-4">
            <PageToolbar
                title="Downloads Analytics"
                subtitle={`App Store and Google Play · ${rangeLabel}`}
                pending={ios.reports_pending || android.reports_pending}
                extra={(
                    <DateRangeFilter
                        from={dateFrom}
                        to={dateTo}
                        allTimeFrom={allTimeFrom}
                        allTimeTo={allTimeTo}
                        onChange={onDateRangeChange}
                    />
                )}
            />

            <div className="downloads-kpi-grid">
                {kpis.map((kpi) => (
                    <DownloadsKpiCard
                        key={kpi.key}
                        icon={kpi.icon}
                        iconBgColor={kpi.bg}
                        label={kpi.label}
                        value={kpi.value}
                        infoText={kpi.info}
                        iosValue={kpi.ios}
                        androidValue={kpi.android}
                        figureNote={kpi.note}
                    />
                ))}
            </div>

            <SectionHeading
                title="Store funnel"
                note="Each store has its own funnel with its own denominator. These two columns are never combined into one rate."
            />
            <div className="dashboard-two-col">
                <StorePanel
                    store="ios"
                    title="App Store discovery to download"
                    subtitle="Impressions are store surface views, including product page views"
                    infoText={storePanelInfo(
                        'ios',
                        `Impressions\n${ASC_METRIC_DEFS.impressions}\n\nProduct Page Views\n${ASC_METRIC_DEFS.page_views}\n\nTotal Downloads\n${ASC_METRIC_DEFS.total_downloads}\n\nConversion\n${ASC_METRIC_DEFS.conversion}`,
                    )}
                    items={[
                        { label: 'Impressions', value: fmtMetric(ios.impressions), info: ASC_METRIC_DEFS.impressions },
                        { label: 'Product page views', value: fmtMetric(ios.page_views), info: ASC_METRIC_DEFS.page_views },
                        { label: 'Total downloads', value: fmtMetric(ios.total_downloads), info: ASC_METRIC_DEFS.total_downloads },
                        { label: 'Conversion', value: fmtMetric(ios.conversion_percent, 'percent'), info: ASC_METRIC_DEFS.conversion },
                    ]}
                />
                <StorePanel
                    store="android"
                    title="Play store listing to install"
                    subtitle="Visitors and acquisitions count only users without the app on any device"
                    infoText={storePanelInfo(
                        'android',
                        `Store listing visitors\n${PLAY_METRIC_DEFS.listing_visitors}\n\nStore listing acquisitions\n${PLAY_METRIC_DEFS.listing_acquisitions}\n\nInstalls\n${PLAY_METRIC_DEFS.device_acquisition}\n\nListing conversion\n${PLAY_METRIC_DEFS.listing_conversion}`,
                    )}
                    items={[
                        { label: 'Listing visitors', value: fmtMetric(android.listing_visitors), info: PLAY_METRIC_DEFS.listing_visitors },
                        { label: 'Listing acquisitions', value: fmtMetric(android.listing_acquisitions), info: PLAY_METRIC_DEFS.listing_acquisitions },
                        { label: 'Installs', value: fmtMetric(android.device_installs), info: PLAY_METRIC_DEFS.device_acquisition },
                        { label: 'Listing conversion', value: fmtMetric(android.listing_conversion_percent, 'percent'), info: PLAY_METRIC_DEFS.listing_conversion },
                    ]}
                />
            </div>

            <SectionHeading
                title="Daily trend"
                note="One line per store over the selected range."
            />
            <div className="dashboard-two-col">
                <RevenueChart
                    isFullscreen={installsFullscreen}
                    onToggleFullscreen={() => setInstallsFullscreen(!installsFullscreen)}
                    dailyVolume={installSeries}
                    title="Daily installs — iOS vs Android"
                    infoText={storeMetricInfo(ASC_METRIC_DEFS.first_time_downloads, PLAY_METRIC_DEFS.device_acquisition)}
                    seriesName="Android"
                    secondarySeriesName="iOS"
                    hidePeriodSelector
                />
                <RevenueChart
                    isFullscreen={updatesFullscreen}
                    onToggleFullscreen={() => setUpdatesFullscreen(!updatesFullscreen)}
                    dailyVolume={updateSeries}
                    title="Daily updates — iOS vs Android"
                    infoText={storeMetricInfo(ASC_METRIC_DEFS.updates, PLAY_METRIC_DEFS.device_updates) + '\n\n' + ANALYTICS_CHART_DEFS.updates_vs_upgrades}
                    seriesName="Android"
                    secondarySeriesName="iOS"
                    hidePeriodSelector
                />
            </div>

            <SectionHeading
                title="Install base and engagement"
                note="These two panels measure different things. iOS counts devices with a session; Play counts devices with the app installed."
            />
            <div className="dashboard-two-col">
                <StorePanel
                    store="ios"
                    title="App Store usage"
                    subtitle="Opt-in devices only · active devices is the busiest single day in the range"
                    badge={<OptInBadge />}
                    infoText={storePanelInfo(
                        'ios',
                        `Sessions\n${ASC_METRIC_DEFS.sessions}\n\nActive Devices\n${ASC_METRIC_DEFS.active_devices}`,
                    ) + '\n\n' + ANALYTICS_CHART_DEFS.active_devices_window}
                    items={[
                        { label: 'Sessions', value: fmtMetric(ios.sessions), info: ASC_METRIC_DEFS.sessions },
                        { label: 'Active devices (peak day)', value: fmtMetric(ios.active_devices), info: ASC_METRIC_DEFS.active_devices + '\n\n' + ANALYTICS_CHART_DEFS.active_devices_window },
                        { label: 'Avg session', value: ios.avg_session_duration_seconds > 0 ? `${Math.round(ios.avg_session_duration_seconds)}s` : 'N/A', info: 'Average session duration reported by App Store Connect for opt-in devices.' },
                        { label: 'Opt-in rate', value: fmtMetric(ios.opt_in_percent, 'percent'), info: 'Share of devices sharing App Analytics with Apple. Every iOS usage figure covers only these devices.' },
                    ]}
                />
                <StorePanel
                    store="android"
                    title="Play install base"
                    subtitle="Point-in-time counts from the latest reported day · not window sums"
                    infoText={storePanelInfo('android', PLAY_METRIC_DEFS.install_base) + '\n\n' + ANALYTICS_CHART_DEFS.active_devices_window}
                    items={[
                        { label: 'Install base', value: fmtMetric(android.active_devices), info: PLAY_METRIC_DEFS.install_base },
                        { label: 'Devices with app', value: fmtMetric(android.current_device_installs), info: 'Current device installs on the latest reported day.' },
                        { label: 'Users with app', value: fmtMetric(android.current_user_installs), info: 'Current user installs on the latest reported day.' },
                        { label: 'Lifetime users', value: fmtMetric(android.total_user_installs), info: 'Cumulative total user installs. A running lifetime maximum, never a window sum.' },
                        { label: 'Daily users', value: fmtMetric(android.user_installs), info: PLAY_METRIC_DEFS.daily_users },
                    ]}
                />
            </div>

            <SectionHeading
                title="Quality"
                note="Crash and ANR reporting is opt-in on both stores, so every figure here is a floor rather than a total."
            />
            <div className="dashboard-two-col">
                <StorePanel
                    store="ios"
                    title="App Store stability"
                    subtitle="Crash-free rate needs sessions, so it exists only on iOS"
                    badge={<OptInBadge />}
                    infoText={storePanelInfo('ios', ASC_METRIC_DEFS.crashes)}
                    items={[
                        { label: 'Crashes', value: fmtMetric(ios.crashes), info: ASC_METRIC_DEFS.crashes },
                        { label: 'Crash-free rate', value: fmtMetric(ios.crash_free_rate_percent, 'percent'), info: 'Sessions without a crash, derived from crashes divided by sessions. Play reports no sessions, so it has no equivalent.' },
                    ]}
                />
                <StorePanel
                    store="android"
                    title="Play vitals"
                    subtitle="Collected from users who share usage and diagnostics data"
                    badge={<OptInBadge />}
                    infoText={storePanelInfo('android', `Crashes\n${PLAY_METRIC_DEFS.crashes}\n\nANRs\n${PLAY_METRIC_DEFS.anrs}`)}
                    items={[
                        { label: 'Crashes', value: fmtMetric(android.crashes), info: PLAY_METRIC_DEFS.crashes },
                        { label: 'ANRs', value: fmtMetric(android.anrs), info: PLAY_METRIC_DEFS.anrs },
                    ]}
                />
            </div>
            <div className="dashboard-two-col">
                <RevenueChart
                    isFullscreen={crashFullscreen}
                    onToggleFullscreen={() => setCrashFullscreen(!crashFullscreen)}
                    dailyVolume={crashSeries}
                    title="Daily crashes — iOS vs Android"
                    infoText={storeMetricInfo(ASC_METRIC_DEFS.crashes, PLAY_METRIC_DEFS.crashes)}
                    seriesName="Android"
                    secondarySeriesName="iOS"
                    hidePeriodSelector
                />
                <RevenueChart
                    dailyVolume={anrSeries}
                    title="Daily ANRs — Android"
                    infoText={storePanelInfo('android', PLAY_METRIC_DEFS.anrs)}
                    seriesName="ANRs"
                    hidePeriodSelector
                />
            </div>
            <div className="dashboard-two-col">
                <BreakdownCard
                    title="Crashes by app version"
                    subtitle="Both stores, prefixed by platform"
                    items={crashesByVersion}
                    emptyText="No crash reports in this window."
                    infoText={ANALYTICS_CHART_DEFS.crashes}
                    chart="bar"
                />
                <BreakdownCard
                    title="ANRs by app version"
                    subtitle="Android only"
                    items={android.breakdowns.anrs_by_version}
                    emptyText="No ANR reports in this window."
                    infoText={ANALYTICS_CHART_DEFS.anrs}
                    chart="bar"
                />
            </div>

            <SectionHeading
                title="Where installs come from"
                note="The five dimensions both stores export. Breakdown rows are install or visit counts, so they will not add up to the totals above."
            />
            <OutstandingReimbursement
                title="Top countries"
                subtitle="Split bars show App Store territory against Play country"
                badgeLabel="All"
                platformItems={regions}
                infoText={ANALYTICS_CHART_DEFS.regions}
            />
            <div className="dashboard-two-col">
                <BreakdownCard
                    title="Traffic source"
                    subtitle="iOS counts impressions by source type; Play counts listing visitors"
                    items={sharedSources}
                    emptyText="No source breakdown in this window."
                    infoText={ANALYTICS_CHART_DEFS.sources}
                    chart="bar"
                />
                <ChipBreakdown
                    title="Device"
                    subtitle="Device family or model attributed to the install"
                    items={sharedDevices}
                    emptyText="No device breakdown in this window."
                    infoText={ANALYTICS_CHART_DEFS.devices}
                    chart="treemap"
                />
            </div>
            <div className="dashboard-two-col">
                <BreakdownCard
                    title="App version"
                    subtitle="Both stores, prefixed by platform"
                    items={sharedVersions}
                    emptyText="No version breakdown in this window."
                    infoText={ANALYTICS_CHART_DEFS.versions}
                    chart="bar"
                />
                <BreakdownCard
                    title="OS version"
                    subtitle="Play API levels shown as Android releases"
                    items={sharedOsVersions}
                    emptyText="No OS version breakdown in this window."
                    infoText={ANALYTICS_CHART_DEFS.play_attributes}
                    chart="bar"
                />
            </div>

            <SectionHeading
                title="Store-only acquisition detail"
                note="Dimensions only one store exports. Kept apart so an empty half never reads as zero on the other."
            />
            <div className="dashboard-two-col">
                <ChipBreakdown
                    title="App referrers"
                    subtitle="iOS only · apps that sent traffic to the product page"
                    items={ios.breakdowns.app_referrers}
                    emptyText="No app referrers in this window."
                    infoText={ANALYTICS_CHART_DEFS.referrers}
                    chart="column"
                />
                <ChipBreakdown
                    title="Web referrers"
                    subtitle="iOS only · sites that sent traffic to the product page"
                    items={ios.breakdowns.web_referrers}
                    emptyText="No web referrers in this window."
                    infoText={ANALYTICS_CHART_DEFS.referrers}
                    chart="bar"
                />
            </div>
            <div className="dashboard-two-col">
                <BreakdownCard
                    title="Campaigns"
                    subtitle="iOS only · App Store campaign attribution"
                    items={ios.breakdowns.campaigns}
                    emptyText="No campaign-attributed downloads yet."
                    infoText={ANALYTICS_CHART_DEFS.campaigns}
                    chart="column"
                />
                <BreakdownCard
                    title="Page type"
                    subtitle="iOS only · which page a product page view landed on"
                    items={ios.breakdowns.page_types}
                    emptyText="No page type breakdown in this window."
                    infoText={ANALYTICS_CHART_DEFS.page_types}
                    chart="bar"
                />
            </div>
            <div className="dashboard-two-col">
                <ChipBreakdown
                    title="Search terms"
                    subtitle="Android only · Play Search queries above privacy thresholds"
                    items={android.breakdowns.search_terms}
                    emptyText="No search terms above privacy thresholds."
                    infoText={ANALYTICS_CHART_DEFS.referrers}
                    chart="bar"
                />
                <BreakdownCard
                    title="Language"
                    subtitle="Android only · Play installs by device language"
                    items={android.breakdowns.languages.map((row) => ({
                        name: labelPlayLanguage(row.name),
                        count: row.count,
                    }))}
                    emptyText="No language breakdown in this window."
                    infoText={ANALYTICS_CHART_DEFS.play_attributes}
                    chart="bar"
                />
            </div>
            <BreakdownCard
                title="Carrier"
                subtitle="Android only · Play installs by mobile network"
                items={android.breakdowns.carriers}
                emptyText="No carrier breakdown in this window."
                infoText={ANALYTICS_CHART_DEFS.play_attributes}
                chart="bar"
            />

            <SectionHeading
                title="Reviews"
                note="Written reviews only. Star ratings without text are not returned by either store."
            />
            <div className="downloads-reviews-card">
                <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-text-primary">Recent reviews</h3>
                        <InfoTooltip text={ANALYTICS_CHART_DEFS.reviews} />
                    </div>
                    <span className="text-xs font-bold text-text-muted">{reviews.length}</span>
                </div>
                {reviews.length === 0 ? (
                    <p className="mt-3 text-sm text-text-muted">No written reviews in this window.</p>
                ) : (
                    <div className="downloads-reviews-card__list downloads-reviews-card__list--row">
                        {reviews.map((review, idx) => (
                            <div key={`${review.author}-${idx}`} className="downloads-reviews-card__item">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate text-sm font-bold text-text-primary">{review.author}</span>
                                    <span className="shrink-0 text-xs font-bold text-text-muted">
                                        {review.source === 'android' ? 'Play' : 'App Store'} · {review.rating.toFixed(1)}★
                                    </span>
                                </div>
                                <p className="mt-1 text-xs leading-5 text-text-secondary">{review.comment}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pb-2 text-xs text-text-muted">
                <span className="inline-flex items-center gap-1.5">
                    <FaShieldHalved className="h-3 w-3" />
                    Crashes, ANRs and all iOS usage figures cover opt-in devices only.
                </span>
                {freshness ? <span>{freshness}.</span> : null}
                {ios.reports_pending || android.reports_pending ? (
                    <span className="text-accent-orange">
                        {ios.reports_pending && android.reports_pending
                            ? 'Both stores still have reports generating.'
                            : ios.reports_pending
                                ? 'App Store reports are still generating.'
                                : 'Play reports are still generating.'}
                    </span>
                ) : null}
            </div>
        </div>
    );
}
