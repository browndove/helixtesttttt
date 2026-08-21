'use client';

import { useMemo, useState } from 'react';
import { RevenueChart, DailyPatientFlow } from '@/components/ugmc-dashboard/executive-overview/components';
import type { DownloadAnalyticsData } from '@/lib/download-analytics-mock';
import {
    PlatformFilter,
    platformFilterLabel,
    type PlatformFilterValue,
} from '@/components/internal-downloads/PlatformFilter';
import {
    AcquisitionFunnel,
    BreakdownCard,
    ChipBreakdown,
    DateRangeFilter,
    DownloadsKpiCard,
    MetricSnapshotRow,
    PageToolbar,
    ShareMixCard,
    blendedPercent,
    dailyToChart,
    fmtMetric,
    mergeDailySeries,
    mergeNamedCounts,
    resolveStores,
    dataFreshnessText,
} from '@/components/internal-downloads/DownloadsWidgets';
import { FaDownload, FaEye, FaPercent } from 'react-icons/fa6';
import { ANALYTICS_CHART_DEFS, ASC_METRIC_DEFS, PLAY_METRIC_DEFS, storeMetricInfo } from '@/lib/app-store-metric-defs';

const ANDROID_API_RELEASE: Record<number, string> = {
    36: '16', 35: '15', 34: '14', 33: '13', 32: '12L', 31: '12',
    30: '11', 29: '10', 28: '9', 27: '8.1', 26: '8.0', 25: '7.1',
    24: '7.0', 23: '6.0', 22: '5.1', 21: '5.0',
};

function labelPlayOsVersion(name: string): string {
    const trimmed = name.trim();
    if (trimmed === '0') return 'Unknown';
    const api = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(api) || String(api) !== trimmed) return name;
    const release = ANDROID_API_RELEASE[api];
    return release ? `Android ${release}` : `API ${api}`;
}

function labelPlayLanguage(name: string): string {
    const trimmed = name.trim().replace(/-/g, '_');
    if (!trimmed) return name;
    try {
        const [lang, region] = trimmed.split('_');
        const display = new Intl.DisplayNames(['en'], { type: 'language' }).of(lang);
        if (!display) return name;
        return region ? `${display} (${region})` : display;
    } catch {
        return name;
    }
}

