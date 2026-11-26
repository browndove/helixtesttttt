'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

type CalendarRangePickerProps = {
    from: string;
    to: string;
    onChange: (from: string, to: string) => void;
    /** Full-width trigger (e.g. modals). Default keeps compact inline layout. */
    layout?: "inline" | "block";
    /** Prominent labeled from/to pill for modals (requires `layout="block"`). */
    presentation?: "standard" | "modalPill";
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

/** YYYY-MM-DD for a UTC civil date (monthIndex 0–11). Matches usage-metrics `from`/`to` URL state. */
function formatDateUTCParts(y: number, monthIndex: number, day: number): string {
    return `${y}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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

function formatPillDate(d: Date) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CalendarRangePicker({
    from,
    to,
    onChange,
    layout = "inline",
    presentation = "standard",
}: CalendarRangePickerProps) {
    const today = new Date();
    const [open, setOpen] = useState(false);
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [hoverDate, setHoverDate] = useState<Date | null>(null);
    const [picking, setPicking] = useState<'from' | 'to'>('from');
    const [popPos, setPopPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
    const ref = useRef<HTMLDivElement>(null);
    const popRef = useRef<HTMLDivElement>(null);

    const fromDate = parseDate(from);
    const toDate = parseDate(to);

    // Position the portal popover relative to the trigger button
    useEffect(() => {
        if (!open || !ref.current) return;
        const updatePos = () => {
            const rect = ref.current?.getBoundingClientRect();
            if (!rect) return;
            setPopPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
        };
        updatePos();
        window.addEventListener('scroll', updatePos, true);
        window.addEventListener('resize', updatePos);
        return () => {
            window.removeEventListener('scroll', updatePos, true);
            window.removeEventListener('resize', updatePos);
        };
    }, [open]);

    // Outside-click closes popover
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current?.contains(e.target as Node)) return;
            if (popRef.current?.contains(e.target as Node)) return;
            setOpen(false);
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

    const isBlock = layout === "block";
    const isModalPill = presentation === "modalPill" && isBlock;

    return (
        <div
            ref={ref}
            className={
                isModalPill
                    ? `flex w-full items-center rounded-full border bg-slate-50 py-1.5 pl-5 pr-1.5 ${open ? "border-indigo-300 ring-2 ring-indigo-500/20" : "border-slate-200"}`
                    : undefined
            }
            style={
                isModalPill
                    ? { position: "relative" }
                    : {
                          position: "relative",
                          display: isBlock ? "flex" : "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          width: isBlock ? "100%" : undefined,
                      }
            }
        >
            <button
                type="button"
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-label="Choose report date range"
                onClick={() => { setOpen(!open); if (!open && fromDate) { setViewYear(fromDate.getFullYear()); setViewMonth(fromDate.getMonth()); } }}
                className={
                    isModalPill
                        ? "flex min-w-0 flex-1 items-center gap-5 bg-transparent py-2 pr-3 text-left focus-visible:outline-none"
                        : undefined
                }
                style={
                    isModalPill
                        ? undefined
                        : {
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: isBlock ? "12px 16px" : "6px 12px",
                              borderRadius: 12,
                              background: "var(--surface-card)",
                              border: "1px solid var(--border-default)",
                              fontSize: isBlock ? 13 : 12,
                              fontWeight: 500,
                              color: fromDate ? "var(--text-primary)" : "var(--text-muted)",
                              cursor: "pointer",
                              transition: "all 0.15s",
                              boxShadow: open ? "0 0 0 2px rgba(30,58,95,0.12)" : "none",
                              flex: isBlock ? 1 : undefined,
                              minWidth: isBlock ? 0 : undefined,
                              justifyContent: isBlock ? "space-between" : undefined,
                              boxSizing: "border-box",
                          }
                }
            >
                {isModalPill ? (
                    <>
                        <span className="material-icons-round shrink-0 text-[20px] text-slate-400">calendar_today</span>
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-6">
                            <div className="min-w-0">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">From</div>
                                <div className="truncate text-[15px] font-semibold leading-5 text-slate-900">
                                    {fromDate ? formatPillDate(fromDate) : "—"}
                                </div>
                            </div>
                            <div className="h-px w-10 shrink-0 bg-slate-300" aria-hidden />
                            <div className="min-w-0 text-right">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">To</div>
                                <div className="flex items-center justify-end gap-2">
                                    <span className="truncate text-[15px] font-semibold leading-5 text-slate-900">
                                        {toDate ? formatPillDate(toDate) : "—"}
                                    </span>
                                    <span className="material-icons-round text-[18px] text-indigo-500">edit_calendar</span>
                                </div>
                            </div>
                        </div>
                    </>
                ) : isBlock ? (
                    <>
                        <span className="material-icons-round" style={{ fontSize: 18, color: "var(--text-muted)" }}>event</span>
                        <span style={{ flex: 1, textAlign: "left" }}>{displayLabel()}</span>
                        <span className="material-icons-round" style={{ fontSize: 20, color: "var(--text-muted)" }}>calendar_month</span>
                    </>
                ) : (
                    <>
                        <span className="material-icons-round" style={{ fontSize: 14, color: "var(--text-muted)" }}>date_range</span>
                        {displayLabel()}
                    </>
                )}
            </button>

            {(from || to) && (
                <button
                    type="button"
                    onClick={() => { onChange('', ''); setPicking('from'); }}
                    className={
                        isModalPill
                            ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
                    }
                    style={
                        isModalPill
                            ? undefined
                            : {
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: 22,
                                  height: 22,
                                  borderRadius: "50%",
                                  background: "var(--surface-2)",
                                  border: "1px solid var(--border-subtle)",
                                  cursor: "pointer",
                                  padding: 0,
                                  color: "var(--text-muted)",
                              }
                    }
                    title="Clear dates"
                    aria-label="Clear date range"
                >
                    <span className="material-icons-round" style={{ fontSize: isModalPill ? 16 : 12 }}>close</span>
                </button>
            )}

            {open && typeof document !== 'undefined' && createPortal(
                <div ref={popRef} style={{
                    position: 'fixed', top: popPos.top, right: popPos.right, zIndex: 1000,
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

                    {/* Quick actions — set inclusive from/to (UTC civil dates) for dashboard + API */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                        {[
                            {
                                label: 'Today',
                                fn: () => {
                                    const n = new Date();
                                    const y = n.getUTCFullYear();
                                    const m = n.getUTCMonth();
                                    const d = n.getUTCDate();
                                    const ymd = formatDateUTCParts(y, m, d);
                                    onChange(ymd, ymd);
                                },
                            },
                            {
                                label: 'Last 7 days',
                                fn: () => {
                                    const n = new Date();
                                    const ey = n.getUTCFullYear();
                                    const em = n.getUTCMonth();
                                    const ed = n.getUTCDate();
                                    const start = new Date(Date.UTC(ey, em, ed - 7));
                                    onChange(
                                        formatDateUTCParts(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
                                        formatDateUTCParts(ey, em, ed),
                                    );
                                },
                            },
                            {
                                label: 'Last 30 days',
                                fn: () => {
                                    const n = new Date();
                                    const ey = n.getUTCFullYear();
                                    const em = n.getUTCMonth();
                                    const ed = n.getUTCDate();
                                    const start = new Date(Date.UTC(ey, em, ed - 30));
                                    onChange(
                                        formatDateUTCParts(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
                                        formatDateUTCParts(ey, em, ed),
                                    );
                                },
                            },
                        ].map((q) => (
                            <button
                                key={q.label}
                                type="button"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    q.fn();
                                    setOpen(false);
                                    setPicking('from');
                                }}
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
                </div>,
                document.body
            )}
        </div>
    );
}
