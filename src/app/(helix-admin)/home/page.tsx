'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Montserrat } from 'next/font/google';
import TopBar from '@/components/TopBar';
import { parseBulkUploadHistoryResponse, type BulkUploadHistoryEntry } from '@/lib/bulk-upload-history';
import { fetchMergedFacilityPresenceOnline } from '@/lib/presence-online';

type SimpleItem = Record<string, unknown>;
type ActivityItem = { id: string; title: string; detail: string; time: string; tone?: 'default' | 'critical' | 'info' };
type SignedInStaff = { id: string; name: string; initials: string; role: string; when: string; status: 'online' | 'recent' | 'away' };

const montserrat = Montserrat({
    subsets: ['latin'],
    weight: ['600', '800'],
});

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

/** Map GET /presence/online payload to UI rows (supports several backend shapes). */
function parsePresenceOnlineToSignedIn(raw: unknown, max: number): SignedInStaff[] {
    const list = getList(raw, ['data', 'items', 'online', 'staff', 'users', 'results', 'presence', 'records']);
    if (!Array.isArray(list) || list.length === 0) return [];
    const rows: SignedInStaff[] = [];
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
        const id = String(rec.id || rec.staff_id || rec.user_id || `presence-${idx}`);
        rows.push({
            id,
            name: fullName,
            initials,
            role,
            when: whenRaw ? toWhenLabel(whenRaw) : 'Active now',
            status: 'online',
        });
    }
    return rows.slice(0, max);
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

