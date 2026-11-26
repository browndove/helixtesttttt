"use client";

import * as React from "react";
import Text from "@/components/analytics/text";
import DashboardCard from "@/components/analytics/ugmc-dashboard/shared/dashboard-card";
import {
    formatMinutes,
    pickTypicalMinutes,
    resolveCriticalAckMinutes,
    resolveReadMinutes,
    typicalMinutesRange,
} from "@/lib/analytics/distribution-metrics";

const ClockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

function pickNum(obj: Record<string, unknown> | undefined, ...keys: string[]): number | undefined {
    if (!obj) return undefined;
    for (const k of keys) {
        const v = obj[k];
        if (v === null || v === undefined) continue;
        const n = typeof v === "string" ? parseFloat(v) : Number(v);
        if (Number.isFinite(n)) return n;
    }
    return undefined;
}

function fmtMin(minutes: number | null | undefined): string {
    if (minutes == null) return "—";
    return formatMinutes(minutes);
}

type ResponseMetric = { name: string; description: string; value: string };

const SubscriptionSpend: React.FC<{ data?: Record<string, unknown> }> = ({ data }) => {
    const root = (data?.data && typeof data.data === "object" && !Array.isArray(data.data)
        ? (data.data as Record<string, unknown>)
        : data) as Record<string, unknown> | undefined;

    const ackDist = resolveCriticalAckMinutes(root);
    const readAllDist = resolveReadMinutes(root, "all");
    const readCriticalDist = resolveReadMinutes(root, "critical");
    const readStandardDist = resolveReadMinutes(root, "standard");
    const calls = pickNum(root, "total_calls_made");

    const ackTypical = pickTypicalMinutes(ackDist);
    const readAllTypical = pickTypicalMinutes(readAllDist);
    const readCriticalTypical = pickTypicalMinutes(readCriticalDist);
    const readStandardTypical = pickTypicalMinutes(readStandardDist);

    const responseMetrics: ResponseMetric[] = React.useMemo(
        () => [
            {
                name: "Typical Critical Acknowledgment",
                description: "Median time to acknowledge critical messages",
                value: fmtMin(ackTypical),
            },
            {
                name: "Typical Read Time (All)",
                description: readAllDist
                    ? `Most reads between ${typicalMinutesRange(readAllDist.q1_minutes, readAllDist.q3_minutes)}`
                    : "Median time to read all messages",
                value: fmtMin(readAllTypical),
            },
            {
                name: "Typical Read Time (Critical)",
                description: readCriticalDist
                    ? `Most reads between ${typicalMinutesRange(readCriticalDist.q1_minutes, readCriticalDist.q3_minutes)}`
                    : "Median time to read critical messages",
                value: fmtMin(readCriticalTypical),
            },
            {
                name: "Typical Read Time (Standard)",
                description: readStandardDist
                    ? `Most reads between ${typicalMinutesRange(readStandardDist.q1_minutes, readStandardDist.q3_minutes)}`
                    : "Median time to read non-critical messages",
                value: fmtMin(readStandardTypical),
            },
            {
                name: "Total Calls Made",
                description: "Voice calls initiated in the period",
                value: calls !== undefined ? String(Math.round(calls)) : "—",
            },
        ],
        [
            ackTypical,
            readAllTypical,
            readCriticalTypical,
            readStandardTypical,
            readAllDist,
            readCriticalDist,
            readStandardDist,
            calls,
        ]
    );

    const insight = React.useMemo(() => {
        if (ackTypical != null && readAllTypical != null) {
            const ackRange = ackDist
                ? typicalMinutesRange(ackDist.q1_minutes, ackDist.q3_minutes)
                : "—";
            return `Median critical ack is ${fmtMin(ackTypical)}${ackRange !== "—" ? ` (usual ${ackRange})` : ""}. Median read time is ${fmtMin(readAllTypical)}.`;
        }
        return "Response times reflect messaging activity in the selected date range.";
    }, [ackTypical, readAllTypical, ackDist]);

    return (
        <DashboardCard className="flex flex-col flex-1" padding="none" style={{ padding: 20, gap: 12, height: 680 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Text variant="body-md-semibold" color="text-primary" className="font-bold">Response Time by Priority</Text>
                    <Text variant="body-sm" color="text-secondary">Median times · current window</Text>
                </div>
            </div>
            <div className="bg-secondary rounded-[10px] flex flex-col items-center" style={{ padding: 12, gap: 8 }}>
                <Text variant="body-md-semibold" color="text-secondary">Typical Critical Acknowledgment</Text>
                <span className="text-[32px] font-bold text-[#2980D3] tabular-nums">{fmtMin(ackTypical)}</span>
            </div>
            <div className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {responseMetrics.map((metric, index) => (
                    <React.Fragment key={metric.name}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <Text variant="body-md-semibold" color="text-primary">{metric.name}</Text>
                                <div className="bg-tertiary border border-tertiary rounded-[4px] w-fit text-[#587081]" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
                                    <ClockIcon />
                                    <Text variant="body-sm" color="text-secondary" className="font-medium whitespace-nowrap">{metric.description}</Text>
                                </div>
                            </div>
                            <div className="rounded-[4px] bg-accent-primary/10 shrink-0" style={{ padding: '4px 8px' }}>
                                <Text variant="body-sm-semibold" color="accent-primary" className="tabular-nums">{metric.value}</Text>
                            </div>
                        </div>
                        {index < responseMetrics.length - 1 && <div className="border-t border-tertiary" />}
                    </React.Fragment>
                ))}
            </div>
            <div className="bg-[#2980D31A] border border-[#2980D333] rounded-[10px]" style={{ padding: 10 }}>
                <Text variant="body-md" color="none" style={{ color: "#2980D3" }} className="font-medium">
                    {insight}
                </Text>
            </div>
        </DashboardCard>
    );
};

export default SubscriptionSpend;
