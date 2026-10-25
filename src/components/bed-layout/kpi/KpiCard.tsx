import { cn } from '@/lib/utils';
import Delta from './Delta';
import RadialProgress from './RadialProgress';
import Sparkline from './Sparkline';
import StatusPill from './StatusPill';
import { KPI_TONES, type KpiCardProps, type KpiFooterLead, type KpiFooterTrailing, type KpiTone, type KpiVisual } from './kpiConfig';

const BLOCK_COLORS: Record<KpiTone, string> = {
    neutral: 'bg-slate-300',
    green: 'bg-emerald-500',
    blue: 'bg-blue-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
};

function VisualSlot({ visual, tone }: { visual: KpiVisual; tone: KpiTone }) {
    const style = KPI_TONES[tone];
    switch (visual.type) {
        case 'ring':
            return <RadialProgress value={visual.value} color={style.stroke} trackColor={style.track} label={visual.label} />;
        case 'sparkline':
            return <Sparkline points={visual.points} color={style.stroke} label={visual.label} />;
        case 'blocks':
            return (
                <div role="img" aria-label={visual.label} className="flex shrink-0 flex-col items-end gap-1.5">
                    <div aria-hidden className="flex gap-1">
                        {visual.blocks.map((block, index) => (
                            <span
                                key={index}
                                className={cn(
                                    'h-2.5 w-2.5 rounded-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_1px_2px_rgba(15,23,42,0.18)]',
                                    BLOCK_COLORS[block],
                                )}
                            />
                        ))}
                    </div>
                    <span aria-hidden className={cn('text-[12px] font-bold tabular-nums', style.text)}>{visual.caption}</span>
                </div>
            );
        case 'pill':
            return <StatusPill variant={visual.variant}>{visual.text}</StatusPill>;
    }
}

function FooterLead({ lead, tone }: { lead: KpiFooterLead; tone: KpiTone }) {
    if (lead.type === 'pill') return <StatusPill variant={lead.variant}>{lead.text}</StatusPill>;
    const Icon = lead.icon;
    return (
        <span className="flex min-w-0 items-center gap-1.5 text-slate-500">
            {Icon ? (
                <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
            ) : (
                <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', KPI_TONES[tone].dot)} />
            )}
            <span className="truncate tabular-nums">{lead.text}</span>
        </span>
    );
}

function FooterTrailing({ trailing }: { trailing: KpiFooterTrailing }) {
    if (trailing.type === 'pill') return <StatusPill variant={trailing.variant}>{trailing.text}</StatusPill>;
    if (trailing.type === 'delta') return <Delta value={trailing.value} suffix={trailing.suffix} />;
    return <span className="shrink-0 whitespace-nowrap font-medium tabular-nums text-slate-600">{trailing.text}</span>;
}

/** Inner depth stays well below the card's own shadow so the value keeps top billing. */
const ICON_DEPTH = 'shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.06),0_3px_8px_-3px_rgba(15,23,42,0.10)]';
const FOOTER_DEPTH = 'shadow-[inset_0_1px_3px_rgba(15,23,42,0.035)]';

/** Layered shadows: a white inner top edge, a tight contact shadow, then a wide soft drop. */
const ELEVATION = {
    raised: [
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.05),0_8px_20px_-10px_rgba(15,23,42,0.10)]',
        'hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_4px_rgba(15,23,42,0.05),0_16px_32px_-12px_rgba(15,23,42,0.16)]',
    ].join(' '),
    floating: [
        '-translate-y-1 shadow-[inset_0_1px_0_#fff,0_2px_4px_rgba(15,23,42,0.04),0_18px_36px_-12px_rgba(15,23,42,0.20),0_36px_64px_-28px_rgba(15,23,42,0.18)]',
        'hover:-translate-y-1.5 hover:shadow-[inset_0_1px_0_#fff,0_2px_4px_rgba(15,23,42,0.04),0_24px_44px_-14px_rgba(15,23,42,0.24),0_44px_72px_-30px_rgba(15,23,42,0.20)]',
    ].join(' '),
};

export default function KpiCard({ label, value, subtitle, tone, icon: Icon, elevation = 'raised', visual, footer }: KpiCardProps) {
    const style = KPI_TONES[tone];
    return (
        <article
            aria-label={`${label}: ${value}`}
            className={cn(
                'flex min-w-0 flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/6 transition-all duration-300 ease-out',
                ELEVATION[elevation],
            )}
        >
            <div className="flex flex-1 flex-col px-4 pb-3 pt-3.5">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', style.dot, style.dotRing)} />
                        <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
                    </div>
                    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-slate-900/5', ICON_DEPTH, style.iconBox)}>
                        <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                </div>

                <div className="mt-2.5 flex flex-1 items-end justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[30px] font-semibold leading-none tracking-tight text-slate-950 tabular-nums [text-shadow:0_1px_1px_rgba(15,23,42,0.06)]">{value}</div>
                        <div className="mt-1.5 truncate text-[12.5px] font-medium text-slate-500">{subtitle}</div>
                    </div>
                    {visual ? <VisualSlot visual={visual} tone={tone} /> : null}
                </div>
            </div>

            <div className={cn('flex min-w-0 items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[12px]', FOOTER_DEPTH)}>
                <FooterLead lead={footer.lead} tone={tone} />
                {footer.trailing ? <FooterTrailing trailing={footer.trailing} /> : null}
            </div>
        </article>
    );
}

export function KpiCardSkeleton() {
    return (
        <div aria-hidden className={cn('flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/6', ELEVATION.raised)}>
            <div className="px-4 pb-3 pt-3.5">
                <div className="flex items-center justify-between">
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                    <div className="h-7 w-7 animate-pulse rounded-lg bg-slate-100" />
                </div>
                <div className="mt-2.5 flex items-end justify-between">
                    <div>
                        <div className="h-7 w-16 animate-pulse rounded-md bg-slate-200" />
                        <div className="mt-2 h-3 w-28 animate-pulse rounded bg-slate-100" />
                    </div>
                    <div className="h-11 w-11 animate-pulse rounded-full bg-slate-100" />
                </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 py-2">
                <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-14 animate-pulse rounded-full bg-slate-100" />
            </div>
        </div>
    );
}
