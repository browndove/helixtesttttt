'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorText, schedFetch, type AuditEntry } from '@/lib/scheduling-api';
import { Bones, Card, Empty, Icon, LoadError } from './ui';

/** Audit values arrive as raw JSON bytes (number[]), base64 text, or plain JSON. */
function decodeValue(v: unknown): unknown {
    try {
        if (v == null) return null;
        if (Array.isArray(v) && v.every(n => typeof n === 'number')) {
            const text = new TextDecoder().decode(new Uint8Array(v as number[]));
            return text ? JSON.parse(text) : null;
        }
        if (typeof v === 'string') {
            try {
                return JSON.parse(atob(v));
            } catch {
                return JSON.parse(v);
            }
        }
        return v;
    } catch {
        return null;
    }
}

const humanize = (s: string) => (s || '').replace(/[_.]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\w/, c => c.toUpperCase());

function show(v: unknown): string {
    if (v == null || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'On' : 'Off';
    if (typeof v === 'object') return Array.isArray(v) ? (v.every(x => typeof x !== 'object') ? v.join(', ') || '—' : `${v.length} items`) : '…';
    return String(v);
}

/** Top-level fields that differ between the old and new value. */
function changes(oldV: unknown, newV: unknown): Array<{ key: string; from: string; to: string }> {
    const a = oldV && typeof oldV === 'object' && !Array.isArray(oldV) ? (oldV as Record<string, unknown>) : {};
    const b = newV && typeof newV === 'object' && !Array.isArray(newV) ? (newV as Record<string, unknown>) : {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const out: Array<{ key: string; from: string; to: string }> = [];
    for (const k of keys) {
        if (['updated_at', 'created_at', 'id', 'facility_id', 'department_id'].includes(k)) continue;
        if (JSON.stringify(a[k]) === JSON.stringify(b[k])) continue;
        out.push({ key: humanize(k), from: show(a[k]), to: show(b[k]) });
    }
    return out;
}

function actionIcon(action: string): string {
    const a = action.toLowerCase();
    if (a.includes('publish')) return 'campaign';
    if (a.includes('delete') || a.includes('remove')) return 'delete_outline';
    if (a.includes('create') || a.includes('add')) return 'add_circle_outline';
    if (a.includes('correct') || a.includes('attendance')) return 'edit_calendar';
    if (a.includes('approve') || a.includes('decide')) return 'task_alt';
    return 'edit';
}

function when(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
    return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ActivityPanel({ staffNames }: { staffNames: Map<string, string> }) {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [type, setType] = useState('');
    const [types, setTypes] = useState<string[]>([]);
    const [expanded, setExpanded] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const list = await schedFetch<AuditEntry[]>('audit', { query: { limit: 200, entity_type: type } });
            const rows = Array.isArray(list) ? list : [];
            setEntries(rows);
            if (!type) setTypes([...new Set(rows.map(r => r.entity_type).filter(Boolean))].sort());
        } catch (err) {
            setError(errorText(err));
        } finally {
            setLoading(false);
        }
    }, [type]);

    useEffect(() => {
        void (async () => { await load(); })();
    }, [load]);

    const rows = useMemo(() => entries.map(e => ({ e, diff: changes(decodeValue(e.old_value), decodeValue(e.new_value)) })), [entries]);

    if (loading && !entries.length && !error) return <section className="st-card"><Bones rows={6} /></section>;
    if (error && !entries.length) return <LoadError message={error} onRetry={() => void load()} />;

    return (
        <Card
            icon="history"
            title="Activity"
            sub="Who changed what in scheduling at this facility, newest first."
            actions={(
                <>
                    {types.length > 1 && (
                        <select className="st-input sc-select" value={type} onChange={e => setType(e.target.value)} aria-label="Filter by type">
                            <option value="">Everything</option>
                            {types.map(t => <option key={t} value={t}>{humanize(t)}</option>)}
                        </select>
                    )}
                    <button type="button" className="st-iconbtn st-btn" aria-label="Refresh" onClick={() => void load()}><Icon name="refresh" /></button>
                </>
            )}
        >
            {rows.length === 0 ? (
                <Empty icon="history" title="Nothing yet" text="Changes to rosters, settings and attendance show up here." />
            ) : (
                <ol className="sc-feed">
                    {rows.map(({ e, diff }) => {
                        const isOpen = expanded === e.id;
                        return (
                            <li key={e.id} className="sc-feed__item">
                                <span className="sc-feed__icon"><Icon name={actionIcon(e.action)} /></span>
                                <div className="sc-feed__body">
                                    <div className="sc-feed__line">
                                        <strong>{staffNames.get(e.actor_id) || 'Someone'}</strong>
                                        <span> {humanize(e.action).toLowerCase()} </span>
                                        <span className="sc-tag">{humanize(e.entity_type)}</span>
                                    </div>
                                    {e.reason && <div className="sc-feed__reason">“{e.reason}”</div>}
                                    {diff.length > 0 && (
                                        <>
                                            <button type="button" className="sc-link" onClick={() => setExpanded(isOpen ? '' : e.id)}>
                                                {isOpen ? 'Hide changes' : `${diff.length} change${diff.length === 1 ? '' : 's'}`}
                                            </button>
                                            {isOpen && (
                                                <ul className="sc-diff">
                                                    {diff.map(c => (
                                                        <li key={c.key}><span>{c.key}</span><s>{c.from}</s><Icon name="arrow_forward" size={14} /><b>{c.to}</b></li>
                                                    ))}
                                                </ul>
                                            )}
                                        </>
                                    )}
                                </div>
                                <time className="sc-feed__time" dateTime={e.created_at} title={new Date(e.created_at).toLocaleString()}>{when(e.created_at)}</time>
                            </li>
                        );
                    })}
                </ol>
            )}
        </Card>
    );
}