function todayLabel(): string {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function summarizeImport(entry: BulkUploadHistoryEntry): ActivityItem {
    return {
        id: `import-${entry.id}`,
        title: entry.status === 'error' ? 'Import failed' : 'Bulk upload completed',
        detail: `${entry.file} • ${entry.records.toLocaleString()} records`,
        time: entry.date,
        tone: entry.status === 'error' ? 'critical' : 'info',
    };
}

function CardWatermark({ icon }: { icon: string }) {
    return (
        <div
            aria-hidden
            style={{
                position: 'absolute',
                right: -18,
                bottom: -24,
                width: 140,
                height: 140,
                borderRadius: '50%',
                background: 'radial-gradient(circle at center, rgba(51,65,85,0.12) 0%, rgba(51,65,85,0.05) 58%, rgba(51,65,85,0) 100%)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
            }}
        >
            <span className="material-icons-round" style={{ fontSize: 78, color: 'rgba(51,65,85,0.12)' }}>
                {icon}
            </span>
        </div>
    );
}

export default function HomePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [staffCount, setStaffCount] = useState(0);
    const [patientCount, setPatientCount] = useState(0);
    const [teamCount, setTeamCount] = useState(0);
    const [departmentCount, setDepartmentCount] = useState(0);
    const [escalationCount, setEscalationCount] = useState(0);
    const [failedImports24h, setFailedImports24h] = useState(0);
    const [setupTasks, setSetupTasks] = useState(0);
    const [recent, setRecent] = useState<ActivityItem[]>([]);
    const [firstName, setFirstName] = useState('');
    const [facilityName, setFacilityName] = useState('');
    const [lastFailedImport, setLastFailedImport] = useState<BulkUploadHistoryEntry | null>(null);
    const [twoFactorAdoption, setTwoFactorAdoption] = useState<{ enabled: number; total: number }>({ enabled: 0, total: 0 });
    const [criticalRoleFill, setCriticalRoleFill] = useState<{ filled: number; total: number; percent: number }>({ filled: 0, total: 0, percent: 0 });
    const [avgCriticalAckMinutes, setAvgCriticalAckMinutes] = useState(0);
    const [latestAuditAt, setLatestAuditAt] = useState<string>('');
    const [activeSessions, setActiveSessions] = useState(0);
    const [signedInStaff, setSignedInStaff] = useState<SignedInStaff[]>([]);
    /** Presence API returned 200 with an empty list (not the same as fetch failure). */
    const [presenceReportedNoOnline, setPresenceReportedNoOnline] = useState(false);

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

            // Currently signed in: prefer GET /presence/online, else staff last_login heuristic
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
                .slice(0, 5)
                .map(({ _ts, ...rest }) => { void _ts; return rest; });

            const fromPresence = presenceReallyOk && presenceMergedPayload
                ? parsePresenceOnlineToSignedIn(presenceMergedPayload, 8)
                : [];
            if (fromPresence.length > 0) {
                setSignedInStaff(fromPresence);
                setPresenceReportedNoOnline(false);
            } else {
                setSignedInStaff(withLogin);
                setPresenceReportedNoOnline(Boolean(presenceReallyOk) && presenceBundle.items.length === 0);
            }
            setPatientCount(readTotal(patientJson, patientItems.length));
            setTeamCount(readTotal(teamsJson, teamItems.length));
            setDepartmentCount(readTotal(departmentsJson, departmentItems.length));
            setEscalationCount(escalationItems.length);

            const teamsWithoutLead = teamItems.filter(t => !String(t.lead_id || '').trim()).length;
            const teamsWithoutMembers = teamItems.filter(t => {
                const c = Number(t.member_count ?? 0);
                return !Number.isFinite(c) || c <= 0;
            }).length;
            const departmentsWithoutName = departmentItems.filter(d => !String(d.name || d.department_name || '').trim()).length;
            const escalationsMissingSteps = escalationItems.filter(p => !Array.isArray(p.steps) || p.steps.length === 0).length;
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
            setLastFailedImport(failedRows[0] || null);

            const auditList = getList(auditJson, ['items', 'data', 'logs']) as SimpleItem[];
            if (auditList.length > 0) {
                const first = auditList[0] as Record<string, unknown>;
                const ts = String(first.timestamp || first.created_at || '');
                if (ts) setLatestAuditAt(ts);
            }

            const sessionList = getList(sessionsJson, ['items', 'data', 'sessions']);
            setActiveSessions(sessionList.length);

            const auditRecent: ActivityItem[] = auditList.slice(0, 3).map((row, idx) => {
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

            const importRecent = historyRows.slice(0, 1).map(summarizeImport);
            setRecent([...importRecent, ...auditRecent].slice(0, 3));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchHomeData(); }, [fetchHomeData]);

    const facilityShort = facilityName ? facilityName : 'Your facility';
    const kpis = useMemo(() => ([
        {
            label: 'Active Patients',
            subLabel: 'Currently enrolled',
            value: patientCount,
            icon: 'groups',
            iconBg: '#EEF2F7', iconFg: '#334155',
            footerLabel: 'Facility',
            footerValue: facilityShort,
            tone: 'default' as const,
        },
        {
            label: 'Total Staff',
            subLabel: 'All roles',
            value: staffCount,
            icon: 'badge',
            iconBg: '#EEF2F7', iconFg: '#334155',
            footerLabel: 'Across',
            footerValue: facilityShort,
            tone: 'default' as const,
        },
        {
            label: 'Critical Role Fill',
            subLabel: 'On-call coverage',
            value: criticalRoleFill.percent,
            valueSuffix: '%',
            icon: 'medical_services',
            iconBg: '#EEF2F7', iconFg: '#334155',
            footerLabel: 'Filled',
            footerValue: `${criticalRoleFill.filled.toLocaleString()} / ${criticalRoleFill.total.toLocaleString()} roles`,
            tone: criticalRoleFill.total > 0 && criticalRoleFill.percent < 80 ? 'critical' as const : 'default' as const,
        },
        {
            label: 'Active Escalations',
            subLabel: 'Last 24h',
            value: escalationCount,
            icon: 'priority_high',
            iconBg: '#F3F4F6', iconFg: '#475569',
            footerLabel: 'Status',
            footerValue: escalationCount > 0 ? 'Requires attention' : 'All clear',
            tone: 'critical' as const,
        },
    ]), [patientCount, staffCount, criticalRoleFill, escalationCount, facilityShort]);

    const quickActions = [
        { label: 'Add role', sub: 'Roles', icon: 'badge', iconBg: '#EEF2F7', iconFg: '#334155', href: '/roles' },
        { label: 'Add Staff Member', sub: 'Staff', icon: 'person_add', iconBg: '#EEF2F7', iconFg: '#334155', href: '/staff' },
        { label: 'Create Provider Team', sub: 'Teams', icon: 'groups', iconBg: '#EEF2F7', iconFg: '#334155', href: '/provider-teams' },
        { label: 'Escalation Config', sub: 'Escalation', icon: 'notifications_active', iconBg: '#EEF2F7', iconFg: '#334155', href: '/escalation' },
    ];

    const openAlerts = (failedImports24h > 0 ? 1 : 0) + (setupTasks > 0 ? 1 : 0);

    return (
        <div className={`app-main ${montserrat.className}`}>
            <TopBar title="Home" subtitle="Overview" />
            <main
                style={{
                    position: 'relative',
                    flex: 1,
                    minWidth: 0,
                    overflow: 'auto',
                    padding: '32px 36px 48px',
                    background: '#F8F9FB',
                }}
            >
                {/* Ambient animated orbs */}
                <div className="home-bg-layer" aria-hidden>
                    <div className="home-orb home-orb-1" />
                    <div className="home-orb home-orb-2" />
                    <div className="home-orb home-orb-3" />
                </div>

                {/* Greeting header */}
                <div className="home-fade-in" style={{ position: 'relative', zIndex: 1, animationDelay: '0ms', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
                    <div>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                            {todayLabel()}
                        </p>
                        <h2 style={{ margin: 0, fontSize: 24, color: '#0F172A', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                            {greetingByTime()}{firstName ? `, ${firstName}` : ''}
                        </h2>
                        <p style={{ marginTop: 4, fontSize: 13, color: '#64748B', fontWeight: 500, lineHeight: 1.4 }}>
                            {facilityName ? `Operational overview for ${facilityName}` : 'Operational overview for your facility'}
                        </p>
                    </div>
                    <button
                        onClick={fetchHomeData}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.background = '#F8FAFC'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#FFFFFF'; }}
                    >
                        <span className="material-icons-round" style={{ fontSize: 15 }}>refresh</span>
                        Refresh
                    </button>
                </div>

                {/* KPI row */}
                <div className="home-fade-in" style={{ position: 'relative', zIndex: 1, animationDelay: '60ms', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 20 }}>
                    {kpis.map((kpi) => {
                        const isCritical = kpi.tone === 'critical';
                        return (
                            <div
                                key={kpi.label}
                                style={{
                                    position: 'relative',
                                    padding: 20,
                                    background: 'rgba(255,255,255,0.9)',
                                    border: '1px solid #E3E8EE',
                                    borderRadius: 16,
                                    boxShadow: '0 8px 24px rgba(15,23,42,0.05)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 14,
                                    minHeight: 172,
                                    overflow: 'hidden',
                                }}
                            >
                                <CardWatermark icon={kpi.icon} />
                                {/* Header: icon + title + sub-pill */}
                                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
                                        <div
                                            style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 12,
                                                background: kpi.iconBg,
                                                color: kpi.iconFg,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                            }}
                                        >
                                            <span className="material-icons-round" style={{ fontSize: 20, fontWeight: 900 }}>{kpi.icon}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', lineHeight: 1.25 }}>
                                                {kpi.label}
                                            </div>
                                            <span
                                                style={{
                                                    alignSelf: 'flex-start',
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                    color: '#475569',
                                                    background: '#EEF2F7',
                                                    padding: '3px 10px',
                                                    borderRadius: 999,
                                                }}
                                            >
                                                {kpi.subLabel}
                                            </span>
                                        </div>
                                    </div>
                                    {isCritical && kpi.value > 0 ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, color: '#B91C1C', flexShrink: 0 }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#DC2626' }} />
                                            Active
                                        </span>
                                    ) : null}
                                </div>

                                {/* Big value */}
                                <div
                                    style={{
                                        position: 'relative',
                                        zIndex: 1,
                                        fontSize: 38,
                                        fontWeight: 800,
                                        color: isCritical ? '#DC2626' : '#0F172A',
                                        lineHeight: 1,
                                        letterSpacing: '-0.02em',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {loading ? '—' : `${kpi.value.toLocaleString()}${kpi.valueSuffix ?? ''}`}
                                </div>

                                {/* Dashed footer */}
                                <div style={{ position: 'relative', zIndex: 1, borderTop: '1px dashed #E2E8F0', marginTop: 'auto' }} />
                                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                    <span style={{ fontSize: 11.5, color: '#94A3B8' }}>{kpi.footerLabel}</span>
                                    <span style={{ fontSize: 11.5, fontWeight: 700, color: isCritical ? '#B91C1C' : '#0F172A', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>
                                        {kpi.footerValue}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Attention strip */}
                {!loading && openAlerts > 0 && (
                    <div className="home-fade-in" style={{ position: 'relative', zIndex: 1, animationDelay: '120ms', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, marginBottom: 20, boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
                        <CardWatermark icon="monitor_heart" />
                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderRight: '1px solid #F1F3F7' }}>
                            <span style={{ width: 36, height: 36, borderRadius: 10, background: failedImports24h > 0 ? '#FEF2F2' : '#F0FDF4', color: failedImports24h > 0 ? '#991B1B' : '#166534', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span className="material-icons-round" style={{ fontSize: 18 }}>{failedImports24h > 0 ? 'error_outline' : 'check_circle_outline'}</span>
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>
                                    {failedImports24h > 0 ? `${failedImports24h} failed import${failedImports24h === 1 ? '' : 's'}` : 'Imports healthy'}
                                </div>
                                <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                                    {failedImports24h > 0
                                        ? `Last 24h${lastFailedImport ? ` — ${lastFailedImport.file}` : ''}`
                                        : 'No failures in the last 24 hours'}
                                </div>
                            </div>
                            <button
                                onClick={() => router.push('/staff')}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#475569', background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', flexShrink: 0 }}
                            >
                                Review
                                <span className="material-icons-round" style={{ fontSize: 13 }}>arrow_forward</span>
                            </button>
                        </div>
                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px' }}>
                            <span style={{ width: 36, height: 36, borderRadius: 10, background: setupTasks > 0 ? '#FFFBEB' : '#F0FDF4', color: setupTasks > 0 ? '#92400E' : '#166534', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span className="material-icons-round" style={{ fontSize: 18 }}>{setupTasks > 0 ? 'tune' : 'task_alt'}</span>
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>
                                    {setupTasks > 0 ? `${setupTasks} setup task${setupTasks === 1 ? '' : 's'} pending` : 'Configuration complete'}
                                </div>
                                <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                                    {setupTasks > 0 ? 'Teams, escalations & departments' : 'All systems fully configured'}
                                </div>
                            </div>
                            {setupTasks > 0 && (
                                <button
                                    onClick={() => router.push('/provider-teams')}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#475569', background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', flexShrink: 0 }}
                                >
                                    Resolve
                                    <span className="material-icons-round" style={{ fontSize: 13 }}>arrow_forward</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Quick Actions — horizontal row */}
                <div className="home-fade-in" style={{ position: 'relative', zIndex: 1, animationDelay: '180ms', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                    {quickActions.map((action) => (
                        <button
                            key={action.label}
                            onClick={() => router.push(action.href)}
                            style={{
                                position: 'relative',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: '14px 16px',
                                background: '#FFFFFF',
                                border: '1px solid #E2E8F0',
                                borderRadius: 12,
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'border-color 0.15s, box-shadow 0.15s',
                                boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(15,23,42,0.08)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.04)'; }}
                        >
                            <span style={{ width: 36, height: 36, borderRadius: 10, background: '#F1F5F9', color: '#334155', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span className="material-icons-round" style={{ fontSize: 18 }}>{action.icon}</span>
                            </span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>{action.label}</span>
                                <span style={{ display: 'block', fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{action.sub}</span>
                            </span>
                            <span className="material-icons-round" style={{ fontSize: 16, color: '#CBD5E1', flexShrink: 0 }}>chevron_right</span>
                        </button>
                    ))}
                </div>

                {/* Main content — two columns */}
                <div className="home-fade-in" style={{ position: 'relative', zIndex: 1, animationDelay: '240ms', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

                    {/* Left: Currently signed in */}
                    <div style={{ position: 'relative', overflow: 'hidden', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
                        <CardWatermark icon="groups_2" />
                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F1F3F7' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ width: 34, height: 34, borderRadius: 9, background: '#F1F5F9', color: '#334155', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span className="material-icons-round" style={{ fontSize: 17 }}>groups_2</span>
                                </span>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>Currently Signed In</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} />
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>
                                            {loading ? '—' : `${signedInStaff.filter((s) => s.status === 'online').length} online`}
                                        </span>
                                        {!loading && signedInStaff.length > 0 && (
                                            <span style={{ fontSize: 11, color: '#94A3B8' }}>&middot; {signedInStaff.length} total</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => router.push('/staff')}
                                style={{ fontSize: 11, fontWeight: 600, color: '#475569', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                            >
                                View all
                                <span className="material-icons-round" style={{ fontSize: 14 }}>chevron_right</span>
                            </button>
                        </div>
                        <div style={{ position: 'relative', zIndex: 1, padding: '8px 12px' }}>
                            {loading ? (
                                <div style={{ fontSize: 12, color: '#94A3B8', padding: '16px 8px' }}>Loading…</div>
                            ) : signedInStaff.length === 0 ? (
                                <div style={{ fontSize: 12, color: '#94A3B8', padding: '16px 8px' }}>
                                    {presenceReportedNoOnline ? 'No one online right now.' : 'No recent sign-ins recorded.'}
                                </div>
                            ) : signedInStaff.map((s) => {
                                const dot = s.status === 'online' ? '#22C55E' : s.status === 'recent' ? '#94A3B8' : '#CBD5E1';
                                return (
                                    <div
                                        key={s.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: '10px 8px',
                                            borderBottom: '1px solid #F8F9FB',
                                        }}
                                    >
                                        <div style={{ position: 'relative', flexShrink: 0 }}>
                                            <span style={{
                                                width: 32, height: 32, borderRadius: '50%',
                                                background: '#F1F5F9', color: '#475569',
                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 11, fontWeight: 800, letterSpacing: '0.02em',
                                            }}>
                                                {s.initials}
                                            </span>
                                            <span
                                                aria-hidden
                                                style={{
                                                    position: 'absolute', right: -1, bottom: -1,
                                                    width: 10, height: 10, borderRadius: '50%',
                                                    background: dot, border: '2px solid #FFFFFF',
                                                }}
                                            />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {s.name}
                                            </span>
                                            <span style={{ display: 'block', fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {s.role}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: 10.5, fontWeight: 600, color: '#94A3B8', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                            {s.when}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right column: System Health + Recent Activity */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                        {/* System Health */}
                        <div style={{ position: 'relative', overflow: 'hidden', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
                            <CardWatermark icon="verified_user" />
                            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F1F3F7' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ width: 34, height: 34, borderRadius: 9, background: '#F1F5F9', color: '#334155', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span className="material-icons-round" style={{ fontSize: 17 }}>shield</span>
                                    </span>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>System Health</div>
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 600, color: failedImports24h > 0 ? '#B91C1C' : '#059669', background: failedImports24h > 0 ? '#FEF2F2' : '#F0FDF4', padding: '3px 10px', borderRadius: 999 }}>
                                    {failedImports24h > 0 ? 'Attention' : 'Healthy'}
                                </span>
                            </div>

                            {(() => {
                                const twoFactorPct = twoFactorAdoption.total > 0 ? Math.round((twoFactorAdoption.enabled / twoFactorAdoption.total) * 100) : 0;
                                const ackMin = avgCriticalAckMinutes;
                                const ackLabel = ackMin <= 0 ? '—' : ackMin < 1 ? '<1 min' : ackMin < 60 ? `${Math.round(ackMin)} min` : `${(ackMin / 60).toFixed(1)} hr`;

                                const healthRows = [
                                    {
                                        icon: 'bolt',
                                        label: 'Critical Ack Time',
                                        value: loading ? '—' : ackLabel,
                                        sub: 'Avg, last 30d',
                                        color: ackMin > 0 && ackMin > 15 ? '#DC2626' : ackMin > 0 ? '#059669' : '#475569',
                                    },
                                    {
                                        icon: 'lock',
                                        label: '2FA Adoption',
                                        value: loading ? '—' : `${twoFactorPct}%`,
                                        sub: `${twoFactorAdoption.enabled}/${twoFactorAdoption.total}`,
                                        color: twoFactorPct >= 80 ? '#059669' : twoFactorPct >= 50 ? '#D97706' : '#DC2626',
                                    },
                                    {
                                        icon: 'sync',
                                        label: 'Data Sync',
                                        value: failedImports24h > 0 ? `${failedImports24h} failed` : 'Clean',
                                        sub: 'Last 24h',
                                        color: failedImports24h > 0 ? '#DC2626' : '#059669',
                                    },
                                    {
                                        icon: 'devices',
                                        label: 'Active Sessions',
                                        value: loading ? '—' : activeSessions.toLocaleString(),
                                        sub: activeSessions === 1 ? 'Your session' : 'Signed in',
                                        color: '#475569',
                                    },
                                ];

                                return (
                                    <div style={{ position: 'relative', zIndex: 1, padding: '4px 12px' }}>
                                        {healthRows.map((r, idx) => (
                                            <div
                                                key={r.label}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    padding: '12px 8px',
                                                    borderBottom: idx < healthRows.length - 1 ? '1px solid #F8F9FB' : 'none',
                                                }}
                                            >
                                                <span style={{ width: 30, height: 30, borderRadius: 8, background: '#F8F9FB', color: '#64748B', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <span className="material-icons-round" style={{ fontSize: 15 }}>{r.icon}</span>
                                                </span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{r.label}</span>
                                                    <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 6 }}>{r.sub}</span>
                                                </div>
                                                <span style={{ fontSize: 12.5, fontWeight: 800, color: r.color, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                                                    {r.value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Recent Activity */}
                        <div style={{ position: 'relative', overflow: 'hidden', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
                            <CardWatermark icon="history" />
                            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F1F3F7' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ width: 34, height: 34, borderRadius: 9, background: '#F1F5F9', color: '#334155', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span className="material-icons-round" style={{ fontSize: 17 }}>history</span>
                                    </span>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>Recent Activity</div>
                                </div>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#64748B' }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} />
                                    Live
                                </span>
                            </div>
                            <div style={{ position: 'relative', zIndex: 1, padding: '4px 20px 12px' }}>
                                {recent.length === 0 ? (
                                    <div style={{ padding: '16px 0', color: '#94A3B8', fontSize: 12 }}>
                                        {loading ? 'Loading…' : 'No recent activity'}
                                    </div>
                                ) : (
                                    <div style={{ position: 'relative', paddingLeft: 20 }}>
                                        <div
                                            aria-hidden
                                            style={{
                                                position: 'absolute',
                                                left: 8,
                                                top: 20,
                                                bottom: 20,
                                                width: 1.5,
                                                background: '#E6EBF2',
                                                borderRadius: 2,
                                            }}
                                        />
                                        {recent.map((item, idx) => {
                                            const iconName = item.tone === 'critical' ? 'warning' : item.tone === 'info' ? 'shield' : 'edit';
                                            return (
                                                <div key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 0', position: 'relative', borderBottom: idx < recent.length - 1 ? '1px solid #F8F9FB' : 'none' }}>
                                                    <span
                                                        style={{
                                                            marginLeft: -20,
                                                            width: 18,
                                                            height: 18,
                                                            borderRadius: '50%',
                                                            flexShrink: 0,
                                                            border: '2px solid #FFFFFF',
                                                            background: '#64748B',
                                                            color: '#FFFFFF',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            zIndex: 1,
                                                            marginTop: 2,
                                                        }}
                                                    >
                                                        <span className="material-icons-round" style={{ fontSize: 10 }}>{iconName}</span>
                                                    </span>
                                                    <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>{item.title}</span>
                                                        <span style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.detail}</span>
                                                    </div>
                                                    <span style={{ fontSize: 10.5, fontWeight: 600, color: '#94A3B8', flexShrink: 0, whiteSpace: 'nowrap', marginTop: 2 }}>
                                                        {item.time}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
