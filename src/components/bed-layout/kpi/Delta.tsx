import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Change in percentage points; the arrow and sign carry the direction, not just the colour. */
export default function Delta({ value, suffix }: { value: number; suffix?: string }) {
    const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
    const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    const amount = `${sign}${Math.abs(value).toFixed(1)}%`;
    const spoken = direction === 'flat'
        ? `No change${suffix ? ` ${suffix}` : ''}`
        : `${direction === 'up' ? 'Up' : 'Down'} ${Math.abs(value).toFixed(1)}%${suffix ? ` ${suffix}` : ''}`;

    return (
        <span
            aria-label={spoken}
            className={cn(
                'inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-[12px] font-semibold tabular-nums',
                direction === 'up' && 'text-emerald-700',
                direction === 'down' && 'text-red-700',
                direction === 'flat' && 'text-slate-500',
            )}
        >
            <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
            {amount}
            {suffix ? <span className="ml-1 font-medium text-slate-500">{suffix}</span> : null}
        </span>
    );
}
