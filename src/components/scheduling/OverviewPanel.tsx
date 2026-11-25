'use client';

import { useCallback, useEffect, useState } from 'react';
import { errorText, schedFetch, type RosterOverview } from '@/lib/scheduling-api';
import '@/components/glass/glass-kit.css';
import { KpiTile, Ring, type KpiTone } from '@/components/glass/kpi';
import { Bones, Icon, LoadError } from './ui';

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

function nextMonth(): string {
    const d = new Date();
    return monthKey(new Date(d.getFullYear(), d.getMonth() + 1, 1));
}

const STATUS: Record<string, { label: string; icon: string; tone: KpiTone; step: number; hint: string }> = {
    not_started: { label: 'Not started', icon: 'radio_button_unchecked', tone: 'slate', step: 0, hint: 'No roster covers this month yet.' },
    draft: { label: 'Draft', icon: 'edit_note', tone: 'amber', step: 1, hint: 'A draft is in progress. Staff can’t see it until it is published.' },
    published: { label: 'Published', icon: 'task_alt', tone: 'mint', step: 2, hint: 'Staff can see their shifts.' },
};

const STEPS = ['Not started', 'Draft', 'Published'];

/** Where the roster is on its way to staff: three stops, the current one filled. */
function RosterSteps({ step }: { step: number }) {
    return (
        <span className="sc-steps" role="img" aria-label={`Roster stage: ${STEPS[step] ?? 'unknown'}`}>
            {STEPS.map((name, i) => (
                <span key={name} className={`sc-steps__dot${i < step ? ' is-done' : ''}${i === step ? ' is-now' : ''}`} title={name} />
            ))}
        </span>
    );
}

const shortDate = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';

export default function OverviewPanel({ departmentId, departmentName, onOpen }: {
    departmentId: string;
    departmentName: string;
    onOpen: (tab: 'staff' | 'attendance' | 'setup') => void;
}) {
    const [month, setMonth] = useState(nextMonth);
    const [data, setData] = useState<RosterOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            setData(await schedFetch<RosterOverview>('roster-overview', { query: { department_id: departmentId, month } }));
        } catch (err) {
            setError(errorText(err));
        } finally {
            setLoading(false);
        }
    }, [departmentId, month]);

    useEffect(() => {
        void (async () => { await load(); })();
    }, [load]);

    const shift = (delta: number) => {
        const [y, m] = month.split('-').map(Number);
        setMonth(monthKey(new Date(y, m - 1 + delta, 1)));
    };
    const label = new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const st = STATUS[data?.status || ''] || { label: data?.status || '—', icon: 'help_outline', tone: 'slate' as KpiTone, step: -1, hint: '' };
    const av = data?.availability;
    const pct = av && av.total ? Math.round((av.replied / av.total) * 100) : 0;
    const monthName = label.split(' ')[0];
    const startsIn = data ? (data.days_until_start > 0 ? `Starts in ${data.days_until_start} day${data.days_until_start === 1 ? '' : 's'}` : 'Under way') : '';
    const rosterFoot = data?.has_unpublished_changes
        ? 'Edited since publishing'
        : data?.published_at
          ? `Published ${shortDate(data.published_at)}`
          : data?.last_edited_at
            ? `Last edited ${shortDate(data.last_edited_at)}`
            : 'Nothing drafted yet';

    return (
        <div className="st-stack sc-ovpage">
            <div className="sc-monthbar">
                <button type="button" className="sc-monthbar__nav" aria-label="Previous month" onClick={() => shift(-1)}><Icon name="chevron_left" /></button>
                <span className="sc-monthbar__month">{label}</span>
                <button type="button" className="sc-monthbar__nav" aria-label="Next month" onClick={() => shift(1)}><Icon name="chevron_right" /></button>
                {startsIn && <span className="sc-monthbar__sub"><Icon name="schedule" />{startsIn}</span>}
                {month !== nextMonth() && <button type="button" className="st-btn st-btn--sm st-btn--ghost sc-monthbar__reset" onClick={() => setMonth(nextMonth())}>Back to next month</button>}
            </div>

            {loading && !data ? (
                <div className="sc-overview">{[0, 1, 2].map(i => <section key={i} className="st-card"><Bones rows={2} /></section>)}</div>
            ) : error && !data ? (
                <LoadError message={error} onRetry={() => void load()} />
            ) : data ? (
                <div className={`hx-kpis sc-overview${loading ? ' is-loading' : ''}`} aria-label={`${departmentName} roster for ${label}`}>
                    <KpiTile
                        tone={data.has_unpublished_changes ? 'amber' : st.tone}
                        icon={st.icon}
                        watermark="calendar_month"
                        label="Roster"
                        value={st.label}
                        foot={rosterFoot}
                        chart={st.step >= 0 ? <RosterSteps step={st.step} /> : null}
                        hint={data.has_unpublished_changes ? 'Edited since it was published. Publish again so staff see the changes.' : st.hint}
                    />
                    <KpiTile
                        tone="sky"
                        icon="forum"
                        watermark="event_available"
                        label="Availability replies"
                        value={av?.asked ? <>{av.replied}<span className="sc-ov__of">/{av.total}</span></> : 'Not asked'}
                        foot={av?.asked ? (av.closes_at ? `Closes ${shortDate(av.closes_at)}` : 'Open for replies') : 'Set a window in Roster settings'}
                        chart={av?.asked ? <Ring pct={pct}><span className="sc-ring-label">{pct}%</span></Ring> : null}
                        hint="Staff who have said when they can work this month."
                    />
                    <KpiTile
                        tone="mint"
                        icon="beach_access"
                        watermark="flight_takeoff"
                        label="On leave"
                        value={data.on_leave}
                        foot={`${data.on_leave === 1 ? 'Person' : 'People'} away in ${monthName}`}
                        chart={null}
                        hint={`Roster members with approved leave in ${monthName}.`}
                    />
                </div>
            ) : null}

            <nav className="sc-jump" aria-label="Go to">
                {([
                    ['staff', 'groups', 'Department staff'],
                    ['attendance', 'how_to_reg', 'Attendance'],
                    ['setup', 'tune', 'Setup'],
                ] as const).map(([tab, icon, title]) => (
                    <button key={tab} type="button" className="sc-jump__link" onClick={() => onOpen(tab)}>
                        <Icon name={icon} />{title}<Icon name="arrow_forward" className="sc-jump__go" />
                    </button>
                ))}
            </nav>
        </div>
    );
}
