'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import CustomSelect from '@/components/CustomSelect';
import InternalAdminShell from '@/components/InternalAdminShell';
import { API_ENDPOINTS } from '@/lib/config';
import {
    currentUtcMonth,
    formatMonthLabel,
    formatWhen,
    initials,
    parseLeaderboardMetrics,
    parseLeaderboardUser,
    readApiError,
    shiftUtcMonth,
    type LeaderboardEntry,
    type LeaderboardFacility,
    type LeaderboardMetrics,
    type LeaderboardUserDetail,
} from '@/lib/leaderboard-metrics';
import './leaderboard.css';

const EVENTS_PAGE = 50;
const LEDGER_PREVIEW = 4;

type FacilityOption = { id: string; name: string; code: string };

function parseFacilities(raw: unknown): FacilityOption[] {
    const list = Array.isArray(raw) ? raw : [];
    return list
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const rec = item as Record<string, unknown>;
            const id = String(rec.id || rec.facility_id || '').trim();
            const name = String(rec.name || rec.facility_name || '').trim();
            const code = String(rec.code || rec.facility_code || '').trim();
            if (!id || !name) return null;
            return { id, name, code };
        })
        .filter((row): row is FacilityOption => Boolean(row))
        .sort((a, b) => a.name.localeCompare(b.name));
}

type SelectedPerson = {
    userId: string;
    facilityId: string;
    preview: LeaderboardEntry;
};

type DetailState = {
    data: LeaderboardUserDetail | null;
    loading: boolean;
    loadingMore: boolean;
    error: string | null;
    hasMore: boolean;
};

