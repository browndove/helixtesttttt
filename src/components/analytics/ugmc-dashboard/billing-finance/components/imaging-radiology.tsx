"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import DashboardCard from "@/components/analytics/ugmc-dashboard/shared/dashboard-card";
import Text from "@/components/analytics/text";
import { buildNiceTimeAxisScale } from "@/lib/analytics/nice-chart-axis";
import {
    minutesSinceMidnightToClock,
    resolveRoleSignInMinutes,
    resolveRoleSignOutMinutes,
    resolveSignInMinutes,
    resolveSignOutMinutes,
    roleHasSignInOutData,
} from "@/lib/analytics/distribution-metrics";
import { IoCheckmarkCircle, IoTrailSign } from "react-icons/io5";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

/** Fixed light palette for this chart — ignores app dark/blue theme */
const LIGHT = {
    ink: "#1a2332",
    muted: "#64748b",
    grid: "#e2e8f0",
    cardBg: "#ffffff",
} as const;

type RoleSignMetric = {
    role_id?: string;
    role_name?: string;
    department_name?: string;
    priority?: string;
    sign_in_minutes?: { median_minutes?: number };
    sign_out_minutes?: { median_minutes?: number };
    avg_sign_in_minutes_since_midnight_utc?: number | null;
    avg_sign_out_minutes_since_midnight_utc?: number | null;
};

type SignInOutData = Record<string, unknown> & {
    role_metrics?: RoleSignMetric[];
};

function useNarrowViewport(breakpointPx = 640) {
    const [narrow, setNarrow] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
        const sync = () => setNarrow(mq.matches);
        sync();
        mq.addEventListener("change", sync);
        return () => mq.removeEventListener("change", sync);
    }, [breakpointPx]);
    return narrow;
}

function shortenCategory(label: string, maxLen: number) {
    const t = label.trim();
    if (t.length <= maxLen) return t;
    return `${t.slice(0, Math.max(0, maxLen - 1))}…`;
}

function formatClock(minutes?: number | null): string {
    if (minutes == null || minutes <= 0) return "—";
    return minutesSinceMidnightToClock(minutes);
}

function formatClockAxis(minutes: number): string {
    const formatted = minutesSinceMidnightToClock(minutes);
    return formatted.replace(" UTC", "");
}

