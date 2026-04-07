"use client";

import * as React from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";

type Vendor = {
    rank: number;
    name: string;
    category: string;
    amount: string;
    trend: { value: string; isPositive: boolean };
};

const DecreaseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="7" viewBox="0 0 12 7" fill="none">
        <path d="M7.57129 6H10.7141V2.85714" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.7143 6L6.275 1.56071C6.20156 1.48873 6.10283 1.44841 6 1.44841C5.89717 1.44841 5.79844 1.48873 5.725 1.56071L3.91786 3.36786C3.84442 3.43984 3.74569 3.48016 3.64286 3.48016C3.54003 3.48016 3.44129 3.43984 3.36786 3.36786L0.5 0.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const IncreaseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="7" viewBox="0 0 12 7" fill="none">
        <path d="M7.57129 0.5H10.7141V3.64286" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.7143 0.5L6.275 4.93929C6.20156 5.01127 6.10283 5.05159 6 5.05159C5.89717 5.05159 5.79844 5.01127 5.725 4.93929L3.91786 3.13214C3.84442 3.06016 3.74569 3.01984 3.64286 3.01984C3.54003 3.01984 3.44129 3.06016 3.36786 3.13214L0.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const vendors: Vendor[] = [
    { rank: 1, name: "PharmaCare Ghana Ltd", category: "Pharmaceuticals", amount: "GH₵ 385K", trend: { value: "-2.1%", isPositive: false } },
    { rank: 2, name: "MedEquip Solutions", category: "Medical Equipment", amount: "GH₵ 268K", trend: { value: "+7%", isPositive: true } },
    { rank: 3, name: "Ghana Energy Co.", category: "Utilities", amount: "GH₵ 195K", trend: { value: "+7%", isPositive: true } },
    { rank: 4, name: "Cleantech Services", category: "Facilities", amount: "GH₵ 167K", trend: { value: "+7%", isPositive: true } },
    { rank: 5, name: "Lab Diagnostics Inc", category: "Lab Supplies", amount: "GH₵ 142K", trend: { value: "-2.1%", isPositive: false } },
];

const TopVendors: React.FC = () => {
    return (
        <DashboardCard className="flex flex-col flex-1" padding="none" style={{ padding: 20, gap: 10, height: 680 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Text variant="body-md-semibold" color="text-primary" className="font-bold">Top 10 Vendors</Text>
                    <Text variant="body-sm" color="text-secondary">By amount spent (Last 30 days)</Text>
                </div>
                <button className="text-[12px] font-semibold text-[#0EAF9F] rounded-[6px] bg-[#0EAF9F1A] hover:bg-[#0EAF9F26] transition-colors" style={{ padding: '6px 12px' }}>View All</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Text variant="body-sm" color="text-secondary">Total</Text>
                <span className="text-[32px] font-bold" style={{ color: "#0EAF9F" }}>GH₵ 67,000</span>
            </div>
            <div className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {vendors.map((vendor) => (
                    <div key={vendor.rank} className="bg-secondary rounded-[10px] flex items-center" style={{ padding: 16, height: 71 }}>
                        <div className="w-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                            <div className="flex-1 min-w-0" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <Text variant="heading-lg" color="text-tertiary" className="font-semibold shrink-0">{vendor.rank}</Text>
                                <div className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    <Text variant="body-md-semibold" color="text-primary" className="truncate">{vendor.name}</Text>
                                    <Text variant="body-sm" color="text-tertiary">{vendor.category}</Text>
                                </div>
                            </div>
                            <div className="shrink-0" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div className="rounded-[4px] bg-quaternary" style={{ padding: '0 8px' }}>
                                    <Text variant="body-md-semibold" color="text-primary">{vendor.amount}</Text>
                                </div>
                                <div className={`flex items-center rounded-full ${vendor.trend.isPositive ? "bg-accent-green/10 text-accent-green" : "bg-accent-red/10 text-accent-red"}`} style={{ gap: 6, padding: '3px 8px' }}>
                                    {vendor.trend.isPositive ? <IncreaseIcon /> : <DecreaseIcon />}
                                    <span className="text-[11px] font-semibold">{vendor.trend.value}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="bg-[#0EAF9F1A] border border-[#0EAF9F33] rounded-[10px]" style={{ padding: 12 }}>
                <Text variant="body-md" color="none" style={{ color: "#0EAF9F" }} className="font-medium break-words overflow-wrap-anywhere">
                    Trend Alert: Lab Diagnostics Inc spend increased 15.7% this month. Review volume changes or pricing updates.
                </Text>
            </div>
        </DashboardCard>
    );
};

export default TopVendors;
