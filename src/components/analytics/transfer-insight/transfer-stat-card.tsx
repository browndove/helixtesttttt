"use client";

import * as React from "react";
import Text from "@/components/analytics/text";
import DashboardCard from "@/components/analytics/safety-reports/dashboard-card";

type TransferStatCardProps = {
    title: string;
    description: string;
    icon: React.ReactNode;
};

const TransferStatCard: React.FC<TransferStatCardProps> = ({ title, description, icon }) => (
    <DashboardCard className="flex flex-col gap-1.5" padding="sm">
        <div className="flex items-start justify-between">
            <Text variant="body-md-semibold" color="text-primary" className="text-sm">
                {title}
            </Text>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-accent-primary/10">{icon}</div>
        </div>
        <div className="flex flex-col gap-1">
            <Text variant="heading-3xl" color="text-primary" className="tracking-tight" style={{ fontSize: "28px", lineHeight: 1 }}>
                —
            </Text>
            <div className="h-px w-full bg-tertiary" style={{ backgroundImage: "repeating-linear-gradient(90deg, var(--bg-tertiary) 0, var(--bg-tertiary) 8px, transparent 8px, transparent 12px)" }} />
            <Text variant="body-sm" color="text-secondary" className="text-xs">
                {description}
            </Text>
        </div>
    </DashboardCard>
);

export default TransferStatCard;
