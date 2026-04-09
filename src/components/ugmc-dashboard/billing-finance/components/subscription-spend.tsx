"use client";

import * as React from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";

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

function fmtMin(minutes: number | undefined | null): string {
    if (minutes === null || minutes === undefined) return "—";
    const m = Number(minutes);
    if (!Number.isFinite(m) || m < 0) return "—";
    if (m === 0) return "0 min";
    if (m < 1) return "<1 min";
    if (m < 60) return `${Math.round(m)} min`;
    const h = Math.floor(m / 60);
    const min = Math.round(m % 60);
    return min > 0 ? `${h}h ${min}m` : `${h}h`;
}

type ResponseMetric = { name: string; description: string; value: string };

const SubscriptionSpend: React.FC<{ data?: Record<string, unknown> }> = ({ data }) => {
    const root = (data?.data && typeof data.data === "object" && !Array.isArray(data.data)
        ? (data.data as Record<string, unknown>)
        : data) as Record<string, unknown> | undefined;

    const ack = pickNum(root, "avg_critical_ack_minutes");
    const replyAll = pickNum(root, "avg_reply_response_minutes_all", "avg_first_read_minutes_all");
    const replyCritical = pickNum(root, "avg_reply_response_minutes_critical", "avg_first_read_minutes_critical");
    const replyStandard = pickNum(
        root,
        "avg_reply_response_minutes_non_critical",
        "avg_first_read_minutes_non_critical"
    );
    const calls = pickNum(root, "total_calls_made");

    const responseMetrics: ResponseMetric[] = React.useMemo(
        () => [
            {
                name: "Average Critical Acknowledgment Time",
                description: "Time to acknowledge critical messages",
                value: fmtMin(ack),
            },
            {
                name: "Average Reply Time (All)",
                description: "Average first reply across all messages",
                value: fmtMin(replyAll),
            },
            {
                name: "Average Reply Time (Critical)",
                description: "Average first reply to critical messages",
                value: fmtMin(replyCritical),
            },
            {
                name: "Average Reply Time (Standard)",
                description: "Average first reply to non-critical messages",
                value: fmtMin(replyStandard),
            },
            {
                name: "Total Calls Made",
                description: "Voice calls initiated in the period",
                value: calls !== undefined ? String(Math.round(calls)) : "—",
            },
        ],
        [ack, replyAll, replyCritical, replyStandard, calls]
    );

    const insight = React.useMemo(() => {
        const a = ack ?? NaN;
        const s = replyStandard ?? NaN;
        const all = replyAll ?? NaN;
        if (Number.isFinite(a) && a > 0 && Number.isFinite(s) && s > 0 && s > a * 1.5) {
            return `Critical message acknowledgement averages ${fmtMin(a)}. Standard replies average ${fmtMin(s)}.`;
        }
        if (Number.isFinite(a) && a > 0 && Number.isFinite(all) && all > 0) {
            return `Critical acknowledgement averages ${fmtMin(a)}; overall reply time is ${fmtMin(all)}.`;
        }
        return "Response times reflect messaging activity in the selected date range.";
    }, [ack, replyStandard, replyAll]);

    return (
        <DashboardCard className="flex flex-col flex-1" padding="none" style={{ padding: 20, gap: 12, height: 680 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Text variant="body-md-semibold" color="text-primary" className="font-bold">Response Time by Priority</Text>
                    <Text variant="body-sm" color="text-secondary">Facility averages · current window</Text>
                </div>
            </div>
            <div className="bg-secondary rounded-[10px] flex flex-col items-center" style={{ padding: 12, gap: 8 }}>
                <Text variant="body-md-semibold" color="text-secondary">Average Critical Acknowledgment</Text>
                <span className="text-[32px] font-bold text-[#2980D3] tabular-nums">{fmtMin(ack)}</span>
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
