'use client';

import { useMemo, useState } from 'react';
import { RevenueChart } from '@/components/ugmc-dashboard/executive-overview/components';
import { OutstandingReimbursement } from '@/components/ugmc-dashboard/billing-finance/components';
import { FaDownload, FaArrowsRotate, FaPercent, FaEye, FaMobileScreen } from 'react-icons/fa6';
import type { DownloadAnalyticsData } from '@/lib/download-analytics-mock';
import {
    PlatformFilter,
    platformFilterLabel,
    regionalPlatformRows,
    type PlatformFilterValue,
} from '@/components/internal-downloads/PlatformFilter';
import {
    BreakdownCard,
    DateRangeFilter,
    DownloadsKpiCard,
    PageToolbar,
    RetentionBars,
    MetricSnapshotRow,
    dailyToChart,
    downloadsDateRangeLabel,
    fmtMetric,
    mergeDailySeries,
    mergeNamedCounts,
    resolveStores,
    dataFreshnessText,
} from '@/components/internal-downloads/DownloadsWidgets';
import { countryCodeToName } from '@/lib/country-names';
import { ANALYTICS_CHART_DEFS, ASC_METRIC_DEFS, PLAY_METRIC_DEFS, storeMetricInfo } from '@/lib/app-store-metric-defs';
import InfoTooltip from '@/components/info-tooltip';

