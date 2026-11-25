'use client';

import {
    errorText,
    type DaysOffRule,
    type PairingValue,
    type RosterApproval,
    type RosterSettings,
    type Seniority,
} from '@/lib/scheduling-api';
import { Bones, Card, ChipsInput, Icon, LoadError, NumberInput, Row, SaveBar, Segmented, Switch, sameJson, type Notify } from './ui';
import { useSchedDoc } from './useSchedDoc';

const SENIORITY: Array<{ value: Seniority; label: string }> = [
    { value: 'senior', label: 'Senior' },
    { value: 'mid', label: 'Mid' },
    { value: 'junior', label: 'Junior' },
];
const PAIRS = ['senior+senior', 'senior+mid', 'senior+junior', 'mid+mid', 'mid+junior', 'junior+junior'];
const PAIR_OPTIONS: Array<{ value: PairingValue; label: string }> = [
    { value: 'required', label: 'Required' },
    { value: 'allowed', label: 'Allowed' },
    { value: 'not_allowed', label: 'Not allowed' },
];
const APPROVAL_TYPES: Array<{ type: RosterApproval['type']; label: string; icon: string }> = [
    { type: 'roster', label: 'Roster', icon: 'event_available' },
    { type: 'leave', label: 'Leave', icon: 'beach_access' },
    { type: 'swap', label: 'Swaps', icon: 'swap_horiz' },
];

function normalize(raw: unknown): RosterSettings {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<RosterSettings>;
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const rest = (r.rest || {}) as Partial<RosterSettings['rest']>;
    const review = (r.staff_review || {}) as Partial<RosterSettings['staff_review']>;
    const sub = (r.submission || {}) as Partial<RosterSettings['submission']>;
    const approvals = Array.isArray(r.approvals) ? r.approvals : [];
    return {
        department_id: r.department_id,
        preparation_period: r.preparation_period || 'monthly',
        workstation: { building: r.workstation?.building || '', ward_unit: r.workstation?.ward_unit || '' },
        ranks: Array.isArray(r.ranks) ? r.ranks.map(k => ({ id: k.id || '', name: k.name || '', seniority: k.seniority || 'mid' })) : [],
        require_senior_rank_id: r.require_senior_rank_id || null,
        pairing: r.pairing && typeof r.pairing === 'object' ? { ...r.pairing } : {},
        max_hours_per_shift: n(r.max_hours_per_shift),
        excess_hours: { enabled: !!r.excess_hours?.enabled, method: r.excess_hours?.method || 'carry_forward' },
        rest: {
            min_rest_hours: n(rest.min_rest_hours),
            max_consecutive_days: n(rest.max_consecutive_days),
            min_days_off: n(rest.min_days_off),
            max_days_off: n(rest.max_days_off),
            weekend_day_off: !!rest.weekend_day_off,
            days_off_rules: Array.isArray(rest.days_off_rules)
                ? rest.days_off_rules.map(d => ({ consecutive_shifts: n(d.consecutive_shifts), rest_days_after: n(d.rest_days_after), shift_codes: Array.isArray(d.shift_codes) ? d.shift_codes : [] }))
                : [],
        },
        // Always show the three approval types, even when the server has none saved yet.
        approvals: APPROVAL_TYPES.map(({ type }) => {
            const found = approvals.find(a => a.type === type);
            return { type, mode: found?.mode || 'any', approvers: Array.isArray(found?.approvers) ? found.approvers : [] };
        }),
        staff_review: { enabled: !!review.enabled, opens_days_before: n(review.opens_days_before), deadline_days_before: n(review.deadline_days_before) },
        submission: {
            availability_opens_days_before: n(sub.availability_opens_days_before),
            availability_deadline_days_before: n(sub.availability_deadline_days_before),
            annual_leave_opens_days_before_year_end: n(sub.annual_leave_opens_days_before_year_end),
            annual_leave_deadline_days_before_year_end: n(sub.annual_leave_deadline_days_before_year_end),
        },
    };
}

function Step({ n }: { n: number }) {
    return <span className="sc-step">{n}</span>;
}

