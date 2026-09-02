import type { AnalyticsData } from '@/app/(helix-admin)/usage/page';

export type NamedCount = { name: string; count: number };

export type StoreDailyPoint = {
    day: string;
    first_time_downloads: number;
    redownloads: number;
    total_downloads: number;
    updates: number;
    impressions: number;
    unique_impressions: number;
    page_views: number;
    unique_page_views: number;
    sessions: number;
    active_devices: number;
    installations: number;
    deletions: number;
    crashes: number;
    anrs: number;
    user_installs: number;
    device_installs: number;
    user_uninstalls: number;
    device_uninstalls: number;
    upgrades: number;
    listing_visitors: number;
    listing_acquisitions: number;
};

export type StoreBreakdowns = {
    sources: NamedCount[];
    app_referrers: NamedCount[];
    web_referrers: NamedCount[];
    campaigns: NamedCount[];
    territories: NamedCount[];
    devices: NamedCount[];
    page_types: NamedCount[];
    product_pages: NamedCount[];
    versions: NamedCount[];
    platform_versions: NamedCount[];
    languages: NamedCount[];
    carriers: NamedCount[];
    search_terms: NamedCount[];
    utm_sources: NamedCount[];
    utm_campaigns: NamedCount[];
    crashes_by_version: NamedCount[];
    crashes_by_device: NamedCount[];
    crashes_by_os: NamedCount[];
    anrs_by_version: NamedCount[];
    anrs_by_device: NamedCount[];
    anrs_by_os: NamedCount[];
};

export type StoreAnalytics = {
    first_time_downloads: number;
    redownloads: number;
    total_downloads: number;
    updates: number;
    preorders: number;
    impressions: number;
    unique_impressions: number;
    page_views: number;
    unique_page_views: number;
    conversion_percent: number;
    sessions: number;
    avg_session_duration_seconds: number;
    active_devices: number;
    active_last_30_days: number;
    installations: number;
    deletions: number;
    crashes: number;
    anrs: number;
    crash_free_rate_percent: number;
    opt_in_percent: number;
    retention: { d1: number; d7: number; d14: number; d28: number };
    user_installs: number;
    device_installs: number;
    user_uninstalls: number;
    device_uninstalls: number;
    upgrades: number;
    listing_visitors: number;
    listing_acquisitions: number;
    listing_conversion_percent: number;
    current_device_installs: number;
    current_user_installs: number;
    total_user_installs: number;
    avg_rating: number;
    daily_avg_rating: number;
    rating_count: number;
    daily: StoreDailyPoint[];
    breakdowns: StoreBreakdowns;
    reports_pending: boolean;
    data_through?: string;
};

export function emptyBreakdowns(): StoreBreakdowns {
    return {
        sources: [],
        app_referrers: [],
        web_referrers: [],
        campaigns: [],
        territories: [],
        devices: [],
        page_types: [],
        product_pages: [],
        versions: [],
        platform_versions: [],
        languages: [],
        carriers: [],
        search_terms: [],
        utm_sources: [],
        utm_campaigns: [],
        crashes_by_version: [],
        crashes_by_device: [],
        crashes_by_os: [],
        anrs_by_version: [],
        anrs_by_device: [],
        anrs_by_os: [],
    };
}

export function emptyDailyPoint(day: string): StoreDailyPoint {
    return {
        day,
        first_time_downloads: 0,
        redownloads: 0,
        total_downloads: 0,
        updates: 0,
        impressions: 0,
        unique_impressions: 0,
        page_views: 0,
        unique_page_views: 0,
        sessions: 0,
        active_devices: 0,
        installations: 0,
        deletions: 0,
        crashes: 0,
        anrs: 0,
        user_installs: 0,
        device_installs: 0,
        user_uninstalls: 0,
        device_uninstalls: 0,
        upgrades: 0,
        listing_visitors: 0,
        listing_acquisitions: 0,
    };
}

