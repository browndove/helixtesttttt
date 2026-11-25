"use client";

import { TransferKpis } from "@/components/analytics/glass/AnalyticsKpis";
import type { TransferMetricsData } from "@/lib/analytics/transfer-metrics";
import { windowLabel } from "@/lib/analytics/transfer-metrics";
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

    return (
        <div className="flex flex-1 flex-col">
            <div className="flex w-full flex-col gap-[15px]">
                <TransferKpis data={data} loading={loading} periodLabel={periodLabel} />

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
