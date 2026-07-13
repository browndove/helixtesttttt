'use client';

import type { DownloadAnalyticsData } from '@/lib/download-analytics-mock';
import { countryCodeToName } from '@/lib/country-names';

export type PlatformFilterValue = 'all' | 'ios' | 'android';

const OPTIONS: { value: PlatformFilterValue; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'ios', label: 'iOS' },
    { value: 'android', label: 'Android' },
];

export function PlatformFilter({
    value,
    onChange,
}: {
    value: PlatformFilterValue;
    onChange: (next: PlatformFilterValue) => void;
}) {
    return (
        <div
            className="inline-flex items-center rounded-lg border border-border-subtle bg-secondary p-0.5"
            role="group"
            aria-label="Platform filter"
        >
            {OPTIONS.map((option) => {
                const active = value === option.value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onChange(option.value)}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                            active
                                ? 'bg-[rgba(41,128,211,0.14)] text-accent-primary'
                                : 'text-text-muted hover:text-text-primary'
                        }`}
                        aria-pressed={active}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

export function platformInstallTotals(
    data: DownloadAnalyticsData,
    platform: PlatformFilterValue,
): { ios: number; android: number; total: number } {
    const ios = platform === 'android' ? 0 : data.total_installs;
    const android = platform === 'ios' ? 0 : (data.total_play_installs ?? 0);
    return { ios, android, total: ios + android };
}

export function dailyInstallRows(
    data: DownloadAnalyticsData,
    platform: PlatformFilterValue,
) {
    return data.daily_downloads.map((row) => {
        const ios = platform === 'android' ? 0 : row.installs;
        const android = platform === 'ios' ? 0 : (row.play_installs ?? 0);
        return {
            day: row.day,
            ios,
            android,
            total: ios + android,
            updates: platform === 'android' ? 0 : row.updates,
        };
    });
}

export function regionalPlatformRows(
    data: DownloadAnalyticsData,
    platform: PlatformFilterValue,
) {
    return data.regions
        .map((region) => {
            const ios = platform === 'android' ? 0 : (region.ios_installs ?? region.installs);
            const android = platform === 'ios' ? 0 : (region.android_installs ?? 0);
            return {
                name: countryCodeToName(region.region),
                ios,
                android,
                total: ios + android,
            };
        })
        .filter((row) => row.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 6);
}

export function platformFilterLabel(platform: PlatformFilterValue): string {
    if (platform === 'ios') return 'iOS';
    if (platform === 'android') return 'Android';
    return 'iOS + Android';
}
