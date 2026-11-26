"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Text from "@/components/analytics/text";
import DashboardCard from "@/components/analytics/safety-reports/dashboard-card";
import { RiExpandDiagonalLine } from "react-icons/ri";
import { GrContract } from "react-icons/gr";
import type { TransferMetricsData } from "@/lib/analytics/transfer-metrics";
import { baseChartOptions, chartLabelStyle } from "./chart-theme";
import { CardTitle } from "@/components/analytics/glass/illustrations";
import { barSheen, glassTooltip } from "@/components/analytics/glass/chart-kit";

const STATUS = [
    { label: "Accepted", color: "#2a9a74" },
    { label: "Declined", color: "#e0656b" },
    { label: "Pending", color: "#e5a73b" },
];

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type TransferStatusChartProps = {
    data: TransferMetricsData | null;
    loading?: boolean;
};

function buildOptions(isModal: boolean, max: number): ApexCharts.ApexOptions {
    return {
        ...baseChartOptions,
        chart: {
            ...baseChartOptions.chart,
            type: "bar",
            height: isModal ? 500 : 280,
        },
        colors: STATUS.map((s) => s.color),
        fill: barSheen(),
        plotOptions: {
            bar: {
                borderRadius: 8,
                borderRadiusApplication: "end",
                columnWidth: isModal ? "64px" : "44px",
                distributed: true,
                dataLabels: { position: "top" },
                colors: { backgroundBarColors: ["rgba(27,42,68,0.035)"], backgroundBarRadius: 8 },
            },
        },
        dataLabels: {
            enabled: true,
            offsetY: -22,
            formatter: (val: number) => Math.round(val).toLocaleString(),
            style: { fontSize: "13px", fontWeight: 700, colors: ["#1b2a44"] },
        },
        xaxis: {
            categories: STATUS.map((s) => s.label),
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: { style: { ...chartLabelStyle, fontSize: "12px", fontWeight: 600 } },
        },
        yaxis: {
            min: 0,
            max: Math.max(Math.ceil((max * 1.15) / 4) * 4, 4),
            tickAmount: 4,
            labels: {
                style: chartLabelStyle,
                formatter: (val) => Math.round(val).toString(),
            },
        },
        legend: { show: false },
        tooltip: {
            custom: ({ series, dataPointIndex }: { series: number[][]; dataPointIndex: number }) => {
                const values = STATUS.map((_, i) => Number(series[0]?.[i] ?? 0));
                const total = values.reduce((a, b) => a + b, 0);
                const value = values[dataPointIndex] ?? 0;
                return glassTooltip({
                    title: STATUS[dataPointIndex]?.label ?? "",
                    rows: [{ color: STATUS[dataPointIndex]?.color, label: "Requests", value: value.toLocaleString() }],
                    foot: total > 0 ? `${Math.round((value / total) * 100)}% of all requests` : undefined,
                });
            },
        },
    };
}

const TransferStatusChart = ({ data, loading }: TransferStatusChartProps) => {
    const [isMaximized, setIsMaximized] = React.useState(false);

    const accepted = data?.transfer_requests_accepted ?? 0;
    const declined = data?.transfer_requests_declined ?? 0;
    const pending = data?.transfer_requests_pending ?? 0;
    const max = Math.max(accepted, declined, pending, 1);
    const series = [{ name: "Requests", data: [accepted, declined, pending] }];

    const chartContent = (isModal: boolean) => (
        <>
            <div className="flex items-start justify-between">
                <div className="flex flex-col gap-[2px]">
                    <CardTitle icon="fact_check" variant={isModal ? "body-lg-semibold" : "body-md-semibold"} className="font-bold">Request Status</CardTitle>
                    <Text variant="body-sm" color="text-secondary">
                        Accepted, declined, and pending · Selected period
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
            {loading ? (
                <div className="flex h-[280px] items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
                </div>
            ) : (
                <div className={isModal ? "h-[500px]" : "h-[280px]"}>
                    <Chart options={buildOptions(isModal, max)} series={series} type="bar" width="100%" height="100%" />
                </div>
            )}
        </>
    );

    return (
        <>
            <DashboardCard data-watermark="local_hospital" className="flex flex-col gap-[15px]" padding="lg">
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

export default TransferStatusChart;
