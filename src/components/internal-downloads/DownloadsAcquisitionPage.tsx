"use client";

import * as React from "react";
import {
    KPICard,
    RoleCoverageChart,
    TopRejectionReasons,
    ClaimsOwedByDepartment,
    SubscriptionSpend,
    TopVendors,
    SpendingByCategory,
    LabTestsVolume,
} from "@/components/ugmc-dashboard/billing-finance/components";
import type { DownloadAnalyticsData } from "@/lib/download-analytics-mock";
import { mapDownloadAnalyticsToUgmc } from "@/lib/download-analytics-mock";
import { PlatformBreakdown } from "@/components/internal-downloads/PlatformBreakdown";
import {
    PlatformFilter,
    dailyInstallRows,
    platformFilterLabel,
    platformInstallTotals,
    type PlatformFilterValue,
} from "@/components/internal-downloads/PlatformFilter";
import { countryCodeToName } from "@/lib/country-names";

function fmt(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

const DownloadsAcquisitionPage = ({
    data,
    platform,
    onPlatformChange,
}: {
    data: DownloadAnalyticsData;
    platform: PlatformFilterValue;
    onPlatformChange: (next: PlatformFilterValue) => void;
}) => {
    const ugmc = mapDownloadAnalyticsToUgmc(data) as unknown as Record<string, unknown>;
    const installTotals = React.useMemo(
        () => platformInstallTotals(data, platform),
        [data, platform],
    );
    const filteredDaily = React.useMemo(
        () => dailyInstallRows(data, platform),
        [data, platform],
    );
    const iosActiveDevices = data.ios_active_devices ?? data.total_installs ?? 0;
    const androidActiveDevices = data.android_active_devices ?? data.total_play_installs ?? 0;

    const activeByPlatform = React.useMemo(() => {
        const peak = Math.max(iosActiveDevices, androidActiveDevices, 1);
        const rows: { role_id: string; role_name: string; escalation_count: number; total_messages_for_role: number }[] = [];
        if (platform !== "android") {
            rows.push({ role_id: "active-ios", role_name: "iOS Active Devices", escalation_count: iosActiveDevices, total_messages_for_role: peak });
        }
        if (platform !== "ios") {
            rows.push({ role_id: "active-android", role_name: "Android Active Devices", escalation_count: androidActiveDevices, total_messages_for_role: peak });
        }
        return rows;
    }, [iosActiveDevices, androidActiveDevices, platform]);

    const totalActiveDevices = React.useMemo(() => {
        const ios = platform === "android" ? 0 : iosActiveDevices;
        const android = platform === "ios" ? 0 : androidActiveDevices;
        return ios + android;
    }, [iosActiveDevices, androidActiveDevices, platform]);
    const totalUpdates = React.useMemo(
        () => (platform === "android" ? 0 : data.daily_downloads.reduce((sum, row) => sum + row.updates, 0)),
        [data, platform],
    );
    const avgDailyUpdates = data.window_days > 0 ? Math.round(totalUpdates / data.window_days) : 0;
    const latestDayUpdates = platform === "android" ? 0 : (data.daily_downloads.at(-1)?.updates ?? 0);
    const crashTotal = data.crash_reports.reduce((sum, row) => sum + row.count, 0);
    const latestVersion = data.version_breakdown[0];
    const androidDailyAvg = data.window_days > 0
        ? Math.round(installTotals.android / data.window_days)
        : 0;
    const latestAndroidDay = filteredDaily.at(-1)?.android ?? 0;

    const stabilityMetrics = React.useMemo(() => {
        const rows = [
            ...data.diagnostics.map((item) => ({
                name: item.issue,
                description: "Diagnostic reports in the window",
                value: fmt(item.count),
            })),
            ...data.crash_reports.map((item) => ({
                name: item.type,
                description: "Crash reports in the window",
                value: fmt(item.count),
            })),
        ].slice(0, 5);

        if (rows.length > 0) return rows;

        return [
            {
                name: "Crash-free rate",
                description: "Sessions without crashes",
                value: data.crash_free_rate_percent > 0 ? `${data.crash_free_rate_percent.toFixed(1)}%` : "N/A",
            },
            {
                name: "App updates",
                description: "Version upgrades in the window",
                value: fmt(totalUpdates),
            },
            {
                name: "Installed units",
                description: `${platformFilterLabel(platform)} installs in the window`,
                value: fmt(installTotals.total),
            },
            {
                name: "Android installs",
                description: "Play Store installs in the window",
                value: fmt(data.total_play_installs ?? 0),
            },
            {
                name: "Avg rating",
                description: "App Store rating average",
                value: data.avg_rating > 0 ? data.avg_rating.toFixed(1) : "N/A",
            },
        ];
    }, [data, totalUpdates, installTotals.total, platform]);

    const topStabilityValue = React.useMemo(() => {
        const topDiagnostic = data.diagnostics[0]?.count;
        if (topDiagnostic !== undefined && topDiagnostic > 0) return fmt(topDiagnostic);
        const topCrash = data.crash_reports[0]?.count;
        if (topCrash !== undefined && topCrash > 0) return fmt(topCrash);
        if (data.crash_free_rate_percent > 0) return `${data.crash_free_rate_percent.toFixed(1)}%`;
        return "N/A";
    }, [data]);

    const stabilityInsight = React.useMemo(() => {
        if (data.crash_free_rate_percent > 0) {
            return `Crash-free sessions: ${data.crash_free_rate_percent.toFixed(1)}% over the last ${data.window_days} days.`;
        }
        if (data.diagnostics.length > 0 || data.crash_reports.length > 0) {
            return "Stability signals from App Store Connect analytics for the selected window.";
        }
        return "Detailed crash and diagnostic breakdowns appear when App Store Connect analytics are available.";
    }, [data]);

    const androidByCountry = React.useMemo(() => {
        const totalAndroid = Math.max(data.total_play_installs ?? 0, 1);
        return [...data.regions]
            .map((region) => ({
                region: countryCodeToName(region.region),
                installs: region.android_installs ?? 0,
            }))
            .filter((row) => row.installs > 0)
            .sort((a, b) => b.installs - a.installs)
            .slice(0, 8)
            .map((row, index) => ({
                role_id: `android-region-${index}`,
                role_name: row.region,
                escalation_count: row.installs,
                total_messages_for_role: totalAndroid,
            }));
    }, [data.regions, data.total_play_installs]);

    const androidDailySeries = React.useMemo(
        () => filteredDaily.map((row) => ({
            day: row.day,
            total_messages: row.android,
            critical_messages: row.android,
            standard_messages: row.android,
        })),
        [filteredDaily],
    );

    const androidChartData = React.useMemo(() => ({
        ...ugmc,
        window_days: data.window_days,
        top_escalated_roles: androidByCountry,
        total_messages: installTotals.android,
    }), [ugmc, data.window_days, androidByCountry, installTotals.android]);

    const androidTopListData = React.useMemo(() => ({
        top_escalated_roles: androidByCountry.slice(0, 5).map((row) => ({
            ...row,
            total_messages_for_role: 0,
        })),
        total_messages: installTotals.android,
        role_metrics: androidByCountry.map((row) => ({
            role_id: row.role_id,
            role_name: row.role_name,
            department_name: "Play Store",
            escalated_critical_messages: row.escalation_count,
            total_messages: row.escalation_count,
        })),
    }), [androidByCountry, installTotals.android]);

    const versionTableData = React.useMemo(() => ({
        role_metrics: data.version_breakdown.slice(0, 5).map((v, i) => ({
            role_id: `version-${i}`,
            department_name: "App version",
            role_name: v.version,
            priority: "standard" as const,
            filled: true,
            priorityText: `${v.share_percent}%`,
            statusText: fmt(v.installs),
        })),
    }), [data.version_breakdown]);

    const hasAndroidVersions = (data.android_version_breakdown?.length ?? 0) > 0;

    const androidVersionShareData = React.useMemo(() => {
        const versions = data.android_version_breakdown ?? [];
        const total = versions.reduce((sum, v) => sum + v.installs, 0);
        return {
            role_metrics: versions.map((v, i) => ({
                role_id: `android-version-${i}`,
                role_name: v.version,
                priority: i === 0 ? "critical" : "standard",
                total_messages: v.installs,
            })),
            total_messages: total,
        };
    }, [data.android_version_breakdown]);

    const androidCountryShareData = React.useMemo(() => ({
        ...ugmc,
        role_metrics: androidByCountry.map((row, i) => ({
            role_id: row.role_id,
            role_name: row.role_name,
            priority: i === 0 ? "critical" : "standard",
            total_messages: row.escalation_count,
        })),
        total_messages: installTotals.android,
    }), [ugmc, androidByCountry, installTotals.android]);

    const showAndroidAcquisition = platform !== "ios";

    const kpiData = [
        {
            title: "Total Installs",
            value: fmt(installTotals.total),
            subtitle: platform === "all"
                ? <PlatformBreakdown ios={installTotals.ios} android={installTotals.android} />
                : `${platformFilterLabel(platform)} · Last ${data.window_days} days`,
            trend: { type: "up" as const, value: `${fmt(installTotals.total)} installs`, isPositive: true },
            infoText: platform === "all"
                ? "Combined App Store and Play Store installs for the selected window."
                : `${platformFilterLabel(platform)} installs for the selected window.`,
        },
        {
            title: platform === "android" ? "Play Store Installs" : "App Store Installs",
            value: fmt(platform === "android" ? installTotals.android : installTotals.ios),
            subtitle: `Last ${data.window_days} days`,
            trend: {
                type: "up" as const,
                value: platform === "all" ? `${fmt(installTotals.android)} Android` : fmt(installTotals.total),
                isPositive: true,
            },
            infoText: platform === "android"
                ? "Install units from Google Play Console reports."
                : "First-time install units (App Units) from Apple Sales Reports.",
        },
        {
            title: platform === "android" ? "Android Daily Avg" : "App Updates",
            value: platform === "android" ? fmt(androidDailyAvg) : fmt(totalUpdates),
            subtitle: platform === "android"
                ? `Latest day: ${fmt(latestAndroidDay)}`
                : (latestVersion?.version ? `Latest: ${latestVersion.version}` : "Version upgrades"),
            trend: {
                type: "neutral" as const,
                value: platform === "android" ? `${fmt(installTotals.android)} total` : `${avgDailyUpdates}/day avg`,
                isPositive: true,
            },
            infoText: platform === "android"
                ? "Average Play Store installs per day in the selected window."
                : "Existing users updating to a newer app version (product type 7).",
        },
        {
            title: "Crash-Free",
            value: data.crash_free_rate_percent > 0 ? `${data.crash_free_rate_percent.toFixed(1)}%` : "N/A",
            subtitle: crashTotal > 0 ? `${crashTotal} crash reports` : "No crash data yet",
            trend: {
                type: data.crash_free_rate_percent >= 98 ? "up" as const : "down" as const,
                value: "Stability",
                isPositive: data.crash_free_rate_percent >= 98,
            },
            infoText: "Crash-free sessions from App Store Connect Analytics when available.",
        },
    ];

    return (
        <div className="flex w-full min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-lg font-semibold text-text-primary">Acquisition & Stability</h1>
                    <p className="mt-1 text-sm text-text-muted">
                        {platformFilterLabel(platform)} download growth, version adoption, and app stability over the last {data.window_days} days.
                    </p>
                </div>
                <PlatformFilter value={platform} onChange={onPlatformChange} />
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {kpiData.map((kpi, index) => (
                    <div
                        key={kpi.title}
                        className="animate-slide-in-up"
                        style={{ animationDelay: `${index * 100}ms`, opacity: 0, animationFillMode: "forwards" }}
                    >
                        <KPICard {...kpi} />
                    </div>
                ))}
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="animate-slide-in-up" style={{ animationDelay: "150ms", opacity: 0, animationFillMode: "forwards" }}>
                    {platform === "android" ? (
                        <LabTestsVolume
                            data={{
                                ...ugmc,
                                daily_message_volume: androidDailySeries,
                            }}
                            title="Android Installs by Day"
                            weeklyTitle="Android Installs by Week"
                            seriesName="Android Installs"
                            primaryStatLabel="Avg Daily Installs"
                            secondaryStatLabel="Latest Day Installs"
                            primaryStatValue={String(androidDailyAvg)}
                            secondaryStatValue={String(latestAndroidDay)}
                        />
                    ) : (
                        <LabTestsVolume
                            data={ugmc}
                            title="App Updates by Day"
                            weeklyTitle="App Updates by Week"
                            seriesName="App Updates"
                            primaryStatLabel="Avg Daily Updates"
                            secondaryStatLabel="Latest Day Updates"
                            primaryStatValue={String(avgDailyUpdates)}
                            secondaryStatValue={String(latestDayUpdates)}
                        />
                    )}
                </div>
                <div className="animate-slide-in-up flex min-h-[360px] flex-col" style={{ animationDelay: "180ms", opacity: 0, animationFillMode: "forwards" }}>
                    <RoleCoverageChart
                        data={{ ...ugmc, top_escalated_roles: activeByPlatform, window_days: data.window_days }}
                        title="Active Devices by Platform"
                        subtitle={`${fmt(totalActiveDevices)} devices with the app installed`}
                        infoText="Current install base (devices with the app installed). iOS comes from App Store Connect analytics and Android from Google Play 'Active Device Installs'; each falls back to install counts if a store doesn't expose active devices."
                        seriesName="Active Devices"
                        valueMode="count"
                        valueUnitLabel="devices"
                    />
                </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="animate-slide-in-up flex min-h-[560px] flex-col xl:h-full" style={{ animationDelay: "200ms", opacity: 0, animationFillMode: "forwards" }}>
                    {showAndroidAcquisition ? (
                        <RoleCoverageChart
                            data={androidChartData}
                            title="Android Installs by Country"
                            subtitle={`Top Play Store countries · Last ${data.window_days} days`}
                            infoText="Google Play install units by country for the selected window."
                            seriesName="Android Installs"
                            valueMode="count"
                            valueUnitLabel="installs"
                        />
                    ) : data.crash_reports.length > 0 ? (
                        <RoleCoverageChart
                            data={ugmc}
                            title="Crash Reports by Type"
                            subtitle={`Top crash types · Last ${data.window_days} days`}
                            infoText="Crash report volume by issue type from App Store Connect Analytics."
                            seriesName="Crash Reports"
                            valueMode="count"
                            valueUnitLabel="reports"
                        />
                    ) : (
                        <LabTestsVolume
                            data={{
                                ...ugmc,
                                daily_message_volume: data.daily_downloads.map((row) => ({
                                    day: row.day,
                                    total_messages: row.installs,
                                    critical_messages: row.installs,
                                    standard_messages: row.installs,
                                })),
                            }}
                            title="iOS Installs by Day"
                            weeklyTitle="iOS Installs by Week"
                            seriesName="iOS Installs"
                            primaryStatLabel="Avg Daily Installs"
                            secondaryStatLabel="Latest Day Installs"
                            primaryStatValue={String(data.window_days > 0 ? Math.round(installTotals.ios / data.window_days) : 0)}
                            secondaryStatValue={String(data.daily_downloads.at(-1)?.installs ?? 0)}
                        />
                    )}
                </div>
                <div className="animate-slide-in-up flex min-h-[560px] flex-col xl:h-full" style={{ animationDelay: "300ms", opacity: 0, animationFillMode: "forwards" }}>
                    {showAndroidAcquisition ? (
                        <TopVendors
                            data={androidTopListData}
                            title="Top Android Countries"
                            subtitle="By Play Store installs · current window"
                            totalLabel="Total Android installs"
                            fillHeight
                            insightText={
                                androidByCountry[0]
                                    ? `${androidByCountry[0].role_name} leads Android installs with ${fmt(androidByCountry[0].escalation_count)} in this window.`
                                    : undefined
                            }
                        />
                    ) : (
                        <TopRejectionReasons
                            data={ugmc}
                            title="Install Share by Version"
                            subtitle="Top app versions in the window"
                            totalLabel="Installs"
                        />
                    )}
                </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="animate-slide-in-up" style={{ animationDelay: "400ms", opacity: 0, animationFillMode: "forwards" }}>
                    {platform === "android" && !hasAndroidVersions ? (
                        <LabTestsVolume
                            data={{
                                ...ugmc,
                                daily_message_volume: androidDailySeries,
                            }}
                            title="Android Install Trend"
                            weeklyTitle="Android Installs by Week"
                            seriesName="Android Installs"
                            primaryStatLabel="Countries"
                            secondaryStatLabel="Top Country"
                            primaryStatValue={String(androidByCountry.length)}
                            secondaryStatValue={androidByCountry[0]?.role_name || "—"}
                        />
                    ) : (
                        <ClaimsOwedByDepartment
                            data={versionTableData}
                            title="iOS Version Breakdown"
                            subtitle="App Store versions in the window"
                            departmentColumnLabel="Category"
                            roleColumnLabel="Version"
                            priorityColumnLabel="Share"
                            statusColumnLabel="Installs"
                        />
                    )}
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: "500ms", opacity: 0, animationFillMode: "forwards" }}>
                    {platform === "ios" ? (
                        <TopRejectionReasons
                            data={ugmc}
                            title="iOS Install Share by Version"
                            subtitle="Top App Store versions in the window"
                            totalLabel="Installs"
                        />
                    ) : hasAndroidVersions ? (
                        <TopRejectionReasons
                            data={androidVersionShareData}
                            title="Android Version Share"
                            subtitle="Top Play Store builds in the window"
                            totalLabel="Android installs"
                        />
                    ) : platform === "android" ? (
                        <TopRejectionReasons
                            data={androidCountryShareData}
                            title="Android Country Share"
                            subtitle="Top Play Store countries in the window"
                            totalLabel="Android installs"
                        />
                    ) : (
                        <TopRejectionReasons
                            data={ugmc}
                            title="iOS Install Share by Version"
                            subtitle="Top App Store versions in the window"
                            totalLabel="Installs"
                        />
                    )}
                </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                <div className="animate-slide-in-up" style={{ animationDelay: "600ms", opacity: 0, animationFillMode: "forwards" }}>
                    <SubscriptionSpend
                        title={showAndroidAcquisition ? "Android Install Snapshot" : "Stability Diagnostics"}
                        subtitle={
                            showAndroidAcquisition
                                ? `Play Store installs · last ${data.window_days} days`
                                : "Crashes and diagnostics · current window"
                        }
                        highlightLabel={showAndroidAcquisition ? "Android installs" : "Top signal count"}
                        highlightValue={showAndroidAcquisition ? fmt(installTotals.android) : topStabilityValue}
                        metrics={
                            showAndroidAcquisition
                                ? [
                                    {
                                        name: "Android installs",
                                        description: "Play Store installs in the window",
                                        value: fmt(installTotals.android),
                                    },
                                    {
                                        name: "Daily average",
                                        description: "Average Android installs per day",
                                        value: fmt(androidDailyAvg),
                                    },
                                    {
                                        name: "Latest day",
                                        description: "Most recent Android install day",
                                        value: fmt(latestAndroidDay),
                                    },
                                    {
                                        name: "Top country",
                                        description: androidByCountry[0]?.role_name || "No country data",
                                        value: androidByCountry[0] ? fmt(androidByCountry[0].escalation_count) : "—",
                                    },
                                    {
                                        name: "Countries",
                                        description: "Regions with Android installs",
                                        value: String(androidByCountry.length),
                                    },
                                ]
                                : stabilityMetrics
                        }
                        metricVariant="count"
                        insightText={
                            showAndroidAcquisition
                                ? `Play Store contributed ${fmt(installTotals.android)} installs (${data.os_split.find((o) => o.os === "Android")?.share_percent ?? 0}% of combined installs).`
                                : stabilityInsight
                        }
                    />
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: "700ms", opacity: 0, animationFillMode: "forwards" }}>
                    {showAndroidAcquisition ? (
                        <TopVendors
                            data={androidTopListData}
                            title="Android Country Rank"
                            subtitle="Highest Play Store install countries"
                            totalLabel="Android installs shown"
                        />
                    ) : (
                        <TopVendors
                            data={ugmc}
                            title="Top Crash Types"
                            subtitle="By report count · current window"
                            totalLabel="Total crash reports"
                        />
                    )}
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: "800ms", opacity: 0, animationFillMode: "forwards" }}>
                    <SpendingByCategory
                        data={{
                            ...ugmc,
                            // SpendingByCategory maps: [0]=standard, [1]=critical-escalated, [2]=escalated
                            standard_messages: platform === "android" ? installTotals.android : installTotals.ios,
                            critical_messages: platform === "android"
                                ? 0
                                : platform === "ios"
                                    ? totalUpdates
                                    : installTotals.android + totalUpdates,
                            escalated_critical_messages: platform === "all" ? totalUpdates : 0,
                            total_messages: installTotals.total,
                        }}
                        title="Install Mix"
                        subtitle={platform === "all" ? "iOS vs Android installs" : `${platformFilterLabel(platform)} install mix`}
                        totalLabel="Total Installs"
                        categoryLabels={
                            platform === "android"
                                ? ["Android Installs", "Other", "Other"]
                                : platform === "ios"
                                    ? ["iOS Installs", "App Updates", "Other"]
                                    : ["iOS Installs", "Android Installs", "App Updates"]
                        }
                    />
                </div>
            </div>
        </div>
    );
};

export default DownloadsAcquisitionPage;