export default function DownloadsAcquisitionPage({
    data,
    platform,
    onPlatformChange,
    windowDays,
    onWindowDaysChange,
}: {
    data: DownloadAnalyticsData;
    platform: PlatformFilterValue;
    onPlatformChange: (next: PlatformFilterValue) => void;
    windowDays: number;
    onWindowDaysChange: (days: number) => void;
}) {
    const { ios, android } = resolveStores(data);
    const [fullscreen, setFullscreen] = useState(false);
    const [flowFullscreen, setFlowFullscreen] = useState(false);

    const discovery = platform === 'ios'
        ? ios.impressions
        : platform === 'android'
            ? android.listing_visitors
            : ios.impressions + android.listing_visitors;
    const pages = platform === 'ios'
        ? ios.page_views
        : platform === 'android'
            ? android.listing_acquisitions
            : ios.page_views + android.listing_acquisitions;
    const installs = platform === 'ios'
        ? ios.total_downloads
        : platform === 'android'
            ? android.device_installs
            : ios.total_downloads + android.device_installs;
    const dailyUsers = android.user_installs;

    const kpis = [
        {
            label: platform === 'android' ? 'Store listing visitors' : platform === 'ios' ? 'Impressions' : 'Discovery',
            value: fmtMetric(discovery),
            icon: <FaEye className="h-5 w-5 text-accent-violet" />,
            bg: 'bg-[rgba(105,116,247,0.1)]',
            info: storeMetricInfo(ASC_METRIC_DEFS.impressions, PLAY_METRIC_DEFS.listing_visitors) + '\n\n' + dataFreshnessText(ios, android, platform),
            ios: fmtMetric(ios.impressions),
            android: fmtMetric(android.listing_visitors),
        },
        {
            label: platform === 'android' ? 'Store listing acquisitions' : platform === 'ios' ? 'Product Page Views' : 'Store pages',
            value: fmtMetric(pages),
            icon: <FaDownload className="h-5 w-5 text-accent-green" />,
            bg: 'bg-[rgba(0,200,179,0.1)]',
            info: storeMetricInfo(ASC_METRIC_DEFS.page_views, PLAY_METRIC_DEFS.listing_acquisitions),
            ios: fmtMetric(ios.page_views),
            android: fmtMetric(android.listing_acquisitions),
        },
        {
            label: platform === 'android' ? 'Store listing conversion' : 'Conversion Rate',
            value: fmtMetric(platform === 'ios' ? ios.conversion_percent : platform === 'android' ? android.listing_conversion_percent : blendedPercent([
                { rate: ios.conversion_percent, weight: ios.unique_impressions || ios.impressions },
                { rate: android.listing_conversion_percent, weight: android.listing_visitors },
            ]), 'percent'),
            icon: <FaPercent className="h-5 w-5 text-accent-orange" />,
            bg: 'bg-[rgba(232,155,0,0.1)]',
            info: storeMetricInfo(ASC_METRIC_DEFS.conversion, PLAY_METRIC_DEFS.listing_conversion),
            ios: fmtMetric(ios.conversion_percent, 'percent'),
            android: fmtMetric(android.listing_conversion_percent, 'percent'),
        },
        {
            label: platform === 'android' ? 'Daily users' : platform === 'ios' ? 'Total Downloads' : 'Installs',
            value: fmtMetric(platform === 'android' ? dailyUsers : installs),
            icon: <FaDownload className="h-5 w-5 text-accent-primary" />,
            bg: 'bg-[rgba(36,132,199,0.1)]',
            info: storeMetricInfo(
                `Total Downloads\n${ASC_METRIC_DEFS.total_downloads}`,
                `Installs\n${PLAY_METRIC_DEFS.device_acquisition}\n\nDaily users\n${PLAY_METRIC_DEFS.daily_users}`,
            ),
            ios: fmtMetric(ios.total_downloads),
            android: fmtMetric(platform === 'android' ? dailyUsers : android.device_installs),
        },
    ];

    const funnel = useMemo(() => {
        if (platform === 'ios') return dailyToChart(ios.daily, 'impressions', 'page_views');
        if (platform === 'android') return dailyToChart(android.daily, 'listing_visitors', 'listing_acquisitions');
        return mergeDailySeries(ios.daily, android.daily, 'impressions', 'listing_visitors');
    }, [android.daily, ios.daily, platform]);

    const mix = useMemo(() => {
        if (platform === 'ios') return dailyToChart(ios.daily, 'first_time_downloads', 'redownloads');
        if (platform === 'android') return dailyToChart(android.daily, 'device_installs', 'device_uninstalls');
        return mergeDailySeries(ios.daily, android.daily, 'first_time_downloads', 'device_installs');
    }, [android.daily, ios.daily, platform]);

    const sources = platform === 'ios'
        ? ios.breakdowns.sources
        : platform === 'android'
            ? android.breakdowns.sources
            : mergeNamedCounts(ios.breakdowns.sources, android.breakdowns.sources);
    const territories = platform === 'ios'
        ? ios.breakdowns.territories
        : platform === 'android'
            ? android.breakdowns.territories
            : mergeNamedCounts(ios.breakdowns.territories, android.breakdowns.territories);
    const devices = platform === 'ios'
        ? ios.breakdowns.devices
        : platform === 'android'
            ? android.breakdowns.devices
            : mergeNamedCounts(ios.breakdowns.devices, android.breakdowns.devices);

    return (
        <div className="flex w-full min-w-0 flex-col gap-4">
            <PageToolbar
                title="Acquisition"
                subtitle={`How people find ${platformFilterLabel(platform)} · last ${windowDays} days`}
                pending={platform === 'android' ? android.reports_pending : platform === 'ios' ? ios.reports_pending : ios.reports_pending || android.reports_pending}
                extra={(
                    <>
                        <DateRangeFilter value={windowDays} onChange={onWindowDaysChange} />
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

            <AcquisitionFunnel
                infoText={ANALYTICS_CHART_DEFS.funnel}
                steps={[
                    {
                        label: platform === 'android' ? 'Listing visitors' : platform === 'ios' ? 'Impressions' : 'Discovery',
                        value: fmtMetric(discovery),
                        info: storeMetricInfo(ASC_METRIC_DEFS.impressions, PLAY_METRIC_DEFS.listing_visitors),
                    },
                    {
                        label: platform === 'android' ? 'Listing acquisitions' : platform === 'ios' ? 'Product Page Views' : 'Store pages',
                        value: fmtMetric(pages),
                        info: storeMetricInfo(ASC_METRIC_DEFS.page_views, PLAY_METRIC_DEFS.listing_acquisitions),
                    },
                    {
                        label: platform === 'android' ? 'Daily users' : platform === 'ios' ? 'Total Downloads' : 'Installs',
                        value: fmtMetric(platform === 'android' ? dailyUsers : installs),
                        info: storeMetricInfo(
                            `Total Downloads\n${ASC_METRIC_DEFS.total_downloads}`,
                            `Installs\n${PLAY_METRIC_DEFS.device_acquisition}\n\nDaily users\n${PLAY_METRIC_DEFS.daily_users}`,
                        ),
                    },
                ]}
            />

            {platform === 'ios' && (
                <MetricSnapshotRow
                    items={[
                        { label: 'Impressions (Unique Devices)', value: fmtMetric(ios.unique_impressions), info: storeMetricInfo(ASC_METRIC_DEFS.unique_impressions, PLAY_METRIC_DEFS.listing_visitors) },
                        { label: 'Product Page Views (Unique Devices)', value: fmtMetric(ios.unique_page_views), info: storeMetricInfo(ASC_METRIC_DEFS.unique_page_views, PLAY_METRIC_DEFS.listing_acquisitions) },
                        { label: 'First Time Downloads', value: fmtMetric(ios.first_time_downloads), info: storeMetricInfo(ASC_METRIC_DEFS.first_time_downloads, PLAY_METRIC_DEFS.device_acquisition) },
                        { label: 'Redownloads', value: fmtMetric(ios.redownloads), info: storeMetricInfo(ASC_METRIC_DEFS.redownloads) },
                    ]}
                />
            )}

            <div className="dashboard-two-col">
                <RevenueChart
                    isFullscreen={fullscreen}
                    onToggleFullscreen={() => setFullscreen(!fullscreen)}
                    dailyVolume={funnel}
                    title={platform === 'ios' ? 'Impressions and Product Page Views' : platform === 'android' ? 'Listing visitors and acquisitions' : 'iOS impressions vs Play visitors'}
                    infoText={storeMetricInfo(ASC_METRIC_DEFS.impressions, PLAY_METRIC_DEFS.listing_visitors)}
                    seriesName={platform === 'android' ? 'Visitors' : platform === 'ios' ? 'Impressions' : 'iOS + Android'}
                    hidePeriodSelector
                />
                <DailyPatientFlow
                    isFullscreen={flowFullscreen}
                    onToggleFullscreen={() => setFlowFullscreen(!flowFullscreen)}
                    dailyVolume={mix}
                    title={platform === 'ios' ? 'First Time Downloads vs Redownloads' : platform === 'android' ? 'Installs vs uninstalls' : 'iOS vs Android installs'}
                    infoText={storeMetricInfo(
                        `First Time Downloads\n${ASC_METRIC_DEFS.first_time_downloads}\n\nRedownloads\n${ASC_METRIC_DEFS.redownloads}`,
                        `Installs\n${PLAY_METRIC_DEFS.device_acquisition}\n\nDevice loss\n${PLAY_METRIC_DEFS.device_loss}`,
                    )}
                    subtitle={`Last ${windowDays} days`}
                    showAllDays
                    stacked={platform !== 'android'}
                    primarySeriesLabel={platform === 'ios' ? 'First-time' : platform === 'android' ? 'Installs' : 'Android'}
                    secondarySeriesLabel={platform === 'ios' ? 'Redownloads' : platform === 'android' ? 'Uninstalls' : 'iOS'}
                    tooltipUnitLabel="users"
                />
            </div>

            <div className="dashboard-two-col">
                <ShareMixCard
                    title={platform === 'android' ? 'Traffic source' : platform === 'ios' ? 'Source type' : 'Traffic source'}
                    subtitle={platform === 'all' ? 'App Store and Play sources combined' : platform === 'ios' ? 'App Store search, browse, referrers' : 'Play search, explore, referrals'}
                    items={sources}
                    infoText={ANALYTICS_CHART_DEFS.sources}
                />
                <BreakdownCard
                    title="Territory"
                    subtitle="Where people discover the app"
                    items={territories}
                    infoText={ANALYTICS_CHART_DEFS.territories}
                    chart="bar"
                />
            </div>

            <div className="dashboard-two-col">
                <ChipBreakdown
                    title="Device"
                    items={devices}
                    infoText={ANALYTICS_CHART_DEFS.devices}
                    chart="treemap"
                />
                {platform === 'android' ? (
                    <ChipBreakdown
                        title="Search terms"
                        items={android.breakdowns.search_terms}
                        emptyText="No search terms above privacy thresholds."
                        infoText={ANALYTICS_CHART_DEFS.referrers}
                        chart="bar"
                    />
                ) : (
                    <ChipBreakdown
                        title="App referrers"
                        items={ios.breakdowns.app_referrers}
                        emptyText="No app referrers in this window."
                        infoText={ANALYTICS_CHART_DEFS.referrers}
                        chart="column"
                    />
                )}
            </div>

            {platform !== 'android' && (
                <div className="dashboard-two-col">
                    <ChipBreakdown
                        title="Web referrers"
                        items={ios.breakdowns.web_referrers}
                        emptyText="No web referrers in this window."
                        infoText={ANALYTICS_CHART_DEFS.referrers}
                        chart="bar"
                    />
                    <BreakdownCard
                        title="Campaigns"
                        items={ios.breakdowns.campaigns}
                        emptyText="No campaign-attributed downloads yet."
                        infoText={ANALYTICS_CHART_DEFS.campaigns}
                        chart="column"
                    />
                </div>
            )}
            {platform !== 'ios' && (
                <>
                    <div className="dashboard-two-col">
                        <BreakdownCard
                            title="App version"
                            subtitle="Play installs by Android build"
                            items={android.breakdowns.versions}
                            emptyText="No version breakdown in this window."
                            infoText={ANALYTICS_CHART_DEFS.versions}
                            chart="bar"
                        />
                        <BreakdownCard
                            title="Carrier"
                            subtitle="Play installs by mobile network"
                            items={android.breakdowns.carriers}
                            emptyText="No carrier breakdown in this window."
                            infoText={ANALYTICS_CHART_DEFS.play_attributes}
                            chart="bar"
                        />
                    </div>
                    <div className="dashboard-two-col">
                        <BreakdownCard
                            title="OS version"
                            subtitle="Play installs by Android release"
                            items={android.breakdowns.platform_versions.map((row) => ({
                                name: labelPlayOsVersion(row.name),
                                count: row.count,
                            }))}
                            emptyText="No OS version breakdown in this window."
                            infoText={ANALYTICS_CHART_DEFS.play_attributes}
                            chart="bar"
                        />
                        <BreakdownCard
                            title="Language"
                            subtitle="Play installs by device language"
                            items={android.breakdowns.languages.map((row) => ({
                                name: labelPlayLanguage(row.name),
                                count: row.count,
                            }))}
                            emptyText="No language breakdown in this window."
                            infoText={ANALYTICS_CHART_DEFS.play_attributes}
                            chart="bar"
                        />
                    </div>
                </>
            )}
            {platform !== 'android' && (
                <div className="dashboard-two-col">
                    <ShareMixCard
                        title="Page type"
                        items={ios.breakdowns.page_types}
                        infoText={ANALYTICS_CHART_DEFS.page_types}
                    />
                    <ChipBreakdown
                        title="Product pages"
                        items={ios.breakdowns.product_pages}
                        infoText={ANALYTICS_CHART_DEFS.product_pages}
                        chart="column"
                    />
                </div>
            )}
        </div>
    );
}
