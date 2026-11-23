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
    /** Soft radial glow in the card corner. */
    glow: string;
    /** Gradient behind the white header icon. */
    chip: string;
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
        glow: 'rgba(120, 165, 225, 0.42)',
        chip: 'linear-gradient(145deg, #3a5480, #1b2a44)',
    },
    green: {
        dot: 'bg-emerald-500',
        dotRing: 'ring-[3px] ring-emerald-500/15',
        iconBox: 'bg-emerald-50 text-emerald-700',
        pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        text: 'text-emerald-700',
        stroke: '#059669',
        track: '#D1FAE5',
        glow: 'rgba(120, 215, 180, 0.45)',
        chip: 'linear-gradient(145deg, #4fbf98, #2a9a74)',
    },
    blue: {
        dot: 'bg-blue-500',
        dotRing: 'ring-[3px] ring-blue-500/15',
        iconBox: 'bg-blue-50 text-blue-700',
        pill: 'bg-blue-50 text-blue-700 ring-blue-200',
        text: 'text-blue-700',
        stroke: '#2563EB',
        track: '#DBEAFE',
        glow: 'rgba(110, 165, 235, 0.45)',
        chip: 'linear-gradient(145deg, #5a92d6, #2f6fb8)',
    },
    orange: {
        dot: 'bg-orange-500',
        dotRing: 'ring-[3px] ring-orange-500/15',
        iconBox: 'bg-orange-50 text-orange-700',
        pill: 'bg-orange-50 text-orange-800 ring-orange-200',
        text: 'text-orange-700',
        stroke: '#EA580C',
        track: '#FFEDD5',
        glow: 'rgba(240, 200, 120, 0.5)',
        chip: 'linear-gradient(145deg, #f0a24a, #d9771f)',
    },
    red: {
        dot: 'bg-red-500',
        dotRing: 'ring-[3px] ring-red-500/15',
        iconBox: 'bg-red-50 text-red-700',
        pill: 'bg-red-50 text-red-700 ring-red-200',
        text: 'text-red-700',
        stroke: '#DC2626',
        track: '#FEE2E2',
        glow: 'rgba(240, 140, 150, 0.45)',
        chip: 'linear-gradient(145deg, #e0707a, #c2414b)',
    },
};

export type KpiVisual =
    | { type: 'ring'; value: number; label: string }
    | { type: 'sparkline'; points: number[]; label: string }
    | { type: 'blocks'; blocks: KpiTone[]; caption: string; label: string }
    | { type: 'pill'; text: string; variant: KpiTone }
    /** Bed-shaped waffle: each cell is a share of beds, coloured by status. */
    | { type: 'waffle'; available: number; occupied: number; blocked: number; caption: string; label: string };

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
    /** Material Icons Round name for the faint rotated watermark. */
    mark: string;
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
            subtitle: 'Beds across all units',
            tone: 'neutral',
            icon: BedDouble,
            mark: 'king_bed',
            visual: {
                type: 'waffle',
                available,
                occupied,
                blocked,
                caption: `${activeShare}% active`,
                label: `${available} available, ${occupied} occupied, ${blocked} out of service; ${activeShare}% of beds active`,
            },
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
            mark: 'check_circle',
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
            mark: 'hotel',
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
            mark: 'build_circle',
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
