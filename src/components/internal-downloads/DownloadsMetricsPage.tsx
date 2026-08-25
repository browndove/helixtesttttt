'use client';

import { useMemo, useState, useEffect } from 'react';
import { RevenueChart } from '@/components/ugmc-dashboard/executive-overview/components';
import type { DownloadAnalyticsData, NamedCount, StoreDailyPoint } from '@/lib/download-analytics-mock';
import {
    PlatformFilter,
    platformFilterLabel,
    type PlatformFilterValue,
} from '@/components/internal-downloads/PlatformFilter';
import {
    BreakdownCard,
    DateRangeFilter,
    DownloadsKpiCard,
    PageToolbar,
    dailyToChart,
    downloadsDateRangeLabel,
    fmtMetric,
    mergeDailySeries,
    mergeNamedCounts,
    resolveStores,
    dataFreshnessText,
} from '@/components/internal-downloads/DownloadsWidgets';
import InfoTooltip from '@/components/info-tooltip';
import { ANALYTICS_CHART_DEFS, ASC_METRIC_DEFS, PLAY_METRIC_DEFS, storeMetricInfo } from '@/lib/app-store-metric-defs';
import clsx from 'clsx';
import { FaDownload, FaEye, FaShieldHalved, FaStar } from 'react-icons/fa6';

type MetricDef = {
    id: string;
    label: string;
    kind: 'count' | 'percent' | 'rating';
    dailyKey?: keyof StoreDailyPoint;
    info?: string;
    group?: string;
    total: (store: ReturnType<typeof resolveStores>['ios']) => number;
    breakdown?: (store: ReturnType<typeof resolveStores>['ios']) => NamedCount[];
};

