'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import GenerateReportModal from '@/components/analytics/report/GenerateReportModal';
import { API_ENDPOINTS } from '@/lib/analytics/config';
import { extractFeatureUsageSummary } from '@/lib/analytics/feature-usage-metrics';
import { appendUsageMetricsRange } from '@/lib/analytics/usage-metrics-range';
import type { AnalyticsData } from '@/lib/analytics/types';

type FeatureUsage = { dailyUsersAvg: number | null; avgMinutesPerUserDay: number | null };

interface AnalyticsContextValue {
    data: AnalyticsData | null;
    loading: boolean;
    dateFrom: string;
    dateTo: string;
    setRange: (from: string, to: string) => void;
    dailyUsersAvg: number | null;
    avgMinutesPerUserDay: number | null;
    openReport: () => void;
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

export function useAnalytics(): AnalyticsContextValue {
    const ctx = useContext(AnalyticsContext);
    if (!ctx) throw new Error('useAnalytics must be used inside AnalyticsProvider');
    return ctx;
}

/** Inclusive YYYY-MM-DD range from the URL, or empty when missing/invalid (backend default window). */
function readInitialRange(from: string | null, to: string | null): { from: string; to: string } {
    if (!from || !to) return { from: '', to: '' };
    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T00:00:00`);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
        return { from: '', to: '' };
    }
    return { from, to };
}

/**
 * Owns the analytics section's data: one usage-metrics fetch per date range, shared by every
 * analytics page so moving between them in the sidebar never refetches.
 */
export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const [initialRange] = useState(() => readInitialRange(searchParams.get('from'), searchParams.get('to')));
    const [dateFrom, setDateFrom] = useState(initialRange.from);
    const [dateTo, setDateTo] = useState(initialRange.to);
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [featureUsage, setFeatureUsage] = useState<FeatureUsage>({ dailyUsersAvg: null, avgMinutesPerUserDay: null });
    const [reportOpen, setReportOpen] = useState(false);

    /** In-memory results by range key — instant restore when revisiting the same window. */
    const analyticsCacheRef = useRef<Map<string, AnalyticsData>>(new Map());
    const featureCacheRef = useRef<Map<string, FeatureUsage>>(new Map());

    // Keep the chosen range in the URL so it survives reloads and moving between analytics pages.
    const searchParamsRef = useRef(searchParams);
    useEffect(() => { searchParamsRef.current = searchParams; }, [searchParams]);
    useEffect(() => {
        const sp = searchParamsRef.current;
        if (sp.get('from') === (dateFrom || null) && sp.get('to') === (dateTo || null)) return;
        const next = new URLSearchParams(sp.toString());
        if (dateFrom && dateTo) {
            next.set('from', dateFrom);
            next.set('to', dateTo);
        } else {
            next.delete('from');
            next.delete('to');
        }
        const qs = next.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [dateFrom, dateTo, pathname, router]);

    const fetchAnalytics = useCallback(async () => {
        const params = new URLSearchParams();
        let cacheKey = 'default';
        if (dateFrom && dateTo) {
            appendUsageMetricsRange(params, dateFrom, dateTo);
            cacheKey = `from=${dateFrom}|to=${dateTo}`;
        }

        const cached = analyticsCacheRef.current.get(cacheKey);
        const cachedFeature = featureCacheRef.current.get(cacheKey);
        if (cached) {
            setData(cached);
            if (cachedFeature) setFeatureUsage(cachedFeature);
            setLoading(false);
        } else {
            setLoading(true);
        }

        try {
            const qs = params.toString();
            const [analyticsRes, featureRes] = await Promise.all([
                fetch(`/api/proxy/analytics${qs ? `?${qs}` : ''}`, { cache: 'no-store' }),
                fetch(`${API_ENDPOINTS.FEATURE_USAGE_METRICS}${qs ? `?${qs}` : ''}`, { cache: 'no-store' }),
            ]);
            if (analyticsRes.ok) {
                const json = (await analyticsRes.json()) as AnalyticsData;
                analyticsCacheRef.current.set(cacheKey, json);
                setData(json);
            }
            const summary: FeatureUsage = featureRes.ok
                ? extractFeatureUsageSummary(await featureRes.json())
                : { dailyUsersAvg: null, avgMinutesPerUserDay: null };
            featureCacheRef.current.set(cacheKey, summary);
            setFeatureUsage(summary);
        } catch (err) {
            console.error('Failed to fetch analytics:', err);
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo]);

    useEffect(() => { void fetchAnalytics(); }, [fetchAnalytics]);

    const setRange = useCallback((from: string, to: string) => {
        setDateFrom(from);
        setDateTo(to);
    }, []);
    const openReport = useCallback(() => setReportOpen(true), []);

    const value = useMemo<AnalyticsContextValue>(() => ({
        data,
        loading,
        dateFrom,
        dateTo,
        setRange,
        dailyUsersAvg: featureUsage.dailyUsersAvg,
        avgMinutesPerUserDay: featureUsage.avgMinutesPerUserDay,
        openReport,
    }), [data, loading, dateFrom, dateTo, setRange, featureUsage, openReport]);

    return (
        <AnalyticsContext.Provider value={value}>
            {children}
            <GenerateReportModal
                open={reportOpen}
                onClose={() => setReportOpen(false)}
                defaultDateFrom={dateFrom}
                defaultDateTo={dateTo}
                sourceData={data as Record<string, unknown> | null}
            />
        </AnalyticsContext.Provider>
    );
}
