"use client";

import * as React from "react";
import Text from "@/components/analytics/text";
import DashboardCard from "@/components/analytics/ugmc-dashboard/shared/dashboard-card";
import { FaUser } from "react-icons/fa6";
import {
    type CallMetricsSlice,
    formatRoleName,
    getTopRole,
    num,
    truncateLabel,
} from "./call-metrics-helpers";

interface TopCallingRoleProps {
    callMetrics?: CallMetricsSlice;
}

const TopCallingRole: React.FC<TopCallingRoleProps> = ({ callMetrics }) => {
    const top = getTopRole(callMetrics);
    const count = top ? num(top.total_calls_made) : null;
    const roleLabel = top ? truncateLabel(formatRoleName(top.role_name), 28) : null;

    return (
        <DashboardCard className="flex flex-col gap-1.5 h-full" padding="sm">
            <div className="flex justify-between items-start">
                <Text variant="body-md-semibold" color="text-primary" className="text-sm">
                    Top Calling Role
                </Text>
                <div className="w-8 h-8 rounded-[8px] bg-accent-primary/10 flex items-center justify-center shrink-0">
                    <FaUser className="text-accent-primary" size={14} />
                </div>
            </div>
            <div className="flex flex-col gap-1">
                <Text
                    variant="heading-3xl"
                    className="tracking-tight"
                    color="text-primary"
                    style={{ fontSize: "28px", lineHeight: "1" }}
                >
                    {count !== null ? count.toLocaleString() : "—"}
                </Text>
                <div className="w-full h-px relative">
                    <svg
                        width="100%"
                        height="1"
                        viewBox="0 0 265 1"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        preserveAspectRatio="none"
                    >
                        <line
                            x1="0"
                            y1="0.5"
                            x2="265"
                            y2="0.5"
                            stroke="var(--bg-tertiary)"
                            strokeDasharray="8 4"
                            strokeWidth="1"
                        />
                    </svg>
                </div>
                <Text variant="body-sm" color="text-secondary" className="text-xs line-clamp-2">
                    {roleLabel
                        ? `Highest call volume: ${roleLabel}.`
                        : "No role breakdown available for this period."}
                </Text>
            </div>
        </DashboardCard>
    );
};

export default TopCallingRole;
