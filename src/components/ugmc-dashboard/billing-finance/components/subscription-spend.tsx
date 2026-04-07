"use client";

import * as React from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";

const CalendarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="15" viewBox="0 0 11 12" fill="none" className="shrink-0">
        <path
            d="M0 4.25004C0 3.22846 -3.22858e-08 2.71821 0.317417 2.40079C0.634833 2.08337 1.14508 2.08337 2.16667 2.08337H8.66667C9.68825 2.08337 10.1985 2.08337 10.5159 2.40079C10.8333 2.71821 10.8333 3.22846 10.8333 4.25004C10.8333 4.50517 10.8333 4.633 10.7542 4.71262C10.6746 4.79171 10.5462 4.79171 10.2917 4.79171H0.541667C0.286542 4.79171 0.158708 4.79171 0.0790833 4.71262C-4.84288e-08 4.633 0 4.50462 0 4.25004ZM0 9.12504C0 10.1466 -3.22858e-08 10.6569 0.317417 10.9743C0.634833 11.2917 1.14508 11.2917 2.16667 11.2917H8.66667C9.68825 11.2917 10.1985 11.2917 10.5159 10.9743C10.8333 10.6569 10.8333 10.1466 10.8333 9.12504V6.41671C10.8333 6.16158 10.8333 6.03375 10.7542 5.95412C10.6746 5.87504 10.5462 5.87504 10.2917 5.87504H0.541667C0.286542 5.87504 0.158708 5.87504 0.0790833 5.95412C-4.84288e-08 6.03375 0 6.16212 0 6.41671V9.12504Z"
            fill="currentColor" stroke="currentColor" strokeWidth="0.5"
        />
        <path d="M2.70801 1V2.625M8.12467 1V2.625" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

type Subscription = { name: string; renewalDate: string; amount: string };

const subscriptions: Subscription[] = [
    { name: "Epic EMR License", renewalDate: "Renews Dec 2026", amount: "GH₵ 42,500" },
    { name: "Microsoft 365 Enterprise", renewalDate: "Renews Dec 2026", amount: "GH₵ 18,200" },
    { name: "Oracle Cloud", renewalDate: "Renews Dec 2026", amount: "GH₵ 12,800" },
    { name: "Telehealth Platform", renewalDate: "Renews Dec 2026", amount: "GH₵ 9,500" },
    { name: "PACS Imaging", renewalDate: "Renews Dec 2026", amount: "GH₵ 8,900" },
];

const SubscriptionSpend: React.FC = () => {
    return (
        <DashboardCard className="flex flex-col flex-1" padding="none" style={{ padding: 20, gap: 12, height: 680 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Text variant="body-md-semibold" color="text-primary" className="font-bold">Subscription Spend</Text>
                    <Text variant="body-sm" color="text-secondary">December 2026</Text>
                </div>
                <button className="text-[12px] font-semibold text-[#2980D3] rounded-[6px] bg-[#2980D31A] hover:bg-[#2980D326] transition-colors" style={{ padding: '6px 12px' }}>View All</button>
            </div>
            <div className="bg-secondary rounded-[10px] flex flex-col items-center" style={{ padding: 12, gap: 8 }}>
                <Text variant="body-md-semibold" color="text-secondary">Total</Text>
                <span className="text-[32px] font-bold text-[#2980D3]">GH₵ 45,000</span>
            </div>
            <div className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {subscriptions.map((subscription, index) => (
                    <React.Fragment key={subscription.name}>
                        <div className="flex items-start justify-between">
                            <div className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <Text variant="body-md-semibold" color="text-primary">{subscription.name}</Text>
                                <div className="bg-tertiary border border-tertiary rounded-[4px] w-fit text-[#587081]" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
                                    <CalendarIcon />
                                    <Text variant="body-sm" color="text-secondary" className="font-medium whitespace-nowrap">{subscription.renewalDate}</Text>
                                </div>
                            </div>
                            <div className="rounded-[4px] bg-accent-primary/10" style={{ padding: '4px 8px' }}>
                                <Text variant="body-sm-semibold" color="accent-primary">{subscription.amount}</Text>
                            </div>
                        </div>
                        {index < subscriptions.length - 1 && <div className="border-t border-tertiary" />}
                    </React.Fragment>
                ))}
            </div>
            <div className="bg-[#2980D31A] border border-[#2980D333] rounded-[10px]" style={{ padding: 10 }}>
                <Text variant="body-md" color="none" style={{ color: "#2980D3" }} className="font-medium">
                    Cost Optimization: Epic EMR represents 46% of total subscription spend. Consider negotiating multi-year contract for better rates.
                </Text>
            </div>
        </DashboardCard>
    );
};

export default SubscriptionSpend;
