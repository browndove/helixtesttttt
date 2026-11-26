"use client";

import { useState, useEffect, useMemo } from "react";
import Text from "@/components/analytics/text";
import InfoTooltip from "@/components/analytics/info-tooltip";
import Dropdown from "@/components/analytics/dropdown";
import dynamic from "next/dynamic";
import { RiExpandDiagonalLine } from "react-icons/ri";
import { GrContract } from "react-icons/gr";
import { useTheme } from "next-themes";
import clsx from "clsx";
import FullscreenOverlay from "@/components/analytics/fullscreen-overlay";
import { buildNiceYAxisScale } from "@/lib/analytics/nice-chart-axis";
import {
    fillDailyMessageVolumePeriod,
    type DailyMessageVolumePoint,
} from "@/lib/analytics/daily-volume";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const infoText =
    "Daily message volume for the selected period. Total messages and critical rate match the days shown in the chart; the critical count is how many of those messages were marked critical.";

export type DailyMessageVolumeItem = DailyMessageVolumePoint;

const periodOptions = [
    { value: "7d", label: "7 Days" },
    { value: "14d", label: "14 Days" },
    { value: "30d", label: "30 Days" },
];

function formatCount(n: number): string {
    if (!Number.isFinite(n)) return "0";
    if (n >= 1000) {
        const k = n / 1000;
        return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
    }
    return Math.round(n).toLocaleString();
}

function periodPlainLabel(period: string): string {
    if (period === "14d") return "14 days";
    if (period === "30d") return "30 days";
    return "7 days";
}

interface RevenueChartProps {
    isFullscreen?: boolean;
    onToggleFullscreen?: () => void;
    isHovered?: boolean;
    dailyVolume?: DailyMessageVolumeItem[];
}

