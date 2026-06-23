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

function toChartHours(minutes?: number): number | null {
    if (typeof minutes !== "number" || minutes <= 0) return null;
    return Number((minutes / 60).toFixed(2));
}

function formatClock(minutes?: number, withUtc = false): string {
    if (!minutes || minutes <= 0) return "—";
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    const time = `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
    return withUtc ? `${time} UTC` : time;
}

function hoursToMinutes(hours: number): number {
    return Math.round(hours * 60);
}

function hasRoleSignTimes(role: RoleMetric): boolean {
    const signIn = role.avg_sign_in_minutes_since_midnight_utc;
    const signOut = role.avg_sign_out_minutes_since_midnight_utc;
    return (typeof signIn === "number" && signIn > 0) || (typeof signOut === "number" && signOut > 0);
}

function truncateLabel(label: string, max = 16): string {
    const trimmed = label.trim();
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max - 1)}…`;
}

export default function ImagingRadiology({ data }: { data?: any }) {
    const globalSignIn = data?.avg_sign_in_minutes_since_midnight_utc ?? 0;
    const globalSignOut = data?.avg_sign_out_minutes_since_midnight_utc ?? 0;
    const roleMetrics: RoleMetric[] = Array.isArray(data?.role_metrics) ? data.role_metrics : [];

    const rolesWithData = roleMetrics.filter(hasRoleSignTimes).slice(0, 4);
    const useFacilityAverage = rolesWithData.length === 0 && (globalSignIn > 0 || globalSignOut > 0);

    const chartRoles: RoleMetric[] = useFacilityAverage
        ? [{
            role_name: "Facility average",
            avg_sign_in_minutes_since_midnight_utc: globalSignIn,
            avg_sign_out_minutes_since_midnight_utc: globalSignOut,
        }]
        : rolesWithData;

    const fullCategories = chartRoles.map((r, idx) => r.role_name?.trim() || `Role ${idx + 1}`);
    const displayCategories = fullCategories.map((name) => truncateLabel(name));
    const signInHours = chartRoles.map((r) => toChartHours(r.avg_sign_in_minutes_since_midnight_utc));
    const signOutHours = chartRoles.map((r) => toChartHours(r.avg_sign_out_minutes_since_midnight_utc));

    const numericValues = [...signInHours, ...signOutHours].filter(
        (v): v is number => typeof v === "number" && Number.isFinite(v),
    );
    const minValue = numericValues.length ? Math.min(...numericValues) : 0;
    const maxValue = numericValues.length ? Math.max(...numericValues) : 0;
    const yAxisMin = minValue > 0 ? Math.max(0, Number((minValue - 0.5).toFixed(2))) : 0;
    const yAxisMax = maxValue > 0 ? Number((maxValue + 0.5).toFixed(2)) : 1;
    const hasChartData = chartRoles.length > 0 && numericValues.length > 0;

    const options: ApexCharts.ApexOptions = {
        chart: {
            type: "bar",
            toolbar: { show: false },
            stacked: false,
        },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: chartRoles.length === 1 ? "28%" : "48%",
                borderRadius: 4,
            },
        },
        dataLabels: { enabled: false },
        stroke: { show: false },
        xaxis: {
            categories: displayCategories,
            labels: {
                style: { colors: "var(--text-secondary)", fontSize: "10px", fontFamily: "Montserrat" },
                rotate: -30,
                rotateAlways: chartRoles.length > 2,
                hideOverlappingLabels: false,
            },
            axisBorder: { show: false },
            axisTicks: { show: false },
        },
        yaxis: {
            min: yAxisMin,
            max: yAxisMax,
            tickAmount: 5,
            labels: {
                style: { colors: "var(--text-secondary)", fontSize: "10px", fontFamily: "Montserrat" },
                formatter: (v) => formatClock(hoursToMinutes(v)),
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
            shared: true,
            intersect: false,
            x: {
                formatter: (_val, opts) => {
                    const index = opts?.dataPointIndex ?? -1;
                    return index >= 0 ? (fullCategories[index] ?? "") : "";
                },
            },
            y: {
                formatter: (v) => formatClock(hoursToMinutes(v), true),
            },
        },
    };

    const series = [
        { name: "Avg Sign-In", data: signInHours },
        { name: "Avg Sign-Out", data: signOutHours },
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
                        <Text variant="body-md-semibold" color="text-primary">{formatClock(globalSignIn, true)}</Text>
                        <IoCheckmarkCircle className="text-accent-green" />
                    </div>
                </div>
                <div className="rounded-[8px] bg-secondary" style={{ padding: "8px 12px" }}>
                    <Text variant="body-sm" color="text-secondary">Average Sign-Out</Text>
                    <div className="flex items-center gap-2">
                        <Text variant="body-md-semibold" color="text-primary">{formatClock(globalSignOut, true)}</Text>
                        <IoTrailSign className="text-text-secondary" />
                    </div>
                </div>
                <div className="rounded-[8px] bg-secondary" style={{ padding: "8px 12px" }}>
                    <Text variant="body-sm" color="text-secondary">Roles with data</Text>
                    <div className="flex items-center gap-2">
                        <Text variant="body-md-semibold" color="text-primary">
                            {rolesWithData.length > 0 ? rolesWithData.length : "—"}
                        </Text>
                    </div>
                </div>
            </div>

            {useFacilityAverage && (
                <Text variant="body-sm" color="text-secondary">
                    Per-role sign-in times are not available yet. Chart shows the facility-wide average.
                </Text>
            )}

            <div className="min-h-0 flex-1">
                {hasChartData ? (
                    <Chart options={options} series={series} type="bar" height="100%" width="100%" />
                ) : (
                    <div className="flex h-full items-center justify-center rounded-[8px] bg-secondary px-4 text-center">
                        <Text variant="body-sm" color="text-secondary">
                            No sign-in or sign-out averages available for this period.
                        </Text>
                    </div>
                )}
            </div>
        </DashboardCard>
    );
}
