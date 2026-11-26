"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import Text from "@/components/analytics/text";
import DashboardCard from "@/components/analytics/ugmc-dashboard/shared/dashboard-card";
import dynamic from "next/dynamic";
import { RiExpandDiagonalLine } from "react-icons/ri";
import { GrContract } from "react-icons/gr";
import InfoTooltip from "@/components/analytics/info-tooltip";
import FullscreenOverlay from "@/components/analytics/fullscreen-overlay";
import { formatDurationSeconds } from "@/lib/analytics/distribution-metrics";
import {
    type CallMetricsSlice,
    formatRoleName,
    hasAnsweredDuration,
    hasInboundOutcomes,
    hasOutboundOutcomes,
    num,
    pickTypicalSeconds,
    sortInboundDepartmentsByVolume,
    sortInboundRolesByVolume,
    sortOutboundDepartmentsByVolume,
    sortOutboundRolesByVolume,
    truncateLabel,
} from "./call-metrics-helpers";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export type CallChartDirection = "inbound" | "outbound";
export type CallChartDimension = "department" | "role";

type BarChartSeries = { name: string; data: number[] }[];

type ChartBuildResult = {
    categories: string[];
    fullNames: string[];
    series: BarChartSeries;
    chartYMax: number;
    hasOutcomes: boolean;
    summaryAnswered: number;
    summaryNegative: number;
};

function truncateCategory(name: string, max = 14): string {
    return truncateLabel(name, max);
}

function sumSeries(data: number[]): number {
    return data.reduce((sum, n) => sum + n, 0);
}

const EMPTY_CHART: ChartBuildResult = {
    categories: [],
    fullNames: [],
    series: [],
    chartYMax: 80,
    hasOutcomes: false,
    summaryAnswered: 0,
    summaryNegative: 0,
};

function buildChartData(
    callMetrics: CallMetricsSlice | undefined,
    direction: CallChartDirection,
    dimension: CallChartDimension,
    limit: number
): ChartBuildResult {
    const isOutbound = direction === "outbound";
    const isRole = dimension === "role";

    if (isOutbound) {
        const rows = isRole
            ? sortOutboundRolesByVolume(callMetrics, limit)
            : sortOutboundDepartmentsByVolume(callMetrics, limit);

        if (!rows.length) return EMPTY_CHART;

        const fullNames = isRole
            ? (rows as ReturnType<typeof sortOutboundRolesByVolume>).map((r) =>
                  formatRoleName(r.role_name)
              )
            : (rows as ReturnType<typeof sortOutboundDepartmentsByVolume>).map((d) => d.department_name);
        const categories = fullNames.map((name) => truncateCategory(name));
        const hasOutcomes = rows.some(hasOutboundOutcomes);

        if (hasOutcomes) {
            const answeredData = rows.map((r) => num(r.answered_calls));
            const unansweredData = rows.map((r) => num(r.unanswered_calls));
            const peak = Math.max(...answeredData, ...unansweredData, 0);
            return {
                categories,
                fullNames,
                chartYMax: peak <= 0 ? 80 : Math.ceil((peak * 1.15) / 10) * 10,
                hasOutcomes: true,
                summaryAnswered: sumSeries(answeredData),
                summaryNegative: sumSeries(unansweredData),
                series: [
                    { name: "Answered", data: answeredData },
                    { name: "Unanswered", data: unansweredData },
                ],
            };
        }

        const volumeData = rows.map((r) => num(r.total_calls_made));
        const peak = Math.max(...volumeData, 0);
        return {
            categories,
            fullNames,
            chartYMax: peak <= 0 ? 80 : Math.ceil((peak * 1.15) / 10) * 10,
            hasOutcomes: false,
            summaryAnswered: sumSeries(volumeData),
            summaryNegative: 0,
            series: [{ name: "Calls placed", data: volumeData }],
        };
    }

    const rows = isRole
        ? sortInboundRolesByVolume(callMetrics, limit)
        : sortInboundDepartmentsByVolume(callMetrics, limit);

    if (!rows.length) return EMPTY_CHART;

    const fullNames = isRole
        ? (rows as ReturnType<typeof sortInboundRolesByVolume>).map((r) => formatRoleName(r.role_name))
        : (rows as ReturnType<typeof sortInboundDepartmentsByVolume>).map((d) => d.department_name);
    const categories = fullNames.map((name) => truncateCategory(name));
    const answeredData = rows.map((r) => num(r.answered_calls));
    const missedData = rows.map((r) => num(r.missed_calls));
    const peak = Math.max(...answeredData, ...missedData, 0);

    return {
        categories,
        fullNames,
        chartYMax: peak <= 0 ? 80 : Math.ceil((peak * 1.15) / 10) * 10,
        hasOutcomes: rows.some(hasInboundOutcomes),
        summaryAnswered: sumSeries(answeredData),
        summaryNegative: sumSeries(missedData),
        series: [
            { name: "Answered", data: answeredData },
            { name: "Missed", data: missedData },
        ],
    };
}