const IOS_METRICS: MetricDef[] = [
    { id: 'page_views', label: 'Product Page Views', kind: 'count', group: 'App Store', dailyKey: 'page_views', info: storeMetricInfo(ASC_METRIC_DEFS.page_views, PLAY_METRIC_DEFS.listing_acquisitions), total: (s) => s.page_views, breakdown: (s) => s.breakdowns.page_types },
    { id: 'unique_page_views', label: 'Product Page Views (Unique Devices)', kind: 'count', group: 'App Store', dailyKey: 'unique_page_views', info: storeMetricInfo(ASC_METRIC_DEFS.unique_page_views, PLAY_METRIC_DEFS.listing_acquisitions), total: (s) => s.unique_page_views },
    { id: 'impressions', label: 'Impressions', kind: 'count', group: 'App Store', dailyKey: 'impressions', info: storeMetricInfo(ASC_METRIC_DEFS.impressions, PLAY_METRIC_DEFS.listing_visitors), total: (s) => s.impressions, breakdown: (s) => s.breakdowns.sources },
    { id: 'unique_impressions', label: 'Impressions (Unique Devices)', kind: 'count', group: 'App Store', dailyKey: 'unique_impressions', info: storeMetricInfo(ASC_METRIC_DEFS.unique_impressions, PLAY_METRIC_DEFS.listing_visitors), total: (s) => s.unique_impressions },
    { id: 'conversion', label: 'Conversion Rate', kind: 'percent', group: 'App Store', info: storeMetricInfo(ASC_METRIC_DEFS.conversion, PLAY_METRIC_DEFS.listing_conversion), total: (s) => s.conversion_percent },
    { id: 'updates', label: 'Updates', kind: 'count', group: 'App Store', dailyKey: 'updates', info: storeMetricInfo(ASC_METRIC_DEFS.updates, PLAY_METRIC_DEFS.device_updates), total: (s) => s.updates, breakdown: (s) => s.breakdowns.versions },
    { id: 'total_downloads', label: 'Total Downloads', kind: 'count', group: 'Downloads', dailyKey: 'total_downloads', info: storeMetricInfo(ASC_METRIC_DEFS.total_downloads, PLAY_METRIC_DEFS.device_acquisition), total: (s) => s.total_downloads, breakdown: (s) => s.breakdowns.sources },
    { id: 'first_time', label: 'First Time Downloads', kind: 'count', group: 'Downloads', dailyKey: 'first_time_downloads', info: storeMetricInfo(ASC_METRIC_DEFS.first_time_downloads, PLAY_METRIC_DEFS.device_acquisition), total: (s) => s.first_time_downloads, breakdown: (s) => s.breakdowns.sources },
    { id: 'redownloads', label: 'Redownloads', kind: 'count', group: 'Downloads', dailyKey: 'redownloads', info: storeMetricInfo(ASC_METRIC_DEFS.redownloads), total: (s) => s.redownloads },
    { id: 'active', label: 'Active Devices', kind: 'count', group: 'Usage', dailyKey: 'active_devices', info: storeMetricInfo(ASC_METRIC_DEFS.active_devices, PLAY_METRIC_DEFS.install_base), total: (s) => s.active_devices, breakdown: (s) => s.breakdowns.devices },
    { id: 'sessions', label: 'Sessions', kind: 'count', group: 'Usage', dailyKey: 'sessions', info: storeMetricInfo(ASC_METRIC_DEFS.sessions), total: (s) => s.sessions, breakdown: (s) => s.breakdowns.versions },
    { id: 'installs', label: 'Installations', kind: 'count', group: 'Usage', dailyKey: 'installations', info: storeMetricInfo(ASC_METRIC_DEFS.installations, PLAY_METRIC_DEFS.device_acquisition), total: (s) => s.installations },
    { id: 'crashes', label: 'Crashes', kind: 'count', group: 'Usage', dailyKey: 'crashes', info: storeMetricInfo(ASC_METRIC_DEFS.crashes, PLAY_METRIC_DEFS.crashes), total: (s) => s.crashes, breakdown: (s) => s.breakdowns.crashes_by_version },
    { id: 'active_30', label: 'Active in Last 30 Days', kind: 'count', group: 'Usage', info: storeMetricInfo(ASC_METRIC_DEFS.active_last_30_days, PLAY_METRIC_DEFS.install_base), total: (s) => s.active_last_30_days },
    { id: 'deletions', label: 'Deletions', kind: 'count', group: 'Usage', dailyKey: 'deletions', info: storeMetricInfo(ASC_METRIC_DEFS.deletions, PLAY_METRIC_DEFS.device_loss), total: (s) => s.deletions },
];

