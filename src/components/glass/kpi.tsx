'use client';

import type { ReactNode } from 'react';

export type KpiTone = 'sky' | 'indigo' | 'mint' | 'amber' | 'rose' | 'slate';

export function KpiTile({
    tone,
    icon,
    label,
    value,
    foot,
    chart,
    watermark,
    onClick,
    alert,
}: {
    tone: KpiTone;
    icon: string;
    label: string;
    value: ReactNode;
    foot: ReactNode;
    chart: ReactNode;
    watermark: string;
    onClick: () => void;
    alert?: boolean;
}) {
    return (
        <button type="button" className={`hx-kpi hx-kpi--${tone}${alert ? ' hx-kpi--alert' : ''}`} onClick={onClick}>
            <span className="hx-kpi__glow" aria-hidden />
            <span className="material-icons-round hx-kpi__mark" aria-hidden>{watermark}</span>
            <span className="hx-kpi__top">
                <span className="hx-kpi__icon"><span className="material-icons-round">{icon}</span></span>
                <span className="hx-kpi__label">{label}</span>
                <span className="material-icons-round hx-kpi__go">arrow_outward</span>
            </span>
            <span className="hx-kpi__body">
                <span className="hx-kpi__nums">
                    <span className="hx-kpi__value">{value}</span>
                    <span className="hx-kpi__foot">{foot}</span>
                </span>
                <span className="hx-kpi__chart">{chart}</span>
            </span>
        </button>
    );
}

/* ── Illustrations / charts ─────────────────────────────────── */

/** Decorative heartbeat trace (illustration, not data). */
export function PulseLine() {
    return (
        <svg className="hx-ecg" viewBox="0 0 160 64" aria-hidden>
            <defs>
                <linearGradient id="hxEcgFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
            </defs>
            <path
                d="M0 40 H38 L46 40 L52 30 L58 46 L66 8 L74 58 L82 34 L88 40 H112 L118 34 L124 40 H160 V64 H0 Z"
                fill="url(#hxEcgFill)"
            />
            <path
                className="hx-ecg__line"
                d="M0 40 H38 L46 40 L52 30 L58 46 L66 8 L74 58 L82 34 L88 40 H112 L118 34 L124 40 H160"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle className="hx-ecg__dot" cx="160" cy="40" r="3.5" fill="currentColor" />
        </svg>
    );
}

/** 40-dot waffle: each dot ≈ 2.5% of accounts. */
export function DotGrid({ pct, label }: { pct: number; label?: string }) {
    const filled = Math.round(Math.max(0, Math.min(100, pct)) / 2.5);
    return (
        <span className="hx-waffle" role="img" aria-label={label ?? `${pct}% active`}>
            {Array.from({ length: 40 }, (_, i) => (
                <span key={i} className={i < filled ? 'is-on' : undefined} style={{ animationDelay: `${i * 12}ms` }} />
            ))}
        </span>
    );
}

/** Semicircle gauge with ticks and a target marker. */
export function Gauge({ pct, target = 80 }: { pct: number; target?: number }) {
    const clamped = Math.max(0, Math.min(100, pct));
    const r = 44;
    const len = Math.PI * r;
    const angle = (deg: number) => Math.PI * (1 - deg / 100);
    const pt = (p: number, rr: number) => [60 + rr * Math.cos(angle(p)), 56 - rr * Math.sin(angle(p))];
    const [tx1, ty1] = pt(target, r - 9);
    const [tx2, ty2] = pt(target, r + 9);
    const [nx, ny] = pt(clamped, r - 14);
    return (
        <svg className="hx-gauge" viewBox="0 0 120 64" role="img" aria-label={`${clamped}% of target ${target}%`}>
            {Array.from({ length: 11 }, (_, i) => {
                const [x1, y1] = pt(i * 10, r + 6);
                const [x2, y2] = pt(i * 10, r + 10);
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="hx-gauge__tick" />;
            })}
            <path d={`M16 56 A${r} ${r} 0 0 1 104 56`} className="hx-gauge__track" />
            <path
                d={`M16 56 A${r} ${r} 0 0 1 104 56`}
                className="hx-gauge__fill"
                strokeDasharray={len}
                strokeDashoffset={len * (1 - clamped / 100)}
            />
            <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} className="hx-gauge__target" />
            <line x1="60" y1="56" x2={nx} y2={ny} className="hx-gauge__needle" />
            <circle cx="60" cy="56" r="4" className="hx-gauge__hub" />
        </svg>
    );
}

/** One segment per critical role: covered vs. missing a ladder. */
export function LadderBars({ total, missing }: { total: number; missing: number }) {
    if (total <= 0) {
        return (
            <svg className="hx-shield" viewBox="0 0 64 64" aria-hidden>
                <path d="M32 6 L52 14 V30 C52 44 43 53 32 58 C21 53 12 44 12 30 V14 Z" className="hx-shield__body" />
                <path d="M24 32 L30 38 L41 26" className="hx-shield__check" />
            </svg>
        );
    }
    const shown = Math.min(total, 24);
    const scale = total / shown;
    const missingShown = Math.round(missing / scale);
    return (
        <span className="hx-ladder" role="img" aria-label={`${missing} of ${total} critical roles missing a ladder`}>
            {Array.from({ length: shown }, (_, i) => (
                <span
                    key={i}
                    className={i < missingShown ? 'is-miss' : 'is-ok'}
                    style={{ animationDelay: `${i * 25}ms` }}
                />
            ))}
        </span>
    );
}

/** Vertical bars on a shared scale (each bar is a real value). */
export function MiniBars({ values, labels }: { values: number[]; labels?: string[] }) {
    const max = Math.max(1, ...values);
    return (
        <span className="hx-minibars" role="img" aria-label={values.map((v, i) => `${labels?.[i] ?? i + 1}: ${v}`).join(', ')}>
            {values.map((v, i) => (
                <span key={i} title={labels ? `${labels[i]}: ${v}` : String(v)} style={{ height: `${Math.max(8, (v / max) * 100)}%`, animationDelay: `${i * 40}ms` }} />
            ))}
        </span>
    );
}

/** Progress ring; `pct` 0–100, optional centre content. */
export function Ring({ pct, size = 64, children }: { pct: number; size?: number; children?: ReactNode }) {
    const r = 26;
    const c = 2 * Math.PI * r;
    const clamped = Math.max(0, Math.min(100, pct));
    return (
        <span className="hx-ring" style={{ width: size, height: size }}>
            <svg viewBox="0 0 64 64" aria-hidden>
                <circle cx="32" cy="32" r={r} className="hx-ring__track" />
                <circle cx="32" cy="32" r={r} className="hx-ring__fill" strokeDasharray={c} strokeDashoffset={c * (1 - clamped / 100)} />
            </svg>
            <span className="hx-ring__center">{children}</span>
        </span>
    );
}

/** Horizontal stacked bar for bed states. */
export function BedStack({ available, occupied, blocked, compact }: { available: number; occupied: number; blocked: number; compact?: boolean }) {
    const total = available + occupied + blocked;
    return (
        <span className={`hx-bedstack${compact ? ' hx-bedstack--compact' : ''}`} role="img" aria-label={`${available} available, ${occupied} occupied, ${blocked} out of service`}>
            {total === 0 ? (
                <span className="hx-bedstack__empty" />
            ) : (
                <>
                    {occupied > 0 && <span className="is-occ" style={{ flexGrow: occupied }} />}
                    {available > 0 && <span className="is-free" style={{ flexGrow: available }} />}
                    {blocked > 0 && <span className="is-oos" style={{ flexGrow: blocked }} />}
                </>
            )}
        </span>
    );
}