export default function RosterSettingsPanel({ departmentId, departmentName, onNotify }: { departmentId: string; departmentName: string; onNotify: Notify }) {
    const doc = useSchedDoc({
        path: 'roster-settings',
        query: { department_id: departmentId },
        key: departmentId,
        normalize,
    });
    const d = doc.draft;
    const patch = (fn: (prev: RosterSettings) => RosterSettings) => doc.setDraft(prev => (prev ? fn(prev) : prev));

    if (doc.loading && !d) return <section className="st-card"><Bones rows={6} /></section>;
    if (doc.error && !d) return <LoadError message={doc.error} onRetry={() => void doc.reload()} />;
    if (!d) return null;

    const save = async () => {
        const blankRank = d.ranks.find(k => !k.name.trim());
        if (blankRank) {
            onNotify('Give every rank a name before saving.', 'error');
            return;
        }
        try {
            await doc.save({ ...d, department_id: departmentId }, { query: { department_id: departmentId } });
            onNotify(`Roster settings saved for ${departmentName}`, 'success');
        } catch (err) {
            onNotify(errorText(err), 'error');
        }
    };

    const setRest = <K extends keyof RosterSettings['rest']>(k: K, v: RosterSettings['rest'][K]) => patch(p => ({ ...p, rest: { ...p.rest, [k]: v } }));
    const setRule = (i: number, rule: Partial<DaysOffRule>) =>
        setRest('days_off_rules', d.rest.days_off_rules.map((r, j) => (j === i ? { ...r, ...rule } : r)));
    const setApproval = (type: RosterApproval['type'], next: Partial<RosterApproval>) =>
        patch(p => ({ ...p, approvals: p.approvals.map(a => (a.type === type ? { ...a, ...next } : a)) }));

    return (
        <div className="st-stack">
            <Card icon="event_repeat" title={<><Step n={1} />Preparation period</>} sub="How often a new roster is made for this department.">
                <Row label="Make a roster" stack>
                    <Segmented
                        label="Preparation period"
                        value={d.preparation_period}
                        options={[{ value: 'monthly', label: 'Monthly' }, { value: 'weekly', label: 'Weekly' }, { value: 'daily', label: 'Daily' }]}
                        onChange={v => patch(p => ({ ...p, preparation_period: v }))}
                    />
                </Row>
            </Card>

            <Card icon="apartment" title={<><Step n={2} />Workstation</>} sub="Cubicles and areas are set under Department rules → Wards and work areas.">
                <div className="sc-grid2">
                    <label className="st-field">
                        <span className="st-field__label">Building</span>
                        <input className="st-input" value={d.workstation.building} onChange={e => patch(p => ({ ...p, workstation: { ...p.workstation, building: e.target.value } }))} placeholder="e.g. Main block" />
                    </label>
                    <label className="st-field">
                        <span className="st-field__label">Ward / unit</span>
                        <input className="st-input" value={d.workstation.ward_unit} onChange={e => patch(p => ({ ...p, workstation: { ...p.workstation, ward_unit: e.target.value } }))} placeholder="e.g. Ward 3" />
                    </label>
                </div>
            </Card>

            <Card
                icon="military_tech"
                title={<><Step n={3} />Staff ranks</>}
                sub="Ranks with their seniority. A rank that people still hold can’t be removed."
                actions={(
                    <button type="button" className="st-btn st-btn--sm" onClick={() => patch(p => ({ ...p, ranks: [...p.ranks, { id: '', name: '', seniority: 'mid' }] }))}>
                        <Icon name="add" /> Add rank
                    </button>
                )}
            >
                {d.ranks.length === 0 ? (
                    <p className="sc-hint sc-pad">No ranks yet. Add ranks like “Senior Nursing Officer” or “Staff Nurse”.</p>
                ) : (
                    <ul className="sc-list">
                        {d.ranks.map((rank, i) => (
                            <li key={rank.id || `new-${i}`} className="sc-list__row">
                                <input
                                    className="st-input"
                                    value={rank.name}
                                    placeholder="Rank name"
                                    aria-label="Rank name"
                                    onChange={e => patch(p => ({ ...p, ranks: p.ranks.map((k, j) => (j === i ? { ...k, name: e.target.value } : k)) }))}
                                />
                                <Segmented
                                    label="Seniority"
                                    value={rank.seniority}
                                    options={SENIORITY}
                                    onChange={v => patch(p => ({ ...p, ranks: p.ranks.map((k, j) => (j === i ? { ...k, seniority: v } : k)) }))}
                                />
                                <button
                                    type="button"
                                    className="st-iconbtn st-btn"
                                    aria-label={`Remove ${rank.name || 'rank'}`}
                                    title="Remove rank"
                                    onClick={() => patch(p => ({
                                        ...p,
                                        ranks: p.ranks.filter((_, j) => j !== i),
                                        require_senior_rank_id: p.require_senior_rank_id === rank.id ? null : p.require_senior_rank_id,
                                    }))}
                                >
                                    <Icon name="delete_outline" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card icon="supervisor_account" title={<><Step n={4} />Senior cover</>} sub="Every working shift needs someone at this rank’s seniority or higher.">
                <Row label="Needs at least">
                    <select
                        className="st-input sc-select"
                        aria-label="Senior cover rank"
                        value={d.require_senior_rank_id || ''}
                        onChange={e => patch(p => ({ ...p, require_senior_rank_id: e.target.value || null }))}
                    >
                        <option value="">No requirement</option>
                        {d.ranks.filter(k => k.id).map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                    </select>
                </Row>
                {d.ranks.some(k => !k.id) && <p className="sc-hint sc-pad">Save new ranks first to use them here.</p>}
            </Card>

            <Card icon="people" title={<><Step n={5} />Pairing</>} sub="Which seniorities can work a shift together.">
                <div className="sc-matrix">
                    {PAIRS.map(key => {
                        const [a, b] = key.split('+');
                        return (
                            <div key={key} className="sc-matrix__row">
                                <span className="sc-matrix__pair"><span className={`sc-sen sc-sen--${a}`}>{a}</span>+<span className={`sc-sen sc-sen--${b}`}>{b}</span></span>
                                <Segmented
                                    label={`${a} with ${b}`}
                                    value={d.pairing[key] || 'allowed'}
                                    options={PAIR_OPTIONS}
                                    onChange={v => patch(p => ({ ...p, pairing: { ...p.pairing, [key]: v } }))}
                                />
                            </div>
                        );
                    })}
                </div>
            </Card>

            <Card icon="timelapse" title={<><Step n={6} />Shift rules</>}>
                <Row label="Longest shift" desc="Warns when a single shift runs longer. 0 means no limit.">
                    <NumberInput label="Longest shift hours" value={d.max_hours_per_shift} onChange={v => patch(p => ({ ...p, max_hours_per_shift: v }))} suffix="h" step={0.5} />
                </Row>
                <Row label="Excess hours" desc="What happens to hours worked over the plan.">
                    <Switch label="Handle excess hours" checked={d.excess_hours.enabled} onChange={v => patch(p => ({ ...p, excess_hours: { ...p.excess_hours, enabled: v } }))} />
                </Row>
                {d.excess_hours.enabled && (
                    <Row label="Apply them" stack>
                        <Segmented
                            label="Excess hours method"
                            value={d.excess_hours.method}
                            options={[{ value: 'carry_forward', label: 'To the next roster' }, { value: 'spread', label: 'Spread over several' }]}
                            onChange={v => patch(p => ({ ...p, excess_hours: { ...p.excess_hours, method: v } }))}
                        />
                    </Row>
                )}
            </Card>

            <Card icon="bedtime" title={<><Step n={7} />Rest and days off</>}>
                <Row label="Rest between shifts"><NumberInput label="Minimum rest hours" value={d.rest.min_rest_hours} onChange={v => setRest('min_rest_hours', v)} suffix="h" step={0.5} /></Row>
                <Row label="Most days in a row"><NumberInput label="Most consecutive days" value={d.rest.max_consecutive_days} onChange={v => setRest('max_consecutive_days', v)} suffix="days" width={112} /></Row>
                <Row label="Days off per period" desc="Fewest and most.">
                    <span className="sc-inline">
                        <NumberInput label="Fewest days off" value={d.rest.min_days_off} onChange={v => setRest('min_days_off', v)} />
                        <span className="sc-hint">to</span>
                        <NumberInput label="Most days off" value={d.rest.max_days_off} onChange={v => setRest('max_days_off', v)} />
                    </span>
                </Row>
                <Row label="Give a weekend day off"><Switch label="Weekend day off" checked={d.rest.weekend_day_off} onChange={v => setRest('weekend_day_off', v)} /></Row>
                <div className="sc-sub">
                    <div className="sc-sub__head">
                        <span>Rest after a run of shifts</span>
                        <button type="button" className="st-btn st-btn--sm st-btn--ghost" onClick={() => setRest('days_off_rules', [...d.rest.days_off_rules, { consecutive_shifts: 3, rest_days_after: 2, shift_codes: ['N'] }])}>
                            <Icon name="add" /> Add rule
                        </button>
                    </div>
                    {d.rest.days_off_rules.length === 0 ? (
                        <p className="sc-hint">e.g. after 3 night shifts in a row, 2 days off.</p>
                    ) : d.rest.days_off_rules.map((rule, i) => (
                        <div key={i} className="sc-rule">
                            <span className="sc-hint">After</span>
                            <NumberInput label="Shifts in a row" value={rule.consecutive_shifts} onChange={v => setRule(i, { consecutive_shifts: v })} min={1} width={72} />
                            <ChipsInput label="Shift codes" values={rule.shift_codes} onChange={v => setRule(i, { shift_codes: v })} placeholder="Codes, e.g. N" upper />
                            <span className="sc-hint">shifts, give</span>
                            <NumberInput label="Days off after" value={rule.rest_days_after} onChange={v => setRule(i, { rest_days_after: v })} min={1} width={72} />
                            <span className="sc-hint">days off</span>
                            <button type="button" className="st-iconbtn st-btn" aria-label="Remove rule" onClick={() => setRest('days_off_rules', d.rest.days_off_rules.filter((_, j) => j !== i))}>
                                <Icon name="close" />
                            </button>
                        </div>
                    ))}
                </div>
            </Card>

            <Card icon="task_alt" title={<><Step n={8} />Approvals</>} sub="Who signs off each kind of request.">
                {APPROVAL_TYPES.map(({ type, label, icon }) => {
                    const a = d.approvals.find(x => x.type === type)!;
                    return (
                        <div key={type} className="sc-approval">
                            <span className="sc-approval__label"><Icon name={icon} size={17} />{label}</span>
                            <ChipsInput label={`${label} approvers`} values={a.approvers} onChange={v => setApproval(type, { approvers: v })} placeholder="Add an approver…" />
                            <Segmented label={`${label} approval mode`} value={a.mode} options={[{ value: 'any', label: 'Any one' }, { value: 'all', label: 'All' }]} onChange={v => setApproval(type, { mode: v })} />
                        </div>
                    );
                })}
            </Card>

            <Card icon="rate_review" title={<><Step n={9} />Staff review</>} sub="Let staff look over the draft roster before it is published.">
                <Row label="Staff review"><Switch label="Staff review" checked={d.staff_review.enabled} onChange={v => patch(p => ({ ...p, staff_review: { ...p.staff_review, enabled: v } }))} /></Row>
                {d.staff_review.enabled && (
                    <Row label="Review window" desc="Days before the roster starts.">
                        <span className="sc-inline">
                            <span className="sc-hint">Opens</span>
                            <NumberInput label="Review opens days before" value={d.staff_review.opens_days_before} onChange={v => patch(p => ({ ...p, staff_review: { ...p.staff_review, opens_days_before: v } }))} />
                            <span className="sc-hint">closes</span>
                            <NumberInput label="Review closes days before" value={d.staff_review.deadline_days_before} onChange={v => patch(p => ({ ...p, staff_review: { ...p.staff_review, deadline_days_before: v } }))} />
                        </span>
                    </Row>
                )}
            </Card>

            <Card icon="inbox" title={<><Step n={10} />Submission windows</>} sub="When staff can send availability and annual leave requests.">
                <Row label="Availability" desc="Days before the roster period starts.">
                    <span className="sc-inline">
                        <span className="sc-hint">Opens</span>
                        <NumberInput label="Availability opens" value={d.submission.availability_opens_days_before} onChange={v => patch(p => ({ ...p, submission: { ...p.submission, availability_opens_days_before: v } }))} />
                        <span className="sc-hint">closes</span>
                        <NumberInput label="Availability closes" value={d.submission.availability_deadline_days_before} onChange={v => patch(p => ({ ...p, submission: { ...p.submission, availability_deadline_days_before: v } }))} />
                    </span>
                </Row>
                <Row label="Annual leave" desc="Days before the year ends.">
                    <span className="sc-inline">
                        <span className="sc-hint">Opens</span>
                        <NumberInput label="Annual leave opens" value={d.submission.annual_leave_opens_days_before_year_end} onChange={v => patch(p => ({ ...p, submission: { ...p.submission, annual_leave_opens_days_before_year_end: v } }))} />
                        <span className="sc-hint">closes</span>
                        <NumberInput label="Annual leave closes" value={d.submission.annual_leave_deadline_days_before_year_end} onChange={v => patch(p => ({ ...p, submission: { ...p.submission, annual_leave_deadline_days_before_year_end: v } }))} />
                    </span>
                </Row>
            </Card>

            <SaveBar dirty={!sameJson(d, doc.saved)} saving={doc.saving} onSave={() => void save()} onDiscard={doc.discard} />
        </div>
    );
}
