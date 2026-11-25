"use client";

import * as React from "react";
import Text from "@/components/analytics/text";
import DashboardCard from "@/components/analytics/ugmc-dashboard/shared/dashboard-card";
import dynamic from "next/dynamic";
import { CardTitle } from "@/components/analytics/glass/illustrations";
import { glassTooltip, useCountUp } from "@/components/analytics/glass/chart-kit";

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
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

    const standard = num(data?.standard_messages);
    const escalated = num(data?.escalated_critical_messages);
    const criticalNonEscalated = Math.max(0, num(data?.critical_messages) - escalated);
    const totalAmount =
        data?.total_messages != null
            ? num(data.total_messages)
            : standard + criticalNonEscalated + escalated;

    const getPercent = (val: number) => totalAmount > 0 ? Math.round((val / totalAmount) * 100) + "%" : "0%";

    const categories: Category[] = [
        { name: "Standard Messages", amount: standard.toLocaleString(), percentage: getPercent(standard), color: "#2a9a74", bgColor: "#2a9a741A", textColor: "#2a9a74" },
        { name: "Critical Messages", amount: criticalNonEscalated.toLocaleString(), percentage: getPercent(criticalNonEscalated), color: "#e5a73b", bgColor: "#e5a73b33", textColor: "#C68904" },
        { name: "Escalated Messages", amount: escalated.toLocaleString(), percentage: getPercent(escalated), color: "#e0656b", bgColor: "#e0656b1A", textColor: "#e0656b" },
    ];

    const animatedTotal = Math.round(useCountUp(totalAmount, 1100));

    const chartOptions: ApexCharts.ApexOptions = {
        chart: { type: "donut", background: "transparent" },
        colors: categories.map((c) => c.color),
        labels: categories.map((c) => c.name),
        plotOptions: { pie: { donut: { labels: { show: false } } } },
        dataLabels: { enabled: false },
        legend: { show: false },
        tooltip: {
            fillSeriesColor: false,
            custom: ({ seriesIndex }: { seriesIndex: number }) => {
                const c = categories[seriesIndex];
                return glassTooltip({ title: c.name, rows: [{ color: c.color, label: "Messages", value: c.amount }], foot: `${c.percentage} of all messages` });
            },
        },
    };

    const chartSeries = [standard, criticalNonEscalated, escalated];

    return (
        <DashboardCard data-watermark="forum" className="flex flex-col flex-1" padding="none" style={{ padding: 16, gap: 15 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <CardTitle icon="stacked_bar_chart" variant="body-md-semibold" className="font-bold">Message Volume Breakdown</CardTitle>
                    <Text variant="body-sm" color="text-secondary">By priority level</Text>
                </div>
                <button className="shrink-0 whitespace-nowrap text-[12px] font-semibold text-[#2f6fb8] rounded-[6px] bg-[#2f6fb81A] hover:bg-[#2f6fb826] transition-colors" style={{ padding: '6px 12px' }}>View All</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Text variant="body-sm" color="text-secondary">Total Messages</Text>
                <span className="text-[32px] font-bold text-[#2f6fb8] tabular-nums">{animatedTotal.toLocaleString()}</span>
            </div>
            {/* Fills the stretched card; the chart is a fixed square centred in it so the overlay total stays in the hole. */}
            <div className="relative flex w-full min-h-[320px] flex-1 items-center justify-center bg-tertiary rounded-[14px]">
                <div className="w-[300px] max-w-full">
                    <Chart options={chartOptions} series={chartSeries} type="donut" width="100%" height={300} />
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-0.5">
                    <span className="text-[26px] font-bold text-text-primary leading-none tabular-nums">{totalAmount >= 1000 ? (animatedTotal / 1000).toFixed(1) + "k" : animatedTotal}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">messages</span>
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
