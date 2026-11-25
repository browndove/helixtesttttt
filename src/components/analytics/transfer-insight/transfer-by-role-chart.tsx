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
import { CardTitle } from "@/components/analytics/glass/illustrations";
import { shortRoleName } from "@/lib/analytics/role-name";
import { barSheen, glassTooltip, trackBars } from "@/components/analytics/glass/chart-kit";

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

    const categories = rows.map((r) => formatRoleChartLabel(shortRoleName(r.role_name), 30));
    const fullRoleNames = rows.map((r) => r.role_name);
    const values = rows.map((r) => r.total_transfer_requests);
    const max = Math.max(...values, 1);

    const options: ApexCharts.ApexOptions = {
        ...baseChartOptions,
        chart: { ...baseChartOptions.chart, type: "bar" },
        colors: [ROLE_CHART_BAR_COLOR],
        fill: barSheen(true),
        plotOptions: {
            bar: {
                horizontal: true,
                borderRadius: 7,
                borderRadiusApplication: "end",
                barHeight: rows.length <= 2 ? "40%" : "52%",
                dataLabels: { position: "top" },
                colors: { backgroundBarColors: trackBars(ROLE_CHART_BAR_COLOR), backgroundBarRadius: 7 },
            },
        },
        dataLabels: {
            enabled: true,
            textAnchor: "start",
            offsetX: 10,
            formatter: (val: number) => Math.round(val).toLocaleString(),
            style: { fontSize: "12px", fontWeight: 700, colors: ["#1b2a44"] },
        },
        xaxis: {
            categories,
            min: 0,
            max: Math.max(Math.ceil((max * 1.15) / 4) * 4, 4),
            tickAmount: 4,
            labels: { style: roleChartAxisStyle, formatter: (val: string) => String(Math.round(Number(val))) },
        },
        yaxis: {
            labels: { style: roleChartLabelStyle, maxWidth: 180 },
        },
        grid: { xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } }, padding: { right: 28 } },
        legend: { show: false },
        tooltip: {
            custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
                const value = values[dataPointIndex] ?? 0;
                return glassTooltip({
                    title: fullRoleNames[dataPointIndex] ?? categories[dataPointIndex] ?? "",
                    rows: [{ color: ROLE_CHART_BAR_COLOR, label: "Transfer requests", value: value.toLocaleString() }],
                });
            },
        },
    };

    return (
        <DashboardCard data-watermark="swap_horiz" className="flex h-full flex-col gap-4" padding="lg">
            <div className="flex flex-col gap-[2px]">
                <CardTitle icon="badge" variant="body-md-semibold" className="font-bold">Transfers by Role</CardTitle>
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
