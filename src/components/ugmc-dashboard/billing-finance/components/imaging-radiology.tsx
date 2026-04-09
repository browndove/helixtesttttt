"use client";

import dynamic from "next/dynamic";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import Text from "@/components/text";
import { IoCheckmarkCircle, IoTrailSign } from "react-icons/io5";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type RoleMetric = {
    role_name?: string;
    avg_sign_in_minutes_since_midnight_utc?: number;
    avg_sign_out_minutes_since_midnight_utc?: number;
};

function toHours(minutes?: number): number {
    if (!minutes || minutes <= 0) return 0;
    return Number((minutes / 60).toFixed(2));
}

function formatClock(minutes?: number): string {
    if (!minutes || minutes <= 0) return "—";
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export default function ImagingRadiology({ data }: { data?: any }) {
    const globalSignIn = data?.avg_sign_in_minutes_since_midnight_utc ?? 0;
    const globalSignOut = data?.avg_sign_out_minutes_since_midnight_utc ?? 0;
    const roleMetrics: RoleMetric[] = Array.isArray(data?.role_metrics) ? data.role_metrics : [];
    const selectedRoles = roleMetrics.slice(0, 4);
    const categories = selectedRoles.map((r, idx) => r.role_name || `Role ${idx + 1}`);
    const signInHours = selectedRoles.map((r) => toHours(r.avg_sign_in_minutes_since_midnight_utc ?? globalSignIn));
    const signOutHours = selectedRoles.map((r) => toHours(r.avg_sign_out_minutes_since_midnight_utc ?? globalSignOut));
    const allValues = [...signInHours, ...signOutHours].filter((v) => Number.isFinite(v));
    const maxValue = allValues.length ? Math.max(...allValues) : 0;
    const yAxisMax = maxValue > 0 ? Number((maxValue * 1.15).toFixed(2)) : 1;
    const roleCount = categories.length || 4;

    const options: ApexCharts.ApexOptions = {
        chart: {
            type: "bar",
            toolbar: { show: false },
            stacked: false,
        },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: "48%",
                borderRadius: 4,
            },
        },
        dataLabels: { enabled: false },
        stroke: { show: false },
        xaxis: {
            categories: categories.length ? categories : ["Role 1", "Role 2", "Role 3", "Role 4"],
            labels: { style: { colors: "var(--text-secondary)", fontSize: "10px", fontFamily: "Montserrat" } },
            axisBorder: { show: false },
            axisTicks: { show: false },
        },
        yaxis: {
            min: 0,
            max: yAxisMax,
            tickAmount: 6,
            labels: {
                style: { colors: "var(--text-secondary)", fontSize: "10px", fontFamily: "Montserrat" },
                formatter: (v) => `${Math.round(v)}h`,
            },
        },
        grid: {
            borderColor: "var(--bg-tertiary)",
            strokeDashArray: 4,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
        },
        colors: ["#FF6258", "#00C8B3"],
        legend: {
            show: true,
            position: "bottom",
            horizontalAlign: "center",
            markers: { size: 8 },
            labels: { colors: "var(--text-secondary)" },
        },
        tooltip: {
            y: {
                formatter: (v) => `${v.toFixed(2)}h`,
            },
        },
    };

    const series = [
        { name: "Avg Sign-In", data: signInHours.length ? signInHours : [0, 0, 0, 0] },
        { name: "Avg Sign-Out", data: signOutHours.length ? signOutHours : [0, 0, 0, 0] },
    ];

    return (
        <DashboardCard padding="none" className="flex flex-col gap-3" style={{ height: 360, padding: 18 }}>
            <div className="flex items-center justify-between">
                <Text variant="body-md-semibold" color="text-primary">Role Sign-In / Sign-Out Averages</Text>
                <div className="rounded-full bg-accent-primary/10 px-2 py-0.5">
                    <Text variant="body-sm" color="accent-primary">Live</Text>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="rounded-[8px] bg-secondary" style={{ padding: "8px 12px" }}>
                    <Text variant="body-sm" color="text-secondary">Average Sign-In</Text>
                    <div className="flex items-center gap-2">
                        <Text variant="body-md-semibold" color="text-primary">{formatClock(globalSignIn)}</Text>
                        <IoCheckmarkCircle className="text-accent-green" />
                    </div>
                </div>
                <div className="rounded-[8px] bg-secondary" style={{ padding: "8px 12px" }}>
                    <Text variant="body-sm" color="text-secondary">Average Sign-Out</Text>
                    <div className="flex items-center gap-2">
                        <Text variant="body-md-semibold" color="text-primary">{formatClock(globalSignOut)}</Text>
                        <IoTrailSign className="text-text-secondary" />
                    </div>
                </div>
                <div className="rounded-[8px] bg-secondary" style={{ padding: "8px 12px" }}>
                    <Text variant="body-sm" color="text-secondary">Roles Displayed</Text>
                    <div className="flex items-center gap-2">
                        <Text variant="body-md-semibold" color="text-primary">{roleCount}</Text>
                    </div>
                </div>
            </div>

            <div className="min-h-0 flex-1">
                <Chart options={options} series={series} type="bar" height="100%" width="100%" />
            </div>
        </DashboardCard>
    );
}
