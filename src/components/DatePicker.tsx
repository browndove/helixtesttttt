'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type DatePickerProps = {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    style?: React.CSSProperties;
};

function toDateInputValue(date: Date): string {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseIsoDate(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatDisplayDate(value: string): string {
    const dt = parseIsoDate(value);
    if (!dt) return '';
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DatePicker({
    value,
    onChange,
    placeholder = 'Select date',
    disabled = false,
    style,
}: DatePickerProps) {
    const selectedDate = useMemo(() => parseIsoDate(value), [value]);
    const [open, setOpen] = useState(false);
    const [viewDate, setViewDate] = useState<Date>(() => selectedDate || new Date());
    const wrapRef = useRef<HTMLDivElement>(null);
    const popRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const POP_W = 296;

    useEffect(() => {
        if (!selectedDate) return;
        setViewDate(selectedDate);
    }, [selectedDate]);

    useEffect(() => {
        if (!open) return;
        const updatePos = () => {
            const rect = wrapRef.current?.getBoundingClientRect();
            if (!rect) return;
            const viewportPad = 8;
            const left = Math.max(viewportPad, Math.min(rect.left, window.innerWidth - POP_W - viewportPad));
            setPos({ top: rect.bottom + 4, left });
        };
        updatePos();
        const onDocClick = (e: MouseEvent) => {
            if (wrapRef.current?.contains(e.target as Node)) return;
            if (popRef.current?.contains(e.target as Node)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        window.addEventListener('resize', updatePos);
        window.addEventListener('scroll', updatePos, true);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            window.removeEventListener('resize', updatePos);
            window.removeEventListener('scroll', updatePos, true);
        };
    }, [open]);

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = firstOfMonth.getDay(); // 0-6
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells: Array<{ date: Date; inMonth: boolean }> = [];
    for (let i = startWeekday - 1; i >= 0; i -= 1) {
        cells.push({ date: new Date(year, month - 1, prevMonthDays - i), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
        cells.push({ date: new Date(year, month, d), inMonth: true });
    }
    while (cells.length < 42) {
        const nextDay = cells.length - (startWeekday + daysInMonth) + 1;
        cells.push({ date: new Date(year, month + 1, nextDay), inMonth: false });
    }

    const selectedKey = selectedDate ? toDateInputValue(selectedDate) : '';
    const todayKey = toDateInputValue(new Date());

    return (
        <div ref={wrapRef} style={{ position: 'relative', ...style }}>
            <button
                type="button"
                onClick={() => { if (!disabled) setOpen(v => !v); }}
                disabled={disabled}
                style={{
                    width: '100%',
                    height: 36,
                    padding: '0 10px',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    background: disabled ? 'var(--surface-2)' : 'var(--surface-card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    color: value ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontSize: 13,
                }}
            >
                <span>{formatDisplayDate(value) || placeholder}</span>
                <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--text-muted)' }}>calendar_month</span>
            </button>

            {open && typeof document !== 'undefined' && createPortal(
                <div
                    ref={popRef}
                    style={{
                        position: 'fixed',
                        top: pos.top,
                        left: pos.left,
                        zIndex: 1200,
                        width: POP_W,
                        background: 'var(--surface-card)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.18)',
                        padding: 10,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => setViewDate(new Date(year, month - 1, 1))}>
                            <span className="material-icons-round" style={{ fontSize: 15 }}>chevron_left</span>
                        </button>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {viewDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                        </div>
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => setViewDate(new Date(year, month + 1, 1))}>
                            <span className="material-icons-round" style={{ fontSize: 15 }}>chevron_right</span>
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                            <div key={d} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center', padding: '4px 0' }}>{d}</div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                        {cells.map(({ date, inMonth }) => {
                            const key = toDateInputValue(date);
                            const isSelected = key === selectedKey;
                            const isToday = key === todayKey;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => { onChange(key); setOpen(false); }}
                                    style={{
                                        height: 30,
                                        borderRadius: 7,
                                        border: isSelected ? '1px solid var(--helix-primary)' : '1px solid transparent',
                                        background: isSelected ? 'rgba(99,102,241,0.12)' : 'transparent',
                                        color: !inMonth ? 'var(--text-disabled)' : isSelected ? 'var(--helix-primary)' : 'var(--text-primary)',
                                        fontSize: 12,
                                        fontWeight: isSelected ? 700 : isToday ? 600 : 500,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {date.getDate()}
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => onChange('')}>
                            Clear
                        </button>
                        <button type="button" className="btn btn-secondary btn-xs" onClick={() => { onChange(toDateInputValue(new Date())); setOpen(false); }}>
                            Today
                        </button>
                    </div>
                </div>
                ,
                document.body
            )}
        </div>
    );
}