export function emptyStoreAnalytics(): StoreAnalytics {
    return {
        first_time_downloads: 0,
        redownloads: 0,
        total_downloads: 0,
        updates: 0,
        preorders: 0,
        impressions: 0,
        unique_impressions: 0,
        page_views: 0,
        unique_page_views: 0,
        conversion_percent: 0,
        sessions: 0,
        avg_session_duration_seconds: 0,
        active_devices: 0,
        active_last_30_days: 0,
        installations: 0,
        deletions: 0,
        crashes: 0,
        anrs: 0,
        crash_free_rate_percent: 0,
        opt_in_percent: 0,
        retention: { d1: 0, d7: 0, d14: 0, d28: 0 },
        user_installs: 0,
        device_installs: 0,
        user_uninstalls: 0,
        device_uninstalls: 0,
        upgrades: 0,
        listing_visitors: 0,
        listing_acquisitions: 0,
        listing_conversion_percent: 0,
        current_device_installs: 0,
        current_user_installs: 0,
        total_user_installs: 0,
        avg_rating: 0,
        daily_avg_rating: 0,
        rating_count: 0,
        daily: [],
        breakdowns: emptyBreakdowns(),
        reports_pending: true,
    };
}

export function emptyDownloadAnalytics(windowDays = 90): DownloadAnalyticsData {
    return {
        window_days: windowDays,
        total_downloads: 0,
        total_installs: 0,
        active_devices: 0,
        avg_rating: 0,
        rating_count: 0,
        review_count: 0,
        crash_free_rate_percent: 0,
        install_conversion_percent: 0,
        total_play_installs: 0,
        daily_downloads: [],
        version_breakdown: [],
        crash_reports: [],
        diagnostics: [],
        reviews: [],
        regions: [],
        devices: [],
        os_split: [],
    };
}

export interface DownloadAnalyticsData {
    window_days: number;
    total_downloads: number;
    total_installs: number;
    active_devices: number;
    ios_active_devices?: number;
    android_active_devices?: number;
    avg_rating: number;
    rating_count: number;
    review_count: number;
    crash_free_rate_percent: number;
    install_conversion_percent: number;
    android_avg_rating?: number;
    android_rating_count?: number;
    total_play_installs: number;
    daily_downloads: { day: string; downloads: number; installs: number; updates: number; play_installs?: number }[];
    version_breakdown: { version: string; installs: number; share_percent: number }[];
    android_version_breakdown?: { version: string; installs: number; share_percent: number }[];
    crash_reports: { type: string; count: number }[];
    diagnostics: { issue: string; count: number }[];
    reviews: { author: string; rating: number; comment: string; date: string; source?: 'ios' | 'android' }[];
    regions: {
        region: string;
        downloads: number;
        installs: number;
        share_percent: number;
        ios_installs?: number;
        android_installs?: number;
    }[];
    devices: { model: string; os: string; count: number; share_percent: number }[];
    os_split: { os: string; count: number; share_percent: number }[];
    ios_store?: StoreAnalytics;
    android_store?: StoreAnalytics;
}

function daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
}

export const MOCK_DOWNLOAD_ANALYTICS: DownloadAnalyticsData = {
    window_days: 30,
    total_downloads: 12480,
    total_installs: 9320,
    active_devices: 6840,
    avg_rating: 4.6,
    rating_count: 218,
    review_count: 218,
    crash_free_rate_percent: 99.2,
    install_conversion_percent: 74.7,
    total_play_installs: 0,
    daily_downloads: Array.from({ length: 30 }, (_, i) => {
        const day = daysAgo(29 - i);
        const downloads = 320 + Math.round(Math.sin(i / 3) * 80) + (i % 7 === 0 ? 120 : 0);
        const installs = Math.round(downloads * (0.68 + (i % 5) * 0.02));
        const updates = Math.round(installs * 0.12);
        return { day, downloads, installs, updates, play_installs: 0 };
    }),
    version_breakdown: [
        { version: '2.4.1', installs: 4120, share_percent: 44.2 },
        { version: '2.4.0', installs: 2680, share_percent: 28.8 },
        { version: '2.3.2', installs: 1540, share_percent: 16.5 },
        { version: '2.3.1', installs: 980, share_percent: 10.5 },
    ],
    crash_reports: [
        { type: 'NullPointer on launch', count: 12 },
        { type: 'Network timeout', count: 9 },
        { type: 'Push token refresh', count: 6 },
        { type: 'Background sync', count: 4 },
        { type: 'Image decode OOM', count: 3 },
    ],
    diagnostics: [
        { issue: 'Slow cold start (>3s)', count: 47 },
        { issue: 'OTP delivery delay', count: 31 },
        { issue: 'Stale session token', count: 22 },
        { issue: 'Low storage warning', count: 18 },
    ],
    reviews: [
        { author: 'Dr. Ama K.', rating: 5, comment: 'Fast alerts and reliable duty handoff.', date: daysAgo(1) },
        { author: 'Nurse Kwesi', rating: 4, comment: 'Great for ward coverage; login could be smoother.', date: daysAgo(3) },
        { author: 'Admin Team', rating: 5, comment: 'Setup was straightforward for our facility.', date: daysAgo(5) },
        { author: 'IT Support', rating: 4, comment: 'Stable on Samsung A-series devices.', date: daysAgo(8) },
        { author: 'Clinical Lead', rating: 5, comment: 'Critical messaging works well under load.', date: daysAgo(11) },
    ],
    regions: [
        { region: 'Greater Accra', downloads: 4820, installs: 3610, share_percent: 38.7 },
        { region: 'Ashanti', downloads: 2940, installs: 2180, share_percent: 23.4 },
        { region: 'Central', downloads: 1680, installs: 1240, share_percent: 13.3 },
        { region: 'Western', downloads: 1120, installs: 840, share_percent: 9.0 },
        { region: 'Northern', downloads: 920, installs: 650, share_percent: 7.0 },
        { region: 'Other', downloads: 1000, installs: 800, share_percent: 8.6 },
    ],
    devices: [
        { model: 'Samsung Galaxy A14', os: 'Android 14', count: 1420, share_percent: 20.8 },
        { model: 'iPhone 13', os: 'iOS 17', count: 1180, share_percent: 17.3 },
        { model: 'Samsung Galaxy A54', os: 'Android 14', count: 960, share_percent: 14.0 },
        { model: 'iPhone 12', os: 'iOS 16', count: 740, share_percent: 10.8 },
        { model: 'Tecno Spark 10', os: 'Android 13', count: 620, share_percent: 9.1 },
    ],
    os_split: [
        { os: 'Android', count: 4120, share_percent: 60.2 },
        { os: 'iOS', count: 2720, share_percent: 39.8 },
    ],
};

