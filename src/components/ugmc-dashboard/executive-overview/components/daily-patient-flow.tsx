'use client';

import { useState, useEffect, useMemo } from "react";
import Text from "@/components/text";
import InfoTooltip from "@/components/info-tooltip";
import dynamic from "next/dynamic";
import { RiExpandDiagonalLine } from "react-icons/ri";
import { GrContract } from "react-icons/gr";
import { useTheme } from "next-themes";
import clsx from "clsx";
import FullscreenOverlay from "@/components/fullscreen-overlay";

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

const DailyPatientFlow = ({ isFullscreen = false, onToggleFullscreen, dailyVolume = [] }: DailyPatientFlowProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const { resolvedTheme } = useTheme();
    // Take last 7 days
    const volKey = JSON.stringify(dailyVolume);
    const last7 = useMemo(() => dailyVolume.slice(-7),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [volKey]
    );
    const dayLabels = last7.map(d => {
        const date = new Date(d.day);
        return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    });

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

    const chartOptions: ApexCharts.ApexOptions = {
        chart: {
            type: "bar",
            stacked: true,
            toolbar: { show: false },
            zoom: { enabled: false },
            animations: {
                enabled: true,
                speed: 800,
            },
        },
        colors: ["#2980D3", "#FF5F57"],
        plotOptions: {
            bar: {
                borderRadius: 10,
                borderRadiusApplication: "end",
                borderRadiusWhenStacked: "last",
                columnWidth: "50%",
            },
        },
        dataLabels: { enabled: false },
        xaxis: {
            categories: dayLabels,
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: {
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
            tickAmount: 5,
            labels: {
                style: {
                    colors: "var(--text-secondary)",
                    fontSize: "12px",
                    fontWeight: 500,
                    fontFamily: "Montserrat",
                },
            },
        },
        grid: {
            show: true,
            borderColor: "var(--bg-tertiary)",
            strokeDashArray: 5,
            xaxis: {
                lines: { show: false },
            },
            yaxis: {
                lines: { show: true },
            },
        },
        legend: {
            show: false,
        },
        tooltip: {
            theme: resolvedTheme === "dark" || resolvedTheme === "blue" ? "dark" : "light",
            style: {
                fontSize: '12px',
                fontFamily: "Montserrat",
            },
            y: {
                formatter: (val) => `${val} messages`,
            },
        },
    };

    const chartSeries = [
        {
            name: "Standard",
            data: last7.map(d => d.standard_messages),
        },
        {
            name: "Critical",
            data: last7.map(d => d.critical_messages),
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
                    "bg-primary rounded-[15px] shadow-soft flex flex-col gap-4 w-full",
                    "transition-all duration-500",
                    isHovered && !isFullscreen && "shadow-[0_8px_30px_rgba(0,0,0,0.1)]"
                )}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Header */}
                <div className="flex justify-between" style={{ padding: '24px 24px 0 24px' }}>
                    <div className="flex flex-col gap-1">
                        <Text variant="body-md-semibold" color="text-primary">
                            Message Trends
                        </Text>
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
                        <InfoTooltip text={infoText} show={isHovered} />
                    </div>
                </div>

                {/* Chart */}
                <div
                    className="w-full h-[300px]"
                    style={{
                        padding: '0 24px',
                        width,
                        height
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

                {/* Legend with hover effects */}
                <div className="flex items-center justify-center gap-5">
                    <div className={clsx(
                        "flex items-center gap-1.5 px-2 py-1 rounded-md",
                        "transition-all duration-300 cursor-default",
                        "hover:bg-accent-primary/10"
                    )}>
                        <div className={clsx(
                            "size-2.5 rounded-sm bg-accent-primary",
                            "transition-transform duration-300",
                            isHovered && "scale-125"
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
                            isHovered && "scale-125"
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
