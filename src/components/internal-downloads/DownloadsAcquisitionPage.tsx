"use client";

import * as React from "react";
import {
    KPICard,
    RoleCoverageChart,
    TopRejectionReasons,
    OutstandingReimbursement,
    ClaimsOwedByDepartment,
    SubscriptionSpend,
    TopVendors,
    SpendingByCategory,
    LabTestsVolume,
    ImagingRadiology,
} from "@/components/ugmc-dashboard/billing-finance/components";
import type { DownloadAnalyticsData } from "@/lib/download-analytics-mock";
import { mapDownloadAnalyticsToUgmc } from "@/lib/download-analytics-mock";
import { PlatformBreakdown } from "@/components/internal-downloads/PlatformBreakdown";

function fmt(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

const DownloadsAcquisitionPage = ({ data }: { data: DownloadAnalyticsData }) => {
    const ugmc = mapDownloadAnalyticsToUgmc(data) as unknown as Record<string, unknown>;
    const regionalPlatform = React.useMemo(
        () => data.regions
            .slice(0, 6)
            .map((region) => ({
                name: region.region,
                ios: region.ios_installs ?? region.installs,
                android: region.android_installs ?? 0,
            })),
        [data.regions],
    );
    const totalUpdates = React.useMemo(
        () => data.daily_downloads.reduce((sum, row) => sum + row.updates, 0),
        [data],
    );
    const avgDailyUpdates = data.window_days > 0 ? Math.round(totalUpdates / data.window_days) : 0;
    const latestDayUpdates = data.daily_downloads.at(-1)?.updates ?? 0;
    const crashTotal = data.crash_reports.reduce((sum, row) => sum + row.count, 0);
    const latestVersion = data.version_breakdown[0];

    const iosInstalls = data.total_installs;
    const androidInstalls = data.total_play_installs ?? 0;

    const stabilityMetrics = React.useMemo(() => {
        const rows = [
            ...data.diagnostics.map((item) => ({
                name: item.issue,
                description: 'Diagnostic reports in the window',
                value: fmt(item.count),
            })),
            ...data.crash_reports.map((item) => ({
                name: item.type,
                description: 'Crash reports in the window',
                value: fmt(item.count),
            })),
        ].slice(0, 5);

        if (rows.length > 0) return rows;

        return [
            {
                name: 'Crash-free rate',
                description: 'Sessions without crashes',
                value: data.crash_free_rate_percent > 0 ? `${data.crash_free_rate_percent.toFixed(1)}%` : 'N/A',
            },
            {
                name: 'App updates',
                description: 'Version upgrades in the window',
                value: fmt(totalUpdates),
            },
            {
                name: 'Installed units',
                description: 'First-time installs in the window',
                value: fmt(data.total_installs),
            },
            {
                name: 'Total downloads',
                description: 'Download units in the window',
                value: fmt(data.total_downloads),
            },
            {
                name: 'Avg rating',
                description: 'App Store rating average',
                value: data.avg_rating > 0 ? data.avg_rating.toFixed(1) : 'N/A',
            },
        ];
    }, [data, totalUpdates]);

    const topStabilityValue = React.useMemo(() => {
        const topDiagnostic = data.diagnostics[0]?.count;
        if (topDiagnostic !== undefined && topDiagnostic > 0) return fmt(topDiagnostic);
        const topCrash = data.crash_reports[0]?.count;
        if (topCrash !== undefined && topCrash > 0) return fmt(topCrash);
        if (data.crash_free_rate_percent > 0) return `${data.crash_free_rate_percent.toFixed(1)}%`;
        return 'N/A';
    }, [data]);

    const stabilityInsight = React.useMemo(() => {
        if (data.crash_free_rate_percent > 0) {
            return `Crash-free sessions: ${data.crash_free_rate_percent.toFixed(1)}% over the last ${data.window_days} days.`;
        }
        if (data.diagnostics.length > 0 || data.crash_reports.length > 0) {
            return 'Stability signals from App Store Connect analytics for the selected window.';
        }
        return 'Detailed crash and diagnostic breakdowns appear when App Store Connect analytics are available.';
    }, [data]);

    const kpiData = [
        {
            title: "Total Downloads",
            value: fmt(data.total_downloads),
            subtitle: <PlatformBreakdown ios={iosInstalls} android={androidInstalls} />,
            trend: { type: "up" as const, value: `${fmt(data.total_installs)} installs`, isPositive: true },
            infoText: "New download units from Apple Sales Reports for the selected window.",
        },
        {
            title: "Installed Units",
            value: fmt(data.total_installs),
            subtitle: `Last ${data.window_days} days`,
            trend: { type: "up" as const, value: fmt(data.total_downloads), isPositive: true },
            infoText: "First-time install units (App Units) in the selected period.",
        },
        {
            title: "App Updates",
            value: fmt(totalUpdates),
            subtitle: latestVersion?.version ? `Latest: ${latestVersion.version}` : "Version upgrades",
            trend: { type: "neutral" as const, value: `${avgDailyUpdates}/day avg`, isPositive: true },
            infoText: "Existing users updating to a newer app version (product type 7).",
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
            <div>
                <h1 className="text-lg font-semibold text-text-primary">Acquisition & Stability</h1>
                <p className="mt-1 text-sm text-text-muted">
                    Download growth, version adoption, and app stability over the last {data.window_days} days.
                </p>
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
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: "180ms", opacity: 0, animationFillMode: "forwards" }}>
                    <ImagingRadiology
                        data={ugmc}
                        title="Daily Installs by Version"
                        badgeLabel="Live"
                        signInLabel="Peak Install Day"
                        signOutLabel="Lowest Install Day"
                        rolesLabel="Versions tracked"
                        emptyNote="Per-version install timing is not available yet. Chart shows version-level activity when present."
                    />
                </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="animate-slide-in-up" style={{ animationDelay: "200ms", opacity: 0, animationFillMode: "forwards" }}>
                    <RoleCoverageChart
                        data={ugmc}
                        title="Crash Reports by Type"
                        subtitle={`Top crash types · Last ${data.window_days} days`}
                        infoText="Crash report volume by issue type from App Store Connect Analytics."
                        seriesName="Crash Reports"
                    />
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: "300ms", opacity: 0, animationFillMode: "forwards" }}>
                    <TopRejectionReasons
                        data={ugmc}
                        title="Install Share by Version"
                        subtitle="Top app versions in the window"
                        totalLabel="Installs"
                    />
                </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="animate-slide-in-up" style={{ animationDelay: "400ms", opacity: 0, animationFillMode: "forwards" }}>
                    <OutstandingReimbursement
                        title="Installs by Region"
                        subtitle="iOS vs Android by country"
                        badgeLabel="Android"
                        platformItems={regionalPlatform}
                    />
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: "500ms", opacity: 0, animationFillMode: "forwards" }}>
                    <ClaimsOwedByDepartment
                        data={ugmc}
                        title="Version Install Breakdown"
                        subtitle="App versions in the selected window"
                        departmentColumnLabel="Category"
                        roleColumnLabel="Version"
                        priorityColumnLabel="Share"
                        statusColumnLabel="Installs"
                    />
                </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                <div className="animate-slide-in-up" style={{ animationDelay: "600ms", opacity: 0, animationFillMode: "forwards" }}>
                    <SubscriptionSpend
                        title="Stability Diagnostics"
                        subtitle="Crashes and diagnostics · current window"
                        highlightLabel="Top signal count"
                        highlightValue={topStabilityValue}
                        metrics={stabilityMetrics}
                        metricVariant="count"
                        insightText={stabilityInsight}
                    />
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: "700ms", opacity: 0, animationFillMode: "forwards" }}>
                    <TopVendors
                        data={ugmc}
                        title="Top Crash Types"
                        subtitle="By report count · current window"
                        totalLabel="Total crash reports"
                    />
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: "800ms", opacity: 0, animationFillMode: "forwards" }}>
                    <SpendingByCategory
                        data={ugmc}
                        title="Download Mix"
                        subtitle="Downloads, installs, and updates"
                        totalLabel="Total Units"
                        categoryLabels={["App Updates", "Installed Units", "Crash Reports"]}
                    />
                </div>
            </div>
        </div>
    );
};

export default DownloadsAcquisitionPage;
