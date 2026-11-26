"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Text from "@/components/analytics/text";
import DashboardCard from "@/components/analytics/safety-reports/dashboard-card";
import { RiExpandDiagonalLine } from "react-icons/ri";
import { GrContract } from "react-icons/gr";
import type { TransferMetricsData } from "@/lib/analytics/transfer-metrics";
import { baseChartOptions, chartLabelStyle } from "./chart-theme";

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
        colors: ["#00C8B3", "#FF5F57", "#FFCA57"],
        plotOptions: {
            bar: {
                borderRadius: 4,
                borderRadiusApplication: "end",
                columnWidth: "45%",
                distributed: true,
            },
        },
        xaxis: {
            categories: ["Accepted", "Declined", "Pending"],
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: { style: chartLabelStyle },
        },
        yaxis: {
            min: 0,
            max: Math.max(max, 4),
            tickAmount: 4,
            labels: {
                style: chartLabelStyle,
                formatter: (val) => Math.round(val).toString(),
            },
        },
        legend: { show: false },
        tooltip: {
            ...baseChartOptions.tooltip,
            y: { formatter: (val) => `${val} requests` },
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
                    <Text variant={isModal ? "body-lg-semibold" : "body-md-semibold"} color="text-primary" className="font-bold">
                        Request Status
                    </Text>
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
            <DashboardCard className="flex flex-col gap-[15px]" padding="lg">
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
