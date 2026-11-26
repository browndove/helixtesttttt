'use client';

import '@/components/glass/glass-kit.css';
import './analytics-glass.css';
import { DotGrid, Gauge, KpiTile, LadderBars, MiniBars, PulseLine, Ring } from '@/components/glass/kpi';
import { normalizeCallMetricsFromUsage } from '@/lib/analytics/call-metrics';
import {
    buildMinutesSpreadForKpi,
    formatDurationSeconds,
    formatMinutes,
    minutesSinceMidnightToClock,
    pickTypicalMinutes,
    pickTypicalSeconds,
    resolveCriticalAckMinutes,
    resolveCriticalCoveragePercent,
    resolveReadMinutes,
    resolveSignInMinutes,
    resolveSignOutMinutes,
    typicalSecondsRange,
    type MinutesDistribution,
} from '@/lib/analytics/distribution-metrics';
import { formatAvgMinutesPerUserDay } from '@/lib/analytics/feature-usage-metrics';
import { acceptanceRatePercent, type TransferMetricsData } from '@/lib/analytics/transfer-metrics';
import type { AnalyticsData } from '@/lib/analytics/types';
import {
    formatRoleName,
    getCallSummary,
    getTopOutboundRole,
    hasAnsweredDuration,
    truncateLabel,
} from '@/components/analytics/ugmc-dashboard/clinical-operations/components/call-metrics-helpers';
import { ClockDial, SpreadBox } from './illustrations';
import { useCountUp } from './chart-kit';

const DASH = '—';

function num(v: unknown): number {
    if (v === null || v === undefined || v === '') return 0;
    const n = typeof v === 'string' ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
}

