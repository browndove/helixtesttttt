import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import KpiCard, { KpiCardSkeleton } from './KpiCard';
import type { KpiCardProps } from './kpiConfig';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export default function KpiRow({
    items = [],
    loading = false,
    className,
}: {
    items?: KpiCardProps[];
    loading?: boolean;
    className?: string;
}) {
    return (
        <section
            aria-label="Bed capacity"
            aria-busy={loading || undefined}
            className={cn(inter.className, 'grid grid-cols-1 gap-4 pt-1 md:grid-cols-2 xl:grid-cols-4', className)}
        >
            {loading
                ? Array.from({ length: 4 }, (_, index) => <KpiCardSkeleton key={index} />)
                : items.map(item => <KpiCard key={item.id} {...item} />)}
        </section>
    );
}
