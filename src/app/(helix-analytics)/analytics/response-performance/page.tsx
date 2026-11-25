'use client';

import { useState } from 'react';
import PatientInsightPage from '@/components/analytics/ugmc-dashboard/patient-insight/PatientInsightPage';
import { RoleMetricsModal } from '@/components/analytics/ugmc-dashboard/executive-overview/components';
import { useAnalytics } from '../AnalyticsProvider';

export default function ResponsePerformancePage() {
    const { data } = useAnalytics();
    const [roleMetricsOpen, setRoleMetricsOpen] = useState(false);
    return (
        <>
            <PatientInsightPage data={data} onViewMoreRoles={() => setRoleMetricsOpen(true)} />
            <RoleMetricsModal
                isOpen={roleMetricsOpen}
                onClose={() => setRoleMetricsOpen(false)}
                roles={data?.role_metrics || []}
            />
        </>
    );
}