const RevenueChart = ({
    isFullscreen = false,
    onToggleFullscreen,
    isHovered = false,
    dailyVolume = [],
}: RevenueChartProps) => {
    const { resolvedTheme } = useTheme();
    const [period, setPeriod] = useState("7d");

    // Prevent body scroll when fullscreen
    useEffect(() => {
        if (isFullscreen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isFullscreen]);

    // Always render a continuous calendar window (zeros for quiet days)
    const periodDays = period === "30d" ? 30 : period === "14d" ? 14 : 7;
    const volKey = JSON.stringify(dailyVolume);
    const sliced = useMemo(
        () => fillDailyMessageVolumePeriod(dailyVolume, periodDays),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [volKey, periodDays]
    );
    const categories = sliced.map((d) => {
        const date = new Date(`${d.day}T12:00:00`);
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    });

    const seriesMax = useMemo(() => {
        return Math.max(...sliced.map((d) => d.total_messages), 0);
    }, [sliced]);

    const yAxisScale = useMemo(() => buildNiceYAxisScale(seriesMax, 5), [seriesMax]);

    // Limit visible x-axis labels
    const tickAmount = periodDays <= 7 ? undefined : periodDays <= 14 ? 7 : 6;
    const totalData = sliced.map((d) => d.total_messages);

    const periodTotals = useMemo(() => {
        const total = sliced.reduce((sum, d) => sum + d.total_messages, 0);
        const critical = sliced.reduce((sum, d) => sum + d.critical_messages, 0);
        const rate = total > 0 ? (critical / total) * 100 : 0;
        return { total, critical, rate };
    }, [sliced]);

    // Always mirror the chart window so the summary matches what people see plotted.
    const displayTotal = periodTotals.total;
    const displayCriticalRate = periodTotals.rate;
    const periodLabel = periodPlainLabel(period);

    const chartOptions: ApexCharts.ApexOptions = {
        chart: {
            type: "area",
            toolbar: { show: false },
            zoom: { enabled: false },
            parentHeightOffset: 0,
            redrawOnParentResize: true,
            animations: {
                enabled: true,
                speed: 800,
            },
        },
        colors: ["#2980D3"],
        fill: {
            type: "gradient",
            gradient: {
                shade: "light",
                type: "vertical",
                shadeIntensity: 0.3,
                gradientToColors: ["#2980D3"],
                inverseColors: false,
                opacityFrom: 0.4,
                opacityTo: 0.05,
                stops: [0, 100],
            },
        },
        stroke: {
            curve: "smooth",
            width: 3,
            colors: ["#2980D3"],
        },
        markers: {
            size: periodDays <= 7 ? 5 : periodDays <= 14 ? 3 : 0,
            colors: ["#2980D3"],
            strokeColors: "#FFFFFF",
            strokeWidth: 2,
            hover: {
                size: 7,
            },
        },
        dataLabels: { enabled: false },
        xaxis: {
            categories,
            axisBorder: { show: false },
            axisTicks: { show: false },
            tickAmount,
            labels: {
                rotate: 0,
                hideOverlappingLabels: true,
                style: {
                    colors: "var(--text-secondary)",
                    fontSize: "12px",
                    fontWeight: 500,
                    fontFamily: "system-ui, -apple-system, sans-serif",
                },
            },
        },
        yaxis: {
            min: 0,
            max: yAxisScale.max,
            tickAmount: yAxisScale.tickAmount,
            forceNiceScale: false,
            decimalsInFloat: 0,
            labels: {
                style: {
                    colors: "var(--text-secondary)",
                    fontSize: "12px",
                    fontWeight: 500,
                    fontFamily: "system-ui, -apple-system, sans-serif",
                },
                formatter: (val) => {
                    const step = yAxisScale.step;
                    const snapped = Math.round(val / step) * step;
                    if (snapped > yAxisScale.max || Math.abs(val - snapped) > step * 0.01) {
                        return "";
                    }
                    return snapped >= 1000
                        ? `${(snapped / 1000).toFixed(snapped % 1000 === 0 ? 0 : 1)}k`
                        : String(snapped);
                },
            },
        },
        grid: {
            show: true,
            borderColor: "var(--bg-tertiary)",
            strokeDashArray: 5,
            padding: {
                top: 6,
                right: 10,
                bottom: 4,
                left: 12,
            },
            xaxis: {
                lines: { show: true },
            },
            yaxis: {
                lines: { show: true },
            },
        },
        tooltip: {
            theme: resolvedTheme === "dark" || resolvedTheme === "blue" ? "dark" : "light",
            style: {
                fontFamily: "system-ui, -apple-system, sans-serif",
            },
            y: {
                formatter: (val) => `${val.toLocaleString()} messages`,
            },
        },
    };

    const chartSeries = [
        {
            name: "Total Messages",
            data: totalData,
        },
    ];

    const ChartContent = ({
        width,
        height
    }: {
        width?: string;
        height?: string;
    }) => {
        const cardPadding = isFullscreen
            ? { padding: 16, boxSizing: "border-box" as const }
            : { padding: "20px 24px 24px", boxSizing: "border-box" as const };

        return (
            <div
                className={clsx(
                    "bg-primary rounded-[18px] border border-black/[0.08] flex min-w-0 w-full flex-col gap-0 overflow-hidden",
                    "transition-all duration-500",
                    isHovered && !isFullscreen && "border-black/[0.14]"
                )}
                style={cardPadding}
            >
                {/* Header */}
                <div className="flex justify-between gap-3">
                    <Text variant="body-md-semibold" color="text-primary">
                        Daily Message Volume
                    </Text>
                    <div className="flex items-center gap-2.5">
                        {/* Period Dropdown */}
                        <Dropdown
                            options={periodOptions}
                            value={period}
                            onChange={setPeriod}
                            triggerClassName="!h-[36px] !px-3.5 !rounded-full border border-black/[0.08]"
                        />
                        {/* Expand/Contract button */}
                        {onToggleFullscreen && (
                            <div
                                className={clsx(
                                    "flex items-center justify-center size-[30px] bg-tertiary rounded-[10px] cursor-pointer",
                                    "transition-all duration-300",
                                    "hover:bg-quaternary hover:scale-110"
                                )}
                                onClick={onToggleFullscreen}
                            >
                                {isFullscreen ? (
                                    <GrContract className="size-4 text-text-primary" />
                                ) : (
                                    <RiExpandDiagonalLine className="size-4 text-text-primary" />
                                )}
                            </div>
                        )}
                        <InfoTooltip text={infoText} show={isHovered} />
                    </div>
                </div>

                {/* Summary for the selected chart period */}
                <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
                    <div className="min-w-0">
                        <div className="text-[11px] font-medium tracking-[-0.01em] text-text-secondary">
                            Total messages · {periodLabel}
                        </div>
                        <div className="mt-0.5 text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-text-primary">
                            {formatCount(displayTotal)}
                        </div>
                    </div>
                    <div className="h-8 w-px self-center bg-black/[0.08]" aria-hidden />
                    <div className="min-w-0">
                        <div className="text-[11px] font-medium tracking-[-0.01em] text-text-secondary">
                            Critical share · {periodLabel}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                            <span className="text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-text-primary">
                                {displayCriticalRate.toFixed(1)}%
                            </span>
                            <span className="text-[11px] text-text-tertiary tabular-nums">
                                {periodTotals.critical > 0
                                    ? `${formatCount(periodTotals.critical)} of ${formatCount(displayTotal)} messages were critical`
                                    : `No critical messages in these ${periodLabel}`}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Chart — inline padding so horizontal inset is always applied (Apex + flex parents) */}
                <div
                    className="min-w-0 w-full h-[240px] min-[900px]:h-[280px] overflow-hidden"
                    style={{
                        boxSizing: "border-box",
                        paddingTop: 12,
                        paddingLeft: 0,
                        paddingRight: 0,
                        paddingBottom: 0,
                        width: width ?? "100%",
                        height: height ?? undefined,
                    }}
                >
                    <Chart
                        options={chartOptions}
                        series={chartSeries}
                        type="area"
                        width="100%"
                        height="100%"
                    />
                </div>
            </div>
        )
    }

    return (
        <>
            <ChartContent />
            {
                isFullscreen && onToggleFullscreen && (
                    <FullscreenOverlay
                        onClose={onToggleFullscreen}
                        panelClassName="bg-transparent shadow-none p-0 w-fit!"
                    >
                        <ChartContent height="60vh" />
                    </FullscreenOverlay>
                )
            }
        </>
    )
};

export default RevenueChart;