export type CallOutcomeBarChartProps = {
    callMetrics?: CallMetricsSlice;
    direction: CallChartDirection;
    dimension: CallChartDimension;
    title: string;
    infoText: string;
    limit?: number;
    showLiveBadge?: boolean;
    headerExtra?: React.ReactNode;
    emptyLabel?: string;
};

const CallOutcomeBarChart: React.FC<CallOutcomeBarChartProps> = ({
    callMetrics,
    direction,
    dimension,
    title,
    infoText,
    limit = dimension === "role" ? 4 : 6,
    showLiveBadge = false,
    headerExtra,
    emptyLabel,
}) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [animatedPositive, setAnimatedPositive] = useState(0);
    const [animatedNegative, setAnimatedNegative] = useState(0);

    const isOutbound = direction === "outbound";
    const positiveLabel = "Answered";
    const negativeLabel = isOutbound ? "Unanswered" : "Missed";
    const hasAnswered = isOutbound && hasAnsweredDuration(callMetrics);
    const typicalSeconds = isOutbound ? pickTypicalSeconds(callMetrics?.answered) : null;

    const chart = useMemo(
        () => buildChartData(callMetrics, direction, dimension, limit),
        [callMetrics, direction, dimension, limit]
    );

    const positiveTotal = chart.summaryAnswered;
    const negativeTotal = chart.summaryNegative;
    const showStats =
        chart.categories.length > 0 &&
        (positiveTotal > 0 || negativeTotal > 0 || chart.series.some((s) => s.data.some((v) => v > 0)));

    useEffect(() => {
        setIsVisible(true);
    }, []);

    useEffect(() => {
        if (!isVisible) return;
        const targetPositive = showStats ? positiveTotal : 0;
        const targetNegative = showStats ? negativeTotal : 0;
        const animDuration = 1200;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / animDuration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setAnimatedPositive(Math.round(targetPositive * eased));
            setAnimatedNegative(Math.round(targetNegative * eased));
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setAnimatedPositive(targetPositive);
                setAnimatedNegative(targetNegative);
            }
        };
        requestAnimationFrame(animate);
    }, [isVisible, positiveTotal, negativeTotal, showStats]);

    useEffect(() => {
        document.body.style.overflow = isFullscreen ? "hidden" : "unset";
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isFullscreen]);

    const chartOptions: ApexCharts.ApexOptions = useMemo(
        () => ({
            chart: {
                type: "bar",
                toolbar: { show: false },
                zoom: { enabled: false },
                animations: {
                    enabled: true,
                    speed: 500,
                    animateGradually: { enabled: true, delay: 250 },
                    dynamicAnimation: { enabled: true, speed: 500 },
                },
            },
            colors:
                chart.hasOutcomes || !isOutbound
                    ? ["var(--accent-green)", "var(--accent-red)"]
                    : ["var(--accent-primary)"],
            plotOptions: {
                bar: {
                    horizontal: false,
                    columnWidth: "40px",
                    borderRadius: 4,
                    borderRadiusApplication: "end",
                },
            },
            dataLabels: { enabled: false },
            stroke: { show: true, width: 3, colors: ["transparent"] },
            xaxis: {
                categories: chart.categories,
                axisBorder: { show: false },
                axisTicks: { show: false },
                labels: {
                    rotate: 0,
                    trim: true,
                    style: {
                        colors: "var(--text-secondary)",
                        fontSize: "10px",
                        fontWeight: 500,
                        fontFamily: "system-ui, -apple-system, sans-serif",
                    },
                },
            },
            yaxis: {
                min: 0,
                max: chart.chartYMax,
                tickAmount: 4,
                labels: {
                    style: {
                        colors: "var(--text-secondary)",
                        fontSize: "10px",
                        fontWeight: 500,
                    },
                },
            },
            grid: {
                borderColor: "var(--bg-tertiary)",
                strokeDashArray: 4,
                xaxis: { lines: { show: false } },
                yaxis: { lines: { show: true } },
            },
            legend: {
                show: chart.series.length > 1 || chart.series[0]?.name !== "Calls placed",
                position: "bottom",
                horizontalAlign: "center",
                fontFamily: "system-ui, -apple-system, sans-serif",
                fontSize: "11px",
                fontWeight: 500,
                labels: { colors: "var(--text-secondary)" },
            },
            tooltip: {
                theme: "light",
                fillSeriesColor: false,
                style: { fontSize: "12px", fontFamily: "system-ui, -apple-system, sans-serif" },
                x: {
                    formatter: (_val, opts) => chart.fullNames[opts?.dataPointIndex ?? 0] ?? _val,
                },
                y: { formatter: (val) => `${val} calls` },
            },
        }),
        [chart, isOutbound]
    );

    const defaultEmpty =
        dimension === "role"
            ? "No role breakdown available for this period."
            : "No department breakdown available for this period.";

    const chartBody = (heightClass: string) => (
        <div className={`call-outcome-chart w-full min-h-[260px] ${heightClass}`}>
            {chart.categories.length > 0 ? (
                <Chart
                    options={chartOptions}
                    series={chart.series}
                    type="bar"
                    width="100%"
                    height="100%"
                />
            ) : (
                <div className="flex h-full items-center justify-center px-4">
                    <Text variant="body-sm" color="text-secondary" className="text-center">
                        {emptyLabel ?? defaultEmpty}
                    </Text>
                </div>
            )}
        </div>
    );

    const panel = (chartHeightClass: string) => (
        <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="flex items-start justify-between">
                <Text variant="body-md-semibold" color="text-primary">
                    {title}
                </Text>
                <div className="flex items-center gap-2">
                    {showLiveBadge ? (
                        <div className="flex items-center gap-1.5 rounded-[6px] bg-accent-primary/10 px-2 py-1">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-accent-primary" />
                            <Text variant="body-sm" color="none" className="text-accent-primary">
                                Live
                            </Text>
                        </div>
                    ) : null}
                    <div
                        className="flex size-[30px] cursor-pointer items-center justify-center rounded-[10px] bg-secondary transition-colors hover:bg-tertiary"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                    >
                        {isFullscreen ? (
                            <GrContract className="size-4 text-text-primary" />
                        ) : (
                            <RiExpandDiagonalLine className="size-4 text-text-primary" />
                        )}
                    </div>
                    <InfoTooltip text={infoText} show={isHovered} />
                </div>
            </div>

            {isOutbound ? (
                <div className="flex min-h-[58px] flex-wrap gap-3">
                    {hasAnswered && typicalSeconds != null ? (
                        <div className="rounded-[10px] bg-secondary px-[15px] py-[8px]">
                            <Text variant="body-sm" color="text-secondary">
                                Avg answered call duration
                            </Text>
                            <Text variant="heading-sm" color="text-primary">
                                {formatDurationSeconds(typicalSeconds)}
                            </Text>
                        </div>
                    ) : null}
                    {headerExtra}
                </div>
            ) : (
                headerExtra
            )}

            <div className="flex flex-wrap gap-3">
                <div className="flex min-w-[160px] flex-1 items-center justify-between rounded-[10px] bg-accent-green/10 px-[15px] py-[8px]">
                    <div className="flex flex-col">
                        <Text variant="body-sm" className="text-accent-green">
                            {positiveLabel}
                        </Text>
                        <span className="text-[20px] font-bold tabular-nums text-text-primary">
                            {showStats ? animatedPositive.toLocaleString() : "—"}
                        </span>
                    </div>
                </div>
                <div className="flex min-w-[160px] flex-1 items-center justify-between rounded-[10px] bg-secondary px-[15px] py-[8px]">
                    <div className="flex flex-col">
                        <Text variant="body-sm" color="text-primary">
                            {negativeLabel}
                        </Text>
                        <span className="text-[20px] font-bold tabular-nums text-text-primary">
                            {showStats ? animatedNegative.toLocaleString() : "—"}
                        </span>
                    </div>
                </div>
            </div>

            {chartBody(chartHeightClass)}
        </div>
    );

    return (
        <>
            <DashboardCard
                className="flex h-full min-h-0 min-w-[320px] flex-1 flex-col"
                padding="lg"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {panel("flex-1")}
            </DashboardCard>

            {isFullscreen ? (
                <FullscreenOverlay
                    onClose={() => setIsFullscreen(false)}
                    panelClassName="bg-transparent shadow-none p-0 w-full!"
                >
                    <DashboardCard
                        className="flex w-[80vw]! flex-col"
                        padding="lg"
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                    >
                        {panel("h-[600px]")}
                    </DashboardCard>
                </FullscreenOverlay>
            ) : null}
        </>
    );
};

export default CallOutcomeBarChart;
