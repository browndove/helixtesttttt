"use client";

import * as React from "react";
import {
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

import { StaffingKpis } from "@/components/analytics/glass/AnalyticsKpis";

const BillingFinancePage = ({ data, onEditRole }: { data?: any; onEditRole?: (role: any) => void }) => {
    return (
        <div className="flex w-full min-w-0 flex-col gap-4">
            <StaffingKpis data={data} />

            {/* Clinical Operations charts under Staffing & Coverage KPIs */}
            <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
                <div
                    className="flex min-h-0 min-w-0 animate-slide-in-up"
                    style={{ animationDelay: '150ms', opacity: 0, animationFillMode: 'forwards' }}
                >
                    <LabTestsVolume data={data} />
                </div>
                <div
                    className="flex min-h-0 min-w-0 animate-slide-in-up"
                    style={{ animationDelay: '180ms', opacity: 0, animationFillMode: 'forwards' }}
                >
                    <ImagingRadiology data={data} />
                </div>
            </div>

            {/* Role Coverage Chart + Top Rejection Reasons */}
            <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="flex min-w-0 animate-slide-in-up" style={{ animationDelay: '200ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <RoleCoverageChart data={data} />
                </div>
                <div className="flex min-w-0 animate-slide-in-up" style={{ animationDelay: '300ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <TopRejectionReasons data={data} />
                </div>
            </div>

            {/* Outstanding Reimbursement + Claims Owed */}
            <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
                <div className="flex min-w-0 animate-slide-in-up" style={{ animationDelay: '400ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <OutstandingReimbursement data={data} />
                </div>
                <div className="flex min-w-0 animate-slide-in-up" style={{ animationDelay: '500ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <ClaimsOwedByDepartment data={data} onEditRole={onEditRole} />
                </div>
            </div>

            {/* Subscription Spend + Top Vendors + Spending by Category */}
            <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="flex min-w-0 animate-slide-in-up" style={{ animationDelay: '600ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <SubscriptionSpend data={data} />
                </div>
                <div className="flex min-w-0 animate-slide-in-up" style={{ animationDelay: '700ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <TopVendors data={data} />
                </div>
                <div className="flex min-w-0 animate-slide-in-up md:col-span-2 xl:col-span-1" style={{ animationDelay: '800ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <SpendingByCategory data={data} />
                </div>
            </div>
        </div>
    );
};

export default BillingFinancePage;
