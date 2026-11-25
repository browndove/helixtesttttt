'use client';

import type { ReactNode } from 'react';

/** Shared in-card pieces for the analytics glass skin (styles in analytics-glass.css). */

export type Tone = 'blue' | 'mint' | 'rose' | 'amber' | 'slate';

/** Rounded icon tile that leads a list row. */
export function RowIcon({ icon, tone = 'blue' }: { icon: string; tone?: Tone }) {
    return (
        <span className={`an-rowicon an-tone--${tone}`} aria-hidden>
            <span className="material-icons-round">{icon}</span>
        </span>
    );
}

export function Pill({ tone = 'slate', dot, children, title }: { tone?: Tone; dot?: boolean; children: ReactNode; title?: string }) {
    return (
        <span className={`an-pill an-tone--${tone}`} title={title}>
            {dot && <span className="an-pill__dot" aria-hidden />}
            {children}
        </span>
    );
}

/** Thin progress track; `pct` 0–100. */
export function Meter({ pct, tone = 'blue', label }: { pct: number; tone?: Tone; label?: string }) {
    const clamped = Math.max(0, Math.min(100, pct));
    return (
        <span className={`an-meter an-tone--${tone}`} role="img" aria-label={label ?? `${Math.round(clamped)}%`}>
            <span className="an-meter__fill" style={{ width: `${clamped}%` }} />
        </span>
    );
}

/** Small figure with a caption, for the stat strip at the top of a card. */
export function MetricTile({ label, value, icon, tone = 'blue', hint }: { label: string; value: ReactNode; icon?: string; tone?: Tone; hint?: string }) {
    return (
        <div className="an-metric" title={hint}>
            <span className="an-metric__label">
                {icon && <span className={`material-icons-round an-metric__icon an-tone--${tone}`} aria-hidden>{icon}</span>}
                {label}
            </span>
            <span className="an-metric__value">{value}</span>
        </div>
    );
}

/** Tinted note with a leading icon (insights, recommendations). */
export function Callout({ icon = 'tips_and_updates', tone = 'blue', children }: { icon?: string; tone?: Tone; children: ReactNode }) {
    return (
        <div className={`an-callout an-tone--${tone}`}>
            <span className="material-icons-round an-callout__icon" aria-hidden>{icon}</span>
            <span className="an-callout__text">{children}</span>
        </div>
    );
}

/** Friendly empty state with a soft illustration badge. */
export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
    return (
        <div className="an-empty">
            <span className="an-empty__badge" aria-hidden>
                <span className="an-empty__ring" />
                <span className="material-icons-round">{icon}</span>
            </span>
            <span className="an-empty__title">{title}</span>
            {hint && <span className="an-empty__hint">{hint}</span>}
        </div>
    );
}
