'use client';

import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
    KpiCard,
    RevenueChart,
    RoleCriticalTraffic,
    ServiceDistribution,
    DailyPatientFlow,
    RedZoneAlerts,
    LiveUpdates,
    RoleMetricsModal,
} from "@/components/ugmc-dashboard/executive-overview/components";
import { FaUsers, FaEnvelope, FaArrowTrendUp, FaShieldHalved } from "react-icons/fa6";
import CalendarRangePicker from "@/components/CalendarRangePicker";
import clsx from "clsx";

const PatientInsightPage = lazy(() => import("@/components/ugmc-dashboard/patient-insight/PatientInsightPage"));
const BillingFinancePage = lazy(() => import("@/components/ugmc-dashboard/billing-finance/BillingFinancePage"));

type DashboardTab = 'executive' | 'patient' | 'billing';

const TABS: { id: DashboardTab; label: string; color: string; bgColor: string }[] = [
    { id: 'executive', label: 'Usage Summary', color: '#2484c7', bgColor: 'rgba(36,132,199,0.1)' },
    { id: 'patient', label: 'Response Performance', color: '#6974f7', bgColor: 'rgba(105,116,247,0.1)' },
    { id: 'billing', label: 'Staffing & Coverage', color: '#00c8b3', bgColor: 'rgba(0,200,179,0.1)' },
];

export interface AnalyticsData {
    active_users_count: number;
    active_users_rate_percent: number;
    registered_staff_count: number;
    total_messages: number;
    critical_messages: number;
    critical_messages_rate_percent: number;
    standard_messages: number;
    escalation_rate_percent: number;
    escalated_critical_messages: number;
    escalation_rate_of_total_messages_percent: number;
    role_fill_rate_percent: number;
    filled_roles: number;
    total_roles: number;
    critical_role_fill_rate_percent: number;
    critical_filled_roles: number;
    critical_total_roles: number;
    avg_critical_ack_minutes: number;
    avg_first_read_minutes_all: number;
    avg_first_read_minutes_critical: number;
    avg_first_read_minutes_non_critical: number;
    total_calls_made: number;
    window_days: number;
    avg_sign_in_minutes_since_midnight_utc: number;
    avg_sign_out_minutes_since_midnight_utc: number;
    daily_message_volume: { day: string; total_messages: number; critical_messages: number; standard_messages: number }[];
    department_metrics: {
        department_name: string;
        department_id?: string;
        role_fill_rate_percent: number;
        escalation_rate_vs_dept_critical_messages_percent: number;
        filled_roles: number;
        total_roles: number;
        critical_messages_sent: number;
        avg_critical_ack_minutes: number;
        avg_reply_response_minutes_all?: number;
        avg_reply_response_minutes_critical?: number;
        escalation_notifications: number;
        critical_filled_roles: number;
        critical_total_roles: number;
        critical_role_fill_rate_percent: number;
    }[];
    top_escalated_roles: { role_name: string; role_id: string; escalation_count: number }[];
    least_escalated_roles: { role_name: string; role_id: string; escalation_count: number }[];
    role_metrics?: { role_id: string; role_name: string; department_id: string; department_name: string; priority: string; filled: boolean; role_fill_rate_percent: number; critical_total_roles: number; critical_filled_roles: number; critical_role_fill_rate_percent: number; total_messages: number; total_calls_made: number; critical_messages: number; standard_messages: number; critical_messages_rate_percent: number; escalated_critical_messages: number; escalation_rate_percent: number; escalation_rate_of_total_messages_percent: number; avg_critical_ack_minutes: number; avg_reply_response_minutes_all: number; avg_reply_response_minutes_critical: number }[];
}