const ANDROID_METRICS: MetricDef[] = [
    { id: 'visitors', label: 'Store listing visitors', kind: 'count', group: 'Store', dailyKey: 'listing_visitors', info: storeMetricInfo(ASC_METRIC_DEFS.impressions, PLAY_METRIC_DEFS.listing_visitors), total: (s) => s.listing_visitors, breakdown: (s) => s.breakdowns.sources },
    { id: 'acquisitions', label: 'Store listing acquisitions', kind: 'count', group: 'Store', dailyKey: 'listing_acquisitions', info: storeMetricInfo(ASC_METRIC_DEFS.page_views, PLAY_METRIC_DEFS.listing_acquisitions), total: (s) => s.listing_acquisitions, breakdown: (s) => s.breakdowns.territories },
    { id: 'conversion', label: 'Store listing conversion', kind: 'percent', group: 'Store', info: storeMetricInfo(ASC_METRIC_DEFS.conversion, PLAY_METRIC_DEFS.listing_conversion), total: (s) => s.listing_conversion_percent },
    { id: 'user_installs', label: 'Daily users', kind: 'count', group: 'Installs', dailyKey: 'user_installs', info: storeMetricInfo(ASC_METRIC_DEFS.first_time_downloads, PLAY_METRIC_DEFS.daily_users), total: (s) => s.user_installs, breakdown: (s) => s.breakdowns.territories },
    { id: 'device_installs', label: 'Installs', kind: 'count', group: 'Installs', dailyKey: 'device_installs', info: storeMetricInfo(ASC_METRIC_DEFS.first_time_downloads, PLAY_METRIC_DEFS.device_acquisition), total: (s) => s.device_installs, breakdown: (s) => s.breakdowns.devices },
    { id: 'uninstalls', label: 'Device loss', kind: 'count', group: 'Installs', dailyKey: 'device_uninstalls', info: storeMetricInfo(ASC_METRIC_DEFS.deletions, PLAY_METRIC_DEFS.device_loss), total: (s) => s.device_uninstalls },
    { id: 'upgrades', label: 'Device updates', kind: 'count', group: 'Installs', dailyKey: 'upgrades', info: storeMetricInfo(ASC_METRIC_DEFS.updates, PLAY_METRIC_DEFS.device_updates), total: (s) => s.upgrades, breakdown: (s) => s.breakdowns.versions },
    { id: 'active', label: 'Install base', kind: 'count', group: 'Usage', dailyKey: 'active_devices', info: storeMetricInfo(ASC_METRIC_DEFS.active_devices, PLAY_METRIC_DEFS.install_base), total: (s) => s.active_devices },
    { id: 'crashes', label: 'Crashes', kind: 'count', group: 'Vitals', dailyKey: 'crashes', info: storeMetricInfo(ASC_METRIC_DEFS.crashes, PLAY_METRIC_DEFS.crashes), total: (s) => s.crashes, breakdown: (s) => s.breakdowns.crashes_by_version },
    { id: 'anrs', label: 'ANRs', kind: 'count', group: 'Vitals', dailyKey: 'anrs', info: storeMetricInfo(undefined, PLAY_METRIC_DEFS.anrs), total: (s) => s.anrs, breakdown: (s) => s.breakdowns.anrs_by_version },
    { id: 'rating', label: 'Average rating', kind: 'rating', group: 'Vitals', info: storeMetricInfo(ASC_METRIC_DEFS.avg_rating, PLAY_METRIC_DEFS.average_rating), total: (s) => s.avg_rating },
];

