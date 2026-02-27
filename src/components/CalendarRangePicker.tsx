'use client';

import { useState, useRef, useEffect } from 'react';

type CalendarRangePickerProps = {
    from: string;
    to: string;
    onChange: (from: string, to: string) => void;
};

function daysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function parseDate(s: string): Date | null {
    if (!s) return null;
    const d = new Date(s + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
}

function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function CalendarRangePicker({ from, to, onChange }: CalendarRangePickerProps) {
    const today = new Date();
    const [open, setOpen] = useState(false);
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [hoverDate, setHoverDate] = useState<Date | null>(null);
    const [picking, setPicking] = useState<'from' | 'to'>('from');
    const ref = useRef<HTMLDivElement>(null);

    const fromDate = parseDate(from);
    const toDate = parseDate(to);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleDayClick = (d: Date) => {
        const ds = formatDate(d);
        if (picking === 'from') {
            if (toDate && d > toDate) {
                onChange(ds, '');
            } else {
                onChange(ds, to);
            }
            setPicking('to');
        } else {
            if (fromDate && d < fromDate) {
                onChange(ds, to);
                setPicking('to');
            } else {
                onChange(from, ds);
                setPicking('from');
                setOpen(false);
            }
        }
    };

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };

    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    const totalDays = daysInMonth(viewYear, viewMonth);
    const firstDow = new Date(viewYear, viewMonth, 1).getDay();

    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(new Date(viewYear, viewMonth, d));

    const isInRange = (d: Date) => {
        const f = fromDate;
        const t = toDate || (picking === 'to' && hoverDate ? hoverDate : null);
        if (!f || !t) return false;
        const start = f < t ? f : t;
        const end = f < t ? t : f;
        return d > start && d < end;
    };

    const isStart = (d: Date) => fromDate ? isSameDay(d, fromDate) : false;
    const isEnd = (d: Date) => {
        if (toDate) return isSameDay(d, toDate);
        if (picking === 'to' && hoverDate) return isSameDay(d, hoverDate);
        return false;
    };

    const displayLabel = () => {
        if (fromDate && toDate) {
            return `${fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${toDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
        if (fromDate) {
            return `${fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — ...`;
        }
        return 'Select date range';
    };

    return (
        <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <button
                onClick={() => { setOpen(!open); if (!open && fromDate) { setViewYear(fromDate.getFullYear()); setViewMonth(fromDate.getMonth()); } }}
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-card)', border: '1px solid var(--border-default)',
                    fontSize: 12, fontWeight: 500, color: fromDate ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.15s',
                    boxShadow: open ? '0 0 0 2px rgba(59,130,246,0.15)' : 'none',
                }}
            >
                <span className="material-icons-round" style={{ fontSize: 14, color: 'var(--text-muted)' }}>date_range</span>
                {displayLabel()}
            </button>

            {(from || to) && (
                <button
                    onClick={() => { onChange('', ''); setPicking('from'); }}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
                        cursor: 'pointer', padding: 0, color: 'var(--text-muted)',
                    }}
                    title="Clear dates"
                >
                    <span className="material-icons-round" style={{ fontSize: 12 }}>close</span>
                </button>
            )}

            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100,
                    background: 'var(--surface-card)', border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    padding: 14, width: 280, userSelect: 'none',
                }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, borderRadius: 4, color: 'var(--text-secondary)', display: 'flex' }}>
                            <span className="material-icons-round" style={{ fontSize: 18 }}>chevron_left</span>
                        </button>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {MONTHS[viewMonth]} {viewYear}
                        </div>
                        <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, borderRadius: 4, color: 'var(--text-secondary)', display: 'flex' }}>
                            <span className="material-icons-round" style={{ fontSize: 18 }}>chevron_right</span>
                        </button>
                    </div>

                    {/* Picking indicator */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                        <div
                            onClick={() => setPicking('from')}
                            style={{
                                flex: 1, padding: '5px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                border: picking === 'from' ? '1px solid var(--helix-primary)' : '1px solid var(--border-subtle)',
                                background: picking === 'from' ? 'rgba(59,130,246,0.05)' : 'var(--surface-2)',
                            }}
                        >
                            <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>From</div>
                            <div style={{ fontSize: 11.5, fontWeight: 600, color: fromDate ? 'var(--text-primary)' : 'var(--text-disabled)', marginTop: 1 }}>
                                {fromDate ? fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                            </div>
                        </div>
                        <div
                            onClick={() => setPicking('to')}
                            style={{
                                flex: 1, padding: '5px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                border: picking === 'to' ? '1px solid var(--helix-primary)' : '1px solid var(--border-subtle)',
                                background: picking === 'to' ? 'rgba(59,130,246,0.05)' : 'var(--surface-2)',
                            }}
                        >
                            <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>To</div>
                            <div style={{ fontSize: 11.5, fontWeight: 600, color: toDate ? 'var(--text-primary)' : 'var(--text-disabled)', marginTop: 1 }}>
                                {toDate ? toDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                            </div>
                        </div>
                    </div>

                    {/* Day headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, marginBottom: 2 }}>
                        {DAYS.map(d => (
                            <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-disabled)', padding: '4px 0' }}>{d}</div>
                        ))}
                    </div>

                    {/* Day grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0 }}>
                        {cells.map((day, i) => {
                            if (!day) return <div key={`e-${i}`} />;

                            const start = isStart(day);
                            const end = isEnd(day);
                            const inRange = isInRange(day);
                            const isToday = isSameDay(day, today);
                            const selected = start || end;

                            return (
                                <div
                                    key={day.toISOString()}
                                    onClick={() => handleDayClick(day)}
                                    onMouseEnter={() => setHoverDate(day)}
                                    onMouseLeave={() => setHoverDate(null)}
                                    style={{
                                        textAlign: 'center', padding: '5px 0', cursor: 'pointer',
                                        position: 'relative',
                                        background: inRange ? 'rgba(59,130,246,0.08)' : 'transparent',
                                        borderRadius: start ? '8px 0 0 8px' : end ? '0 8px 8px 0' : 0,
                                    }}
                                >
                                    <div style={{
                                        width: 28, height: 28, lineHeight: '28px', margin: '0 auto',
                                        borderRadius: '50%', fontSize: 11.5, fontWeight: selected ? 700 : isToday ? 600 : 500,
                                        background: selected ? 'var(--helix-primary)' : 'transparent',
                                        color: selected ? '#fff' : isToday ? 'var(--helix-primary)' : 'var(--text-primary)',
                                        border: isToday && !selected ? '1px solid var(--helix-primary)' : '1px solid transparent',
                                        transition: 'all 0.1s',
                                    }}>
                                        {day.getDate()}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Quick actions */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                        {[
                            { label: 'Today', fn: () => { const t = formatDate(today); onChange(t, t); setOpen(false); setPicking('from'); } },
                            { label: 'Last 7 days', fn: () => { const e = formatDate(today); const s = new Date(); s.setDate(s.getDate() - 7); onChange(formatDate(s), e); setOpen(false); setPicking('from'); } },
                            { label: 'Last 30 days', fn: () => { const e = formatDate(today); const s = new Date(); s.setMonth(s.getMonth() - 1); onChange(formatDate(s), e); setOpen(false); setPicking('from'); } },
                        ].map(q => (
                            <button
                                key={q.label}
                                onClick={q.fn}
                                style={{
                                    flex: 1, padding: '5px 0', fontSize: 10.5, fontWeight: 600,
                                    borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
                                    background: 'var(--surface-2)', color: 'var(--text-secondary)',
                                    cursor: 'pointer', transition: 'all 0.12s',
                                }}
                            >
                                {q.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
