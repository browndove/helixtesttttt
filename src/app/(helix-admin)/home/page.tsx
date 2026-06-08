'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './home-overview.css';
import { parseBulkUploadHistoryResponse, type BulkUploadHistoryEntry } from '@/lib/bulk-upload-history';
import { fetchAllStaffPayload } from '@/lib/fetch-all-staff';
import { countCriticalRolesWithoutEscalation } from '@/lib/role-escalation-ladder';
import { useTeamPresenceRoster } from '@/lib/useTeamPresenceRoster';

type SimpleItem = Record<string, unknown>;
type ActivityItem = { id: string; title: string; detail: string; time: string; tone?: 'default' | 'critical' | 'info' };
type SignedInStaff = { id: string; name: string; initials: string; role: string; when: string; status: 'online' | 'recent' | 'away' };

const plusJakarta = Plus_Jakarta_Sans({
    subsets: ['latin'],
    weight: ['400', '600', '700'],
    variable: '--font-plus-jakarta',
});

type DeptMessageMixTone = 'm1' | 'm2' | 'm3' | 'm4';

type DeptMessageMixRow = {
    label: string;
    count: number;
    pct: number;
    tone: DeptMessageMixTone;
};

const DEPT_MIX_TONES: DeptMessageMixTone[] = ['m1', 'm2', 'm3', 'm4'];


const TEAM_PRESENCE_MAX = 10;

function buildDepartmentMessageMix(analytics: Record<string, unknown>): {
    rows: DeptMessageMixRow[];
    total: number;
    windowDays: number;
} {
    const windowDays = Number(analytics.window_days ?? 30);
    const safeWindowDays = Number.isFinite(windowDays) && windowDays > 0 ? Math.round(windowDays) : 30;

    const byDept = new Map<string, number>();

    const roleMetrics = Array.isArray(analytics.role_metrics) ? analytics.role_metrics : [];
    for (const row of roleMetrics) {
        if (!row || typeof row !== 'object') continue;
        const rec = row as Record<string, unknown>;
        const name = String(rec.department_name || rec.department || '').trim() || 'Unassigned';
        const n = Number(rec.total_messages ?? 0);
        if (!Number.isFinite(n) || n <= 0) continue;
        byDept.set(name, (byDept.get(name) || 0) + n);
    }

    if (byDept.size === 0) {
        const deptMetrics = Array.isArray(analytics.department_metrics) ? analytics.department_metrics : [];
        for (const row of deptMetrics) {
            if (!row || typeof row !== 'object') continue;
            const rec = row as Record<string, unknown>;
            const name = String(rec.department_name || '').trim() || 'Unassigned';
            const n = Number(
                rec.total_messages
                ?? rec.messages_sent
                ?? rec.critical_messages_sent
                ?? 0,
            );
            if (!Number.isFinite(n) || n <= 0) continue;
            byDept.set(name, (byDept.get(name) || 0) + n);
        }
    }

    const sorted = [...byDept.entries()].sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((sum, [, count]) => sum + count, 0);
    if (total <= 0) {
        return { rows: [], total: 0, windowDays: safeWindowDays };
    }

    const topN = 3;
    const top = sorted.slice(0, topN);
    const otherCount = sorted.slice(topN).reduce((sum, [, count]) => sum + count, 0);
    const entries: { label: string; count: number }[] = top.map(([label, count]) => ({ label, count }));
    if (otherCount > 0) {
        entries.push({ label: 'Other', count: otherCount });
    } else if (entries.length === 0 && sorted.length > 0) {
        entries.push({ label: sorted[0][0], count: sorted[0][1] });
    }

    const capped = entries.slice(0, 4);
    const pcts = capped.map((e) => Math.round((e.count / total) * 100));
    const pctSum = pcts.reduce((a, b) => a + b, 0);
    if (pctSum !== 100 && pcts.length > 0) {
        pcts[0] += 100 - pctSum;
    }

    return {
        rows: capped.map((e, i) => ({
            label: e.label,
            count: e.count,
            pct: pcts[i] ?? 0,
            tone: DEPT_MIX_TONES[i % DEPT_MIX_TONES.length],
        })),
        total,
        windowDays: safeWindowDays,
    };
}

