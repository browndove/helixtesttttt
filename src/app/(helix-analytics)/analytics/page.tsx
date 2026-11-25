'use client';

import { useState } from 'react';
import {
    RevenueChart,
    RoleCriticalTraffic,
    ServiceDistribution,
    DailyPatientFlow,
    RedZoneAlerts,
    LiveUpdates,
    InsightsCard,
} from '@/components/analytics/ugmc-dashboard/executive-overview/components';
import { UsageKpis } from '@/components/analytics/glass/AnalyticsKpis';
import { useAnalytics } from './AnalyticsProvider';

export default function UsageSummaryPage() {
    const { data, loading, dailyUsersAvg, avgMinutesPerUserDay } = useAnalytics();
    const [revenueFullscreen, setRevenueFullscreen] = useState(false);
    const [patientFlowFullscreen, setPatientFlowFullscreen] = useState(false);


    return (
        <>
            <UsageKpis data={data} loading={loading} dailyUsersAvg={dailyUsersAvg} avgMinutesPerUserDay={avgMinutesPerUserDay} />

            <div className="usage-main-grid">
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
