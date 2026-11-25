'use client';

import { useEffect, useMemo, useRef } from "react";
import Text from "@/components/analytics/text";
import InfoTooltip from "@/components/analytics/info-tooltip";
import dynamic from "next/dynamic";
import { RiExpandDiagonalLine } from "react-icons/ri";
import { GrContract } from "react-icons/gr";
import clsx from "clsx";
import FullscreenOverlay from "@/components/analytics/fullscreen-overlay";
import { fillDailyMessageVolumePeriod } from "@/lib/analytics/daily-volume";
import { CardTitle } from "@/components/analytics/glass/illustrations";
import { barSheen, barWidth, glassTooltip } from "@/components/analytics/glass/chart-kit";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const infoText = "Weekly trend of critical vs standard message volumes showing communication patterns over the last 7 days.";

export interface DailyVolumeItem {
    day: string;
    total_messages: number;
    critical_messages: number;
    standard_messages: number;
}

interface DailyPatientFlowProps {
    isFullscreen?: boolean;
    onToggleFullscreen?: () => void;
    dailyVolume?: DailyVolumeItem[];
}

/** Compute a nice round y-axis max that divides evenly into `ticks` intervals */
function niceMax(rawMax: number, ticks: number): number {
    if (rawMax <= 0) return ticks;
    const rawStep = rawMax / ticks;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const residual = rawStep / magnitude;
    let niceStep: number;
    if (residual <= 1) niceStep = 1 * magnitude;
    else if (residual <= 2) niceStep = 2 * magnitude;
    else if (residual <= 5) niceStep = 5 * magnitude;
    else niceStep = 10 * magnitude;
    return niceStep * ticks;
}

const TICK_COUNT = 5;

const DailyPatientFlow = ({ isFullscreen = false, onToggleFullscreen, dailyVolume = [] }: DailyPatientFlowProps) => {
    const hasMounted = useRef(false);

    useEffect(() => { hasMounted.current = true; }, []);

    // Always last 7 calendar days (zeros when a day had no messages)
    const volKey = JSON.stringify(dailyVolume);
    const last7 = useMemo(
        () => fillDailyMessageVolumePeriod(dailyVolume, 7),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [volKey]
    );
    const dayLabels = useMemo(
        () =>
            last7.map((d) => {
                const date = new Date(`${d.day}T12:00:00`);
                return date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
            }),
        [last7]
    );

    const stackedMax = useMemo(() => {
        return Math.max(
            ...last7.map((d) => d.standard_messages + d.critical_messages),
            1
        );
    }, [last7]);

    const yAxisMax = useMemo(() => niceMax(stackedMax, TICK_COUNT), [stackedMax]);

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

    const chartOptions: ApexCharts.ApexOptions = useMemo(() => ({
        chart: {
            type: "bar" as const,
            stacked: true,
            toolbar: { show: false },
            zoom: { enabled: false },
            parentHeightOffset: 0,
            redrawOnParentResize: true,
            animations: {
                enabled: !hasMounted.current,
                speed: 800,
                dynamicAnimation: { enabled: false },
            },
        },
        colors: ["#2f6fb8", "#e0656b"],
        plotOptions: {
            bar: {
                borderRadius: 6,
                borderRadiusApplication: "end" as const,
                borderRadiusWhenStacked: "last" as const,
                columnWidth: barWidth(dayLabels.length),
            },
        },
        fill: barSheen(),
        // Surface gap between the stacked segments
        stroke: { show: true, width: 2, colors: ["rgba(255,255,255,0.95)"] },
        dataLabels: { enabled: false },
        xaxis: {
            categories: dayLabels,
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: {
                style: {
                    fontSize: "11px",
                },
            },
        },
        yaxis: {
            min: 0,
            max: yAxisMax,
            tickAmount: TICK_COUNT,
            labels: {
                formatter: (val: number) => Math.round(val).toString(),
                style: {
                    fontSize: "11px",
                },
            },
        },
        grid: { padding: { top: 4, right: 8, bottom: 2, left: 14 } },
        legend: { show: false },
        tooltip: {
            custom: ({ series, dataPointIndex }: { series: number[][]; dataPointIndex: number }) => {
                const standard = Number(series[0]?.[dataPointIndex] ?? 0);
                const critical = Number(series[1]?.[dataPointIndex] ?? 0);
                return glassTooltip({
                    title: dayLabels[dataPointIndex] ?? "",
                    rows: [
                        { color: "#2f6fb8", label: "Standard", value: standard.toLocaleString() },
                        { color: "#e0656b", label: "Critical", value: critical.toLocaleString() },
                    ],
                    foot: `${(standard + critical).toLocaleString()} messages in total`,
                });
            },
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [volKey, yAxisMax]);

    const chartSeries = useMemo(() => [
        {
            name: "Standard",
            data: last7.map(d => d.standard_messages),
        },
        {
            name: "Critical",
            data: last7.map(d => d.critical_messages),
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [volKey]);

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
            <div data-watermark="insights"
                className={clsx(
                    "group bg-primary rounded-[18px] border border-black/[0.08] flex min-w-0 w-full flex-col gap-0 overflow-hidden",
                    "transition-all duration-500",
                    !isFullscreen && ""
                )}
                style={cardPadding}
            >
                {/* Header */}
                <div className="flex justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <CardTitle icon="show_chart" variant="body-md-semibold">Message Trends</CardTitle>
                        <Text variant="body-sm" color="text-secondary">
                            Critical vs standard messages — last 7 days
                        </Text>
                    </div>
                    <div className="flex items-center gap-2.5">
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
                        <InfoTooltip text={infoText} />
                    </div>
                </div>

                {/* Chart — inline padding so inset survives Apex + flex parents */}
                <div
                    className="min-w-0 w-full h-[220px] min-[900px]:h-[260px] overflow-hidden"
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
                        type="bar"
                        width="100%"
                        height="100%"
                    />
                </div>

                {/* Legend — horizontal inset from card inline padding only */}
                <div
                    className="flex items-center justify-center gap-5"
                    style={{
                        boxSizing: "border-box",
                        paddingTop: 14,
                        paddingLeft: 0,
                        paddingRight: 0,
                        paddingBottom: 0,
                    }}
                >
                    <div className={clsx(
                        "flex items-center gap-1.5 px-2 py-1 rounded-md",
                        "transition-all duration-300 cursor-default",
                        "hover:bg-accent-primary/10"
                    )}>
                        <div className={clsx(
                            "size-2.5 rounded-sm bg-accent-primary",
                            "transition-transform duration-300",
                            "group-hover:scale-125"
                        )} />
                        <Text variant="body-sm" color="text-primary">Standard</Text>
                    </div>
                    <div className={clsx(
                        "flex items-center gap-1.5 px-2 py-1 rounded-md",
                        "transition-all duration-300 cursor-default",
                        "hover:bg-accent-red/10"
                    )}>
                        <div className={clsx(
                            "size-2.5 rounded-sm bg-accent-red",
                            "transition-transform duration-300",
                            "group-hover:scale-125"
                        )} />
                        <Text variant="body-sm" color="text-primary">Critical</Text>
                    </div>
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

export default DailyPatientFlow;
