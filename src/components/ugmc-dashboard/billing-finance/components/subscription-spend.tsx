"use client";

import * as React from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";

const ClockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

type ResponseMetric = { name: string; description: string; value: string };

const responseMetrics: ResponseMetric[] = [
    { name: "Avg Critical Ack Time", description: "Time to acknowledge critical messages", value: "4.2 min" },
    { name: "Avg Reply Time (All)", description: "Average first reply across all messages", value: "8.7 min" },
    { name: "Avg Reply Time (Critical)", description: "Average first reply to critical messages", value: "3.1 min" },
    { name: "Avg Reply Time (Standard)", description: "Average first reply to non-critical messages", value: "12.4 min" },
    { name: "Total Calls Made", description: "Voice calls initiated in the period", value: "284" },
];

const SubscriptionSpend: React.FC = () => {
    return (
        <DashboardCard className="flex flex-col flex-1" padding="none" style={{ padding: 20, gap: 12, height: 680 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Text variant="body-md-semibold" color="text-primary" className="font-bold">Response Time by Priority</Text>
                    <Text variant="body-sm" color="text-secondary">Current Window</Text>
                </div>
            </div>
            <div className="bg-secondary rounded-[10px] flex flex-col items-center" style={{ padding: 12, gap: 8 }}>
                <Text variant="body-md-semibold" color="text-secondary">Avg Critical Ack</Text>
                <span className="text-[32px] font-bold text-[#2980D3]">4.2 min</span>
            </div>
            <div className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {responseMetrics.map((metric, index) => (
                    <React.Fragment key={metric.name}>
                        <div className="flex items-start justify-between">
                            <div className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <Text variant="body-md-semibold" color="text-primary">{metric.name}</Text>
                                <div className="bg-tertiary border border-tertiary rounded-[4px] w-fit text-[#587081]" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
                                    <ClockIcon />
                                    <Text variant="body-sm" color="text-secondary" className="font-medium whitespace-nowrap">{metric.description}</Text>
                                </div>
                            </div>
                            <div className="rounded-[4px] bg-accent-primary/10" style={{ padding: '4px 8px' }}>
                                <Text variant="body-sm-semibold" color="accent-primary">{metric.value}</Text>
                            </div>
                        </div>
                        {index < responseMetrics.length - 1 && <div className="border-t border-tertiary" />}
                    </React.Fragment>
                ))}
            </div>
            <div className="bg-[#2980D31A] border border-[#2980D333] rounded-[10px]" style={{ padding: 10 }}>
                <Text variant="body-md" color="none" style={{ color: "#2980D3" }} className="font-medium">
                    Insight: Critical message acknowledgement averages 4.2 min. Standard messages take 3× longer to receive first reply.
                </Text>
            </div>
        </DashboardCard>
    );
};

export default SubscriptionSpend;
