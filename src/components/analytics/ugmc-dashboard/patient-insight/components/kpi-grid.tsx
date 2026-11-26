"use client";

import * as React from "react";
import KPICard from "@/components/analytics/ugmc-dashboard/billing-finance/components/kpi-card";
import {
    buildMinutesSpreadForKpi,
    formatMinutes,
    mergeInfoWithSpread,
    pickTypicalMinutes,
    resolveCriticalAckMinutes,
    resolveCriticalCoveragePercent,
    resolveReadMinutes,
    type MinutesDistribution,
} from "@/lib/analytics/distribution-metrics";

/** Critical messages are expected to be near-fully covered, so the bar sits high. */
const CRITICAL_COVERAGE_TARGET = 90;

function fmtMin(minutes?: number | null): string {
    if (minutes == null) return "—";
    return formatMinutes(minutes);
}

function fmtPercent(pct: number): string {
    return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

function num(v: unknown): number {
    if (v === null || v === undefined || v === "") return 0;
    const n = typeof v === "string" ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
}

function spreadProps(dist: MinutesDistribution | undefined, baseInfo: string) {
    const spread = buildMinutesSpreadForKpi(dist);
    return {
        spreadStats: spread.inline.length ? spread.inline : undefined,
        spreadStatsOverflow: spread.overflow.length ? spread.overflow : undefined,
        infoText: mergeInfoWithSpread(baseInfo, spread.infoDetail),
    };
}

const KPIGrid = ({ data }: { data?: Record<string, unknown> }) => {
    const kpiData = React.useMemo(() => {
        const totalMessages = num(data?.total_messages);
        const criticalMessages = num(data?.critical_messages);
        const escalated = num(data?.escalated_critical_messages);
        const escalationPct = data?.escalation_rate_percent;

        const readAllDist = resolveReadMinutes(data, "all");
        const readCriticalDist = resolveReadMinutes(data, "critical");
        const ackDist = resolveCriticalAckMinutes(data);

        const criticalReadPct = resolveCriticalCoveragePercent(data, "read");
        const criticalAckPct = resolveCriticalCoveragePercent(data, "acknowledged");

        const criticalCountLabel =
            criticalMessages > 0
                ? `${criticalMessages.toLocaleString()} critical`
                : "No critical msgs";
        const criticalVolumeInfo =
            criticalMessages > 0
                ? ` Based on ${criticalMessages.toLocaleString()} critical messages.`
                : "";

        const coverageTrend = (pct: number | null, suffix: string) => {
            if (pct == null) {
                return { type: "up" as const, value: criticalCountLabel, isPositive: true };
            }
            const isPositive = pct >= CRITICAL_COVERAGE_TARGET;
            return {
                type: isPositive ? ("up" as const) : ("down" as const),
                value: `${fmtPercent(pct)} ${suffix}`,
                isPositive,
            };
        };

        const readAllTypical = pickTypicalMinutes(readAllDist);
        const readCriticalTypical = pickTypicalMinutes(readCriticalDist);
        const ackTypical = pickTypicalMinutes(ackDist);

        const readAllSpread = spreadProps(
            readAllDist,
            "Median time to read all messages. Middle 50% fell between Q1 and Q3."
        );
        const readCriticalSpread = spreadProps(
            readCriticalDist,
            `Median time to read critical messages.${criticalVolumeInfo}`
        );
        const ackSpread = spreadProps(
            ackDist,
            `Median time to acknowledge critical messages before expiry.${criticalVolumeInfo}`
        );

        return [
            {
                title: "Median Read Time",
                value: data ? fmtMin(readAllTypical) : "—",
                subtitle: "Median time to read all messages.",
                trend: {
                    type: "up" as const,
                    value: totalMessages > 0 ? `${totalMessages.toLocaleString()} messages` : "No volume",
                    isPositive: true,
                },
                ...readAllSpread,
            },
            {
                title: "Median Read Time (Critical)",
                value: data ? fmtMin(readCriticalTypical) : "—",
                subtitle: "Median time to read critical messages.",
                trend: coverageTrend(criticalReadPct, "read"),
                ...readCriticalSpread,
            },
            {
                title: "Median Acknowledgment Time",
                value: data ? fmtMin(ackTypical) : "—",
                subtitle: "Median time to acknowledge critical messages.",
                trend: coverageTrend(criticalAckPct, "acknowledged"),
                ...ackSpread,
            },
            {
                title: "Escalation Rate",
                value:
                    data && escalationPct != null
                        ? `${num(escalationPct).toFixed(1)}%`
                        : "—",
                subtitle: "Share of critical messages that triggered an escalation.",
                trend: {
                    type: "down" as const,
                    value:
                        escalated > 0
                            ? `${escalated.toLocaleString()} escalated`
                            : "None escalated",
                    isPositive: escalated === 0,
                },
                spreadStats: [
                    {
                        label: "Critical",
                        value: criticalMessages > 0 ? criticalMessages.toLocaleString() : "—",
                    },
                    {
                        label: "Escalated",
                        value: escalated > 0 ? escalated.toLocaleString() : "0",
                    },
                    {
                        label: "Rate",
                        value:
                            escalationPct != null ? `${num(escalationPct).toFixed(1)}%` : "—",
                    },
                ],
                infoText:
                    "Percentage of critical messages that escalated. Critical = critical messages in the window; Escalated = how many of those triggered escalation.",
            },
        ];
    }, [data]);

    return (
        <div className="w-full">
            <div className="grid w-full min-w-0 grid-cols-1 items-stretch gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))] xl:grid-cols-[repeat(4,minmax(0,1fr))]">
                {kpiData.map((kpi, index) => (
                    <div
                        key={kpi.title}
                        className="min-w-0 w-full h-full min-h-0 [&>*]:min-w-0 [&>*]:w-full animate-slide-in-up"
                        style={{
                            animationDelay: `${index * 100}ms`,
                            opacity: 0,
                            animationFillMode: "forwards",
                        }}
                    >
                        <KPICard {...kpi} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default KPIGrid;
