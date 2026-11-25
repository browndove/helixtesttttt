"use client";

import * as React from "react";
import Text from "@/components/analytics/text";
import DashboardCard from "@/components/analytics/ugmc-dashboard/shared/dashboard-card";
import dynamic from "next/dynamic";
import InfoTooltip from "@/components/analytics/info-tooltip";
import { RiExpandDiagonalLine } from "react-icons/ri";
import { GrContract } from "react-icons/gr";
import FullscreenOverlay from "@/components/analytics/fullscreen-overlay";
import { CardTitle } from "@/components/analytics/glass/illustrations";
import { EmptyState, Pill } from "@/components/analytics/glass/ui";
import { shortRoleName } from "@/lib/analytics/role-name";
import { barSheen, glassTooltip } from "@/components/analytics/glass/chart-kit";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const MAX_ROLES = 8;

/** Legend thresholds — bar colours must follow these exactly. */
const RISK_TONES = [
    { from: 50, color: "#e0656b" },
    { from: 20, color: "#e5a73b" },
    { from: 0, color: "#2f6fb8" },
] as const;

type RoleMetric = {
    role_id?: string;
    role_name?: string;
    critical_messages?: number;
    escalated_critical_messages?: number;
    escalation_rate_percent?: number;
};

type RiskRow = { id: string; name: string; fullName: string; rate: number; escalated: number; alerts: number };

function num(v: unknown): number {
    const n = typeof v === "string" ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
}

function riskColor(rate: number): string {
    return (RISK_TONES.find((t) => rate >= t.from) ?? RISK_TONES[RISK_TONES.length - 1]).color;
}

/** One decimal below 10% so small-but-real rates never round down to "0%". */
function formatRate(rate: number): string {
    return rate < 10 ? `${rate.toFixed(1)}%` : `${Math.round(rate)}%`;
}

/**
 * Per-role escalation rate = escalated critical messages ÷ critical messages ("alerts"), from
 * role_metrics. (top_escalated_roles only carries a count, so it cannot give a rate.)
 */
function buildRiskRows(roleMetrics: unknown): RiskRow[] {
    if (!Array.isArray(roleMetrics)) return [];
    return (roleMetrics as RoleMetric[])
        .map((r, i) => {
            const alerts = num(r.critical_messages);
            const escalated = num(r.escalated_critical_messages);
            const rate = alerts > 0 ? (escalated / alerts) * 100 : num(r.escalation_rate_percent);
            const fullName = String(r.role_name || "Role").trim();
            return { id: r.role_id || `${i}-${fullName}`, name: shortRoleName(fullName), fullName, rate, escalated, alerts };
        })
        .filter((r) => r.rate > 0)
        .sort((a, b) => b.rate - a.rate || b.alerts - a.alerts || a.name.localeCompare(b.name))
        .slice(0, MAX_ROLES);
}

const EscalationRiskByRole: React.FC<{ data?: any }> = ({ data }) => {
    const [isMaximized, setIsMaximized] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);
    const rows = React.useMemo(() => buildRiskRows(data?.role_metrics), [data]);
    const windowDays = data?.window_days ?? 30;

    const maxRate = rows.length ? Math.max(...rows.map((r) => r.rate)) : 0;
    const axisMax = Math.min(100, Math.max(10, Math.ceil(maxRate / 10) * 10));

    const chartOptions: ApexCharts.ApexOptions = {
        chart: { type: "bar", background: "transparent", toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: true, speed: 700 } },
        colors: rows.map((r) => riskColor(r.rate)),
        fill: barSheen(true),
        plotOptions: {
            bar: {
                horizontal: true,
                distributed: true,
                borderRadius: 7,
                borderRadiusApplication: "end",
                barHeight: rows.length <= 3 ? "40%" : "52%",
                dataLabels: { position: "top" },
                colors: { backgroundBarColors: ["rgba(27,42,68,0.035)"], backgroundBarRadius: 7 },
            },
        },
        dataLabels: {
            enabled: true,
            textAnchor: "start",
            offsetX: 8,
            formatter: (_val: number, opts?: any) => {
                const r = rows[opts?.dataPointIndex ?? 0];
                return r ? formatRate(r.rate) : "";
            },
            style: { fontSize: "12px", fontWeight: 700, colors: ["#1b2a44"] },
        },
        xaxis: {
            // Two-line labels: role name, then the counts behind the percentage.
            categories: rows.map((r) => [
                r.name.length > 30 ? `${r.name.slice(0, 29)}…` : r.name,
                `${r.escalated} of ${r.alerts} alerts`,
            ]),
            min: 0,
            max: axisMax,
            tickAmount: axisMax <= 20 ? axisMax / 5 : 5,
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: { formatter: (val: string) => `${Math.round(Number(val))}%` },
        },
        yaxis: { labels: { maxWidth: 200, style: { fontSize: "12px", fontWeight: 600, colors: "#4a5872" } } },
        grid: {
            padding: { left: 16, right: 44 },
            xaxis: { lines: { show: true } },
            yaxis: { lines: { show: false } },
        },
        legend: { show: false },
        tooltip: {
            custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
                const r = rows[dataPointIndex];
                if (!r) return "";
                return glassTooltip({
                    title: r.fullName,
                    rows: [
                        { color: riskColor(r.rate), label: "Escalation rate", value: formatRate(r.rate) },
                        { label: "Escalated alerts", value: `${r.escalated} of ${r.alerts}` },
                    ],
                });
            },
        },
    };

    // Height follows the row count so a short list doesn't leave a tall empty plot.
    const chartHeight = Math.max(150, rows.length * 52 + 50);

    const chartContent = (isModal: boolean = false) => (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <CardTitle icon="report" variant={isModal ? "body-lg-semibold" : "body-md-semibold"} className="font-bold">Escalation Risk by Role</CardTitle>
                    <Text variant="body-sm" color="text-secondary">
                        Highest escalation rate first · Last {windowDays} days
                    </Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {!isModal && rows.length > 0 && (
                        <button onClick={() => setIsMaximized(true)} className="flex items-center justify-center size-[30px] bg-secondary rounded-[10px] cursor-pointer hover:bg-tertiary transition-colors" title="Maximize">
                            <RiExpandDiagonalLine className="size-4 text-text-primary" />
                        </button>
                    )}
                    {isModal && (
                        <button onClick={() => setIsMaximized(false)} className="flex items-center justify-center size-[30px] bg-secondary rounded-[10px] cursor-pointer hover:bg-tertiary transition-colors" title="Close">
                            <GrContract className="size-4 text-text-primary" />
                        </button>
                    )}
                    <InfoTooltip text="Share of each role's critical alerts that escalated (escalated ÷ critical alerts). Roles with no escalations are hidden." show={isHovered} />
                </div>
            </div>

            {rows.length === 0 ? (
                <EmptyState
                    icon="verified"
                    title={`No escalations in the last ${windowDays} days`}
                    hint="Every critical alert was handled before it needed to escalate."
                />
            ) : (
                <>
                    <div className="w-full" style={{ height: isModal ? 500 : chartHeight }}>
                        <Chart options={chartOptions} series={[{ name: "Escalation rate", data: rows.map((r) => Number(r.rate.toFixed(2))) }]} type="bar" width="100%" height="100%" />
                    </div>
                    <div className="mt-auto flex flex-wrap items-center gap-2">
                        <Pill tone="blue" dot>Under 20%</Pill>
                        <Pill tone="amber" dot>20–50%</Pill>
                        <Pill tone="rose" dot>50%+ escalated</Pill>
                    </div>
                </>
            )}
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

export default EscalationRiskByRole;
