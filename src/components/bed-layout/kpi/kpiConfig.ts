import { BedDouble, Building2, CheckCircle, Lock, Users, type LucideIcon } from 'lucide-react';

export type KpiTone = 'neutral' | 'green' | 'blue' | 'orange' | 'red';

type ToneStyle = {
    dot: string;
    /** Soft halo around the status dot. */
    dotRing: string;
    iconBox: string;
    pill: string;
    text: string;
    /** Raw colours for SVG strokes. */
    stroke: string;
    track: string;
};

export const KPI_TONES: Record<KpiTone, ToneStyle> = {
    neutral: {
        dot: 'bg-slate-400',
        dotRing: 'ring-[3px] ring-slate-400/15',
        iconBox: 'bg-slate-100 text-slate-600',
        pill: 'bg-slate-100 text-slate-700 ring-slate-200',
        text: 'text-slate-700',
        stroke: '#64748B',
        track: '#E2E8F0',
    },
    green: {
        dot: 'bg-emerald-500',
        dotRing: 'ring-[3px] ring-emerald-500/15',
        iconBox: 'bg-emerald-50 text-emerald-700',
        pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        text: 'text-emerald-700',
        stroke: '#059669',
        track: '#D1FAE5',
    },
    blue: {
        dot: 'bg-blue-500',
        dotRing: 'ring-[3px] ring-blue-500/15',
        iconBox: 'bg-blue-50 text-blue-700',
        pill: 'bg-blue-50 text-blue-700 ring-blue-200',
        text: 'text-blue-700',
        stroke: '#2563EB',
        track: '#DBEAFE',
    },
    orange: {
        dot: 'bg-orange-500',
        dotRing: 'ring-[3px] ring-orange-500/15',
        iconBox: 'bg-orange-50 text-orange-700',
        pill: 'bg-orange-50 text-orange-800 ring-orange-200',
        text: 'text-orange-700',
        stroke: '#EA580C',
        track: '#FFEDD5',
    },
    red: {
        dot: 'bg-red-500',
        dotRing: 'ring-[3px] ring-red-500/15',
        iconBox: 'bg-red-50 text-red-700',
        pill: 'bg-red-50 text-red-700 ring-red-200',
        text: 'text-red-700',
        stroke: '#DC2626',
        track: '#FEE2E2',
    },
};

export type KpiVisual =
    | { type: 'ring'; value: number; label: string }
    | { type: 'sparkline'; points: number[]; label: string }
    | { type: 'blocks'; blocks: KpiTone[]; caption: string; label: string }
    | { type: 'pill'; text: string; variant: KpiTone };

export type KpiFooterLead =
    | { type: 'text'; text: string; icon?: LucideIcon }
    | { type: 'pill'; text: string; variant: KpiTone };

export type KpiFooterTrailing =
    | { type: 'text'; text: string }
    | { type: 'pill'; text: string; variant: KpiTone }
    | { type: 'delta'; value: number; suffix: string };

export interface KpiCardProps {
    id: string;
    label: string;
    value: string;
    subtitle: string;
    tone: KpiTone;
    icon: LucideIcon;
    /** Floating cards sit higher than the rest of the row, for the numbers people act on first. */
    elevation?: 'raised' | 'floating';
    visual?: KpiVisual;
    footer: { lead: KpiFooterLead; trailing?: KpiFooterTrailing };
}

/** Everything the bed KPI row can show. Optional fields hide their part of a card when absent. */
export type BedKpiInput = {
    total: number;
    available: number;
    occupied: number;
    blocked: number;
    buildings: number;
    units: number;
    /** Share of beds in service; defaults to beds not out of service. */
    activeShare?: number;
    pendingDischarges?: number;
    cleaning?: number;
    bioMed?: number;
};

const plural = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString()} ${count === 1 ? one : many}`;

function percentOf(part: number, total: number): number {
    return total > 0 ? (part / total) * 100 : 0;
}

export function buildBedKpiItems(input: BedKpiInput): KpiCardProps[] {
    const { total, available, occupied, blocked } = input;
    const occupancy = percentOf(occupied, total);
    const activeShare = Math.round(input.activeShare ?? percentOf(total - blocked, total));
    const load = percentOf(blocked, total);
    const hasBreakdown = input.cleaning !== undefined || input.bioMed !== undefined;
    const other = Math.max(0, blocked - (input.cleaning ?? 0) - (input.bioMed ?? 0));
    const blocks: KpiTone[] = hasBreakdown
        ? [
            ...Array<KpiTone>(Math.min(input.cleaning ?? 0, 4)).fill('orange'),
            ...Array<KpiTone>(Math.min(input.bioMed ?? 0, 4)).fill('neutral'),
            ...Array<KpiTone>(Math.min(other, 4)).fill('blue'),
        ]
        : Array<KpiTone>(Math.min(blocked, 6)).fill('orange');

    return [
        {
            id: 'capacity',
            label: 'Total capacity',
            value: total.toLocaleString(),
            subtitle: 'Licensed Clinical Units',
            tone: 'neutral',
            icon: BedDouble,
            visual: { type: 'pill', text: `${activeShare}% Active`, variant: 'neutral' },
            footer: {
                lead: { type: 'text', text: plural(input.buildings, 'building'), icon: Building2 },
                trailing: { type: 'text', text: plural(input.units, 'active ward') },
            },
        },
        {
            id: 'available',
            label: 'Available',
            value: available.toLocaleString(),
            subtitle: 'Ready for triage',
            tone: 'green',
            icon: CheckCircle,
            elevation: 'floating',
            visual: {
                type: 'ring',
                value: percentOf(available, total),
                label: `${Math.round(percentOf(available, total))}% of beds available`,
            },
            footer: {
                lead: { type: 'text', text: 'Immediate admit' },
                trailing: { type: 'text', text: `${available.toLocaleString()} ready` },
            },
        },
        {
            id: 'occupied',
            label: 'Occupied',
            value: occupied.toLocaleString(),
            subtitle: 'Admitted In-Patients',
            tone: 'blue',
            icon: Users,
            visual: {
                type: 'ring',
                value: occupancy,
                label: `${Math.round(occupancy)}% of beds occupied`,
            },
            footer: {
                lead: { type: 'text', text: 'Active census' },
                trailing: input.pendingDischarges !== undefined
                    ? { type: 'pill', text: `${input.pendingDischarges.toLocaleString()} pending d/c`, variant: 'blue' }
                    : { type: 'text', text: `of ${total.toLocaleString()}` },
            },
        },
        {
            id: 'out-of-service',
            label: 'Out of service',
            value: blocked.toLocaleString(),
            subtitle: 'Turnover & Maintenance',
            tone: 'orange',
            icon: Lock,
            visual: {
                type: 'blocks',
                blocks,
                caption: `${load.toFixed(1)}% load`,
                label: hasBreakdown
                    ? `${input.cleaning ?? 0} cleaning, ${input.bioMed ?? 0} bio-med, ${other} other; ${load.toFixed(1)}% of beds out of service`
                    : `${load.toFixed(1)}% of beds out of service`,
            },
            footer: hasBreakdown
                ? {
                    lead: { type: 'text', text: `${(input.cleaning ?? 0).toLocaleString()} cleaning` },
                    trailing: { type: 'pill', text: `${(input.bioMed ?? 0).toLocaleString()} bio-med`, variant: 'neutral' },
                }
                : {
                    lead: { type: 'text', text: 'Not assignable' },
                    trailing: { type: 'text', text: `of ${total.toLocaleString()}` },
                },
        },
    ];
}
