"use client";

import * as React from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import InfoTooltip from "@/components/info-tooltip";
import { RiExpandDiagonalLine } from "react-icons/ri";
import { GrContract } from "react-icons/gr";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const TotalRevenueGenerated: React.FC = () => {
    const { resolvedTheme } = useTheme();
    const [isMaximized, setIsMaximized] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);

    const chartOptions: ApexCharts.ApexOptions = {
        chart: { type: "bar", toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: true, speed: 800 } },
        colors: ["#2980D3"],
        plotOptions: { bar: { borderRadius: 5, borderRadiusApplication: "end", columnWidth: "60%" } },
        fill: { type: "gradient", gradient: { type: "vertical", shadeIntensity: 1, opacityFrom: 1, opacityTo: 1, gradientToColors: ["#00A3C8"] } },
        dataLabels: { enabled: false },
        xaxis: { categories: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN"], axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: "var(--text-secondary)", fontSize: "10px", fontWeight: 500, fontFamily: "Montserrat" } } },
        yaxis: { min: 0, max: 80000, tickAmount: 4, labels: { style: { colors: "var(--text-secondary)", fontSize: "10px", fontWeight: 500, fontFamily: "Montserrat" }, formatter: (val) => `${val / 1000}K` } },
        grid: { show: true, borderColor: "var(--bg-tertiary)", strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        legend: { show: false },
        tooltip: { theme: resolvedTheme === "dark" || resolvedTheme === "blue" ? "dark" : "light", style: { fontSize: '12px', fontFamily: 'Montserrat' }, y: { formatter: (val) => `GH₵ ${val.toLocaleString()}` }, fixed: { enabled: false }, followCursor: false },
    };

    const chartSeries = [{ name: "Revenue", data: [75000, 80000, 45000, 60000, 25000, 35000] }];

    const chartContent = (isModal: boolean = false) => (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Text variant={isModal ? "body-lg-semibold" : "body-md-semibold"} color="text-primary" className="font-bold">Total Revenue Generated</Text>
                    <Text variant="body-sm" color="text-secondary">All Departments · Last 6 Months</Text>
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
                    <InfoTooltip text="Total revenue generated represents the sum of all income from patient services, insurance reimbursements, and other medical billing sources across all departments." show={isHovered} />
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
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" style={{ padding: 24 }} onClick={() => setIsMaximized(false)}>
                    <div className="bg-primary rounded-[20px] w-full max-w-5xl max-h-[90vh] overflow-auto flex flex-col shadow-2xl" style={{ padding: 24, gap: 15 }} onClick={(e) => e.stopPropagation()}>
                        {chartContent(true)}
                    </div>
                </div>
            )}
        </>
    );
};

export default TotalRevenueGenerated;