const COMBINED_METRICS: {
    id: string;
    label: string;
    kind: 'count' | 'percent' | 'rating';
    iosKey?: keyof StoreDailyPoint;
    androidKey?: keyof StoreDailyPoint;
    info?: string;
    total: (ios: ReturnType<typeof resolveStores>['ios'], android: ReturnType<typeof resolveStores>['ios']) => number;
    iosTotal: (ios: ReturnType<typeof resolveStores>['ios']) => number;
    androidTotal: (android: ReturnType<typeof resolveStores>['ios']) => number;
    breakdown: (ios: ReturnType<typeof resolveStores>['ios'], android: ReturnType<typeof resolveStores>['ios']) => NamedCount[];
}[] = [
    {
        id: 'installs',
        label: 'Installs',
        kind: 'count',
        iosKey: 'first_time_downloads',
        androidKey: 'device_installs',
        info: storeMetricInfo(ASC_METRIC_DEFS.first_time_downloads, PLAY_METRIC_DEFS.device_acquisition),
        total: (ios, android) => ios.first_time_downloads + android.device_installs,
        iosTotal: (ios) => ios.first_time_downloads,
        androidTotal: (android) => android.device_installs,
        breakdown: (ios, android) => mergeNamedCounts(ios.breakdowns.territories, android.breakdowns.territories),
    },
    {
        id: 'discovery',
        label: 'Discovery',
        kind: 'count',
        iosKey: 'impressions',
        androidKey: 'listing_visitors',
        info: storeMetricInfo(ASC_METRIC_DEFS.impressions, PLAY_METRIC_DEFS.listing_visitors),
        total: (ios, android) => ios.impressions + android.listing_visitors,
        iosTotal: (ios) => ios.impressions,
        androidTotal: (android) => android.listing_visitors,
        breakdown: (ios, android) => mergeNamedCounts(ios.breakdowns.sources, android.breakdowns.sources),
    },
    {
        id: 'page_views',
        label: 'Product pages',
        kind: 'count',
        iosKey: 'page_views',
        androidKey: 'listing_acquisitions',
        info: storeMetricInfo(ASC_METRIC_DEFS.page_views, PLAY_METRIC_DEFS.listing_acquisitions),
        total: (ios, android) => ios.page_views + android.listing_acquisitions,
        iosTotal: (ios) => ios.page_views,
        androidTotal: (android) => android.listing_acquisitions,
        breakdown: (ios, android) => mergeNamedCounts(ios.breakdowns.page_types, android.breakdowns.sources),
    },
    {
        id: 'updates',
        label: 'Updates',
        kind: 'count',
        iosKey: 'updates',
        androidKey: 'upgrades',
        info: storeMetricInfo(ASC_METRIC_DEFS.updates, PLAY_METRIC_DEFS.device_updates),
        total: (ios, android) => ios.updates + android.upgrades,
        iosTotal: (ios) => ios.updates,
        androidTotal: (android) => android.upgrades,
        breakdown: (ios, android) => mergeNamedCounts(ios.breakdowns.versions, android.breakdowns.versions),
    },
    {
        id: 'active',
        label: 'Active devices',
        kind: 'count',
        iosKey: 'active_devices',
        androidKey: 'active_devices',
        info: storeMetricInfo(ASC_METRIC_DEFS.active_devices, PLAY_METRIC_DEFS.install_base),
        total: (ios, android) => ios.active_devices + android.active_devices,
        iosTotal: (ios) => ios.active_devices,
        androidTotal: (android) => android.active_devices,
        breakdown: (ios, android) => mergeNamedCounts(ios.breakdowns.devices, android.breakdowns.devices),
    },
    {
        id: 'crashes',
        label: 'Crashes',
        kind: 'count',
        iosKey: 'crashes',
        androidKey: 'crashes',
        info: storeMetricInfo(ASC_METRIC_DEFS.crashes, PLAY_METRIC_DEFS.crashes),
        total: (ios, android) => ios.crashes + android.crashes,
        iosTotal: (ios) => ios.crashes,
        androidTotal: (android) => android.crashes,
        breakdown: (ios, android) => mergeNamedCounts(
            ios.breakdowns.crashes_by_version.map((row) => ({ name: `iOS ${row.name}`, count: row.count })),
            android.breakdowns.crashes_by_version.map((row) => ({ name: `Android ${row.name}`, count: row.count })),
        ),
    },
    {
        id: 'uninstalls',
        label: 'Deletions / device loss',
        kind: 'count',
        iosKey: 'deletions',
        androidKey: 'device_uninstalls',
        info: storeMetricInfo(ASC_METRIC_DEFS.deletions, PLAY_METRIC_DEFS.device_loss),
        total: (ios, android) => ios.deletions + android.device_uninstalls,
        iosTotal: (ios) => ios.deletions,
        androidTotal: (android) => android.device_uninstalls,
        breakdown: (ios, android) => mergeNamedCounts(ios.breakdowns.territories, android.breakdowns.territories),
    },
];

const IOS_DIMS: { id: string; label: string; pick: (s: ReturnType<typeof resolveStores>['ios']) => NamedCount[] }[] = [
    { id: 'territory', label: 'Territory', pick: (s) => s.breakdowns.territories },
    { id: 'device', label: 'Device', pick: (s) => s.breakdowns.devices },
    { id: 'source', label: 'Source', pick: (s) => s.breakdowns.sources },
    { id: 'version', label: 'App version', pick: (s) => s.breakdowns.versions },
    { id: 'os', label: 'OS version', pick: (s) => s.breakdowns.platform_versions },
];

const ANDROID_DIMS: { id: string; label: string; pick: (s: ReturnType<typeof resolveStores>['ios']) => NamedCount[] }[] = [
    { id: 'country', label: 'Country', pick: (s) => s.breakdowns.territories },
    { id: 'device', label: 'Device', pick: (s) => s.breakdowns.devices },
    { id: 'os', label: 'OS version', pick: (s) => s.breakdowns.platform_versions },
    { id: 'version', label: 'App version', pick: (s) => s.breakdowns.versions },
    { id: 'traffic', label: 'Traffic source', pick: (s) => s.breakdowns.sources },
];

