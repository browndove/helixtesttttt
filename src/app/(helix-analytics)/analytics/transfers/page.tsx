'use client';

import { useMemo } from 'react';
import TransferInsightPage from '@/components/analytics/transfer-insight/TransferInsightPage';
import { extractTransferMetricsFromUsage } from '@/lib/analytics/transfer-metrics';
import { useAnalytics } from '../AnalyticsProvider';

/** Transfer KPIs/charts come from the same usage-metrics payload as Usage Summary. */
export default function TransfersPage() {
    const { data, loading } = useAnalytics();
    const transferData = useMemo(() => extractTransferMetricsFromUsage(data), [data]);
    return <TransferInsightPage data={transferData} loading={loading} />;
}
