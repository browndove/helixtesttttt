'use client';

import * as React from 'react';

/**
 * Shared option fragments for analytics charts, so every chart gets the same line, wash, bar
 * and tooltip treatment. Defaults that apply to all charts live in apex-theme.ts instead.
 */

export function escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** Smooth line that never overshoots below zero between points. */
export function smoothLine(colors?: string[], width = 2.5): ApexCharts.ApexOptions["stroke"] {
    return { curve: 'monotoneCubic', width, lineCap: 'round', ...(colors ? { colors } : {}) };
}

/** Soft vertical wash under an area series: the series hue at the line, fading to nothing. */
export function areaWash(from = 0.38): ApexCharts.ApexOptions["fill"] {
    return { type: 'gradient', gradient: { type: 'vertical', shadeIntensity: 0, opacityFrom: from, opacityTo: 0.02, stops: [0, 100] } };
}

/** Columns slightly lighter at the cap than the baseline, so they read as lit rather than flat. */
export function barSheen(horizontal = false): ApexCharts.ApexOptions["fill"] {
    return {
        type: 'gradient',
        gradient: { type: horizontal ? 'horizontal' : 'vertical', shade: 'light', shadeIntensity: 0.18, inverseColors: false, opacityFrom: 1, opacityTo: 0.86, stops: [0, 100] },
    };
}

/** Column width capped at 26px so a chart with few bars gets slim bars, not slabs; dense series use a share of the slot. */
export function barWidth(count: number): string {
    return count >= 12 ? '60%' : '26px';
}

/** Faint same-hue track behind each bar (single-series ranked bars). */
export function trackBars(hex: string): string[] {
    return [`${hex}14`];
}

/** Filled dot and value label on the latest point of a time series. */
export function endpointAnnotation(x: string | number, y: number, color: string, label: string): ApexCharts.ApexOptions["annotations"] {
    return {
        points: [
            {
                x,
                y,
                marker: { size: 5, fillColor: color, strokeColor: '#fff', strokeWidth: 2.5 },
                label: {
                    text: label,
                    borderWidth: 0,
                    offsetY: -6,
                    style: { background: 'rgba(255,255,255,0.92)', color: '#1b2a44', fontSize: '11px', fontWeight: 700, padding: { left: 6, right: 6, top: 2, bottom: 2 } },
                },
            },
        ],
    };
}

export type TipRow = { color?: string; label: string; value: string };

/** Glass tooltip markup (styled by .an-tip in analytics-glass.css). All text is escaped. */
export function glassTooltip({ title, rows, foot }: { title: string; rows: TipRow[]; foot?: string }): string {
    const body = rows
        .map(
            (r) =>
                `<div class="an-tip__row">${r.color ? `<span class="an-tip__dot" style="background:${escapeHtml(r.color)}"></span>` : ''}${escapeHtml(r.label)}<b>${escapeHtml(r.value)}</b></div>`,
        )
        .join('');
    return `<div class="an-tip"><div class="an-tip__title">${escapeHtml(title)}</div>${body}${foot ? `<div class="an-tip__foot">${escapeHtml(foot)}</div>` : ''}</div>`;
}

/** Shared-x tooltip for line/area/column charts with one or more series. */
export function seriesTooltip(categories: (string | number)[], names: string[], colors: string[], fmt: (v: number) => string = (v) => v.toLocaleString()) {
    return ({ series, dataPointIndex }: { series: number[][]; dataPointIndex: number }) =>
        glassTooltip({
            title: String(categories[dataPointIndex] ?? ''),
            rows: names.map((name, i) => ({ color: colors[i], label: name, value: fmt(Number(series[i]?.[dataPointIndex] ?? 0)) })),
        });
}

function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Eases a number from its previous value to `target` (easeOutCubic). */
export function useCountUp(target: number, duration = 900): number {
    const [value, setValue] = React.useState(0);
    const fromRef = React.useRef(0);
    React.useEffect(() => {
        if (!Number.isFinite(target)) return;
        const from = fromRef.current;
        if (prefersReducedMotion() || from === target) {
            fromRef.current = target;
            setValue(target);
            return;
        }
        const start = performance.now();
        let raf = 0;
        const tick = (now: number) => {
            const p = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            const v = from + (target - from) * eased;
            fromRef.current = v;
            setValue(v);
            if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);
    return value;
}
