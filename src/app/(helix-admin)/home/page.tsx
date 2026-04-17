'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Montserrat } from 'next/font/google';
import TopBar from '@/components/TopBar';
import { parseBulkUploadHistoryResponse, type BulkUploadHistoryEntry } from '@/lib/bulk-upload-history';

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
    const [staffByRole, setStaffByRole] = useState({ doctors: 0, nurses: 0, techs: 0, admins: 0, other: 0 });
    const [twoFactorAdoption, setTwoFactorAdoption] = useState<{ enabled: number; total: number }>({ enabled: 0, total: 0 });
    const [latestAuditAt, setLatestAuditAt] = useState<string>('');
    const [activeSessions, setActiveSessions] = useState(0);
    const [signedInStaff, setSignedInStaff] = useState<SignedInStaff[]>([]);

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
            ] = await Promise.all([
                fetch('/api/proxy/auth/me'),
                fetch('/api/proxy/hospital'),
                fetch('/api/proxy/staff?page_size=100&page_id=1'),
                fetch('/api/proxy/patients?page_size=20&page_id=1'),
                fetch('/api/proxy/teams'),
                fetch('/api/proxy/departments'),
                fetch('/api/proxy/escalation-policies'),
                fetch('/api/proxy/audit-logs?page_size=5&page_id=1'),
                fetch('/api/proxy/bulk-upload-history?kind=staff&page_size=20'),
                fetch('/api/proxy/bulk-upload-history?kind=patient&page_size=20'),
                fetch('/api/proxy/auth/sessions'),
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
            ]);

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

            // Staff breakdown by role
            const roleBreakdown = { doctors: 0, nurses: 0, techs: 0, admins: 0, other: 0 };
            let twoFactorEnabled = 0;
            for (const s of staffItems) {
                const rec = s as Record<string, unknown>;
                const role = String(rec.system_role || rec.role || rec.job_title || '').toLowerCase();
                if (role.includes('admin')) roleBreakdown.admins += 1;
                else if (role.includes('nurse')) roleBreakdown.nurses += 1;
                else if (/doctor|dr\.|physician|surgeon|ologist|resident|fellow|attending|intensivist|pediatrician|anaesth|anesth/.test(role)) roleBreakdown.doctors += 1;
                else if (/tech|therapist|radiographer|pharmacist|lab/.test(role)) roleBreakdown.techs += 1;
                else roleBreakdown.other += 1;
                if (rec.otp_enabled === true || rec.two_factor_enabled === true || rec.twoFactorEnabled === true) twoFactorEnabled += 1;
            }
            setStaffByRole(roleBreakdown);
            setTwoFactorAdoption({ enabled: twoFactorEnabled, total: staffItems.length });

            // Currently signed-in staff (ranked by most recent last_login)
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
            setSignedInStaff(withLogin);
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
            iconBg: '#DBEAFE', iconFg: '#1D4ED8',
            footerLabel: 'Facility',
            footerValue: facilityShort,
            tone: 'default' as const,
        },
        {
            label: 'Total Staff',
            subLabel: 'All roles',
            value: staffCount,
            icon: 'badge',
            iconBg: '#CCFBF1', iconFg: '#0D9488',
            footerLabel: 'Across',
            footerValue: facilityShort,
            tone: 'default' as const,
        },
        {
            label: 'Provider Teams',
            subLabel: 'Care teams',
            value: teamCount,
            icon: 'workspaces',
            iconBg: '#E0E7FF', iconFg: '#4F46E5',
            footerLabel: 'Departments',
            footerValue: departmentCount.toLocaleString(),
            tone: 'default' as const,
        },
        {
            label: 'Active Escalations',
            subLabel: 'Last 24h',
            value: escalationCount,
            icon: 'priority_high',
            iconBg: '#FEE2E2', iconFg: '#B91C1C',
            footerLabel: 'Status',
            footerValue: escalationCount > 0 ? 'Requires attention' : 'All clear',
            tone: 'critical' as const,
        },
    ]), [patientCount, staffCount, teamCount, departmentCount, escalationCount, facilityShort]);

    const quickActions = [
        { label: 'Add role', sub: 'Roles', icon: 'badge', iconBg: '#DBEAFE', iconFg: '#1D4ED8', href: '/roles' },
        { label: 'Add Staff Member', sub: 'Staff', icon: 'person_add', iconBg: '#CCFBF1', iconFg: '#0D9488', href: '/staff' },
        { label: 'Create Provider Team', sub: 'Teams', icon: 'groups', iconBg: '#E0E7FF', iconFg: '#4F46E5', href: '/provider-teams' },
        { label: 'Escalation Config', sub: 'Escalation', icon: 'notifications_active', iconBg: '#FEF3C7', iconFg: '#D97706', href: '/escalation' },
    ];

    const openAlerts = (failedImports24h > 0 ? 1 : 0) + (setupTasks > 0 ? 1 : 0);

    return (
        <div className={`app-main ${montserrat.className}`}>
            <TopBar title="Home" subtitle="Overview" />
            <main
                style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'auto',
                    padding: '28px 32px 40px',
                    background: '#F5F6F8',
                }}
            >
                {/* Greeting */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 26, color: '#0F172A', fontWeight: 800, letterSpacing: '-0.01em' }}>
                            {greetingByTime()}{firstName ? `, ${firstName}` : ''}
                        </h2>
                        <p style={{ marginTop: 6, fontSize: 13, color: '#64748B' }}>
                            {facilityName ? `Operational overview for ${facilityName}.` : 'Operational overview for your facility.'}
                        </p>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#FFFFFF', border: '1px solid #EEF1F5', borderRadius: 999, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                        <span className="material-icons-round" style={{ fontSize: 16, fontWeight: 900, color: '#0F172A' }}>event</span>
                        {todayLabel()}
                    </div>
                </div>

                {/* KPI row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 20 }}>
                    {kpis.map((kpi) => {
                        const isCritical = kpi.tone === 'critical';
                        return (
                            <div
                                key={kpi.label}
                                style={{
                                    position: 'relative',
                                    padding: 20,
                                    background: '#FFFFFF',
                                    border: '1px solid #EEF1F5',
                                    borderRadius: 16,
                                    boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 14,
                                    minHeight: 172,
                                }}
                            >
                                {/* Header: icon + title + sub-pill */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
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
                                        fontSize: 38,
                                        fontWeight: 800,
                                        color: isCritical ? '#DC2626' : '#0F172A',
                                        lineHeight: 1,
                                        letterSpacing: '-0.02em',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {loading ? '—' : kpi.value.toLocaleString()}
                                </div>

                                {/* Dashed footer */}
                                <div style={{ borderTop: '1px dashed #E2E8F0', marginTop: 'auto' }} />
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                    <span style={{ fontSize: 11.5, color: '#94A3B8' }}>{kpi.footerLabel}</span>
                                    <span style={{ fontSize: 11.5, fontWeight: 700, color: isCritical ? '#B91C1C' : '#0F172A', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>
                                        {kpi.footerValue}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
                    {/* Left column: Needs Attention + Staff Breakdown */}
                    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ background: '#FFFFFF', border: '1px solid #EEF1F5', borderRadius: 16, boxShadow: '0 1px 2px rgba(15,23,42,0.03)', overflow: 'hidden' }}>
                            {/* Section header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid #EEF1F5' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FEE2E2', color: '#B91C1C', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span className="material-icons-round" style={{ fontSize: 20, fontWeight: 900 }}>warning_amber</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', lineHeight: 1.25 }}>Needs Attention</div>
                                        <span style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, color: openAlerts > 0 ? '#B91C1C' : '#059669', background: openAlerts > 0 ? '#FEE2E2' : '#D1FAE5', padding: '3px 10px', borderRadius: 999 }}>
                                            {loading ? 'Checking…' : openAlerts > 0 ? `${openAlerts} open` : 'All clear'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => router.push('/audit-log')}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#334155', background: '#F1F5F9', border: 'none', borderRadius: 999, padding: '7px 14px', cursor: 'pointer' }}
                                >
                                    View all
                                    <span className="material-icons-round" style={{ fontSize: 14, fontWeight: 900 }}>arrow_forward</span>
                                </button>
                            </div>

                            {/* Alert row 1 */}
                            <div style={{ display: 'flex', gap: 14, padding: '18px 20px', borderBottom: '1px solid #F1F3F7' }}>
                                <span
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 12,
                                        background: failedImports24h > 0 ? '#FEE2E2' : '#D1FAE5',
                                        color: failedImports24h > 0 ? '#B91C1C' : '#047857',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}
                                >
                                    <span className="material-icons-round" style={{ fontSize: 20, fontWeight: 900 }}>
                                        {failedImports24h > 0 ? 'block' : 'check_circle'}
                                    </span>
                                </span>
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                                                {failedImports24h > 0 ? 'Failed bulk imports' : 'Bulk imports healthy'}
                                            </div>
                                            <span style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, color: failedImports24h > 0 ? '#B91C1C' : '#047857', background: failedImports24h > 0 ? '#FEE2E2' : '#D1FAE5', padding: '3px 10px', borderRadius: 999 }}>
                                                {failedImports24h > 0 ? 'Import error' : 'Healthy'}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', background: '#F1F5F9', padding: '4px 10px', borderRadius: 999, flexShrink: 0, whiteSpace: 'nowrap' }}>
                                            {loading ? '—' : lastFailedImport ? toWhenLabel(lastFailedImport.date) : 'Last 24h'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.55 }}>
                                        {loading
                                            ? 'Checking recent import activity…'
                                            : failedImports24h > 0
                                                ? `${failedImports24h.toLocaleString()} import ${failedImports24h === 1 ? 'job' : 'jobs'} failed in the last 24 hours${lastFailedImport ? ` — latest: ${lastFailedImport.file}` : ''}. Review the logs to re-run or resolve row-level errors.`
                                                : 'No failed imports in the last 24 hours. Uploads are running cleanly.'}
                                    </div>
                                    <div style={{ borderTop: '1px dashed #E2E8F0', marginTop: 4 }} />
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                        <span style={{ fontSize: 11.5, color: '#94A3B8' }}>Action</span>
                                        <button
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0F172A', color: '#FFFFFF', borderRadius: 999, padding: '7px 14px', fontWeight: 700, fontSize: 11, border: 'none', cursor: 'pointer' }}
                                            onClick={() => router.push('/staff')}
                                        >
                                            Review Import History
                                            <span className="material-icons-round" style={{ fontSize: 14, fontWeight: 900 }}>arrow_forward</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Alert row 2 */}
                            <div style={{ display: 'flex', gap: 14, padding: '18px 20px' }}>
                                <span
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 12,
                                        background: setupTasks > 0 ? '#FEF3C7' : '#D1FAE5',
                                        color: setupTasks > 0 ? '#B45309' : '#047857',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}
                                >
                                    <span className="material-icons-round" style={{ fontSize: 20, fontWeight: 900 }}>
                                        {setupTasks > 0 ? 'assignment' : 'task_alt'}
                                    </span>
                                </span>
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                                                {setupTasks > 0 ? 'Configuration incomplete' : 'Configuration complete'}
                                            </div>
                                            <span style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, color: setupTasks > 0 ? '#B45309' : '#047857', background: setupTasks > 0 ? '#FEF3C7' : '#D1FAE5', padding: '3px 10px', borderRadius: 999 }}>
                                                {setupTasks > 0 ? 'Setup' : 'Complete'}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', background: '#F1F5F9', padding: '4px 10px', borderRadius: 999, flexShrink: 0, whiteSpace: 'nowrap' }}>
                                            {loading ? '—' : setupTasks > 0 ? `${setupTasks} open` : 'All set'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.55 }}>
                                        {loading
                                            ? 'Reviewing setup checklist…'
                                            : setupTasks > 0
                                                ? `${setupTasks.toLocaleString()} setup ${setupTasks === 1 ? 'item needs' : 'items need'} attention across teams, escalation chains, and departments.`
                                                : 'All teams, escalation chains, and departments are fully configured.'}
                                    </div>
                                    {setupTasks > 0 ? (
                                        <>
                                            <div style={{ borderTop: '1px dashed #E2E8F0', marginTop: 4 }} />
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                <span style={{ fontSize: 11.5, color: '#94A3B8' }}>Action</span>
                                                <button
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0F172A', color: '#FFFFFF', borderRadius: 999, padding: '7px 14px', fontWeight: 700, fontSize: 11, border: 'none', cursor: 'pointer' }}
                                                    onClick={() => router.push('/provider-teams')}
                                                >
                                                    Resolve Setup Tasks
                                                    <span className="material-icons-round" style={{ fontSize: 14, fontWeight: 900 }}>arrow_forward</span>
                                                </button>
                                            </div>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        {/* Staff Breakdown */}
                        <div style={{ background: '#FFFFFF', border: '1px solid #EEF1F5', borderRadius: 16, padding: 20, boxShadow: '0 1px 2px rgba(15,23,42,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 12, background: '#CCFBF1', color: '#0D9488', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span className="material-icons-round" style={{ fontSize: 20, fontWeight: 900 }}>groups_2</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', lineHeight: 1.25 }}>Staff Breakdown</div>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, color: '#059669', background: '#D1FAE5', padding: '3px 10px', borderRadius: 999 }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }} />
                                            Live
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => router.push('/staff')}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#334155', background: '#F1F5F9', border: 'none', borderRadius: 999, padding: '7px 14px', cursor: 'pointer' }}
                                >
                                    View directory
                                    <span className="material-icons-round" style={{ fontSize: 14, fontWeight: 900 }}>arrow_forward</span>
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {(() => {
                                    const rows = [
                                        { label: 'Doctors', value: staffByRole.doctors, icon: 'medical_services', fg: '#1D4ED8', bg: '#DBEAFE' },
                                        { label: 'Nurses', value: staffByRole.nurses, icon: 'health_and_safety', fg: '#0D9488', bg: '#CCFBF1' },
                                        { label: 'Technicians', value: staffByRole.techs, icon: 'biotech', fg: '#4F46E5', bg: '#E0E7FF' },
                                        { label: 'Administrators', value: staffByRole.admins, icon: 'admin_panel_settings', fg: '#D97706', bg: '#FEF3C7' },
                                        { label: 'Other staff', value: staffByRole.other, icon: 'badge', fg: '#475569', bg: '#F1F5F9' },
                                    ];
                                    const total = rows.reduce((acc, r) => acc + r.value, 0) || 1;
                                    return rows.map((r) => {
                                        const pct = Math.round((r.value / total) * 100);
                                        return (
                                            <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#F8FAFC', border: '1px solid #EEF1F5', borderRadius: 12 }}>
                                                <span style={{ width: 32, height: 32, borderRadius: 10, background: r.bg, color: r.fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <span className="material-icons-round" style={{ fontSize: 16, fontWeight: 900 }}>{r.icon}</span>
                                                </span>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A', marginBottom: 5 }}>{r.label}</div>
                                                    <div style={{ height: 5, borderRadius: 999, background: '#E2E8F0', overflow: 'hidden' }}>
                                                        <div style={{ width: `${pct}%`, height: '100%', background: r.fg, borderRadius: 999, transition: 'width 0.6s ease' }} />
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                                                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', fontVariantNumeric: 'tabular-nums', minWidth: 24, textAlign: 'right' }}>
                                                        {loading ? '—' : r.value.toLocaleString()}
                                                    </span>
                                                    <span style={{ fontSize: 10, fontWeight: 600, color: r.fg, background: r.bg, padding: '2px 7px', borderRadius: 999, minWidth: 36, textAlign: 'center' }}>
                                                        {loading ? '—' : `${pct}%`}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>

                            <div style={{ borderTop: '1px dashed #E2E8F0', marginTop: 14, paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 11.5, color: '#94A3B8' }}>Total active staff</span>
                                <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>
                                    {loading ? '—' : staffCount.toLocaleString()}
                                </span>
                            </div>

                            {/* Currently signed in */}
                            <div style={{ borderTop: '1px solid #EEF1F5', marginTop: 16, paddingTop: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>Currently signed in</span>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 600, color: '#047857', background: '#D1FAE5', padding: '2px 8px', borderRadius: 999 }}>
                                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#059669' }} />
                                            {signedInStaff.filter((s) => s.status === 'online').length} online
                                        </span>
                                    </div>
                                    <span style={{ fontSize: 10.5, fontWeight: 600, color: '#64748B' }}>
                                        {signedInStaff.length > 0 ? `${signedInStaff.length} recent` : '—'}
                                    </span>
                                </div>

                                {loading ? (
                                    <div style={{ fontSize: 11.5, color: '#94A3B8', padding: '8px 0' }}>Loading signed-in staff…</div>
                                ) : signedInStaff.length === 0 ? (
                                    <div style={{ fontSize: 11.5, color: '#94A3B8', padding: '8px 0' }}>
                                        No recent sign-ins recorded.
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {signedInStaff.map((s) => {
                                            const statusBg = s.status === 'online' ? '#D1FAE5' : s.status === 'recent' ? '#FEF3C7' : '#F1F5F9';
                                            const statusFg = s.status === 'online' ? '#047857' : s.status === 'recent' ? '#B45309' : '#475569';
                                            const dot = s.status === 'online' ? '#059669' : s.status === 'recent' ? '#F59E0B' : '#94A3B8';
                                            const statusLabel = s.status === 'online' ? 'Online' : s.status === 'recent' ? 'Recent' : 'Away';
                                            const avatarBg = s.status === 'online' ? '#D1FAE5' : s.status === 'recent' ? '#FEF3C7' : '#F1F5F9';
                                            const avatarFg = s.status === 'online' ? '#047857' : s.status === 'recent' ? '#B45309' : '#475569';
                                            return (
                                                <div
                                                    key={s.id}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 12,
                                                        padding: '10px 12px',
                                                        background: '#F8FAFC',
                                                        border: '1px solid #EEF1F5',
                                                        borderRadius: 12,
                                                    }}
                                                >
                                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                                        <span style={{ width: 34, height: 34, borderRadius: '50%', background: avatarBg, color: avatarFg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, letterSpacing: '0.02em' }}>
                                                            {s.initials}
                                                        </span>
                                                        <span
                                                            aria-hidden
                                                            style={{
                                                                position: 'absolute',
                                                                right: -2,
                                                                bottom: -2,
                                                                width: 11,
                                                                height: 11,
                                                                borderRadius: '50%',
                                                                background: dot,
                                                                border: '2px solid #F8FAFC',
                                                            }}
                                                        />
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                                                                {s.name}
                                                            </span>
                                                            <span style={{ fontSize: 9.5, fontWeight: 600, color: statusFg, background: statusBg, padding: '2px 7px', borderRadius: 999 }}>
                                                                {statusLabel}
                                                            </span>
                                                        </div>
                                                        <span style={{ fontSize: 10.5, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                                                            {s.role}
                                                        </span>
                                                    </div>
                                                    <span style={{ fontSize: 10.5, fontWeight: 600, color: '#64748B', background: '#F1F5F9', padding: '3px 8px', borderRadius: 999, flexShrink: 0, whiteSpace: 'nowrap' }}>
                                                        {s.when}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Quick Actions + Recent Activity */}
                    <div style={{ minWidth: 0, display: 'grid', gap: 16 }}>
                        {/* Quick Actions */}
                        <div style={{ background: '#FFFFFF', border: '1px solid #EEF1F5', borderRadius: 16, padding: 20, boxShadow: '0 1px 2px rgba(15,23,42,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F1F5F9', color: '#0F172A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span className="material-icons-round" style={{ fontSize: 20, fontWeight: 900 }}>bolt</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', lineHeight: 1.25 }}>Quick Actions</div>
                                        <span style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, color: '#475569', background: '#EEF2F7', padding: '3px 10px', borderRadius: 999 }}>
                                            {quickActions.length} shortcuts
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gap: 10 }}>
                                {quickActions.map((action) => (
                                    <button
                                        key={action.label}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 12,
                                            width: '100%',
                                            padding: 12,
                                            borderRadius: 12,
                                            border: '1px solid #EEF1F5',
                                            background: '#FFFFFF',
                                            color: '#0F172A',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'background 0.15s ease, transform 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; }}
                                        onClick={() => router.push(action.href)}
                                    >
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                            <span
                                                style={{
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: 10,
                                                    background: action.iconBg,
                                                    color: action.iconFg,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <span className="material-icons-round" style={{ fontSize: 18, fontWeight: 900 }}>{action.icon}</span>
                                            </span>
                                            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                                                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{action.label}</span>
                                                <span style={{ alignSelf: 'flex-start', fontSize: 10, fontWeight: 600, color: '#475569', background: '#F1F5F9', padding: '2px 8px', borderRadius: 999 }}>
                                                    {action.sub}
                                                </span>
                                            </span>
                                        </span>
                                        <span
                                            style={{
                                                width: 28,
                                                height: 28,
                                                borderRadius: 999,
                                                background: '#F1F5F9',
                                                color: '#0F172A',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                            }}
                                        >
                                            <span className="material-icons-round" style={{ fontSize: 16, fontWeight: 900 }}>arrow_forward</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div style={{ background: '#FFFFFF', border: '1px solid #EEF1F5', borderRadius: 16, padding: 20, boxShadow: '0 1px 2px rgba(15,23,42,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 12, background: '#E0E7FF', color: '#4F46E5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span className="material-icons-round" style={{ fontSize: 20, fontWeight: 900 }}>history</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', lineHeight: 1.25 }}>Recent Activity</div>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, color: '#059669', background: '#D1FAE5', padding: '3px 10px', borderRadius: 999 }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }} />
                                            Live
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div style={{ position: 'relative', paddingLeft: 24 }}>
                                <div
                                    aria-hidden
                                    style={{
                                        position: 'absolute',
                                        left: 13,
                                        top: 14,
                                        bottom: 14,
                                        width: 2,
                                        background: '#E6EBF2',
                                        borderRadius: 2,
                                    }}
                                />
                                {recent.length === 0 ? (
                                    <div style={{ padding: '12px 0', color: '#94A3B8', fontSize: 12 }}>
                                        {loading ? 'Loading activity…' : 'No recent activity'}
                                    </div>
                                ) : recent.map((item) => {
                                    const iconName = item.tone === 'critical' ? 'warning' : item.tone === 'info' ? 'shield' : 'edit';
                                    const dotBg = item.tone === 'critical' ? '#DC2626' : item.tone === 'info' ? '#2484C7' : '#64748B';
                                    const pillBg = item.tone === 'critical' ? '#FEE2E2' : item.tone === 'info' ? '#DBEAFE' : '#F1F5F9';
                                    const pillFg = item.tone === 'critical' ? '#B91C1C' : item.tone === 'info' ? '#1D4ED8' : '#475569';
                                    const pillLabel = item.tone === 'critical' ? 'Critical' : item.tone === 'info' ? 'Info' : 'Update';
                                    return (
                                        <div key={item.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', position: 'relative' }}>
                                            <span
                                                style={{
                                                    marginLeft: -24,
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: '50%',
                                                    flexShrink: 0,
                                                    border: '3px solid #fff',
                                                    background: dotBg,
                                                    color: '#FFFFFF',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    zIndex: 1,
                                                    boxShadow: '0 0 0 1px #E6EBF2',
                                                }}
                                            >
                                                <span className="material-icons-round" style={{ fontSize: 14, fontWeight: 900 }}>{iconName}</span>
                                            </span>
                                            <div style={{ minWidth: 0, flex: 1, paddingTop: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>{item.title}</span>
                                                    <span style={{ fontSize: 10, fontWeight: 600, color: pillFg, background: pillBg, padding: '2px 8px', borderRadius: 999 }}>
                                                        {pillLabel}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: 11.5, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.detail}</div>
                                            </div>
                                            <span style={{ fontSize: 10.5, fontWeight: 600, color: '#64748B', background: '#F1F5F9', padding: '3px 8px', borderRadius: 999, flexShrink: 0, whiteSpace: 'nowrap', marginTop: 3 }}>
                                                {item.time}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* System Health & Compliance */}
                        <div style={{ background: '#FFFFFF', border: '1px solid #EEF1F5', borderRadius: 16, padding: 20, boxShadow: '0 1px 2px rgba(15,23,42,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 12, background: '#D1FAE5', color: '#047857', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span className="material-icons-round" style={{ fontSize: 20, fontWeight: 900 }}>verified_user</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', lineHeight: 1.25 }}>System Health</div>
                                        <span style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, color: failedImports24h > 0 ? '#B45309' : '#047857', background: failedImports24h > 0 ? '#FEF3C7' : '#D1FAE5', padding: '3px 10px', borderRadius: 999 }}>
                                            {failedImports24h > 0 ? 'Attention needed' : 'All healthy'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => router.push('/audit-log')}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#334155', background: '#F1F5F9', border: 'none', borderRadius: 999, padding: '7px 14px', cursor: 'pointer' }}
                                >
                                    Audit
                                    <span className="material-icons-round" style={{ fontSize: 14, fontWeight: 900 }}>arrow_forward</span>
                                </button>
                            </div>

                            {(() => {
                                const twoFactorPct = twoFactorAdoption.total > 0 ? Math.round((twoFactorAdoption.enabled / twoFactorAdoption.total) * 100) : 0;
                                const twoFactorStatus = twoFactorPct >= 80 ? 'Healthy' : twoFactorPct >= 50 ? 'Improving' : 'Action';
                                const twoFactorPillBg = twoFactorPct >= 80 ? '#D1FAE5' : twoFactorPct >= 50 ? '#FEF3C7' : '#FEE2E2';
                                const twoFactorPillFg = twoFactorPct >= 80 ? '#047857' : twoFactorPct >= 50 ? '#B45309' : '#B91C1C';

                                const importPillBg = failedImports24h > 0 ? '#FEE2E2' : '#D1FAE5';
                                const importPillFg = failedImports24h > 0 ? '#B91C1C' : '#047857';

                                const rows = [
                                    {
                                        icon: 'lock',
                                        iconBg: '#DBEAFE', iconFg: '#1D4ED8',
                                        label: '2FA adoption',
                                        detail: `${twoFactorAdoption.enabled}/${twoFactorAdoption.total} enrolled`,
                                        value: loading ? '—' : `${twoFactorPct}%`,
                                        pillLabel: twoFactorStatus,
                                        pillBg: twoFactorPillBg,
                                        pillFg: twoFactorPillFg,
                                    },
                                    {
                                        icon: 'sync',
                                        iconBg: failedImports24h > 0 ? '#FEE2E2' : '#D1FAE5', iconFg: failedImports24h > 0 ? '#B91C1C' : '#047857',
                                        label: 'Data sync',
                                        detail: failedImports24h > 0 ? `${failedImports24h} failed in 24h` : 'Imports clean',
                                        value: failedImports24h > 0 ? `${failedImports24h}` : 'OK',
                                        pillLabel: failedImports24h > 0 ? 'Degraded' : 'Healthy',
                                        pillBg: importPillBg,
                                        pillFg: importPillFg,
                                    },
                                    {
                                        icon: 'devices',
                                        iconBg: '#E0E7FF', iconFg: '#4F46E5',
                                        label: 'Active sessions',
                                        detail: activeSessions === 1 ? 'Your session' : `${activeSessions} signed in`,
                                        value: loading ? '—' : activeSessions.toLocaleString(),
                                        pillLabel: 'Live',
                                        pillBg: '#E0E7FF',
                                        pillFg: '#4338CA',
                                    },
                                    {
                                        icon: 'fact_check',
                                        iconBg: '#FEF3C7', iconFg: '#D97706',
                                        label: 'Last audit',
                                        detail: latestAuditAt ? `Recorded ${toWhenLabel(latestAuditAt)}` : 'No recent events',
                                        value: latestAuditAt ? toWhenLabel(latestAuditAt) : '—',
                                        pillLabel: latestAuditAt ? 'Tracked' : 'Idle',
                                        pillBg: latestAuditAt ? '#FEF3C7' : '#F1F5F9',
                                        pillFg: latestAuditAt ? '#B45309' : '#475569',
                                    },
                                ];

                                return (
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {rows.map((r) => (
                                            <div
                                                key={r.label}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    padding: '10px 12px',
                                                    background: '#F8FAFC',
                                                    border: '1px solid #EEF1F5',
                                                    borderRadius: 12,
                                                }}
                                            >
                                                <span style={{ width: 32, height: 32, borderRadius: 10, background: r.iconBg, color: r.iconFg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <span className="material-icons-round" style={{ fontSize: 16, fontWeight: 900 }}>{r.icon}</span>
                                                </span>
                                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{r.label}</span>
                                                        <span style={{ fontSize: 9.5, fontWeight: 600, color: r.pillFg, background: r.pillBg, padding: '2px 7px', borderRadius: 999 }}>
                                                            {r.pillLabel}
                                                        </span>
                                                    </div>
                                                    <span style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.detail}</span>
                                                </div>
                                                <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                                                    {r.value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {/* PLACEHOLDER_REMOVE_ROW2_START */}
                <div style={{ display: 'none' }}>
                    {/* Staff on-shift */}
                    <div style={{ background: '#FFFFFF', border: '1px solid #EEF1F5', borderRadius: 16, padding: 20, boxShadow: '0 1px 2px rgba(15,23,42,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#00C8B3', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="material-icons-round" style={{ fontSize: 20, fontWeight: 900 }}>groups_2</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', lineHeight: 1.25 }}>Staff Breakdown</div>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, color: '#059669', background: '#D1FAE5', padding: '3px 10px', borderRadius: 999 }}>
                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }} />
                                        Live
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => router.push('/staff')}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#334155', background: '#F1F5F9', border: 'none', borderRadius: 999, padding: '7px 14px', cursor: 'pointer' }}
                            >
                                View directory
                                <span className="material-icons-round" style={{ fontSize: 14, fontWeight: 900 }}>arrow_forward</span>
                            </button>
                        </div>

                        <div style={{ display: 'grid', gap: 10 }}>
                            {(() => {
                                const rows = [
                                    { label: 'Doctors', value: staffByRole.doctors, icon: 'medical_services', color: '#2484C7', bg: '#DBEAFE' },
                                    { label: 'Nurses', value: staffByRole.nurses, icon: 'health_and_safety', color: '#00C8B3', bg: '#CCFBF1' },
                                    { label: 'Technicians', value: staffByRole.techs, icon: 'biotech', color: '#6974F7', bg: '#E0E7FF' },
                                    { label: 'Administrators', value: staffByRole.admins, icon: 'shield_person', color: '#F59E0B', bg: '#FEF3C7' },
                                    { label: 'Other staff', value: staffByRole.other, icon: 'badge', color: '#64748B', bg: '#F1F5F9' },
                                ];
                                const total = rows.reduce((acc, r) => acc + r.value, 0) || 1;
                                return rows.map((r) => {
                                    const pct = Math.round((r.value / total) * 100);
                                    return (
                                        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span style={{ width: 32, height: 32, borderRadius: 10, background: r.color, color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <span className="material-icons-round" style={{ fontSize: 16, fontWeight: 900 }}>{r.icon}</span>
                                            </span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                                                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>{r.label}</span>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                        <span style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                                                            {loading ? '—' : r.value.toLocaleString()}
                                                        </span>
                                                        <span style={{ fontSize: 10, fontWeight: 600, color: r.color, background: r.bg, padding: '2px 7px', borderRadius: 999 }}>
                                                            {loading ? '—' : `${pct}%`}
                                                        </span>
                                                    </span>
                                                </div>
                                                <div style={{ height: 6, borderRadius: 999, background: '#F1F5F9', overflow: 'hidden' }}>
                                                    <div style={{ width: `${pct}%`, height: '100%', background: r.color, borderRadius: 999, transition: 'width 0.6s ease' }} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        <div style={{ borderTop: '1px dashed #E2E8F0', marginTop: 16, paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 11.5, color: '#94A3B8' }}>Total active staff</span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#0F172A' }}>
                                {loading ? '—' : staffCount.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* System health & compliance */}
                    <div style={{ background: '#FFFFFF', border: '1px solid #EEF1F5', borderRadius: 16, padding: 20, boxShadow: '0 1px 2px rgba(15,23,42,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#059669', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="material-icons-round" style={{ fontSize: 20, fontWeight: 900 }}>verified_user</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', lineHeight: 1.25 }}>System Health & Compliance</div>
                                    <span style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, color: failedImports24h > 0 ? '#B45309' : '#047857', background: failedImports24h > 0 ? '#FEF3C7' : '#D1FAE5', padding: '3px 10px', borderRadius: 999 }}>
                                        {failedImports24h > 0 ? 'Attention needed' : 'All systems healthy'}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => router.push('/audit-log')}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#334155', background: '#F1F5F9', border: 'none', borderRadius: 999, padding: '7px 14px', cursor: 'pointer' }}
                            >
                                Audit log
                                <span className="material-icons-round" style={{ fontSize: 14, fontWeight: 900 }}>arrow_forward</span>
                            </button>
                        </div>

                        {(() => {
                            const twoFactorPct = twoFactorAdoption.total > 0 ? Math.round((twoFactorAdoption.enabled / twoFactorAdoption.total) * 100) : 0;
                            const twoFactorStatus = twoFactorPct >= 80 ? 'Healthy' : twoFactorPct >= 50 ? 'Improving' : 'Action needed';
                            const twoFactorPillBg = twoFactorPct >= 80 ? '#D1FAE5' : twoFactorPct >= 50 ? '#FEF3C7' : '#FEE2E2';
                            const twoFactorPillFg = twoFactorPct >= 80 ? '#047857' : twoFactorPct >= 50 ? '#B45309' : '#B91C1C';

                            const importStatus = failedImports24h > 0 ? 'Degraded' : 'Healthy';
                            const importPillBg = failedImports24h > 0 ? '#FEE2E2' : '#D1FAE5';
                            const importPillFg = failedImports24h > 0 ? '#B91C1C' : '#047857';

                            const rows = [
                                {
                                    icon: 'shield_lock',
                                    iconBg: '#2484C7',
                                    label: 'Two-factor adoption',
                                    detail: `${twoFactorAdoption.enabled.toLocaleString()} of ${twoFactorAdoption.total.toLocaleString()} staff enrolled`,
                                    value: loading ? '—' : `${twoFactorPct}%`,
                                    pillLabel: twoFactorStatus,
                                    pillBg: twoFactorPillBg,
                                    pillFg: twoFactorPillFg,
                                },
                                {
                                    icon: 'sync',
                                    iconBg: failedImports24h > 0 ? '#DC2626' : '#059669',
                                    label: 'Data sync',
                                    detail: failedImports24h > 0
                                        ? `${failedImports24h} failed ${failedImports24h === 1 ? 'import' : 'imports'} in last 24h`
                                        : 'All bulk imports completed successfully',
                                    value: failedImports24h > 0 ? `${failedImports24h}` : 'OK',
                                    pillLabel: importStatus,
                                    pillBg: importPillBg,
                                    pillFg: importPillFg,
                                },
                                {
                                    icon: 'devices',
                                    iconBg: '#6974F7',
                                    label: 'Active sessions',
                                    detail: activeSessions === 1 ? 'Your current session' : `${activeSessions.toLocaleString()} sessions signed in`,
                                    value: loading ? '—' : activeSessions.toLocaleString(),
                                    pillLabel: 'Live',
                                    pillBg: '#E0E7FF',
                                    pillFg: '#4338CA',
                                },
                                {
                                    icon: 'fact_check',
                                    iconBg: '#F59E0B',
                                    label: 'Last audit activity',
                                    detail: latestAuditAt ? `Recorded ${toWhenLabel(latestAuditAt)}` : 'No recent audit events',
                                    value: latestAuditAt ? toWhenLabel(latestAuditAt) : '—',
                                    pillLabel: latestAuditAt ? 'Tracked' : 'Idle',
                                    pillBg: latestAuditAt ? '#FEF3C7' : '#F1F5F9',
                                    pillFg: latestAuditAt ? '#B45309' : '#475569',
                                },
                            ];

                            return (
                                <div style={{ display: 'grid', gap: 10 }}>
                                    {rows.map((r, idx) => (
                                        <div
                                            key={r.label}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 12,
                                                padding: '12px 14px',
                                                background: '#F8FAFC',
                                                border: '1px solid #EEF1F5',
                                                borderRadius: 12,
                                            }}
                                        >
                                            <span style={{ width: 36, height: 36, borderRadius: 10, background: r.iconBg, color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <span className="material-icons-round" style={{ fontSize: 18, fontWeight: 900 }}>{r.icon}</span>
                                            </span>
                                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{r.label}</span>
                                                    <span style={{ fontSize: 10, fontWeight: 600, color: r.pillFg, background: r.pillBg, padding: '2px 8px', borderRadius: 999 }}>
                                                        {r.pillLabel}
                                                    </span>
                                                </div>
                                                <span style={{ fontSize: 11.5, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.detail}</span>
                                            </div>
                                            <span style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', flexShrink: 0, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                                                {r.value}
                                            </span>
                                            {idx < rows.length - 1 ? null : null}
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </main>
        </div>
    );
}
