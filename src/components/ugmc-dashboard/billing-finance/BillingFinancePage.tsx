"use client";

import * as React from "react";
import {
    KPICard,
    TotalRevenueGenerated,
    TopRejectionReasons,
    OutstandingReimbursement,
    ClaimsOwedByDepartment,
    SubscriptionSpend,
    TopVendors,
    SpendingByCategory,
} from "./components";

const kpiData = [
    {
        title: "Claim Rejection Rate",
        value: "12.4%",
        subtitle: "Claims denied on first submission.",
        trend: { type: "down" as const, value: "-2.1%", isPositive: true },
        infoText: "The percentage of insurance claims that are rejected or denied by insurers on the first submission. Lower rates indicate better documentation and billing accuracy.",
    },
    {
        title: "Reimbursement Rate",
        value: "78.3%",
        subtitle: "Average Reimbursement Rate.",
        trend: { type: "up" as const, value: "+7%", isPositive: true },
        infoText: "The average percentage of reimbursements that are approved by insurance companies. Higher claim approval rates mean more successful reimbursements.",
    },
    {
        title: "Outstanding Reimbursement",
        value: "GH₵ 847K",
        subtitle: "Total Outstanding Reimbursement.",
        trend: { type: "down" as const, value: "-7%", isPositive: false },
        infoText: "The total amount of money owed by insurance companies for submitted claims that are still pending payment. Lower amounts indicate faster payment cycles.",
    },
    {
        title: "Collection Efficiency",
        value: "90.1%",
        subtitle: "Expected vs Current reimbursement.",
        trend: { type: "up" as const, value: "+2.1%", isPositive: true },
        infoText: "The percentage of billed amounts that have been successfully collected. This measures how effectively the hospital converts billed services into actual revenue.",
    },
];

const BillingFinancePage = () => {
    return (
        <div className="w-full flex flex-col" style={{ gap: 15 }}>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
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

            {/* Total Revenue Generated + Top Rejection Reasons */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                <div className="animate-slide-in-up" style={{ animationDelay: '200ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <TotalRevenueGenerated />
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: '300ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <TopRejectionReasons />
                </div>
            </div>

            {/* Outstanding Reimbursement + Claims Owed */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="animate-slide-in-up" style={{ animationDelay: '400ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <OutstandingReimbursement />
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: '500ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <ClaimsOwedByDepartment />
                </div>
            </div>

            {/* Subscription Spend + Top Vendors + Spending by Category */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <div className="animate-slide-in-up" style={{ animationDelay: '600ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <SubscriptionSpend />
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: '700ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <TopVendors />
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: '800ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <SpendingByCategory />
                </div>
            </div>
        </div>
    );
};

export default BillingFinancePage;
