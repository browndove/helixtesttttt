'use client';

import { useState, useEffect, useMemo } from "react";
import Text from "@/components/analytics/text";
import InfoTooltip from "@/components/analytics/info-tooltip";
import { IoSearch } from "react-icons/io5";
import { HiOutlineBellAlert, HiOutlineClock, HiOutlineEnvelopeOpen, HiOutlineChartBar, HiOutlinePhone } from "react-icons/hi2";
import clsx from "clsx";
import {
    formatMinutes,
    pickTypicalMinutes,
    resolveCriticalAckMinutes,
    resolveReadMinutes,
} from "@/lib/analytics/distribution-metrics";

const infoText = "Median response and acknowledgment times for critical and non-critical messages.";

export interface ResponseTimesData {
    avg_critical_ack_minutes: number;
    avg_first_read_minutes_all: number;
    avg_first_read_minutes_critical: number;
    avg_first_read_minutes_non_critical: number;
    total_calls_made?: number;
}

interface LiveUpdatesProps {
    responseTimes?: ResponseTimesData | Record<string, unknown>;
}

function fmtMin(minutes: number | null | undefined): string {
    if (minutes == null) return "—";
    return formatMinutes(minutes);
}

const LiveUpdates = ({ responseTimes }: LiveUpdatesProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [visibleUpdates, setVisibleUpdates] = useState<number[]>([]);

    const root = responseTimes as Record<string, unknown> | undefined;
    const ackTypical = pickTypicalMinutes(resolveCriticalAckMinutes(root));
    const readCriticalTypical = pickTypicalMinutes(resolveReadMinutes(root, "critical"));
    const readStandardTypical = pickTypicalMinutes(resolveReadMinutes(root, "standard"));
    const readAllTypical = pickTypicalMinutes(resolveReadMinutes(root, "all"));

    const rtKey = JSON.stringify(responseTimes);
    const items = useMemo(() => [
        {
            label: "Critical Ack Time",
            value: fmtMin(ackTypical),
            icon: <HiOutlineBellAlert className="w-[18px] h-[18px] text-accent-red" />,
            bg: "bg-[rgba(255,95,87,0.1)]",
        },
        {
            label: "Critical Read Time",
            value: fmtMin(readCriticalTypical),
            icon: <HiOutlineClock className="w-[18px] h-[18px] text-accent-primary" />,
            bg: "bg-[rgba(41,128,211,0.1)]",
        },
        {
            label: "Non-Critical Read Time",
            value: fmtMin(readStandardTypical),
            icon: <HiOutlineEnvelopeOpen className="w-[18px] h-[18px] text-accent-green" />,
            bg: "bg-[rgba(0,200,179,0.1)]",
        },
        {
            label: "Overall Read Time",
            value: fmtMin(readAllTypical),
            icon: <HiOutlineChartBar className="w-[18px] h-[18px] text-accent-violet" />,
            bg: "bg-[rgba(105,116,247,0.1)]",
        },
        {
            label: "Total Calls Made",
            value: (responseTimes?.total_calls_made ?? 0).toLocaleString(),
            icon: <HiOutlinePhone className="w-[18px] h-[18px] text-accent-orange" />,
            bg: "bg-[rgba(232,155,0,0.1)]",
        },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [rtKey, ackTypical, readCriticalTypical, readStandardTypical, readAllTypical, responseTimes?.total_calls_made]);

    useEffect(() => {
        setVisibleUpdates([]);
        items.forEach((_, index) => {
            setTimeout(() => {
                setVisibleUpdates(prev => [...prev, index]);
            }, 150 * (index + 1));
        });
    }, [items]);

    return (
        <div 
            className={clsx(
                "bg-primary rounded-[18px] flex flex-col overflow-hidden",
                "transition-all duration-500",
                isHovered && "border-black/[0.14]"
            )}
            style={{ padding: 16, width: '100%', height: 'fit-content' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Header */}
            <div className="flex items-center justify-between relative z-10">
                <div className="flex flex-col gap-0.5">
                    <Text variant="body-md-semibold" color="text-primary">
                        Response Times
                    </Text>
                    <Text variant="body-sm" color="text-secondary">
                        Median acknowledgment & read times
                    </Text>
                </div>
                <div className="flex items-center gap-2">
                    <div className={clsx(
                        "flex items-center justify-center size-[31px] bg-tertiary rounded-[8.378px]",
                        "transition-all duration-300 cursor-pointer",
                        "hover:bg-accent-primary/10 hover:scale-110"
                    )}>
                        <IoSearch className="w-[13px] h-[13px] text-text-primary" />
                    </div>
                </div>
            </div>

            {/* Response times list */}
            <div className="flex flex-col relative z-10 mt-3">
                {items.map((item, index) => (
                    <div 
                        key={item.label}
                        className={clsx(
                            "transition-all duration-500",
                            index < items.length - 1 && "border-b border-[var(--bg-tertiary)]",
                            visibleUpdates.includes(index) 
                                ? "opacity-100 translate-x-0" 
                                : "opacity-0 -translate-x-4"
                        )}
                        style={{ padding: '10px 0', transitionDelay: `${index * 50}ms` }}
                    >
                        <div className="flex items-center gap-3">
                            <div className={clsx(
                                "flex items-center justify-center rounded-lg shrink-0",
                                item.bg
                            )} style={{ width: 36, height: 36 }}>
                                {item.icon}
                            </div>
                            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                <Text variant="body-sm" color="text-primary" className="truncate">
                                    {item.label}
                                </Text>
                                <Text variant="body-sm" color="text-secondary">
                                    {item.value}
                                </Text>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LiveUpdates;
