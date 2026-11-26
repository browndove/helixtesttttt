"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import DashboardCard from "@/components/analytics/ugmc-dashboard/shared/dashboard-card";
import Text from "@/components/analytics/text";
import {
    fillDailyMessageVolumePeriod,
    fillDailyMessageVolumeRange,
} from "@/lib/analytics/daily-volume";
import { responseMinutes } from "@/lib/analytics/distribution-metrics";
import { CardTitle } from "@/components/analytics/glass/illustrations";
import { EmptyState, MetricTile } from "@/components/analytics/glass/ui";
import { buildNiceYAxisScale } from "@/lib/analytics/nice-chart-axis";
import { areaWash, endpointAnnotation, glassTooltip, smoothLine } from "@/components/analytics/glass/chart-kit";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

function fmtMin(minutes?: number): string {
    if (!minutes || minutes <= 0) return "—";
    return `${minutes.toFixed(1)}min`;
}

function toDate(value: unknown): Date | null {
    if (typeof value !== "string" || !value.trim()) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfWeek(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0 Sun ... 6 Sat
    const diff = day === 0 ? -6 : 1 - day; // Monday start
    d.setDate(d.getDate() + diff);
    return d;
}

function dateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export default function LabTestsVolume({ data }: { data?: any }) {
    const filledDaily = useMemo(() => {
        const raw = Array.isArray(data?.daily_message_volume) ? data.daily_message_volume : [];
        const from =
            typeof data?.daily_message_volume_from === "string" ? data.daily_message_volume_from : null;
        const to = typeof data?.daily_message_volume_to === "string" ? data.daily_message_volume_to : null;
        if (from && to) return fillDailyMessageVolumeRange(raw, from, to);
        const windowDays = Number(data?.daily_message_volume_window_days);
        return fillDailyMessageVolumePeriod(raw, Number.isFinite(windowDays) && windowDays > 0 ? windowDays : 7);
    }, [
        data?.daily_message_volume,
        data?.daily_message_volume_from,
        data?.daily_message_volume_to,
        data?.daily_message_volume_window_days,
    ]);

    const parsedDaily = filledDaily
        .map((d) => ({
            date: toDate(d.day),
            value: Number(d.standard_messages || 0),
        }))
        .filter((d): d is { date: Date; value: number } => d.date instanceof Date)
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    // If range is long, aggregate to weekly totals to reduce visual crowding.
    const useWeekly = parsedDaily.length > 14;
    const aggregated = useWeekly
        ? (() => {
              const buckets = new Map<string, { date: Date; value: number }>();
              for (const item of parsedDaily) {
                  const wk = startOfWeek(item.date);
                  const key = dateKey(wk);
                  const existing = buckets.get(key);
                  if (existing) existing.value += item.value;
                  else buckets.set(key, { date: wk, value: item.value });
              }
              return Array.from(buckets.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
          })()
        : parsedDaily;

    const hasChartData = aggregated.length > 0;
    const dateCategories = hasChartData
        ? aggregated.map((d: { date: Date }) => dateKey(d.date))
        : [];
    const standardSeries = hasChartData
        ? aggregated.map((d: { value: number }) => d.value)
        : [];
    const maxValue = standardSeries.length ? Math.max(...standardSeries) : 0;
    const yScale = buildNiceYAxisScale(maxValue > 0 ? maxValue * 1.1 : 0, 4);
    const pendingStandard = parsedDaily.length ? parsedDaily[parsedDaily.length - 1].value : 0;
    const labelStep = Math.max(1, Math.ceil(dateCategories.length / 6));

    const options: ApexCharts.ApexOptions = {
        theme: { mode: "light" },
        chart: {
            type: "area",
            toolbar: { show: false },
            zoom: { enabled: false },
            sparkline: { enabled: false },
            background: "transparent",
        },
        stroke: smoothLine(["#2f6fb8"]),
        fill: areaWash(),
        annotations: standardSeries.length
            ? endpointAnnotation(dateCategories[dateCategories.length - 1], standardSeries[standardSeries.length - 1], "#2f6fb8", standardSeries[standardSeries.length - 1].toLocaleString())
            : undefined,
        dataLabels: { enabled: false },
        markers: { size: useWeekly ? 4 : 0, colors: ["#2f6fb8"] },
        xaxis: {
            categories: dateCategories,
            labels: {
                style: { fontSize: "11px" },
                hideOverlappingLabels: true,
                formatter: (value: string, _timestamp?: number, opts?: any) => {
                    const idx = opts?.dataPointIndex ?? 0;
                    if (idx % labelStep !== 0) return "";
                    const parsed = toDate(value);
                    if (!parsed) return `D${idx + 1}`;
                    return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                },
            },
            axisBorder: { show: false },
            axisTicks: { show: false },
        },
        yaxis: {
            min: 0,
            max: yScale.max,
            tickAmount: yScale.tickAmount,
            labels: {
                style: { fontSize: "11px" },
                formatter: (v) => String(Math.round(v)),
            },
        },
        grid: { padding: { right: 18 } },
        tooltip: {
            custom: ({ series, dataPointIndex }: { series: number[][]; dataPointIndex: number }) => {
                const parsed = toDate(dateCategories[dataPointIndex] ?? "");
                const title = !parsed
                    ? String(dateCategories[dataPointIndex] ?? "")
                    : useWeekly
                      ? `Week of ${parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                      : parsed.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
                return glassTooltip({
                    title,
                    rows: [{ color: "#2f6fb8", label: "Standard messages", value: Number(series[0]?.[dataPointIndex] ?? 0).toLocaleString() }],
                });
            },
        },
        colors: ["#2f6fb8"],
        legend: { show: false },
    };

    const periodTotal = standardSeries.reduce((sum, v) => sum + (Number(v) || 0), 0);
    const series = [{ name: useWeekly ? "Weekly Standard Messages" : "Daily Standard Messages", data: standardSeries }];

    return (
        <DashboardCard data-watermark="forum"
            padding="none"
            className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3"
            style={{ padding: 18 }}
        >
            <div className="flex flex-col gap-0.5">
                <CardTitle icon="mail">
                    {useWeekly ? "Standard Messages by Week" : "Standard Messages by Day"}
                </CardTitle>
                <Text variant="body-sm" color="text-secondary">Non-critical message volume</Text>
            </div>

            <div className="an-metrics">
                <MetricTile
                    icon="schedule"
                    label="Median reply"
                    value={fmtMin(responseMinutes(data, "reply_all", ["avg_reply_response_minutes_all"]) ?? undefined)}
                    hint="Median time to reply to a message"
                />
                <MetricTile icon="today" tone="mint" label={useWeekly ? "Latest week" : "Latest day"} value={pendingStandard} />
                <MetricTile icon="functions" tone="slate" label="Period total" value={periodTotal.toLocaleString()} />
            </div>

            <div className="flex min-h-[200px] w-full min-w-0 flex-1 flex-col lg:min-h-[220px]">
                {hasChartData ? (
                    <Chart options={options} series={series} type="area" height="100%" width="100%" />
                ) : (
                    <EmptyState icon="forum" title="No standard messages" hint="Non-critical message volume for this period will chart here." />
                )}
            </div>
        </DashboardCard>
    );
}
