"use client";

import * as React from "react";
import Text from "@/components/analytics/text";
import DashboardCard from "@/components/analytics/ugmc-dashboard/shared/dashboard-card";
import { useEffect, useMemo, useState } from "react";
import InfoTooltip from "@/components/analytics/info-tooltip";
import clsx from "clsx";
import { FaLightbulb } from "react-icons/fa6";
import { type CallMetricsSlice, buildCallInsightSummary } from "./call-metrics-helpers";
import { CardTitle } from "@/components/analytics/glass/illustrations";

const infoText =
    "Outbound answer rate with top caller and unanswered volume. Bar shows the share of outbound sessions that connected.";

interface OperatingRoomsUtilizationProps {
    callMetrics?: CallMetricsSlice;
}

const OperatingRoomsUtilization: React.FC<OperatingRoomsUtilizationProps> = ({ callMetrics }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [animatedProgress, setAnimatedProgress] = useState(0);
    const [isVisible, setIsVisible] = useState(false);

    const { heroValue, topCallerLabel, unanswered, connectProgress, hasData } = useMemo(
        () => buildCallInsightSummary(callMetrics),
        [callMetrics]
    );

    useEffect(() => {
        setIsVisible(true);
    }, []);

    useEffect(() => {
        if (!isVisible) return;

        const durationMs = 1200;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / durationMs, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setAnimatedProgress(connectProgress * eased);
            if (progress < 1) requestAnimationFrame(animate);
            else setAnimatedProgress(connectProgress);
        };
        requestAnimationFrame(animate);
    }, [isVisible, connectProgress]);

    return (
        <DashboardCard data-watermark="call"
            className="flex flex-1 min-w-[280px] flex-col gap-4"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex items-start justify-between">
                <div className="flex flex-col gap-0.5">
                    <CardTitle icon="lightbulb" variant="body-md-semibold">Calls Insight</CardTitle>
                    <Text variant="body-sm" color="text-tertiary">
                        Connect rate and busiest callers.
                    </Text>
                </div>
                <div className="flex items-center gap-2">
                    <div
                        className={clsx(
                            "flex h-10 w-10 items-center justify-center rounded-[10px] bg-secondary",
                            "transition-transform duration-300",
                            isHovered && "scale-110"
                        )}
                    >
                        <FaLightbulb className="text-accent-primary" size={16} />
                    </div>
                    <InfoTooltip text={infoText} show={isHovered} />
                </div>
            </div>

            <div>
                <span
                    className={clsx(
                        "text-[40px] font-bold tracking-tight text-accent-primary tabular-nums",
                        "transition-transform duration-300",
                        isHovered && "scale-[1.02] origin-left inline-block"
                    )}
                >
                    {hasData && heroValue ? heroValue : "—"}
                </span>
            </div>

            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                    <Text variant="body-sm" color="text-secondary">
                        Top caller
                    </Text>
                    <div className="max-w-[58%] rounded-[6px] bg-accent-primary/10 px-2 py-0.5">
                        <Text
                            variant="body-sm"
                            color="accent-primary"
                            className="truncate text-right"
                            title={topCallerLabel ?? undefined}
                        >
                            {hasData && topCallerLabel ? topCallerLabel : "—"}
                        </Text>
                    </div>
                </div>
                <div className="h-px w-full bg-tertiary" />
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3">
                        <Text variant="body-sm" color="text-secondary">
                            Unanswered outbound
                        </Text>
                        <div className="rounded-[6px] bg-secondary px-2 py-0.5">
                            <Text variant="body-sm" color="text-primary" className="tabular-nums">
                                {hasData ? unanswered.toLocaleString() : "—"}
                            </Text>
                        </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                            className="h-full rounded-full bg-accent-primary transition-all duration-1000 ease-out"
                            style={{ width: hasData ? `${animatedProgress}%` : "0%" }}
                        />
                    </div>
                </div>
            </div>
        </DashboardCard>
    );
};

export default OperatingRoomsUtilization;
