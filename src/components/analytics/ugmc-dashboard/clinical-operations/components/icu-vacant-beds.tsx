"use client";

import * as React from "react";
import Text from "@/components/analytics/text";
import DashboardCard from "@/components/analytics/ugmc-dashboard/shared/dashboard-card";
import { useState, useEffect } from "react";
import InfoTooltip from "@/components/analytics/info-tooltip";
import { FaClock } from "react-icons/fa6";
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

const avgInfo = "Median duration of answered calls in the selected period.";
const rangeInfo = "Middle 50% of answered call lengths (Q1 to Q3). Min and max show extremes.";

interface ICUVacantBedsProps {
    callMetrics?: CallMetricsSlice;
}

const ICUVacantBeds: React.FC<ICUVacantBedsProps> = ({ callMetrics }) => {
    const [isAvgHovered, setIsAvgHovered] = useState(false);
    const [isRangeHovered, setIsRangeHovered] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    const answered = getAnsweredSpread(callMetrics);
    const hasAnswered = hasAnsweredDuration(callMetrics);
    const typicalSeconds = pickTypicalSeconds(answered) ?? 0;
    const avgSeconds = num(answered?.avg_duration_seconds);
    const q1 = num(answered?.q1_duration_seconds);
    const q3 = num(answered?.q3_duration_seconds);
    const minSeconds = num(answered?.min_duration_seconds);
    const maxSeconds = num(answered?.max_duration_seconds);
    const answeredCount = num(answered?.answered_calls);
    const showData = hasAnswered;

    const rangePct =
        q3 > 0 && q1 >= 0 ? Math.min(100, Math.round((q1 / Math.max(q3, 1)) * 100)) : 0;

    useEffect(() => {
        setIsVisible(true);
    }, []);

    return (
        <DashboardCard className="flex flex-col gap-[10px] h-full" padding="sm">
            <div
                className="flex flex-col gap-3 bg-tertiary rounded-[12px] p-4 transition-colors"
                onMouseEnter={() => setIsAvgHovered(true)}
                onMouseLeave={() => setIsAvgHovered(false)}
            >
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-0.5">
                        <Text variant="body-md-semibold" color="text-primary">
                            Avg Call Duration
                        </Text>
                        <Text variant="body-sm" color="text-secondary">
                            Answered calls
                        </Text>
                    </div>
                    <div className="flex items-center gap-2">
                        <div
                            className={clsx(
                                "w-8 h-8 rounded-[8px] bg-primary flex items-center justify-center shadow-md",
                                "transition-transform duration-300",
                                isAvgHovered && "scale-110"
                            )}
                        >
                            <FaClock className="text-text-primary" size={14} />
                        </div>
                        <InfoTooltip text={avgInfo} show={isAvgHovered} />
                    </div>
                </div>
                <div>
                    <span
                        className={clsx(
                            "text-[28px] font-bold tracking-tight text-accent-primary tabular-nums",
                            "transition-transform duration-300",
                            isAvgHovered && isVisible && "scale-[1.02] origin-left inline-block"
                        )}
                    >
                        {showData ? fmtDuration(typicalSeconds) : "—"}
                    </span>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                        <Text variant="body-sm" color="text-secondary">
                            {showData
                                ? `${answeredCount.toLocaleString()} answered`
                                : "No duration data"}
                        </Text>
                        {avgSeconds > 0 && (
                            <div className="bg-accent-primary/20 px-2 py-0.5 rounded-[6px]">
                                <Text variant="body-sm" color="accent-primary">
                                    Avg {fmtDuration(avgSeconds)}
                                </Text>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div
                className="flex flex-col gap-3 bg-primary-light rounded-[12px] p-4 transition-colors"
                onMouseEnter={() => setIsRangeHovered(true)}
                onMouseLeave={() => setIsRangeHovered(false)}
            >
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-0.5">
                        <Text variant="body-md-semibold" color="text-primary">
                            Call Duration Range
                        </Text>
                        <Text variant="body-sm" color="text-secondary">
                            Typical range (Q1–Q3)
                        </Text>
                    </div>
                    <div className="flex items-center gap-2">
                        <div
                            className={clsx(
                                "w-8 h-8 rounded-[8px] bg-primary flex items-center justify-center shadow-md",
                                "transition-transform duration-300",
                                isRangeHovered && "scale-110"
                            )}
                        >
                            <FaClock className="text-text-primary" size={14} />
                        </div>
                        <InfoTooltip text={rangeInfo} show={isRangeHovered} />
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                        <Text variant="body-sm" color="text-secondary">
                            Usual spread
                        </Text>
                        <div className="bg-accent-green/20 px-2 py-0.5 rounded-[4px]">
                            <span className="text-accent-green text-sm font-semibold">
                                {showData ? typicalSecondsRange(q1, q3) : "—"}
                            </span>
                        </div>
                    </div>
                    <div className="w-full h-px bg-quaternary" />
                    <div className="flex justify-between items-center">
                        <Text variant="body-sm" color="text-secondary">
                            Shortest · Longest
                        </Text>
                        <span className="bg-quaternary px-1.5 py-0.5 rounded-[4px]">
                            <Text variant="body-sm" color="text-primary">
                                {showData && minSeconds > 0 && maxSeconds > 0
                                    ? `${fmtDuration(minSeconds)} · ${fmtDuration(maxSeconds)}`
                                    : "—"}
                            </Text>
                        </span>
                    </div>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full bg-quaternary transition-all duration-1000 ease-out"
                            style={{ width: showData ? `${rangePct}%` : "0%" }}
                        />
                    </div>
                </div>
            </div>
        </DashboardCard>
    );
};

export default ICUVacantBeds;
