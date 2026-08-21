'use client';

import { useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import type { NamedCount, StoreAnalytics, StoreDailyPoint, DownloadAnalyticsData } from '@/lib/download-analytics-mock';
import { downloadAnalyticsPresetRange, emptyStoreAnalytics } from '@/lib/download-analytics-mock';
import DashboardCard from '@/components/ugmc-dashboard/shared/dashboard-card';
import Text from '@/components/text';
import InfoTooltip from '@/components/info-tooltip';
import FullscreenOverlay from '@/components/fullscreen-overlay';
import CalendarRangePicker from '@/components/CalendarRangePicker';
import clsx from 'clsx';
import { RiExpandDiagonalLine } from 'react-icons/ri';
import { GrContract } from 'react-icons/gr';
import type { DownloadsDashboardTab } from '@/components/internal-downloads/InternalDownloadsSidebar';
import type { PlatformFilterValue } from '@/components/internal-downloads/PlatformFilter';
import { ANALYTICS_CHART_DEFS } from '@/lib/app-store-metric-defs';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export function fmtCount(n: number): string {
    if (!Number.isFinite(n) || n === 0) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function fmtMetric(n: number, kind: 'count' | 'percent' | 'rating' = 'count'): string {
    if (kind === 'rating') {
        if (!Number.isFinite(n) || n <= 0) return 'N/A';
        return n.toFixed(1);
    }
    if (!Number.isFinite(n) || n <= 0) return kind === 'percent' ? '0.0%' : '0';
    if (kind === 'percent') return `${n.toFixed(1)}%`;
    return fmtCount(n);
}

export function dailyToChart(
    daily: StoreDailyPoint[],
    key: keyof StoreDailyPoint,
    secondary?: keyof StoreDailyPoint,
) {
    return daily.map((row) => ({
        day: row.day,
        total_messages: Number(row[key]) || 0,
        critical_messages: secondary ? Number(row[secondary]) || 0 : Number(row[key]) || 0,
        standard_messages: Number(row[key]) || 0,
    }));
}

export function mergeDailySeries(
    iosDaily: StoreDailyPoint[],
    androidDaily: StoreDailyPoint[],
    iosKey: keyof StoreDailyPoint,
    androidKey: keyof StoreDailyPoint,
) {
    const iosMap = new Map(iosDaily.map((row) => [row.day, row]));
    const androidMap = new Map(androidDaily.map((row) => [row.day, row]));
    const days = [...new Set([...iosMap.keys(), ...androidMap.keys()])].sort();
    return days.map((day) => {
        const iosVal = Number(iosMap.get(day)?.[iosKey]) || 0;
        const androidVal = Number(androidMap.get(day)?.[androidKey]) || 0;
        return {
            day,
            total_messages: iosVal + androidVal,
            critical_messages: iosVal,
            standard_messages: androidVal,
        };
    });
}

export function mergeNamedCounts(...lists: NamedCount[][]): NamedCount[] {
    const map = new Map<string, number>();
    for (const list of lists) {
        for (const item of list) {
            const name = item.name.trim();
            if (!name || item.count <= 0) continue;
            map.set(name, (map.get(name) || 0) + item.count);
        }
    }
    return [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count: Math.round(count) }));
}

export function blendedPercent(parts: { rate: number; weight: number }[]): number {
    const usable = parts.filter((part) => part.rate > 0 && part.weight > 0);
    const weight = usable.reduce((sum, part) => sum + part.weight, 0);
    if (weight <= 0) return 0;
    return Math.round((usable.reduce((sum, part) => sum + part.rate * part.weight, 0) / weight) * 10) / 10;
}

export function dataFreshnessText(ios: StoreAnalytics, android: StoreAnalytics, platform: PlatformFilterValue): string {
    const iosDate = ios.data_through;
    const androidDate = android.data_through;
    if (platform === 'ios') return iosDate ? `Data through ${iosDate}.` : '';
    if (platform === 'android') return androidDate ? `Data through ${androidDate}.` : '';
    const parts: string[] = [];
    if (iosDate) parts.push(`iOS ${iosDate}`);
    if (androidDate) parts.push(`Android ${androidDate}`);
    return parts.length > 0 ? `Data through ${parts.join(', ')}.` : '';
}

