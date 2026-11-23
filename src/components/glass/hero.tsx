'use client';

import type { ReactNode } from 'react';

export type HeroKpiTone = 'navy' | 'mint' | 'sky' | 'amber' | 'rose';

/** Spread header card of KPI tiles, as on the Staff directory (pairs with staff-glass.css + glass-kit.css). */
export function HeroKpis({ label, mark, children }: { label: string; mark: string; children: ReactNode }) {
    return (
        <section className="sx-hero hx-kit gx-reveal" aria-label={label}>
            <span className="material-icons-round sx-hero__mark" aria-hidden>{mark}</span>
            <div className="sx-kpis">{children}</div>
        </section>
    );
}

/** One tile: tone chip + label, big value with an illustration beside it, a one-line foot, and a faint watermark. */
export function HeroKpi({
    tone,
    icon,
    label,
    value,
    art,
    foot,
}: {
    tone: HeroKpiTone;
    icon: string;
    label: string;
    value: ReactNode;
    art?: ReactNode;
    foot: ReactNode;
}) {
    return (
        <div className={`sx-kpi sx-kpi--${tone}`}>
            <span className="sx-kpi__glow" aria-hidden />
            <span className="material-icons-round sx-kpi__mark" aria-hidden>{icon}</span>
            <div className="sx-kpi__top">
                <span className="sx-kpi__icon"><span className="material-icons-round">{icon}</span></span>
                <span className="sx-kpi__label">{label}</span>
            </div>
            <div className="sx-kpi__body">
                <div className="sx-kpi__value">{value}</div>
                {art}
            </div>
            <div className="sx-kpi__foot">{foot}</div>
        </div>
    );
}

/** Thin segmented bar (one segment per non-zero part); greys out when everything is zero. */
export function SplitBar({ parts, label }: { parts: { label: string; n: number; color: string }[]; label: string }) {
    const shown = parts.filter(p => p.n > 0);
    return (
        <div className="sx-stack" role="img" aria-label={label} style={{ width: '100%', maxWidth: 120, alignSelf: 'center' }}>
            {shown.length > 0
                ? shown.map(p => <span key={p.label} title={`${p.label}: ${p.n}`} style={{ flex: p.n, background: p.color }} />)
                : <span style={{ flex: 1, background: 'rgba(27, 42, 68, 0.08)' }} />}
        </div>
    );
}
