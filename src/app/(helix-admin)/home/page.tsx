'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './home-overview.css';
import { parseBulkUploadHistoryResponse, type BulkUploadHistoryEntry } from '@/lib/bulk-upload-history';
import { fetchMergedFacilityPresenceOnline } from '@/lib/presence-online';

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

const SPARK_POINTS = [22, 24, 23, 28, 31, 30, 34, 33, 36, 40, 38, 41];

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

function parsePresenceOnlineToSignedIn(raw: unknown, max: number): SignedInStaff[] {
    const list = getList(raw, ['data', 'items', 'online', 'staff', 'users', 'results', 'presence', 'records']);
    if (!Array.isArray(list) || list.length === 0) return [];
    const rows: (SignedInStaff & { _ts: number })[] = [];
    for (let idx = 0; idx < list.length; idx++) {
        const item = list[idx];
        if (!item || typeof item !== 'object') continue;
        const rec = item as Record<string, unknown>;
        const first = String(rec.first_name || '').trim();
        const last = String(rec.last_name || '').trim();
        const fullName = String(
            rec.name
            || rec.display_name
            || `${first} ${last}`.trim()
            || rec.email
            || 'Staff member',
        );
        const initials = (first && last
            ? `${first[0]}${last[0]}`
            : String(fullName).split(/\s+/).map((p) => p[0] || '').slice(0, 2).join('')
        ).toUpperCase() || 'S';
        const roleRaw = String(rec.job_title || rec.title || rec.system_role || rec.role || 'Staff').trim();
        const role = roleRaw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const whenRaw = String(
            rec.last_seen_at
            || rec.last_activity_at
            || rec.last_login_at
            || rec.online_since
            || rec.signed_in_at
            || rec.updated_at
            || '',
        ).trim();
        const ts = whenRaw ? Date.parse(whenRaw) : Date.now();
        const id = String(rec.id || rec.staff_id || rec.user_id || `presence-${idx}`);
        rows.push({
            id,
            name: fullName,
            initials,
            role,
            when: whenRaw ? toWhenLabel(whenRaw) : 'Active now',
            status: 'online',
            _ts: Number.isFinite(ts) ? ts : 0,
        });
    }
    return rows
        .sort((a, b) => b._ts - a._ts)
        .slice(0, max)
        .map(({ _ts, ...rest }) => { void _ts; return rest; });
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

function Sparkline({ points }: { points: number[] }) {
    const uid = useId().replace(/:/g, '');
    const w = 120;
    const h = 36;
    const pad = 4;
    const max = Math.max(...points);
    const min = Math.min(...points);
    const coords = points.map((v, i) => {
        const x = pad + (i / (points.length - 1)) * (w - pad * 2);
        const y = pad + (1 - (v - min) / (max - min || 1)) * (h - pad * 2);
        return `${x},${y}`;
    });
    const pts = coords.join(' ');
    return (
        <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} width={120} height={36} aria-hidden>
            <defs>
                <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(34,197,94,.28)" />
                    <stop offset="100%" stopColor="rgba(34,197,94,0)" />
                </linearGradient>
            </defs>
            <polyline fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
            <polyline fill={`url(#${uid})`} stroke="none" points={`${pts} ${w - pad},${h - pad} ${pad},${h - pad}`} />
        </svg>
    );
}

