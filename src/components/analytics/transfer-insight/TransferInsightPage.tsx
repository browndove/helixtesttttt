"use client";

import { useMemo } from "react";
import { KPICard } from "@/components/analytics/safety-reports";
import type { TransferMetricsData } from "@/lib/analytics/transfer-metrics";
import { acceptanceRatePercent, windowLabel } from "@/lib/analytics/transfer-metrics";
import {
    TransferStatusChart,
    TransferDirectionChart,
    TransferByFacilityChart,
    TransferByRoleChart,
} from "@/components/analytics/transfer-insight";

export type TransferInsightPageProps = {
    data: TransferMetricsData | null;
    loading?: boolean;
};

const TransferInsightPage = ({ data, loading = false }: TransferInsightPageProps) => {
    const periodLabel = data ? windowLabel(data) : "Selected period";
    const acceptanceRate = data ? acceptanceRatePercent(data) : 0;

    const kpiData = useMemo(() => {
        const total = data?.total_transfer_requests ?? 0;
        const outbound = data?.transfer_requests_outbound ?? 0;
        const inbound = data?.transfer_requests_inbound ?? 0;
        const pending = data?.transfer_requests_pending ?? 0;

        return [
            {
                title: "Total Requests",
                value: loading ? "0" : String(total),
                subtitle: periodLabel,
                infoText: "All transfer requests in the selected date range.",
            },
            {
                title: "Pending",
                value: loading ? "0" : String(pending),
                subtitle: "Awaiting action",
                trend:
                    pending > 0
                        ? { type: "up" as const, value: String(pending), isPositive: false }
                        : undefined,
                infoText: "Requests not yet accepted or declined.",
            },
            {
                title: "Accepted",
                value: loading ? "0" : String(data?.transfer_requests_accepted ?? 0),
                subtitle: loading ? "…" : `${acceptanceRate.toFixed(1)}% of total`,
                trend:
                    acceptanceRate > 0
                        ? { type: "up" as const, value: `${acceptanceRate.toFixed(1)}%`, isPositive: true }
                        : undefined,
                infoText: "Requests marked accepted in this period.",
            },
            {
                title: "Outbound",
                value: loading ? "0" : String(outbound),
                subtitle: inbound > 0 ? `${inbound} inbound` : "Sent",
                infoText: "Transfer requests sent to other facilities. Inbound vs outbound breakdown is in the chart below.",
            },
        ];
    }, [data, loading, periodLabel, acceptanceRate]);

    return (
        <div className="flex flex-1 flex-col">
            <div className="flex w-full flex-col gap-[15px]">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {kpiData.map((kpi, index) => (
                        <div
                            key={kpi.title}
                            className="animate-slide-in-up"
                            style={{ animationDelay: `${index * 100}ms`, opacity: 0, animationFillMode: "forwards" }}
                        >
                            <KPICard {...kpi} />
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
                    <div
                        className="animate-slide-in-up"
                        style={{ animationDelay: "200ms", opacity: 0, animationFillMode: "forwards" }}
                    >
                        <TransferStatusChart data={data} loading={loading} />
                    </div>
                    <div
                        className="animate-slide-in-up"
                        style={{ animationDelay: "300ms", opacity: 0, animationFillMode: "forwards" }}
                    >
                        <TransferDirectionChart data={data} loading={loading} />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div
                        className="animate-slide-in-up"
                        style={{ animationDelay: "400ms", opacity: 0, animationFillMode: "forwards" }}
                    >
                        <TransferByFacilityChart data={data} loading={loading} />
                    </div>
                    <div
                        className="animate-slide-in-up"
                        style={{ animationDelay: "500ms", opacity: 0, animationFillMode: "forwards" }}
                    >
                        <TransferByRoleChart data={data} loading={loading} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TransferInsightPage;