function fmt(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

function UsagePageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const [activeTab, setActiveTab] = useState<DashboardTab>('executive');
    const [revenueFullscreen, setRevenueFullscreen] = useState(false);
    const [patientFlowFullscreen, setPatientFlowFullscreen] = useState(false);
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [roleMetricsModalOpen, setRoleMetricsModalOpen] = useState(false);

    const initialDays = searchParams.get('days');
    // Compute initial date states if days param exists in the URL
    const getInitialDates = () => {
        if (!initialDays) return { from: '', to: '' };
        const days = parseInt(initialDays, 10);
        if (isNaN(days)) return { from: '', to: '' };
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);
        return {
            from: startDate.toISOString().split('T')[0],
            to: endDate.toISOString().split('T')[0]
        };
    };

    const initialDateState = getInitialDates();
    const [dateFrom, setDateFrom] = useState(initialDateState.from);
    const [dateTo, setDateTo] = useState(initialDateState.to);

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (dateFrom && dateTo) {
                // Backend only supports window_days — convert date range to days
                const fromMs = new Date(dateFrom + 'T00:00:00').getTime();
                const toMs = new Date(dateTo + 'T00:00:00').getTime();
                const diffDays = Math.max(0, Math.round((toMs - fromMs) / (1000 * 60 * 60 * 24)));
                params.set('days', String(diffDays));
                
                // Keep browser URL strictly in sync
                const urlParams = new URLSearchParams(searchParams.toString());
                urlParams.set('days', String(diffDays));
                router.replace(`${pathname}?${urlParams.toString()}`, { scroll: false });
            } else if (searchParams.has('days')) {
                const urlParams = new URLSearchParams(searchParams.toString());
                urlParams.delete('days');
                router.replace(`${pathname}?${urlParams.toString()}`, { scroll: false });
            }
            const qs = params.toString();
            const url = `/api/proxy/analytics${qs ? `?${qs}` : ''}`;
            console.log('[usage] Fetching:', url);
            const res = await fetch(url);
            if (res.ok) {
                const json = await res.json();
                console.log('[usage] Response window_days:', json.window_days, 'total_messages:', json.total_messages);
                setData(json);
            }
        } catch (err) {
            console.error('Failed to fetch analytics:', err);
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo]);

    useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

    const activeUsers = data?.active_users_count ?? 0;
    const activityRate = data?.active_users_rate_percent ?? 0;
    const totalMessages = data?.total_messages ?? 0;
    const criticalRate = data?.critical_messages_rate_percent ?? 0;
    const escalationRate = data?.escalation_rate_percent ?? 0;
    const escalatedCount = data?.escalated_critical_messages ?? 0;
    const roleFillRate = data?.role_fill_rate_percent ?? 0;
    const filledRoles = data?.filled_roles ?? 0;
    const totalRoles = data?.total_roles ?? 0;

    return (
        <div
            style={{
                boxSizing: 'border-box',
                display: 'flex',
                minHeight: '100vh',
                flexDirection: 'column',
                background: 'var(--bg-secondary)',
                overflowY: 'auto',
                overflowX: 'hidden',
                marginLeft: 'var(--sidebar-width)',
                width: 'calc(100vw - var(--sidebar-width))',
                padding: 20,
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
                {/* Header Row: Title + Tabs (left) | Calendar (right) */}
                <div
                    className="animate-slide-in-up"
                    style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px' }}
                >
                    {/* Left Side: Title + Divider + Tabs */}
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                        {/* Title Block */}
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                                {TABS.find(t => t.id === activeTab)?.label ?? 'Usage Summary'}
                            </span>
                            <span style={{ fontSize: 12, color: '#9ca3af', margin: 0, lineHeight: 1.3 }}>
                                {dateFrom && dateTo && dateFrom === dateTo
                                    ? `Today \u2014 ${new Date(dateFrom + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                                    : dateFrom && dateTo
                                        ? `${new Date(dateFrom + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} \u2014 ${new Date(dateTo + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                                        : (data?.window_days === 0 ? 'Today' : `Last ${data?.window_days ?? 30} days`)}
                            </span>
                        </div>

                        {/* Vertical Divider */}
                        <div style={{ width: 1, height: 28, background: '#e5e7eb', margin: '0 16px', alignSelf: 'center' }} />

                        {/* Tab Buttons */}
                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {TABS.map((tab) => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className="cursor-pointer whitespace-nowrap transition-all duration-200 ease-out"
                                        style={{
                                            padding: '4px 10px',
                                            borderRadius: 6,
                                            fontSize: 12,
                                            lineHeight: 1,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            fontWeight: isActive ? 600 : 500,
                                            background: isActive ? '#1d4ed8' : 'transparent',
                                            color: isActive ? '#fff' : '#6b7280',
                                            border: isActive ? '1px solid #1d4ed8' : '1px solid #e5e7eb',
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isActive) {
                                                e.currentTarget.style.background = '#f3f4f6';
                                                e.currentTarget.style.color = '#374151';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isActive) {
                                                e.currentTarget.style.background = 'transparent';
                                                e.currentTarget.style.color = '#6b7280';
                                            }
                                        }}
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Side: Calendar */}
                    <div style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <CalendarRangePicker
                            from={dateFrom}
                            to={dateTo}
                            onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
                        />
                    </div>
                </div>

                {/* Section Content */}
                {activeTab !== 'executive' && (
                    <Suspense fallback={
                        <div className="flex items-center justify-center py-20">
                            <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    }>
                        {activeTab === 'patient' && <PatientInsightPage data={data} onViewMoreRoles={() => setRoleMetricsModalOpen(true)} />}
                        {activeTab === 'billing' && <BillingFinancePage data={data} />}
                    </Suspense>
                )}

                {/* Executive Overview Content */}
                {activeTab === 'executive' && (<>
                {/* KPI Cards Row — 4 equal columns */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                    <KpiCard
                        icon={<FaUsers className="w-5 h-5 text-accent-primary" />}
                        iconBgColor="bg-[rgba(36,132,199,0.1)]"
                        label="Active Users"
                        value={loading ? '—' : fmt(activeUsers)}
                        change={{ value: `${activityRate.toFixed(1)}%`, label: "Activity Rate", trend: activityRate >= 50 ? "up" : "down" }}
                        infoText="Number of staff members currently active on the platform out of total registered staff."
                        animationDelay={0}
                    />
                    <KpiCard
                        icon={<FaEnvelope className="w-5 h-5 text-accent-green" />}
                        iconBgColor="bg-[rgba(0,200,179,0.1)]"
                        label="Total Messages"
                        value={loading ? '—' : fmt(totalMessages)}
                        change={{ value: `${criticalRate.toFixed(1)}%`, label: "Critical Rate", trend: criticalRate > 20 ? "up" : "down" }}
                        infoText="Total messages sent across all departments including critical and standard messages."
                        animationDelay={1}
                    />
                    <KpiCard
                        icon={<FaArrowTrendUp className="w-5 h-5 text-accent-red" />}
                        iconBgColor="bg-[rgba(255,95,87,0.1)]"
                        label="Escalation Rate"
                        value={loading ? '—' : `${escalationRate.toFixed(1)}%`}
                        change={{ value: fmt(escalatedCount), label: "Escalated", trend: escalationRate > 15 ? "up" : "down" }}
                        infoText="Percentage of critical messages that triggered escalation notifications out of total messages."
                        animationDelay={2}
                    />
                    <KpiCard
                        icon={<FaShieldHalved className="w-5 h-5 text-accent-violet" />}
                        iconBgColor="bg-[rgba(105,116,247,0.1)]"
                        label="Role Coverage"
                        value={loading ? '—' : `${roleFillRate.toFixed(1)}%`}
                        change={{ value: `${filledRoles}/${totalRoles}`, label: "Roles Filled", trend: roleFillRate >= 70 ? "up" : "down" }}
                        infoText="Percentage of defined roles that are currently filled with assigned staff members."
                        animationDelay={3}
                    />
                </div>

                {/* Main Content — left column (flexible) + right column (fixed 320px) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
                    {/* Left Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
                        {/* Daily Message Volume */}
                        <div className="animate-slide-in-up stagger-2">
                            <RevenueChart
                                isFullscreen={revenueFullscreen}
                                onToggleFullscreen={() => setRevenueFullscreen(!revenueFullscreen)}
                                dailyVolume={data?.daily_message_volume}
                            />
                        </div>

                        {/* Role critical traffic & Role Coverage Row */}
                        <div className="dashboard-two-col">
                            <div className="animate-slide-in-up stagger-3">
                                <RoleCriticalTraffic roles={data?.role_metrics} />
                            </div>
                            <div className="animate-slide-in-up stagger-4">
                                <ServiceDistribution departments={data?.department_metrics} />
                            </div>
                        </div>

                        {/* Message Trends */}
                        <div className="animate-slide-in-up stagger-5">
                            <DailyPatientFlow
                                isFullscreen={patientFlowFullscreen}
                                onToggleFullscreen={() => setPatientFlowFullscreen(!patientFlowFullscreen)}
                                dailyVolume={data?.daily_message_volume}
                            />
                        </div>
                    </div>

                    {/* Right Column — Top Escalated Roles & Response Times */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 20 }}>
                        <div className="animate-slide-in-right stagger-3">
                            <RedZoneAlerts roles={data?.top_escalated_roles} />
                        </div>
                        <div className="animate-slide-in-right stagger-4">
                            <LiveUpdates responseTimes={data ? {
                                avg_critical_ack_minutes: data.avg_critical_ack_minutes,
                                avg_first_read_minutes_all: data.avg_first_read_minutes_all,
                                avg_first_read_minutes_critical: data.avg_first_read_minutes_critical,
                                avg_first_read_minutes_non_critical: data.avg_first_read_minutes_non_critical,
                                total_calls_made: data.total_calls_made,
                            } : undefined} />
                        </div>
                    </div>
                </div>
                </>)}
            </div>

            {/* Role Metrics Modal */}
            <RoleMetricsModal
                isOpen={roleMetricsModalOpen}
                onClose={() => setRoleMetricsModalOpen(false)}
                roles={data?.role_metrics || []}
            />
        </div>
    );
}

export default function UsagePage() {
    return (
        <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-secondary)' }}>
                <div style={{ width: 32, height: 32, border: '2px solid #4b5563', borderTop: '2px solid #8b8faa', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
        }>
            <UsagePageContent />
        </Suspense>
    );
}
