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
    const [yearPickerOpen, setYearPickerOpen] = useState(false);
    const [yearQuery, setYearQuery] = useState('');
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
    const yearRange = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const startYear = 1950;
        const years: number[] = [];
        for (let y = currentYear; y >= startYear; y -= 1) years.push(y);
        return years;
    }, []);
    const filteredYears = useMemo(() => {
        const q = yearQuery.trim();
        if (!q) return yearRange;
        return yearRange.filter(y => String(y).includes(q));
    }, [yearQuery, yearRange]);
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
                        <button
                            type="button"
                            onClick={() => {
                                setYearPickerOpen(v => !v);
                                setYearQuery('');
                            }}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                padding: '6px 8px',
                                borderRadius: 8,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            {viewDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                            <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--text-muted)' }}>
                                {yearPickerOpen ? 'expand_less' : 'expand_more'}
                            </span>
                        </button>
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => setViewDate(new Date(year, month + 1, 1))}>
                            <span className="material-icons-round" style={{ fontSize: 15 }}>chevron_right</span>
                        </button>
                    </div>

                    {yearPickerOpen && (
                        <div style={{ padding: '6px 4px 10px' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                                Select year
                            </div>
                            <input
                                type="text"
                                value={yearQuery}
                                onChange={(e) => setYearQuery(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                placeholder="Search year..."
                                style={{
                                    width: '100%',
                                    height: 30,
                                    marginBottom: 8,
                                    padding: '0 8px',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 8,
                                    fontSize: 12,
                                    color: 'var(--text-primary)',
                                    background: 'var(--surface-card)',
                                    outline: 'none',
                                }}
                            />
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, maxHeight: 160, overflowY: 'auto', paddingRight: 2 }}>
                                {filteredYears.map((y) => {
                                    const active = y === year;
                                    return (
                                        <button
                                            key={y}
                                            type="button"
                                            onClick={() => {
                                                setViewDate(new Date(y, month, 1));
                                                setYearPickerOpen(false);
                                            }}
                                            style={{
                                                height: 30,
                                                borderRadius: 8,
                                                border: active ? '1px solid var(--helix-primary)' : '1px solid var(--border-subtle)',
                                                background: active ? 'rgba(99,102,241,0.10)' : 'var(--surface-2)',
                                                color: active ? 'var(--helix-primary)' : 'var(--text-primary)',
                                                fontSize: 12,
                                                fontWeight: active ? 800 : 600,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {y}
                                        </button>
                                    );
                                })}
                                {filteredYears.length === 0 && (
                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
                                        No years found
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

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
