'use client';

import type { ReactNode } from 'react';
import Text from '@/components/analytics/text';

/** Box-and-whisker of a real distribution (min · Q1 · median · Q3 · max), scaled to max. */
export function SpreadBox({ min, q1, median, q3, max }: { min: number; q1: number; median: number; q3: number; max: number }) {
    const top = Math.max(max, q3, median, 1);
    const x = (v: number) => 8 + (Math.max(0, v) / top) * 124;
    const lo = x(min || q1);
    const hi = x(max || q3);
    return (
        <svg className="an-spread" viewBox="0 0 140 56" role="img" aria-label={`Middle 50% between ${q1} and ${q3}, median ${median}`}>
            <line x1="8" y1="44" x2="132" y2="44" className="an-spread__axis" />
            <line x1={lo} y1="26" x2={hi} y2="26" className="an-spread__whisker" />
            <line x1={lo} y1="19" x2={lo} y2="33" className="an-spread__whisker" />
            <line x1={hi} y1="19" x2={hi} y2="33" className="an-spread__whisker" />
            <rect x={x(q1)} y="14" width={Math.max(3, x(q3) - x(q1))} height="24" rx="6" className="an-spread__box" />
            <line x1={x(median)} y1="10" x2={x(median)} y2="42" className="an-spread__median" />
            <circle cx={x(median)} cy="10" r="3.2" className="an-spread__dot" />
        </svg>
    );
}

/** 24-hour dial: hand at the sign-in time, arc running to the sign-out time (minutes since midnight UTC). */
export function ClockDial({ start, end }: { start: number | null; end: number | null }) {
    const r = 24;
    const toXY = (minutes: number, radius: number) => {
        const a = (minutes / 1440) * 2 * Math.PI - Math.PI / 2;
        // Rounded so server and client render identical attributes (no hydration mismatch).
        return [Math.round((32 + radius * Math.cos(a)) * 100) / 100, Math.round((32 + radius * Math.sin(a)) * 100) / 100];
    };
    const hasStart = start != null && start > 0;
    const hasEnd = hasStart && end != null && end > 0;
    let arc: string | null = null;
    if (hasEnd) {
        const span = ((end! - start!) + 1440) % 1440;
        const [sx, sy] = toXY(start!, r);
        const [ex, ey] = toXY(end!, r);
        arc = `M${sx} ${sy} A${r} ${r} 0 ${span > 720 ? 1 : 0} 1 ${ex} ${ey}`;
    }
    const [hx, hy] = hasStart ? toXY(start!, r - 8) : [32, 14];
    return (
        <svg className="an-clock" viewBox="0 0 64 64" role="img" aria-label="Sign-in and sign-out times on a 24-hour dial">
            <circle cx="32" cy="32" r={r} className="an-clock__face" />
            {Array.from({ length: 24 }, (_, i) => {
                const [x1, y1] = toXY(i * 60, r - (i % 6 === 0 ? 5 : 2.5));
                const [x2, y2] = toXY(i * 60, r);
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={i % 6 === 0 ? 'an-clock__tick an-clock__tick--major' : 'an-clock__tick'} />;
            })}
            {arc && <path d={arc} className="an-clock__arc" />}
            <line x1="32" y1="32" x2={hx} y2={hy} className={hasStart ? 'an-clock__hand' : 'an-clock__hand an-clock__hand--idle'} />
            <circle cx="32" cy="32" r="3" className="an-clock__hub" />
        </svg>
    );
}

/** Card heading with a Material icon chip, keeping the card's existing Text styling. */
export function CardTitle({
    icon,
    children,
    variant = 'body-md-semibold',
    tone = 'blue',
    className,
}: {
    icon: string;
    children: ReactNode;
    variant?: string;
    tone?: 'blue' | 'rose';
    className?: string;
}) {
    return (
        <span className={`an-title an-title--${tone}`}>
            <span className="an-title__chip" aria-hidden>
                <span className="material-icons-round">{icon}</span>
            </span>
            <Text variant={variant as 'body-md-semibold'} color={tone === 'rose' ? 'accent-red' : 'text-primary'} className={className}>
                {children}
            </Text>
        </span>
    );
}
