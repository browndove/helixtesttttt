import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { KPI_TONES, type KpiTone } from './kpiConfig';

export default function StatusPill({
    variant,
    children,
    className,
}: {
    variant: KpiTone;
    children: ReactNode;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset shadow-[0_1px_2px_rgba(15,23,42,0.06)]',
                KPI_TONES[variant].pill,
                className,
            )}
        >
            {children}
        </span>
    );
}