/** Map download analytics into UGMC component-friendly AnalyticsData shape. */
export function mapDownloadAnalyticsToUgmc(data: DownloadAnalyticsData): AnalyticsData {
    const daily_message_volume = data.daily_downloads.map((row) => ({
        day: row.day,
        total_messages: row.downloads,
        critical_messages: row.installs,
        standard_messages: row.updates,
    }));

    const department_metrics = data.regions.map((r) => ({
        department_name: r.region,
        role_fill_rate_percent: r.share_percent,
        escalation_rate_vs_dept_critical_messages_percent: Math.round((r.installs / Math.max(r.downloads, 1)) * 100),
        filled_roles: r.installs,
        total_roles: r.downloads,
        critical_messages_sent: r.installs,
        avg_critical_ack_minutes: 0,
        escalation_notifications: 0,
        critical_filled_roles: r.installs,
        critical_total_roles: r.downloads,
        critical_role_fill_rate_percent: r.share_percent,
    }));

    const role_metrics = data.version_breakdown.map((v, i) => ({
        role_id: `v-${i}`,
        role_name: v.version,
        department_id: '',
        department_name: 'App versions',
        priority: i === 0 ? 'critical' : 'standard',
        filled: true,
        role_fill_rate_percent: v.share_percent,
        critical_total_roles: data.total_installs,
        critical_filled_roles: v.installs,
        critical_role_fill_rate_percent: v.share_percent,
        total_messages: v.installs,
        total_calls_made: 0,
        critical_messages: Math.round(v.installs * 0.15),
        standard_messages: v.installs,
        critical_messages_rate_percent: 15,
        escalated_critical_messages: data.crash_reports[i]?.count ?? 0,
        escalation_rate_percent: data.crash_reports[i]?.count ?? 0,
        escalation_rate_of_total_messages_percent: 0,
        avg_critical_ack_minutes: 0,
        avg_reply_response_minutes_all: 0,
        avg_reply_response_minutes_critical: 0,
    }));

    const top_escalated_roles = data.crash_reports.map((c, i) => ({
        role_name: c.type,
        role_id: `crash-${i}`,
        escalation_count: c.count,
    }));

    const least_escalated_roles = data.diagnostics.slice(0, 5).map((d, i) => ({
        role_name: d.issue,
        role_id: `diag-${i}`,
        escalation_count: d.count,
    }));

    return {
        active_users_count: data.total_installs,
        active_users_rate_percent: data.install_conversion_percent,
        registered_staff_count: data.total_downloads,
        total_messages: data.total_downloads,
        critical_messages: data.total_installs,
        critical_messages_rate_percent: data.install_conversion_percent,
        standard_messages: data.active_devices,
        escalation_rate_percent: 100 - data.crash_free_rate_percent,
        escalated_critical_messages: data.crash_reports.reduce((s, c) => s + c.count, 0),
        escalation_rate_of_total_messages_percent: 0,
        role_fill_rate_percent: data.crash_free_rate_percent,
        filled_roles: data.active_devices,
        total_roles: data.total_installs,
        critical_role_fill_rate_percent: data.avg_rating * 20,
        critical_filled_roles: Math.round(data.review_count * data.avg_rating),
        critical_total_roles: data.review_count,
        avg_critical_ack_minutes: data.diagnostics[0]?.count ?? 0,
        avg_first_read_minutes_all: data.diagnostics[1]?.count ?? 0,
        avg_first_read_minutes_critical: data.diagnostics[2]?.count ?? 0,
        avg_first_read_minutes_non_critical: data.diagnostics[3]?.count ?? 0,
        total_calls_made: data.devices.length,
        window_days: data.window_days,
        avg_sign_in_minutes_since_midnight_utc: 0,
        avg_sign_out_minutes_since_midnight_utc: 0,
        daily_message_volume,
        department_metrics,
        top_escalated_roles,
        least_escalated_roles,
        role_metrics,
    };
}

