/** Daily active users block from GET /feature-usage-metrics. */
export type DailyActiveUsersMetrics = {
    avg_per_day?: number;
    unique_users_in_window?: number;
    by_day?: { day: string; users?: number; avg_active_minutes?: number }[];
};

export type FeatureUsageMetricsResponse = {
    scope?: string;
    filter_facility_id?: string;
    filter_facility_ids?: string[];
    window_days?: number;
    from?: string;
    to?: string;
    daily_active_users?: DailyActiveUsersMetrics;
    time_in_app?: { avg_minutes_per_user_day?: number };
};

export type FeatureUsageSummary = {
    dailyUsersAvg: number | null;
    avgMinutesPerUserDay: number | null;
};

function finiteOrNull(n: unknown): number | null {
    return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** Daily users + avg time-in-app from a feature-usage-metrics payload. */
export function extractFeatureUsageSummary(payload: unknown): FeatureUsageSummary {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { dailyUsersAvg: null, avgMinutesPerUserDay: null };
    }
    const data = payload as FeatureUsageMetricsResponse;
    return {
        dailyUsersAvg: finiteOrNull(data.daily_active_users?.avg_per_day),
        avgMinutesPerUserDay: finiteOrNull(data.time_in_app?.avg_minutes_per_user_day),
    };
}

/** @deprecated Prefer extractFeatureUsageSummary */
export function extractDailyUsersAvg(payload: unknown): number | null {
    return extractFeatureUsageSummary(payload).dailyUsersAvg;
}

/** Format minutes for the Daily users trend chip (e.g. "24.5 min"). */
export function formatAvgMinutesPerUserDay(minutes: number): string {
    if (minutes >= 60) {
        const hours = minutes / 60;
        return `${hours >= 10 ? hours.toFixed(0) : hours.toFixed(1)} hr`;
    }
    return `${minutes >= 10 ? minutes.toFixed(0) : minutes.toFixed(1)} min`;
}
