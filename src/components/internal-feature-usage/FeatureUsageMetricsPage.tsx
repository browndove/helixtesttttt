'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import clsx from 'clsx';
import InternalAdminShell from '@/components/InternalAdminShell';
import InfoTooltip from '@/components/info-tooltip';
import CalendarRangePicker from '@/components/CalendarRangePicker';
import CustomSelect from '@/components/CustomSelect';
import { fmtCount } from '@/components/internal-downloads/DownloadsWidgets';
import { API_ENDPOINTS } from '@/lib/config';
import {
    parseFeatureUsageMetrics,
    type FeatureUsageDay,
    type FeatureUsageMetrics,
} from '@/lib/feature-usage-metrics';
import { downloadAnalyticsPresetRange } from '@/lib/download-analytics-mock';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

type FacilityOption = { id: string; name: string; code: string };

const FEATURE_COLORS = ['#1A78C4', '#00B4A0', '#5560F2', '#E39200', '#EE4A42', '#6B7C8A', '#8B5CF6', '#0EA5E9'];

const DATE_PRESETS = [
    { id: '7', label: '7d', days: 7 },
    { id: '30', label: '30d', days: 30 },
    { id: '90', label: '90d', days: 90 },
    { id: 'quarter', label: 'Quarter', days: 0 },
] as const;

function colorForFeature(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    return FEATURE_COLORS[hash % FEATURE_COLORS.length];
}

function parseFacilities(raw: unknown): FacilityOption[] {
    const list = Array.isArray(raw) ? raw : [];
    return list
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const rec = item as Record<string, unknown>;
            const id = String(rec.id || rec.facility_id || '').trim();
            const name = String(rec.name || rec.facility_name || '').trim();
            const code = String(rec.code || rec.facility_code || '').trim();
            if (!id || !name) return null;
            return { id, name, code };
        })
        .filter((row): row is FacilityOption => Boolean(row))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function toRfc3339DayStart(day: string): string {
    return `${day}T00:00:00Z`;
}

