"use client";

import * as React from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });
import { useState } from "react";
import { RiExpandDiagonalLine } from "react-icons/ri";
import { GrContract } from "react-icons/gr";
import InfoTooltip from "@/components/info-tooltip";

const infoText = "Average time patients wait for an inpatient bed after decision to admit.";

const AverageBoardingTime: React.FC = () => {
    const { resolvedTheme } = useTheme();
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const chartOptions: ApexCharts.ApexOptions = {
        chart: {
            type: "bar",
            toolbar: { show: false },
            fontFamily: "Montserrat, sans-serif",

        },
        plotOptions: {
            bar: {
                borderRadius: 6,
                borderRadiusApplication: "end",
                columnWidth: "50%",
            },
        },
        colors: ["#2980D3"],
        dataLabels: { enabled: false },
        xaxis: {
            categories: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
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
            max: 100,
            tickAmount: 5,
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
                formatter: (value: number) => `${value} min`,
            },
        },
        legend: { show: false },
    };

    const chartSeries = [
        {
            name: "Boarding Time",
            data: [78, 45, 68, 52, 38, 62, 48],
        },
    ];

    return (
        <DashboardCard
            className={`flex flex-col gap-2 transition-all duration-300 ${isFullscreen ? "fixed inset-0 z-50 m-4 h-[calc(100vh-2rem)] w-[calc(100vw-2rem)]" : ""
                }`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex justify-between items-start">
                <div className="flex flex-col gap-0.5">
                    <Text variant="body-md-semibold" color="text-primary">
                        Average Boarding Time
                    </Text>
                    <Text variant="body-sm" color="text-secondary">
                        Last 7 days
                    </Text>
                </div>
                <div className="flex items-center gap-2">
                    <InfoTooltip text={infoText} show={isHovered} />
                </div>
            </div>

            <div className="flex flex-col gap-0.5 mb-2">
                <Text variant="body-sm" color="text-secondary">
                    Current average
                </Text>
                <Text variant="heading-sm" color="text-primary">
                    45min
                </Text>
            </div>

            <div className="h-[180px]">
                <Chart
                    options={chartOptions}
                    series={chartSeries}
                    type="bar"
                    height={180}
                    width="100%"
                />
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-2 pt-2">
                <span className="w-3 h-3 rounded-[3px] bg-accent-primary" />
                <Text variant="body-sm" color="text-secondary">
                    Boarding Time
                </Text>
            </div>
        </DashboardCard>
    );
};

export default AverageBoardingTime;

