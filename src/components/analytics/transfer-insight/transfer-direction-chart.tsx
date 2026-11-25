"use client";

import dynamic from "next/dynamic";
import Text from "@/components/analytics/text";
import DashboardCard from "@/components/analytics/safety-reports/dashboard-card";
import type { TransferMetricsData } from "@/lib/analytics/transfer-metrics";
import { baseChartOptions } from "./chart-theme";
import { CardTitle } from "@/components/analytics/glass/illustrations";
import { glassTooltip } from "@/components/analytics/glass/chart-kit";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type TransferDirectionChartProps = {
    data: TransferMetricsData | null;
    loading?: boolean;
};

const TransferDirectionChart = ({ data, loading }: TransferDirectionChartProps) => {
    const inbound = data?.transfer_requests_inbound ?? 0;
    const outbound = data?.transfer_requests_outbound ?? 0;
    const total = inbound + outbound;

    const options: ApexCharts.ApexOptions = {
        ...baseChartOptions,
        chart: { ...baseChartOptions.chart, type: "donut" },
        colors: ["#2f6fb8", "#2a9a74"],
        labels: ["Inbound", "Outbound"],
        plotOptions: {
            pie: {
                donut: {
                    labels: {
                        show: true,
                        name: { fontSize: "11px", fontWeight: 600, color: "#7b879b", offsetY: 18 },
                        value: { fontSize: "24px", fontWeight: 700, color: "#1b2a44", offsetY: -14, formatter: (val) => Number(val).toLocaleString() },
                        total: {
                            show: true,
                            showAlways: true,
                            label: "TOTAL",
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "#7b879b",
                            formatter: () => total.toLocaleString(),
                        },
                    },
                },
            },
        },
        legend: { show: true, position: "bottom" },
        tooltip: {
            fillSeriesColor: false,
            custom: ({ series, seriesIndex }: { series: number[]; seriesIndex: number }) => {
                const value = series[seriesIndex] ?? 0;
                const label = seriesIndex === 0 ? "Inbound" : "Outbound";
                return glassTooltip({
                    title: label,
                    rows: [{ color: seriesIndex === 0 ? "#2f6fb8" : "#2a9a74", label: "Requests", value: value.toLocaleString() }],
                    foot: total > 0 ? `${Math.round((value / total) * 100)}% of all transfers` : undefined,
                });
            },
        },
    };

    return (
        <DashboardCard data-watermark="airport_shuttle" className="flex h-full flex-col gap-3" padding="lg">
            <div className="flex flex-col gap-[2px]">
                <CardTitle icon="swap_horiz" variant="body-md-semibold" className="font-bold">Transfer Direction</CardTitle>
                <Text variant="body-sm" color="text-secondary">
                    Inbound vs outbound · Selected period
                </Text>
            </div>
            <div className="flex min-h-[220px] flex-1 items-center justify-center">
                {loading ? (
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
                ) : total === 0 ? (
                    <Text variant="body-sm" color="text-tertiary">
                        No transfer requests in this period
                    </Text>
                ) : (
                    <Chart options={options} series={[inbound, outbound]} type="donut" width="100%" height={240} />
                )}
            </div>
        </DashboardCard>
    );
};

export default TransferDirectionChart;