function toRfc3339ExclusiveEnd(day: string): string {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function formatDayLabel(day: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
    const date = match
        ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
        : new Date(day);
    if (Number.isNaN(date.getTime())) return day;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatAxisNumber(val: number): string {
    if (!Number.isFinite(val)) return '0';
    const abs = Math.abs(val);
    if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
    if (abs >= 10 || Number.isInteger(val)) return `${Math.round(val)}`;
    return val.toFixed(1);
}

function fmtMinutes(n: number): string {
    if (!Number.isFinite(n) || n <= 0) return '0m';
    if (n < 60) return `${n % 1 === 0 ? n : n.toFixed(1)}m`;
    const hours = Math.floor(n / 60);
    const mins = Math.round(n % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function thisQuarterRange(): { from: string; to: string } {
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3);
    const fromDate = new Date(now.getFullYear(), quarter * 3, 1);
    const to = now.toISOString().slice(0, 10);
    const from = fromDate.toISOString().slice(0, 10);
    return { from, to };
}

function halfWindowTrend(byDay: FeatureUsageDay[], key: 'users' | 'avg_active_minutes'): number | null {
    if (byDay.length < 4) return null;
    const mid = Math.floor(byDay.length / 2);
    const first = byDay.slice(0, mid);
    const second = byDay.slice(mid);
    const avg = (rows: FeatureUsageDay[]) =>
        rows.reduce((sum, row) => sum + row[key], 0) / Math.max(rows.length, 1);
    const a = avg(first);
    const b = avg(second);
    if (a === 0 && b === 0) return 0;
    if (a === 0) return 100;
    return ((b - a) / a) * 100;
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
    if (values.length < 2) {
        return <div className="fu-sparkline fu-sparkline--empty" aria-hidden />;
    }
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const span = Math.max(max - min, 1);
    const points = values
        .map((v, i) => {
            const x = (i / (values.length - 1)) * 100;
            const y = 100 - ((v - min) / span) * 100;
            return `${x},${y}`;
        })
        .join(' ');
    return (
        <svg className="fu-sparkline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <polyline fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={points} />
        </svg>
    );
}

function Panel({
    title,
    subtitle,
    info,
    actions,
    children,
    className,
}: {
    title: string;
    subtitle?: string;
    info?: string;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={clsx('fu-panel', className)} aria-label={title}>
            <header className="fu-panel__head">
                <div className="min-w-0">
                    <div className="fu-panel__title-row">
                        <h3 className="fu-panel__title">{title}</h3>
                        {info ? <InfoTooltip text={info} /> : null}
                    </div>
                    {subtitle ? <p className="fu-panel__subtitle">{subtitle}</p> : null}
                </div>
                {actions ? <div className="fu-panel__actions">{actions}</div> : null}
            </header>
            <div className="fu-panel__body">{children}</div>
        </section>
    );
}

function EmptyState({ title, body }: { title: string; body: string }) {
    return (
        <div className="fu-empty" role="status">
            <strong>{title}</strong>
            <p>{body}</p>
        </div>
    );
}

function FeatureUsageContent() {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark' || resolvedTheme === 'blue';
    const preset30 = downloadAnalyticsPresetRange(30);

    const [facilityId, setFacilityId] = useState('');
    const [facilities, setFacilities] = useState<FacilityOption[]>([]);
    const [dateFrom, setDateFrom] = useState(preset30.from);
    const [dateTo, setDateTo] = useState(preset30.to);
    const [activePreset, setActivePreset] = useState<string>('30');
    const [featureFilter, setFeatureFilter] = useState<string[]>([]);
    const [featureMenuOpen, setFeatureMenuOpen] = useState(false);
    const [drillFeatureId, setDrillFeatureId] = useState<string | null>(null);
    const [rankLimit, setRankLimit] = useState(8);
    const [rankMetric, setRankMetric] = useState<'opens' | 'users'>('opens');
    const [tableSort, setTableSort] = useState<{ key: 'label' | 'event_count' | 'unique_users'; dir: 'asc' | 'desc' }>({
        key: 'event_count',
        dir: 'desc',
    });
    const [metrics, setMetrics] = useState<FeatureUsageMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(API_ENDPOINTS.INTERNAL_FACILITIES, { cache: 'no-store' });
                const raw = await res.json().catch(() => []);
                if (cancelled) return;
                const list = parseFacilities(raw);
                setFacilities(list);
                const helix = list.find((f) => f.id === '5c3a047f-132d-4cdc-b6d3-02d98e77275e');
                if (helix) setFacilityId(helix.id);
            } catch {
                if (!cancelled) setFacilities([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const fetchMetrics = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (facilityId) params.set('facility_id', facilityId);
            if (dateFrom && dateTo) {
                params.set('from', toRfc3339DayStart(dateFrom));
                params.set('to', toRfc3339ExclusiveEnd(dateTo));
            } else {
                params.set('days', '30');
            }
            const res = await fetch(`${API_ENDPOINTS.INTERNAL_FEATURE_USAGE_METRICS}?${params}`, {
                cache: 'no-store',
            });
            const raw = await res.json().catch(() => ({}));
            if (!res.ok) {
                const message = String(
                    (raw as { message?: string; error?: string; detail?: string }).message
                    || (raw as { error?: string }).error
                    || (raw as { detail?: string }).detail
                    || 'Failed to load feature usage metrics',
                );
                throw new Error(message);
            }
            const parsed = parseFeatureUsageMetrics(raw);
            if (!parsed) throw new Error('Unexpected feature usage metrics response');
            setMetrics(parsed);
        } catch (err) {
            setMetrics(null);
            setError(err instanceof Error ? err.message : 'Failed to load feature usage metrics');
        } finally {
            setLoading(false);
        }
    }, [facilityId, dateFrom, dateTo]);

    useEffect(() => {
        void fetchMetrics();
    }, [fetchMetrics]);

    const allFeatures = metrics?.features ?? [];
    const featureOptions = allFeatures;

    const filteredFeatures = useMemo(() => {
        if (featureFilter.length === 0) return allFeatures;
        return allFeatures.filter((f) => featureFilter.includes(f.id));
    }, [allFeatures, featureFilter]);

    const scopedFeatures = useMemo(() => {
        if (!drillFeatureId) return filteredFeatures;
        return filteredFeatures.filter((f) => f.id === drillFeatureId);
    }, [filteredFeatures, drillFeatureId]);

    const drilledFeature = useMemo(
        () => allFeatures.find((f) => f.id === drillFeatureId) || null,
        [allFeatures, drillFeatureId],
    );

    const byDay = metrics?.daily_active_users.by_day ?? [];
    const labelColor = 'var(--text-secondary)';
    const gridColor = 'var(--bg-tertiary)';

    const totalInteractions = useMemo(
        () => scopedFeatures.reduce((sum, f) => sum + f.event_count, 0),
        [scopedFeatures],
    );
    const featuresAdopted = useMemo(
        () => scopedFeatures.filter((f) => f.event_count > 0).length,
        [scopedFeatures],
    );
    const adoptionRate = scopedFeatures.length > 0
        ? (featuresAdopted / scopedFeatures.length) * 100
        : 0;
    const uniqueUsers = metrics?.daily_active_users.unique_users_in_window ?? 0;
    const avgDau = metrics?.daily_active_users.avg_per_day ?? 0;
    const stickiness = uniqueUsers > 0 ? (avgDau / uniqueUsers) * 100 : 0;
    const interactionsPerUser = uniqueUsers > 0 ? totalInteractions / uniqueUsers : 0;

    const usersTrend = halfWindowTrend(byDay, 'users');
    const minutesTrend = halfWindowTrend(byDay, 'avg_active_minutes');

    const ranked = useMemo(() => {
        const key = rankMetric === 'opens' ? 'event_count' : 'unique_users';
        return [...filteredFeatures].sort((a, b) => b[key] - a[key]);
    }, [filteredFeatures, rankMetric]);
    const rankedPreview = ranked.slice(0, rankLimit);

    const tableRows = useMemo(() => {
        const rows = [...filteredFeatures];
        rows.sort((a, b) => {
            const dir = tableSort.dir === 'asc' ? 1 : -1;
            if (tableSort.key === 'label') return a.label.localeCompare(b.label) * dir;
            return (a[tableSort.key] - b[tableSort.key]) * dir;
        });
        return rows;
    }, [filteredFeatures, tableSort]);

    const shareItems = useMemo(() => {
        const withOpens = filteredFeatures.filter((f) => f.event_count > 0);
        if (withOpens.length === 0) return filteredFeatures.slice(0, 6);
        return [...withOpens].sort((a, b) => b.event_count - a.event_count).slice(0, 8);
    }, [filteredFeatures]);

    const activeFeatures = useMemo(
        () => filteredFeatures.filter((f) => f.event_count > 0),
        [filteredFeatures],
    );
    const idleFeatures = useMemo(
        () => filteredFeatures.filter((f) => f.event_count <= 0),
        [filteredFeatures],
    );
    const topFeature = ranked[0] || null;

    const exportCsv = () => {
        const header = ['feature_id', 'label', 'event_count', 'unique_users'];
        const lines = [
            header.join(','),
            ...filteredFeatures.map((f) =>
                [f.id, `"${f.label.replace(/"/g, '""')}"`, f.event_count, f.unique_users].join(','),
            ),
        ];
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `feature-usage-${dateFrom || 'from'}-${dateTo || 'to'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const toggleTableSort = (key: 'label' | 'event_count' | 'unique_users') => {
        setTableSort((prev) => (
            prev.key === key
                ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { key, dir: key === 'label' ? 'asc' : 'desc' }
        ));
    };

    const chartCommon: ApexCharts.ApexOptions = {
        chart: {
            toolbar: { show: false },
            fontFamily: 'Montserrat, sans-serif',
            animations: { enabled: true, speed: 450 },
            parentHeightOffset: 0,
            redrawOnParentResize: true,
            redrawOnWindowResize: true,
        },
        grid: {
            borderColor: gridColor,
            strokeDashArray: 4,
            padding: { left: 8, right: 12, top: 8, bottom: 0 },
        },
        dataLabels: { enabled: false },
        tooltip: {
            theme: isDark ? 'dark' : 'light',
            style: { fontSize: '12px', fontFamily: 'Montserrat, sans-serif' },
            y: { formatter: (val: number) => formatAxisNumber(val) },
        },
        legend: {
            fontSize: '12px',
            fontWeight: 600,
            labels: { colors: labelColor },
            itemMargin: { horizontal: 10, vertical: 2 },
        },
    };

    const dauCategories = byDay.map((d) => formatDayLabel(d.day));
    const dauLabelStep = byDay.length > 20 ? Math.ceil(byDay.length / 8) : byDay.length > 10 ? 2 : 1;

    const applyPreset = (id: string) => {
        setActivePreset(id);
        if (id === 'quarter') {
            const range = thisQuarterRange();
            setDateFrom(range.from);
            setDateTo(range.to);
            return;
        }
        const preset = DATE_PRESETS.find((p) => p.id === id);
        if (!preset || preset.days <= 0) return;
        const range = downloadAnalyticsPresetRange(preset.days);
        setDateFrom(range.from);
        setDateTo(range.to);
    };

    const resetFilters = () => {
        const helix = facilities.find((f) => f.id === '5c3a047f-132d-4cdc-b6d3-02d98e77275e');
        setFacilityId(helix?.id || '');
        applyPreset('30');
        setFeatureFilter([]);
        setDrillFeatureId(null);
        setRankLimit(8);
        setRankMetric('opens');
        setTableSort({ key: 'event_count', dir: 'desc' });
        setFeatureMenuOpen(false);
    };

    const toggleFeatureFilter = (id: string) => {
        setFeatureFilter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const facilityLabel = useMemo(() => {
        if (!facilityId) return 'All facilities';
        const match = facilities.find((f) => f.id === facilityId);
        return match ? `${match.name}${match.code ? ` · ${match.code}` : ''}` : 'Facility';
    }, [facilityId, facilities]);

    const chipItems = [
        facilityId ? { key: 'facility', label: facilityLabel, onRemove: () => setFacilityId('') } : null,
        featureFilter.length > 0
            ? {
                key: 'features',
                label: `${featureFilter.length} feature${featureFilter.length === 1 ? '' : 's'}`,
                onRemove: () => setFeatureFilter([]),
            }
            : null,
        drillFeatureId && drilledFeature
            ? {
                key: 'drill',
                label: `Drill: ${drilledFeature.label}`,
                onRemove: () => setDrillFeatureId(null),
            }
            : null,
    ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];

    return (
        <div className="internal-downloads-layout">
            <div className="usage-dashboard-shell internal-downloads-shell">
                <div className="usage-inner">
                    <div className="fu-dashboard" aria-label="Feature usage analytics dashboard">
                        <header className="fu-toolbar" role="banner">
                            <h1 className="fu-toolbar__title">Feature usage</h1>

                            <div className="fu-toolbar__controls" role="region" aria-label="Global filters">
                                <div className="fu-facility-select">
                                    <CustomSelect
                                        value={facilityId}
                                        onChange={setFacilityId}
                                        placeholder="All facilities"
                                        searchPlaceholder="Search facilities…"
                                        maxH={280}
                                        dropdownMinWidth={280}
                                        options={[
                                            { label: 'All facilities', value: '' },
                                            ...facilities.map((f) => ({
                                                label: f.code ? `${f.name} (${f.code})` : f.name,
                                                value: f.id,
                                                triggerLabel: f.code ? `${f.name} (${f.code})` : f.name,
                                            })),
                                        ]}
                                        style={{
                                            height: 36,
                                            minWidth: 180,
                                            maxWidth: 260,
                                            fontSize: 12,
                                            fontWeight: 600,
                                            borderRadius: 8,
                                            border: '1px solid var(--border-subtle, #e5e7eb)',
                                            background: 'var(--bg-primary, #fff)',
                                            color: 'var(--text-primary)',
                                        }}
                                    />
                                </div>

                                <div className="fu-control-group" role="group" aria-label="Date range">
                                    <div className="fu-segmented" role="group" aria-label="Date presets">
                                        {DATE_PRESETS.map((preset) => (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                className={clsx('fu-segmented__btn', activePreset === preset.id && 'is-active')}
                                                onClick={() => applyPreset(preset.id)}
                                                aria-pressed={activePreset === preset.id}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>
                                    <CalendarRangePicker
                                        from={dateFrom}
                                        to={dateTo}
                                        onChange={(from, to) => {
                                            const start = from || to;
                                            const end = to || from || start;
                                            if (!start) return;
                                            setActivePreset('custom');
                                            setDateFrom(start <= end ? start : end);
                                            setDateTo(start <= end ? end : start);
                                        }}
                                    />
                                </div>

                                <div className="fu-control fu-control--menu">
                                    <button
                                        type="button"
                                        className="fu-control fu-control--select fu-control--button"
                                        onClick={() => setFeatureMenuOpen((v) => !v)}
                                        aria-expanded={featureMenuOpen}
                                        aria-haspopup="listbox"
                                        aria-label="Feature filter"
                                    >
                                        {featureFilter.length === 0 ? 'All features' : `${featureFilter.length} selected`}
                                    </button>
                                    {featureMenuOpen && (
                                        <div className="fu-menu" role="listbox" aria-label="Feature filter">
                                            {featureOptions.length === 0 ? (
                                                <p className="fu-menu__empty">No features loaded</p>
                                            ) : (
                                                featureOptions.map((feature) => {
                                                    const checked = featureFilter.includes(feature.id);
                                                    return (
                                                        <label key={feature.id} className="fu-menu__item">
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => toggleFeatureFilter(feature.id)}
                                                            />
                                                            <i style={{ background: colorForFeature(feature.id) }} aria-hidden />
                                                            <span>{feature.label}</span>
                                                        </label>
                                                    );
                                                })
                                            )}
                                            <div className="fu-menu__footer">
                                                <button type="button" onClick={() => setFeatureFilter([])}>Clear</button>
                                                <button type="button" onClick={() => setFeatureMenuOpen(false)}>Done</button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    className="fu-control fu-control--icon"
                                    onClick={exportCsv}
                                    aria-label="Export feature table CSV"
                                    title="Export CSV"
                                    disabled={!metrics}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                                        <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                </button>

                                <button
                                    type="button"
                                    className="fu-control fu-control--icon"
                                    onClick={resetFilters}
                                    aria-label="Reset filters"
                                    title="Reset filters"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                                        <path
                                            d="M4 4v6h6M20 20v-6h-6"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                        <path
                                            d="M20 9A8 8 0 0 0 6.5 6.5L4 10M4 15a8 8 0 0 0 13.5 2.5L20 14"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </header>
                        {chipItems.length > 0 && (
                            <div className="fu-chips" aria-label="Active filters">
                                {chipItems.map((chip) => (
                                    <button
                                        key={chip.key}
                                        type="button"
                                        className="fu-chip"
                                        onClick={chip.onRemove}
                                        aria-label={`Remove filter ${chip.label}`}
                                    >
                                        <span>{chip.label}</span>
                                        <span aria-hidden>×</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {loading && !metrics && (
                            <div className="fu-skeleton-grid" aria-busy="true" aria-label="Loading feature usage">
                                {[0, 1, 2, 3].map((idx) => <div key={`kpi-${idx}`} className="fu-skeleton fu-skeleton--kpi" />)}
                                <div className="fu-skeleton fu-skeleton--chart" />
                                <div className="fu-skeleton fu-skeleton--chart" />
                                <div className="fu-skeleton fu-skeleton--chart" />
                                <div className="fu-skeleton fu-skeleton--chart" />
                            </div>
                        )}

                        {!loading && error && (
                            <div className="fu-error" role="alert">
                                <strong>Feature usage unavailable</strong>
                                <p>{error}</p>
                                <button type="button" className="btn btn-sm btn-primary" onClick={() => void fetchMetrics()}>
                                    Retry
                                </button>
                            </div>
                        )}

                        {metrics && (
                            <>
                                <div className="fu-kpi-grid" role="list" aria-label="Key metrics">
                                    {([
                                        {
                                            key: 'users',
                                            label: 'Active users',
                                            value: fmtCount(uniqueUsers),
                                            trend: usersTrend,
                                            spark: byDay.map((d) => d.users),
                                            color: '#1A78C4',
                                            info: 'Distinct people who used the product at all, in the selected date range',
                                        },
                                        {
                                            key: 'dau',
                                            label: 'Avg DAU/day',
                                            value: avgDau.toFixed(1),
                                            trend: usersTrend,
                                            spark: byDay.map((d) => d.users),
                                            color: '#0EA5E9',
                                            info: 'Average number of people active on a typical day in this period',
                                        },
                                        {
                                            key: 'opens',
                                            label: 'Feature opens',
                                            value: fmtCount(totalInteractions),
                                            trend: null as number | null,
                                            spark: ranked.map((f) => f.event_count).slice(0, 12).reverse(),
                                            color: '#00B4A0',
                                            info: 'Total number of times the selected feature(s) were opened in this period',
                                        },
                                        {
                                            key: 'per-user',
                                            label: 'Opens / user',
                                            value: formatAxisNumber(interactionsPerUser),
                                            trend: null as number | null,
                                            spark: byDay.map((d) => d.users),
                                            color: '#5560F2',
                                            info: 'Average number of times each active user opened this feature',
                                        },
                                        ...(scopedFeatures.length > 1
                                            ? [{
                                                key: 'adoption',
                                                label: 'Feature adoption',
                                                value: `${adoptionRate.toFixed(0)}%`,
                                                trend: null as number | null,
                                                spark: ranked.map((f) => (f.event_count > 0 ? 1 : 0)),
                                                color: '#E39200',
                                                info: 'Share of your features that were used at least once in this period',
                                            }]
                                            : []),
                                        {
                                            key: 'stickiness',
                                            label: 'Stickiness',
                                            value: `${stickiness.toFixed(0)}%`,
                                            trend: usersTrend,
                                            spark: byDay.map((d) => d.users),
                                            color: '#8B5CF6',
                                            info: 'Share of active users who return on a typical day',
                                        },
                                        {
                                            key: 'minutes',
                                            label: 'Avg time in app',
                                            value: fmtMinutes(metrics.time_in_app.avg_minutes_per_user_day),
                                            trend: minutesTrend,
                                            spark: byDay.map((d) => d.avg_active_minutes),
                                            color: '#EE4A42',
                                            info: 'Average minutes each active user spends per day',
                                        },
                                    ] as const).map((kpi) => (
                                        <article key={kpi.key} className="fu-kpi" role="listitem">
                                            <div className="fu-kpi__top">
                                                <span className="fu-kpi__label">{kpi.label}</span>
                                                <InfoTooltip text={kpi.info} />
                                            </div>
                                            <div className="fu-kpi__value-row">
                                                <strong className="fu-kpi__value">{kpi.value}</strong>
                                                {kpi.trend != null && (
                                                    <span
                                                        className={clsx('fu-kpi__trend', kpi.trend >= 0 ? 'is-up' : 'is-down')}
                                                        title="Whether activity increased or decreased between the first and second half of the selected period. Based on comparing the first and second half of the selected date range, not day-over-day."
                                                    >
                                                        {kpi.trend >= 0 ? '▲' : '▼'} {Math.abs(kpi.trend).toFixed(0)}%
                                                    </span>
                                                )}
                                            </div>
                                            <Sparkline values={[...kpi.spark]} color={kpi.color} />
                                        </article>
                                    ))}
                                </div>

                                <div className="fu-chart-grid">
                                    <Panel
                                        title="Engagement over time"
                                        subtitle="Daily active users and avg active minutes (dual axis)"
                                        info={[
                                            'Daily count of unique active users over the selected period',
                                            'Average minutes spent in the app per active user, by day',
                                        ].join('\n\n')}
                                    >
                                        {byDay.length === 0 ? (
                                            <EmptyState title="No daily series" body="The API returned no by_day rows for this window." />
                                        ) : (
                                            <div className="fu-chart-host" role="img" aria-label="Engagement dual-axis chart">
                                                <Chart
                                                    type="line"
                                                    width="100%"
                                                    height={300}
                                                    series={[
                                                        { name: 'Active users', type: 'area', data: byDay.map((d) => d.users) },
                                                        { name: 'Avg minutes', type: 'line', data: byDay.map((d) => d.avg_active_minutes) },
                                                    ]}
                                                    options={{
                                                        ...chartCommon,
                                                        colors: ['#1A78C4', '#E39200'],
                                                        stroke: { curve: 'smooth', width: [0, 3] },
                                                        fill: {
                                                            type: ['gradient', 'solid'],
                                                            gradient: {
                                                                shadeIntensity: 0.35,
                                                                opacityFrom: 0.4,
                                                                opacityTo: 0.05,
                                                                stops: [0, 100],
                                                            },
                                                        },
                                                        markers: { size: byDay.length <= 14 ? 3 : 0, strokeWidth: 0 },
                                                        legend: {
                                                            show: true,
                                                            position: 'top',
                                                            horizontalAlign: 'right',
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                            labels: { colors: labelColor },
                                                        },
                                                        xaxis: {
                                                            categories: dauCategories,
                                                            labels: {
                                                                rotate: 0,
                                                                hideOverlappingLabels: true,
                                                                formatter: (value: string) => {
                                                                    const index = dauCategories.indexOf(value);
                                                                    if (index < 0) return '';
                                                                    if (index === 0 || index === dauCategories.length - 1 || index % dauLabelStep === 0) {
                                                                        return value;
                                                                    }
                                                                    return '';
                                                                },
                                                                style: { colors: labelColor, fontSize: '11px', fontWeight: 500 },
                                                            },
                                                            axisBorder: { show: false },
                                                            axisTicks: { show: false },
                                                        },
                                                        yaxis: [
                                                            {
                                                                seriesName: 'Active users',
                                                                min: 0,
                                                                forceNiceScale: true,
                                                                labels: {
                                                                    formatter: (val: number) => formatAxisNumber(val),
                                                                    style: { colors: '#1A78C4', fontSize: '11px', fontWeight: 500 },
                                                                },
                                                                title: {
                                                                    text: 'Users',
                                                                    style: { color: '#1A78C4', fontSize: '11px', fontWeight: 600 },
                                                                },
                                                            },
                                                            {
                                                                opposite: true,
                                                                seriesName: 'Avg minutes',
                                                                min: 0,
                                                                forceNiceScale: true,
                                                                labels: {
                                                                    formatter: (val: number) => formatAxisNumber(val),
                                                                    style: { colors: '#E39200', fontSize: '11px', fontWeight: 500 },
                                                                },
                                                                title: {
                                                                    text: 'Minutes',
                                                                    style: { color: '#E39200', fontSize: '11px', fontWeight: 600 },
                                                                },
                                                            },
                                                        ],
                                                        tooltip: {
                                                            shared: true,
                                                            intersect: false,
                                                            theme: isDark ? 'dark' : 'light',
                                                            y: {
                                                                formatter: (val: number, opts) => {
                                                                    const seriesName = opts?.w?.globals?.seriesNames?.[opts.seriesIndex ?? 0] || '';
                                                                    if (String(seriesName).toLowerCase().includes('minute')) {
                                                                        return `${formatAxisNumber(val)} min`;
                                                                    }
                                                                    return `${formatAxisNumber(val)} users`;
                                                                },
                                                            },
                                                        },
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </Panel>

                                    <Panel
                                        title="Share of opens"
                                        subtitle="Feature mix in the current filter"
                                        info="Donut of event_count. Click a slice to drill."
                                    >
                                        {shareItems.every((f) => f.event_count === 0) ? (
                                            <EmptyState title="No opens yet" body="Share appears once features report event_count > 0." />
                                        ) : (
                                            <div className="fu-chart-host" role="img" aria-label="Share of feature opens">
                                                <Chart
                                                    type="donut"
                                                    width="100%"
                                                    height={300}
                                                    series={shareItems.map((f) => f.event_count)}
                                                    options={{
                                                        ...chartCommon,
                                                        labels: shareItems.map((f) => f.label),
                                                        colors: shareItems.map((f) => colorForFeature(f.id)),
                                                        legend: {
                                                            show: true,
                                                            position: 'bottom',
                                                            fontSize: '11px',
                                                            fontWeight: 600,
                                                            labels: { colors: labelColor },
                                                        },
                                                        stroke: { width: 0 },
                                                        plotOptions: {
                                                            pie: {
                                                                donut: {
                                                                    size: '62%',
                                                                    labels: {
                                                                        show: true,
                                                                        name: { show: false },
                                                                        value: {
                                                                            show: true,
                                                                            fontSize: '18px',
                                                                            fontWeight: 700,
                                                                            color: 'var(--text-primary)',
                                                                            formatter: (val: string) => formatAxisNumber(Number(val) || 0),
                                                                        },
                                                                        total: {
                                                                            show: true,
                                                                            label: 'Opens',
                                                                            fontSize: '11px',
                                                                            fontWeight: 650,
                                                                            color: labelColor,
                                                                            formatter: () => formatAxisNumber(shareItems.reduce((s, f) => s + f.event_count, 0)),
                                                                        },
                                                                    },
                                                                },
                                                            },
                                                        },
                                                        chart: {
                                                            ...chartCommon.chart,
                                                            events: {
                                                                dataPointSelection: (_e, _ctx, config) => {
                                                                    const index = config?.dataPointIndex;
                                                                    if (index == null) return;
                                                                    const feature = shareItems[index];
                                                                    if (!feature) return;
                                                                    setDrillFeatureId((prev) => (prev === feature.id ? null : feature.id));
                                                                },
                                                            },
                                                        },
                                                        tooltip: {
                                                            theme: isDark ? 'dark' : 'light',
                                                            y: {
                                                                formatter: (val: number, opts) => {
                                                                    const feature = shareItems[opts?.seriesIndex ?? opts?.dataPointIndex ?? -1];
                                                                    if (!feature) return formatAxisNumber(val);
                                                                    return `${formatAxisNumber(val)} opens · ${fmtCount(feature.unique_users)} users`;
                                                                },
                                                            },
                                                        },
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </Panel>

                                    <Panel
                                        title="Feature ranking"
                                        subtitle="Click a bar to drill · toggle metric"
                                        info={rankMetric === 'opens'
                                            ? 'How many times this feature was opened'
                                            : 'Number of distinct people who used this feature'}
                                        actions={(
                                            <div className="fu-panel__actions-row">
                                                <div className="fu-segmented fu-segmented--sm" role="group" aria-label="Rank metric">
                                                    <button
                                                        type="button"
                                                        className={clsx('fu-segmented__btn', rankMetric === 'opens' && 'is-active')}
                                                        onClick={() => setRankMetric('opens')}
                                                        aria-pressed={rankMetric === 'opens'}
                                                    >
                                                        Opens
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={clsx('fu-segmented__btn', rankMetric === 'users' && 'is-active')}
                                                        onClick={() => setRankMetric('users')}
                                                        aria-pressed={rankMetric === 'users'}
                                                    >
                                                        Users
                                                    </button>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="fu-text-btn"
                                                    onClick={() => setRankLimit((n) => (n >= ranked.length ? 8 : ranked.length))}
                                                >
                                                    {rankLimit >= ranked.length ? 'Show less' : `Show all (${ranked.length})`}
                                                </button>
                                            </div>
                                        )}
                                    >
                                        {rankedPreview.length === 0 ? (
                                            <EmptyState
                                                title="No features"
                                                body="No features in the current filter."
                                            />
                                        ) : (
                                            <div className="fu-chart-host" role="img" aria-label="Feature ranking bar chart">
                                                <Chart
                                                    type="bar"
                                                    width="100%"
                                                    height={Math.max(260, rankedPreview.length * 42)}
                                                    series={[{
                                                        name: rankMetric === 'opens' ? 'Opens' : 'Unique users',
                                                        data: rankedPreview.map((f) => (
                                                            rankMetric === 'opens' ? f.event_count : f.unique_users
                                                        )),
                                                    }]}
                                                    options={{
                                                        ...chartCommon,
                                                        colors: rankedPreview.map((f) => {
                                                            const base = colorForFeature(f.id);
                                                            if (!drillFeatureId || drillFeatureId === f.id) return base;
                                                            return `${base}55`;
                                                        }),
                                                        plotOptions: {
                                                            bar: {
                                                                horizontal: true,
                                                                borderRadius: 5,
                                                                barHeight: '68%',
                                                                distributed: true,
                                                            },
                                                        },
                                                        legend: { show: false },
                                                        dataLabels: {
                                                            enabled: true,
                                                            formatter: (val: number) => formatAxisNumber(val),
                                                            style: { fontSize: '11px', fontWeight: 700, colors: ['#fff'] },
                                                        },
                                                        xaxis: {
                                                            categories: rankedPreview.map((f) => f.label),
                                                            labels: {
                                                                formatter: (val: string) => formatAxisNumber(Number(val) || 0),
                                                                style: { colors: labelColor, fontSize: '11px' },
                                                            },
                                                            axisBorder: { show: false },
                                                            axisTicks: { show: false },
                                                        },
                                                        yaxis: {
                                                            labels: {
                                                                maxWidth: 120,
                                                                style: { colors: 'var(--text-primary)', fontSize: '12px', fontWeight: 650 },
                                                            },
                                                        },
                                                        chart: {
                                                            ...chartCommon.chart,
                                                            events: {
                                                                dataPointSelection: (_e, _ctx, config) => {
                                                                    const index = config?.dataPointIndex;
                                                                    if (index == null) return;
                                                                    const feature = rankedPreview[index];
                                                                    if (!feature) return;
                                                                    setDrillFeatureId((prev) => (prev === feature.id ? null : feature.id));
                                                                },
                                                            },
                                                        },
                                                        tooltip: {
                                                            ...chartCommon.tooltip,
                                                            y: {
                                                                formatter: (_val: number, opts) => {
                                                                    const feature = rankedPreview[opts?.dataPointIndex ?? -1];
                                                                    if (!feature) return '';
                                                                    if (rankMetric === 'opens') {
                                                                        return `${fmtCount(feature.event_count)} opens · ${fmtCount(feature.unique_users)} unique users`;
                                                                    }
                                                                    return `${fmtCount(feature.unique_users)} unique users · ${fmtCount(feature.event_count)} opens`;
                                                                },
                                                            },
                                                        },
                                                        states: {
                                                            active: { filter: { type: 'none' } },
                                                        },
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </Panel>

                                    <Panel
                                        title={drilledFeature ? `${drilledFeature.label}` : 'Feature detail'}
                                        subtitle={drilledFeature ? 'Drill selection' : topFeature ? `Leading: ${topFeature.label}` : 'Select a mark in ranking or share'}
                                        info="This feature's share of total opens among the features currently in view"
                                        actions={drillFeatureId ? (
                                            <button type="button" className="fu-text-btn" onClick={() => setDrillFeatureId(null)}>
                                                Clear drill
                                            </button>
                                        ) : topFeature ? (
                                            <button type="button" className="fu-text-btn" onClick={() => setDrillFeatureId(topFeature.id)}>
                                                Drill leader
                                            </button>
                                        ) : null}
                                    >
                                        {!drilledFeature && !topFeature ? (
                                            <EmptyState
                                                title="No feature selected"
                                                body="Click a ranking bar or donut slice to inspect opens, unique users, and children."
                                            />
                                        ) : !drilledFeature && topFeature ? (
                                            <div className="fu-detail">
                                                <div className="fu-detail__swatch" style={{ background: colorForFeature(topFeature.id) }} aria-hidden />
                                                <p className="fu-detail__lead">Highest opens in this filter</p>
                                                <div className="fu-detail__stats">
                                                    <div>
                                                        <span>Opens</span>
                                                        <strong>{fmtCount(topFeature.event_count)}</strong>
                                                    </div>
                                                    <div>
                                                        <span>Unique users</span>
                                                        <strong>{fmtCount(topFeature.unique_users)}</strong>
                                                    </div>
                                                    <div>
                                                        <span>Share of opens</span>
                                                        <strong>
                                                            {filteredFeatures.reduce((s, f) => s + f.event_count, 0) > 0
                                                                ? `${((topFeature.event_count / filteredFeatures.reduce((s, f) => s + f.event_count, 0)) * 100).toFixed(1)}%`
                                                                : '0%'}
                                                        </strong>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="fu-detail__cta"
                                                    onClick={() => setDrillFeatureId(topFeature.id)}
                                                >
                                                    Inspect {topFeature.label}
                                                </button>
                                            </div>
                                        ) : drilledFeature ? (
                                            <div className="fu-detail">
                                                <div className="fu-detail__swatch" style={{ background: colorForFeature(drilledFeature.id) }} aria-hidden />
                                                <div className="fu-detail__stats">
                                                    <div>
                                                        <span>Opens</span>
                                                        <strong>{fmtCount(drilledFeature.event_count)}</strong>
                                                    </div>
                                                    <div>
                                                        <span>Unique users</span>
                                                        <strong>{fmtCount(drilledFeature.unique_users)}</strong>
                                                    </div>
                                                    <div>
                                                        <span>Share of opens</span>
                                                        <strong>
                                                            {filteredFeatures.reduce((s, f) => s + f.event_count, 0) > 0
                                                                ? `${((drilledFeature.event_count / filteredFeatures.reduce((s, f) => s + f.event_count, 0)) * 100).toFixed(1)}%`
                                                                : '0%'}
                                                        </strong>
                                                    </div>
                                                </div>
                                                {drilledFeature.children && drilledFeature.children.length > 0 && (
                                                    <div className="fu-detail__children" aria-label={`${drilledFeature.label} children`}>
                                                        {drilledFeature.children.map((child) => (
                                                            <div key={child.id} className="fu-detail__child">
                                                                <span>{child.label}</span>
                                                                <strong>{fmtCount(child.event_count)} opens</strong>
                                                                <em>{fmtCount(child.unique_users)} users</em>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}
                                    </Panel>

                                    <Panel
                                        title="Opens vs unique users"
                                        subtitle="Top features · grouped compare"
                                        info="Same API fields side by side for the current filter."
                                    >
                                        {rankedPreview.length === 0 ? (
                                            <EmptyState title="No features" body="Nothing to compare in this filter." />
                                        ) : (
                                            <div className="fu-chart-host" role="img" aria-label="Opens versus unique users">
                                                <Chart
                                                    type="bar"
                                                    width="100%"
                                                    height={Math.max(260, Math.min(rankedPreview.length, 8) * 44)}
                                                    series={[
                                                        {
                                                            name: 'Opens',
                                                            data: rankedPreview.slice(0, 8).map((f) => f.event_count),
                                                        },
                                                        {
                                                            name: 'Unique users',
                                                            data: rankedPreview.slice(0, 8).map((f) => f.unique_users),
                                                        },
                                                    ]}
                                                    options={{
                                                        ...chartCommon,
                                                        colors: ['#1A78C4', '#00B4A0'],
                                                        plotOptions: {
                                                            bar: {
                                                                horizontal: true,
                                                                borderRadius: 4,
                                                                barHeight: '70%',
                                                            },
                                                        },
                                                        legend: {
                                                            show: true,
                                                            position: 'top',
                                                            horizontalAlign: 'right',
                                                            fontSize: '11px',
                                                            fontWeight: 600,
                                                            labels: { colors: labelColor },
                                                        },
                                                        xaxis: {
                                                            categories: rankedPreview.slice(0, 8).map((f) => f.label),
                                                            labels: {
                                                                formatter: (val: string) => formatAxisNumber(Number(val) || 0),
                                                                style: { colors: labelColor, fontSize: '11px' },
                                                            },
                                                            axisBorder: { show: false },
                                                            axisTicks: { show: false },
                                                        },
                                                        yaxis: {
                                                            labels: {
                                                                maxWidth: 110,
                                                                style: { colors: 'var(--text-primary)', fontSize: '11px', fontWeight: 650 },
                                                            },
                                                        },
                                                        chart: {
                                                            ...chartCommon.chart,
                                                            events: {
                                                                dataPointSelection: (_e, _ctx, config) => {
                                                                    const index = config?.dataPointIndex;
                                                                    if (index == null) return;
                                                                    const feature = rankedPreview[index];
                                                                    if (!feature) return;
                                                                    setDrillFeatureId((prev) => (prev === feature.id ? null : feature.id));
                                                                },
                                                            },
                                                        },
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </Panel>

                                    <Panel
                                        title="Feature coverage"
                                        subtitle="Active vs idle in this filter"
                                        info="Active = event_count > 0. Idle features still appear in the API with zeros."
                                    >
                                        {filteredFeatures.length === 0 ? (
                                            <EmptyState title="No features" body="Nothing in the current filter." />
                                        ) : (
                                            <div className="fu-coverage">
                                                <div className="fu-coverage__stats">
                                                    <div>
                                                        <span>Active</span>
                                                        <strong>{activeFeatures.length}</strong>
                                                    </div>
                                                    <div>
                                                        <span>Idle</span>
                                                        <strong>{idleFeatures.length}</strong>
                                                    </div>
                                                    <div>
                                                        <span>Coverage</span>
                                                        <strong>
                                                            {filteredFeatures.length > 0
                                                                ? `${((activeFeatures.length / filteredFeatures.length) * 100).toFixed(0)}%`
                                                                : '0%'}
                                                        </strong>
                                                    </div>
                                                </div>
                                                <div className="fu-coverage__bar" aria-hidden>
                                                    <i
                                                        style={{
                                                            width: `${filteredFeatures.length > 0
                                                                ? (activeFeatures.length / filteredFeatures.length) * 100
                                                                : 0}%`,
                                                        }}
                                                    />
                                                </div>
                                                <div className="fu-coverage__lists">
                                                    <div>
                                                        <h4>Active</h4>
                                                        <ul>
                                                            {(activeFeatures.length > 0 ? activeFeatures : []).slice(0, 6).map((f) => (
                                                                <li key={f.id}>
                                                                    <button type="button" onClick={() => setDrillFeatureId(f.id)}>
                                                                        <i style={{ background: colorForFeature(f.id) }} aria-hidden />
                                                                        <span>{f.label}</span>
                                                                        <em>{fmtCount(f.event_count)}</em>
                                                                    </button>
                                                                </li>
                                                            ))}
                                                            {activeFeatures.length === 0 && (
                                                                <li className="fu-coverage__empty">None yet</li>
                                                            )}
                                                        </ul>
                                                    </div>
                                                    <div>
                                                        <h4>Idle</h4>
                                                        <ul>
                                                            {idleFeatures.slice(0, 6).map((f) => (
                                                                <li key={f.id}>
                                                                    <button type="button" onClick={() => setDrillFeatureId(f.id)}>
                                                                        <i style={{ background: colorForFeature(f.id) }} aria-hidden />
                                                                        <span>{f.label}</span>
                                                                        <em>0</em>
                                                                    </button>
                                                                </li>
                                                            ))}
                                                            {idleFeatures.length === 0 && (
                                                                <li className="fu-coverage__empty">All features have opens</li>
                                                            )}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </Panel>

                                    <Panel
                                        className="fu-panel--wide"
                                        title="Feature table"
                                        subtitle="Sortable crosstab of the loaded metrics payload"
                                        info="Direct features[] fields — not event-level rows."
                                    >
                                        {tableRows.length === 0 ? (
                                            <EmptyState title="No rows" body="No features in the current filter." />
                                        ) : (
                                            <div className="fu-table-wrap">
                                                <table className="fu-table" aria-label="Feature usage table">
                                                    <thead>
                                                        <tr>
                                                            <th>
                                                                <button type="button" onClick={() => toggleTableSort('label')}>
                                                                    Feature {tableSort.key === 'label' ? (tableSort.dir === 'asc' ? '↑' : '↓') : ''}
                                                                </button>
                                                            </th>
                                                            <th>
                                                                <button type="button" onClick={() => toggleTableSort('event_count')}>
                                                                    Opens {tableSort.key === 'event_count' ? (tableSort.dir === 'asc' ? '↑' : '↓') : ''}
                                                                </button>
                                                            </th>
                                                            <th>
                                                                <button type="button" onClick={() => toggleTableSort('unique_users')}>
                                                                    Unique users {tableSort.key === 'unique_users' ? (tableSort.dir === 'asc' ? '↑' : '↓') : ''}
                                                                </button>
                                                            </th>
                                                            <th>Share</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {tableRows.map((row) => {
                                                            const denom = filteredFeatures.reduce((s, f) => s + f.event_count, 0);
                                                            const share = denom > 0 ? (row.event_count / denom) * 100 : 0;
                                                            const active = drillFeatureId === row.id;
                                                            return (
                                                                <tr
                                                                    key={row.id}
                                                                    className={clsx(active && 'is-active')}
                                                                    onClick={() => setDrillFeatureId((prev) => (prev === row.id ? null : row.id))}
                                                                    tabIndex={0}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                                            e.preventDefault();
                                                                            setDrillFeatureId((prev) => (prev === row.id ? null : row.id));
                                                                        }
                                                                    }}
                                                                    aria-selected={active}
                                                                >
                                                                    <td>
                                                                        <span className="fu-table__swatch" style={{ background: colorForFeature(row.id) }} aria-hidden />
                                                                        {row.label}
                                                                    </td>
                                                                    <td>{fmtCount(row.event_count)}</td>
                                                                    <td>{fmtCount(row.unique_users)}</td>
                                                                    <td>
                                                                        <div className="fu-table__share">
                                                                            <i style={{ width: `${Math.max(share, share > 0 ? 2 : 0)}%` }} />
                                                                            <span>{share.toFixed(1)}%</span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </Panel>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function FeatureUsageMetricsPage() {
    return (
        <InternalAdminShell>
            <FeatureUsageContent />
        </InternalAdminShell>
    );
}
