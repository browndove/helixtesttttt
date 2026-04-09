"use client";

import * as React from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import InfoTooltip from "@/components/info-tooltip";
import { RiExpandDiagonalLine } from "react-icons/ri";
import { GrContract } from "react-icons/gr";
import FullscreenOverlay from "@/components/fullscreen-overlay";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const TotalRevenueGenerated: React.FC<{ data?: any }> = ({ data }) => {
    const { resolvedTheme } = useTheme();
    const [isMaximized, setIsMaximized] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);
    const roles = React.useMemo(() => {
        const list = Array.isArray(data?.top_escalated_roles) ? [...data.top_escalated_roles] : [];
        return list
            .sort((a: any, b: any) => (b?.escalation_count ?? 0) - (a?.escalation_count ?? 0))
            .slice(0, 8);
    }, [data]);

    const fullRoleNames = roles.length
        ? roles.map((r: any) => String(r?.role_name || "Role"))
        : ["No Data"];
    const categories = roles.length
        ? roles.map((r: any) => String(r?.role_name || "Role").slice(0, 18))
        : ["No Data"];
    const escalatedCounts = roles.length
        ? roles.map((r: any) => Number(r?.escalation_count || 0))
        : [0];
    const escalationRateData = roles.length
        ? roles.map((r: any) => {
              const total = Number(r?.total_messages_for_role || 0);
              const esc = Number(r?.escalation_count || 0);
              return total > 0 ? Number(((esc / total) * 100).toFixed(2)) : 0;
          })
        : [0];
    const maxRate = escalationRateData.length ? Math.max(...escalationRateData) : 0;
    const yAxisMax = maxRate > 0 ? Number((maxRate * 1.15).toFixed(2)) : 10;

    const chartOptions: ApexCharts.ApexOptions = {
        chart: { type: "bar", toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: true, speed: 800 } },
        colors: ["#2980D3"],
        plotOptions: { bar: { borderRadius: 5, borderRadiusApplication: "end", columnWidth: "60%" } },
        fill: { type: "gradient", gradient: { type: "vertical", shadeIntensity: 1, opacityFrom: 1, opacityTo: 1, gradientToColors: ["#00A3C8"] } },
        dataLabels: { enabled: false },
        xaxis: {
            categories,
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: { rotate: -20, style: { colors: "var(--text-secondary)", fontSize: "10px", fontWeight: 500, fontFamily: "Montserrat" } },
        },
        yaxis: {
            min: 0,
            max: yAxisMax,
            tickAmount: 4,
            labels: {
                style: { colors: "var(--text-secondary)", fontSize: "10px", fontWeight: 500, fontFamily: "Montserrat" },
                formatter: (val) => `${val.toFixed(0)}%`,
            },
        },
        grid: { show: true, borderColor: "var(--bg-tertiary)", strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        legend: { show: false },
        tooltip: {
            theme: resolvedTheme === "dark" || resolvedTheme === "blue" ? "dark" : "light",
            style: { fontSize: '12px', fontFamily: 'Montserrat' },
            x: {
                formatter: (_: string, opts?: any) => {
                    const idx = opts?.dataPointIndex ?? 0;
                    return fullRoleNames[idx] ?? categories[idx] ?? "Role";
                },
            },
            y: {
                formatter: (val, opts?: any) => {
                    const idx = opts?.dataPointIndex ?? 0;
                    const escalated = escalatedCounts[idx] ?? 0;
                    return `${val.toFixed(2)}% escalation rate · ${escalated} escalated`;
                },
            },
            fixed: { enabled: false },
            followCursor: false,
        },
    };

    const chartSeries = [{ name: "Escalation Rate", data: escalationRateData }];

    const chartContent = (isModal: boolean = false) => (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Text variant={isModal ? "body-lg-semibold" : "body-md-semibold"} color="text-primary" className="font-bold">Escalation Risk by Role</Text>
                    <Text variant="body-sm" color="text-secondary">
                        Top non-responder roles · Last {data?.window_days ?? 30} days
                    </Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {!isModal && (
                        <button onClick={() => setIsMaximized(true)} className="flex items-center justify-center size-[30px] bg-secondary rounded-[10px] cursor-pointer hover:bg-tertiary transition-colors" title="Maximize">
                            <RiExpandDiagonalLine className="size-4 text-text-primary" />
                        </button>
                    )}
                    {isModal && (
                        <button onClick={() => setIsMaximized(false)} className="flex items-center justify-center size-[30px] bg-secondary rounded-[10px] cursor-pointer hover:bg-tertiary transition-colors" title="Close">
                            <GrContract className="size-4 text-text-primary" />
                        </button>
                    )}
                    <InfoTooltip text="Escalation rate per role (escalations divided by role message volume)." show={isHovered} />
                </div>
            </div>
            <div className={`revenue-chart w-full ${isModal ? "h-[500px]" : "h-[280px]"}`}>
                <Chart options={chartOptions} series={chartSeries} type="bar" width="100%" height="100%" />
            </div>
        </>
    );

    return (
        <>
            <DashboardCard className="flex flex-col flex-1" padding="none" style={{ padding: 20, gap: 15 }} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
                {chartContent(false)}
            </DashboardCard>
            {isMaximized && (
                <FullscreenOverlay onClose={() => setIsMaximized(false)}>
                    <div className="bg-primary rounded-[20px] w-full max-w-5xl max-h-[90vh] overflow-auto flex flex-col shadow-2xl" style={{ padding: 24, gap: 15 }}>
                        {chartContent(true)}
                    </div>
                </FullscreenOverlay>
            )}
        </>
    );
};

export default TotalRevenueGenerated;
