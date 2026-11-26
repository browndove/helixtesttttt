'use client';

import { useState } from 'react';
import { FaUsers, FaEnvelope, FaArrowTrendUp, FaShieldHalved } from 'react-icons/fa6';
import {
    KpiCard,
    RevenueChart,
    RoleCriticalTraffic,
    ServiceDistribution,
    DailyPatientFlow,
    RedZoneAlerts,
    LiveUpdates,
    InsightsCard,
} from '@/components/analytics/ugmc-dashboard/executive-overview/components';
import { formatAvgMinutesPerUserDay } from '@/lib/analytics/feature-usage-metrics';
import { useAnalytics } from './AnalyticsProvider';

function fmt(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

export default function UsageSummaryPage() {
    const { data, loading, dailyUsersAvg, avgMinutesPerUserDay } = useAnalytics();
    const [revenueFullscreen, setRevenueFullscreen] = useState(false);
    const [patientFlowFullscreen, setPatientFlowFullscreen] = useState(false);

    const activeUsers = data?.active_users_count ?? 0;
    const activityRate = data?.active_users_rate_percent ?? 0;
    const escalationRate = data?.escalation_rate_percent ?? 0;
    const escalatedCount = data?.escalated_critical_messages ?? 0;
    const roleFillRate = data?.role_fill_rate_percent ?? 0;
    const filledRoles = data?.filled_roles ?? 0;
    const totalRoles = data?.total_roles ?? 0;

    return (
        <>
            <div className="usage-kpi-grid">
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
                    label="Daily users"
                    value={loading ? '—' : dailyUsersAvg == null ? '—' : fmt(Math.round(dailyUsersAvg))}
                    change={
                        !loading && avgMinutesPerUserDay != null
                            ? {
                                  value: formatAvgMinutesPerUserDay(avgMinutesPerUserDay),
                                  label: "avg time/day",
                                  trend: avgMinutesPerUserDay >= 15 ? "up" : "down",
                              }
                            : undefined
                    }
                    infoText="Average number of users that log into the app at least once per day. Trend shows average time spent in the app per user-day."
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

            <div className="usage-main-grid" style={{ marginTop: 24 }}>
                <div className="usage-main-grid__main">
                    <div className="usage-main-grid__chart animate-slide-in-up stagger-2">
                        <RevenueChart
                            isFullscreen={revenueFullscreen}
                            onToggleFullscreen={() => setRevenueFullscreen(!revenueFullscreen)}
                            dailyVolume={data?.daily_message_volume}
                        />
                    </div>

                    <div className="usage-main-grid__twocol dashboard-two-col">
                        <div className="animate-slide-in-up stagger-3">
                            <RoleCriticalTraffic roles={data?.role_metrics} />
                        </div>
                        <div className="animate-slide-in-up stagger-4">
                            <ServiceDistribution departments={data?.department_metrics} />
                        </div>
                    </div>

                    <div className="usage-main-grid__full animate-slide-in-up stagger-5">
                        <DailyPatientFlow
                            isFullscreen={patientFlowFullscreen}
                            onToggleFullscreen={() => setPatientFlowFullscreen(!patientFlowFullscreen)}
                            dailyVolume={data?.daily_message_volume}
                        />
                    </div>
                </div>

                <div className="usage-main-grid__sidebar">
                    <div className="animate-slide-in-right stagger-3">
                        <RedZoneAlerts roles={data?.top_escalated_roles} />
                    </div>
                    <div className="animate-slide-in-right stagger-4">
                        <LiveUpdates responseTimes={data ?? undefined} />
                    </div>
                    <div className="animate-slide-in-right stagger-5 usage-sidebar-sticky">
                        <InsightsCard data={data ?? undefined} />
                    </div>
                </div>
            </div>
        </>
    );
}