export default function ImagingRadiology({ data }: { data?: SignInOutData }) {
    const narrow = useNarrowViewport(640);
    const root = data as Record<string, unknown> | undefined;
    const globalSignIn = resolveSignInMinutes(root);
    const globalSignOut = resolveSignOutMinutes(root);

    const selectedRoles = useMemo(() => {
        const rows = Array.isArray(data?.role_metrics) ? data.role_metrics : [];
        return rows
            .filter((r) => roleHasSignInOutData(r as Record<string, unknown>))
            .slice(0, 4);
    }, [data?.role_metrics]);

    const categories = useMemo(
        () => selectedRoles.map((r, idx) => r.role_name?.trim() || `Role ${idx + 1}`),
        [selectedRoles]
    );
    const chartCategories = categories.map((c) => (narrow ? shortenCategory(c, 20) : c));

    const signInMinutes = useMemo(
        () => selectedRoles.map((r) => resolveRoleSignInMinutes(r as Record<string, unknown>)),
        [selectedRoles]
    );
    const signOutMinutes = useMemo(
        () => selectedRoles.map((r) => resolveRoleSignOutMinutes(r as Record<string, unknown>)),
        [selectedRoles]
    );

    const plottedMinutes = useMemo(
        () =>
            [...signInMinutes, ...signOutMinutes].filter(
                (v): v is number => v !== null && Number.isFinite(v)
            ),
        [signInMinutes, signOutMinutes]
    );

    const { min: yAxisMin, max: yAxisMax, stepSize: yAxisStep } = useMemo(
        () => buildNiceTimeAxisScale(plottedMinutes),
        [plottedMinutes]
    );

    const roleCount = selectedRoles.length;
    const chartHeight = narrow ? 170 : 210;
    const hasChartData = plottedMinutes.length > 0 && categories.length > 0;

    const options: ApexCharts.ApexOptions = {
        theme: { mode: "light" },
        chart: {
            type: "bar",
            toolbar: { show: false },
            stacked: false,
            background: LIGHT.cardBg,
            foreColor: LIGHT.muted,
            fontFamily: "system-ui, -apple-system, sans-serif",
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
            categories: chartCategories.length ? chartCategories : [],
            labels: {
                style: { colors: LIGHT.muted, fontSize: narrow ? "9px" : "11px", fontFamily: "system-ui, -apple-system, sans-serif" },
                rotate: narrow ? -35 : 0,
                rotateAlways: narrow,
                hideOverlappingLabels: false,
                trim: true,
                maxHeight: narrow ? 56 : 64,
            },
            axisBorder: { show: false },
            axisTicks: { show: false },
        },
        yaxis: {
            min: yAxisMin,
            max: yAxisMax,
            stepSize: yAxisStep,
            labels: {
                style: { colors: LIGHT.muted, fontSize: narrow ? "9px" : "10px", fontFamily: "system-ui, -apple-system, sans-serif" },
                formatter: (v) => formatClockAxis(v),
            },
        },
        grid: {
            borderColor: LIGHT.grid,
            strokeDashArray: 4,
            padding: { top: 4, right: 4, bottom: 4, left: 4 },
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
        },
        colors: ["#FF6258", "#00C8B3"],
        legend: {
            show: true,
            position: "bottom",
            horizontalAlign: "center",
            markers: { size: 8 },
            labels: { colors: LIGHT.muted },
        },
        tooltip: {
            theme: "light",
            y: {
                formatter: (v) => (v > 0 ? formatClock(v) : "—"),
            },
        },
    };

    const series = [
        {
            name: "Avg Sign-In",
            data: signInMinutes.length ? signInMinutes : [],
        },
        {
            name: "Avg Sign-Out",
            data: signOutMinutes.length ? signOutMinutes : [],
        },
    ];

    return (
        <DashboardCard
            padding="none"
            className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3"
            style={{ boxSizing: "border-box", padding: 16 }}
        >
            <div className="flex items-center justify-between gap-2">
                <Text variant="body-md-semibold" color="text-primary">Role Sign-In / Sign-Out Averages</Text>
                <div className="rounded-full px-2 py-0.5 shrink-0" style={{ backgroundColor: "#e8f3ff" }}>
                    <Text variant="body-sm" color="accent-primary">Live</Text>
                </div>
            </div>

            <div className="imaging-radiology-stats flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <div
                    className="imaging-radiology-stat rounded-[8px]"
                    style={{ padding: "8px 12px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}
                >
                    <Text variant="body-sm" color="text-secondary">Average Sign-In</Text>
                    <div className="flex items-center gap-2">
                        <Text variant="body-md-semibold" color="text-primary">{formatClock(globalSignIn)}</Text>
                        <IoCheckmarkCircle className="text-accent-green" />
                    </div>
                </div>
                <div
                    className="imaging-radiology-stat rounded-[8px]"
                    style={{ padding: "8px 12px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}
                >
                    <Text variant="body-sm" color="text-secondary">Average Sign-Out</Text>
                    <div className="flex items-center gap-2">
                        <Text variant="body-md-semibold" color="text-primary">{formatClock(globalSignOut)}</Text>
                        <IoTrailSign className="text-text-secondary" />
                    </div>
                </div>
                <div
                    className="imaging-radiology-stat rounded-[8px]"
                    style={{ padding: "8px 12px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}
                >
                    <Text variant="body-sm" color="text-secondary">Roles Displayed</Text>
                    <div className="flex items-center gap-2">
                        <Text variant="body-md-semibold" color="text-primary">{roleCount}</Text>
                    </div>
                </div>
            </div>

            <div className="min-h-0 min-w-0 w-full" style={{ height: chartHeight }}>
                {hasChartData ? (
                    <Chart options={options} series={series} type="bar" height={chartHeight} width="100%" />
                ) : (
                    <div
                        className="flex h-full items-center justify-center rounded-[8px] border border-dashed"
                        style={{ borderColor: LIGHT.grid, backgroundColor: "#f8fafc" }}
                    >
                        <Text variant="body-sm" color="text-secondary">
                            No per-role sign-in or sign-out data for this period.
                        </Text>
                    </div>
                )}
            </div>
        </DashboardCard>
    );
}
