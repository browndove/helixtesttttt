"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import DashboardCard from "@/components/analytics/ugmc-dashboard/shared/dashboard-card";
import Text from "@/components/analytics/text";
import {
    minutesSinceMidnightToClock,
    resolveRoleSignInMinutes,
    resolveRoleSignOutMinutes,
    resolveSignInMinutes,
    resolveSignOutMinutes,
    roleHasSignInOutData,
} from "@/lib/analytics/distribution-metrics";
import { CardTitle } from "@/components/analytics/glass/illustrations";
import { Callout, EmptyState, MetricTile, Pill } from "@/components/analytics/glass/ui";
import { shortRoleName } from "@/lib/analytics/role-name";
import { escapeHtml } from "@/components/analytics/glass/chart-kit";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const MAX_ROLES = 8;

/** Same colour per metric everywhere on this page: sign-in mint, sign-out amber (never red). */
const SIGN_IN_COLOR = "#2a9a74";
const SIGN_OUT_COLOR = "#e5a73b";

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

function formatClock(minutes?: number | null): string {
    if (minutes == null || minutes <= 0) return "—";
    return minutesSinceMidnightToClock(minutes);
}

/** Axis tick as a whole hour ("8 AM"). Ticks past midnight wrap; bar labels and the tooltip give exact times. */
function formatHourTick(minutes: number): string {
    const hour24 = ((Math.round(minutes / 60) % 24) + 24) % 24;
    return `${hour24 % 12 || 12} ${hour24 >= 12 ? "PM" : "AM"}`;
}

/** Axis/label clock without the zone suffix; wraps values past midnight (next-day ends). */
function formatClockShort(minutes: number): string {
    const wrapped = ((minutes % 1440) + 1440) % 1440;
    return minutesSinceMidnightToClock(wrapped || 1440).replace(" UTC", "").replace("12:00 AM", "12 AM");
}

