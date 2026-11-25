'use client';

import { errorText, type ScheduleSettings } from '@/lib/scheduling-api';
import { Bones, Card, ChipsInput, LoadError, NumberInput, Row, SaveBar, Segmented, Switch, sameJson, type Notify } from './ui';
import { useSchedDoc } from './useSchedDoc';

const AREA_KINDS = [
    { value: 'none', label: 'None' },
    { value: 'zones', label: 'Zones' },
    { value: 'wards', label: 'Wards' },
    { value: 'places', label: 'Places' },
] as const;

function normalize(raw: unknown): ScheduleSettings {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ScheduleSettings>;
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    return {
        department_id: r.department_id || '',
        hours_per_week: n(r.hours_per_week),
        max_shifts_per_week: n(r.max_shifts_per_week),
        monthly_hours_cap: n(r.monthly_hours_cap),
        target_headcount: n(r.target_headcount),
        overtime_enabled: !!r.overtime_enabled,
        overtime_after_hours_week: n(r.overtime_after_hours_week),
        weekend_premium_enabled: !!r.weekend_premium_enabled,
        weekend_premium_percent: n(r.weekend_premium_percent),
        allow_self_swap: !!r.allow_self_swap,
        enable_team_pairing: !!r.enable_team_pairing,
        enforce_caps_hard: !!r.enforce_caps_hard,
        enforce_publish_lead_hard: !!r.enforce_publish_lead_hard,
        publish_lead_days: n(r.publish_lead_days),
        notify_on_open_shift: !!r.notify_on_open_shift,
        notify_on_publish: !!r.notify_on_publish,
        require_section_on_publish: !!r.require_section_on_publish,
        require_unit_on_assign: !!r.require_unit_on_assign,
        slot_pick_mode: r.slot_pick_mode || '',
        default_section: r.default_section || '',
        work_area_kind: r.work_area_kind || 'none',
        work_areas: Array.isArray(r.work_areas) ? r.work_areas.filter(a => typeof a === 'string') : [],
        updated_at: r.updated_at,
    };
}

