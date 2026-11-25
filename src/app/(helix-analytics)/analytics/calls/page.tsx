'use client';

import ClinicalOperationsPage from '@/components/analytics/ugmc-dashboard/clinical-operations/ClinicalOperationsPage';
import { useAnalytics } from '../AnalyticsProvider';

export default function CallInsightPage() {
    const { data } = useAnalytics();
    return <ClinicalOperationsPage data={data} />;
}
