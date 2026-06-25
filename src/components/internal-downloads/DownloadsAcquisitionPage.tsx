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

const DownloadsAcquisitionPage = ({ data }: { data: DownloadAnalyticsData }) => {
    const ugmc = mapDownloadAnalyticsToUgmc(data) as unknown as Record<string, unknown>;

    const kpiData = [
        {
            title: "Total Downloads",
            value: data.total_downloads.toLocaleString(),
            subtitle: `${data.install_conversion_percent}% install conversion`,
            trend: { type: "up" as const, value: `${data.total_installs.toLocaleString()} Installs`, isPositive: true },
            infoText: "App store and direct download count for the selected period.",
        },
        {
            title: "Active Installs",
            value: data.total_installs.toLocaleString(),
            subtitle: `${data.active_devices.toLocaleString()} active devices`,
            trend: { type: "up" as const, value: `${data.window_days}d window`, isPositive: true },
            infoText: "Successful installs that completed onboarding.",
        },
        {
            title: "Crash-Free Rate",
            value: `${data.crash_free_rate_percent.toFixed(1)}%`,
            subtitle: `${data.crash_reports.reduce((s, c) => s + c.count, 0)} crash reports`,
            trend: { type: "up" as const, value: "Stability", isPositive: data.crash_free_rate_percent >= 98 },
            infoText: "Percentage of sessions without a fatal crash.",
        },
        {
            title: "Latest Version Share",
            value: `${data.version_breakdown[0]?.share_percent.toFixed(1) ?? 0}%`,
            subtitle: data.version_breakdown[0]?.version ?? "—",
            trend: { type: "neutral" as const, value: `${data.version_breakdown.length} versions`, isPositive: true },
            infoText: "Share of installs on the current production app version.",
        },
    ];

    return (
        <div className="flex w-full min-w-0 flex-col gap-4">
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {kpiData.map((kpi, index) => (
                    <div
                        key={kpi.title}
                        className="animate-slide-in-up"
                        style={{ animationDelay: `${index * 100}ms`, opacity: 0, animationFillMode: 'forwards' }}
                    >
                        <KPICard {...kpi} />
                    </div>
                ))}
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="animate-slide-in-up" style={{ animationDelay: '150ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <LabTestsVolume data={ugmc} />
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: '180ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <ImagingRadiology data={ugmc} />
                </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="animate-slide-in-up" style={{ animationDelay: '200ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <RoleCoverageChart data={ugmc} />
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: '300ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <TopRejectionReasons data={ugmc} />
                </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="animate-slide-in-up" style={{ animationDelay: '400ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <OutstandingReimbursement />
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: '500ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <ClaimsOwedByDepartment data={ugmc} />
                </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                <div className="animate-slide-in-up" style={{ animationDelay: '600ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <SubscriptionSpend data={ugmc} />
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: '700ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <TopVendors data={ugmc} />
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: '800ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <SpendingByCategory data={ugmc} />
                </div>
            </div>
        </div>
    );
};

export default DownloadsAcquisitionPage;
