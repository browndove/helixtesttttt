export type FeatureUsageDay = {
    day: string;
    users: number;
    avg_active_minutes: number;
};

export type FeatureUsageChild = {
    id: string;
    label: string;
    event_count: number;
    unique_users: number;
};

export type FeatureUsageRow = {
    id: string;
    label: string;
    event_count: number;
    unique_users: number;
    children?: FeatureUsageChild[];
};

export type FeatureUsageMetrics = {
    scope: string;
    filter_facility_id: string | null;
    window_days: number;
    from: string;
    to: string;
    daily_active_users: {
        unique_users_in_window: number;
        avg_per_day: number;
        by_day: FeatureUsageDay[];
    };
    time_in_app: {
        avg_minutes_per_user_day: number;
    };
    features: FeatureUsageRow[];
};

export function parseFeatureUsageMetrics(raw: unknown): FeatureUsageMetrics | null {
    if (!raw || typeof raw !== 'object') return null;
    const rec = raw as Record<string, unknown>;
    const dauRaw = (rec.daily_active_users && typeof rec.daily_active_users === 'object'
        ? rec.daily_active_users
        : {}) as Record<string, unknown>;
    const timeRaw = (rec.time_in_app && typeof rec.time_in_app === 'object'
        ? rec.time_in_app
        : {}) as Record<string, unknown>;

    const byDay = Array.isArray(dauRaw.by_day)
        ? dauRaw.by_day
            .map((row) => {
                if (!row || typeof row !== 'object') return null;
                const d = row as Record<string, unknown>;
                const day = String(d.day || '').trim();
                if (!day) return null;
                return {
                    day,
                    users: Number(d.users) || 0,
                    avg_active_minutes: Number(d.avg_active_minutes) || 0,
                };
            })
            .filter((row): row is FeatureUsageDay => Boolean(row))
        : [];

    const features = Array.isArray(rec.features)
        ? rec.features
            .map((row) => {
                if (!row || typeof row !== 'object') return null;
                const f = row as Record<string, unknown>;
                const id = String(f.id || '').trim();
                if (!id) return null;
                const children = Array.isArray(f.children)
                    ? f.children
                        .map((child) => {
                            if (!child || typeof child !== 'object') return null;
                            const c = child as Record<string, unknown>;
                            const childId = String(c.id || '').trim();
                            if (!childId) return null;
                            return {
                                id: childId,
                                label: String(c.label || childId),
                                event_count: Number(c.event_count) || 0,
                                unique_users: Number(c.unique_users) || 0,
                            };
                        })
                        .filter((child): child is FeatureUsageChild => Boolean(child))
                    : undefined;
                return {
                    id,
                    label: String(f.label || id),
                    event_count: Number(f.event_count) || 0,
                    unique_users: Number(f.unique_users) || 0,
                    ...(children && children.length > 0 ? { children } : {}),
                };
            })
            .filter((row): row is FeatureUsageRow => Boolean(row))
        : [];

    return {
        scope: String(rec.scope || ''),
        filter_facility_id: rec.filter_facility_id == null ? null : String(rec.filter_facility_id),
        window_days: Number(rec.window_days) || 0,
        from: String(rec.from || ''),
        to: String(rec.to || ''),
        daily_active_users: {
            unique_users_in_window: Number(dauRaw.unique_users_in_window) || 0,
            avg_per_day: Number(dauRaw.avg_per_day) || 0,
            by_day: byDay,
        },
        time_in_app: {
            avg_minutes_per_user_day: Number(timeRaw.avg_minutes_per_user_day) || 0,
        },
        features,
    };
}
