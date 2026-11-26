"use client";

import * as React from "react";
import Text from "@/components/analytics/text";
import DashboardCard from "@/components/analytics/ugmc-dashboard/shared/dashboard-card";
import { FaClock } from "react-icons/fa6";
import { useState, useEffect } from "react";
import InfoTooltip from "@/components/analytics/info-tooltip";
import clsx from "clsx";
import {
    type CallMetricsSlice,
    fmtDuration,
    getAnsweredSpread,
    hasAnsweredDuration,
    num,
    pickTypicalSeconds,
    typicalSecondsRange,
} from "./call-metrics-helpers";
import { CardTitle } from "@/components/analytics/glass/illustrations";

const infoText =
    "Based on answered calls (someone other than the caller joined). Median length with middle 50% between Q1 and Q3.";

interface CallDurationCardProps {
    callMetrics?: CallMetricsSlice;
}

const CallDurationCard: React.FC<CallDurationCardProps> = ({ callMetrics }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [animatedProgress, setAnimatedProgress] = useState(0);
    const [isVisible, setIsVisible] = useState(false);

    const answered = getAnsweredSpread(callMetrics);
    const hasData = hasAnsweredDuration(callMetrics);
    const heroSeconds = pickTypicalSeconds(answered) ?? 0;
    const avgSeconds = num(answered?.avg_duration_seconds);
    const q1 = num(answered?.q1_duration_seconds);
    const q3 = num(answered?.q3_duration_seconds);
    const maxSeconds = num(answered?.max_duration_seconds);
    const targetProgress =
        hasData && maxSeconds > 0 && heroSeconds > 0
            ? Math.min(100, (heroSeconds / maxSeconds) * 100)
            : 0;

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

            setAnimatedProgress(targetProgress * eased);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setAnimatedProgress(targetProgress);
            }
        };
        requestAnimationFrame(animate);
    }, [isVisible, targetProgress]);

    return (
        <DashboardCard data-watermark="hourglass_bottom"
            className="flex flex-col gap-4 flex-1 min-w-[280px]"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex justify-between items-start">
                <div className="flex flex-col gap-0.5">
                    <CardTitle icon="timer" variant="body-md-semibold">Call Duration</CardTitle>
                    <Text variant="body-sm" color="text-tertiary">
                        Typical length of answered calls.
                    </Text>
                </div>
                <div className="flex items-center gap-2">
                    <div
                        className={clsx(
                            "w-10 h-10 rounded-[10px] bg-secondary flex items-center justify-center",
                            "transition-transform duration-300",
                            isHovered && "scale-110"
                        )}
                    >
                        <FaClock className="text-text-primary" size={16} />
                    </div>
                    <InfoTooltip text={infoText} show={isHovered} />
                </div>
            </div>
            <div>
                <span
                    className={clsx(
                        "text-[40px] font-bold tracking-tight text-[#2a9a74] tabular-nums",
                        "transition-transform duration-300",
                        isHovered && "scale-[1.02] origin-left inline-block"
                    )}
                >
                    {hasData && heroSeconds > 0 ? fmtDuration(heroSeconds) : "—"}
                </span>
            </div>
            <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <Text variant="body-sm" color="text-secondary">
                        Average
                    </Text>
                    <div className="bg-[#2a9a7433] px-2 py-0.5 rounded-[6px]">
                        <Text variant="body-sm" color="none" className="text-[#2a9a74]">
                            {hasData && avgSeconds > 0 ? fmtDuration(avgSeconds) : "—"}
                        </Text>
                    </div>
                </div>
                <div className="w-full h-px bg-tertiary" />
                <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                        <Text variant="body-sm" color="text-secondary">
                            Typical range (Q1–Q3)
                        </Text>
                        <div className="bg-[#2a9a7433] px-2 py-0.5 rounded-[6px]">
                            <Text variant="body-sm" color="none" className="text-[#2a9a74]">
                                {hasData ? typicalSecondsRange(q1, q3) : "—"}
                            </Text>
                        </div>
                    </div>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full bg-[#2a9a74] transition-all duration-1000 ease-out"
                            style={{ width: hasData ? `${animatedProgress}%` : "0%" }}
                        />
                    </div>
                </div>
            </div>
        </DashboardCard>
    );
};

export default CallDurationCard;