export default function DownloadsOverviewPage({
    data,
    platform,
    onPlatformChange,
    dateFrom,
    dateTo,
    allTimeFrom,
    allTimeTo,
    onDateRangeChange,
}: {
    data: DownloadAnalyticsData;
    platform: PlatformFilterValue;
    onPlatformChange: (next: PlatformFilterValue) => void;
    dateFrom: string;
    dateTo: string;
    allTimeFrom: string;
    allTimeTo: string;
    onDateRangeChange: (from: string, to: string) => void;
}) {
    const { ios, android } = resolveStores(data);
    const [revenueFullscreen, setRevenueFullscreen] = useState(false);
    const [flowFullscreen, setFlowFullscreen] = useState(false);
    const rangeLabel = downloadsDateRangeLabel(dateFrom, dateTo, { from: allTimeFrom, to: allTimeTo });

    const combinedInstalls = ios.first_time_downloads + android.device_installs;
    const combinedDiscovery = ios.impressions + android.listing_visitors;
    const combinedUpdates = ios.updates + android.upgrades;
    const kpis = [
        {
            label: platform === 'ios' ? 'First Time Downloads' : platform === 'android' ? 'Installs' : 'Total installs',
            value: fmtMetric(platform === 'ios' ? ios.first_time_downloads : platform === 'android' ? android.device_installs : combinedInstalls),
            icon: <FaDownload className="h-5 w-5 text-accent-primary" />,
            bg: 'bg-[rgba(36,132,199,0.1)]',
            info: storeMetricInfo(ASC_METRIC_DEFS.first_time_downloads, PLAY_METRIC_DEFS.device_acquisition) + '\n\n' + dataFreshnessText(ios, android, platform),
            ios: fmtMetric(ios.first_time_downloads),
            android: fmtMetric(android.device_installs),
        },
        {
            label: platform === 'all' ? 'Conversion Rate by Platform' : platform === 'android' ? 'Store listing conversion' : 'Conversion Rate',
            value: platform === 'all' ? '—' : fmtMetric(platform === 'ios' ? ios.conversion_percent : android.listing_conversion_percent, 'percent'),
            icon: <FaPercent className="h-5 w-5 text-accent-orange" />,
            bg: 'bg-[rgba(232,155,0,0.1)]',
            info: storeMetricInfo(ASC_METRIC_DEFS.conversion, PLAY_METRIC_DEFS.listing_conversion),
            ios: fmtMetric(ios.conversion_percent, 'percent'),
            android: fmtMetric(android.listing_conversion_percent, 'percent'),
        },
        {
            label: platform === 'ios' ? 'Impressions' : platform === 'android' ? 'Store listing visitors' : 'Discovery',
            value: fmtMetric(platform === 'ios' ? ios.impressions : platform === 'android' ? android.listing_visitors : combinedDiscovery),
            icon: <FaEye className="h-5 w-5 text-accent-violet" />,
            bg: 'bg-[rgba(105,116,247,0.1)]',
            info: storeMetricInfo(ASC_METRIC_DEFS.impressions, PLAY_METRIC_DEFS.listing_visitors),
            ios: fmtMetric(ios.impressions),
            android: fmtMetric(android.listing_visitors),
        },
        {
            label: platform === 'android' ? 'Device updates' : 'Updates',
            value: fmtMetric(platform === 'ios' ? ios.updates : platform === 'android' ? android.upgrades : combinedUpdates),
            icon: platform === 'android' ? <FaArrowsRotate className="h-5 w-5 text-accent-green" /> : <FaMobileScreen className="h-5 w-5 text-accent-green" />,
            bg: 'bg-[rgba(0,200,179,0.1)]',
            info: storeMetricInfo(ASC_METRIC_DEFS.updates, PLAY_METRIC_DEFS.device_updates),
            ios: fmtMetric(ios.updates),
            android: fmtMetric(android.upgrades),
        },
    ];

    const trendDaily = useMemo(() => {
        if (platform === 'android') return dailyToChart(android.daily, 'device_installs', 'user_installs');
        if (platform === 'ios') return dailyToChart(ios.daily, 'first_time_downloads', 'redownloads');
        return mergeDailySeries(ios.daily, android.daily, 'first_time_downloads', 'device_installs');
    }, [android.daily, ios.daily, platform]);

    const extraDaily = useMemo(() => {
        if (platform === 'android') return dailyToChart(android.daily, 'listing_visitors', 'listing_acquisitions');
        if (platform === 'ios') return dailyToChart(ios.daily, 'page_views', 'updates');
        return mergeDailySeries(ios.daily, android.daily, 'updates', 'upgrades');
    }, [android.daily, ios.daily, platform]);

    const reviews = [...data.reviews].filter((review) => {
        if (platform === 'ios') return review.source !== 'android';
        if (platform === 'android') return review.source === 'android';
        return true;
    }).slice(0, 5);

    const regions = regionalPlatformRows(data, platform).map((row) => ({
        ...row,
        name: countryCodeToName(row.name),
    }));

    return (
        <>
            <PageToolbar
                title="Downloads Overview"
                subtitle={`${platformFilterLabel(platform)} · ${rangeLabel}`}
                pending={(ios.reports_pending || android.reports_pending) && platform !== 'android'}
                extra={(
                    <>
                        <DateRangeFilter from={dateFrom} to={dateTo} allTimeFrom={allTimeFrom} allTimeTo={allTimeTo} onChange={onDateRangeChange} />
                        <PlatformFilter value={platform} onChange={onPlatformChange} />
                    </>
                )}
            />

            <div className="downloads-kpi-grid">
                {kpis.map((kpi) => (
                    <DownloadsKpiCard
                        key={kpi.label}
                        icon={kpi.icon}
                        iconBgColor={kpi.bg}
                        label={kpi.label}
                        value={kpi.value}
                        infoText={kpi.info}
                        iosValue={kpi.ios}
                        androidValue={kpi.android}
                    />
                ))}
            </div>

            <div className="downloads-overview-stack">
                <RevenueChart
                    isFullscreen={revenueFullscreen}
                    onToggleFullscreen={() => setRevenueFullscreen(!revenueFullscreen)}
                    dailyVolume={trendDaily}
                    title={platform === 'ios' ? 'First Time Downloads vs Redownloads' : platform === 'android' ? 'Installs vs daily users' : 'iOS vs Android installs'}
                    infoText={storeMetricInfo(
                        `First Time Downloads\n${ASC_METRIC_DEFS.first_time_downloads}\n\nRedownloads\n${ASC_METRIC_DEFS.redownloads}`,
                        `Installs\n${PLAY_METRIC_DEFS.device_acquisition}\n\nDaily users\n${PLAY_METRIC_DEFS.daily_users}`,
                    )}
                    seriesName={platform === 'all' ? 'Android' : platform === 'ios' ? 'First-time' : 'Installs'}
                    secondarySeriesName={platform === 'all' ? 'iOS' : platform === 'ios' ? 'Redownloads' : 'Daily users'}
                    hidePeriodSelector
                />

                <div className="downloads-overview-mid">
                    {platform === 'android' ? (
                        <div className="bg-primary rounded-[15px] shadow-soft p-5 sm:p-6">
                            <div className="mb-4">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-text-primary">Android installs and lifecycle events</h3>
                                    <InfoTooltip text={storeMetricInfo(
                                        `Installs\n${PLAY_METRIC_DEFS.device_acquisition}\n\nDevice uninstalls\n${PLAY_METRIC_DEFS.device_loss}\n\nDaily users\n${PLAY_METRIC_DEFS.daily_users}\n\nUser uninstalls\nUser-level uninstall events from Play bulk reports.\n\nUpgrades\n${PLAY_METRIC_DEFS.device_updates}`,
                                    )} />
                                </div>
                                <p className="mt-1 text-xs text-text-muted">Play Console · selected window</p>
                            </div>
                            <MetricSnapshotRow
                                items={[
                                    { label: 'Installs', value: fmtMetric(android.device_installs), info: PLAY_METRIC_DEFS.device_acquisition },
                                    { label: 'Device uninstalls', value: fmtMetric(android.device_uninstalls || android.user_uninstalls), info: PLAY_METRIC_DEFS.device_loss },
                                    { label: 'Daily users', value: fmtMetric(android.user_installs), info: PLAY_METRIC_DEFS.daily_users },
                                    { label: 'User uninstalls', value: fmtMetric(android.user_uninstalls), info: 'User-level uninstall events from Play bulk reports.' },
                                    { label: 'Upgrades', value: fmtMetric(android.upgrades), info: PLAY_METRIC_DEFS.device_updates },
                                ]}
                            />
                        </div>
                    ) : platform === 'ios' ? (
                        <RetentionBars
                            d1={ios.retention.d1}
                            d7={ios.retention.d7}
                            d14={ios.retention.d14}
                            d28={ios.retention.d28}
                            pending={ios.reports_pending}
                            infoText={ANALYTICS_CHART_DEFS.retention}
                        />
                    ) : (
                        <BreakdownCard
                            title="Installs by platform"
                            subtitle="App Store + Play Console · selected window"
                            chart="bar"
                            infoText={storeMetricInfo(
                                `iOS first-time downloads\n${ASC_METRIC_DEFS.first_time_downloads}`,
                                `Android installs\n${PLAY_METRIC_DEFS.device_acquisition}`,
                            )}
                            items={[
                                { name: 'iOS installs', count: ios.first_time_downloads },
                                { name: 'Android installs', count: android.device_installs },
                            ].filter((row) => row.count > 0)}
                        />
                    )}
                    <BreakdownCard
                        title={platform === 'android' ? 'Crashes & ANRs' : platform === 'ios' ? 'Crashes by version' : 'Crashes by version'}
                        subtitle={platform === 'all' ? 'iOS opt-in crashes plus Play vitals' : 'Opt-in on iOS · Play vitals on Android'}
                        chart="bar"
                        infoText={ANALYTICS_CHART_DEFS.crashes}
                        items={
                            platform === 'android'
                                ? android.breakdowns.crashes_by_version
                                : platform === 'ios'
                                    ? ios.breakdowns.crashes_by_version
                                    : mergeNamedCounts(
                                        ios.breakdowns.crashes_by_version.map((row) => ({ name: `iOS ${row.name}`, count: row.count })),
                                        android.breakdowns.crashes_by_version.map((row) => ({ name: `Android ${row.name}`, count: row.count })),
                                        android.breakdowns.anrs_by_version.map((row) => ({ name: `ANR ${row.name}`, count: row.count })),
                                    )
                        }
                        emptyText="No crash reports in this window."
                    />
                    <OutstandingReimbursement
                        title="Top regions"
                        subtitle={platformFilterLabel(platform)}
                        badgeLabel={platform === 'ios' ? 'iOS' : platform === 'android' ? 'Android' : 'All'}
                        platformItems={regions}
                        infoText={ANALYTICS_CHART_DEFS.regions}
                    />
                </div>

                <RevenueChart
                    isFullscreen={flowFullscreen}
                    onToggleFullscreen={() => setFlowFullscreen(!flowFullscreen)}
                    dailyVolume={extraDaily}
                    title={platform === 'android' ? 'Listing visitors vs acquisitions' : platform === 'ios' ? 'Product Page Views vs Updates' : 'iOS updates vs Play upgrades'}
                    infoText={storeMetricInfo(
                        `Product Page Views\n${ASC_METRIC_DEFS.page_views}\n\nUpdates\n${ASC_METRIC_DEFS.updates}`,
                        `Store listing visitors\n${PLAY_METRIC_DEFS.listing_visitors}\n\nStore listing acquisitions\n${PLAY_METRIC_DEFS.listing_acquisitions}\n\nDevice updates\n${PLAY_METRIC_DEFS.device_updates}`,
                    )}
                    seriesName={platform === 'android' ? 'Visitors' : platform === 'ios' ? 'Page views' : 'Play upgrades'}
                    secondarySeriesName={platform === 'android' ? 'Acquisitions' : platform === 'ios' ? 'Updates' : 'iOS updates'}
                    hidePeriodSelector
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
                                        <span className="shrink-0 text-xs font-bold text-text-muted">{review.rating.toFixed(1)}★</span>
                                    </div>
                                    <p className="mt-1 text-xs leading-5 text-text-secondary">{review.comment}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
