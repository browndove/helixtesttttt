"use client";

import * as React from "react";
import Text from "@/components/analytics/text";
import DashboardCard from "@/components/analytics/safety-reports/dashboard-card";
import { RiExpandDiagonalLine } from "react-icons/ri";
import { GrContract } from "react-icons/gr";
import type { TransferMetricsData } from "@/lib/analytics/transfer-metrics";
import { TRANSFER_FACILITY_TOP_N } from "./chart-theme";
import { CardTitle } from "@/components/analytics/glass/illustrations";

type TransferByFacilityChartProps = {
    data: TransferMetricsData | null;
    loading?: boolean;
};

const TransferByFacilityChart = ({ data, loading }: TransferByFacilityChartProps) => {
    const [isMaximized, setIsMaximized] = React.useState(false);
    const [animatedBars, setAnimatedBars] = React.useState<number[]>([]);
    const [animatedTotal, setAnimatedTotal] = React.useState(0);
    const [isVisible, setIsVisible] = React.useState(false);

    const rows = React.useMemo(() => {
        const list = [...(data?.transfer_by_counterparty_facility ?? [])];
        list.sort((a, b) => b.total_transfer_requests - a.total_transfer_requests);
        return list.slice(0, TRANSFER_FACILITY_TOP_N);
    }, [data]);

    const total = rows.reduce((sum, r) => sum + r.total_transfer_requests, 0);
    const maxValue = Math.max(...rows.map((r) => r.total_transfer_requests), 1);
    const xAxisTicks = React.useMemo(
        () =>
            [
                ...new Set([
                    0,
                    Math.ceil(maxValue / 4),
                    Math.ceil(maxValue / 2),
                    Math.ceil((3 * maxValue) / 4),
                    maxValue,
                ]),
            ],
        [maxValue]
    );

    React.useEffect(() => {
        setIsVisible(true);
    }, []);

    React.useEffect(() => {
        if (!isVisible || loading) return;
        const duration = 2200;
        const start = Date.now();

        const animate = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setAnimatedBars(rows.map((r) => (r.total_transfer_requests / maxValue) * 100 * eased));
            setAnimatedTotal(Math.round(total * eased));
            if (progress < 1) requestAnimationFrame(animate);
            else {
                setAnimatedBars(rows.map((r) => (r.total_transfer_requests / maxValue) * 100));
                setAnimatedTotal(total);
            }
        };
        requestAnimationFrame(animate);
    }, [isVisible, loading, rows, total, maxValue]);

    const chartContent = (isModal: boolean) => (
        <>
            <div className="flex items-start justify-between">
                <div className="flex flex-col gap-[2px]">
                    <CardTitle icon="apartment" variant={isModal ? "body-lg-semibold" : "body-md-semibold"} className="font-bold">Transfers by Facility</CardTitle>
                    <Text variant="body-sm" color="text-secondary">
                        Counterparty facilities · Selected period
                    </Text>
                </div>
                <div className="flex items-center gap-[10px]">
                    <div className="rounded-[5px] bg-[#2f6fb81A] px-[7px] py-[4px]">
                        <Text variant="body-sm-semibold" color="none" className="text-[#2f6fb8]">
                            <span className="tabular-nums">{animatedTotal}</span> Total
                        </Text>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsMaximized(!isModal)}
                        className="flex size-[30px] cursor-pointer items-center justify-center rounded-[10px] bg-secondary transition-colors hover:bg-tertiary"
                        title={isModal ? "Close" : "Maximize"}
                    >
                        {isModal ? (
                            <GrContract className="size-4 text-text-primary" />
                        ) : (
                            <RiExpandDiagonalLine className="size-4 text-text-primary" />
                        )}
                    </button>
                </div>
            </div>
            {loading ? (
                <div className="flex flex-1 items-center justify-center py-16">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
                </div>
            ) : rows.length === 0 ? (
                <Text variant="body-sm" color="text-tertiary" className="py-12 text-center">
                    No counterparty transfers in this period
                </Text>
            ) : (
                <>
                    <div className="flex flex-1 flex-col gap-[18px]">
                        {rows.map((item, index) => (
                            <div key={item.counterparty_facility_id || `${index}-${item.counterparty_facility_name}`} className="flex items-center gap-[10px]">
                                <Text variant="body-xs" color="text-tertiary" className="w-[100px] shrink-0 truncate" title={item.counterparty_facility_name}>
                                    {item.counterparty_facility_name}
                                </Text>
                                <div className="h-[25px] flex-1 overflow-hidden rounded-[5px] bg-tertiary">
                                    <div
                                        className="h-full rounded-l-[5px] rounded-r-full transition-all duration-100"
                                        style={{
                                            width: `${animatedBars[index] || 0}%`,
                                            background: "linear-gradient(90deg, #2f6fb8 0%, #4aa3d8 100%)",
                                        }}
                                    />
                                </div>
                                <Text variant="body-xs" color="text-secondary" className="w-8 shrink-0 text-right tabular-nums">
                                    {item.total_transfer_requests}
                                </Text>
                            </div>
                        ))}
                    </div>
                    <div className="ml-[110px] flex justify-between pr-8">
                        {xAxisTicks.map((val, index) => (
                            <Text key={`axis-tick-${index}`} variant="body-xs" color="text-tertiary">
                                {val}
                            </Text>
                        ))}
                    </div>
                </>
            )}
        </>
    );

    return (
        <>
            <DashboardCard data-watermark="local_hospital" className="flex h-full flex-col gap-[15px]" padding="lg">
                {chartContent(false)}
            </DashboardCard>
            {isMaximized && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
                    onClick={() => setIsMaximized(false)}
                    role="presentation"
                >
                    <div
                        className="flex max-h-[90vh] w-full max-w-5xl flex-col gap-[15px] overflow-auto rounded-[20px] bg-primary p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {chartContent(true)}
                    </div>
                </div>
            )}
        </>
    );
};

export default TransferByFacilityChart;
