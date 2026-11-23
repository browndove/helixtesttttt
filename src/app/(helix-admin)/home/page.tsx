'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './home-overview.css';
import { HomeCalendarCard, HomeCommandSearch, HomeDeptMessagesCard, HomeNotesCard } from './HomeWidgets';
import { HomeKpiStrip } from './HomeKpis';
import { parseBulkUploadHistoryResponse, type BulkUploadHistoryEntry } from '@/lib/bulk-upload-history';
import {
    fetchAllEscalationPoliciesPayload,
    type EscalationPolicyListItem,
} from '@/lib/fetch-all-escalation-policies';
import { fetchAllStaffPayload } from '@/lib/fetch-all-staff';
import { countCriticalRolesWithoutEscalation } from '@/lib/role-escalation-ladder';
import { useTeamPresenceRoster } from '@/lib/useTeamPresenceRoster';
import { generateDashboardPdf, type DashboardReportData } from '@/lib/generate-dashboard-report';
type SimpleItem = Record<string, unknown>;
type ActivityItem = { id: string; title: string; detail: string; time: string; tone?: 'default' | 'critical' | 'info' };
type SignedInStaff = { id: string; name: string; initials: string; role: string; when: string; status: 'online' | 'recent' | 'away' };

const plusJakarta = Plus_Jakarta_Sans({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700'],
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

function greetingByTime(at: Date): string {
    const h = at.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

function todayLabelLong(at: Date): string {
    return at.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

/** Wall clock that only renders after mount (server time zone would mismatch on hydration). */
function useNow(intervalMs = 15_000): Date | null {
    const [now, setNow] = useState<Date | null>(null);
    useEffect(() => {
        const tick = () => setNow(new Date());
        const first = window.setTimeout(tick, 0);
        const id = window.setInterval(tick, intervalMs);
        return () => {
            window.clearTimeout(first);
            window.clearInterval(id);
        };
    }, [intervalMs]);
    return now;
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
    const [jobTitleBreakdown, setJobTitleBreakdown] = useState<{ title: string; count: number }[]>([]);

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
                escalationBundleRes,
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
                fetchAllEscalationPoliciesPayload({ credentials: 'include' }),
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
                escalationBundle,
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
                Promise.resolve(escalationBundleRes),
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
            const escalationItems = (
                escalationBundle && typeof escalationBundle === 'object' && (escalationBundle as { ok?: boolean }).ok
                    ? (escalationBundle as { data: EscalationPolicyListItem[] }).data
                    : []
            ) as SimpleItem[];
            const roleItems = getList(rolesJson, ['items', 'data', 'roles', 'results']) as SimpleItem[];
            const escalationGap = countCriticalRolesWithoutEscalation(roleItems, escalationItems);
            setCriticalRolesWithoutEscalation(escalationGap.withoutEscalation);
            setCriticalRolesTotal(escalationGap.criticalTotal);

            setStaffCount(readTotal(staffPayload, staffItems.length));
            setStaffAccountMetric(countStaffAccountMetrics(staffItems));

            const titleMap = new Map<string, number>();
            for (const s of staffItems) {
                const rec = s as Record<string, unknown>;
                const raw = String(rec.job_title || rec.role || rec.designation || '').trim();
                const title = raw
                    ? raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                    : 'Unassigned';
                titleMap.set(title, (titleMap.get(title) || 0) + 1);
            }
            const titleRows = [...titleMap.entries()]
                .map(([title, count]) => ({ title, count }))
                .sort((a, b) => b.count - a.count);
            setJobTitleBreakdown(titleRows);

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
        { label: 'New role', icon: 'badge', href: '/roles' },
        { label: 'Invite staff', icon: 'person_add_alt', href: '/staff' },
        { label: 'Teams', icon: 'diversity_3', href: '/provider-teams' },
        { label: 'Escalation', icon: 'timeline', href: '/escalation' },
        { label: 'Departments', icon: 'domain', href: '/departments' },
        { label: 'Beds', icon: 'bed', href: '/beds' },
        { label: 'Patients', icon: 'personal_injury', href: '/patients' },
        { label: 'Audit log', icon: 'history', href: '/audit-log' },
    ];

    const setupChecklist = [
        {
            label: 'Critical roles have escalation ladders',
            done: criticalRolesTotal > 0 && criticalRolesWithoutEscalation === 0,
            href: '/escalation',
        },
        { label: 'Every provider team has a lead', done: teamsWithoutLeadCount === 0, href: '/provider-teams' },
        { label: 'Every provider team has members', done: teamsWithoutMembersCount === 0, href: '/provider-teams' },
        { label: '2FA enabled for 80%+ of staff', done: twoFactorPct >= 80, href: '/staff' },
        { label: 'No failed imports in 24 hours', done: failedImports24h === 0, href: '/staff' },
    ];
    const setupDone = setupChecklist.filter(c => c.done).length;

    const now = useNow();
    const clockParts = now
        ? now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).split(' ')
        : ['--:--', ''];

    const formatMetric = (n: number, suffix = '') => (loading ? '—' : `${n.toLocaleString()}${suffix}`);

    const handleDownloadReport = useCallback(() => {
        const reportData: DashboardReportData = {
            facilityName: facilityName || 'Helix Health',
            generatedBy: firstName || 'Administrator',
            patientCount,
            staffActive: staffAccountMetric.active,
            staffTotal: staffAccountMetric.total,
            staffActivePercent: staffAccountMetric.percent,
            criticalFilled: criticalRoleFill.filled,
            criticalTotal: criticalRoleFill.total,
            criticalPercent: criticalRoleFill.percent,
            criticalRolesWithoutEscalation,
            criticalRolesTotal,
            ackLabel,
            twoFactorPct,
            twoFactorEnabled: twoFactorAdoption.enabled,
            twoFactorTotal: twoFactorAdoption.total,
            failedImports24h,
            activeSessions,
            departmentMix: departmentMessageMix,
            departmentMessagesTotal,
            analyticsWindowDays,
            teamsWithoutLead: teamsWithoutLeadCount,
            teamsWithoutMembers: teamsWithoutMembersCount,
            deptsWithoutName: deptsWithoutNameCount,
            incompleteEscalations: criticalRolesWithoutEscalation,
        };
        generateDashboardPdf(reportData);
    }, [
        facilityName, firstName, patientCount, staffAccountMetric,
        criticalRoleFill, criticalRolesWithoutEscalation, criticalRolesTotal,
        ackLabel, twoFactorPct, twoFactorAdoption, failedImports24h,
        activeSessions, departmentMessageMix, departmentMessagesTotal,
        analyticsWindowDays, teamsWithoutLeadCount, teamsWithoutMembersCount,
        deptsWithoutNameCount, criticalRolesWithoutEscalation,
    ]);

    const searchExtras = useMemo(() => [
        { label: 'Download facility report', icon: 'summarize', run: handleDownloadReport, hint: 'Action' },
        { label: 'Refresh dashboard', icon: 'sync', run: () => { void fetchHomeData(); }, hint: 'Action' },
        { label: 'Transfer patient', icon: 'swap_horiz', href: '/external-communication', hint: 'Action' },
    ], [handleDownloadReport, fetchHomeData]);

    return (
        <div className={`app-main home-overview-app-main ${plusJakarta.className}`}>
            <main className="page">
                <div className="dash">
                    {/* ── Hero: greeting, clock, facility pulse ───────────────── */}
                    <header className="hx-hero dash-reveal">
                        <div className="hx-hero__left">
                            <div className="hx-pill">
                                <span className="material-icons-round">waving_hand</span>
                                {now ? greetingByTime(now) : 'Welcome'}{firstName ? `, ${firstName}` : ''}
                            </div>
                            <div className="hx-clock" aria-live="off">
                                <span className="hx-clock__time">{clockParts[0]}</span>
                                <span className="hx-clock__ampm">{clockParts[1]}</span>
                            </div>
                            <p className="hx-hero__date">
                                {now ? todayLabelLong(now) : ' '}
                                <span className="hx-dot" />
                                {facilityShort}
                            </p>
                        </div>

                        <div className="hx-hero__mid">
                            <HomeCommandSearch extra={searchExtras} />
                        </div>

                        <div className="hx-hero__right">
                            <div className="hx-toolbar" role="toolbar" aria-label="Dashboard actions">
                                <button type="button" onClick={() => fetchHomeData()} title="Refresh" aria-label="Refresh">
                                    <span className={`material-icons-round${loading ? ' hx-spin' : ''}`}>sync</span>
                                </button>
                                <button type="button" onClick={handleDownloadReport} disabled={loading} title="Download report" aria-label="Download report">
                                    <span className="material-icons-round">summarize</span>
                                </button>
                                <button type="button" onClick={() => router.push('/external-communication')} title="Transfer" aria-label="Transfer">
                                    <span className="material-icons-round">swap_horiz</span>
                                </button>
                                <button type="button" onClick={() => router.push('/settings')} title="Settings" aria-label="Settings">
                                    <span className="material-icons-round">settings</span>
                                </button>
                            </div>

                            <button type="button" className="hx-pulse" onClick={() => router.push('/escalation')}>
                                <span className={`hx-pulse__ring${criticalRoleFill.percent >= 90 ? ' hx-pulse__ring--ok' : ''}`}
                                    style={{ ['--pct' as string]: `${loading ? 0 : criticalRoleFill.percent}` }}>
                                    <span className="material-icons-round">shield</span>
                                </span>
                                <span className="hx-pulse__body">
                                    <span className="hx-pulse__value">{formatMetric(criticalRoleFill.percent, '%')}</span>
                                    <span className="hx-pulse__label">Critical coverage</span>
                                    <span className="hx-pulse__meta">
                                        {loading ? '—' : `${criticalRoleFill.filled} / ${criticalRoleFill.total} roles · target 90%`}
                                    </span>
                                </span>
                            </button>
                        </div>
                    </header>

                    {/* ── KPI tiles ───────────────────────────────────────────── */}
                    <HomeKpiStrip
                        loading={loading}
                        patientCount={patientCount}
                        staff={staffAccountMetric}
                        twoFactor={{ ...twoFactorAdoption, percent: twoFactorPct }}
                        escalation={{ missing: criticalRolesWithoutEscalation, total: criticalRolesTotal }}
                        go={(href) => router.push(href)}
                    />

                    {/* ── Bento row 1 ─────────────────────────────────────────── */}
                    <section className="hx-grid dash-reveal">
                        <div className="hx-span-5 hx-stack">
                            <HomeDeptMessagesCard
                                rows={departmentMessageMix}
                                total={departmentMessagesTotal}
                                windowDays={analyticsWindowDays}
                                loading={loading}
                                facilityName={facilityShort}
                            />
                        </div>

                        <div className="hx-stack hx-span-4">
                        <div className="hx-card">
                            <div className="hx-card__hd">
                                <h2 className="hx-card__title">Quick access</h2>
                            </div>
                            <div className="hx-tiles">
                                {quickActions.map((a) => (
                                    <button key={a.label} type="button" className="hx-tile" onClick={() => router.push(a.href)}>
                                        <span className="hx-tile__icon"><span className="material-icons-round">{a.icon}</span></span>
                                        <span className="hx-tile__label">{a.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <HomeNotesCard />
                        </div>

                        <div className="hx-card hx-span-3 hx-card--flex">
                            <div className="hx-card__hd">
                                <h2 className="hx-card__title">Setup checklist</h2>
                            </div>
                            <ul className="hx-todo">
                                {setupChecklist.map((c) => (
                                    <li key={c.label}>
                                        <button
                                            type="button"
                                            className={`hx-todo__item${!loading && c.done ? ' is-done' : ''}`}
                                            onClick={() => router.push(c.href)}
                                        >
                                            <span className="hx-todo__check">
                                                {!loading && c.done && <span className="material-icons-round">check</span>}
                                            </span>
                                            {c.label}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            <div className="hx-todo__foot">
                                <span>Completed {loading ? '—' : setupDone} / {setupChecklist.length}</span>
                                <span className="hx-meter hx-meter--thin">
                                    <span style={{ width: `${loading ? 0 : Math.round((setupDone / setupChecklist.length) * 100)}%` }} />
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* ── Bento row 2 ─────────────────────────────────────────── */}
                    <section className="hx-grid dash-reveal">
                        <div className="hx-card hx-span-5">
                            <div className="hx-card__hd">
                                <div>
                                    <h2 className="hx-card__title">Team presence</h2>
                                    <p className="hx-card__sub">
                                        {teamPresenceLoadingCombined
                                            ? '—'
                                            : signedInStaff.length === 0
                                                ? 'No recent activity'
                                                : `${onlineCount} online · ${signedInStaff.length} most recent`}
                                    </p>
                                </div>
                                <button type="button" className="hx-chip-btn" onClick={() => router.push('/staff')}>View all</button>
                            </div>
                            {teamPresenceLoadingCombined ? (
                                <p className="hx-empty">Loading…</p>
                            ) : signedInStaff.length === 0 ? (
                                <p className="hx-empty">No staff activity recorded yet.</p>
                            ) : (
                                <ul className="hx-rows hx-rows--scroll">
                                    {signedInStaff.map((s) => {
                                        const on = s.status === 'online';
                                        return (
                                            <li key={s.id} className="hx-row">
                                                <span className="hx-av">
                                                    {s.initials}
                                                    <span className={`hx-av__dot${on ? ' is-on' : ''}`} />
                                                </span>
                                                <span className="hx-row__main">
                                                    <span className="hx-row__label">{s.name}</span>
                                                    <span className="hx-row__sub">{s.role}</span>
                                                </span>
                                                <span className="hx-row__meta">{s.when}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        <div className="hx-card hx-card--dark hx-span-4 hx-card--flex">
                            <div className="hx-card__hd">
                                <div>
                                    <h2 className="hx-card__title">Staff breakdown</h2>
                                    <p className="hx-card__sub">
                                        {loading ? '—' : `${staffAccountMetric.total.toLocaleString()} staff · ${jobTitleBreakdown.length} role${jobTitleBreakdown.length === 1 ? '' : 's'}`}
                                    </p>
                                </div>
                                <button type="button" className="hx-chip-btn hx-chip-btn--dark" onClick={() => router.push('/staff')}>Directory</button>
                            </div>
                            {loading ? (
                                <p className="hx-empty">Loading…</p>
                            ) : jobTitleBreakdown.length === 0 ? (
                                <p className="hx-empty">No staff data available.</p>
                            ) : (
                                <div className="hx-columns" role="list">
                                    {jobTitleBreakdown.slice(0, 5).map((row) => {
                                        const maxCount = jobTitleBreakdown[0].count || 1;
                                        const pct = staffAccountMetric.total > 0 ? Math.round((row.count / staffAccountMetric.total) * 100) : 0;
                                        return (
                                            <div key={row.title} className="hx-columns__col" role="listitem" title={`${row.title}: ${row.count} (${pct}%)`}>
                                                <span className="hx-columns__val">{row.count}</span>
                                                <span className="hx-columns__track">
                                                    <span style={{ height: `${Math.max(6, Math.round((row.count / maxCount) * 100))}%` }} />
                                                </span>
                                                <span className="hx-columns__lab">{row.title}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="hx-card hx-span-3 hx-card--flex">
                            <div className="hx-card__hd">
                                <h2 className="hx-card__title">System checks</h2>
                            </div>
                            <ul className="hx-checks">
                                {healthRows.map((r) => (
                                    <li key={r.label} className={`hx-check hx-check--${r.sem}`}>
                                        <span className="hx-check__icon"><span className="material-icons-round">{r.icon}</span></span>
                                        <span className="hx-row__main">
                                            <span className="hx-row__label">{r.label}</span>
                                            <span className="hx-row__sub">{r.sub}</span>
                                        </span>
                                        <span className="hx-check__val">{r.value}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </section>

                    {/* ── Recent activity ─────────────────────────────────────── */}
                    <section className="hx-grid dash-reveal">
                    <div className="hx-card hx-span-8" aria-label="Recent activity">
                        <div className="hx-card__hd">
                            <h2 className="hx-card__title">Recent activity</h2>
                            <button type="button" className="hx-chip-btn" onClick={() => router.push('/audit-log')}>Audit log</button>
                        </div>
                        {recent.length === 0 ? (
                            <p className="hx-empty">{loading ? 'Loading…' : 'No recent activity'}</p>
                        ) : (
                            <ul className="hx-rows">
                                {recent.map((item) => (
                                    <li key={item.id} className={`hx-row hx-row--${item.tone || 'default'}`}>
                                        <span className="hx-row__icon">
                                            <span className="material-icons-round">
                                                {item.tone === 'critical' ? 'error_outline' : item.tone === 'info' ? 'upload_file' : 'history'}
                                            </span>
                                        </span>
                                        <span className="hx-row__main">
                                            <span className="hx-row__label">{item.title}</span>
                                            <span className="hx-row__sub">{item.detail}</span>
                                        </span>
                                        <span className="hx-row__meta">{item.time}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="hx-span-4 hx-stack">
                        <HomeCalendarCard today={now} />
                    </div>
                    </section>

                    <footer className="hx-foot dash-reveal">
                        <span className="hx-pill hx-pill--quiet">
                            <span className="material-icons-round">auto_awesome</span>
                            {loading ? 'Syncing facility data…' : `${facilityShort} · all data synced`}
                        </span>
                    </footer>
                </div>
            </main>
        </div>
    );
}