export default function HomePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [staffCount, setStaffCount] = useState(0);
    const [patientCount, setPatientCount] = useState(0);
    const [failedImports24h, setFailedImports24h] = useState(0);
    const [setupTasks, setSetupTasks] = useState(0);
    const [recent, setRecent] = useState<ActivityItem[]>([]);
    const [firstName, setFirstName] = useState('');
    const [facilityName, setFacilityName] = useState('');
    const [twoFactorAdoption, setTwoFactorAdoption] = useState<{ enabled: number; total: number }>({ enabled: 0, total: 0 });
    const [criticalRoleFill, setCriticalRoleFill] = useState<{ filled: number; total: number; percent: number }>({ filled: 0, total: 0, percent: 0 });
    const [avgCriticalAckMinutes, setAvgCriticalAckMinutes] = useState(0);
    const [activeSessions, setActiveSessions] = useState(0);
    const [signedInStaff, setSignedInStaff] = useState<SignedInStaff[]>([]);
    const [presenceReportedNoOnline, setPresenceReportedNoOnline] = useState(false);
    const [departmentMessageMix, setDepartmentMessageMix] = useState<DeptMessageMixRow[]>([]);
    const [departmentMessagesTotal, setDepartmentMessagesTotal] = useState(0);
    const [analyticsWindowDays, setAnalyticsWindowDays] = useState(30);
    const [escalatedCriticalMessages, setEscalatedCriticalMessages] = useState(0);
    const [escalationRatePercent, setEscalationRatePercent] = useState(0);
    const [incompleteEscalationPolicies, setIncompleteEscalationPolicies] = useState(0);

    const fetchHomeData = useCallback(async () => {
        setLoading(true);
        try {
            const [
                meRes,
                hospitalRes,
                staffRes,
                patientRes,
                teamsRes,
                departmentsRes,
                escalationRes,
                auditRes,
                historyStaffRes,
                historyPatientRes,
                sessionsRes,
                analyticsRes,
            ] = await Promise.all([
                fetch('/api/proxy/auth/me', { credentials: 'include' }),
                fetch('/api/proxy/hospital', { credentials: 'include' }),
                fetch('/api/proxy/staff?page_size=100&page_id=1', { credentials: 'include' }),
                fetch('/api/proxy/patients?page_size=20&page_id=1', { credentials: 'include' }),
                fetch('/api/proxy/teams', { credentials: 'include' }),
                fetch('/api/proxy/departments', { credentials: 'include' }),
                fetch('/api/proxy/escalation-policies', { credentials: 'include' }),
                fetch('/api/proxy/audit-logs?page_size=5&page_id=1', { credentials: 'include' }),
                fetch('/api/proxy/bulk-upload-history?kind=staff&page_size=20', { credentials: 'include' }),
                fetch('/api/proxy/bulk-upload-history?kind=patient&page_size=20', { credentials: 'include' }),
                fetch('/api/proxy/auth/sessions', { credentials: 'include' }),
                fetch('/api/proxy/analytics?days=30', { credentials: 'include' }),
            ]);

            const [
                meJson,
                hospitalJson,
                staffJson,
                patientJson,
                teamsJson,
                departmentsJson,
                escalationJson,
                auditJson,
                historyStaffJson,
                historyPatientJson,
                sessionsJson,
                analyticsJson,
            ] = await Promise.all([
                meRes.ok ? meRes.json() : Promise.resolve(null),
                hospitalRes.ok ? hospitalRes.json() : Promise.resolve(null),
                staffRes.ok ? staffRes.json() : Promise.resolve(null),
                patientRes.ok ? patientRes.json() : Promise.resolve(null),
                teamsRes.ok ? teamsRes.json() : Promise.resolve(null),
                departmentsRes.ok ? departmentsRes.json() : Promise.resolve(null),
                escalationRes.ok ? escalationRes.json() : Promise.resolve(null),
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

                const escalated = Number(a.escalated_critical_messages ?? 0);
                const escRate = Number(a.escalation_rate_percent ?? 0);
                setEscalatedCriticalMessages(Number.isFinite(escalated) ? escalated : 0);
                setEscalationRatePercent(Number.isFinite(escRate) ? escRate : 0);

                const deptMix = buildDepartmentMessageMix(a);
                setDepartmentMessageMix(deptMix.rows);
                setDepartmentMessagesTotal(deptMix.total);
                setAnalyticsWindowDays(deptMix.windowDays);
            } else {
                setDepartmentMessageMix([]);
                setDepartmentMessagesTotal(0);
                setAnalyticsWindowDays(30);
                setEscalatedCriticalMessages(0);
                setEscalationRatePercent(0);
            }

            const presenceBundle = await fetchMergedFacilityPresenceOnline();
            const presenceReallyOk = presenceBundle.ok;
            const presenceMergedPayload = presenceBundle.items.length > 0 ? { data: presenceBundle.items } : null;

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

            const staffItems = getList(staffJson, ['items', 'data', 'staff']);
            const patientItems = getList(patientJson, ['items', 'data', 'patients']);
            const teamItems = getList(teamsJson, ['items', 'data', 'teams']) as SimpleItem[];
            const departmentItems = getList(departmentsJson, ['items', 'data', 'departments']) as SimpleItem[];
            const escalationItems = getList(escalationJson, ['items', 'data', 'policies', 'results']) as SimpleItem[];

            setStaffCount(readTotal(staffJson, staffItems.length));

            let twoFactorEnabled = 0;
            for (const s of staffItems) {
                const rec = s as Record<string, unknown>;
                if (rec.otp_enabled === true || rec.two_factor_enabled === true || rec.twoFactorEnabled === true) twoFactorEnabled += 1;
            }
            setTwoFactorAdoption({ enabled: twoFactorEnabled, total: staffItems.length });

            const nowMs = Date.now();
            const withLogin = staffItems
                .map((s) => {
                    const rec = s as Record<string, unknown>;
                    const loginRaw = String(rec.last_login_at || rec.last_login || rec.last_seen_at || '').trim();
                    const ts = loginRaw ? Date.parse(loginRaw) : NaN;
                    if (!loginRaw || Number.isNaN(ts)) return null;
                    const first = String(rec.first_name || '').trim();
                    const last = String(rec.last_name || '').trim();
                    const fullName = String(rec.name || `${first} ${last}`.trim() || rec.email || 'Staff member');
                    const initials = (first && last
                        ? `${first[0]}${last[0]}`
                        : String(fullName).split(/\s+/).map((p) => p[0] || '').slice(0, 2).join('')
                    ).toUpperCase() || 'S';
                    const roleRaw = String(rec.job_title || rec.system_role || rec.role || 'Staff').trim();
                    const role = roleRaw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                    const diffMin = (nowMs - ts) / 60000;
                    const status: SignedInStaff['status'] = diffMin <= 15 ? 'online' : diffMin <= 120 ? 'recent' : 'away';
                    return {
                        id: String(rec.id || rec.staff_id || rec.user_id || fullName),
                        name: fullName,
                        initials,
                        role,
                        when: toWhenLabel(loginRaw),
                        status,
                        _ts: ts,
                    } as SignedInStaff & { _ts: number };
                })
                .filter((x): x is SignedInStaff & { _ts: number } => Boolean(x))
                .sort((a, b) => b._ts - a._ts)
                .slice(0, TEAM_PRESENCE_MAX)
                .map(({ _ts, ...rest }) => { void _ts; return rest; });

            const fromPresence = presenceReallyOk && presenceMergedPayload
                ? parsePresenceOnlineToSignedIn(presenceMergedPayload, TEAM_PRESENCE_MAX)
                : [];
            if (fromPresence.length > 0) {
                setSignedInStaff(fromPresence);
                setPresenceReportedNoOnline(false);
            } else {
                setSignedInStaff(withLogin);
                setPresenceReportedNoOnline(Boolean(presenceReallyOk) && presenceBundle.items.length === 0);
            }

            setPatientCount(readTotal(patientJson, patientItems.length));

            const teamsWithoutLead = teamItems.filter(t => !String(t.lead_id || '').trim()).length;
            const teamsWithoutMembers = teamItems.filter(t => {
                const c = Number(t.member_count ?? 0);
                return !Number.isFinite(c) || c <= 0;
            }).length;
            const departmentsWithoutName = departmentItems.filter(d => !String(d.name || d.department_name || '').trim()).length;
            const escalationsMissingSteps = escalationItems.filter(p => !Array.isArray(p.steps) || p.steps.length === 0).length;
            setIncompleteEscalationPolicies(escalationsMissingSteps);
            setSetupTasks(teamsWithoutLead + teamsWithoutMembers + escalationsMissingSteps + departmentsWithoutName);

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

    const escalationNeedsAttention = incompleteEscalationPolicies > 0;
    const onlineCount = signedInStaff.filter((s) => s.status === 'online').length;
    const facilityShort = facilityName || 'Your facility';

    const workQueueTotal = staffCount + patientCount + setupTasks;
    const goalTarget = criticalRoleFill.total > 0 ? criticalRoleFill.total : 100;
    const goalCurrent = criticalRoleFill.filled;
    const goalPct = goalTarget > 0 ? Math.round((goalCurrent / goalTarget) * 100) : criticalRoleFill.percent;

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
                            <p className="dash-wallet__label">Staff accounts</p>
                            <p className="dash-wallet__hint">Active seats</p>
                            <p className="dash-wallet__balance">{formatMetric(staffCount)}</p>
                            <p className="dash-wallet__foot">Included contractors &amp; locums</p>
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
                            <p className="dash-wallet__hint">Critical messages · {analyticsWindowDays} days</p>
                            <p className={`dash-wallet__balance${escalationNeedsAttention ? ' dash-wallet__balance--alert' : ''}`}>
                                {formatMetric(escalatedCriticalMessages)}
                            </p>
                            {escalationNeedsAttention && (
                                <div className="dash-wallet__row">
                                    <span className="dash-wallet__flag">
                                        <span className="material-icons-round">warning</span>
                                        {incompleteEscalationPolicies} ladder{incompleteEscalationPolicies === 1 ? '' : 's'} need steps
                                    </span>
                                </div>
                            )}
                            <p className="dash-wallet__foot">
                                {loading
                                    ? '—'
                                    : escalatedCriticalMessages > 0
                                        ? `${escalationRatePercent.toFixed(1)}% of critical messages escalated`
                                        : escalationNeedsAttention
                                            ? 'Finish escalation ladders in config'
                                            : 'No critical escalations in this period'}
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
                                    <p className="dash-sumhd__label">Open work queue</p>
                                    <p className="dash-sumhd__val">{formatMetric(workQueueTotal)}</p>
                                    <p className="dash-card__muted">Tasks awaiting assignment</p>
                                </div>
                                <div className="dash-sumhd__acts">
                                    <button type="button" className="dash-btn dash-btn--soft">Share</button>
                                    <button type="button" className="dash-btn dash-btn--soft">Manage</button>
                                </div>
                                <Sparkline points={SPARK_POINTS} />
                            </div>
                            <div className="dash-goal">
                                <div className="dash-goal__top">
                                    <span className="dash-goal__label">Monthly stability target</span>
                                    <span className="dash-goal__nums">
                                        <strong>{goalCurrent.toLocaleString()}</strong> / {goalTarget.toLocaleString()}{' '}
                                        <span className="dash-goal__pct">({goalPct}%)</span>
                                    </span>
                                </div>
                                <div className="dash-goal__bar">
                                    <span style={{ width: `${Math.min(goalPct, 100)}%` }} />
                                </div>
                                <p className="dash-goal__foot">Benchmark tied to critical role fill rate</p>
                            </div>
                        </div>
                    </section>

                    <div className="dash-lower dash-reveal">
                        <section
                            className={`dash-card dash-card--table${!loading && signedInStaff.length === 0 ? ' dash-card--table-empty' : ''}`}
                            aria-label="Team presence"
                        >
                            <div className="dash-card__hd">
                                <div>
                                    <h2 className="dash-card__title">Team presence</h2>
                                    <p className="dash-card__muted">
                                        {loading
                                            ? '—'
                                            : signedInStaff.length === 0
                                                ? 'No recent activity'
                                                : `${onlineCount} online · ${signedInStaff.length} most recent (up to ${TEAM_PRESENCE_MAX})`}
                                    </p>
                                </div>
                                <button type="button" className="dash-btn dash-btn--outline dash-btn--sm" onClick={() => router.push('/staff')}>
                                    View directory
                                </button>
                            </div>
                            <div className="dash-tablewrap">
                                {loading ? (
                                    <p className="dash-empty">Loading…</p>
                                ) : signedInStaff.length === 0 ? (
                                    <p className="dash-empty">
                                        {presenceReportedNoOnline ? 'No one online right now.' : 'No recent sign-ins recorded.'}
                                    </p>
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
