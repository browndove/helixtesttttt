'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import navSections from '@/components/navSections';
import { deptIcon } from '@/lib/department-icons';

/* ── Command search ──────────────────────────────────────────── */

type CommandItem = { label: string; icon: string; href?: string; run?: () => void; hint?: string };

export function HomeCommandSearch({ extra = [] }: { extra?: CommandItem[] }) {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [cursor, setCursor] = useState(0);

    const items = useMemo<CommandItem[]>(() => [
        ...navSections.flatMap(s => s.items.map(i => ({ label: i.label, icon: i.icon, href: i.href, hint: s.title }))),
        { label: 'Settings', icon: 'settings', href: '/settings', hint: 'Account' },
        ...extra,
    ], [extra]);

    const q = query.trim().toLowerCase();
    const matches = q ? items.filter(i => i.label.toLowerCase().includes(q)).slice(0, 7) : items.slice(0, 7);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
                setOpen(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const choose = (item: CommandItem | undefined) => {
        if (!item) return;
        setOpen(false);
        setQuery('');
        inputRef.current?.blur();
        if (item.run) item.run();
        else if (item.href) router.push(item.href);
    };

    return (
        <div className="hx-search" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
            <span className="material-icons-round hx-search__icon">search</span>
            <input
                ref={inputRef}
                value={query}
                placeholder="Search pages and actions"
                aria-label="Search pages and actions"
                onFocus={() => setOpen(true)}
                onChange={(e) => { setQuery(e.target.value); setCursor(0); setOpen(true); }}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, matches.length - 1)); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
                    else if (e.key === 'Enter') { e.preventDefault(); choose(matches[cursor]); }
                    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
                }}
            />
            <kbd className="hx-search__kbd">⌘K</kbd>
            {open && (
                <ul className="hx-search__menu" role="listbox">
                    {matches.length === 0 ? (
                        <li className="hx-search__empty">No matches for “{query}”</li>
                    ) : matches.map((m, i) => (
                        <li key={m.label}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={i === cursor}
                                className={`hx-search__opt${i === cursor ? ' is-active' : ''}`}
                                onMouseEnter={() => setCursor(i)}
                                onClick={() => choose(m)}
                            >
                                <span className="material-icons-round">{m.icon}</span>
                                <span className="hx-search__lab">{m.label}</span>
                                {m.hint && <span className="hx-search__hint">{m.hint}</span>}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/* ── Notes (per-browser scratchpad) ──────────────────────────── */

const NOTES_KEY = 'helix-home-notes';

export function HomeNotesCard() {
    const [text, setText] = useState('');
    const [savedAt, setSavedAt] = useState<Date | null>(null);
    const loadedRef = useRef(false);

    // Read storage after mount (deferred) so SSR markup matches the first client render.
    useEffect(() => {
        const id = window.setTimeout(() => {
            try {
                const raw = window.localStorage.getItem(NOTES_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw) as { text?: string; at?: string };
                    setText(parsed.text || '');
                    setSavedAt(parsed.at ? new Date(parsed.at) : null);
                }
            } catch { /* storage unavailable */ }
            loadedRef.current = true;
        }, 0);
        return () => window.clearTimeout(id);
    }, []);

    useEffect(() => {
        if (!loadedRef.current) return;
        const id = window.setTimeout(() => {
            const at = new Date();
            try {
                window.localStorage.setItem(NOTES_KEY, JSON.stringify({ text, at: at.toISOString() }));
                setSavedAt(at);
            } catch { /* storage unavailable */ }
        }, 500);
        return () => window.clearTimeout(id);
    }, [text]);

    return (
        <div className="hx-card hx-card--flex hx-notes">
            <div className="hx-card__hd">
                <h2 className="hx-card__title">
                    <span className="material-icons-round">sticky_note_2</span>
                    Notes
                </h2>
                {text && (
                    <button type="button" className="hx-icon-btn" onClick={() => setText('')} aria-label="Clear note" title="Clear note">
                        <span className="material-icons-round">close</span>
                    </button>
                )}
            </div>
            <div className="hx-notes__paper">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Jot down a handover reminder…"
                    aria-label="Notes"
                />
                <span className="hx-notes__meta">
                    {savedAt && text
                        ? `Saved on this device · ${savedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                        : 'Only visible on this device'}
                </span>
            </div>
        </div>
    );
}

/* ── Mini month calendar ─────────────────────────────────────── */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function HomeCalendarCard({ today }: { today: Date | null }) {
    const [offset, setOffset] = useState(0);
    const base = today ?? new Date(2000, 0, 1);
    const view = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    const year = view.getFullYear();
    const month = view.getMonth();
    const lead = (view.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const cells = Array.from({ length: 42 }, (_, i) => {
        const d = i - lead + 1;
        if (d < 1) return { day: prevDays + d, inMonth: false, key: `p${i}` };
        if (d > daysInMonth) return { day: d - daysInMonth, inMonth: false, key: `n${i}` };
        return { day: d, inMonth: true, key: `c${i}` };
    });
    const rows = cells.slice(0, Math.ceil((lead + daysInMonth) / 7) * 7);
    const isToday = (d: number) =>
        today !== null && d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

    return (
        <div className="hx-card hx-card--flex hx-cal">
            <div className="hx-card__hd">
                <h2 className="hx-card__title">
                    {today ? view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ' '}
                </h2>
                <div className="hx-cal__nav">
                    <button type="button" className="hx-icon-btn" onClick={() => setOffset(o => o - 1)} aria-label="Previous month">
                        <span className="material-icons-round">chevron_left</span>
                    </button>
                    {offset !== 0 && (
                        <button type="button" className="hx-chip-btn" onClick={() => setOffset(0)}>Today</button>
                    )}
                    <button type="button" className="hx-icon-btn" onClick={() => setOffset(o => o + 1)} aria-label="Next month">
                        <span className="material-icons-round">chevron_right</span>
                    </button>
                </div>
            </div>
            <div className="hx-cal__paper">
                <div className="hx-cal__grid hx-cal__grid--head">
                    {WEEKDAYS.map(w => <span key={w}>{w}</span>)}
                </div>
                <div className="hx-cal__grid">
                    {rows.map(c => (
                        <span
                            key={c.key}
                            className={`hx-cal__day${c.inMonth ? '' : ' is-out'}${c.inMonth && isToday(c.day) ? ' is-today' : ''}`}
                        >
                            {c.day}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ── Messages by department (donut + legend) ─────────────────── */

export type DeptMixRow = { label: string; count: number; pct: number };

const DEPT_COLORS = ['#1b2a44', '#4a7fd0', '#3aa6a0', '#e0a43a', '#d0697a', '#9aa9bf'];

export function HomeDeptMessagesCard({
    rows,
    total,
    windowDays,
    loading,
    facilityName,
}: {
    rows: DeptMixRow[];
    total: number;
    windowDays: number;
    loading: boolean;
    facilityName: string;
}) {
    const [active, setActive] = useState<number | null>(null);
    const R = 52;
    const C = 2 * Math.PI * R;
    const GAP = rows.length > 1 ? 3 : 0;
    const fracs = rows.map(r => (total > 0 ? r.count / total : 0));
    const segments = rows.map((_, i) => ({
        i,
        len: Math.max(0, fracs[i] * C - GAP),
        offset: -fracs.slice(0, i).reduce((a, b) => a + b, 0) * C,
        color: DEPT_COLORS[i % DEPT_COLORS.length],
    }));
    const focus = active !== null ? rows[active] : null;
    const top = rows[0];

    return (
        <div className="hx-card hx-card--flex hx-dept">
            <div className="hx-card__hd">
                <div>
                    <h2 className="hx-card__title">Messages by department</h2>
                    <p className="hx-card__sub">
                        {loading ? '—' : rows.length > 0 ? `Last ${windowDays} days · ${rows.length} departments` : 'No message data this period'}
                    </p>
                </div>
                <span className="hx-badge">
                    <span className="material-icons-round">forum</span>
                    {windowDays}d
                </span>
            </div>

            {loading ? (
                <p className="hx-empty">Loading…</p>
            ) : rows.length === 0 ? (
                <div className="hx-dept__empty">
                    <span className="material-icons-round">mark_chat_unread</span>
                    <p>No department message data for {facilityName} yet.</p>
                </div>
            ) : (
                <>
                    <div className="hx-dept__top">
                        <div className="hx-donut" onMouseLeave={() => setActive(null)}>
                            <svg viewBox="0 0 140 140" role="img" aria-label={rows.map(r => `${r.label} ${r.count}`).join(', ')}>
                                <circle cx="70" cy="70" r={R} className="hx-donut__track" />
                                {segments.map(sg => (
                                    <circle
                                        key={sg.i}
                                        cx="70"
                                        cy="70"
                                        r={R}
                                        className={`hx-donut__seg${active !== null && active !== sg.i ? ' is-dim' : ''}${active === sg.i ? ' is-on' : ''}`}
                                        stroke={sg.color}
                                        strokeDasharray={`${sg.len} ${C - sg.len}`}
                                        strokeDashoffset={sg.offset}
                                        onMouseEnter={() => setActive(sg.i)}
                                    />
                                ))}
                            </svg>
                            <div className="hx-donut__center">
                                <span className="hx-donut__val">{(focus ? focus.count : total).toLocaleString()}</span>
                                <span className="hx-donut__lab">{focus ? `${focus.pct}% · ${focus.label}` : 'messages'}</span>
                            </div>
                        </div>

                        {top && (
                            <div className="hx-dept__callout">
                                <span className="hx-dept__callout-icon" style={{ background: DEPT_COLORS[0] }}>
                                    <span className="material-icons-round">{deptIcon(top.label)}</span>
                                </span>
                                <span className="hx-dept__callout-kicker">Busiest department</span>
                                <span className="hx-dept__callout-name">{top.label}</span>
                                <span className="hx-dept__callout-meta">
                                    {top.pct}% of all traffic · {top.count.toLocaleString()} messages
                                </span>
                                <span className="hx-stackbar" aria-hidden>
                                    {rows.map((r, i) => (
                                        <span
                                            key={r.label}
                                            style={{ flexGrow: Math.max(r.count, 1), background: DEPT_COLORS[i % DEPT_COLORS.length] }}
                                            className={active !== null && active !== i ? 'is-dim' : undefined}
                                        />
                                    ))}
                                </span>
                            </div>
                        )}
                    </div>

                    <ul className="hx-dept__legend">
                        {rows.map((r, i) => (
                            <li
                                key={r.label}
                                className={`hx-dept__row${active === i ? ' is-on' : ''}${active !== null && active !== i ? ' is-dim' : ''}`}
                                onMouseEnter={() => setActive(i)}
                                onMouseLeave={() => setActive(null)}
                            >
                                <span className="hx-dept__icon" style={{ color: DEPT_COLORS[i % DEPT_COLORS.length], background: `color-mix(in srgb, ${DEPT_COLORS[i % DEPT_COLORS.length]} 12%, transparent)` }}>
                                    <span className="material-icons-round">{deptIcon(r.label)}</span>
                                </span>
                                <span className="hx-dept__main">
                                    <span className="hx-dept__name">{r.label}</span>
                                    <span className="hx-bar">
                                        <span style={{ width: `${r.pct}%`, background: DEPT_COLORS[i % DEPT_COLORS.length] }} />
                                    </span>
                                </span>
                                <span className="hx-dept__count">{r.count.toLocaleString()}</span>
                                <span className="hx-dept__pct" style={{ color: DEPT_COLORS[i % DEPT_COLORS.length] }}>{r.pct}%</span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}
