'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    errorText,
    formatDateTime,
    formatMinutes,
    isoDate,
    mondayOf,
    schedFetch,
    WEEKDAYS,
    type AttendanceCell,
    type AttendanceRecord,
    type AttendanceWeek,
} from '@/lib/scheduling-api';
import { Bones, Card, Empty, Icon, LoadError, type Notify } from './ui';

/** Colour family for a mark; unknown marks stay neutral. */
function markTone(mark: string, needsReview?: boolean): string {
    const m = (mark || '').toLowerCase();
    if (needsReview || m.includes('review')) return 'review';
    if (m.includes('miss') || m.includes('absent') || m.includes('no_show')) return 'bad';
    if (m.includes('short') || m.includes('late') || m.includes('early')) return 'warn';
    if (m.includes('ok') || m.includes('present') || m.includes('on_time') || m.includes('complete') || m.includes('worked')) return 'ok';
    if (m.includes('open') || m.includes('in_progress') || m.includes('clocked')) return 'live';
    return 'none';
}

const humanize = (s: string) => (s ? s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()) : '—');

/** <input type="datetime-local"> value for an ISO time, in local time. */
function toLocalInput(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : '');

/** Record sheet: view a record and correct it, or create one for a shift nobody clocked. */
function RecordSheet({ cell, staffName, onClose, onSaved, onNotify }: {
    cell: AttendanceCell & { staff_name?: string };
    staffName: string;
    onClose: () => void;
    onSaved: () => void;
    onNotify: Notify;
}) {
    const [record, setRecord] = useState<AttendanceRecord | null>(null);
    const [loading, setLoading] = useState(!!cell.record_id);
    const [inAt, setInAt] = useState('');
    const [outAt, setOutAt] = useState('');
    const [clearOut, setClearOut] = useState(false);
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!cell.record_id) return;
        let alive = true;
        void schedFetch<AttendanceRecord>(`attendance/records/${cell.record_id}`)
            .then(r => {
                if (!alive) return;
                setRecord(r);
                setInAt(toLocalInput(r.in_at));
                setOutAt(toLocalInput(r.out_at));
            })
            .catch(err => alive && onNotify(errorText(err), 'error'))
            .finally(() => alive && setLoading(false));
        return () => { alive = false; };
    }, [cell.record_id, onNotify]);

    const submit = async () => {
        if (!reason.trim()) {
            onNotify('Add a reason; it is kept in the activity log and the staff member is told.', 'error');
            return;
        }
        setSaving(true);
        try {
            if (record) {
                const body: Record<string, unknown> = { reason: reason.trim() };
                // Compare at the form's minute precision so untouched times aren't re-sent without seconds.
                if (inAt && inAt !== toLocalInput(record.in_at)) body.in_at = fromLocalInput(inAt);
                if (clearOut) body.clear_out = true;
                else if (outAt && outAt !== toLocalInput(record.out_at)) body.out_at = fromLocalInput(outAt);
                await schedFetch(`attendance/records/${record.id}`, { method: 'PATCH', body });
            } else {
                if (!inAt) {
                    onNotify('Enter when they clocked in.', 'error');
                    setSaving(false);
                    return;
                }
                await schedFetch('attendance/records', {
                    method: 'POST',
                    body: { assignment_id: cell.assignment_id, in_at: fromLocalInput(inAt), ...(outAt ? { out_at: fromLocalInput(outAt) } : {}), reason: reason.trim() },
                });
            }
            onNotify(record ? 'Attendance corrected' : 'Attendance recorded', 'success');
            onSaved();
        } catch (err) {
            onNotify(errorText(err), 'error');
        } finally {
            setSaving(false);
        }
    };

    const tone = markTone(record?.mark || cell.mark, record?.needs_review);
    return (
        <div className="sc-sheet" role="dialog" aria-modal="true" aria-label={`Attendance for ${staffName}`}>
            <button type="button" className="sc-sheet__scrim" aria-label="Close" onClick={onClose} />
            <div className="sc-sheet__panel">
                <div className="sc-sheet__head">
                    <div>
                        <div className="sc-sheet__kicker">{new Date(`${cell.work_date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                        <h3 className="sc-sheet__title">{staffName}</h3>
                    </div>
                    <button type="button" className="st-iconbtn st-btn" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
                </div>
                {loading ? <Bones rows={3} /> : (
                    <>
                        <div className="sc-sheet__facts">
                            <span className={`sc-mark sc-mark--${tone}`}>{cell.code || record?.code}</span>
                            <span className={`sc-tag sc-tag--${tone}`}>{humanize(record?.mark || cell.mark || (record ? '' : 'not clocked'))}</span>
                            {record?.section && <span className="sc-tag">{record.section}</span>}
                        </div>
                        {record && (
                            <dl className="sc-facts">
                                <div><dt>Shift</dt><dd>{formatDateTime(record.starts_at)} – {formatDateTime(record.ends_at)}</dd></div>
                                <div><dt>Clocked in</dt><dd>{formatDateTime(record.in_at)}{record.in_method ? ` · ${humanize(record.in_method)}` : ''}</dd></div>
                                <div><dt>Clocked out</dt><dd>{formatDateTime(record.out_at)}{record.out_method ? ` · ${humanize(record.out_method)}` : ''}</dd></div>
                                <div><dt>Worked</dt><dd>{formatMinutes(record.worked_minutes)} of {formatMinutes(record.scheduled_minutes)}</dd></div>
                                {record.in_location && <div><dt>In at</dt><dd className="sc-mono">{record.in_location.lat.toFixed(5)}, {record.in_location.lng.toFixed(5)} (±{Math.round(record.in_location.accuracy_m)} m)</dd></div>}
                                {record.correction_reason && <div><dt>Last correction</dt><dd>{record.correction_reason}</dd></div>}
                            </dl>
                        )}
                        <div className="sc-sheet__form">
                            <div className="sc-sheet__formtitle">{record ? 'Correct this record' : 'They worked but didn’t clock in'}</div>
                            <div className="sc-grid2">
                                <label className="st-field">
                                    <span className="st-field__label">Clock-in</span>
                                    <input className="st-input" type="datetime-local" value={inAt} onChange={e => setInAt(e.target.value)} />
                                </label>
                                <label className="st-field">
                                    <span className="st-field__label">Clock-out</span>
                                    <input className="st-input" type="datetime-local" value={outAt} onChange={e => setOutAt(e.target.value)} disabled={clearOut} />
                                </label>
                            </div>
                            {record?.out_at && (
                                <label className="sc-inline sc-check">
                                    <input type="checkbox" checked={clearOut} onChange={e => setClearOut(e.target.checked)} />
                                    <span className="sc-hint">Remove the clock-out (they are still on shift)</span>
                                </label>
                            )}
                            <label className="st-field">
                                <span className="st-field__label">Reason</span>
                                <textarea className="st-input sc-textarea" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Phone died; confirmed with the ward in-charge" rows={3} />
                            </label>
                            <p className="sc-hint">The reason is saved in the activity log and the staff member is notified.</p>
                            <div className="sc-sheet__actions">
                                <button type="button" className="st-btn st-btn--ghost" onClick={onClose}>Cancel</button>
                                <button type="button" className="st-btn st-btn--primary" onClick={() => void submit()} disabled={saving || !reason.trim()}>
                                    <Icon name="check" /> {saving ? 'Saving…' : record ? 'Save correction' : 'Record attendance'}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function AttendancePanel({ departmentId, onNotify }: { departmentId: string; onNotify: Notify }) {
    const [weekStart, setWeekStart] = useState(() => isoDate(mondayOf(new Date())));
    const [week, setWeek] = useState<AttendanceWeek | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [open, setOpen] = useState<{ cell: AttendanceCell; name: string } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            setWeek(await schedFetch<AttendanceWeek>('attendance', { query: { department_id: departmentId, week_start: weekStart } }));
        } catch (err) {
            setError(errorText(err));
        } finally {
            setLoading(false);
        }
    }, [departmentId, weekStart]);

    useEffect(() => {
        void (async () => { await load(); })();
    }, [load]);

    const shiftWeek = (delta: number) => {
        const d = new Date(`${weekStart}T00:00:00`);
        d.setDate(d.getDate() + delta * 7);
        setWeekStart(isoDate(d));
    };
    const start = new Date(`${weekStart}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const isThisWeek = weekStart === isoDate(mondayOf(new Date()));
    const days = week?.days?.length === 7 ? week.days : Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        return isoDate(d);
    });
    const today = isoDate(new Date());
    const s = week?.summary;

    return (
        <div className="st-stack">
            <Card
                icon="how_to_reg"
                title="Attendance"
                sub={`${start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`}
                actions={(
                    <div className="sc-weeknav">
                        <button type="button" className="st-iconbtn st-btn" aria-label="Previous week" onClick={() => shiftWeek(-1)}><Icon name="chevron_left" /></button>
                        <button type="button" className="st-btn st-btn--sm" onClick={() => setWeekStart(isoDate(mondayOf(new Date())))} disabled={isThisWeek}>This week</button>
                        <button type="button" className="st-iconbtn st-btn" aria-label="Next week" onClick={() => shiftWeek(1)}><Icon name="chevron_right" /></button>
                    </div>
                )}
            >
                <div className="sc-stats">
                    <div className="sc-stat"><span>Shifts</span><strong>{s ? s.shifts : '—'}</strong></div>
                    <div className={`sc-stat${s?.missed ? ' is-bad' : ''}`}><span>No-shows</span><strong>{s ? s.missed : '—'}</strong></div>
                    <div className={`sc-stat${s?.short ? ' is-warn' : ''}`}><span>Left early</span><strong>{s ? s.short : '—'}</strong></div>
                    <div className={`sc-stat${s?.needs_review ? ' is-review' : ''}`}><span>Needs review</span><strong>{s ? s.needs_review : '—'}</strong></div>
                </div>

                {loading && !week ? <Bones rows={4} /> : error && !week ? (
                    <div className="sc-pad"><LoadError message={error} onRetry={() => void load()} /></div>
                ) : !week?.rows?.length ? (
                    <Empty icon="event_busy" title="No published shifts this week" text="Attendance shows once a roster with working shifts is published." />
                ) : (
                    <div className="sc-tablewrap">
                        <table className="sc-att">
                            <thead>
                                <tr>
                                    <th scope="col">Staff</th>
                                    {days.map((day, i) => (
                                        <th key={day} scope="col" className={day === today ? 'is-today' : undefined}>
                                            <span>{WEEKDAYS[i]}</span>
                                            <small>{Number(day.slice(8))}</small>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {week.rows.map(row => (
                                    <tr key={row.staff_id}>
                                        <th scope="row">{row.display_name}</th>
                                        {days.map(day => {
                                            const cells = row.cells.filter(c => c.work_date === day);
                                            return (
                                                <td key={day} className={day === today ? 'is-today' : undefined}>
                                                    {cells.map(c => {
                                                        const tone = markTone(c.mark);
                                                        return (
                                                            <button
                                                                key={c.assignment_id}
                                                                type="button"
                                                                className={`sc-mark sc-mark--${tone}`}
                                                                title={`${c.code} · ${humanize(c.mark || 'not clocked')}`}
                                                                onClick={() => setOpen({ cell: c, name: row.display_name })}
                                                            >
                                                                {c.code}
                                                            </button>
                                                        );
                                                    })}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {week?.rows?.length ? (
                    <div className="sc-legend">
                        {[['ok', 'On time'], ['warn', 'Late or short'], ['bad', 'No-show'], ['review', 'Needs review'], ['live', 'On shift'], ['none', 'Not yet']].map(([t, l]) => (
                            <span key={t}><span className={`sc-legend__dot sc-mark--${t}`} />{l}</span>
                        ))}
                    </div>
                ) : null}
            </Card>

            {week?.exceptions?.length ? (
                <Card icon="report" title={<>Exceptions <span className="st-count">{week.exceptions.length}</span></>} sub="No-shows, early leavers and records to check.">
                    <ul className="sc-exc">
                        {week.exceptions.map(r => {
                            const tone = markTone(r.mark, r.needs_review);
                            return (
                                <li key={r.id || r.assignment_id}>
                                    <button
                                        type="button"
                                        className="sc-exc__row"
                                        onClick={() => setOpen({ cell: { assignment_id: r.assignment_id, record_id: r.id, code: r.code, mark: r.mark, work_date: r.work_date }, name: r.staff_name })}
                                    >
                                        <span className={`sc-mark sc-mark--${tone}`}>{r.code}</span>
                                        <span className="sc-exc__text">
                                            <span className="sc-exc__name">{r.staff_name}</span>
                                            <span className="sc-exc__meta">
                                                {new Date(`${r.work_date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                                                {r.in_at ? ` · in ${formatDateTime(r.in_at)}` : ' · never clocked in'}
                                                {r.worked_minutes ? ` · worked ${formatMinutes(r.worked_minutes)} of ${formatMinutes(r.scheduled_minutes)}` : ''}
                                            </span>
                                        </span>
                                        <span className={`sc-tag sc-tag--${tone}`}>{r.needs_review ? 'Needs review' : humanize(r.mark)}</span>
                                        <Icon name="chevron_right" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </Card>
            ) : null}

            {open && (
                <RecordSheet
                    cell={open.cell}
                    staffName={open.name}
                    onClose={() => setOpen(null)}
                    onSaved={() => {
                        setOpen(null);
                        void load();
                    }}
                    onNotify={onNotify}
                />
            )}
        </div>
    );
}
