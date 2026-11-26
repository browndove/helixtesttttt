"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Text from "@/components/analytics/text";
import DashboardCard from "@/components/analytics/safety-reports/dashboard-card";
import type { TransferMetricsData } from "@/lib/analytics/transfer-metrics";
import {
    baseChartOptions,
    formatRoleChartLabel,
    ROLE_CHART_BAR_COLOR,
    roleChartAxisStyle,
    roleChartLabelStyle,
    TRANSFER_ROLE_TOP_N,
} from "./chart-theme";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type TransferByRoleChartProps = {
    data: TransferMetricsData | null;
    loading?: boolean;
};

const TransferByRoleChart = ({ data, loading }: TransferByRoleChartProps) => {
    const totalRoles = data?.transfer_by_role?.length ?? 0;

    const rows = React.useMemo(() => {
        const list = [...(data?.transfer_by_role ?? [])];
        list.sort((a, b) => b.total_transfer_requests - a.total_transfer_requests);
        return list.slice(0, TRANSFER_ROLE_TOP_N);
    }, [data]);

    const categories = rows.map((r) => formatRoleChartLabel(r.role_name));
    const fullRoleNames = rows.map((r) => r.role_name);
    const values = rows.map((r) => r.total_transfer_requests);
    const max = Math.max(...values, 1);

    const options: ApexCharts.ApexOptions = {
        ...baseChartOptions,
        chart: { ...baseChartOptions.chart, type: "bar" },
        colors: [ROLE_CHART_BAR_COLOR],
        plotOptions: {
            bar: {
                horizontal: true,
                borderRadius: 8,
                barHeight: "62%",
            },
        },
        xaxis: {
            categories,
            labels: {
                style: roleChartLabelStyle,
                offsetY: 4,
            },
        },
        yaxis: {
            max,
            tickAmount: 4,
            labels: { style: roleChartAxisStyle },
        },
        legend: { show: false },
        tooltip: {
            ...baseChartOptions.tooltip,
            custom: ({ dataPointIndex }) => {
                const value = values[dataPointIndex] ?? 0;
                const role = fullRoleNames[dataPointIndex] ?? categories[dataPointIndex] ?? "";
                return `<div class="px-2 py-1.5 text-xs" style="font-family:system-ui,-apple-system,sans-serif">
                    <div style="font-weight:600;margin-bottom:2px">${role}</div>
                    <div>${value} request${value === 1 ? "" : "s"}</div>
                </div>`;
            },
        },
    };

    return (
        <DashboardCard className="flex h-full flex-col gap-4" padding="lg">
            <div className="flex flex-col gap-[2px]">
                <Text variant="body-md-semibold" color="text-primary" className="font-bold">
                    Transfers by Role
                </Text>
                <Text variant="body-sm" color="text-secondary">
                    {totalRoles > TRANSFER_ROLE_TOP_N
                        ? `Top ${TRANSFER_ROLE_TOP_N} requesting roles · Selected period`
                        : "Requesting roles · Selected period"}
                </Text>
            </div>
            {loading ? (
                <div className="flex h-[200px] items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
                </div>
            ) : rows.length === 0 ? (
                <Text variant="body-sm" color="text-tertiary" className="py-12 text-center">
                    No role breakdown in this period
                </Text>
            ) : (
                <div className="h-[200px] min-h-0 flex-1">
                    <Chart
                        options={options}
                        series={[{ name: "Requests", data: values }]}
                        type="bar"
                        width="100%"
                        height="100%"
                    />
                </div>
            )}
        </DashboardCard>
    );
};

export default TransferByRoleChart;
