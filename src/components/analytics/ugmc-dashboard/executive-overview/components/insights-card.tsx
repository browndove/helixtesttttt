"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Text from "@/components/analytics/text";
import InfoTooltip from "@/components/analytics/info-tooltip";
import clsx from "clsx";
import { responseMinutes } from "@/lib/analytics/distribution-metrics";
import { CardTitle } from "@/components/analytics/glass/illustrations";

const TOP_N = 5;

const infoText =
    "Top 5 roles with the fastest median critical acknowledgment time. " +
    "The bar shows each role’s share of combined speed (faster roles take more of the bar). " +
    "List shows each role’s median ack time on critical messages.";

const SEGMENT_STYLES = [
    { bar: "#2a9a74", bg: "rgba(42,154,116,0.1)", text: "#2a9a74" },
    { bar: "#2f6fb8", bg: "rgba(47,111,184,0.1)", text: "#2f6fb8" },
    { bar: "#e5a73b", bg: "rgba(255,202,87,0.2)", text: "#C68904" },
    { bar: "#ec8f4f", bg: "rgba(255,146,87,0.1)", text: "#ec8f4f" },
    { bar: "#e0656b", bg: "rgba(224,101,107,0.1)", text: "#e0656b" },
] as const;

interface InsightsCardProps {
    data?: {
        role_metrics?: {
            role_name?: string;
            role_id?: string;
            avg_critical_ack_minutes?: number;
            critical_messages?: number;
        }[];
    };
}

type RankedRole = {
    id: string;
    name: string;
    ackMinutes: number;
    segmentPercent: number;
};

function num(v: unknown): number {
    const n = typeof v === "string" ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
}

function formatRoleName(name: string): string {
    return name.replace(/^HH\s*-\s*/i, "").trim() || name;
}

function formatAckTime(minutes: number): string {
    if (minutes <= 0) return "—";
    if (minutes < 1) {
        const seconds = minutes * 60;
        if (seconds < 10) return `${seconds.toFixed(1)}s`;
        return `${Math.round(seconds)}s`;
    }
    if (minutes < 10) return `${minutes.toFixed(1)}m`;
    return `${Math.round(minutes)}m`;
}