function todayUTC(): string {
    return new Date().toISOString().slice(0, 10);
}

function cutoffDay(days: number): string {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - Math.max(1, days));
    return cutoff.toISOString().slice(0, 10);
}

function normalizeRange(from: string, to: string): { from: string; to: string } {
    const start = from || to || todayUTC();
    const end = to || from || todayUTC();
    return start <= end ? { from: start, to: end } : { from: end, to: start };
}

function inclusiveDayCount(from: string, to: string): number {
    const start = new Date(`${from}T00:00:00Z`).getTime();
    const end = new Date(`${to}T00:00:00Z`).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return 1;
    return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

function sumDaily(daily: StoreDailyPoint[], key: keyof StoreDailyPoint): number {
    return daily.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
}

/** Latest non-zero value in the window. Use for stock metrics (Play active device installs, etc.). */
function latestDaily(daily: StoreDailyPoint[], key: keyof StoreDailyPoint): number {
    for (let i = daily.length - 1; i >= 0; i -= 1) {
        const value = Number(daily[i][key]) || 0;
        if (value > 0) return value;
    }
    return 0;
}

/** Busiest single day in the window. Use for metrics that count unique devices per day. */
function peakDaily(daily: StoreDailyPoint[], key: keyof StoreDailyPoint): number {
    return daily.reduce((peak, row) => Math.max(peak, Number(row[key]) || 0), 0);
}

function sliceStoreToRange(
    store: StoreAnalytics,
    from: string,
    to: string,
    platform: 'ios' | 'android',
): StoreAnalytics {
    const range = normalizeRange(from, to);
    const daily = store.daily.filter((row) => row.day >= range.from && row.day <= range.to);
    const first_time_downloads = sumDaily(daily, 'first_time_downloads') || sumDaily(daily, 'user_installs') || sumDaily(daily, 'device_installs');
    const redownloads = sumDaily(daily, 'redownloads');
    const impressions = sumDaily(daily, 'impressions');
    const unique_impressions = sumDaily(daily, 'unique_impressions');
    const page_views = sumDaily(daily, 'page_views');
    const unique_page_views = sumDaily(daily, 'unique_page_views');
    const listing_visitors = sumDaily(daily, 'listing_visitors');
    const listing_acquisitions = sumDaily(daily, 'listing_acquisitions');
    const sessions = sumDaily(daily, 'sessions');
    const crashes = sumDaily(daily, 'crashes');
    const total_downloads = (first_time_downloads + redownloads) || sumDaily(daily, 'total_downloads');
    const user_installs = sumDaily(daily, 'user_installs');
    const device_installs = sumDaily(daily, 'device_installs');
    const upgrades = sumDaily(daily, 'upgrades');
    const updates = sumDaily(daily, 'updates') || upgrades;
    const installations = sumDaily(daily, 'installations') || device_installs;
    const device_uninstalls = sumDaily(daily, 'device_uninstalls') || sumDaily(daily, 'user_uninstalls') || sumDaily(daily, 'deletions');
    const deletions = sumDaily(daily, 'deletions') || device_uninstalls;
    const activeDevices = platform === 'android'
        ? latestDaily(daily, 'active_devices')
        : peakDaily(daily, 'active_devices');
    // Dimension breakdowns are period totals from the fetch window, not day-sliced.
    // Keep them only when the filter still covers the full loaded series; otherwise
    // hide them so a single-day Android view doesn't keep 90-day mix charts.
    const coversFullLoadedWindow = daily.length === store.daily.length
        && (daily.length === 0
            || (daily[0]?.day === store.daily[0]?.day
                && daily[daily.length - 1]?.day === store.daily[store.daily.length - 1]?.day));
    return {
        ...store,
        first_time_downloads,
        redownloads,
        total_downloads,
        updates,
        impressions,
        unique_impressions,
        page_views,
        unique_page_views,
        // App Store conversion is downloads per unique impression; Play has no impression
        // equivalent, so fall back to its store listing conversion.
        conversion_percent: unique_impressions > 0
            ? Math.round((total_downloads / unique_impressions) * 1000) / 10
            : listing_visitors > 0
                ? Math.round((listing_acquisitions / listing_visitors) * 1000) / 10
                : 0,
        sessions,
        // Never fall back to the unfiltered store totals here (that made single-day
        // Android filters look unchanged). Play active device installs are a stock
        // figure, so the latest day in the range is the current install base. App Store
        // active devices are per-day unique devices, which cannot be summed across days,
        // so a multi-day range reports its busiest day.
        active_devices: activeDevices,
        active_last_30_days: activeDevices,
        installations,
        deletions,
        crashes,
        anrs: sumDaily(daily, 'anrs'),
        crash_free_rate_percent: sessions > 0
            ? Math.round(Math.max(0, Math.min(100, (1 - crashes / sessions) * 100)) * 10) / 10
            : 0,
        user_installs,
        device_installs,
        user_uninstalls: sumDaily(daily, 'user_uninstalls'),
        device_uninstalls,
        upgrades,
        listing_visitors,
        listing_acquisitions,
        listing_conversion_percent: listing_visitors > 0
            ? Math.round((listing_acquisitions / listing_visitors) * 1000) / 10
            : 0,
        breakdowns: coversFullLoadedWindow ? store.breakdowns : emptyBreakdowns(),
        daily,
    };
}

export function downloadAnalyticsPresetRange(days: number): { from: string; to: string } {
    return { from: cutoffDay(days), to: todayUTC() };
}

export function downloadAnalyticsAllTimeRange(data: DownloadAnalyticsData): { from: string; to: string } {
    const days: string[] = [];
    for (const row of data.daily_downloads) {
        if (row.day) days.push(row.day);
    }
    for (const row of data.ios_store?.daily || []) {
        if (row.day) days.push(row.day);
    }
    for (const row of data.android_store?.daily || []) {
        if (row.day) days.push(row.day);
    }
    days.sort();
    if (days.length === 0) return downloadAnalyticsPresetRange(90);
    return { from: days[0], to: days[days.length - 1] };
}

export function filterDownloadAnalyticsByRange(
    data: DownloadAnalyticsData,
    from: string,
    to: string,
): DownloadAnalyticsData {
    const range = normalizeRange(from, to);
    const slice = data.daily_downloads.filter((row) => row.day >= range.from && row.day <= range.to);
    const totalDownloads = slice.reduce((s, r) => s + r.downloads, 0);
    const totalInstalls = slice.reduce((s, r) => s + r.installs, 0);
    const totalPlay = slice.reduce((s, r) => s + (r.play_installs ?? 0), 0);
    const ios_store = data.ios_store ? sliceStoreToRange(data.ios_store, range.from, range.to, 'ios') : data.ios_store;
    const android_store = data.android_store ? sliceStoreToRange(data.android_store, range.from, range.to, 'android') : data.android_store;
    return {
        ...data,
        window_days: inclusiveDayCount(range.from, range.to),
        total_downloads: totalDownloads,
        total_installs: totalInstalls,
        total_play_installs: totalPlay,
        android_active_devices: android_store?.active_devices ?? data.android_active_devices,
        daily_downloads: slice,
        ios_store,
        android_store,
        reviews: data.reviews.filter((review) => !review.date || (review.date >= range.from && review.date <= range.to)),
        install_conversion_percent: totalDownloads > 0
            ? Math.round((totalInstalls / totalDownloads) * 1000) / 10
            : 0,
    };
}

export function filterDownloadAnalyticsByDays(
    data: DownloadAnalyticsData,
    days: number,
): DownloadAnalyticsData {
    const range = downloadAnalyticsPresetRange(days);
    return filterDownloadAnalyticsByRange(data, range.from, range.to);
}
