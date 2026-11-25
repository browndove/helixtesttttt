'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_ENDPOINTS } from '@/lib/config';
import { appendFacilityIdForProxy } from '@/lib/facility-client';
import { errorText, normalizeShiftType, schedFetch, WEEKDAYS, type ShiftTarget, type ShiftType } from '@/lib/scheduling-api';
import { Bones, Card, Empty, Icon, LoadError, SaveBar, sameJson, type Notify } from './ui';

type Role = { id: string; name: string };

/** Cell key: code|weekday (weekday "" = every day) for targets without a role. */
const cellKey = (code: string, weekday?: number) => `${code}|${weekday ?? ''}`;

function sortTargets(list: ShiftTarget[]): ShiftTarget[] {
    return [...list].sort((a, b) =>
        a.code.localeCompare(b.code) || (a.role_id || '').localeCompare(b.role_id || '') || (a.weekday ?? -1) - (b.weekday ?? -1));
}

async function loadRoles(): Promise<Role[]> {
    try {
        const res = await fetch(await appendFacilityIdForProxy(API_ENDPOINTS.ROLES), { credentials: 'include' });
        if (!res.ok) return [];
        const raw: unknown = await res.json();
        const list = Array.isArray(raw) ? raw : ((raw as Record<string, unknown>)?.roles || (raw as Record<string, unknown>)?.items || (raw as Record<string, unknown>)?.data);
        return (Array.isArray(list) ? list : [])
            .map(r => r as Record<string, unknown>)
            .filter(r => typeof r.id === 'string')
            .map(r => ({ id: r.id as string, name: String(r.name || r.display_name || 'Role') }));
    } catch {
        return [];
    }
}