function formatScore(value: number): string {
    if (!Number.isFinite(value)) return '0';
    const abs = Math.abs(value);
    if (abs >= 100) return Math.round(value).toLocaleString('en-US');
    if (abs >= 10) return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
    return value.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

function formatDelta(value: number): string {
    const rounded = Math.round(value);
    if (rounded === 0) return '0';
    return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString('en-US')}`;
}

function deltaClass(value: number): string {
    if (value > 0.5) return 'is-up';
    if (value < -0.5) return 'is-down';
    return 'is-flat';
}

function padCount(value: number): string {
    return value < 10 ? String(value).padStart(2, '0') : value.toLocaleString('en-US');
}

function padRank(rank: number): string {
    return String(rank).padStart(2, '0');
}

function pageHasMore(detail: LeaderboardUserDetail, pageSize: number): boolean {
    if (detail.eventsTotal != null) return detail.events.length < detail.eventsTotal;
    return detail.events.length >= pageSize;
}

function withPreview(detail: LeaderboardUserDetail, preview: LeaderboardEntry): LeaderboardUserDetail {
    return {
        ...detail,
        name: detail.name && detail.name !== 'Unnamed staff' ? detail.name : preview.name,
        job_title: detail.job_title || preview.job_title,
        profile_url: detail.profile_url || preview.profile_url,
        rank: detail.rank ?? preview.rank,
        points: detail.points ?? preview.points,
    };
}

function mergeDetail(prev: LeaderboardUserDetail, next: LeaderboardUserDetail): LeaderboardUserDetail {
    const seen = new Set(prev.events.map((event) => event.id));
    const events = [...prev.events];
    for (const event of next.events) {
        if (!seen.has(event.id)) events.push(event);
    }
    return {
        ...next,
        breakdown: next.breakdown.length > 0 ? next.breakdown : prev.breakdown,
        events,
        eventsTotal: next.eventsTotal ?? prev.eventsTotal,
    };
}

function monthProgress(from: string, to: string): { pct: number; daysLeft: number; elapsedLabel: string; rangeLabel: string } | null {
    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
    const now = Date.now();
    const total = end.getTime() - start.getTime();
    const elapsed = Math.min(total, Math.max(0, now - start.getTime()));
    const daysLeft = Math.max(0, Math.ceil((end.getTime() - now) / 86_400_000));
    const inclusiveEnd = new Date(end);
    inclusiveEnd.setUTCDate(inclusiveEnd.getUTCDate() - 1);
    const day = (date: Date, withYear = false) => date.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: withYear ? 'numeric' : undefined,
        timeZone: 'UTC',
    });
    return {
        pct: (elapsed / total) * 100,
        daysLeft,
        elapsedLabel: `${Math.round(elapsed / 86_400_000)} of ${Math.round(total / 86_400_000)} days elapsed`,
        rangeLabel: `${day(start)} – ${day(inclusiveEnd, true)}`,
    };
}

function Avatar({ name, url, large = false }: { name: string; url: string; large?: boolean }) {
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        setFailed(false);
    }, [url]);

    if (url && !failed) {
        return (
            <img
                src={url}
                alt=""
                className={clsx('lb-avatar', large && 'lb-avatar--lg')}
                onError={() => setFailed(true)}
            />
        );
    }

    return (
        <span className={clsx('lb-avatar', large && 'lb-avatar--lg')} aria-hidden>
            {initials(name)}
        </span>
    );
}

function PersonPanel({
    person,
    facility,
    month,
    above,
}: {
    person: SelectedPerson;
    facility: LeaderboardFacility;
    month: string;
    above: LeaderboardEntry | null;
}) {
    const [detail, setDetail] = useState<DetailState>({
        data: null,
        loading: true,
        loadingMore: false,
        error: null,
        hasMore: false,
    });
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        setExpanded(false);
        const controller = new AbortController();
        setDetail({ data: null, loading: true, loadingMore: false, error: null, hasMore: false });
        const params = new URLSearchParams({
            facility_id: person.facilityId,
            month,
            events_limit: String(EVENTS_PAGE),
            events_offset: '0',
        });

        (async () => {
            try {
                const res = await fetch(`${API_ENDPOINTS.INTERNAL_LEADERBOARD_USER(person.userId)}?${params}`, {
                    cache: 'no-store',
                    signal: controller.signal,
                });
                const raw = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(readApiError(raw, 'Could not load this breakdown'));
                const parsed = parseLeaderboardUser(raw);
                if (!parsed) throw new Error('Unexpected leaderboard breakdown');
                const data = withPreview(parsed, person.preview);
                if (controller.signal.aborted) return;
                setDetail({
                    data,
                    loading: false,
                    loadingMore: false,
                    error: null,
                    hasMore: pageHasMore(data, EVENTS_PAGE),
                });
            } catch (err) {
                if (controller.signal.aborted) return;
                setDetail({
                    data: null,
                    loading: false,
                    loadingMore: false,
                    error: err instanceof Error ? err.message : 'Could not load this breakdown',
                    hasMore: false,
                });
            }
        })();

        return () => controller.abort();
    }, [person, month]);

    const loadMore = async () => {
        if (!detail.data || detail.loadingMore || !detail.hasMore) {
            setExpanded(true);
            return;
        }
        const offset = detail.data.events.length;
        const userId = person.userId;
        setDetail((current) => ({ ...current, loadingMore: true }));
        try {
            const params = new URLSearchParams({
                facility_id: person.facilityId,
                month,
                events_limit: String(EVENTS_PAGE),
                events_offset: String(offset),
            });
            const res = await fetch(`${API_ENDPOINTS.INTERNAL_LEADERBOARD_USER(person.userId)}?${params}`, {
                cache: 'no-store',
            });
            const raw = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(readApiError(raw, 'Could not load more ledger entries'));
            const parsed = parseLeaderboardUser(raw);
            if (!parsed) throw new Error('Unexpected leaderboard breakdown');
            setDetail((current) => {
                if (!current.data || userId !== person.userId) return current;
                const data = mergeDetail(current.data, withPreview(parsed, person.preview));
                const hasMore = parsed.eventsTotal != null
                    ? data.events.length < parsed.eventsTotal
                    : parsed.events.length >= EVENTS_PAGE;
                return { ...current, data, loadingMore: false, error: null, hasMore };
            });
            setExpanded(true);
        } catch (err) {
            setDetail((current) => ({
                ...current,
                loadingMore: false,
                error: err instanceof Error ? err.message : 'Could not load more ledger entries',
            }));
        }
    };

    const data = detail.data;
    const points = data?.points ?? person.preview.points;
    const rank = data?.rank ?? person.preview.rank;
    const name = data?.name || person.preview.name;
    const title = data?.job_title || person.preview.job_title;
    const photo = data?.profile_url || person.preview.profile_url;
    const share = facility.facility_points > 0 ? (points / facility.facility_points) * 100 : 0;
    const gap = above ? above.points - points : null;
    const breakdownMax = Math.max(...(data?.breakdown.map((row) => row.points) ?? [0]), 0);
    const events = data?.events ?? [];
    const visibleEvents = expanded ? events : events.slice(0, LEDGER_PREVIEW);
    const hidden = events.length - visibleEvents.length;

    return (
        <aside className="lb-detail lb-card" aria-label={`${name} breakdown`}>
            <div className="lb-person-top">
                <Avatar name={name} url={photo} large />
                <div>
                    <h2>{name}</h2>
                    <p>
                        {[title, facility.facility_name].filter(Boolean).join(' · ')}
                    </p>
                </div>
                <span className="lb-rankpill">Rank #{padRank(rank)}</span>
            </div>

            <div className="lb-stats2">
                <div className="lb-stat">
                    <span>Verified points</span>
                    <strong>{formatScore(points)}</strong>
                    <em>{share.toFixed(2)}% of unit aggregate</em>
                </div>
                <div className="lb-stat">
                    <span>Peer benchmark</span>
                    <strong>{facility.ranked_users > 0 ? `${rank} of ${facility.ranked_users}` : '—'}</strong>
                    <em>
                        {gap != null && gap > 0
                            ? `${formatScore(gap)} pts to rank #${padRank(above!.rank)}`
                            : rank === 1
                                ? 'Leading this facility'
                                : 'Gap to the next rank is outside this list'}
                    </em>
                </div>
            </div>

            {detail.loading && <p className="lb-note">Loading this month&apos;s points…</p>}
            {detail.error && <p className="lb-error" role="alert">{detail.error}</p>}

            {data && (
                <>
                    <section className="lb-section" aria-label="Points by event type">
                        <div className="lb-section__head">
                            <h3 className="lb-kicker">Breakdown by event type</h3>
                            <span>{data.breakdown.length} {data.breakdown.length === 1 ? 'category' : 'categories'}</span>
                        </div>
                        {data.breakdown.length === 0 ? (
                            <p className="lb-note">No event-type breakdown for this month.</p>
                        ) : (
                            <ul className="lb-break">
                                {data.breakdown.map((row) => {
                                    const pct = points > 0 ? (row.points / points) * 100 : 0;
                                    return (
                                        <li key={row.key}>
                                            <span>
                                                <span className="lb-break__label">{row.label}</span>
                                                {row.count != null ? (
                                                    <span className="lb-break__count">
                                                        {row.count.toLocaleString('en-US')} {row.count === 1 ? 'event' : 'events'}
                                                    </span>
                                                ) : null}
                                            </span>
                                            <span>
                                                <span className="lb-break__pts">{formatScore(row.points)} pts</span>
                                                <span className="lb-break__pct">{pct.toFixed(1)}%</span>
                                            </span>
                                            <span className="lb-break__track" aria-hidden>
                                                <i style={{ width: breakdownMax > 0 ? `${Math.min(100, (row.points / breakdownMax) * 100)}%` : '0%' }} />
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>

                    <section className="lb-section" aria-label="Point ledger">
                        <div className="lb-section__head">
                            <h3 className="lb-kicker">Recent telemetry ledger</h3>
                        </div>
                        {events.length === 0 ? (
                            <p className="lb-note">No ledger entries for this month.</p>
                        ) : (
                            <ul className="lb-ledger">
                                {visibleEvents.map((event) => (
                                    <li key={event.id}>
                                        <span>
                                            <span className="lb-ledger__label">{event.label}</span>
                                            {event.at ? <span className="lb-ledger__when">{formatWhen(event.at)}</span> : null}
                                        </span>
                                        <span className={clsx('lb-ledger__pts', event.points < 0 && 'is-down')}>{formatDelta(event.points)} pts</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {(hidden > 0 || detail.hasMore) && (
                            <button type="button" className="lb-audit" onClick={() => void loadMore()} disabled={detail.loadingMore}>
                                {detail.loadingMore ? 'Loading…' : 'View complete audit trail'}
                            </button>
                        )}
                    </section>
                </>
            )}
        </aside>
    );
}

function LeaderboardContent() {
    const [month, setMonth] = useState(currentUtcMonth);
    const [limit, setLimit] = useState(10);
    const [facilityId, setFacilityId] = useState('');
    const [facilities, setFacilities] = useState<FacilityOption[]>([]);
    const [board, setBoard] = useState<LeaderboardMetrics | null>(null);
    const [prior, setPrior] = useState<LeaderboardMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedFacilityId, setSelectedFacilityId] = useState('');
    const [person, setPerson] = useState<SelectedPerson | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(API_ENDPOINTS.INTERNAL_FACILITIES, { cache: 'no-store' });
                const raw = await res.json().catch(() => []);
                if (!cancelled) setFacilities(parseFacilities(raw));
            } catch {
                if (!cancelled) setFacilities([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        setBoard(null);
        const params = new URLSearchParams({ month, limit: String(limit), include_internal: 'true' });
        if (facilityId) params.set('facility_id', facilityId);

        (async () => {
            try {
                const res = await fetch(`${API_ENDPOINTS.INTERNAL_LEADERBOARD_METRICS}?${params}`, {
                    cache: 'no-store',
                    signal: controller.signal,
                });
                const raw = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(readApiError(raw, 'Could not load the leaderboard'));
                const parsed = parseLeaderboardMetrics(raw);
                if (!parsed) throw new Error('Unexpected leaderboard response');
                if (controller.signal.aborted) return;
                setBoard(parsed);
            } catch (err) {
                if (controller.signal.aborted) return;
                setError(err instanceof Error ? err.message : 'Could not load the leaderboard');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        })();

        return () => controller.abort();
    }, [month, limit, facilityId, reloadKey]);

    useEffect(() => {
        const controller = new AbortController();
        const params = new URLSearchParams({
            month: shiftUtcMonth(month, -1),
            limit: String(limit),
            include_internal: 'true',
        });
        if (facilityId) params.set('facility_id', facilityId);
        setPrior(null);
        (async () => {
            try {
                const res = await fetch(`${API_ENDPOINTS.INTERNAL_LEADERBOARD_METRICS}?${params}`, {
                    cache: 'no-store',
                    signal: controller.signal,
                });
                const raw = await res.json().catch(() => ({}));
                if (!res.ok) return;
                const parsed = parseLeaderboardMetrics(raw);
                if (!controller.signal.aborted && parsed) setPrior(parsed);
            } catch {
                if (!controller.signal.aborted) setPrior(null);
            }
        })();
        return () => controller.abort();
    }, [month, limit, facilityId]);

    const activeFacilityId = board?.facilities.some((row) => row.facility_id === selectedFacilityId)
        ? selectedFacilityId
        : (board?.facilities[0]?.facility_id ?? '');
    const facility = board?.facilities.find((row) => row.facility_id === activeFacilityId) ?? null;

    useEffect(() => {
        if (!facility) return;
        const stillVisible = person
            && person.facilityId === facility.facility_id
            && facility.top.some((entry) => entry.user_id === person.userId);
        if (stillVisible) return;
        const first = facility.top[0];
        setPerson(first
            ? { userId: first.user_id, facilityId: facility.facility_id, preview: first }
            : null);
    }, [facility, person]);

    const openPerson = (entry: LeaderboardEntry, facilityIdForPerson: string) => {
        setPerson((current) => {
            if (current?.userId === entry.user_id && current.facilityId === facilityIdForPerson) return current;
            return { userId: entry.user_id, facilityId: facilityIdForPerson, preview: entry };
        });
    };

    const people = useMemo(
        () => board?.facilities.reduce((sum, row) => sum + row.ranked_users, 0) ?? 0,
        [board],
    );
    const points = useMemo(
        () => board?.facilities.reduce((sum, row) => sum + row.facility_points, 0) ?? 0,
        [board],
    );
    const priorPoints = useMemo(
        () => prior?.facilities.reduce((sum, row) => sum + row.facility_points, 0) ?? null,
        [prior],
    );
    const priorByUser = useMemo(() => {
        const map = new Map<string, number>();
        for (const row of prior?.facilities ?? []) {
            for (const entry of row.top) map.set(`${row.facility_id}:${entry.user_id}`, entry.points);
        }
        return map;
    }, [prior]);

    const progress = board ? monthProgress(board.from, board.to) : null;
    const pointDelta = priorPoints != null ? points - priorPoints : null;
    const pointPct = priorPoints != null && priorPoints > 0 ? ((points - priorPoints) / priorPoints) * 100 : null;
    const facilityNames = board?.facilities.slice(0, 2).map((row) => row.facility_name).join(' & ') ?? '';
    const rankedSplit = board?.facilities.slice(0, 2)
        .map((row) => `${row.ranked_users.toLocaleString('en-US')} ${row.facility_name}`)
        .join(' · ') ?? '';
    const nextMonthDisabled = month >= currentUtcMonth();
    const remaining = facility ? Math.max(0, facility.ranked_users - facility.top.length) : 0;
    const above = facility && person
        ? facility.top.find((entry) => entry.rank === (person.preview.rank - 1)) ?? null
        : null;
    const avgPerPerson = people > 0 ? points / people : 0;
    const leading = board?.facilities[0] ?? null;
    const leadingShare = leading && points > 0 ? (leading.facility_points / points) * 100 : 0;
    const movement = useMemo(() => {
        let up = 0;
        let fresh = 0;
        for (const row of board?.facilities ?? []) {
            for (const entry of row.top) {
                const previous = priorByUser.get(`${row.facility_id}:${entry.user_id}`);
                if (previous == null) fresh += 1;
                else if (entry.points - previous > 0.5) up += 1;
            }
        }
        return { up, fresh };
    }, [board, priorByUser]);
    const facilityStats = useMemo(() => {
        if (!facility) return null;
        const top3Points = facility.top
            .filter((entry) => entry.rank <= 3)
            .reduce((sum, entry) => sum + entry.points, 0);
        const leader = facility.top[0] ?? null;
        let up = 0;
        let fresh = 0;
        for (const entry of facility.top) {
            const previous = priorByUser.get(`${facility.facility_id}:${entry.user_id}`);
            if (previous == null) fresh += 1;
            else if (entry.points - previous > 0.5) up += 1;
        }
        return {
            avg: facility.ranked_users > 0 ? facility.facility_points / facility.ranked_users : 0,
            top3Share: facility.facility_points > 0 ? (top3Points / facility.facility_points) * 100 : 0,
            leaderShare: leader && facility.facility_points > 0 ? (leader.points / facility.facility_points) * 100 : 0,
            leader,
            doctors: facility.top.filter((entry) => entry.is_doctor).length,
            up,
            fresh,
        };
    }, [facility, priorByUser]);

    return (
        <div className="internal-downloads-layout">
            <div className="usage-dashboard-shell internal-downloads-shell">
                <div className="usage-inner">
                    <div className="lb">
                        <header className="lb-toolbar">
                            <h1 className="lb-title">Engagement leaderboard</h1>
                            <div className="lb-controls">
                                <div className="lb-month" role="group" aria-label="Month">
                                    <button type="button" aria-label="Previous month" onClick={() => { setLimit(10); setMonth((value) => shiftUtcMonth(value, -1)); }}>
                                        <span className="material-icons-round">chevron_left</span>
                                    </button>
                                    <span className="lb-month__label">{formatMonthLabel(month)}</span>
                                    <button
                                        type="button"
                                        aria-label="Next month"
                                        disabled={nextMonthDisabled}
                                        onClick={() => { setLimit(10); setMonth((value) => shiftUtcMonth(value, 1)); }}
                                    >
                                        <span className="material-icons-round">chevron_right</span>
                                    </button>
                                </div>
                                <div className="lb-facility-select">
                                    <CustomSelect
                                        value={facilityId}
                                        onChange={(id) => {
                                            setLimit(10);
                                            setFacilityId(id);
                                            setSelectedFacilityId(id);
                                        }}
                                        placeholder="All facilities"
                                        searchPlaceholder="Search facilities…"
                                        maxH={280}
                                        dropdownMinWidth={280}
                                        options={[
                                            { label: 'All facilities', value: '' },
                                            ...facilities.map((row) => ({
                                                label: row.code ? `${row.name} (${row.code})` : row.name,
                                                value: row.id,
                                                triggerLabel: row.name,
                                            })),
                                        ]}
                                        style={{
                                            height: 36,
                                            fontSize: 12,
                                            fontWeight: 600,
                                            borderRadius: 999,
                                            padding: '0 12px',
                                            border: '1px solid var(--border-default, #e4e7ec)',
                                            background: 'var(--bg-primary, #fff)',
                                            color: 'var(--text-primary)',
                                        }}
                                    />
                                </div>
                            </div>
                        </header>

                        {loading && !board && (
                            <div className="lb-kpis" aria-hidden>
                                {[0, 1, 2, 3].map((key) => <div key={key} className="lb-skeleton lb-skeleton--kpi" />)}
                            </div>
                        )}

                        {board && (
                            <section className="lb-kpis" aria-label="Month summary">
                                <article className="lb-card lb-kpi">
                                    <h2 className="lb-kicker">Active facilities</h2>
                                    <p className="lb-kpi__value">{padCount(board.facilities.length)}</p>
                                    <p className="lb-kpi__sub">{facilityNames || 'None this month'}</p>
                                    <p className="lb-kpi__meta">With ranked points this month</p>
                                </article>
                                <article className="lb-card lb-kpi">
                                    <h2 className="lb-kicker">Ranked clinicians</h2>
                                    <p className="lb-kpi__value">{padCount(people)}</p>
                                    <p className="lb-kpi__sub">{people === 1 ? '1 staff member' : `${people.toLocaleString('en-US')} staff`}</p>
                                    <p className="lb-kpi__meta">{rankedSplit || 'No ranked staff'}</p>
                                </article>
                                <article className="lb-card lb-kpi">
                                    <h2 className="lb-kicker">Cycle points total</h2>
                                    <div className="lb-kpi__row">
                                        <p className="lb-kpi__value">{formatScore(points)}</p>
                                        {pointPct != null ? (
                                            <span className={clsx('lb-delta', deltaClass(pointPct))}>
                                                {pointPct > 0 ? '+' : ''}{pointPct.toFixed(1)}%
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className="lb-kpi__meta">
                                        {pointDelta != null
                                            ? `${formatDelta(pointDelta)} vs ${formatMonthLabel(shiftUtcMonth(month, -1))}`
                                            : formatMonthLabel(board.month || month)}
                                    </p>
                                </article>
                                <article className="lb-card lb-kpi">
                                    <h2 className="lb-kicker">Evaluation window</h2>
                                    <p className="lb-kpi__sub" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {progress?.rangeLabel || formatMonthLabel(board.month || month)}
                                    </p>
                                    <p className="lb-kpi__value" style={{ fontSize: 22 }}>{progress ? `${progress.daysLeft}d left` : '—'}</p>
                                    <p className="lb-kpi__meta">Locked at UTC midnight</p>
                                </article>
                            </section>
                        )}

                        {board && board.enabled && (
                            <section className="lb-card lb-metrics" aria-label="Engagement stats">
                                <div>
                                    <span>Avg / clinician</span>
                                    <strong>{formatScore(avgPerPerson)}</strong>
                                </div>
                                <div>
                                    <span>Leading share</span>
                                    <strong>{leading ? `${leadingShare.toFixed(1)}%` : '—'}</strong>
                                    <em>{leading?.facility_name}</em>
                                </div>
                                <div>
                                    <span>Up vs last month</span>
                                    <strong>{movement.up.toLocaleString('en-US')}</strong>
                                    <em>in the rows on screen</em>
                                </div>
                                <div>
                                    <span>New in the top</span>
                                    <strong>{movement.fresh.toLocaleString('en-US')}</strong>
                                    <em>not ranked here last month</em>
                                </div>
                            </section>
                        )}

                        {error && (
                            <div className="lb-banner" role="alert">
                                <span>{error}</span>
                                <button type="button" onClick={() => setReloadKey((value) => value + 1)}>Retry</button>
                            </div>
                        )}

                        {loading && !board && !error && (
                            <div className="lb-main" aria-busy="true" aria-label="Loading leaderboard">
                                <div className="lb-skeleton lb-skeleton--side" />
                                <div className="lb-skeleton lb-skeleton--board" />
                                <div className="lb-skeleton lb-skeleton--side" />
                            </div>
                        )}

                        {board && !board.enabled && (
                            <p className="lb-empty">Engagement points are turned off, so there is no standings board for this month.</p>
                        )}

                        {board && board.enabled && (
                            <div className="lb-main">
                                <div className="lb-side">
                                    <section className="lb-card" aria-label="Facilities">
                                        <header className="lb-card__head">
                                            <h2 className="lb-kicker">Facility breakdown</h2>
                                            <span className="lb-card__count">{board.facilities.length} {board.facilities.length === 1 ? 'unit' : 'units'}</span>
                                        </header>
                                        {board.facilities.length === 0 ? (
                                            <p className="lb-empty">No facility recorded points in {formatMonthLabel(month)}.</p>
                                        ) : (
                                            <div className="lb-facilities">
                                                {board.facilities.map((row) => {
                                                    const share = points > 0 ? (row.facility_points / points) * 100 : 0;
                                                    return (
                                                        <button
                                                            key={row.facility_id}
                                                            type="button"
                                                            className={clsx('lb-fac', row.facility_id === activeFacilityId && 'is-active')}
                                                            aria-current={row.facility_id === activeFacilityId ? 'true' : undefined}
                                                            onClick={() => setSelectedFacilityId(row.facility_id)}
                                                        >
                                                            <span className="lb-fac__name">{row.facility_name}</span>
                                                            <span className="lb-fac__pts">{formatScore(row.facility_points)}</span>
                                                            <span className="lb-fac__meta">
                                                                {row.ranked_users.toLocaleString('en-US')} {row.ranked_users === 1 ? 'clinician' : 'clinicians'}
                                                                {board.facilities.length > 1 ? ` · ${share.toFixed(1)}%` : ''}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </section>

                                    {facilityStats && (
                                        <section className="lb-card lb-facts" aria-label={`${facility?.facility_name ?? 'Facility'} stats`}>
                                            <header className="lb-card__head">
                                                <h2 className="lb-kicker">{facility?.facility_name ?? 'Facility'}</h2>
                                            </header>
                                            <dl>
                                                <div>
                                                    <dt>Avg points</dt>
                                                    <dd>{formatScore(facilityStats.avg)}</dd>
                                                </div>
                                                <div>
                                                    <dt>Leader share</dt>
                                                    <dd>{facilityStats.leader ? `${facilityStats.leaderShare.toFixed(1)}%` : '—'}</dd>
                                                </div>
                                                <div>
                                                    <dt>Top 3 share</dt>
                                                    <dd>{`${facilityStats.top3Share.toFixed(1)}%`}</dd>
                                                </div>
                                                <div>
                                                    <dt>Doctors in view</dt>
                                                    <dd>{facilityStats.doctors.toLocaleString('en-US')}</dd>
                                                </div>
                                                <div>
                                                    <dt>Points up</dt>
                                                    <dd>{facilityStats.up.toLocaleString('en-US')}</dd>
                                                </div>
                                                <div>
                                                    <dt>New in the top</dt>
                                                    <dd>{facilityStats.fresh.toLocaleString('en-US')}</dd>
                                                </div>
                                            </dl>
                                        </section>
                                    )}
                                </div>

                                <section className="lb-board lb-card" aria-label={facility ? `${facility.facility_name} standings` : 'Standings'}>
                                    {facility ? (
                                        <>
                                            <header className="lb-board__head">
                                                <div>
                                                    <h2 className="lb-board__name">{facility.facility_name}</h2>
                                                    <p className="lb-board__meta">{facility.ranked_users.toLocaleString('en-US')} ranked</p>
                                                </div>
                                                <span className="lb-sort">Sort: pts (desc)</span>
                                            </header>
                                            {facility.top.length === 0 ? (
                                                <p className="lb-empty">No ranked staff in this window.</p>
                                            ) : (
                                                <>
                                                <div className="lb-cols">
                                                    <span>Rank</span>
                                                    <span>Clinician & role</span>
                                                    <span>Points</span>
                                                    <span>Trend</span>
                                                </div>
                                                {facility.top.map((entry) => {
                                                    const previous = priorByUser.get(`${facility.facility_id}:${entry.user_id}`);
                                                    const delta = previous == null ? null : entry.points - previous;
                                                    const selected = person?.userId === entry.user_id;
                                                    return (
                                                        <button
                                                            key={entry.user_id}
                                                            type="button"
                                                            className={clsx('lb-clinician', selected && 'is-active')}
                                                            onClick={() => openPerson(entry, facility.facility_id)}
                                                        >
                                                            <span className={clsx('lb-badge', entry.rank <= 3 && `lb-badge--${entry.rank}`)}>
                                                                {padRank(entry.rank)}
                                                            </span>
                                                            <span className="lb-who">
                                                                <strong>
                                                                    {entry.name}
                                                                    {selected ? <em className="lb-selected-tag">Selected</em> : null}
                                                                    {entry.is_me ? <em className="lb-selected-tag">You</em> : null}
                                                                </strong>
                                                                <span className="lb-role">{entry.job_title || 'Staff'}</span>
                                                            </span>
                                                            <span className="lb-score">{formatScore(entry.points)}</span>
                                                            <span className={clsx('lb-trend', 'lb-delta', delta == null ? 'is-flat' : deltaClass(delta))}>
                                                                {delta == null ? '—' : formatDelta(delta)}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                                </>
                                            )}
                                            <footer className="lb-foot">
                                                <span>
                                                    Showing {facility.top.length.toLocaleString('en-US')} of {facility.ranked_users.toLocaleString('en-US')} in {facility.facility_name}
                                                </span>
                                                {remaining > 0 && limit < 50 && (
                                                    <button type="button" className="lb-link" onClick={() => setLimit(50)}>
                                                        View remaining {Math.min(remaining, 50 - facility.top.length).toLocaleString('en-US')} {remaining === 1 ? 'clinician' : 'clinicians'}
                                                    </button>
                                                )}
                                            </footer>
                                        </>
                                    ) : (
                                        <p className="lb-empty">
                                            {board.facilities.length === 0
                                                ? `No facility recorded engagement points in ${formatMonthLabel(month)}.`
                                                : 'Select a facility to see its standings.'}
                                        </p>
                                    )}
                                </section>

                                {person && facility && person.facilityId === facility.facility_id ? (
                                    <PersonPanel
                                        person={person}
                                        facility={facility}
                                        month={month}
                                        above={above}
                                    />
                                ) : (
                                    <aside className="lb-detail lb-card">
                                        <p className="lb-empty">Select a clinician to see points, event types, and the ledger.</p>
                                    </aside>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LeaderboardPage() {
    return (
        <InternalAdminShell>
            <LeaderboardContent />
        </InternalAdminShell>
    );
}