export function resolveStores(data: DownloadAnalyticsData): { ios: StoreAnalytics; android: StoreAnalytics } {
    const ios = data.ios_store ? { ...data.ios_store } : emptyStoreAnalytics();
    const android = data.android_store ? { ...data.android_store } : emptyStoreAnalytics();
    if (!data.ios_store) {
        ios.avg_rating = data.avg_rating;
        ios.rating_count = data.rating_count;
        ios.reports_pending = true;
    }
    if (!data.android_store) {
        android.device_installs = data.total_play_installs;
        android.user_installs = data.total_play_installs;
        android.installations = data.total_play_installs;
        android.active_devices = data.android_active_devices ?? 0;
        android.avg_rating = data.android_avg_rating ?? 0;
        android.breakdowns.versions = (data.android_version_breakdown ?? []).map((row) => ({
            name: row.version,
            count: row.installs,
        }));
        android.breakdowns.territories = data.regions
            .filter((row) => (row.android_installs ?? 0) > 0)
            .map((row) => ({ name: row.region, count: row.android_installs ?? 0 }));
        android.daily = data.daily_downloads.map((row) => ({
            day: row.day,
            first_time_downloads: row.play_installs ?? 0,
            redownloads: 0,
            total_downloads: row.play_installs ?? 0,
            updates: 0,
            impressions: 0,
            unique_impressions: 0,
            page_views: 0,
            unique_page_views: 0,
            sessions: 0,
            active_devices: 0,
            installations: row.play_installs ?? 0,
            deletions: 0,
            crashes: 0,
            anrs: 0,
            user_installs: row.play_installs ?? 0,
            device_installs: row.play_installs ?? 0,
            user_uninstalls: 0,
            device_uninstalls: 0,
            upgrades: 0,
            listing_visitors: 0,
            listing_acquisitions: 0,
        }));
        android.reports_pending = android.device_installs === 0;
    }
    return { ios, android };
}

const DATE_OPTIONS = [
    { value: 7, label: '7d' },
    { value: 30, label: '30d' },
    { value: 90, label: '90d' },
];

