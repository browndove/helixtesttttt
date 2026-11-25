'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    errorText,
    initialsOf,
    personName,
    schedFetch,
    type PoolMember,
    type RosterMember,
    type RosterRank,
} from '@/lib/scheduling-api';
import { Bones, Card, ChipSelect, Empty, Icon, LoadError, type ListOption, type Notify } from './ui';

type Ctx = { ranks: RosterRank[]; areas: string[] };
type Filter = 'all' | 'setup' | 'none' | `area:${string}`;

const SENIORITY: Record<string, string> = { senior: 'Senior', mid: 'Mid-level', junior: 'Junior' };

function AddFromPool({ departmentId, areas, onAdded, onClose, onNotify }: {
    departmentId: string;
    areas: string[];
    onAdded: () => void;
    onClose: () => void;
    onNotify: Notify;
}) {
    const [q, setQ] = useState('');
    const [pool, setPool] = useState<PoolMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [area, setArea] = useState('');
    const [adding, setAdding] = useState('');

    useEffect(() => {
        let alive = true;
        const t = setTimeout(() => {
            void (async () => {
                setLoading(true);
                try {
                    const list = await schedFetch<PoolMember[]>('facility-pool', { query: { department_id: departmentId, q: q.trim() } });
                    if (alive) {
                        setPool(Array.isArray(list) ? list : []);
                        setError('');
                    }
                } catch (err) {
                    if (alive) setError(errorText(err));
                } finally {
                    if (alive) setLoading(false);
                }
            })();
        }, q ? 300 : 0);
        return () => {
            alive = false;
            clearTimeout(t);
        };
    }, [departmentId, q]);

    const add = async (m: PoolMember) => {
        setAdding(m.user_id);
        try {
            await schedFetch('roster', { method: 'POST', body: { department_id: departmentId, user_id: m.user_id, primary_section: area } });
            onNotify(`${personName(m)} added to the roster`, 'success');
            setPool(prev => prev.filter(p => p.user_id !== m.user_id));
            onAdded();
        } catch (err) {
            onNotify(errorText(err), 'error');
        } finally {
            setAdding('');
        }
    };

    const areaOptions: ListOption[] = [{ value: '', label: 'No area', icon: 'block' }, ...areas.map(a => ({ value: a, label: a, icon: 'location_on' }))];

    return (
        <div className="sc-pool">
            <div className="sc-pool__head">
                <span className="sc-pool__ico"><Icon name="person_add" /></span>
                <span className="sc-pool__titles">
                    <span className="sc-pool__title">Add from the facility</span>
                    <span className="sc-pool__sub">People at the facility who aren’t on this roster yet</span>
                </span>
                <button type="button" className="sc-iconbtn" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
            </div>
            <div className="sc-pool__bar">
                <label className="sc-staff__search">
                    <Icon name="search" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search staff by name" aria-label="Search staff" autoFocus />
                </label>
                {areas.length > 0 && (
                    <ChipSelect icon="location_on" value={area} options={areaOptions} onChange={setArea} label="Area for new members" placeholder="Area (optional)" />
                )}
            </div>
            {error ? <p className="sc-hint sc-hint--bad">{error}</p> : loading && !pool.length ? <Bones rows={3} /> : pool.length === 0 ? (
                <p className="sc-hint">{q ? `No one matches “${q}”.` : 'Everyone at the facility is already on this roster.'}</p>
            ) : (
                <ul className="sc-members sc-members--pool">
                    {pool.slice(0, 50).map(m => {
                        const name = personName(m);
                        return (
                            <li key={m.user_id} className="sc-member">
                                <span className="sc-avatar">{initialsOf(name)}</span>
                                <span className="sc-member__text">
                                    <span className="sc-member__name">{name}</span>
                                    <span className="sc-member__sub">
                                        {[m.position_title || m.job_title, m.departments?.length ? `in ${m.departments.join(', ')}` : 'No department'].filter(Boolean).join(' · ')}
                                    </span>
                                </span>
                                <button type="button" className="st-btn st-btn--sm" onClick={() => void add(m)} disabled={adding === m.user_id}>
                                    <Icon name="add" /> {adding === m.user_id ? 'Adding…' : 'Add'}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

export default function StaffPanel({ departmentId, departmentName, onNotify }: { departmentId: string; departmentName: string; onNotify: Notify }) {
    const [members, setMembers] = useState<RosterMember[]>([]);
    const [ctx, setCtx] = useState<Ctx>({ ranks: [], areas: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<Filter>('all');
    const [showPool, setShowPool] = useState(false);
    const [busy, setBusy] = useState('');
    const [confirmRemove, setConfirmRemove] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const q = { department_id: departmentId };
            const [roster, rs, st] = await Promise.all([
                schedFetch<{ members?: RosterMember[] }>('roster', { query: q }),
                schedFetch<{ ranks?: RosterRank[] }>('roster-settings', { query: q }).catch(() => null),
                schedFetch<{ work_areas?: string[]; work_area_kind?: string }>('settings', { query: q }).catch(() => null),
            ]);
            setMembers((roster?.members || []).slice().sort((a, b) => personName(a).localeCompare(personName(b))));
            setCtx({
                ranks: Array.isArray(rs?.ranks) ? rs.ranks : [],
                areas: st?.work_area_kind && st.work_area_kind !== 'none' && Array.isArray(st.work_areas) ? st.work_areas : [],
            });
        } catch (err) {
            setError(errorText(err));
        } finally {
            setLoading(false);
        }
    }, [departmentId]);

    useEffect(() => {
        void (async () => { await load(); })();
    }, [load]);

    const byId = useMemo(() => new Map(members.map(m => [m.user_id, m])), [members]);
    /** Someone the roster can't place well yet: no rank, or no area when the department uses areas. */
    const needsSetup = useCallback(
        (m: RosterMember) => (ctx.ranks.length > 0 && !m.rank_id) || (ctx.areas.length > 0 && !m.primary_section),
        [ctx],
    );
    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return members.filter(m => {
            if (q && !`${personName(m)} ${m.job_title} ${m.rank_name}`.toLowerCase().includes(q)) return false;
            if (filter === 'setup') return needsSetup(m);
            if (filter === 'none') return !m.primary_section;
            if (filter.startsWith('area:')) return m.primary_section === filter.slice(5);
            return true;
        });
    }, [members, query, filter, needsSetup]);

    /** Area sections in the department's own order, then any stray areas, then "No area". */
    const groups = useMemo(() => {
        if (!ctx.areas.length || filter !== 'all') return [{ key: '', title: '', icon: '', people: shown }];
        const names = [...ctx.areas, ...new Set(shown.map(m => m.primary_section).filter(a => a && !ctx.areas.includes(a)))];
        const list = names.map(a => ({ key: a, title: a, icon: 'location_on', people: shown.filter(m => m.primary_section === a) }));
        list.push({ key: '__none', title: 'No area yet', icon: 'help_outline', people: shown.filter(m => !m.primary_section) });
        return list.filter(g => g.people.length);
    }, [ctx.areas, filter, shown]);

    const counts = useMemo(() => ({
        setup: members.filter(needsSetup).length,
        none: members.filter(m => !m.primary_section).length,
        schedulers: members.filter(m => m.can_manage_schedule).length,
        area: (a: string) => members.filter(m => m.primary_section === a).length,
    }), [members, needsSetup]);

    /** Runs a change for one person, then reloads (pairing touches two people). */
    const run = async (userId: string, fn: () => Promise<unknown>, ok: string) => {
        setBusy(userId);
        try {
            await fn();
            onNotify(ok, 'success');
            await load();
        } catch (err) {
            onNotify(errorText(err), 'error');
        } finally {
            setBusy('');
        }
    };

    const q = { department_id: departmentId };
    const setRank = (m: RosterMember, rankId: string) =>
        run(m.user_id, () => schedFetch(`roster/${m.user_id}/rank`, { method: 'PUT', query: q, body: { rank_id: rankId } }), `Rank updated for ${personName(m)}`);
    const setArea = (m: RosterMember, section: string) =>
        run(m.user_id, () => schedFetch(`roster/${m.user_id}`, { method: 'PATCH', body: { department_id: departmentId, primary_section: section } }), `Area updated for ${personName(m)}`);
    const setPair = (m: RosterMember, pairId: string) =>
        run(m.user_id, () => schedFetch(`roster/${m.user_id}/pair`, { method: 'PUT', body: { department_id: departmentId, pair_user_id: pairId } }),
            pairId ? `${personName(m)} paired with ${personName(byId.get(pairId) || { display_name: 'them' })}` : `Pairing cleared for ${personName(m)}`);
    const remove = async (m: RosterMember) => {
        setBusy(m.user_id);
        try {
            const res = await schedFetch<{ opened_shifts?: number; cleared_drafts?: number }>(`roster/${m.user_id}`, { method: 'DELETE', query: q });
            const extra = [
                res?.opened_shifts ? `${res.opened_shifts} published shift${res.opened_shifts === 1 ? '' : 's'} opened up` : '',
                res?.cleared_drafts ? `${res.cleared_drafts} draft cell${res.cleared_drafts === 1 ? '' : 's'} cleared` : '',
            ].filter(Boolean).join(', ');
            onNotify(`${personName(m)} removed from ${departmentName}${extra ? ` · ${extra}` : ''}`, 'success');
            setConfirmRemove('');
            await load();
        } catch (err) {
            onNotify(errorText(err), 'error');
        } finally {
            setBusy('');
        }
    };

    if (loading && !members.length) return <section className="st-card"><Bones rows={5} /></section>;
    if (error && !members.length) return <LoadError message={error} onRetry={() => void load()} />;

    const rankOptions: ListOption[] = [
        { value: '', label: 'No rank', icon: 'block' },
        ...ctx.ranks.map(r => ({ value: r.id, label: r.name, sub: SENIORITY[r.seniority] || '', icon: 'military_tech' })),
    ];
    const chips: Array<{ id: Filter; label: string; count: number; icon: string }> = [
        { id: 'all', label: 'All', count: members.length, icon: 'groups' },
        ...ctx.areas.map(a => ({ id: `area:${a}` as Filter, label: a, count: counts.area(a), icon: 'location_on' })),
        ...(ctx.areas.length && counts.none ? [{ id: 'none' as Filter, label: 'No area', count: counts.none, icon: 'help_outline' }] : []),
        ...(counts.setup ? [{ id: 'setup' as Filter, label: 'Needs setup', count: counts.setup, icon: 'error_outline' }] : []),
    ];

    const row = (m: RosterMember) => {
        const name = personName(m);
        const partner = m.pair_user_id ? byId.get(m.pair_user_id) : undefined;
        const isBusy = busy === m.user_id;
        const areaOptions: ListOption[] = [
            { value: '', label: 'No area', icon: 'block' },
            ...ctx.areas.map(a => ({ value: a, label: a, icon: 'location_on' })),
            ...(m.primary_section && !ctx.areas.includes(m.primary_section) ? [{ value: m.primary_section, label: m.primary_section, icon: 'location_on' }] : []),
        ];
        const partnerOptions: ListOption[] = [
            { value: '', label: 'No partner', icon: 'link_off' },
            ...members.filter(o => o.user_id !== m.user_id).map(o => ({ value: o.user_id, label: personName(o), sub: o.rank_name || o.job_title, initials: initialsOf(personName(o)) })),
        ];
        return (
            <li key={m.user_id} className={`sc-member${isBusy ? ' is-busy' : ''}${confirmRemove === m.user_id ? ' is-confirming' : ''}`}>
                <span className={`sc-avatar sc-avatar--${m.seniority || 'none'}`} title={SENIORITY[m.seniority] || 'No rank'}>{initialsOf(name)}</span>
                <span className="sc-member__text">
                    <span className="sc-member__name">
                        {name}
                        {m.can_manage_schedule && <span className="sc-badge" title="Can manage schedules"><Icon name="event_available" />Scheduler</span>}
                    </span>
                    <span className="sc-member__sub">
                        {[m.position_title || m.job_title, ...(m.roles || []).slice(0, 1).map(r => r.name)].filter(Boolean).join(' · ') || '—'}
                    </span>
                </span>
                <span className="sc-member__props">
                    <ChipSelect
                        icon="military_tech"
                        value={m.rank_id || ''}
                        options={rankOptions}
                        onChange={v => void setRank(m, v)}
                        label={`Rank for ${name}`}
                        placeholder={ctx.ranks.length ? 'Add rank' : 'No ranks set up'}
                        disabled={isBusy || !ctx.ranks.length}
                    />
                    {ctx.areas.length > 0 && (
                        <ChipSelect
                            icon="location_on"
                            value={m.primary_section || ''}
                            options={areaOptions}
                            onChange={v => void setArea(m, v)}
                            label={`Area for ${name}`}
                            placeholder="Add area"
                            disabled={isBusy}
                        />
                    )}
                    <ChipSelect
                        icon="link"
                        value={partner ? m.pair_user_id : ''}
                        options={partnerOptions}
                        onChange={v => void setPair(m, v)}
                        label={`Partner for ${name}`}
                        placeholder="Pair"
                        display={partner ? <span className="sc-chipsel__face">{initialsOf(personName(partner))}</span> : undefined}
                        disabled={isBusy}
                    />
                </span>
                <span className="sc-member__end">
                    {confirmRemove === m.user_id ? (
                        <span className="sc-confirm">
                            <button type="button" className="st-btn st-btn--ghost st-btn--sm" onClick={() => setConfirmRemove('')}>Keep</button>
                            <button type="button" className="st-btn st-btn--danger st-btn--sm" onClick={() => void remove(m)} disabled={isBusy}>Remove</button>
                        </span>
                    ) : (
                        <button type="button" className="sc-iconbtn sc-member__remove" aria-label={`Remove ${name} from the roster`} title="Remove from roster" onClick={() => setConfirmRemove(m.user_id)} disabled={isBusy}>
                            <Icon name="person_remove" />
                        </button>
                    )}
                </span>
            </li>
        );
    };

    return (
        <Card
            className="sc-staff"
            icon="groups"
            title={<>Department staff <span className="st-count">{members.length}</span></>}
            sub={`Who can be rostered in ${departmentName}, with their rank, area and partner.`}
            actions={!showPool && (
                <button type="button" className="st-btn st-btn--primary st-btn--sm" onClick={() => setShowPool(true)}><Icon name="person_add" /> Add staff</button>
            )}
        >
            <span className="sc-staff__markclip" aria-hidden><span className="material-icons-round gx-mark">badge</span></span>

            {showPool && (
                <div className="sc-pad">
                    <AddFromPool departmentId={departmentId} areas={ctx.areas} onAdded={() => void load()} onClose={() => setShowPool(false)} onNotify={onNotify} />
                </div>
            )}

            {members.length === 0 ? (
                <Empty icon="group_add" title="No one is on this roster yet" text="Add staff from the facility to start building rosters." />
            ) : (
                <div className="sc-staff__body">
                    <div className="sc-staff__toolbar">
                        <label className="sc-staff__search">
                            <Icon name="search" />
                            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, title or rank" aria-label="Search staff" />
                            {query && <button type="button" className="sc-staff__clear" aria-label="Clear search" onClick={() => setQuery('')}><Icon name="close" /></button>}
                        </label>
                        <div className="sc-filters" role="radiogroup" aria-label="Show">
                            {chips.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={filter === c.id}
                                    className={`sc-filter${filter === c.id ? ' is-on' : ''}${c.id === 'setup' ? ' sc-filter--warn' : ''}`}
                                    onClick={() => setFilter(c.id)}
                                >
                                    <Icon name={c.icon} />{c.label}<span className="sc-filter__count">{c.count}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {shown.length === 0 ? (
                        <p className="sc-hint sc-staff__none">No one matches{query ? ` “${query.trim()}”` : ''} in this view.</p>
                    ) : groups.map(g => (
                        <section key={g.key || 'all'} className="sc-group">
                            {g.title && (
                                <h4 className="sc-group__head">
                                    <Icon name={g.icon} />{g.title}<span className="sc-group__count">{g.people.length}</span>
                                </h4>
                            )}
                            <ul className="sc-members">{g.people.map(row)}</ul>
                        </section>
                    ))}

                    {confirmRemove && (
                        <p className="sc-hint">Removing someone sends them back to the facility pool. Their published shifts from today become open shifts, and their draft shifts become gaps.</p>
                    )}

                    <div className="sc-staff__foot">
                        <span className="sc-legend"><span className="sc-legend__dot sc-avatar--senior" />Senior</span>
                        <span className="sc-legend"><span className="sc-legend__dot sc-avatar--mid" />Mid-level</span>
                        <span className="sc-legend"><span className="sc-legend__dot sc-avatar--junior" />Junior</span>
                        <span className="sc-staff__foottext">Avatar colour shows rank seniority{counts.schedulers ? ` · ${counts.schedulers} can manage schedules` : ''}</span>
                    </div>
                </div>
            )}
        </Card>
    );
}