function conversionDaily(daily: StoreDailyPoint[]) {
    return daily.map((row) => {
        const unique = Number(row.unique_impressions) || 0;
        const downloads = Number(row.total_downloads) || 0;
        const rate = unique > 0 ? Math.round((downloads / unique) * 1000) / 10 : 0;
        return { day: row.day, total_messages: rate, critical_messages: rate, standard_messages: rate };
    });
}

export default function DownloadsMetricsPage({
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
    const combined = platform === 'all';
    const store = platform === 'android' ? android : ios;
    const metrics = platform === 'android' ? ANDROID_METRICS : IOS_METRICS;
    const dims = platform === 'android' ? ANDROID_DIMS : IOS_DIMS;
    const [metricId, setMetricId] = useState(combined ? COMBINED_METRICS[0].id : metrics[0].id);
    const [dimId, setDimId] = useState(dims[0].id);
    const [chartFullscreen, setChartFullscreen] = useState(false);
    const [compareFullscreen, setCompareFullscreen] = useState(false);
    const rangeLabel = downloadsDateRangeLabel(dateFrom, dateTo, { from: allTimeFrom, to: allTimeTo });

    useEffect(() => {
        if (platform === 'all') {
            setMetricId(COMBINED_METRICS[0].id);
            return;
        }
        setMetricId((platform === 'android' ? ANDROID_METRICS : IOS_METRICS)[0].id);
        setDimId((platform === 'android' ? ANDROID_DIMS : IOS_DIMS)[0].id);
    }, [platform]);

    const combinedMetric = COMBINED_METRICS.find((row) => row.id === metricId) || COMBINED_METRICS[0];
    const metric = metrics.find((row) => row.id === metricId) || metrics[0];
    const dim = dims.find((row) => row.id === dimId) || dims[0];
    const picker = combined ? COMBINED_METRICS : metrics;

    const series = useMemo(() => {
        if (combined) {
            return mergeDailySeries(
                ios.daily,
                android.daily,
                combinedMetric.iosKey || 'first_time_downloads',
                combinedMetric.androidKey || 'device_installs',
            );
        }
        if (metric.id === 'conversion' && platform === 'ios') return conversionDaily(store.daily);
        if (metric.dailyKey) return dailyToChart(store.daily, metric.dailyKey);
        if (metric.id === 'active_30') return dailyToChart(store.daily, 'active_devices');
        return [];
    }, [android.daily, combined, combinedMetric.androidKey, combinedMetric.iosKey, ios.daily, metric.dailyKey, metric.id, platform, store.daily]);

    const compareSeries = useMemo(
        () => mergeDailySeries(ios.daily, android.daily, 'first_time_downloads', 'device_installs'),
        [android.daily, ios.daily],
    );
    const crashSeries = useMemo(
        () => mergeDailySeries(ios.daily, android.daily, 'crashes', 'crashes'),
        [android.daily, ios.daily],
    );

    const breakdown = combined
        ? combinedMetric.breakdown(ios, android)
        : (metric.breakdown?.(store) || dim.pick(store));
    const totalValue = combined ? combinedMetric.total(ios, android) : metric.total(store);
    const metricLabel = combined ? combinedMetric.label : metric.label;
    const metricKind = combined ? combinedMetric.kind : metric.kind;
    const metricInfo = combined ? combinedMetric.info : metric.info;

    const crashItems = mergeNamedCounts(
        ios.breakdowns.crashes_by_version.map((row) => ({ name: `iOS ${row.name}`, count: row.count })),
        android.breakdowns.crashes_by_version.map((row) => ({ name: `Android ${row.name}`, count: row.count })),
        android.breakdowns.anrs_by_version.map((row) => ({ name: `ANR ${row.name}`, count: row.count })),
    );
    const sourceItems = platform === 'android'
        ? android.breakdowns.sources
        : platform === 'ios'
            ? ios.breakdowns.sources
            : mergeNamedCounts(ios.breakdowns.sources, android.breakdowns.sources);

    return (
        <div className="flex w-full min-w-0 flex-col gap-4">
            <PageToolbar
                title="Metrics"
                subtitle={`${platformFilterLabel(platform)} · ${rangeLabel}`}
                extra={(
                    <>
                        <DateRangeFilter from={dateFrom} to={dateTo} allTimeFrom={allTimeFrom} allTimeTo={allTimeTo} onChange={onDateRangeChange} />
                        <PlatformFilter value={platform} onChange={onPlatformChange} />
                    </>
                )}
            />

            <div className="downloads-kpi-grid">
                <DownloadsKpiCard
                    icon={<FaDownload className="h-5 w-5 text-accent-primary" />}
                    iconBgColor="bg-[rgba(36,132,199,0.1)]"
                    label="Installs"
                    value={fmtMetric(ios.first_time_downloads + android.device_installs)}
                    infoText={storeMetricInfo(ASC_METRIC_DEFS.first_time_downloads, PLAY_METRIC_DEFS.device_acquisition) + '\n\n' + dataFreshnessText(ios, android, platform)}
                    iosValue={fmtMetric(ios.first_time_downloads)}
                    androidValue={fmtMetric(android.device_installs)}
                />
                <DownloadsKpiCard
                    icon={<FaEye className="h-5 w-5 text-accent-violet" />}
                    iconBgColor="bg-[rgba(105,116,247,0.1)]"
                    label="Discovery"
                    value={fmtMetric(ios.impressions + android.listing_visitors)}
                    infoText={storeMetricInfo(ASC_METRIC_DEFS.impressions, PLAY_METRIC_DEFS.listing_visitors)}
                    iosValue={fmtMetric(ios.impressions)}
                    androidValue={fmtMetric(android.listing_visitors)}
                />
                <DownloadsKpiCard
                    icon={<FaShieldHalved className="h-5 w-5 text-accent-orange" />}
                    iconBgColor="bg-[rgba(232,155,0,0.1)]"
                    label="Crashes"
                    value={fmtMetric(ios.crashes + android.crashes)}
                    infoText={storeMetricInfo(ASC_METRIC_DEFS.crashes, PLAY_METRIC_DEFS.crashes)}
                    iosValue={fmtMetric(ios.crashes)}
                    androidValue={fmtMetric(android.crashes)}
                />
                <DownloadsKpiCard
                    icon={<FaStar className="h-5 w-5 text-accent-green" />}
                    iconBgColor="bg-[rgba(0,200,179,0.1)]"
                    label="Average rating"
                    value={fmtMetric(ios.avg_rating || android.avg_rating, 'rating')}
                    infoText={storeMetricInfo(ASC_METRIC_DEFS.avg_rating, PLAY_METRIC_DEFS.average_rating)}
                    iosValue={fmtMetric(ios.avg_rating, 'rating')}
                    androidValue={fmtMetric(android.avg_rating, 'rating')}
                />
            </div>

            <div className="downloads-metrics-explorer">
                <div className="downloads-metrics-picker">
                    <div className="mb-2 flex items-center justify-between gap-2 px-1.5 pt-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-text-muted">Explorer</span>
                        <span className="text-xs font-extrabold tabular-nums text-text-primary">{fmtMetric(totalValue, metricKind)}</span>
                    </div>
                    {picker.map((row, index) => {
                        const active = (combined ? combinedMetric.id : metric.id) === row.id;
                        const value = combined
                            ? COMBINED_METRICS.find((item) => item.id === row.id)?.total(ios, android) ?? 0
                            : (row as MetricDef).total(store);
                        const kind = row.kind;
                        const group = 'group' in row ? (row as MetricDef).group : undefined;
                        const prev = index > 0 ? picker[index - 1] : undefined;
                        const prevGroup = prev && 'group' in prev ? (prev as MetricDef).group : undefined;
                        return (
                            <div key={row.id}>
                                {group && group !== prevGroup && (
                                    <div className="downloads-metrics-picker__group">{group}</div>
                                )}
                                <div
                                    role="button"
                                    tabIndex={0}
                                    className={clsx('downloads-metrics-picker__item', active && 'is-active')}
                                    onClick={() => setMetricId(row.id)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            setMetricId(row.id);
                                        }
                                    }}
                                >
                                    <span className="downloads-metrics-picker__label">
                                        <span className="truncate">{row.label}</span>
                                        {row.info && (
                                            <span onClick={(event) => event.stopPropagation()}>
                                                <InfoTooltip text={row.info} />
                                            </span>
                                        )}
                                    </span>
                                    <span className="downloads-metrics-picker__value">{fmtMetric(value, kind)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <RevenueChart
                    isFullscreen={chartFullscreen}
                    onToggleFullscreen={() => setChartFullscreen(!chartFullscreen)}
                    dailyVolume={series}
                    title={metricLabel}
                    infoText={metricInfo || `${metricLabel} for ${rangeLabel}.`}
                    seriesName={metricLabel}
                    hidePeriodSelector
                />
            </div>

            <div className="dashboard-two-col">
                <div className="flex min-w-0 flex-col gap-3">
                    {!combined && (
                        <label className="flex items-center gap-2 text-xs font-bold text-text-muted">
                            Break down by
                            <select
                                value={dim.id}
                                onChange={(event) => setDimId(event.target.value)}
                                className="h-9 flex-1 rounded-lg border border-border-subtle bg-primary px-3 text-sm font-semibold text-text-primary"
                            >
                                {dims.map((row) => (
                                    <option key={row.id} value={row.id}>{row.label}</option>
                                ))}
                            </select>
                        </label>
                    )}
                    <BreakdownCard
                        title={combined ? `${metricLabel} by territory / source` : `${metricLabel} by ${dim.label.toLowerCase()}`}
                        items={breakdown}
                        emptyText="No dimensional rows for this metric yet."
                        infoText={ANALYTICS_CHART_DEFS.mix}
                        chart="bar"
                    />
                </div>
                <RevenueChart
                    isFullscreen={compareFullscreen}
                    onToggleFullscreen={() => setCompareFullscreen(!compareFullscreen)}
                    dailyVolume={compareSeries}
                    title="iOS vs Android installs"
                    infoText={storeMetricInfo(ASC_METRIC_DEFS.first_time_downloads, PLAY_METRIC_DEFS.device_acquisition)}
                    seriesName="Installs"
                    hidePeriodSelector
                />
            </div>

            <div className="dashboard-two-col">
                <BreakdownCard
                    title="Crashes by version"
                    subtitle="iOS opt-in crashes plus Play vitals"
                    infoText={ANALYTICS_CHART_DEFS.crashes}
                    chart="treemap"
                    items={platform === 'android'
                        ? [...android.breakdowns.crashes_by_version, ...android.breakdowns.anrs_by_version.map((row) => ({ name: `ANR ${row.name}`, count: row.count }))]
                        : platform === 'ios'
                            ? ios.breakdowns.crashes_by_version
                            : crashItems}
                    emptyText="No crash reports in this window."
                />
                <BreakdownCard
                    title="Traffic source"
                    items={sourceItems}
                    emptyText="No source breakdown in this window."
                    infoText={ANALYTICS_CHART_DEFS.sources}
                    chart="polar"
                />
            </div>

            <RevenueChart
                isFullscreen={false}
                dailyVolume={crashSeries}
                title="Crashes over time"
                infoText={storeMetricInfo(ASC_METRIC_DEFS.crashes, PLAY_METRIC_DEFS.crashes)}
                seriesName="Crashes"
                hidePeriodSelector
            />
        </div>
    );
}