function formatRangeDay(day: string): string {
    const date = new Date(`${day}T00:00:00`);
    if (Number.isNaN(date.getTime())) return day;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function downloadsDateRangeLabel(from: string, to: string): string {
    const today = new Date().toISOString().slice(0, 10);
    for (const option of DATE_OPTIONS) {
        const preset = downloadAnalyticsPresetRange(option.value);
        if (from === preset.from && to === today && to === preset.to) {
            return `last ${option.value} days`;
        }
    }
    if (from === to) return formatRangeDay(from);
    return `${formatRangeDay(from)} – ${formatRangeDay(to)}`;
}

export function DateRangeFilter({
    from,
    to,
    onChange,
}: {
    from: string;
    to: string;
    onChange: (from: string, to: string) => void;
}) {
    const today = new Date().toISOString().slice(0, 10);
    const activePreset = DATE_OPTIONS.find((option) => {
        const preset = downloadAnalyticsPresetRange(option.value);
        return from === preset.from && to === today && to === preset.to;
    })?.value ?? null;

    return (
        <div className="downloads-date-filter" role="group" aria-label="Date range">
            <div className="inline-flex items-center rounded-lg border border-border-subtle bg-secondary p-0.5">
                {DATE_OPTIONS.map((option) => {
                    const active = activePreset === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                const preset = downloadAnalyticsPresetRange(option.value);
                                onChange(preset.from, preset.to);
                            }}
                            className={clsx(
                                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                                active
                                    ? 'bg-[rgba(41,128,211,0.14)] text-accent-primary'
                                    : 'text-text-muted hover:text-text-primary',
                            )}
                            aria-pressed={active}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>
            <CalendarRangePicker from={from} to={to} onChange={onChange} />
        </div>
    );
}

export function OptInBadge() {
    return (
        <span className="inline-flex items-center rounded-full bg-[rgba(232,155,0,0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-orange">
            Opt-in only
        </span>
    );
}

export function PageToolbar({
    title,
    subtitle,
    pending,
    extra,
}: {
    title: string;
    subtitle: string;
    pending?: boolean;
    extra?: ReactNode;
}) {
    return (
        <div className="downloads-page-toolbar">
            <div className="min-w-0">
                <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
                <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
                {pending && (
                    <p className="mt-1 text-xs text-accent-orange">
                        Some App Store Analytics reports are still generating (usually 24–48 hours after first request).
                    </p>
                )}
            </div>
            <div className="downloads-page-toolbar__filters">{extra}</div>
        </div>
    );
}

const TABS: { id: DownloadsDashboardTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'acquisition', label: 'Acquisition' },
    { id: 'retention', label: 'Retention' },
    { id: 'metrics', label: 'Metrics' },
];

export function DownloadsMobileTabs({
    activeTab,
    onTabChange,
}: {
    activeTab: DownloadsDashboardTab;
    onTabChange: (tab: DownloadsDashboardTab) => void;
}) {
    return (
        <div className="downloads-mobile-tabs" role="tablist" aria-label="Downloads sections">
            {TABS.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={clsx(
                        'downloads-mobile-tabs__item',
                        activeTab === tab.id && 'is-active',
                    )}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

const SHARE_COLORS = ['#1A78C4', '#00B4A0', '#5560F2', '#E39200', '#EE4A42', '#6B7C8A'];

function totalCount(items: NamedCount[]): number {
    return items.reduce((sum, item) => sum + item.count, 0);
}

function shareOf(count: number, total: number): number {
    return total > 0 ? (count / total) * 100 : 0;
}

function ExpandButton({ expanded, onClick }: { expanded: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            onClick={onClick}
            className="flex size-[30px] items-center justify-center rounded-[10px] bg-tertiary transition-all duration-300 hover:scale-110 hover:bg-quaternary"
        >
            {expanded ? (
                <GrContract className="size-4 text-text-primary" />
            ) : (
                <RiExpandDiagonalLine className="size-4 text-text-primary" />
            )}
        </button>
    );
}

function BreakdownHeader({
    title,
    subtitle,
    infoText,
    badge,
    hiddenCount,
    expanded,
    onToggle,
}: {
    title: string;
    subtitle?: string;
    infoText?: string;
    badge?: ReactNode;
    hiddenCount: number;
    expanded: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="mb-4 flex items-start justify-between gap-2">
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <Text variant="body-md-semibold" color="text-primary">{title}</Text>
                    {infoText && <InfoTooltip text={infoText} />}
                </div>
                {subtitle && <p className="mt-1 text-xs text-text-muted">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2">
                {badge}
                {hiddenCount > 0 && <ExpandButton expanded={expanded} onClick={onToggle} />}
            </div>
        </div>
    );
}

export type BreakdownChartType = 'bar' | 'column' | 'donut' | 'treemap' | 'polar';

function NamedCountChart({
    items,
    type,
    expanded,
}: {
    items: NamedCount[];
    type: BreakdownChartType;
    expanded: boolean;
}) {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark' || resolvedTheme === 'blue';
    const names = items.map((item) => item.name);
    const counts = items.map((item) => item.count);
    const total = totalCount(items);
    const height = expanded
        ? (type === 'bar' ? Math.min(640, Math.max(400, items.length * 44)) : 460)
        : (type === 'bar' ? Math.max(260, items.length * 52) : 280);
    const labelColor = 'var(--text-secondary)';
    const tooltip: ApexCharts.ApexTooltip = {
        theme: isDark ? 'dark' : 'light',
        style: { fontSize: '12px', fontFamily: 'Montserrat' },
        y: { formatter: (val: number) => fmtCount(val) },
    };
    const chartBase: ApexCharts.ApexOptions = {
        chart: {
            toolbar: { show: false },
            fontFamily: 'Montserrat',
            animations: { enabled: true, speed: 650 },
        },
        colors: SHARE_COLORS,
        tooltip,
        grid: {
            borderColor: 'var(--bg-tertiary)',
            strokeDashArray: 4,
            xaxis: { lines: { show: false } },
        },
        legend: {
            show: type === 'donut' || type === 'polar',
            fontSize: '12px',
            fontWeight: 600,
            labels: { colors: labelColor },
        },
    };

    if (type === 'donut') {
        return (
            <div className="downloads-breakdown-chart">
                <Chart
                    type="donut"
                    width="100%"
                    height={height}
                    series={counts}
                    options={{
                        ...chartBase,
                        labels: names,
                        stroke: { width: 0 },
                        dataLabels: { enabled: true, formatter: (val: number) => `${Math.round(val)}%` },
                        plotOptions: {
                            pie: {
                                donut: {
                                    size: '62%',
                                    labels: {
                                        show: true,
                                        name: { show: false },
                                        value: { show: false },
                                        total: {
                                            show: true,
                                            label: 'Total',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            color: labelColor,
                                            formatter: () => fmtCount(total),
                                        },
                                    },
                                },
                            },
                        },
                    }}
                />
            </div>
        );
    }

    if (type === 'polar') {
        return (
            <div className="downloads-breakdown-chart">
                <Chart
                    type="polarArea"
                    width="100%"
                    height={height}
                    series={counts}
                    options={{
                        ...chartBase,
                        labels: names,
                        stroke: { colors: ['transparent'] },
                        fill: { opacity: 0.85 },
                        yaxis: { show: false },
                        plotOptions: { polarArea: { rings: { strokeWidth: 0 } } },
                        dataLabels: { enabled: false },
                    }}
                />
            </div>
        );
    }

    if (type === 'treemap') {
        return (
            <div className="downloads-breakdown-chart">
                <Chart
                    type="treemap"
                    width="100%"
                    height={height}
                    series={[{ data: items.map((item) => ({ x: item.name, y: item.count })) }]}
                    options={{
                        ...chartBase,
                        legend: { show: false },
                        dataLabels: {
                            enabled: true,
                            formatter: (text, opts) => `${text}: ${fmtCount(Number(opts?.value ?? 0))}`,
                            style: { fontSize: '11px', fontWeight: 700 },
                        },
                        plotOptions: {
                            treemap: {
                                distributed: true,
                                enableShades: false,
                                borderRadius: 8,
                            },
                        },
                    }}
                />
            </div>
        );
    }

    if (type === 'column') {
        return (
            <div className="downloads-breakdown-chart">
                <Chart
                    type="bar"
                    width="100%"
                    height={height}
                    series={[{ name: 'Count', data: counts }]}
                    options={{
                        ...chartBase,
                        legend: { show: false },
                        plotOptions: { bar: { columnWidth: '62%', borderRadius: 6, distributed: true } },
                        dataLabels: {
                            enabled: true,
                            formatter: (val: number) => fmtCount(val),
                            style: { fontSize: '12px', fontWeight: 800, colors: ['#ffffff'] },
                        },
                        xaxis: {
                            categories: names,
                            labels: {
                                rotate: names.length > 4 ? -35 : 0,
                                hideOverlappingLabels: true,
                                style: { colors: labelColor, fontSize: '11px', fontWeight: 600 },
                            },
                            axisBorder: { show: false },
                            axisTicks: { show: false },
                        },
                        yaxis: {
                            min: 0,
                            labels: {
                                formatter: (val: number) => fmtCount(val),
                                style: { colors: labelColor, fontSize: '11px' },
                            },
                        },
                    }}
                />
            </div>
        );
    }

    return (
        <div className="downloads-breakdown-chart">
            <Chart
                type="bar"
                width="100%"
                height={height}
                series={[{ name: 'Count', data: counts }]}
                options={{
                    ...chartBase,
                    legend: { show: false },
                    plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '78%', distributed: true } },
                    dataLabels: {
                        enabled: true,
                        formatter: (val: number) => fmtCount(val),
                        style: { fontSize: '13px', fontWeight: 800, colors: ['#ffffff'] },
                    },
                    xaxis: {
                        categories: names,
                        labels: {
                            formatter: (val: string) => fmtCount(Number(val) || 0),
                            style: { colors: labelColor, fontSize: '11px' },
                        },
                        axisBorder: { show: false },
                        axisTicks: { show: false },
                    },
                    yaxis: {
                        labels: { maxWidth: 140, style: { colors: 'var(--text-primary)', fontSize: '12px', fontWeight: 700 } },
                    },
                }}
            />
        </div>
    );
}

function ExpandableCard({
    title,
    subtitle,
    infoText,
    items,
    emptyText,
    badge,
    previewCount,
    children,
}: {
    title: string;
    subtitle?: string;
    infoText?: string;
    items: NamedCount[];
    emptyText: string;
    badge?: ReactNode;
    previewCount: number;
    children: (rows: NamedCount[], expanded: boolean) => ReactNode;
}) {
    const [fullscreen, setFullscreen] = useState(false);
    const preview = items.slice(0, previewCount);
    const hiddenCount = Math.max(0, items.length - previewCount);

    const CardBody = ({ rows, expanded, heightClass }: { rows: NamedCount[]; expanded: boolean; heightClass?: string }) => (
        <div className={clsx('bg-primary rounded-[15px] shadow-soft flex min-w-0 flex-col p-5 sm:p-6', heightClass)}>
            <BreakdownHeader
                title={title}
                subtitle={subtitle}
                infoText={infoText}
                badge={badge}
                hiddenCount={hiddenCount}
                expanded={expanded}
                onToggle={() => setFullscreen(!expanded)}
            />
            {items.length === 0 ? (
                <p className="text-sm text-text-muted">{emptyText}</p>
            ) : (
                <>
                    <div className={clsx('min-w-0 flex-1', expanded && 'overflow-y-auto pr-1')}>
                        {children(rows, expanded)}
                    </div>
                    {!expanded && hiddenCount > 0 && (
                        <button
                            type="button"
                            onClick={() => setFullscreen(true)}
                            className="mt-2 self-start text-xs font-extrabold text-accent-primary hover:underline"
                        >
                            Show {hiddenCount} more
                        </button>
                    )}
                </>
            )}
        </div>
    );

    return (
        <>
            <CardBody rows={preview} expanded={false} heightClass="h-full" />
            {fullscreen && (
                <FullscreenOverlay onClose={() => setFullscreen(false)}>
                    <div className="h-[min(80vh,720px)] w-[min(920px,calc(100vw-2rem))]">
                        <CardBody rows={items} expanded heightClass="h-full" />
                    </div>
                </FullscreenOverlay>
            )}
        </>
    );
}

export function BreakdownCard({
    title,
    subtitle,
    items,
    emptyText = 'No breakdown for this window.',
    badge,
    previewCount = 5,
    infoText,
    chart = 'bar',
}: {
    title: string;
    subtitle?: string;
    items: NamedCount[];
    emptyText?: string;
    badge?: ReactNode;
    previewCount?: number;
    infoText?: string;
    chart?: BreakdownChartType;
}) {
    return (
        <ExpandableCard
            title={title}
            subtitle={subtitle}
            infoText={infoText ?? `${title} for the selected store and date range.`}
            items={items}
            emptyText={emptyText}
            badge={badge}
            previewCount={previewCount}
        >
            {(rows, expanded) => <NamedCountChart items={rows} type={chart} expanded={expanded} />}
        </ExpandableCard>
    );
}

export function ShareMixCard({
    title,
    subtitle,
    items,
    emptyText = 'No mix for this window.',
    previewCount = 5,
    infoText,
}: {
    title: string;
    subtitle?: string;
    items: NamedCount[];
    emptyText?: string;
    previewCount?: number;
    infoText?: string;
}) {
    const [fullscreen, setFullscreen] = useState(false);
    const total = totalCount(items);
    const top = items.slice(0, previewCount);
    const restCount = totalCount(items.slice(previewCount));
    const slices = restCount > 0 ? [...top, { name: 'Other', count: restCount }] : top;
    const hiddenCount = Math.max(0, items.length - previewCount);
    const gradient = slices.length === 0 || total <= 0
        ? 'var(--bg-secondary, #eef2f5)'
        : (() => {
            let start = 0;
            const stops = slices.map((slice, index) => {
                const end = start + shareOf(slice.count, total);
                const color = SHARE_COLORS[index % SHARE_COLORS.length];
                const stop = `${color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
                start = end;
                return stop;
            });
            return `conic-gradient(${stops.join(', ')})`;
        })();

    const CardBody = ({ expanded, heightClass }: { expanded: boolean; heightClass?: string }) => (
        <div className={clsx('bg-primary rounded-[15px] shadow-soft flex min-w-0 flex-col p-5 sm:p-6', heightClass)}>
            <BreakdownHeader
                title={title}
                subtitle={subtitle}
                infoText={infoText ?? `${title} for the selected store and date range.`}
                hiddenCount={hiddenCount}
                expanded={expanded}
                onToggle={() => setFullscreen(!expanded)}
            />
            {items.length === 0 ? (
                <p className="text-sm text-text-muted">{emptyText}</p>
            ) : (
                <>
                    <div className={clsx('downloads-share-mix', expanded && 'min-h-0 flex-1 overflow-y-auto')}>
                        <div className="downloads-share-mix__ring" style={{ background: gradient }} aria-hidden>
                            <span>{fmtCount(total)}</span>
                        </div>
                        <div className="downloads-share-mix__legend">
                            {(expanded ? items : slices).map((item, index) => (
                                <div key={item.name} className="downloads-share-mix__row">
                                    <i style={{ background: SHARE_COLORS[index % SHARE_COLORS.length] }} />
                                    <span className="downloads-share-mix__name" title={item.name}>{item.name}</span>
                                    <strong>{shareOf(item.count, total).toFixed(0)}%</strong>
                                    <em>{fmtCount(item.count)}</em>
                                </div>
                            ))}
                        </div>
                    </div>
                    {!expanded && hiddenCount > 0 && (
                        <button
                            type="button"
                            onClick={() => setFullscreen(true)}
                            className="mt-4 self-start text-xs font-bold text-accent-primary hover:underline"
                        >
                            Show {hiddenCount} more
                        </button>
                    )}
                </>
            )}
        </div>
    );

    return (
        <>
            <CardBody expanded={false} heightClass="h-full" />
            {fullscreen && (
                <FullscreenOverlay onClose={() => setFullscreen(false)}>
                    <div className="h-[min(80vh,720px)] w-[min(920px,calc(100vw-2rem))]">
                        <CardBody expanded heightClass="h-full" />
                    </div>
                </FullscreenOverlay>
            )}
        </>
    );
}

export function ChipBreakdown({
    title,
    subtitle,
    items,
    emptyText = 'No values in this window.',
    previewCount = 5,
    infoText,
    chart = 'treemap',
}: {
    title: string;
    subtitle?: string;
    items: NamedCount[];
    emptyText?: string;
    previewCount?: number;
    infoText?: string;
    chart?: BreakdownChartType;
}) {
    return (
        <ExpandableCard
            title={title}
            subtitle={subtitle}
            infoText={infoText ?? `${title} for the selected store and date range.`}
            items={items}
            emptyText={emptyText}
            previewCount={previewCount}
        >
            {(rows, expanded) => <NamedCountChart items={rows} type={chart} expanded={expanded} />}
        </ExpandableCard>
    );
}

export function AcquisitionFunnel({
    steps,
    infoText,
}: {
    steps: { label: string; value: string; info: string }[];
    infoText: string;
}) {
    return (
        <div className="downloads-funnel">
            <div className="downloads-funnel__head">
                <Text variant="body-md-semibold" color="text-primary">Discovery to install</Text>
                <InfoTooltip text={infoText} />
            </div>
            <div className="downloads-funnel__steps">
                {steps.map((step) => (
                    <div key={step.label} className="downloads-funnel__card">
                        <div className="downloads-funnel__label">
                            <span>{step.label}</span>
                            <InfoTooltip text={step.info} />
                        </div>
                        <strong>{step.value}</strong>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function DownloadsKpiCard({
    icon,
    iconBgColor,
    label,
    value,
    infoText,
    iosValue,
    androidValue,
}: {
    icon: ReactNode;
    iconBgColor: string;
    label: string;
    value: string;
    infoText?: string;
    iosValue: string;
    androidValue: string;
}) {
    return (
        <div className="downloads-kpi-card">
            <div className="downloads-kpi-card__head">
                <div className={clsx('downloads-kpi-card__icon', iconBgColor)}>{icon}</div>
                {infoText && <InfoTooltip text={infoText} />}
            </div>
            <div className="downloads-kpi-card__main">
                <span className="downloads-kpi-card__label">{label}</span>
                <span className="downloads-kpi-card__value">{value}</span>
            </div>
            <div className="downloads-kpi-card__split">
                <div>
                    <span className="downloads-kpi-card__platform">
                        <i className="downloads-kpi-card__dot downloads-kpi-card__dot--ios" />
                        iOS
                    </span>
                    <strong>{iosValue}</strong>
                </div>
                <div className="downloads-kpi-card__split-end">
                    <span className="downloads-kpi-card__platform">
                        <i className="downloads-kpi-card__dot downloads-kpi-card__dot--android" />
                        Android
                    </span>
                    <strong>{androidValue}</strong>
                </div>
            </div>
        </div>
    );
}

export function RetentionBars({
    d1, d7, d14, d28, pending,
    infoText = ANALYTICS_CHART_DEFS.retention,
}: {
    d1: number;
    d7: number;
    d14: number;
    d28: number;
    pending?: boolean;
    infoText?: string;
}) {
    const bars = [
        { label: 'Day 1', value: d1 },
        { label: 'Day 7', value: d7 },
        { label: 'Day 14', value: d14 },
        { label: 'Day 28', value: d28 },
    ];
    return (
        <DashboardCard className="h-full p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Text variant="body-md-semibold" color="text-primary">Average Retention</Text>
                    {infoText && <InfoTooltip text={infoText} />}
                </div>
                <OptInBadge />
            </div>
            {pending && bars.every((bar) => bar.value <= 0) ? (
                <p className="text-sm text-text-muted">Retention appears once App Store usage reports are available (opt-in users only).</p>
            ) : (
                <div className="downloads-retention-bars">
                    {bars.map((bar) => (
                        <div key={bar.label} className="downloads-retention-bars__col">
                            <div className="downloads-retention-bars__track">
                                <div
                                    className="downloads-retention-bars__fill"
                                    style={{ height: `${Math.min(100, Math.max(bar.value, 2))}%` }}
                                />
                            </div>
                            <span className="text-sm font-extrabold text-text-primary">
                                {bar.value > 0 ? `${bar.value.toFixed(1)}%` : '—'}
                            </span>
                            <span className="text-[11px] font-bold text-text-muted">{bar.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </DashboardCard>
    );
}

export function StoreNote({ platform }: { platform: PlatformFilterValue }) {
    if (platform === 'all') {
        return <p className="text-xs text-text-muted">Showing iOS App Store and Google Play side by side where both exist.</p>;
    }
    return null;
}

export function MetricSnapshotRow({
    items,
}: {
    items: { label: string; value: string; info: string }[];
}) {
    if (items.length === 0) return null;
    return (
        <div className="downloads-metric-snapshot">
            {items.map((item) => (
                <div key={item.label} className="downloads-metric-snapshot__item">
                    <div className="downloads-metric-snapshot__label">
                        <span>{item.label}</span>
                        <InfoTooltip text={item.info} />
                    </div>
                    <div className="downloads-metric-snapshot__value">{item.value}</div>
                </div>
            ))}
        </div>
    );
}