export default function DepartmentRulesPanel({ departmentId, departmentName, onNotify }: { departmentId: string; departmentName: string; onNotify: Notify }) {
    const doc = useSchedDoc({
        path: 'settings',
        query: { department_id: departmentId },
        key: departmentId,
        normalize,
    });
    const d = doc.draft;
    const set = <K extends keyof ScheduleSettings>(key: K, value: ScheduleSettings[K]) => doc.setDraft(prev => (prev ? { ...prev, [key]: value } : prev));

    if (doc.loading && !d) return <section className="st-card"><Bones rows={5} /></section>;
    if (doc.error && !d) return <LoadError message={doc.error} onRetry={() => void doc.reload()} />;
    if (!d) return null;

    const save = async () => {
        try {
            const { updated_at: _ignored, ...body } = d;
            void _ignored;
            await doc.save({ ...body, department_id: departmentId });
            onNotify(`Rules saved for ${departmentName}`, 'success');
        } catch (err) {
            onNotify(errorText(err), 'error');
        }
    };

    return (
        <div className="st-stack">
            <Card icon="schedule" title="Hours and shifts" sub="Limits the roster checks before it is published.">
                <Row label="Hours per week" desc="The usual working week for this department.">
                    <NumberInput label="Hours per week" value={d.hours_per_week} onChange={v => set('hours_per_week', v)} suffix="h" />
                </Row>
                <Row label="Most shifts in a week">
                    <NumberInput label="Most shifts in a week" value={d.max_shifts_per_week} onChange={v => set('max_shifts_per_week', v)} />
                </Row>
                <Row label="Monthly hours cap" desc="0 means no cap.">
                    <NumberInput label="Monthly hours cap" value={d.monthly_hours_cap} onChange={v => set('monthly_hours_cap', v)} suffix="h" />
                </Row>
                <Row label="Target headcount" desc="People the department aims to have on its roster.">
                    <NumberInput label="Target headcount" value={d.target_headcount} onChange={v => set('target_headcount', v)} />
                </Row>
                <Row label="Block rosters that break these limits" desc="Off: the roster warns but can still be published.">
                    <Switch label="Block rosters that break limits" checked={d.enforce_caps_hard} onChange={v => set('enforce_caps_hard', v)} />
                </Row>
            </Card>

            <Card icon="payments" title="Overtime and weekends">
                <Row label="Track overtime" desc={d.overtime_enabled ? 'Hours past the weekly threshold count as overtime.' : 'Overtime isn’t tracked.'}>
                    <Switch label="Track overtime" checked={d.overtime_enabled} onChange={v => set('overtime_enabled', v)} />
                </Row>
                {d.overtime_enabled && (
                    <Row label="Overtime starts after">
                        <NumberInput label="Overtime starts after" value={d.overtime_after_hours_week} onChange={v => set('overtime_after_hours_week', v)} suffix="h/wk" width={112} />
                    </Row>
                )}
                <Row label="Weekend premium" desc={d.weekend_premium_enabled ? 'Weekend shifts are paid at a higher rate.' : 'Weekend shifts are paid as normal.'}>
                    <Switch label="Weekend premium" checked={d.weekend_premium_enabled} onChange={v => set('weekend_premium_enabled', v)} />
                </Row>
                {d.weekend_premium_enabled && (
                    <Row label="Premium">
                        <NumberInput label="Weekend premium percent" value={d.weekend_premium_percent} onChange={v => set('weekend_premium_percent', v)} suffix="%" max={500} />
                    </Row>
                )}
            </Card>

            <Card icon="location_on" title="Wards and work areas" sub="Where people are placed on each shift.">
                <Row label="Area type" stack>
                    <Segmented label="Area type" value={d.work_area_kind as (typeof AREA_KINDS)[number]['value']} options={[...AREA_KINDS]} onChange={v => set('work_area_kind', v)} />
                </Row>
                {d.work_area_kind !== 'none' && (
                    <>
                        <Row label="Areas" desc="Type a name and press Enter, e.g. TRIAGE, RED, ORANGE." stack>
                            <ChipsInput label="Work areas" values={d.work_areas} onChange={v => set('work_areas', v)} placeholder="Add an area…" upper />
                        </Row>
                        <Row label="Default area" desc="Used for anyone without their own area.">
                            <select className="st-input sc-select" value={d.default_section} onChange={e => set('default_section', e.target.value)} aria-label="Default area">
                                <option value="">None</option>
                                {d.work_areas.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </Row>
                        <Row label="Every shift needs an area to publish">
                            <Switch label="Require an area to publish" checked={d.require_section_on_publish} onChange={v => set('require_section_on_publish', v)} />
                        </Row>
                        <Row label="Ask for an area when assigning">
                            <Switch label="Require an area when assigning" checked={d.require_unit_on_assign} onChange={v => set('require_unit_on_assign', v)} />
                        </Row>
                    </>
                )}
            </Card>

            <Card icon="swap_horiz" title="Swaps and publishing">
                <Row label="Staff can start swaps" desc="Let staff ask each other to swap shifts.">
                    <Switch label="Staff can start swaps" checked={d.allow_self_swap} onChange={v => set('allow_self_swap', v)} />
                </Row>
                <Row label="Team pairing" desc="Warn when paired staff end up on different shifts.">
                    <Switch label="Team pairing" checked={d.enable_team_pairing} onChange={v => set('enable_team_pairing', v)} />
                </Row>
                <Row label="Publish the roster at least" desc="How early before the period starts.">
                    <NumberInput label="Publish lead days" value={d.publish_lead_days} onChange={v => set('publish_lead_days', v)} suffix="days" width={112} />
                </Row>
                <Row label="Block late publishing" desc="Off: a late roster warns but can still be published.">
                    <Switch label="Block late publishing" checked={d.enforce_publish_lead_hard} onChange={v => set('enforce_publish_lead_hard', v)} />
                </Row>
                <Row label="Notify staff when the roster is published">
                    <Switch label="Notify on publish" checked={d.notify_on_publish} onChange={v => set('notify_on_publish', v)} />
                </Row>
                <Row label="Notify staff about open shifts">
                    <Switch label="Notify on open shift" checked={d.notify_on_open_shift} onChange={v => set('notify_on_open_shift', v)} />
                </Row>
            </Card>

            <SaveBar dirty={!sameJson(d, doc.saved)} saving={doc.saving} onSave={() => void save()} onDiscard={doc.discard} />
        </div>
    );
}
