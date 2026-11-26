"use client";

import * as React from "react";
import Text from "@/components/analytics/text";
import DashboardCard from "@/components/analytics/ugmc-dashboard/shared/dashboard-card";
import dynamic from "next/dynamic";
import { useState } from "react";
import InfoTooltip from "@/components/analytics/info-tooltip";
import {
    type CallMetricsSlice,
    getTopDepartments,
    num,
    truncateLabel,
} from "./call-metrics-helpers";
import { CardTitle } from "@/components/analytics/glass/illustrations";
import { glassTooltip, useCountUp } from "@/components/analytics/glass/chart-kit";

const infoText = "Distribution of outbound call volume across initiating departments.";

/** Fixed categorical order (blue, mint, amber, rose) — validated for colour-blind separation. */
const CHART_COLORS = ["#2f6fb8", "#2a9a74", "#e5a73b", "#e0656b"];

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type LegendItemProps = {
    color: string;
    bgColor: string;
    label: string;
    value: string;
};

const LegendItem: React.FC<LegendItemProps> = ({ color, bgColor, label, value }) => (
    <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
            <span
                className="w-3 h-3 rounded-[3px]"
                style={{ backgroundColor: color }}
            />
            <Text variant="body-md" color="text-secondary">
                {label}
            </Text>
        </div>
        <span
            className="px-2 py-0.5 rounded-[6px] text-[12px] font-semibold"
            style={{ backgroundColor: bgColor, color: "var(--text-primary)" }}
        >
            {value}
        </span>
    </div>
);

interface PharmacyPrescriptionProps {
    callMetrics?: CallMetricsSlice;
}

const PharmacyPrescription: React.FC<PharmacyPrescriptionProps> = ({ callMetrics }) => {
    const [isHovered, setIsHovered] = useState(false);

    const deptSlice = React.useMemo(() => getTopDepartments(callMetrics, 4), [callMetrics]);
    const chartSeries = React.useMemo(
        () => deptSlice.map((d) => num(d.total_calls_made)),
        [deptSlice]
    );
    const totalCalls = React.useMemo(
        () => chartSeries.reduce((sum, n) => sum + n, 0),
        [chartSeries]
    );
    const hasData = totalCalls > 0;

    const legendItems = React.useMemo(() => {
        return deptSlice.map((d, i) => {
            const calls = num(d.total_calls_made);
            const pct = totalCalls > 0 ? ((calls / totalCalls) * 100).toFixed(0) : "0";
            const color = CHART_COLORS[i % CHART_COLORS.length];
            return {
                color,
                bgColor: `color-mix(in srgb, ${color} 10%, transparent)`,
                label: truncateLabel(d.department_name, 20),
                value: `${calls.toLocaleString()} calls (${pct}%)`,
            };
        });
    }, [deptSlice, totalCalls]);

    const animatedTotal = Math.round(useCountUp(totalCalls, 1100));

    const chartOptions: ApexCharts.ApexOptions = React.useMemo(() => ({
        chart: { type: "donut", background: "transparent" },
        colors: CHART_COLORS.slice(0, Math.max(chartSeries.length, 1)),
        labels: deptSlice.map((d) => d.department_name),
        plotOptions: { pie: { donut: { labels: { show: false } } } },
        dataLabels: { enabled: false },
        legend: { show: false },
        tooltip: {
            fillSeriesColor: false,
            custom: ({ series, seriesIndex }: { series: number[]; seriesIndex: number }) => {
                const value = series[seriesIndex] ?? 0;
                const dept = deptSlice[seriesIndex];
                const pct = totalCalls > 0 ? `${((value / totalCalls) * 100).toFixed(0)}%` : "0%";
                return glassTooltip({
                    title: dept ? truncateLabel(dept.department_name, 36) : "Department",
                    rows: [{ color: CHART_COLORS[seriesIndex % CHART_COLORS.length], label: "Calls made", value: value.toLocaleString() }],
                    foot: `${pct} of all calls`,
                });
            },
        },
    }), [chartSeries.length, deptSlice, totalCalls]);

    const chartSeriesData = hasData ? chartSeries : [1];

    return (
        <DashboardCard data-watermark="call"
            className="flex flex-col gap-2 h-full"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <CardTitle icon="domain">
                Calls by Department
                <InfoTooltip text={infoText} show={isHovered} />
            </CardTitle>
            <div className="flex items-center justify-center flex-1 bg-accent-primary/5 rounded-[12px] py-2">
                {hasData ? (
                <div className="relative w-[240px] h-[240px]">
                    <Chart
                        options={chartOptions}
                        series={chartSeriesData}
                        type="donut"
                        width="100%"
                        height="100%"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <Text variant="heading-lg" color="text-primary" className="tabular-nums">
                            {animatedTotal.toLocaleString()}
                        </Text>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">Calls</span>
                    </div>
                </div>
                ) : (
                    <Text variant="body-sm" color="text-secondary" className="px-6 text-center">
                        No department breakdown available for this period.
                    </Text>
                )}
            </div>
            {hasData && (
            <div className="flex flex-col gap-2 mt-auto">
                {legendItems.map((item) => (
                    <LegendItem key={item.label} {...item} />
                ))}
            </div>
            )}
        </DashboardCard>
    );
};

export default PharmacyPrescription;
