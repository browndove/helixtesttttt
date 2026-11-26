"use client";

import { useMemo } from "react";
import { normalizeCallMetricsFromUsage } from "@/lib/analytics/call-metrics";
import {
    formatDurationSeconds,
    pickTypicalSeconds,
    typicalSecondsRange,
} from "@/lib/analytics/distribution-metrics";
import {
    formatRoleName,
    getCallSummary,
    getTopOutboundRole,
    hasAnsweredDuration,
    truncateLabel,
} from "./call-metrics-helpers";
import SubscriptionCard from "./subscription-card";

export type CallKpiInput = {
    total_calls_made?: number;
    call_metrics?: Record<string, unknown>;
    role_metrics?: { role_name?: string; total_calls_made?: number }[];
};

const CallKPIRow = ({ data }: { data?: CallKpiInput }) => {
    const cards = useMemo(() => {
        const callMetrics = normalizeCallMetricsFromUsage(data);
        const { total, answered, unanswered, answerRate, hasCallData } = getCallSummary(callMetrics);
        const displayTotal = callMetrics?.total_calls_made ?? data?.total_calls_made ?? total;
        const hasAnswered = hasAnsweredDuration(callMetrics);
        const answeredSpread = callMetrics?.answered;
        const typicalSeconds = pickTypicalSeconds(answeredSpread);

        const topOutbound = getTopOutboundRole(callMetrics);
        const topRoleFromMetrics = data?.role_metrics?.reduce<{ name: string; calls: number } | null>(
            (best, r) => {
                const calls = Number(r.total_calls_made) || 0;
                if (calls <= 0) return best;
                const name = formatRoleName(String(r.role_name || "").trim());
                if (!name) return best;
                if (!best || calls > best.calls) return { name, calls };
                return best;
            },
            null
        );
        const topRole = topOutbound
            ? {
                  name: formatRoleName(topOutbound.role_name),
                  calls: Number(topOutbound.total_calls_made) || 0,
              }
            : topRoleFromMetrics;

        return [
            {
                badge: "TC",
                badgeColor: "purple" as const,
                title: "Total Calls Placed",
                provider: hasCallData ? "Facility call volume" : "Across all roles",
                amount: data != null ? String(displayTotal) : undefined,
                displayValue: data == null ? "—" : undefined,
                footerLabel: "Answered",
                footerValue:
                    hasCallData && answered > 0
                        ? `${answered.toLocaleString()} calls`
                        : hasCallData
                          ? "None"
                          : "—",
                infoText: "All call sessions started in the selected period.",
            },
            {
                badge: "AD",
                badgeColor: "teal" as const,
                title: "Avg Call Duration",
                provider: hasAnswered ? "Typical answered call" : "Answered sessions only",
                displayValue:
                    hasAnswered && typicalSeconds != null
                        ? formatDurationSeconds(typicalSeconds)
                        : "—",
                footerLabel: "Typical range",
                footerValue: hasAnswered
                    ? typicalSecondsRange(
                          Number(answeredSpread?.q1_duration_seconds) || 0,
                          Number(answeredSpread?.q3_duration_seconds) || 0
                      )
                    : "Not available",
                infoText:
                    "Median duration of answered calls. Middle 50% lasted between Q1 and Q3.",
            },
            {
                badge: "AR",
                badgeColor: "coral" as const,
                title: "Answer Rate",
                provider: "Outbound sessions — answered vs unanswered",
                displayValue:
                    answerRate != null && hasCallData ? `${answerRate.toFixed(1)}%` : "—",
                footerLabel: "Unanswered (outbound)",
                footerValue:
                    hasCallData && unanswered > 0
                        ? `${unanswered.toLocaleString()} calls`
                        : hasCallData
                          ? "None"
                          : "Not available",
                infoText:
                    "Share of resolved calls that connected. Still-ringing calls are excluded from the denominator.",
            },
            {
                badge: "TR",
                badgeColor: "green" as const,
                title: "Top Calling Role",
                provider: topRole ? truncateLabel(topRole.name) : "No role data",
                amount: topRole ? String(topRole.calls) : undefined,
                displayValue: topRole ? undefined : "—",
                footerLabel: "Outbound volume",
                footerValue: topRole ? `${topRole.calls.toLocaleString()} calls placed` : "—",
                infoText: "Role with the highest outbound call volume in this period.",
            },
        ];
    }, [data]);

    return (
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card, index) => (
                <div
                    key={card.title}
                    className="animate-slide-in-up"
                    style={{
                        animationDelay: `${index * 100}ms`,
                        opacity: 0,
                        animationFillMode: "forwards",
                    }}
                >
                    <SubscriptionCard
                        badge={card.badge}
                        badgeColor={card.badgeColor}
                        title={card.title}
                        provider={card.provider}
                        amount={card.amount}
                        displayValue={card.displayValue}
                        footerLabel={card.footerLabel}
                        footerValue={card.footerValue}
                        infoText={card.infoText}
                    />
                </div>
            ))}
        </div>
    );
};

export default CallKPIRow;
