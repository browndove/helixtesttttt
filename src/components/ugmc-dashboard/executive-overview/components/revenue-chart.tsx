"use client";

import { useState, useEffect, useMemo } from "react";
import Text from "@/components/text";
import InfoTooltip from "@/components/info-tooltip";
import Dropdown from "@/components/dropdown";
import dynamic from "next/dynamic";
import { RiExpandDiagonalLine } from "react-icons/ri";
import { GrContract } from "react-icons/gr";
import { useTheme } from "next-themes";
import clsx from "clsx";
import FullscreenOverlay from "@/components/fullscreen-overlay";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const infoText = "Daily message volume breakdown showing total, critical, and standard messages over the selected time period.";

export interface DailyMessageVolumeItem {
    day: string;
    total_messages: number;
    critical_messages: number;
    standard_messages: number;
}

const periodOptions = [
    { value: "7d", label: "7 Days" },
    { value: "14d", label: "14 Days" },
    { value: "30d", label: "30 Days" },
];

interface RevenueChartProps {
    isFullscreen?: boolean;
    onToggleFullscreen?: () => void;
    isHovered?: boolean;
    dailyVolume?: DailyMessageVolumeItem[];
}

const RevenueChart = ({ isFullscreen = false, onToggleFullscreen, isHovered = false, dailyVolume = [] }: RevenueChartProps) => {
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

    // Slice daily volume based on selected period
    const periodDays = period === "30d" ? 30 : period === "14d" ? 14 : 7;
    const volKey = JSON.stringify(dailyVolume);
    const sliced = useMemo(() => dailyVolume.slice(-periodDays),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [volKey, periodDays]
    );
    const categories = sliced.map(d => {
        const date = new Date(d.day);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    // Limit visible x-axis labels
    const tickAmount = periodDays <= 7 ? undefined : periodDays <= 14 ? 7 : 6;
    const totalData = sliced.map(d => d.total_messages);

    const chartOptions: ApexCharts.ApexOptions = {
        chart: {
            type: "area",
            toolbar: { show: false },
            zoom: { enabled: false },
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
                    fontFamily: "Montserrat",
                },
            },
        },
        yaxis: {
            min: 0,
            labels: {
                style: {
                    colors: "var(--text-secondary)",
                    fontSize: "12px",
                    fontWeight: 500,
                    fontFamily: "Montserrat",
                },
                formatter: (val) => val >= 1000 ? `${val / 1000}k` : `${val}`,
            },
        },
        grid: {
            show: true,
            borderColor: "var(--bg-tertiary)",
            strokeDashArray: 5,
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
                fontFamily: "Montserrat",
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
        return (
            <div
                className={clsx(
                    "bg-primary rounded-[15px] shadow-soft flex flex-col gap-0 w-full",
                    "transition-all duration-500",
                    isHovered && !isFullscreen && "shadow-[0_8px_30px_rgba(41,128,211,0.12)]"
                )}
            >
                {/* Header */}
                <div className="flex justify-between" style={{ padding: '24px 24px 0 24px' }}>
                    <Text variant="body-md-semibold" color="text-primary">
                        Daily Message Volume
                    </Text>
                    <div className="flex items-center gap-2.5">
                        {/* Period Dropdown */}
                        <Dropdown
                            options={periodOptions}
                            value={period}
                            onChange={setPeriod}
                            triggerClassName="!h-[33px] !px-2.5 !rounded-[10px] border border-tertiary !shadow-input"
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

                {/* Chart */}
                <div
                    className="w-full"
                    style={{
                        padding: '0 24px',
                        width,
                        height: height || 330
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
