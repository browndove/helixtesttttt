'use client';

import { useCallback, useEffect, useState } from 'react';
import { errorText, normalizeShiftType, schedFetch, type ShiftType } from '@/lib/scheduling-api';
import { Bones, Card, Empty, Icon, LoadError, Switch, type Notify } from './ui';

const BLANK: ShiftType = { code: '', label: '', start_time: '08:00', end_time: '16:00', hours: 8, is_working: true, sort_order: 0 };

/** Hours between two HH:MM times, wrapping past midnight. */
function spanHours(start: string, end: string): number {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return 0;
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (mins <= 0) mins += 24 * 60;
    return Math.round((mins / 60) * 4) / 4;
}

function ShiftForm({ initial, isNew, onCancel, onSave, saving }: {
    initial: ShiftType;
    isNew: boolean;
    onCancel: () => void;
    onSave: (s: ShiftType) => void;
    saving: boolean;
}) {
    const [s, setS] = useState(initial);
    const set = <K extends keyof ShiftType>(k: K, v: ShiftType[K]) => setS(prev => ({ ...prev, [k]: v }));
    const setTime = (k: 'start_time' | 'end_time', v: string) =>
        setS(prev => {
            const next = { ...prev, [k]: v };
            return next.is_working ? { ...next, hours: spanHours(next.start_time, next.end_time) } : next;
        });
    return (
        <form
            className="sc-shiftform"
            onSubmit={e => {
                e.preventDefault();
                onSave({ ...s, code: s.code.trim().toUpperCase(), label: s.label.trim() });
            }}
        >
            <div className="sc-shiftform__grid">
                <label className="st-field">
                    <span className="st-field__label">Code</span>
                    <input className="st-input st-input--mono" value={s.code} onChange={e => set('code', e.target.value.toUpperCase())} maxLength={6} placeholder="N" disabled={!isNew} required />
                </label>
                <label className="st-field sc-span2">
                    <span className="st-field__label">Name</span>
                    <input className="st-input" value={s.label} onChange={e => set('label', e.target.value)} placeholder="Night" required />
                </label>
                <label className="st-field">
                    <span className="st-field__label">Starts</span>
                    <input className="st-input" type="time" value={s.start_time} onChange={e => setTime('start_time', e.target.value)} disabled={!s.is_working} />
                </label>
                <label className="st-field">
                    <span className="st-field__label">Ends</span>
                    <input className="st-input" type="time" value={s.end_time} onChange={e => setTime('end_time', e.target.value)} disabled={!s.is_working} />
                </label>
                <label className="st-field">
                    <span className="st-field__label">Hours</span>
                    <input className="st-input" type="number" min={0} max={24} step={0.25} value={s.hours} onChange={e => set('hours', Number(e.target.value) || 0)} />
                </label>
            </div>
            <div className="sc-shiftform__foot">
                <label className="sc-inline">
                    <Switch label="Working shift" checked={s.is_working} onChange={v => setS(prev => ({ ...prev, is_working: v, hours: v ? spanHours(prev.start_time, prev.end_time) : 0 }))} />
                    <span className="sc-hint">{s.is_working ? 'Working shift' : 'Not a working shift (leave, day off…)'}</span>
                </label>
                <span className="sc-inline">
                    <button type="button" className="st-btn st-btn--ghost st-btn--sm" onClick={onCancel}>Cancel</button>
                    <button type="submit" className="st-btn st-btn--primary st-btn--sm" disabled={saving || !s.code.trim() || !s.label.trim()}>
                        <Icon name="check" /> {saving ? 'Saving…' : isNew ? 'Add code' : 'Save'}
                    </button>
                </span>
            </div>
        </form>
    );
}

export default function ShiftCodesPanel({ onNotify }: { onNotify: Notify }) {
    const [codes, setCodes] = useState<ShiftType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const raw = await schedFetch<unknown>('shift-types');
            const list = Array.isArray(raw) ? raw : [];
            setCodes(list.map(r => normalizeShiftType(r as Record<string, unknown>)).sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code)));
        } catch (err) {
            setError(errorText(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void (async () => { await load(); })();
    }, [load]);

    const save = async (s: ShiftType, isNew: boolean) => {
        if (isNew && codes.some(c => c.code === s.code)) {
            onNotify(`Code ${s.code} already exists. Edit it instead.`, 'error');
            return;
        }
        setSaving(true);
        try {
            const { facility_id: _f, ...body } = s;
            void _f;
            await schedFetch('shift-types', { method: 'PUT', body: { ...body, sort_order: isNew ? codes.length + 1 : s.sort_order } });
            onNotify(isNew ? `Added ${s.code}` : `Saved ${s.code}`, 'success');
            setEditing(null);
            await load();
        } catch (err) {
            onNotify(errorText(err), 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading && !codes.length) return <section className="st-card"><Bones rows={5} /></section>;
    if (error && !codes.length) return <LoadError message={error} onRetry={() => void load()} />;

    return (
        <Card
            icon="badge"
            title="Shift codes"
            sub="The letters on the roster. Built-in codes come with Helix; your facility can add its own."
            actions={editing === null ? (
                <button type="button" className="st-btn st-btn--primary st-btn--sm" onClick={() => setEditing('__new')}><Icon name="add" /> New code</button>
            ) : undefined}
        >
            {editing === '__new' && (
                <div className="sc-pad"><ShiftForm initial={BLANK} isNew saving={saving} onCancel={() => setEditing(null)} onSave={s => void save(s, true)} /></div>
            )}
            {codes.length === 0 && editing !== '__new' ? (
                <Empty icon="badge" title="No shift codes yet" text="Add codes like M (morning), A (afternoon) and N (night)." />
            ) : (
                <ul className="sc-codes">
                    {codes.map(c => (
                        <li key={c.code} className={`sc-code${editing === c.code ? ' is-editing' : ''}`}>
                            {editing === c.code ? (
                                <ShiftForm initial={c} isNew={false} saving={saving} onCancel={() => setEditing(null)} onSave={s => void save(s, false)} />
                            ) : (
                                <>
                                    <span className={`sc-code__badge${c.is_working ? '' : ' is-off'}`}>{c.code}</span>
                                    <span className="sc-code__text">
                                        <span className="sc-code__name">
                                            {c.label || c.code}
                                            {!c.facility_id && <span className="st-pill">Built-in</span>}
                                        </span>
                                        <span className="sc-code__meta">
                                            {c.is_working ? `${c.start_time || '—'} – ${c.end_time || '—'} · ${c.hours}h` : 'Not a working shift'}
                                        </span>
                                    </span>
                                    <button type="button" className="st-btn st-btn--ghost st-btn--sm" onClick={() => setEditing(c.code)} disabled={editing !== null}>
                                        <Icon name="edit" /> Edit
                                    </button>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