function pct(v: number): string {
    return `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
}

function compact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

/** Small labelled figures under a tile's value (e.g. Q1 / Median / Q3). */
function StatStrip({ items }: { items: { label: string; value: string }[] }) {
    if (!items.length) return null;
    return (
        <>
            {items.map(item => (
                <span key={item.label} className="an-stat">
                    <span className="an-stat__value">{item.value}</span>
                    <span className="an-stat__label">{item.label}</span>
                </span>
            ))}
        </>
    );
}

/** Plain figures like "1,284", "12.5%" or "3.4K"; anything else (times, durations, "—") is shown as-is. */
const COUNTABLE = /^(\d{1,3}(?:,\d{3})*|\d+)(\.\d+)?(%|K|M)?$/;

/** Counts a plain figure up from its previous value, keeping its decimals, separators and suffix. */
function CountText({ text }: { text: string }) {
    const match = COUNTABLE.exec(text);
    const target = match ? parseFloat(match[1].replace(/,/g, '') + (match[2] ?? '')) : 0;
    const shown = useCountUp(target);
    if (!match) return <>{text}</>;
    const decimals = match[2] ? match[2].length - 1 : 0;
    const body = match[1].includes(',') || target >= 1000
        ? shown.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : shown.toFixed(decimals);
    return <span className="an-count">{body}{match[3] ?? ''}</span>;
}

/** Long figures (durations, clock times) step down a size so they never run into the chart. */
function fit(value: string) {
    const content = <CountText text={value} />;
    return value.length > 5 ? <span className="an-value--long">{content}</span> : content;
}

function RingValue({ value }: { value: number }) {
    return <Ring pct={value}><span className="an-ring-label">{Math.round(value)}%</span></Ring>;
}

function minutesBox(dist?: MinutesDistribution | null) {
    if (!dist) return null;
    const values = [dist.min_minutes, dist.q1_minutes, dist.median_minutes, dist.q3_minutes, dist.max_minutes].map(num);
    return values.some(v => v > 0) ? <SpreadBox min={values[0]} q1={values[1]} median={values[2]} q3={values[3]} max={values[4]} /> : null;
}

/* ── Usage Summary ───────────────────────────────────────────── */

export function UsageKpis({
    data,
    loading,
    dailyUsersAvg,
    avgMinutesPerUserDay,
}: {
    data: AnalyticsData | null;
    loading: boolean;
    dailyUsersAvg: number | null;
    avgMinutesPerUserDay: number | null;
}) {
    const activityRate = data?.active_users_rate_percent ?? 0;
    const escalationRate = data?.escalation_rate_percent ?? 0;
    const roleFillRate = data?.role_fill_rate_percent ?? 0;
    const highEscalation = escalationRate > 15;
    return (
        <section className="hx-kpis an-kpis" aria-label="Usage summary metrics">
            <KpiTile
                tone="sky"
                icon="groups"
                label="Active users"
                value={fit(loading ? DASH : compact(data?.active_users_count ?? 0))}
                foot={loading ? DASH : `${pct(activityRate)} of ${(data?.registered_staff_count ?? 0).toLocaleString()} registered staff`}
                chart={<DotGrid pct={loading ? 0 : activityRate} label={`${activityRate.toFixed(1)}% activity rate`} />}
                hint="Staff members active on the platform out of total registered staff."
            />
            <KpiTile
                tone="mint"
                icon="login"
                label="Daily users"
                value={fit(loading || dailyUsersAvg == null ? DASH : compact(Math.round(dailyUsersAvg)))}
                foot={!loading && avgMinutesPerUserDay != null ? `${formatAvgMinutesPerUserDay(avgMinutesPerUserDay)} avg time in app / day` : 'Average daily sign-ins'}
                chart={<PulseLine />}
                hint="Average number of users that open the app at least once per day."
            />
            <KpiTile
                tone={highEscalation ? 'rose' : 'amber'}
                alert={!loading && highEscalation}
                icon="trending_up"
                label="Escalation rate"
                value={fit(loading ? DASH : pct(Number(escalationRate.toFixed(1))))}
                foot={loading ? DASH : `${compact(data?.escalated_critical_messages ?? 0)} critical messages escalated`}
                chart={<RingValue value={loading ? 0 : escalationRate} />}
                hint="Share of critical messages that triggered escalation notifications."
            />
            <KpiTile
                tone="indigo"
                icon="verified_user"
                label="Role coverage"
                value={fit(loading ? DASH : pct(Number(roleFillRate.toFixed(1))))}
                foot={loading ? DASH : `${data?.filled_roles ?? 0} of ${data?.total_roles ?? 0} roles filled · target 70%`}
                chart={<Gauge pct={loading ? 0 : Math.round(roleFillRate)} target={70} />}
                hint="Defined roles currently filled with assigned staff."
            />
        </section>
    );
}

/* ── Response Performance ────────────────────────────────────── */

/** Critical messages are expected to be near-fully covered. */
const CRITICAL_COVERAGE_TARGET = 90;

export function ResponseKpis({ data }: { data: AnalyticsData | null }) {
    const root = (data ?? undefined) as Record<string, unknown> | undefined;
    const readAll = resolveReadMinutes(root, 'all');
    const readCritical = resolveReadMinutes(root, 'critical');
    const ack = resolveCriticalAckMinutes(root);
    const readPct = resolveCriticalCoveragePercent(data, 'read');
    const ackPct = resolveCriticalCoveragePercent(data, 'acknowledged');
    const critical = num(data?.critical_messages);
    const escalated = num(data?.escalated_critical_messages);
    const escalationRate = num(data?.escalation_rate_percent);
    const fmt = (d?: MinutesDistribution) => {
        const m = pickTypicalMinutes(d);
        return data && m != null ? formatMinutes(m) : DASH;
    };
    const spread = (d?: MinutesDistribution) => buildMinutesSpreadForKpi(d).inline.filter(s => s.label !== 'Median');
    const coverageFoot = (p: number | null, verb: string) =>
        p == null ? (critical > 0 ? `${critical.toLocaleString()} critical messages` : 'No critical messages') : `${pct(p)} of critical ${verb}`;

    return (
        <section className="hx-kpis an-kpis" aria-label="Response performance metrics">
            <KpiTile
                tone="sky"
                icon="mark_email_read"
                label="Median read time"
                value={fit(fmt(readAll))}
                foot={num(data?.total_messages) > 0 ? `${num(data?.total_messages).toLocaleString()} messages` : 'No volume'}
                chart={minutesBox(readAll) ?? <PulseLine />}
                extra={<StatStrip items={spread(readAll)} />}
                hint="Median time to read all messages. The box spans the middle 50% (Q1–Q3)."
            />
            <KpiTile
                tone="rose"
                icon="priority_high"
                label="Critical read time"
                value={fit(fmt(readCritical))}
                foot={coverageFoot(readPct, 'read')}
                chart={readPct != null ? <RingValue value={readPct} /> : minutesBox(readCritical)}
                extra={<StatStrip items={spread(readCritical)} />}
                alert={readPct != null && readPct < CRITICAL_COVERAGE_TARGET}
                hint="Median time to read critical messages; the ring shows the share of critical messages read."
            />
            <KpiTile
                tone="mint"
                icon="task_alt"
                label="Acknowledgment time"
                value={fit(fmt(ack))}
                foot={coverageFoot(ackPct, 'acknowledged')}
                chart={ackPct != null ? <RingValue value={ackPct} /> : minutesBox(ack)}
                extra={<StatStrip items={spread(ack)} />}
                hint="Median time to acknowledge critical messages before expiry; the ring shows the share acknowledged."
            />
            <KpiTile
                tone="amber"
                icon="stairs"
                label="Escalation rate"
                value={fit(data && data.escalation_rate_percent != null ? pct(Number(escalationRate.toFixed(1))) : DASH)}
                foot={escalated > 0 ? `${escalated.toLocaleString()} of ${critical.toLocaleString()} critical escalated` : 'None escalated'}
                chart={<MiniBars values={[critical, escalated]} labels={['Critical', 'Escalated']} />}
                extra={<StatStrip items={[{ label: 'Critical', value: critical.toLocaleString() }, { label: 'Escalated', value: escalated.toLocaleString() }]} />}
                hint="Share of critical messages that escalated."
            />
        </section>
    );
}

/* ── Staffing & Coverage ─────────────────────────────────────── */

function clock(minutes: number | null): string {
    if (minutes == null || minutes <= 0) return DASH;
    return minutesSinceMidnightToClock(minutes).replace(' UTC', '');
}

export function StaffingKpis({ data }: { data: AnalyticsData | null }) {
    const root = (data ?? undefined) as Record<string, unknown> | undefined;
    const signIn = resolveSignInMinutes(root);
    const signOut = resolveSignOutMinutes(root);
    const activeRate = data?.active_users_rate_percent ?? 0;
    const fillRate = data?.role_fill_rate_percent ?? 0;
    const criticalTotal = data?.critical_total_roles ?? 0;
    const criticalFilled = data?.critical_filled_roles ?? 0;
    const criticalRate = data?.critical_role_fill_rate_percent ?? 0;
    return (
        <section className="hx-kpis an-kpis" aria-label="Staffing and coverage metrics">
            <KpiTile
                tone="sky"
                icon="groups"
                label="Active users"
                value={fit(data ? (data.active_users_count ?? 0).toLocaleString() : DASH)}
                foot={data ? `${pct(Number(activeRate.toFixed(1)))} of registered staff · ${(data.total_messages ?? 0).toLocaleString()} msgs` : DASH}
                chart={<DotGrid pct={activeRate} />}
                hint="Unique staff active in the current timeframe out of total staff."
            />
            <KpiTile
                tone="indigo"
                icon="badge"
                label="Role fill rate"
                value={fit(data ? pct(Number(fillRate.toFixed(1))) : DASH)}
                foot={data ? `${data.filled_roles ?? 0} of ${data.total_roles ?? 0} roles filled` : DASH}
                chart={<Gauge pct={Math.round(fillRate)} target={70} />}
                hint="Defined roles currently assigned to staff."
            />
            <KpiTile
                tone={criticalTotal > 0 && criticalFilled < criticalTotal ? 'rose' : 'mint'}
                icon="health_and_safety"
                label="Critical role fill"
                value={fit(data ? pct(Number(criticalRate.toFixed(1))) : DASH)}
                foot={data ? `${criticalFilled} of ${criticalTotal} critical roles filled` : DASH}
                chart={<LadderBars total={criticalTotal} missing={Math.max(0, criticalTotal - criticalFilled)} />}
                hint="Critical response roles currently filled. Each bar is one critical role; red ones are unfilled."
            />
            <KpiTile
                tone="mint"
                icon="schedule"
                label="Average sign-in"
                value={fit(clock(signIn))}
                foot={`Sign-out ${clock(signOut)} · UTC`}
                chart={<ClockDial start={signIn} end={signOut} />}
                hint="Typical UTC clock time staff sign into (hand) and out of (arc end) their roles."
            />
        </section>
    );
}

/* ── Transfer Insight ────────────────────────────────────────── */

export function TransferKpis({ data, loading, periodLabel }: { data: TransferMetricsData | null; loading: boolean; periodLabel: string }) {
    const total = data?.total_transfer_requests ?? 0;
    const pending = data?.transfer_requests_pending ?? 0;
    const accepted = data?.transfer_requests_accepted ?? 0;
    const declined = data?.transfer_requests_declined ?? 0;
    const outbound = data?.transfer_requests_outbound ?? 0;
    const inbound = data?.transfer_requests_inbound ?? 0;
    const acceptance = data ? acceptanceRatePercent(data) : 0;
    const show = (n: number) => (loading ? DASH : n.toLocaleString());
    return (
        <section className="hx-kpis an-kpis" aria-label="Transfer metrics">
            <KpiTile
                tone="sky"
                icon="swap_horiz"
                label="Total requests"
                value={fit(show(total))}
                foot={periodLabel}
                chart={<MiniBars values={[accepted, declined, pending]} labels={['Accepted', 'Declined', 'Pending']} />}
                hint="All transfer requests in the selected range. Bars: accepted, declined, pending."
            />
            <KpiTile
                tone="amber"
                icon="hourglass_top"
                label="Pending"
                value={fit(show(pending))}
                foot={pending > 0 ? 'Awaiting a decision' : 'Nothing waiting'}
                chart={<RingValue value={total > 0 ? (pending / total) * 100 : 0} />}
                alert={!loading && pending > 0}
                hint="Requests not yet accepted or declined, as a share of all requests."
            />
            <KpiTile
                tone="mint"
                icon="check_circle"
                label="Accepted"
                value={fit(show(accepted))}
                foot={loading ? DASH : `${acceptance.toFixed(1)}% acceptance rate`}
                chart={<RingValue value={acceptance} />}
                hint="Requests marked accepted in this period."
            />
            <KpiTile
                tone="indigo"
                icon="north_east"
                label="Outbound"
                value={fit(show(outbound))}
                foot={inbound > 0 ? `${inbound.toLocaleString()} inbound` : 'Sent to other facilities'}
                chart={<MiniBars values={[outbound, inbound]} labels={['Outbound', 'Inbound']} />}
                hint="Requests sent to other facilities, against inbound requests received."
            />
        </section>
    );
}

/* ── Call Insight ────────────────────────────────────────────── */

export function CallKpis({ data }: { data: AnalyticsData | null }) {
    const cm = normalizeCallMetricsFromUsage(data);
    const { total, answered, unanswered, answerRate, hasCallData } = getCallSummary(cm);
    const displayTotal = cm?.total_calls_made ?? data?.total_calls_made ?? total;
    const answeredDist = cm?.answered;
    const typical = pickTypicalSeconds(answeredDist);
    const hasDuration = hasAnsweredDuration(cm);
    const top = getTopOutboundRole(cm);
    const topRole = top ? { name: formatRoleName(top.role_name), calls: num(top.total_calls_made) } : null;
    const secs = (k: keyof NonNullable<typeof answeredDist>) => num(answeredDist?.[k]);

    return (
        <section className="hx-kpis an-kpis" aria-label="Call metrics">
            <KpiTile
                tone="sky"
                icon="call"
                label="Total calls placed"
                value={fit(data ? num(displayTotal).toLocaleString() : DASH)}
                foot={hasCallData ? `${answered.toLocaleString()} answered · ${unanswered.toLocaleString()} unanswered` : 'Across all roles'}
                chart={<MiniBars values={[answered, unanswered]} labels={['Answered', 'Unanswered']} />}
                hint="All call sessions started in the selected period."
            />
            <KpiTile
                tone="mint"
                icon="timer"
                label="Avg call duration"
                value={fit(hasDuration && typical != null ? formatDurationSeconds(typical) : DASH)}
                foot={hasDuration ? `Typical ${typicalSecondsRange(secs('q1_duration_seconds'), secs('q3_duration_seconds'))}` : 'Answered calls only'}
                chart={hasDuration
                    ? <SpreadBox
                        min={secs('min_duration_seconds')}
                        q1={secs('q1_duration_seconds')}
                        median={secs('median_duration_seconds')}
                        q3={secs('q3_duration_seconds')}
                        max={secs('max_duration_seconds')}
                      />
                    : <PulseLine />}
                hint="Median duration of answered calls; the box spans the middle 50%."
            />
            <KpiTile
                tone={answerRate != null && hasCallData && answerRate < 50 ? 'rose' : 'amber'}
                icon="phone_callback"
                label="Answer rate"
                value={fit(answerRate != null && hasCallData ? `${answerRate.toFixed(1)}%` : DASH)}
                foot={hasCallData ? `${unanswered.toLocaleString()} outbound calls unanswered` : 'Not available'}
                chart={<RingValue value={answerRate != null && hasCallData ? answerRate : 0} />}
                hint="Share of resolved calls that connected. Still-ringing calls are excluded."
            />
            <KpiTile
                tone="indigo"
                icon="record_voice_over"
                label="Top calling role"
                value={fit(topRole ? topRole.calls.toLocaleString() : DASH)}
                foot={topRole ? truncateLabel(topRole.name, 30) : 'No role data'}
                chart={<RingValue value={topRole && total > 0 ? (topRole.calls / total) * 100 : 0} />}
                hint="Role with the highest outbound call volume; the ring is its share of all calls."
            />
        </section>
    );
}
