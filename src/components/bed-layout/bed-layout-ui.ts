import type { CSSProperties } from 'react';
import type { BedStatus } from '@/lib/beds';

export const BED_STATUS_META: Record<BedStatus, { bg: string; fg: string; dot: string; border: string; label: string }> = {
    available: { bg: '#E7F8EF', fg: '#17803D', dot: '#22A35A', border: '#B7E4C7', label: 'Available' },
    occupied: { bg: '#E7F0FE', fg: '#1D4ED8', dot: '#3B82F6', border: '#BFDBFE', label: 'Occupied' },
    blocked: { bg: '#F3F4F6', fg: '#4B5563', dot: '#6B7280', border: '#E5E7EB', label: 'Blocked' },
};

export const card: CSSProperties = {
    background: 'var(--glass-bg-strong)',
    border: '1px solid var(--glass-border)',
    boxShadow: 'var(--glass-shadow)',
    borderRadius: 22,
};

export const fieldLabel: CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#7B8798',
    marginBottom: 6,
};

export const input: CSSProperties = {
    width: '100%',
    height: 38,
    padding: '0 11px',
    border: '1px solid rgba(27, 42, 68, 0.1)',
    borderRadius: 11,
    fontSize: 13,
    color: '#172033',
    background: 'rgba(255, 255, 255, 0.9)',
    outline: 'none',
};

export const select: CSSProperties = {
    ...input,
    appearance: 'none',
    backgroundImage: 'none',
    cursor: 'pointer',
};

export const primaryButton: CSSProperties = {
    height: 38,
    padding: '0 16px',
    border: 'none',
    borderRadius: 12,
    background: 'linear-gradient(145deg, #2c4266, #1b2a44)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 8px 18px -8px rgba(27, 42, 68, 0.55)',
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 650,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
};

export const secondaryButton: CSSProperties = {
    ...primaryButton,
    background: 'rgba(255, 255, 255, 0.9)',
    boxShadow: '0 1px 2px rgba(27, 42, 68, 0.06)',
    color: '#344054',
    border: '1px solid rgba(27, 42, 68, 0.1)',
};

export const linkButton: CSSProperties = {
    border: 'none',
    background: 'none',
    padding: 0,
    fontSize: 12,
    fontWeight: 650,
    color: '#2f6fb8',
    cursor: 'pointer',
};

export const dangerLinkButton: CSSProperties = {
    ...linkButton,
    color: '#DC2626',
};

export function countPill(color: string): CSSProperties {
    return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 12,
        fontWeight: 650,
        color,
        whiteSpace: 'nowrap',
    };
}

export function formatDate(iso?: string): string {
    if (!iso) return '—';
    const when = new Date(iso);
    if (Number.isNaN(when.getTime())) return '—';
    return when.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
}
