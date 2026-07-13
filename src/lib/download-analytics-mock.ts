import type { AnalyticsData } from '@/app/(helix-admin)/usage/page';

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

export function filterDownloadAnalyticsByDays(
    data: DownloadAnalyticsData,
    days: number,
): DownloadAnalyticsData {
    const slice = data.daily_downloads.slice(-Math.max(1, days));
    const totalDownloads = slice.reduce((s, r) => s + r.downloads, 0);
    const totalInstalls = slice.reduce((s, r) => s + r.installs, 0);
    return {
        ...data,
        window_days: days,
        total_downloads: totalDownloads,
        total_installs: totalInstalls,
        daily_downloads: slice,
        install_conversion_percent: totalDownloads > 0
            ? Math.round((totalInstalls / totalDownloads) * 1000) / 10
            : 0,
    };
}
