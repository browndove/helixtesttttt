'use client';

import { useEffect, useRef } from 'react';
import { Ban, CheckCircle2, Pencil, Trash2, UserRound } from 'lucide-react';
import type { BedStatus } from '@/lib/beds';
import type { HierarchyBed } from '@/lib/bed-hierarchy';
import { BED_STATUS_META } from './bed-layout-ui';

/** Wording from the spec sheet: the API still calls the third state `blocked`. */
const STATUS_CHOICES: { status: BedStatus; title: string; hint: string; icon: typeof CheckCircle2 }[] = [
    { status: 'available', title: 'Available', hint: 'Empty bed', icon: CheckCircle2 },
    { status: 'occupied', title: 'Occupied', hint: 'In use', icon: UserRound },
    { status: 'blocked', title: 'Unavailable', hint: 'Out of service', icon: Ban },
];

function formatStamp(iso?: string): string {
    if (!iso) return '—';
    const when = new Date(iso);
    if (Number.isNaN(when.getTime())) return '—';
    return `${when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at ${when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

export default function BedTile({
    bed,
    canEdit,
    open,
    onToggle,
    onStatus,
    onEdit,
    onDelete,
}: {
    bed: HierarchyBed;
    canEdit: boolean;
    open: boolean;
    onToggle: () => void;
    onStatus: (status: BedStatus) => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const meta = BED_STATUS_META[bed.status];
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const close = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) onToggle();
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open, onToggle]);

    return (
        <div style={{ position: 'relative' }}>
            <button
                type="button"
                onClick={onToggle}
                style={{
                    width: '100%', textAlign: 'left', cursor: 'pointer',
                    border: `1px solid ${open ? '#172033' : meta.border}`,
                    background: meta.bg, borderRadius: 10, padding: '8px 9px 9px',
                    display: 'flex', flexDirection: 'column', gap: 4, minHeight: 78,
                }}
            >
                <span style={{ fontSize: 8.5, fontWeight: 750, letterSpacing: '0.09em', color: meta.fg, opacity: 0.75 }}>
                    {meta.label.toUpperCase()}
                </span>
                <span style={{ fontSize: 19, fontWeight: 750, color: '#101828', lineHeight: '24px' }}>
                    {bed.bed_number}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, color: meta.fg }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot }} />
                    {bed.bed_code || meta.label}
                </span>
            </button>

            {open && (
                <div
                    ref={panelRef}
                    style={{
                        position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 40, width: 236,
                        background: '#FFFFFF', border: '1px solid #E6EBF1', borderRadius: 12,
                        boxShadow: '0 16px 36px rgba(16, 24, 40, 0.16)', overflow: 'hidden',
                    }}
                >
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid #F1F4F8', textAlign: 'center' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#101828' }}>
                            Bed {bed.bed_number}
                        </span>
                        {bed.bed_code && (
                            <span style={{ fontSize: 11.5, color: '#98A2B3', marginLeft: 6 }}>{bed.bed_code}</span>
                        )}
                    </div>

                    <div style={{ padding: 6 }}>
                        {STATUS_CHOICES.map(choice => {
                            const active = bed.status === choice.status;
                            const colors = BED_STATUS_META[choice.status];
                            const Icon = choice.icon;
                            return (
                                <button
                                    key={choice.status}
                                    type="button"
                                    disabled={!canEdit || active}
                                    onClick={() => onStatus(choice.status)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                                        padding: '8px 8px', border: 'none', borderRadius: 8, textAlign: 'left',
                                        background: active ? '#F6F8FB' : 'transparent',
                                        cursor: !canEdit || active ? 'default' : 'pointer',
                                    }}
                                >
                                    <span style={{
                                        width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                                        background: colors.bg, color: colors.fg,
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <Icon size={13} strokeWidth={2} />
                                    </span>
                                    <span style={{ minWidth: 0, flex: 1 }}>
                                        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 650, color: '#172033' }}>{choice.title}</span>
                                        <span style={{ display: 'block', fontSize: 11, color: '#98A2B3' }}>{choice.hint}</span>
                                    </span>
                                    {active && (
                                        <span style={{
                                            width: 15, height: 15, borderRadius: '50%', background: '#172033', flexShrink: 0,
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <CheckCircle2 size={11} strokeWidth={2.4} color="#FFFFFF" />
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ padding: '9px 12px', borderTop: '1px solid #F1F4F8', background: '#FCFDFE' }}>
                        <div style={{ fontSize: 11, color: '#98A2B3' }}>Last updated</div>
                        <div style={{ fontSize: 11.5, color: '#475467', marginTop: 1 }}>{formatStamp(bed.updated_at)}</div>
                        {bed.updated_by?.name && (
                            <>
                                <div style={{ fontSize: 11, color: '#98A2B3', marginTop: 7 }}>Updated by</div>
                                <div style={{ fontSize: 11.5, color: '#475467', marginTop: 1 }}>{bed.updated_by.name}</div>
                            </>
                        )}
                    </div>

                    {canEdit && (
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '9px 12px', borderTop: '1px solid #F1F4F8',
                        }}>
                            <button
                                type="button"
                                onClick={onDelete}
                                style={{
                                    border: 'none', background: 'none', padding: 0, cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                    fontSize: 12, fontWeight: 650, color: '#DC2626',
                                }}
                            >
                                <Trash2 size={12.5} strokeWidth={2} /> Delete
                            </button>
                            <button
                                type="button"
                                onClick={onEdit}
                                style={{
                                    border: 'none', background: 'none', padding: 0, cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                    fontSize: 12, fontWeight: 650, color: '#1D6FB8',
                                }}
                            >
                                <Pencil size={12.5} strokeWidth={2} /> Edit bed info
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
