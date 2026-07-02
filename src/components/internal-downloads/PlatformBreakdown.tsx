'use client';

export function fmtCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

export function PlatformBreakdown({ ios, android }: { ios: number; android: number }) {
    return (
        <div className="flex w-full items-center justify-between gap-4 text-sm text-text-secondary">
            <span>Android: {fmtCount(android)}</span>
            <span>iOS: {fmtCount(ios)}</span>
        </div>
    );
}