export default function TargetsPanel({ departmentId, departmentName, onNotify }: { departmentId: string; departmentName: string; onNotify: Notify }) {
    const [codes, setCodes] = useState<ShiftType[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [saved, setSaved] = useState<ShiftTarget[]>([]);
    const [draft, setDraft] = useState<ShiftTarget[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [t, s, r] = await Promise.all([
                schedFetch<{ targets?: ShiftTarget[] }>('targets', { query: { department_id: departmentId } }),
                schedFetch<unknown>('shift-types'),
                loadRoles(),
            ]);
            const list = sortTargets((t?.targets || []).map(x => ({ code: x.code, target: x.target, ...(x.role_id ? { role_id: x.role_id } : {}), ...(typeof x.weekday === 'number' ? { weekday: x.weekday } : {}) })));
            setSaved(list);
            setDraft(list);
            setCodes((Array.isArray(s) ? s : []).map(x => normalizeShiftType(x as Record<string, unknown>)).filter(c => c.is_working).sort((a, b) => a.sort_order - b.sort_order));
            setRoles(r);
        } catch (err) {
            setError(errorText(err));
        } finally {
            setLoading(false);
        }
    }, [departmentId]);

    useEffect(() => {
        void (async () => { await load(); })();
    }, [load]);

    const plain = useMemo(() => {
        const m = new Map<string, number>();
        for (const t of draft) if (!t.role_id) m.set(cellKey(t.code, t.weekday), t.target);
        return m;
    }, [draft]);
    const roleRows = draft.map((t, i) => ({ t, i })).filter(x => x.t.role_id !== undefined);

    const setCell = (code: string, weekday: number | undefined, raw: string) => {
        setDraft(prev => {
            const rest = prev.filter(t => !(t.role_id === undefined && t.code === code && t.weekday === weekday));
            if (raw === '') return sortTargets(rest);
            const target = Math.max(0, Math.round(Number(raw) || 0));
            return sortTargets([...rest, { code, target, ...(weekday !== undefined ? { weekday } : {}) }]);
        });
    };

    const save = async () => {
        if (draft.some(t => t.role_id === '')) {
            onNotify('Pick a role for every role target, or remove it.', 'error');
            return;
        }
        setSaving(true);
        try {
            const reply = await schedFetch<{ targets?: ShiftTarget[] }>('targets', { method: 'PUT', body: { department_id: departmentId, targets: draft } });
            const list = sortTargets(reply?.targets || draft);
            setSaved(list);
            setDraft(list);
            onNotify(`Targets saved for ${departmentName}`, 'success');
        } catch (err) {
            onNotify(errorText(err), 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading && !codes.length) return <section className="st-card"><Bones rows={4} /></section>;
    if (error && !codes.length) return <LoadError message={error} onRetry={() => void load()} />;

    return (
        <div className="st-stack">
            <Card icon="groups_3" title="People per shift" sub="How many people each shift needs. A day’s number overrides “Every day”; leave it blank to use the default.">
                {codes.length === 0 ? (
                    <Empty icon="badge" title="No working shift codes" text="Add shift codes first, then set how many people each one needs." />
                ) : (
                    <div className="sc-tablewrap">
                        <table className="sc-targets">
                            <thead>
                                <tr>
                                    <th scope="col">Shift</th>
                                    <th scope="col" className="is-default">Every day</th>
                                    {WEEKDAYS.map(w => <th key={w} scope="col">{w}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {codes.map(c => {
                                    const base = plain.get(cellKey(c.code));
                                    return (
                                        <tr key={c.code}>
                                            <th scope="row">
                                                <span className="sc-code__badge sc-code__badge--sm">{c.code}</span>
                                                <span className="sc-targets__label">{c.label}</span>
                                            </th>
                                            <td className="is-default">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    className="sc-cell"
                                                    aria-label={`${c.label} every day`}
                                                    value={base ?? ''}
                                                    placeholder="–"
                                                    onChange={e => setCell(c.code, undefined, e.target.value)}
                                                />
                                            </td>
                                            {WEEKDAYS.map((w, wd) => {
                                                const v = plain.get(cellKey(c.code, wd));
                                                return (
                                                    <td key={w}>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            className={`sc-cell${v !== undefined ? ' is-set' : ''}`}
                                                            aria-label={`${c.label} ${w}`}
                                                            value={v ?? ''}
                                                            placeholder={base !== undefined ? String(base) : '–'}
                                                            onChange={e => setCell(c.code, wd, e.target.value)}
                                                        />
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Card
                icon="badge"
                title="By role"
                sub="Optional: a minimum for one role on a shift, e.g. at least 1 midwife on nights. These win over the numbers above."
                actions={codes.length > 0 ? (
                    <button type="button" className="st-btn st-btn--sm" onClick={() => setDraft(prev => [...prev, { code: codes[0].code, role_id: '', target: 1 }])}>
                        <Icon name="add" /> Add role target
                    </button>
                ) : undefined}
            >
                {roleRows.length === 0 ? (
                    <p className="sc-hint sc-pad">No role targets.</p>
                ) : (
                    <ul className="sc-list">
                        {roleRows.map(({ t, i }) => {
                            const update = (next: Partial<ShiftTarget>) => setDraft(prev => prev.map((x, j) => {
                                if (j !== i) return x;
                                const merged = { ...x, ...next };
                                if (merged.weekday === undefined) delete merged.weekday;
                                return merged;
                            }));
                            return (
                                <li key={i} className="sc-list__row sc-list__row--targets">
                                    <select className="st-input sc-select" aria-label="Role" value={t.role_id} onChange={e => update({ role_id: e.target.value })}>
                                        <option value="">Choose a role…</option>
                                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                    <select className="st-input sc-select" aria-label="Shift" value={t.code} onChange={e => update({ code: e.target.value })}>
                                        {codes.map(c => <option key={c.code} value={c.code}>{c.code} · {c.label}</option>)}
                                    </select>
                                    <select
                                        className="st-input sc-select"
                                        aria-label="Day"
                                        value={t.weekday ?? ''}
                                        onChange={e => update({ weekday: e.target.value === '' ? undefined : Number(e.target.value) })}
                                    >
                                        <option value="">Every day</option>
                                        {WEEKDAYS.map((w, wd) => <option key={w} value={wd}>{w}</option>)}
                                    </select>
                                    <input type="number" min={0} className="st-input sc-cell--wide" aria-label="People" value={t.target} onChange={e => update({ target: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
                                    <button type="button" className="st-iconbtn st-btn" aria-label="Remove role target" onClick={() => setDraft(prev => prev.filter((_, j) => j !== i))}>
                                        <Icon name="close" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
                {roles.length === 0 && roleRows.length > 0 && <p className="sc-hint sc-pad">Couldn’t load roles for this facility.</p>}
            </Card>

            <SaveBar dirty={!sameJson(draft, saved)} saving={saving} onSave={() => void save()} onDiscard={() => setDraft(saved)} />
        </div>
    );
}
