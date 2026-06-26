'use client';

import { useMemo, useState, lazy, Suspense } from 'react';
import {
    KpiCard,
    RevenueChart,
    RoleCriticalTraffic,
    ServiceDistribution,
    DailyPatientFlow,
    RedZoneAlerts,
    LiveUpdates,
    RoleMetricsModal,
} from '@/components/ugmc-dashboard/executive-overview/components';
import { FaDownload, FaMobileScreen, FaStar, FaShieldHalved } from 'react-icons/fa6';
import InternalAdminShell from '@/components/InternalAdminShell';
import InternalDownloadsSidebar, {
    DownloadsSidebarProvider,
    type DownloadsDashboardTab,
} from '@/components/internal-downloads/InternalDownloadsSidebar';
import {
    MOCK_DOWNLOAD_ANALYTICS,
    filterDownloadAnalyticsByDays,
    mapDownloadAnalyticsToUgmc,
    type DownloadAnalyticsData,
} from '@/lib/download-analytics-mock';

const DownloadsAcquisitionPage = lazy(() => import('@/components/internal-downloads/DownloadsAcquisitionPage'));
const DownloadsAudiencePage = lazy(() => import('@/components/internal-downloads/DownloadsAudiencePage'));

const TABS: { id: DownloadsDashboardTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'acquisition', label: 'Acquisition & Stability' },
    { id: 'audience', label: 'Emergency & Critical Care' },
];

function fmt(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

function InternalDownloadsAnalyticsContent() {
    const [activeTab, setActiveTab] = useState<DownloadsDashboardTab>('overview');
    const [revenueFullscreen, setRevenueFullscreen] = useState(false);
    const [flowFullscreen, setFlowFullscreen] = useState(false);
    const [roleMetricsModalOpen, setRoleMetricsModalOpen] = useState(false);
    const windowDays = MOCK_DOWNLOAD_ANALYTICS.window_days;

    const downloadData: DownloadAnalyticsData = useMemo(
        () => filterDownloadAnalyticsByDays(MOCK_DOWNLOAD_ANALYTICS, windowDays),
        [windowDays],
    );

    const ugmcData = useMemo(() => mapDownloadAnalyticsToUgmc(downloadData), [downloadData]);

    return (
        <div className="internal-downloads-layout">
            <InternalDownloadsSidebar activeTab={activeTab} onTabChange={setActiveTab} />

            <div className="usage-dashboard-shell internal-downloads-shell">
                <div className="usage-inner">
                    {activeTab !== 'overview' && (
                        <Suspense fallback={
                            <div className="flex items-center justify-center py-20">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
                            </div>
                        }>
                            {activeTab === 'acquisition' && <DownloadsAcquisitionPage data={downloadData} />}
                            {activeTab === 'audience' && <DownloadsAudiencePage />}
                        </Suspense>
                    )}

                    {activeTab === 'overview' && (
                        <>
                            <div className="usage-kpi-grid">
                                <KpiCard
                                    icon={<FaDownload className="h-5 w-5 text-accent-primary" />}
                                    iconBgColor="bg-[rgba(36,132,199,0.1)]"
                                    label="Total Downloads"
                                    value={fmt(downloadData.total_downloads)}
                                    change={{ value: `${downloadData.install_conversion_percent.toFixed(1)}%`, label: 'Install rate', trend: 'up' }}
                                    infoText="Total app downloads across all channels in the selected period."
                                    animationDelay={0}
                                />
                                <KpiCard
                                    icon={<FaMobileScreen className="h-5 w-5 text-accent-green" />}
                                    iconBgColor="bg-[rgba(0,200,179,0.1)]"
                                    label="Active Devices"
                                    value={fmt(downloadData.active_devices)}
                                    change={{ value: fmt(downloadData.total_installs), label: 'Installs', trend: 'up' }}
                                    infoText="Devices with a successful install and recent activity."
                                    animationDelay={1}
                                />
                                <KpiCard
                                    icon={<FaStar className="h-5 w-5 text-accent-orange" />}
                                    iconBgColor="bg-[rgba(232,155,0,0.1)]"
                                    label="Avg Rating"
                                    value={downloadData.avg_rating.toFixed(1)}
                                    change={{ value: String(downloadData.review_count), label: 'Reviews', trend: 'up' }}
                                    infoText="Average store rating from user reviews."
                                    animationDelay={2}
                                />
                                <KpiCard
                                    icon={<FaShieldHalved className="h-5 w-5 text-accent-violet" />}
                                    iconBgColor="bg-[rgba(105,116,247,0.1)]"
                                    label="Crash-Free"
                                    value={`${downloadData.crash_free_rate_percent.toFixed(1)}%`}
                                    change={{ value: String(downloadData.crash_reports.reduce((s, c) => s + c.count, 0)), label: 'Crashes', trend: 'down' }}
                                    infoText="Percentage of sessions without a fatal crash."
                                    animationDelay={3}
                                />
                            </div>

                            <div className="usage-main-grid">
                                <div className="usage-main-grid__primary">
                                    <div className="animate-slide-in-up stagger-2">
                                        <RevenueChart
                                            isFullscreen={revenueFullscreen}
                                            onToggleFullscreen={() => setRevenueFullscreen(!revenueFullscreen)}
                                            dailyVolume={ugmcData.daily_message_volume}
                                        />
                                    </div>
                                    <div className="dashboard-two-col">
                                        <div className="animate-slide-in-up stagger-3">
                                            <RoleCriticalTraffic roles={ugmcData.role_metrics} />
                                        </div>
                                        <div className="animate-slide-in-up stagger-4">
                                            <ServiceDistribution departments={ugmcData.department_metrics} />
                                        </div>
                                    </div>
                                    <div className="animate-slide-in-up stagger-5">
                                        <DailyPatientFlow
                                            isFullscreen={flowFullscreen}
                                            onToggleFullscreen={() => setFlowFullscreen(!flowFullscreen)}
                                            dailyVolume={ugmcData.daily_message_volume}
                                        />
                                    </div>
                                </div>
                                <div className="usage-main-grid__sidebar">
                                    <div className="animate-slide-in-right stagger-3">
                                        <RedZoneAlerts roles={ugmcData.top_escalated_roles} />
                                    </div>
                                    <div className="animate-slide-in-right stagger-4">
                                        <LiveUpdates responseTimes={{
                                            avg_critical_ack_minutes: ugmcData.avg_critical_ack_minutes,
                                            avg_first_read_minutes_all: ugmcData.avg_first_read_minutes_all,
                                            avg_first_read_minutes_critical: ugmcData.avg_first_read_minutes_critical,
                                            avg_first_read_minutes_non_critical: ugmcData.avg_first_read_minutes_non_critical,
                                            total_calls_made: ugmcData.total_calls_made,
                                        }} />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    <RoleMetricsModal
                        isOpen={roleMetricsModalOpen}
                        onClose={() => setRoleMetricsModalOpen(false)}
                        roles={ugmcData.role_metrics || []}
                    />
                </div>
            </div>
        </div>
    );
}

export default function InternalDownloadsAnalyticsPage() {
    return (
        <InternalAdminShell>
            <DownloadsSidebarProvider>
                <InternalDownloadsAnalyticsContent />
            </DownloadsSidebarProvider>
        </InternalAdminShell>
    );
}
