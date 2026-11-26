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
import { CardTitle } from "@/components/analytics/glass/illustrations";
import { Callout, Meter, Pill, RowIcon, type Tone } from "@/components/analytics/glass/ui";

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

type ResponseMetric = { name: string; description: string; value: string; minutes: number | null; icon: string; tone: Tone };

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
                name: "Read time · all messages",
                description: readAllDist
                    ? `Most reads ${typicalMinutesRange(readAllDist.q1_minutes, readAllDist.q3_minutes)}`
                    : "Median time to read any message",
                value: fmtMin(readAllTypical),
                minutes: readAllTypical,
                icon: "mark_email_read",
                tone: "blue",
            },
            {
                name: "Read time · critical",
                description: readCriticalDist
                    ? `Most reads ${typicalMinutesRange(readCriticalDist.q1_minutes, readCriticalDist.q3_minutes)}`
                    : "Median time to read critical messages",
                value: fmtMin(readCriticalTypical),
                minutes: readCriticalTypical,
                icon: "priority_high",
                tone: "rose",
            },
            {
                name: "Read time · standard",
                description: readStandardDist
                    ? `Most reads ${typicalMinutesRange(readStandardDist.q1_minutes, readStandardDist.q3_minutes)}`
                    : "Median time to read non-critical messages",
                value: fmtMin(readStandardTypical),
                minutes: readStandardTypical,
                icon: "drafts",
                tone: "slate",
            },
            {
                name: "Calls made",
                description: "Voice calls started in the period",
                value: calls !== undefined ? Math.round(calls).toLocaleString() : "—",
                minutes: null,
                icon: "call",
                tone: "amber",
            },
        ],
        [readAllTypical, readCriticalTypical, readStandardTypical, readAllDist, readCriticalDist, readStandardDist, calls]
    );
    const slowest = Math.max(1, ...responseMetrics.map((m) => m.minutes ?? 0));

    const insight = React.useMemo(() => {
        if (ackTypical != null && readAllTypical != null) {
            const ackRange = ackDist
                ? typicalMinutesRange(ackDist.q1_minutes, ackDist.q3_minutes)
                : "—";
            return `Median critical ack is ${fmtMin(ackTypical)}${ackRange !== "—" ? ` (usual ${ackRange})` : ""}. Median read time is ${fmtMin(readAllTypical)}.`;
        }
        return "Response times reflect messaging activity in the selected date range.";
    }, [ackTypical, readAllTypical, ackDist]);

    const ackRange = ackDist ? typicalMinutesRange(ackDist.q1_minutes, ackDist.q3_minutes) : null;

    return (
        <DashboardCard data-watermark="speed" className="flex flex-col flex-1" padding="none" style={{ padding: 20, gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <CardTitle icon="timer" variant="body-md-semibold" className="font-bold">Response Time by Priority</CardTitle>
                <Text variant="body-sm" color="text-secondary">Median times · current window</Text>
            </div>

            <div className="an-hero">
                <span className="an-hero__icon" aria-hidden><span className="material-icons-round">task_alt</span></span>
                <div className="flex min-w-0 flex-col">
                    <span className="an-hero__label">Critical acknowledgment</span>
                    <span className="an-hero__value">{fmtMin(ackTypical)}</span>
                    {ackRange && ackRange !== "—" && <span className="an-hero__sub">Usually {ackRange}</span>}
                </div>
            </div>

            <div className="an-list flex-1">
                {responseMetrics.map((metric) => (
                    <div key={metric.name} className="an-row">
                        <RowIcon icon={metric.icon} tone={metric.tone} />
                        <div className="an-row__main">
                            <div className="flex items-center justify-between gap-2">
                                <span className="an-row__title">{metric.name}</span>
                                <Pill tone={metric.tone}>{metric.value}</Pill>
                            </div>
                            {metric.minutes != null && <Meter pct={(metric.minutes / slowest) * 100} tone={metric.tone} />}
                            <span className="an-row__sub">{metric.description}</span>
                        </div>
                    </div>
                ))}
            </div>

            <Callout icon="insights">{insight}</Callout>
        </DashboardCard>
    );
};

export default SubscriptionSpend;
