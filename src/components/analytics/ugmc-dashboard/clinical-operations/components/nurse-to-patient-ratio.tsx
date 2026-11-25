"use client";

import * as React from "react";
import Text from "@/components/analytics/text";
import DashboardCard from "@/components/analytics/ugmc-dashboard/shared/dashboard-card";
import { useState, useEffect } from "react";
import InfoTooltip from "@/components/analytics/info-tooltip";
import {
    type CallMetricsSlice,
    formatRoleName,
    num,
    truncateLabel,
} from "./call-metrics-helpers";
import { CardTitle } from "@/components/analytics/glass/illustrations";

const infoText = "Share of total call volume by initiating role for the selected period.";

type RatioItemProps = {
    department: string;
    target: string;
    actual: string;
    percentage: number;
    delay?: number;
};

const CircularProgress: React.FC<{ percentage: number; delay?: number }> = ({ percentage, delay = 0 }) => {
    const [animatedPercentage, setAnimatedPercentage] = useState(0);
    const radius = 22;
    const circumference = 2 * Math.PI * radius;
    // Cap visual progress at 100% but show actual percentage in text
    const visualPercentage = Math.min(animatedPercentage, 100);
    const strokeDashoffset = circumference - (visualPercentage / 100) * circumference;
    // Use red color for overloaded (>100%) to indicate danger
    const strokeColor = percentage > 100 ? "var(--accent-red)" : "var(--accent-primary)";

    useEffect(() => {
        const timer = setTimeout(() => {
            const duration = 1200;
            const startTime = Date.now();
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                
                setAnimatedPercentage(percentage * eased);
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    setAnimatedPercentage(percentage);
                }
            };
            requestAnimationFrame(animate);
        }, delay);

        return () => clearTimeout(timer);
    }, [percentage, delay]);

    return (
        <div className="relative w-14 h-14">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 50 50">
                <circle
                    cx="25"
                    cy="25"
                    r={radius}
                    fill="transparent"
                    stroke="var(--bg-tertiary)"
                    strokeWidth="4"
                />
                <circle
                    cx="25"
                    cy="25"
                    r={radius}
                    fill="transparent"
                    stroke={strokeColor}
                    strokeWidth="5"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-100"
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-[12px] font-semibold tabular-nums ${percentage > 100 ? 'text-accent-red' : 'text-accent-primary'}`}>
                    {animatedPercentage.toFixed(animatedPercentage % 1 === 0 ? 0 : 1)}%
                </span>
            </div>
        </div>
    );
};

const RatioItem: React.FC<RatioItemProps> = ({
    department,
    target,
    actual,
    percentage,
    delay = 0,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    
    return (
        <div 
            className="flex items-center justify-between py-4 px-4 bg-secondary rounded-[10px] h-[85px] transition-all duration-300 hover:bg-tertiary"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex items-center gap-4">
                <CircularProgress percentage={percentage} delay={delay} />
                <div className="flex flex-col gap-1">
                    <Text variant="body-md-semibold" color="text-primary">
                        {department}
                    </Text>
                    <Text variant="body-md" color="text-secondary">
                        {target}
                    </Text>
                </div>
            </div>
            <div className={`bg-accent-primary/10 px-3 py-1.5 rounded-[6px] transition-transform duration-300 ${isHovered ? 'scale-105' : ''}`}>
                <Text variant="body-md-semibold" color="none" className="text-accent-primary">
                    {actual}
                </Text>
            </div>
        </div>
    );
};

interface NurseToPatientRatioProps {
    callMetrics?: CallMetricsSlice;
}

const NurseToPatientRatio: React.FC<NurseToPatientRatioProps> = ({ callMetrics }) => {
    const [isHovered, setIsHovered] = useState(false);

    const ratioData = React.useMemo(() => {
        const totalCalls = num(callMetrics?.total_calls_made);
        const roles = callMetrics?.by_outbound_role;
        if (!Array.isArray(roles) || !roles.length || totalCalls <= 0) return [];

        return [...roles]
            .filter((r) => num(r.total_calls_made) > 0)
            .sort((a, b) => num(b.total_calls_made) - num(a.total_calls_made))
            .slice(0, 5)
            .map((r) => {
                const calls = num(r.total_calls_made);
                const pct = parseFloat(((calls / totalCalls) * 100).toFixed(1));
                return {
                    department: truncateLabel(formatRoleName(r.role_name), 24),
                    target: `${totalCalls.toLocaleString()} calls facility-wide`,
                    actual: `${calls.toLocaleString()} calls`,
                    percentage: pct,
                };
            });
    }, [callMetrics?.by_outbound_role, callMetrics?.total_calls_made]);

    return (
        <DashboardCard data-watermark="support_agent"
            className="flex flex-col gap-2 h-full"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <CardTitle icon="pie_chart">
                Call Share by Role
                <InfoTooltip text={infoText} show={isHovered} />
            </CardTitle>
            <div className="flex flex-col gap-3 flex-1 justify-between">
                {ratioData.length > 0 ? (
                    ratioData.map((item, index) => (
                        <RatioItem key={`${index}-${item.department}`} {...item} delay={index * 150} />
                    ))
                ) : (
                    <div className="flex flex-1 items-center justify-center rounded-[10px] bg-secondary px-4 py-8">
                        <Text variant="body-sm" color="text-secondary" className="text-center">
                            No role breakdown available for this period.
                        </Text>
                    </div>
                )}
            </div>
        </DashboardCard>
    );
};

export default NurseToPatientRatio;
