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
    BreakdownCard,
    DateRangeFilter,
    DownloadsKpiCard,
    MetricSnapshotRow,
    OptInBadge,
    PageToolbar,
    RetentionBars,
    blendedPercent,
    dailyToChart,
    downloadsDateRangeLabel,
    fmtMetric,
    mergeDailySeries,
    mergeNamedCounts,
    resolveStores,
    dataFreshnessText,
} from '@/components/internal-downloads/DownloadsWidgets';
import { FaMobileScreen, FaShieldHalved, FaTrash } from 'react-icons/fa6';
import { ANALYTICS_CHART_DEFS, ASC_METRIC_DEFS, PLAY_METRIC_DEFS, storeMetricInfo } from '@/lib/app-store-metric-defs';

export default function DownloadsRetentionPage({
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
    const [fullscreen, setFullscreen] = useState(false);
    const [flowFullscreen, setFlowFullscreen] = useState(false);
    const rangeLabel = downloadsDateRangeLabel(dateFrom, dateTo, { from: allTimeFrom, to: allTimeTo });

    const kpis = [
        {
            label: platform === 'ios' ? 'Sessions' : 'Active devices',
            value: fmtMetric(platform === 'ios' ? ios.sessions : platform === 'android' ? android.active_devices : ios.active_devices + android.active_devices),
            icon: <FaMobileScreen className="h-5 w-5 text-accent-primary" />,
            bg: 'bg-[rgba(36,132,199,0.1)]',
            info: storeMetricInfo(
                `Sessions\n${ASC_METRIC_DEFS.sessions}\n\nActive Devices\n${ASC_METRIC_DEFS.active_devices}`,
                PLAY_METRIC_DEFS.install_base,
            ) + '\n\n' + ANALYTICS_CHART_DEFS.active_devices_window + '\n\n' + dataFreshnessText(ios, android, platform),
            note: platform === 'ios'
                ? 'Every session recorded in the range, added up. The iOS split shows active devices on the busiest single day instead, so the two do not match.'
                : platform === 'android'
                    ? 'The Play install base on the most recent day in the range, not a total of the range.'
                    : 'The two stores added together even though they count different things: iOS is the busiest single day of unique devices, Android is the latest day of the Play install base. Treat it as a rough scale, not an exact device count.',
            ios: fmtMetric(platform === 'ios' ? ios.sessions : ios.active_devices),
            android: fmtMetric(android.active_devices),
        },
        {
            label: platform === 'android' ? 'Device loss' : 'Deletions',
            value: fmtMetric(platform === 'ios' ? ios.deletions : platform === 'android' ? (android.device_uninstalls || android.user_uninstalls) : ios.deletions + (android.device_uninstalls || android.user_uninstalls)),
            icon: <FaTrash className="h-5 w-5 text-accent-orange" />,
            bg: 'bg-[rgba(232,155,0,0.1)]',
            info: storeMetricInfo(ASC_METRIC_DEFS.deletions, PLAY_METRIC_DEFS.device_loss),
            note: 'Every deletion or uninstall event in the range, added up. Android falls back to user-level uninstalls when Play reports no device-level figure, so it can count one user rather than each of their devices.',
            ios: fmtMetric(ios.deletions),
            android: fmtMetric(android.device_uninstalls || android.user_uninstalls),
        },
        {
            label: 'Crashes',
            value: fmtMetric(platform === 'ios' ? ios.crashes : platform === 'android' ? android.crashes : ios.crashes + android.crashes),
            icon: <FaShieldHalved className="h-5 w-5 text-accent-orange" />,
            bg: 'bg-[rgba(232,155,0,0.1)]',
            info: storeMetricInfo(ASC_METRIC_DEFS.crashes, PLAY_METRIC_DEFS.crashes),
            note: 'Every crash report in the range, added up. Both stores only collect from users who opted in to share diagnostics, so the real number is higher.',
            ios: fmtMetric(ios.crashes),
            android: fmtMetric(android.crashes),
        },
        {
            label: platform === 'android' ? 'ANRs' : platform === 'ios' ? 'Active Devices' : 'Crash-free',
            value: platform === 'android'
                ? fmtMetric(android.anrs)
                : platform === 'ios'
                    ? fmtMetric(ios.active_devices)
                    : fmtMetric(blendedPercent([
                        { rate: ios.crash_free_rate_percent, weight: ios.sessions || ios.active_devices },
                        { rate: android.crash_free_rate_percent, weight: android.active_devices },
                    ]), 'percent'),
            icon: <FaShieldHalved className="h-5 w-5 text-accent-green" />,
            bg: 'bg-[rgba(0,200,179,0.1)]',
            info: storeMetricInfo(
                `Active Devices\n${ASC_METRIC_DEFS.active_devices}`,
                `ANRs\n${PLAY_METRIC_DEFS.anrs}`,
            ) + (platform === 'ios' ? '\n\n' + ANALYTICS_CHART_DEFS.active_devices_window : ''),
            ios: fmtMetric(ios.active_devices),
            android: fmtMetric(android.anrs),
        },
    ];

    const usageDaily = useMemo(() => {
        if (platform === 'ios') return dailyToChart(ios.daily, 'sessions', 'active_devices');
        if (platform === 'android') return dailyToChart(android.daily, 'device_installs', 'device_uninstalls');
        return mergeDailySeries(ios.daily, android.daily, 'sessions', 'device_installs');
    }, [android.daily, ios.daily, platform]);
    const qualityDaily = useMemo(() => {
        if (platform === 'ios') return dailyToChart(ios.daily, 'crashes', 'deletions');
        if (platform === 'android') return dailyToChart(android.daily, 'crashes', 'anrs');
        return mergeDailySeries(ios.daily, android.daily, 'crashes', 'crashes');
    }, [android.daily, ios.daily, platform]);

    return (
        <div className="flex w-full min-w-0 flex-col gap-4">
            <PageToolbar
                title="Retention"
                subtitle={platform === 'android'
                    ? `Play does not export D1–D28 cohorts · showing installs, uninstalls, and vitals`
                    : `Post-install usage · ${platformFilterLabel(platform)} · ${rangeLabel}`}
                pending={platform === 'android' ? android.reports_pending : platform === 'ios' ? ios.reports_pending : ios.reports_pending || android.reports_pending}
                extra={(
                    <>
                        {platform !== 'android' && <OptInBadge />}
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

            {platform === 'ios' && (
                <MetricSnapshotRow
                    items={[
                        { label: 'Active in Last 30 Days', value: fmtMetric(ios.active_last_30_days), info: storeMetricInfo(ASC_METRIC_DEFS.active_last_30_days, PLAY_METRIC_DEFS.install_base) + '\n\n' + ANALYTICS_CHART_DEFS.active_devices_window },
                        { label: 'Deletions', value: fmtMetric(ios.deletions), info: storeMetricInfo(ASC_METRIC_DEFS.deletions, PLAY_METRIC_DEFS.device_loss) },
                    ]}
                />
            )}

            <div className="dashboard-two-col">
                {platform === 'android' ? (
                    <BreakdownCard
                        title="Install base"
                        subtitle="Overlapping Play snapshots · compare sizes, not shares"
                        chart="bar"
                        infoText={storeMetricInfo(ASC_METRIC_DEFS.active_devices, PLAY_METRIC_DEFS.install_base)}
                        items={[
                            { name: 'Active devices', count: android.active_devices },
                            { name: 'Current device installs', count: android.current_device_installs },
                            { name: 'Current user installs', count: android.current_user_installs },
                            { name: 'Total user installs', count: android.total_user_installs },
                        ].filter((row) => row.count > 0)}
                    />
                ) : (
                    <RetentionBars
                        d1={ios.retention.d1}
                        d7={ios.retention.d7}
                        d14={ios.retention.d14}
                        d28={ios.retention.d28}
                        pending={ios.reports_pending}
                        infoText={ANALYTICS_CHART_DEFS.retention}
                    />
                )}
                <RevenueChart
                    isFullscreen={fullscreen}
                    onToggleFullscreen={() => setFullscreen(!fullscreen)}
                    dailyVolume={usageDaily}
                    title={platform === 'ios' ? 'Sessions and active devices' : platform === 'android' ? 'Installs vs uninstalls' : 'iOS sessions vs Play installs'}
                    seriesName={platform === 'android' ? 'Installs' : platform === 'ios' ? 'Sessions' : 'Play installs'}
                    secondarySeriesName={platform === 'android' ? 'Uninstalls' : platform === 'ios' ? 'Active devices' : 'iOS sessions'}
                    infoText={storeMetricInfo(
                        `Sessions\n${ASC_METRIC_DEFS.sessions}\n\nActive Devices\n${ASC_METRIC_DEFS.active_devices}`,
                        `Installs\n${PLAY_METRIC_DEFS.device_acquisition}\n\nDevice loss\n${PLAY_METRIC_DEFS.device_loss}\n\nDevice updates\n${PLAY_METRIC_DEFS.device_updates}`,
                    )}
                    hidePeriodSelector
                />
            </div>

            {platform === 'all' && (
                <BreakdownCard
                    title="Android install base and lifecycle events"
                    subtitle="Play Console · independent counts, not a shared total"
                    chart="bar"
                    infoText={storeMetricInfo(
                        `Active Devices\n${ASC_METRIC_DEFS.active_devices}\n\nInstallations\n${ASC_METRIC_DEFS.installations}`,
                        `Install base\n${PLAY_METRIC_DEFS.install_base}\n\nInstalls\n${PLAY_METRIC_DEFS.device_acquisition}\n\nDevice loss\n${PLAY_METRIC_DEFS.device_loss}`,
                    )}
                    items={[
                        { name: 'Active devices (install base)', count: android.active_devices },
                        { name: 'New device installs', count: android.device_installs },
                        { name: 'Device uninstalls', count: android.device_uninstalls || android.user_uninstalls },
                        { name: 'Upgrades', count: android.upgrades },
                        { name: 'ANRs', count: android.anrs },
                    ].filter((row) => row.count > 0)}
                />
            )}

            <DailyPatientFlow
                isFullscreen={flowFullscreen}
                onToggleFullscreen={() => setFlowFullscreen(!flowFullscreen)}
                dailyVolume={qualityDaily}
                title={platform === 'ios' ? 'Crashes and Deletions' : platform === 'android' ? 'Crashes and ANRs' : 'iOS vs Android crashes'}
                subtitle={rangeLabel}
                showAllDays
                infoText={storeMetricInfo(
                    `Crashes\n${ASC_METRIC_DEFS.crashes}\n\nDeletions\n${ASC_METRIC_DEFS.deletions}`,
                    `Crashes\n${PLAY_METRIC_DEFS.crashes}\n\nANRs\n${PLAY_METRIC_DEFS.anrs}`,
                )}
                primarySeriesLabel={platform === 'ios' ? 'Crashes' : platform === 'android' ? 'Crashes' : 'Android'}
                secondarySeriesLabel={platform === 'ios' ? 'Deletions' : platform === 'android' ? 'ANRs' : 'iOS'}
                tooltipUnitLabel="events"
            />

            <div className="dashboard-two-col">
                <BreakdownCard
                    title="Crashes by version"
                    chart="bar"
                    infoText={ANALYTICS_CHART_DEFS.crashes}
                    items={platform === 'android'
                        ? android.breakdowns.crashes_by_version
                        : platform === 'ios'
                            ? ios.breakdowns.crashes_by_version
                            : mergeNamedCounts(
                                ios.breakdowns.crashes_by_version.map((row) => ({ name: `iOS ${row.name}`, count: row.count })),
                                android.breakdowns.crashes_by_version.map((row) => ({ name: `Android ${row.name}`, count: row.count })),
                            )}
                />
                <BreakdownCard
                    title="Crashes by device"
                    chart="treemap"
                    infoText={ANALYTICS_CHART_DEFS.crashes}
                    items={platform === 'android'
                        ? android.breakdowns.crashes_by_device
                        : platform === 'ios'
                            ? ios.breakdowns.crashes_by_device
                            : mergeNamedCounts(ios.breakdowns.crashes_by_device, android.breakdowns.crashes_by_device)}
                />
            </div>
            <div className="dashboard-two-col">
                {platform !== 'android' && (
                    <>
                        <BreakdownCard title="Crashes by iOS version" chart="donut" items={ios.breakdowns.crashes_by_os} infoText={ANALYTICS_CHART_DEFS.crashes} />
                        <BreakdownCard title="Sessions by app version" chart="column" items={ios.breakdowns.versions} infoText={storeMetricInfo(ASC_METRIC_DEFS.sessions, PLAY_METRIC_DEFS.device_acquisition)} />
                    </>
                )}
                {platform !== 'ios' && (
                    <>
                        <BreakdownCard title="ANRs by version" chart="bar" items={android.breakdowns.anrs_by_version} infoText={ANALYTICS_CHART_DEFS.anrs} />
                        <BreakdownCard title="ANRs by device" chart="bar" items={android.breakdowns.anrs_by_device} infoText={ANALYTICS_CHART_DEFS.anrs} />
                        <BreakdownCard title="ANRs by OS version" chart="column" items={android.breakdowns.anrs_by_os} infoText={ANALYTICS_CHART_DEFS.anrs} />
                    </>
                )}
            </div>
        </div>
    );
}