const InsightsCard = ({ data }: InsightsCardProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [animatedBars, setAnimatedBars] = useState<number[]>([]);

    const { topRoles, fastestMinutes } = useMemo(() => {
        const roles = (data?.role_metrics || [])
            .map((r) => ({
                role: r,
                ackMinutes:
                    responseMinutes(r as Record<string, unknown>, "critical_ack", [
                        "avg_critical_ack_minutes",
                    ]) ?? 0,
            }))
            .filter((r) => r.ackMinutes > 0 && num(r.role?.critical_messages) > 0)
            .map((r, i) => ({
                id: String(r.role.role_id || "").trim() || `role-${i}`,
                name: formatRoleName(r.role.role_name || "Role"),
                ackMinutes: r.ackMinutes,
            }))
            .sort((a, b) => a.ackMinutes - b.ackMinutes)
            .slice(0, TOP_N);

        const fastest = roles[0]?.ackMinutes ?? 0;
        const scores = roles.map((r) => (fastest > 0 ? fastest / r.ackMinutes : 0));
        const scoreSum = scores.reduce((a, b) => a + b, 0) || 1;

        const withSegments: RankedRole[] = roles.map((r, i) => ({
            id: r.id,
            name: r.name,
            ackMinutes: r.ackMinutes,
            segmentPercent: (scores[i] / scoreSum) * 100,
        }));

        return { topRoles: withSegments, fastestMinutes: fastest };
    }, [data]);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    useEffect(() => {
        if (!isVisible || topRoles.length === 0) {
            setAnimatedBars([]);
            return;
        }

        const targets = topRoles.map((r) => r.segmentPercent);
        const duration = 1200;
        const start = performance.now();
        let frame: number;

        const tick = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            setAnimatedBars(targets.map((p) => p * eased));
            if (t < 1) frame = requestAnimationFrame(tick);
            else setAnimatedBars(targets);
        };

        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [isVisible, topRoles]);

    const heroTime = formatAckTime(fastestMinutes);

    return (
        <div data-watermark="emoji_events"
            className={clsx(
                "flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[18px] border border-black/[0.08] bg-primary",
                "transition-shadow duration-300",
                isHovered && "border-black/[0.14]",
            )}
            style={{ padding: 12 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex flex-col gap-0.5">
                        <CardTitle icon="bolt" variant="body-md-semibold" className="font-bold">Fastest Average Acknowledgment</CardTitle>
                        <Text variant="body-sm" color="text-secondary">
                            Top {TOP_N} roles · Avg critical ack
                        </Text>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        {topRoles.length > 0 ? (
                            <div className="whitespace-nowrap rounded-[5px] bg-[#2f6fb81A] px-[7px] py-1">
                                <span className="text-[12px] font-semibold tabular-nums text-[#2f6fb8]">
                                    {topRoles.length} tracked
                                </span>
                            </div>
                        ) : null}
                        <InfoTooltip text={infoText} show={isHovered} />
                    </div>
                </div>

                {topRoles.length === 0 ? (
                    <Text variant="body-sm" color="text-secondary" className="py-6 text-center">
                        No acknowledgment data for this period
                    </Text>
                ) : (
                    <>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[28px] font-bold leading-none tabular-nums text-[#2f6fb8]">
                                {heroTime}
                            </span>
                            <Text variant="body-sm" color="text-secondary">
                                Fastest critical ack
                            </Text>
                        </div>

                        <div className="flex h-[28px] overflow-hidden rounded-[8px]">
                            {topRoles.map((role, index) => {
                                const style = SEGMENT_STYLES[index] ?? SEGMENT_STYLES[4];
                                const width = animatedBars[index] ?? 0;
                                const isFirst = index === 0;
                                const isLast = index === topRoles.length - 1;
                                return (
                                    <div
                                        key={role.id}
                                        className={clsx(
                                            "shrink-0 transition-[width] duration-150",
                                            isFirst && "rounded-l-[8px]",
                                            isLast && "rounded-r-[8px]",
                                        )}
                                        style={{
                                            width: `${Math.max(width, index === 0 ? 8 : 4)}%`,
                                            backgroundColor: style.bar,
                                            minWidth: width > 0 ? 2 : 0,
                                        }}
                                        title={`${role.name}: ${formatAckTime(role.ackMinutes)}`}
                                    />
                                );
                            })}
                        </div>

                        <div className="flex flex-col gap-2">
                            {topRoles.map((role, index) => {
                                const style = SEGMENT_STYLES[index] ?? SEGMENT_STYLES[4];
                                return (
                                    <Fragment key={role.id}>
                                        <div className="flex items-center justify-between gap-2 rounded-md px-0.5 transition-colors hover:bg-secondary/50">
                                            <div className="flex min-w-0 items-center gap-1.5">
                                                <div
                                                    className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                                                    style={{ backgroundColor: style.bar }}
                                                />
                                                <Text
                                                    variant="body-sm"
                                                    color="text-primary"
                                                    className="truncate"
                                                >
                                                    {role.name}
                                                </Text>
                                            </div>
                                            <div
                                                className="shrink-0 rounded-[5px] px-[7px] py-0.5"
                                                style={{ backgroundColor: style.bg }}
                                            >
                                                <span
                                                    className="text-[12px] font-semibold tabular-nums"
                                                    style={{ color: style.text }}
                                                >
                                                    {formatAckTime(role.ackMinutes)}
                                                </span>
                                            </div>
                                        </div>
                                        {index < topRoles.length - 1 ? (
                                            <div className="border-t border-tertiary" />
                                        ) : null}
                                    </Fragment>
                                );
                            })}
                        </div>

                    </>
                )}
            </div>
        </div>
    );
};

export default InsightsCard;
