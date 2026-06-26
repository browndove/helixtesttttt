"use client";

import * as React from "react";
import { useState } from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });
import { RiExpandDiagonalLine } from "react-icons/ri";
import { GrContract } from "react-icons/gr";
import InfoTooltip from "@/components/info-tooltip";

const infoText = "Current and historical Emergency Department patient volume analyzed by arrival hour.";

const EDVolumeByHour: React.FC = () => {
    const { resolvedTheme } = useTheme();
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const chartHeight = isFullscreen ? 450 : 220;

    const chartOptions: ApexCharts.ApexOptions = {
        chart: {
            type: "bar",
            toolbar: { show: false },
            fontFamily: "Montserrat, sans-serif",
            stacked: false,
        },
        plotOptions: {
            bar: {
                borderRadius: 4,
                borderRadiusApplication: "end",
                columnWidth: "60%",
            },
        },
        colors: ["#00C8B3", "#FF5F57"],
        dataLabels: { enabled: false },
        stroke: {
            show: true,
            width: 2,
            colors: ["transparent"],
        },
        xaxis: {
            categories: ["00", "04", "08", "12", "16", "20"],
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: {
                style: {
                    colors: "var(--text-secondary)",
                    fontSize: "11px",
                    fontWeight: 500,
                },
            },
        },
        yaxis: {
            min: 0,
            max: 80,
            tickAmount: 4,
            labels: {
                style: {
                    colors: "var(--text-secondary)",
                    fontSize: "11px",
                },
            },
        },
        grid: {
            borderColor: "var(--bg-tertiary)",
            strokeDashArray: 4,
            yaxis: { lines: { show: true } },
            xaxis: { lines: { show: false } },
        },
        tooltip: {
            theme: resolvedTheme === "dark" || resolvedTheme === "blue" ? "dark" : "light",
            style: {
                fontSize: '12px',
                fontFamily: 'Montserrat',
            },
            y: {
                formatter: (value: number) => `${value} patients`,
            },
        },
        legend: { show: false },
    };

    const chartSeries = [
        {
            name: "Total",
            data: [32, 58, 45, 62, 38, 55],
        },
        {
            name: "Critical",
            data: [8, 12, 6, 10, 5, 15],
        },
    ];

    return (
        <DashboardCard
            className={`flex flex-col gap-2 transition-all duration-300 ${isFullscreen ? "fixed inset-0 z-50 m-4 h-[calc(100vh-2rem)] w-[calc(100vw-2rem)]" : ""
                }`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex shrink-0 items-start justify-between">
                <div className="flex flex-col gap-0.5">
                    <Text variant="body-md-semibold" color="text-primary">
                        ED Volume by Hour
                    </Text>
                    <Text variant="body-sm" color="text-tertiary">
                        Today&apos;s patient arrivals
                    </Text>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-accent-primary/10 px-3 py-1 rounded-[8px]">
                        <span className="w-2 h-2 rounded-full bg-accent-primary animate-pulse" />
                        <Text variant="body-sm-semibold" color="none" className="text-accent-primary">
                            Live
                        </Text>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            className="flex items-center justify-center size-[30px] bg-secondary rounded-[10px] cursor-pointer hover:bg-tertiary transition-colors"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                        >
                            {isFullscreen ? (
                                <GrContract className="size-4 text-text-primary" />
                            ) : (
                                <RiExpandDiagonalLine className="size-4 text-text-primary" />
                            )}
                        </button>
                        <InfoTooltip text={infoText} show={isHovered} />
                    </div>
                </div>
            </div>

            <div className="w-full">
                <Chart
                    options={chartOptions}
                    series={chartSeries}
                    type="bar"
                    height={chartHeight}
                    width="100%"
                />
            </div>

            {/* Legend */}
            <div className="flex shrink-0 items-center justify-center gap-6 pt-2">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-[3px] bg-[#00C8B3]" />
                    <Text variant="body-sm" color="text-secondary">
                        Total
                    </Text>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-[3px] bg-[#FF5F57]" />
                    <Text variant="body-sm" color="text-secondary">
                        Critical
                    </Text>
                </div>
            </div>
        </DashboardCard>
    );
};

export default EDVolumeByHour;