function getList(raw: unknown, keys: string[]): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== 'object') return [];
    const rec = raw as Record<string, unknown>;
    for (const k of keys) {
        const v = rec[k];
        if (Array.isArray(v)) return v;
    }
    return [];
}

function readTotal(raw: unknown, fallback: number): number {
    if (!raw || typeof raw !== 'object') return fallback;
    const rec = raw as Record<string, unknown>;
    const candidate = rec.total ?? rec.count ?? rec.total_count;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
    if (typeof candidate === 'string' && candidate.trim() !== '' && Number.isFinite(Number(candidate))) {
        return Number(candidate);
    }
    return fallback;
}

/** Active (enabled) staff accounts vs total directory rows — all-time, not a rolling window. */
function countStaffAccountMetrics(staffItems: unknown[]): { active: number; total: number; percent: number } {
    let active = 0;
    let total = 0;
    for (const row of staffItems) {
        if (!row || typeof row !== 'object') continue;
        total += 1;
        const rec = row as Record<string, unknown>;
        const status = String(rec.status || rec.account_status || '').trim().toLowerCase();
        if (status === 'active') active += 1;
    }
    const percent = total > 0 ? Math.round((active / total) * 100) : 0;
    return { active, total, percent };
}

function toWhenLabel(dateLike: string): string {
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return 'just now';
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) > 1 ? 's' : ''} ago`;
}

function greetingByTime(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

function todayLabelLong(): string {
    return new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function todayLabelShort(): string {
    return new Date().toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function summarizeImport(entry: BulkUploadHistoryEntry): ActivityItem {
    return {
        id: `import-${entry.id}`,
        title: entry.status === 'error' ? 'Import failed' : 'Bulk upload completed',
        detail: `${entry.file} · ${entry.records.toLocaleString()} records`,
        time: entry.date,
        tone: entry.status === 'error' ? 'critical' : 'info',
    };
}


export default function HomePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [staffCount, setStaffCount] = useState(0);
    const [patientCount, setPatientCount] = useState(0);
    const [failedImports24h, setFailedImports24h] = useState(0);
    const [teamsWithoutLeadCount, setTeamsWithoutLeadCount] = useState(0);
    const [teamsWithoutMembersCount, setTeamsWithoutMembersCount] = useState(0);
    const [deptsWithoutNameCount, setDeptsWithoutNameCount] = useState(0);
    const [recent, setRecent] = useState<ActivityItem[]>([]);
    const [firstName, setFirstName] = useState('');
    const [facilityName, setFacilityName] = useState('');
    const [twoFactorAdoption, setTwoFactorAdoption] = useState<{ enabled: number; total: number }>({ enabled: 0, total: 0 });
    const [criticalRoleFill, setCriticalRoleFill] = useState<{ filled: number; total: number; percent: number }>({ filled: 0, total: 0, percent: 0 });
    const [avgCriticalAckMinutes, setAvgCriticalAckMinutes] = useState(0);
    const [activeSessions, setActiveSessions] = useState(0);
    const {
        members: signedInStaff,
        onlineCount,
        loading: teamPresenceLoading,
    } = useTeamPresenceRoster({ max: TEAM_PRESENCE_MAX });
    const [departmentMessageMix, setDepartmentMessageMix] = useState<DeptMessageMixRow[]>([]);
    const [departmentMessagesTotal, setDepartmentMessagesTotal] = useState(0);
    const [analyticsWindowDays, setAnalyticsWindowDays] = useState(30);
    const [criticalRolesWithoutEscalation, setCriticalRolesWithoutEscalation] = useState(0);
    const [criticalRolesTotal, setCriticalRolesTotal] = useState(0);
    const [staffAccountMetric, setStaffAccountMetric] = useState<{ active: number; total: number; percent: number }>({
        active: 0,
        total: 0,
        percent: 0,
    });

    const fetchHomeData = useCallback(async () => {
        setLoading(true);
        try {
            const [
                meRes,
                hospitalRes,
                staffBundleRes,
                patientRes,
                teamsRes,
                departmentsRes,
                escalationRes,
                rolesRes,
                auditRes,
                historyStaffRes,
                historyPatientRes,
                sessionsRes,
                analyticsRes,
            ] = await Promise.all([
                fetch('/api/proxy/auth/me', { credentials: 'include' }),
                fetch('/api/proxy/hospital', { credentials: 'include' }),
                fetchAllStaffPayload({ credentials: 'include' }),
                fetch('/api/proxy/patients?page_size=20&page_id=1', { credentials: 'include' }),
                fetch('/api/proxy/teams', { credentials: 'include' }),
                fetch('/api/proxy/departments', { credentials: 'include' }),
                fetch('/api/proxy/escalation-policies', { credentials: 'include' }),
                fetch('/api/proxy/roles', { credentials: 'include' }),
                fetch('/api/proxy/audit-logs?page_size=5&page_id=1', { credentials: 'include' }),
                fetch('/api/proxy/bulk-upload-history?kind=staff&page_size=20', { credentials: 'include' }),
                fetch('/api/proxy/bulk-upload-history?kind=patient&page_size=20', { credentials: 'include' }),
                fetch('/api/proxy/auth/sessions', { credentials: 'include' }),
                fetch('/api/proxy/analytics?days=30', { credentials: 'include' }),
            ]);

            const [
                meJson,
                hospitalJson,
                staffBundle,
                patientJson,
                teamsJson,
                departmentsJson,
                escalationJson,
                rolesJson,
                auditJson,
                historyStaffJson,
                historyPatientJson,
                sessionsJson,
                analyticsJson,
            ] = await Promise.all([
                meRes.ok ? meRes.json() : Promise.resolve(null),
                hospitalRes.ok ? hospitalRes.json() : Promise.resolve(null),
                Promise.resolve(staffBundleRes),
                patientRes.ok ? patientRes.json() : Promise.resolve(null),
                teamsRes.ok ? teamsRes.json() : Promise.resolve(null),
                departmentsRes.ok ? departmentsRes.json() : Promise.resolve(null),
                escalationRes.ok ? escalationRes.json() : Promise.resolve(null),
                rolesRes.ok ? rolesRes.json() : Promise.resolve(null),
                auditRes.ok ? auditRes.json() : Promise.resolve(null),
                historyStaffRes.ok ? historyStaffRes.json() : Promise.resolve(null),
                historyPatientRes.ok ? historyPatientRes.json() : Promise.resolve(null),
                sessionsRes.ok ? sessionsRes.json() : Promise.resolve(null),
                analyticsRes.ok ? analyticsRes.json() : Promise.resolve(null),
            ]);

            if (analyticsJson && typeof analyticsJson === 'object') {
                const a = analyticsJson as Record<string, unknown>;
                const filled = Number(a.critical_filled_roles ?? 0);
                const total = Number(a.critical_total_roles ?? 0);
                const percent = Number(a.critical_role_fill_rate_percent ?? 0);
                setCriticalRoleFill({
                    filled: Number.isFinite(filled) ? filled : 0,
                    total: Number.isFinite(total) ? total : 0,
                    percent: Number.isFinite(percent) ? Math.round(percent) : 0,
                });
                const ack = Number(a.avg_critical_ack_minutes ?? 0);
                setAvgCriticalAckMinutes(Number.isFinite(ack) ? ack : 0);

                const deptMix = buildDepartmentMessageMix(a);
                setDepartmentMessageMix(deptMix.rows);
                setDepartmentMessagesTotal(deptMix.total);
                setAnalyticsWindowDays(deptMix.windowDays);
            } else {
                setDepartmentMessageMix([]);
                setDepartmentMessagesTotal(0);
                setAnalyticsWindowDays(30);
            }

            if (meJson && typeof meJson === 'object') {
                const root = meJson as Record<string, unknown>;
                const user = (root.user && typeof root.user === 'object' ? root.user : root) as Record<string, unknown>;
                const fn = String(user.first_name || '').trim();
                const full = String(user.name || '').trim();
                setFirstName(fn || full.split(/\s+/)[0] || '');
            }
            if (hospitalJson && typeof hospitalJson === 'object') {
                const h = hospitalJson as Record<string, unknown>;
                const name = String(h.name || h.facility_name || h.hospital_name || '').trim();
                if (name) setFacilityName(name);
            }

            const staffPayload =
                staffBundle && typeof staffBundle === 'object' && (staffBundle as { ok?: boolean }).ok
                    ? (staffBundle as { data: unknown }).data
                    : null;
            const staffItems = getList(staffPayload, ['items', 'data', 'staff']);
            const patientItems = getList(patientJson, ['items', 'data', 'patients']);
            const teamItems = getList(teamsJson, ['items', 'data', 'teams']) as SimpleItem[];
            const departmentItems = getList(departmentsJson, ['items', 'data', 'departments']) as SimpleItem[];
            const escalationItems = getList(escalationJson, ['items', 'data', 'policies', 'results']) as SimpleItem[];
            const roleItems = getList(rolesJson, ['items', 'data', 'roles', 'results']) as SimpleItem[];
            const escalationGap = countCriticalRolesWithoutEscalation(roleItems, escalationItems);
            setCriticalRolesWithoutEscalation(escalationGap.withoutEscalation);
            setCriticalRolesTotal(escalationGap.criticalTotal);

            setStaffCount(readTotal(staffPayload, staffItems.length));
            setStaffAccountMetric(countStaffAccountMetrics(staffItems));

            let twoFactorEnabled = 0;
            for (const s of staffItems) {
                const rec = s as Record<string, unknown>;
                if (rec.otp_enabled === true || rec.two_factor_enabled === true || rec.twoFactorEnabled === true) twoFactorEnabled += 1;
            }
            setTwoFactorAdoption({ enabled: twoFactorEnabled, total: staffItems.length });

            setPatientCount(readTotal(patientJson, patientItems.length));

            const teamsWithoutLead = teamItems.filter(t => !String(t.lead_id || '').trim()).length;
            const teamsWithoutMembers = teamItems.filter(t => {
                const c = Number(t.member_count ?? 0);
                return !Number.isFinite(c) || c <= 0;
            }).length;
            const departmentsWithoutName = departmentItems.filter(d => !String(d.name || d.department_name || '').trim()).length;
            setTeamsWithoutLeadCount(teamsWithoutLead);
            setTeamsWithoutMembersCount(teamsWithoutMembers);
            setDeptsWithoutNameCount(departmentsWithoutName);

            const historyRows = [
                ...parseBulkUploadHistoryResponse(historyStaffJson),
                ...parseBulkUploadHistoryResponse(historyPatientJson),
            ];
            const now = Date.now();
            const failedRows = historyRows.filter(h => {
                if (h.status !== 'error') return false;
                const ts = Date.parse(h.date);
                return !Number.isNaN(ts) && now - ts <= 24 * 60 * 60 * 1000;
            });
            setFailedImports24h(failedRows.length);

            const auditList = getList(auditJson, ['items', 'data', 'logs']) as SimpleItem[];
            const auditRecent: ActivityItem[] = auditList.slice(0, 4).map((row, idx) => {
                const action = String(row.action || 'update').replace(/_/g, ' ');
                const entity = String(row.entity_type || row.category || 'record').replace(/_/g, ' ');
                const ts = String(row.timestamp || row.created_at || '');
                return {
                    id: `audit-${idx}`,
                    title: `${action.charAt(0).toUpperCase() + action.slice(1)} ${entity}`,
                    detail: String(row.details || row.message || 'Admin action recorded'),
                    time: toWhenLabel(ts),
                    tone: 'default',
                };
            });

            const importRecent = historyRows.slice(0, 2).map(summarizeImport);
            setRecent([...importRecent, ...auditRecent].slice(0, 4));

            const sessionList = getList(sessionsJson, ['items', 'data', 'sessions']);
            setActiveSessions(sessionList.length);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchHomeData(); }, [fetchHomeData]);

    const escalationNeedsAttention = criticalRolesWithoutEscalation > 0;
    const facilityShort = facilityName || 'Your facility';
    const teamPresenceLoadingCombined = loading || teamPresenceLoading;


    const twoFactorPct = twoFactorAdoption.total > 0
        ? Math.round((twoFactorAdoption.enabled / twoFactorAdoption.total) * 100)
        : 0;
    const ackMin = avgCriticalAckMinutes;
    const ackLabel = ackMin <= 0 ? '—' : ackMin < 1 ? '<1 min' : ackMin < 60 ? `${Math.round(ackMin)} min` : `${(ackMin / 60).toFixed(1)} hr`;

    const healthRows = useMemo(() => [
        {
            icon: 'bolt',
            label: 'Critical ack time',
            value: loading ? '—' : ackLabel,
            sub: '30 day avg.',
            sem: ackMin > 0 && ackMin > 15 ? 'negative' as const : ackMin > 0 ? 'positive' as const : 'neutral' as const,
        },
        {
            icon: 'lock',
            label: '2FA adoption',
            value: loading ? '—' : `${twoFactorPct}%`,
            sub: `${twoFactorAdoption.enabled} / ${twoFactorAdoption.total} accounts`,
            sem: twoFactorPct >= 80 ? 'positive' as const : twoFactorPct >= 50 ? 'neutral' as const : 'negative' as const,
        },
        {
            icon: 'sync',
            label: 'Data sync',
            value: loading ? '—' : failedImports24h > 0 ? `${failedImports24h} failed` : 'Clean',
            sub: 'Last 24 hours',
            sem: failedImports24h > 0 ? 'negative' as const : 'positive' as const,
        },
        {
            icon: 'devices',
            label: 'Sessions',
            value: loading ? '—' : activeSessions.toLocaleString(),
            sub: 'Concurrent sign-ins',
            sem: 'neutral' as const,
        },
    ], [loading, ackLabel, ackMin, twoFactorPct, twoFactorAdoption, failedImports24h, activeSessions]);

    const quickActions = [
        { label: 'Create role', icon: 'add_circle_outline', href: '/roles' },
        { label: 'Invite teammate', icon: 'person_add_alt', href: '/staff' },
        { label: 'New provider team', icon: 'groups', href: '/provider-teams' },
        { label: 'Escalation paths', icon: 'timeline', href: '/escalation' },
    ];

    const formatMetric = (n: number, suffix = '') => (loading ? '—' : `${n.toLocaleString()}${suffix}`);

    const deptMixCount = departmentMessageMix.length;
    const deptMixAria = departmentMessageMix
        .map((m) => `${m.label}: ${m.count.toLocaleString()} messages (${m.pct}%)`)
        .join(', ');

    return (
        <div className={`app-main home-overview-app-main ${plusJakarta.className}`}>
            <div className="top-bar">
                <div className="top-bar-left">
                    <span>Home</span>
                    <span className="top-bar-sep">·</span>
                    <span className="top-bar-page">Overview</span>
                </div>
                <div className="top-bar-actions">
                    <span className="top-bar-date">{todayLabelShort()}</span>
                    <button type="button" className="btn-sync" onClick={() => fetchHomeData()}>
                        <span className="material-icons-round btn-sync-icon">sync</span>
                        Refresh
                    </button>
                </div>
            </div>

            <main className="page">
                <div className="dash">
                    <header className="dash-head dash-reveal">
                        <div>
                            <h1 className="dash-title">Dashboard overview</h1>
                            <p className="dash-sub">
                                {greetingByTime()}{firstName ? `, ${firstName}` : ''} · {facilityShort} ·{' '}
                                <span className="dash-sub__muted">{todayLabelLong()}</span>
                            </p>
                        </div>
                        <div className="dash-head__actions">
                            <button type="button" className="dash-btn dash-btn--outline">
                                <span className="material-icons-round">summarize</span>
                                Report
                            </button>
                            <button type="button" className="dash-btn dash-btn--outline" onClick={() => router.push('/staff')}>
                                <span className="material-icons-round">group_add</span>
                                Invite
                            </button>
                            <button type="button" className="dash-btn dash-btn--outline" onClick={() => router.push('/external-communication')}>
                                <span className="material-icons-round">swap_horiz</span>
                                Transfer
                            </button>
                        </div>
                    </header>

                    <section className="dash-wallets dash-reveal" aria-label="Key metrics">
                        <article className="dash-wallet">
                            <p className="dash-wallet__label">Active patients</p>
                            <p className="dash-wallet__hint">Net enrolled</p>
                            <p className="dash-wallet__balance">{formatMetric(patientCount)}</p>
                            <p className="dash-wallet__foot">Compared to prior 7 days</p>
                            <button type="button" className="dash-link" onClick={() => router.push('/patients')}>
                                View details <span className="material-icons-round">arrow_forward</span>
                            </button>
                        </article>
                        <article className="dash-wallet">
                            <p className="dash-wallet__label">Active staff</p>
                            <p className="dash-wallet__hint">Active rate</p>
                            <p className="dash-wallet__balance">{formatMetric(staffAccountMetric.percent, '%')}</p>
                            <p className="dash-wallet__foot">
                                {loading
                                    ? '—'
                                    : `${staffAccountMetric.active.toLocaleString()} / ${staffAccountMetric.total.toLocaleString()} staff accounts · All time`}
                            </p>
                            <button type="button" className="dash-link" onClick={() => router.push('/staff')}>
                                View details <span className="material-icons-round">arrow_forward</span>
                            </button>
                        </article>
                        <article className="dash-wallet">
                            <p className="dash-wallet__label">Critical coverage</p>
                            <p className="dash-wallet__hint">Role fill rate</p>
                            <p className="dash-wallet__balance">{formatMetric(criticalRoleFill.percent, '%')}</p>
                            <p className="dash-wallet__foot">
                                Target 90% · {criticalRoleFill.filled.toLocaleString()} / {criticalRoleFill.total.toLocaleString()} roles
                            </p>
                            <button type="button" className="dash-link" onClick={() => router.push('/escalation')}>
                                View details <span className="material-icons-round">arrow_forward</span>
                            </button>
                        </article>
                        <article className={`dash-wallet${escalationNeedsAttention ? ' dash-wallet--warn' : ''}`}>
                            <p className="dash-wallet__label">Escalations</p>
                            <p className="dash-wallet__hint">Critical roles · no ladder</p>
                            <p className={`dash-wallet__balance${escalationNeedsAttention ? ' dash-wallet__balance--alert' : ''}`}>
                                {formatMetric(criticalRolesWithoutEscalation)}
                            </p>
                            {escalationNeedsAttention && (
                                <div className="dash-wallet__row">
                                    <span className="dash-wallet__flag">
                                        <span className="material-icons-round">warning</span>
                                        {criticalRolesWithoutEscalation} critical role{criticalRolesWithoutEscalation === 1 ? '' : 's'} need ladders
                                    </span>
                                </div>
                            )}
                            <p className="dash-wallet__foot">
                                {loading
                                    ? '—'
                                    : criticalRolesTotal > 0
                                        ? criticalRolesWithoutEscalation > 0
                                            ? `${criticalRolesWithoutEscalation} of ${criticalRolesTotal.toLocaleString()} critical roles without escalation ladders`
                                            : `All ${criticalRolesTotal.toLocaleString()} critical roles have ladders`
                                        : 'No critical roles configured'}
                            </p>
                            <button type="button" className="dash-link" onClick={() => router.push('/escalation')}>
                                View details <span className="material-icons-round">arrow_forward</span>
                            </button>
                        </article>
                    </section>

                    <section className="dash-mid dash-reveal" aria-label="Analytics">
                        <div className="dash-card dash-card--lg">
                            <h2 className="dash-card__title">Messages by department</h2>
                            <p className="dash-card__lede">
                                {loading ? (
                                    <>Loading message breakdown…</>
                                ) : deptMixCount > 0 ? (
                                    <>
                                        <strong>{departmentMessagesTotal.toLocaleString()} messages</strong> across{' '}
                                        <strong>{deptMixCount} department{deptMixCount === 1 ? '' : 's'}</strong> at {facilityShort}
                                    </>
                                ) : (
                                    <>No department message data for {facilityShort}</>
                                )}
                            </p>
                            <p className="dash-card__muted">
                                {analyticsWindowDays}-day window · share of facility volume
                            </p>
                            <div
                                className="dash-segbar"
                                role="img"
                                aria-label={deptMixAria || 'No department message data'}
                            >
                                {loading ? (
                                    <span className="dash-seg dash-seg--empty" style={{ width: '100%' }} />
                                ) : deptMixCount > 0 ? (
                                    departmentMessageMix.map((m) => (
                                        <span
                                            key={m.label}
                                            className={`dash-seg dash-seg--${m.tone}`}
                                            style={{ width: `${Math.max(m.pct, 4)}%` }}
                                            title={`${m.label}: ${m.count.toLocaleString()} (${m.pct}%)`}
                                        />
                                    ))
                                ) : (
                                    <span className="dash-seg dash-seg--empty" style={{ width: '100%' }} />
                                )}
                            </div>
                            <ul className="dash-legend">
                                {loading ? (
                                    <li>
                                        <span className="dash-swatch dash-swatch--m4" />
                                        <span className="dash-legend__n">Loading…</span>
                                    </li>
                                ) : deptMixCount > 0 ? (
                                    departmentMessageMix.map((m) => (
                                        <li key={m.label}>
                                            <span className={`dash-swatch dash-swatch--${m.tone}`} />
                                            <span className="dash-legend__n">{m.label}</span>
                                            <span className="dash-legend__count">{m.count.toLocaleString()}</span>
                                            <span className="dash-legend__pct">{m.pct}%</span>
                                        </li>
                                    ))
                                ) : (
                                    <li>
                                        <span className="dash-swatch dash-swatch--m4" />
                                        <span className="dash-legend__n">No messages in this period</span>
                                    </li>
                                )}
                            </ul>
                        </div>

                        <div className="dash-card dash-card--lg">
                            <div className="dash-sumhd">
                                <div>
                                    <p className="dash-sumhd__label">Staff onboarding</p>
                                    <p className="dash-sumhd__val">
                                        {loading ? '—' : `${staffAccountMetric.total - staffAccountMetric.active}`}
                                    </p>
                                    <p className="dash-card__muted">Accounts pending activation</p>
                                </div>
                                <div className="dash-sumhd__acts">
                                    <button type="button" className="dash-btn dash-btn--soft" onClick={() => router.push('/staff')}>
                                        View staff
                                    </button>
                                </div>
                            </div>
                            {(criticalRolesWithoutEscalation > 0 || teamsWithoutLeadCount > 0 || teamsWithoutMembersCount > 0 || deptsWithoutNameCount > 0) && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0 4px' }}>
                                    {criticalRolesWithoutEscalation > 0 && (
                                        <span style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>
                                            {criticalRolesWithoutEscalation} critical role{criticalRolesWithoutEscalation === 1 ? '' : 's'} without ladders
                                        </span>
                                    )}
                                    {teamsWithoutLeadCount > 0 && (
                                        <span style={{ background: '#F1F5F9', color: '#475569', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>
                                            {teamsWithoutLeadCount} team{teamsWithoutLeadCount === 1 ? '' : 's'} without a lead
                                        </span>
                                    )}
                                    {teamsWithoutMembersCount > 0 && (
                                        <span style={{ background: '#F1F5F9', color: '#475569', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>
                                            {teamsWithoutMembersCount} empty team{teamsWithoutMembersCount === 1 ? '' : 's'}
                                        </span>
                                    )}
                                    {deptsWithoutNameCount > 0 && (
                                        <span style={{ background: '#F1F5F9', color: '#475569', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>
                                            {deptsWithoutNameCount} dept{deptsWithoutNameCount === 1 ? '' : 's'} unnamed
                                        </span>
                                    )}
                                </div>
                            )}
                            <div className="dash-goal">
                                <div className="dash-goal__top">
                                    <span className="dash-goal__label">Staff activation rate</span>
                                    <span className="dash-goal__nums">
                                        <strong>{staffAccountMetric.active.toLocaleString()}</strong> / {staffAccountMetric.total.toLocaleString()}{' '}
                                        <span className="dash-goal__pct">({staffAccountMetric.percent}%)</span>
                                    </span>
                                </div>
                                <div className="dash-goal__bar">
                                    <span style={{ width: `${Math.min(staffAccountMetric.percent, 100)}%` }} />
                                </div>
                                <p className="dash-goal__foot">Active accounts vs total directory</p>
                            </div>
                        </div>
                    </section>

                    <div className="dash-lower dash-reveal">
                        <section
                            className={`dash-card dash-card--table${!teamPresenceLoadingCombined && signedInStaff.length === 0 ? ' dash-card--table-empty' : ''}`}
                            aria-label="Team presence"
                        >
                            <div className="dash-card__hd">
                                <div>
                                    <h2 className="dash-card__title">Team presence</h2>
                                    <p className="dash-card__muted">
                                        {teamPresenceLoadingCombined
                                            ? '—'
                                            : signedInStaff.length === 0
                                                ? 'No recent activity'
                                                : `${onlineCount} online · ${signedInStaff.length} most recent`}
                                    </p>
                                </div>
                                <button type="button" className="dash-btn dash-btn--outline dash-btn--sm" onClick={() => router.push('/staff')}>
                                    View directory
                                </button>
                            </div>
                            <div className="dash-tablewrap">
                                {teamPresenceLoadingCombined ? (
                                    <p className="dash-empty">Loading…</p>
                                ) : signedInStaff.length === 0 ? (
                                    <p className="dash-empty">No staff activity recorded yet.</p>
                                ) : (
                                    <table className="dash-table">
                                        <thead>
                                            <tr>
                                                <th>Member</th>
                                                <th>Role</th>
                                                <th className="dash-num">Last seen</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {signedInStaff.map((s) => {
                                                const on = s.status === 'online';
                                                return (
                                                    <tr key={s.id}>
                                                        <td>
                                                            <span className="dash-member">
                                                                <span className={`dash-presence dash-presence--${on ? 'on' : 'off'}`} />
                                                                <span className="dash-av">{s.initials}</span>
                                                                {s.name}
                                                            </span>
                                                        </td>
                                                        <td className="td-muted">{s.role}</td>
                                                        <td className="dash-num td-muted">{s.when}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </section>

                        <div className="dash-stack">
                            <section className="dash-card" aria-label="Reliability">
                                <h2 className="dash-card__title dash-card__title--sm">System checks</h2>
                                <ul className="dash-health">
                                    {healthRows.map((r) => (
                                        <li key={r.label} className={`dash-health__row dash-health__row--${r.sem}`}>
                                            <span className="material-icons-round">{r.icon}</span>
                                            <div className="dash-health__mid">
                                                <span className="dash-health__lab">{r.label}</span>
                                                <span className="dash-health__sub">{r.sub}</span>
                                            </div>
                                            <span className="dash-health__val">{r.value}</span>
                                        </li>
                                    ))}
                                </ul>
                            </section>

                            <section className="dash-card" aria-label="Recent activity">
                                <h2 className="dash-card__title dash-card__title--sm">Recent activity</h2>
                                {recent.length === 0 ? (
                                    <p className="dash-empty">{loading ? 'Loading…' : 'No recent activity'}</p>
                                ) : (
                                    <ul className="dash-feed">
                                        {recent.map((item) => (
                                            <li key={item.id}>
                                                <span className="dash-feed__t">{item.time}</span>
                                                <div className="dash-feed__d">
                                                    <strong>{item.title}</strong>
                                                    <span className="dash-feed__meta">{item.detail}</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        </div>
                    </div>

                    <nav className="dash-quick dash-reveal" aria-label="Shortcuts">
                        {quickActions.map((a) => (
                            <button
                                key={a.label}
                                type="button"
                                className="dash-quick__btn"
                                onClick={() => router.push(a.href)}
                            >
                                <span className="material-icons-round">{a.icon}</span>
                                {a.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </main>
        </div>
    );
}