export default function ImagingRadiology({ data }: { data?: SignInOutData }) {
    const root = data as Record<string, unknown> | undefined;
    const globalSignIn = resolveSignInMinutes(root);
    const globalSignOut = resolveSignOutMinutes(root);

    const rows = useMemo(() => {
        const list = Array.isArray(data?.role_metrics) ? data.role_metrics : [];
        return list
            .filter((r) => roleHasSignInOutData(r as Record<string, unknown>))
            .map((r, idx) => {
                const signIn = resolveRoleSignInMinutes(r as Record<string, unknown>);
                const signOut = resolveRoleSignOutMinutes(r as Record<string, unknown>);
                const fullName = r.role_name?.trim() || `Role ${idx + 1}`;
                return { fullName, name: shortRoleName(fullName), signIn, signOut };
            })
            .filter((r): r is typeof r & { signIn: number; signOut: number } => r.signIn != null && r.signOut != null)
            .slice(0, MAX_ROLES);
    }, [data]);

    // A sign-out earlier than the sign-in means the shift ran past midnight: draw it into the next day.
    const ranges = rows.map((r) => [r.signIn, r.signOut > r.signIn ? r.signOut : r.signOut + 1440] as const);
    // Axis snaps to 4-hour marks so every tick is a round clock time.
    const TICK = 240;
    const axisMin = ranges.length ? Math.max(0, Math.floor((Math.min(...ranges.map((x) => x[0])) - 30) / TICK) * TICK) : 0;
    const axisMax = ranges.length ? Math.ceil((Math.max(...ranges.map((x) => x[1])) + 30) / TICK) * TICK : 1440;
    const roleCount = rows.length;
    const hasChartData = roleCount > 0;
    const chartHeight = Math.max(140, roleCount * 46 + 50);

    /** Globally the averages sit under an hour apart, which can't be a real shift (see analysis). */
    const globalSpan = globalSignIn != null && globalSignOut != null ? ((globalSignOut - globalSignIn) + 1440) % 1440 : null;
    const implausibleSpan = globalSpan != null && globalSpan < 60;

    const options: ApexCharts.ApexOptions = {
        chart: {
            type: "rangeBar",
            background: "transparent",
            toolbar: { show: false },
            zoom: { enabled: false },
        },
        // ApexCharts runs a horizontal gradient from gradientToColors to the base colour, so these
        // are swapped on purpose: the bar starts mint at sign-in and ends amber at sign-out.
        colors: [SIGN_OUT_COLOR],
        fill: {
            type: "gradient",
            gradient: { type: "horizontal", gradientToColors: [SIGN_IN_COLOR], stops: [0, 100], opacityFrom: 0.95, opacityTo: 0.95 },
        },
        plotOptions: {
            bar: { horizontal: true, borderRadius: 6, barHeight: roleCount <= 3 ? "42%" : "58%", rangeBarGroupRows: false },
        },
        dataLabels: {
            enabled: true,
            formatter: (_val, opts) => {
                const r = rows[opts?.dataPointIndex ?? 0];
                return r ? `${formatClockShort(r.signIn)} – ${formatClockShort(r.signOut)}` : "";
            },
            style: { fontSize: "11px", fontWeight: 700, colors: ["#fff"] },
            dropShadow: { enabled: false },
        },
        xaxis: {
            type: "numeric",
            min: axisMin,
            max: axisMax,
            tickAmount: (axisMax - axisMin) / TICK,
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: { formatter: (v) => formatHourTick(Number(v)) },
        },
        yaxis: { labels: { maxWidth: 200, style: { fontSize: "12px", fontWeight: 600, colors: "#4a5872" } } },
        grid: {
            strokeDashArray: 0,
            padding: { left: 16, right: 12 },
            xaxis: { lines: { show: true } },
            yaxis: { lines: { show: false } },
        },
        legend: { show: false },
        tooltip: {
            custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
                const r = rows[dataPointIndex];
                if (!r) return "";
                const span = ((r.signOut - r.signIn) + 1440) % 1440;
                return `<div class="an-tip"><div class="an-tip__title">${escapeHtml(r.fullName)}</div>`
                    + `<div class="an-tip__row"><span class="an-tip__dot" style="background:${SIGN_IN_COLOR}"></span>Avg sign-in <b>${formatClock(r.signIn)}</b></div>`
                    + `<div class="an-tip__row"><span class="an-tip__dot" style="background:${SIGN_OUT_COLOR}"></span>Avg sign-out <b>${formatClock(r.signOut)}</b></div>`
                    + `<div class="an-tip__foot">Span ${Math.floor(span / 60)}h ${span % 60}m</div></div>`;
            },
        },
    };

    const series = [
        {
            name: "Typical shift",
            data: rows.map((r, i) => ({ x: r.name, y: [ranges[i][0], ranges[i][1]] })),
        },
    ];

    return (
        <DashboardCard
            padding="none"
            className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3"
            style={{ boxSizing: "border-box", padding: 16 }}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <CardTitle icon="login" variant="body-md-semibold">Role Sign-In / Sign-Out Averages</CardTitle>
                    <Text variant="body-sm" color="text-secondary">Typical shift start and end · UTC</Text>
                </div>
                <Pill tone="blue" dot>Live</Pill>
            </div>

            <div className="an-metrics">
                <MetricTile icon="login" tone="mint" label="Avg sign-in" value={formatClock(globalSignIn)} />
                <MetricTile icon="logout" tone="amber" label="Avg sign-out" value={formatClock(globalSignOut)} />
                <MetricTile icon="badge" label="Roles tracked" value={roleCount} />
            </div>

            {/* flex-col (not row): in a flex row the chart container shrinks to its content width. */}
            <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
                {hasChartData ? (
                    <>
                        <div className="w-full" style={{ height: chartHeight }}>
                            <Chart options={options} series={series} type="rangeBar" height="100%" width="100%" />
                        </div>
                        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                            <Pill tone="mint" dot>Sign-in</Pill>
                            <Pill tone="amber" dot>Sign-out</Pill>
                        </div>
                    </>
                ) : (
                    <EmptyState
                        icon="schedule"
                        title="No per-role shift times yet"
                        hint="Sign-in and sign-out times per role appear once staff clock in during this period."
                    />
                )}
            </div>

            {implausibleSpan && (
                <Callout icon="info" tone="amber">
                    Average sign-in and sign-out are only {globalSpan} min apart, so they likely blend day and night shifts rather than describe one typical shift.
                </Callout>
            )}
        </DashboardCard>
    );
}
