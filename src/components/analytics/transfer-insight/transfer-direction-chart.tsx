"use client";

import dynamic from "next/dynamic";
import Text from "@/components/analytics/text";
import DashboardCard from "@/components/analytics/safety-reports/dashboard-card";
import type { TransferMetricsData } from "@/lib/analytics/transfer-metrics";
import { baseChartOptions } from "./chart-theme";

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
        colors: ["#2980D3", "#00C8B3"],
        labels: ["Inbound", "Outbound"],
        plotOptions: {
            pie: {
                donut: {
                    size: "72%",
                    labels: {
                        show: true,
                        name: { fontFamily: "system-ui, -apple-system, sans-serif", fontSize: "11px" },
                        value: {
                            fontFamily: "system-ui, -apple-system, sans-serif",
                            fontSize: "18px",
                            fontWeight: 700,
                            formatter: (val) => String(val),
                        },
                        total: {
                            show: true,
                            label: "Total",
                            fontFamily: "system-ui, -apple-system, sans-serif",
                            fontSize: "11px",
                            color: "var(--text-secondary)",
                            formatter: () => String(total),
                        },
                    },
                },
            },
        },
        legend: {
            show: true,
            position: "bottom",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: "11px",
            labels: { colors: "var(--text-secondary)" },
        },
        stroke: { width: 0 },
    };

    return (
        <DashboardCard className="flex h-full flex-col gap-3" padding="lg">
            <div className="flex flex-col gap-[2px]">
                <Text variant="body-md-semibold" color="text-primary" className="font-bold">
                    Transfer Direction
                </Text>
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
                    <Chart options={options} series={[inbound, outbound]} type="donut" width="100%" height={220} />
                )}
            </div>
        </DashboardCard>
    );
};

export default TransferDirectionChart;
