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
} from "./components";

function formatTime(minutes: number): string {
    if (!minutes || minutes <= 0) return '—';
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

const BillingFinancePage = ({ data, onEditRole }: { data?: any; onEditRole?: (role: any) => void }) => {
    const kpiData = [
        {
            title: "Total Active Users",
            value: data?.active_users_count !== undefined ? data.active_users_count.toString() : "—",
            subtitle: `${data?.active_users_rate_percent?.toFixed(1) || 0}% of registered staff`,
            trend: { type: "up" as const, value: `${data?.total_messages || 0} Msgs Sent`, isPositive: true },
            infoText: "Number of unique staff active in the current timeframe out of total staff.",
        },
        {
            title: "Role Fill Rate",
            value: data?.role_fill_rate_percent !== undefined ? `${data.role_fill_rate_percent.toFixed(1)}%` : "—",
            subtitle: `${data?.filled_roles || 0} of ${data?.total_roles || 0} filled`,
            trend: { type: "up" as const, value: `${data?.total_roles || 0} Roles Total`, isPositive: true },
            infoText: "Percentage of defined roles currently assigned to staff.",
        },
        {
            title: "Critical Role Fill",
            value: data?.critical_role_fill_rate_percent !== undefined ? `${data.critical_role_fill_rate_percent.toFixed(1)}%` : "—",
            subtitle: `${data?.critical_filled_roles || 0} of ${data?.critical_total_roles || 0} filled`,
            trend: { type: "up" as const, value: `${data?.critical_total_roles || 0} Critical Total`, isPositive: true },
            infoText: "Percentage of strictly critical medical response roles currently filled.",
        },
        {
            title: "Average Sign-In Time",
            value: formatTime(data?.avg_sign_in_minutes_since_midnight_utc || 0),
            subtitle: "Average start time of shift.",
            trend: { type: "neutral" as const, value: `Out: ${formatTime(data?.avg_sign_out_minutes_since_midnight_utc || 0)}`, isPositive: true },
            infoText: "Mean UTC clock time at which staff members sign into their roles.",
        },
    ];

    return (
        <div className="flex w-full min-w-0 flex-col gap-4">
            {/* KPI Cards */}
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {kpiData.map((kpi, index) => (
                    <div
                        key={index}
                        className="animate-slide-in-up"
                        style={{ animationDelay: `${index * 100}ms`, opacity: 0, animationFillMode: 'forwards' }}
                    >
                        <KPICard {...kpi} />
                    </div>
                ))}
            </div>

            {/* Clinical Operations charts under Staffing & Coverage KPIs */}
            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="animate-slide-in-up" style={{ animationDelay: '150ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <LabTestsVolume data={data} />
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: '180ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <ImagingRadiology data={data} />
                </div>
            </div>

            {/* Role Coverage Chart + Top Rejection Reasons */}
            <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="animate-slide-in-up" style={{ animationDelay: '200ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <RoleCoverageChart data={data} />
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: '300ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <TopRejectionReasons data={data} />
                </div>
            </div>

            {/* Outstanding Reimbursement + Claims Owed */}
            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="animate-slide-in-up" style={{ animationDelay: '400ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <OutstandingReimbursement />
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: '500ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <ClaimsOwedByDepartment data={data} onEditRole={onEditRole} />
                </div>
            </div>

            {/* Subscription Spend + Top Vendors + Spending by Category */}
            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                <div className="animate-slide-in-up" style={{ animationDelay: '600ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <SubscriptionSpend data={data} />
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: '700ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <TopVendors data={data} />
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: '800ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <SpendingByCategory data={data} />
                </div>
            </div>
        </div>
    );
};

export default BillingFinancePage;
