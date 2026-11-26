"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import DashboardCard from "@/components/analytics/ugmc-dashboard/shared/dashboard-card";
import Text from "@/components/analytics/text";
import { IoCheckmarkCircle, IoTime } from "react-icons/io5";
import {
    fillDailyMessageVolumePeriod,
    fillDailyMessageVolumeRange,
} from "@/lib/analytics/daily-volume";
import { responseMinutes } from "@/lib/analytics/distribution-metrics";

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
    const yAxisMax = maxValue > 0 ? Math.ceil(maxValue * 1.15) : 10;
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
            foreColor: "var(--text-secondary)",
            fontFamily: "system-ui, -apple-system, sans-serif",
        },
        stroke: { curve: "smooth", width: 3, colors: ["#2E8BDF"] },
        fill: {
            type: "gradient",
            gradient: {
                shade: "light",
                type: "vertical",
                shadeIntensity: 0.2,
                opacityFrom: 0.55,
                opacityTo: 0.1,
                stops: [0, 100],
            },
        },
        dataLabels: { enabled: false },
        markers: { size: useWeekly ? 4 : 0, hover: { size: 5 }, colors: ["#2E8BDF"] },
        xaxis: {
            categories: dateCategories,
            labels: {
                style: { colors: "var(--text-secondary)", fontSize: "10px", fontFamily: "system-ui, -apple-system, sans-serif" },
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
            max: yAxisMax,
            tickAmount: 4,
            labels: {
                style: { colors: "var(--text-secondary)", fontSize: "10px", fontFamily: "system-ui, -apple-system, sans-serif" },
                formatter: (v) => String(Math.round(v)),
            },
        },
        grid: {
            borderColor: "var(--bg-tertiary)",
            strokeDashArray: 4,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
        },
        tooltip: {
            enabled: true,
            theme: "light",
            x: {
                formatter: (value: string) => {
                    const parsed = toDate(value);
                    if (!parsed) return value;
                    if (useWeekly) {
                        return `Week of ${parsed.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                        })}`;
                    }
                    return parsed.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                    });
                },
            },
        },
        colors: ["#2E8BDF"],
        legend: { show: false },
    };

    const series = [{ name: useWeekly ? "Weekly Standard Messages" : "Daily Standard Messages", data: standardSeries }];

    return (
        <DashboardCard
            padding="none"
            className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3"
            style={{ padding: 18 }}
        >
            <Text variant="body-md-semibold" color="text-primary">
                {useWeekly ? "Standard Messages by Week" : "Standard Messages by Day"}
            </Text>

            <div className="flex items-center gap-3">
                <div className="rounded-[8px] bg-secondary px-3 py-2">
                    <Text variant="body-sm" color="text-secondary">Median response time</Text>
                    <div className="flex items-center gap-2">
                        <Text variant="body-md-semibold" color="text-primary">{fmtMin(responseMinutes(data, "reply_all", ["avg_reply_response_minutes_all"]) ?? undefined)}</Text>
                        <IoTime className="text-text-secondary" />
                    </div>
                </div>
                <div className="rounded-[8px] bg-secondary px-3 py-2">
                    <Text variant="body-sm" color="text-secondary">Latest Day Standard Messages</Text>
                    <div className="flex items-center gap-2">
                        <Text variant="body-md-semibold" color="text-primary">{pendingStandard}</Text>
                        <IoCheckmarkCircle className="text-accent-primary" />
                    </div>
                </div>
            </div>

            <div className="min-h-[200px] w-full min-w-0 flex-1 lg:min-h-[220px]">
                {hasChartData ? (
                    <Chart options={options} series={series} type="area" height="100%" width="100%" />
                ) : (
                    <div className="flex h-full min-h-[200px] items-center justify-center rounded-[8px] border border-dashed border-tertiary bg-secondary/30 px-4">
                        <Text variant="body-sm" color="text-secondary" className="text-center">
                            No standard message volume for this period.
                        </Text>
                    </div>
                )}
            </div>
        </DashboardCard>
    );
}
