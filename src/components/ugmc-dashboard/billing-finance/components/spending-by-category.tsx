"use client";

import * as React from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type Category = {
    name: string;
    amount: string;
    percentage: string;
    color: string;
    bgColor: string;
    textColor: string;
};

const MessageVolumeBreakdown: React.FC<{ data?: any }> = ({ data }) => {
    const { resolvedTheme } = useTheme();
    const [animatedTotal, setAnimatedTotal] = React.useState(0);
    const [isVisible, setIsVisible] = React.useState(false);
    
    // Derived metrics
    const standard = data?.standard_messages || 12450;
    const criticalNonEscalated = (data?.critical_messages || 4500) - (data?.escalated_critical_messages || 0);
    const escalated = data?.escalated_critical_messages || 1800;
    const totalAmount = data?.total_messages || (standard + criticalNonEscalated + escalated);

    const getPercent = (val: number) => totalAmount > 0 ? Math.round((val / totalAmount) * 100) + "%" : "0%";

    const categories: Category[] = [
        { name: "Standard Messages", amount: standard.toLocaleString(), percentage: getPercent(standard), color: "#00C8B3", bgColor: "#00C8B31A", textColor: "#089A8A" },
        { name: "Critical Messages", amount: criticalNonEscalated.toLocaleString(), percentage: getPercent(criticalNonEscalated), color: "#FFCA57", bgColor: "#FFCA5733", textColor: "#C68904" },
        { name: "Escalated Messages", amount: escalated.toLocaleString(), percentage: getPercent(escalated), color: "#FF5F57", bgColor: "#FF5F571A", textColor: "#FF5F57" },
    ];

    React.useEffect(() => { setIsVisible(true); }, []);

    React.useEffect(() => {
        if (!isVisible) return;
        const duration = 1200;
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setAnimatedTotal(Math.round(totalAmount * eased));
            if (progress < 1) requestAnimationFrame(animate);
            else setAnimatedTotal(totalAmount);
        };
        requestAnimationFrame(animate);
    }, [isVisible, totalAmount]);

    const chartOptions: ApexCharts.ApexOptions = {
        chart: {
            type: "donut",
            sparkline: { enabled: false },
            animations: { enabled: true, speed: 1200, animateGradually: { enabled: true, delay: 150 }, dynamicAnimation: { enabled: true, speed: 350 } },
        },
        colors: ["#00C8B3", "#FFCA57", "#FF5F57"],
        plotOptions: { pie: { donut: { size: "43%", labels: { show: true, name: { show: false }, value: { show: false }, total: { show: false } } } } },
        dataLabels: { enabled: false },
        stroke: { show: false },
        legend: { show: false },
        tooltip: {
            enabled: true, fillSeriesColor: false, shared: false, followCursor: true,
            custom: function ({ series, seriesIndex }: any) {
                const label = categories[seriesIndex];
                const color = categories[seriesIndex].color;
                const percentage = categories[seriesIndex].percentage;
                const isDark = resolvedTheme === "dark" || resolvedTheme === "blue";
                const bg = isDark ? "#1A1D29" : "white";
                const textColor = isDark ? "white" : "#1A1D29";
                const subTextColor = "#A3B2BE";
                const shadow = isDark ? "0 4px 12px rgba(0,0,0,0.4)" : "0 4px 12px rgba(0,0,0,0.15)";
                const border = isDark ? "1px solid #2D3748" : "none";
                return `<div style="padding: 10px 14px; background: ${bg}; border: ${border} !important; outline: none !important; border-radius: 8px; box-shadow: ${shadow}; font-family: Montserrat, sans-serif; min-width: 180px; max-width: 220px; overflow: hidden; position: relative;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                        <div style="width: 14px; height: 14px; border-radius: 3px; background: ${color}; flex-shrink: 0;"></div>
                        <span style="font-weight: 600; font-size: 13px; color: ${textColor};">${label.name}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <span style="font-weight: 700; font-size: 18px; color: ${textColor}; line-height: 1.2;">${label.amount}</span>
                        <span style="font-size: 12px; color: ${subTextColor}; font-weight: 500;">${percentage} of total</span>
                    </div>
                </div>`;
            },
        },
    };

    const chartSeries = [standard, criticalNonEscalated, escalated];

    return (
        <DashboardCard className="flex flex-col flex-1" padding="none" style={{ padding: 16, gap: 15, height: 680 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Text variant="body-md-semibold" color="text-primary" className="font-bold">Message Volume Breakdown</Text>
                    <Text variant="body-sm" color="text-secondary">By priority level</Text>
                </div>
                <button className="text-[12px] font-semibold text-[#2980D3] rounded-[6px] bg-[#2980D31A] hover:bg-[#2980D326] transition-colors" style={{ padding: '6px 12px' }}>View All</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Text variant="body-sm" color="text-secondary">Total Messages</Text>
                <span className="text-[32px] font-bold text-[#2980D3] tabular-nums">{animatedTotal.toLocaleString()}</span>
            </div>
            <div className="relative w-full h-[400px] bg-tertiary rounded-[10px]" style={{ padding: 24 }}>
                <Chart options={chartOptions} series={chartSeries} type="donut" width="100%" height="100%" />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-0">
                    <span className="text-[18px] font-bold text-text-primary leading-none tabular-nums pt-1">{totalAmount > 1000 ? (totalAmount / 1000).toFixed(1) + 'k' : totalAmount}</span>
                </div>
            </div>
            <div className="shrink-0" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {categories.map((category, index) => (
                    <React.Fragment key={category.name}>
                        <div className="flex items-center justify-between">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div className="w-[12px] h-[12px] rounded-[2px]" style={{ backgroundColor: category.color }} />
                                <Text variant="body-sm-semibold" color="text-primary">{category.name}</Text>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div className="rounded-[4px] bg-tertiary" style={{ padding: '0 8px' }}>
                                    <Text variant="body-sm-semibold" color="text-primary">{category.amount}</Text>
                                </div>
                                <div className="rounded-[5px]" style={{ backgroundColor: category.bgColor, padding: '0 8px' }}>
                                    <span className="text-[13px] font-semibold" style={{ color: category.textColor }}>{category.percentage}</span>
                                </div>
                            </div>
                        </div>
                        {index < categories.length - 1 && <div className="border-t border-tertiary" />}
                    </React.Fragment>
                ))}
            </div>
        </DashboardCard>
    );
};

export default MessageVolumeBreakdown;
