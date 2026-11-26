"use client";

import * as React from "react";
import Text from "@/components/analytics/text";
import DashboardCard from "@/components/analytics/ugmc-dashboard/shared/dashboard-card";
import dynamic from "next/dynamic";
import { useState } from "react";
import InfoTooltip from "@/components/analytics/info-tooltip";
import { useTheme } from "next-themes";
import {
    type CallMetricsSlice,
    getTopDepartments,
    num,
    truncateLabel,
} from "./call-metrics-helpers";

const infoText = "Distribution of outbound call volume across initiating departments.";

const CHART_COLORS = [
    "var(--accent-primary)",
    "var(--accent-red)",
    "var(--accent-green)",
    "var(--accent-violet)",
];

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
            style={{ backgroundColor: bgColor, color: color }}
        >
            {value}
        </span>
    </div>
);

interface PharmacyPrescriptionProps {
    callMetrics?: CallMetricsSlice;
}

const PharmacyPrescription: React.FC<PharmacyPrescriptionProps> = ({ callMetrics }) => {
    const { resolvedTheme } = useTheme();
    const [isHovered, setIsHovered] = useState(false);
    const [animatedTotal, setAnimatedTotal] = useState(0);
    const [isVisible, setIsVisible] = useState(false);

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

    React.useEffect(() => {
        setIsVisible(true);
    }, []);

    // Animate the total number
    React.useEffect(() => {
        if (!isVisible) return;

        const duration = 1200;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);

            setAnimatedTotal(Math.round(totalCalls * eased));

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setAnimatedTotal(totalCalls);
            }
        };
        requestAnimationFrame(animate);
    }, [isVisible, totalCalls]);

    const chartOptions: ApexCharts.ApexOptions = React.useMemo(() => ({
        chart: {
            type: "donut",
            sparkline: { enabled: false },
            animations: {
                enabled: true,
                speed: 1200,
                animateGradually: {
                    enabled: true,
                    delay: 150
                },
                dynamicAnimation: {
                    enabled: true,
                    speed: 350
                }
            }
        },
        colors: CHART_COLORS.slice(0, Math.max(chartSeries.length, 1)),
        plotOptions: {
            pie: {
                donut: {
                    size: "45%",
                    labels: {
                        show: true,
                        name: { show: false },
                        value: { show: false },
                        total: {
                            show: true,
                            showAlways: true,
                            label: "Calls",
                            fontSize: "10px",
                            fontWeight: 500,
                            color: "var(--text-tertiary)",
                            formatter: () => (hasData ? totalCalls.toLocaleString() : "—"),
                        },
                    },
                },
            },
        },
        dataLabels: { enabled: false },
        stroke: { show: false },
        legend: { show: false },
        tooltip: {
            theme: resolvedTheme === "dark" || resolvedTheme === "blue" ? "dark" : "light",
            enabled: true,
            fillSeriesColor: false,
            shared: false,
            followCursor: true,
            style: {
                fontSize: "12px",
                fontFamily: "system-ui, -apple-system, sans-serif",
            },
            custom: function ({ series, seriesIndex }: { series: number[]; seriesIndex: number }) {
                const value = series[seriesIndex] ?? 0;
                const dept = deptSlice[seriesIndex];
                const label = dept ? truncateLabel(dept.department_name, 28) : "Department";
                const color = CHART_COLORS[seriesIndex % CHART_COLORS.length];
                const percentage =
                    totalCalls > 0 ? `${((value / totalCalls) * 100).toFixed(0)}%` : "0%";

                return `
                    <div style="padding: 10px 14px; background: var(--bg-primary); border: none !important; outline: none !important; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: system-ui, -apple-system, sans-serif; min-width: 180px; max-width: 220px; overflow: hidden; position: relative;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                            <div style="width: 14px; height: 14px; border-radius: 3px; background: ${color}; flex-shrink: 0;"></div>
                            <span style="font-weight: 600; font-size: 13px; color: var(--text-primary);">${label}</span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span style="font-weight: 700; font-size: 18px; color: var(--text-primary); line-height: 1.2;">${value.toLocaleString()} calls</span>
                            <span style="font-size: 12px; color: var(--text-tertiary); font-weight: 500;">${percentage} of total</span>
                        </div>
                    </div>
                `;
            },
        },
    }), [resolvedTheme, chartSeries.length, deptSlice, totalCalls, hasData]);

    const chartSeriesData = hasData ? chartSeries : [1];

    return (
        <DashboardCard
            className="flex flex-col gap-2 h-full"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <Text variant="body-md-semibold" color="text-primary">
                Calls by Department
                <InfoTooltip text={infoText} show={isHovered} />
            </Text>
            <div className="flex items-center justify-center flex-1 bg-accent-primary/5 rounded-[12px] py-2">
                {hasData ? (
                <div className="relative w-[240px] h-[240px] drop-shadow-lg">
                    <style jsx global>{`
                        .apexcharts-tooltip {
                            border: none !important;
                            outline: none !important;
                            box-shadow: none !important;
                            background: transparent !important;
                            padding: 0 !important;
                        }
                        .apexcharts-tooltip * {
                            border: none !important;
                            outline: none !important;
                        }
                        .apexcharts-tooltip.apexcharts-theme-light {
                            border: none !important;
                            outline: none !important;
                            box-shadow: none !important;
                            background: transparent !important;
                            padding: 0 !important;
                        }
                        .apexcharts-tooltip-series-group {
                            border: none !important;
                            outline: none !important;
                            background: transparent !important;
                            padding: 0 !important;
                        }
                        .apexcharts-tooltip-marker {
                            display: none !important;
                        }
                    `}</style>
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
                        <Text variant="body-md" color="text-tertiary">
                            Calls
                        </Text>
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
