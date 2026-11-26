'use client';

import BillingFinancePage from '@/components/analytics/ugmc-dashboard/billing-finance/BillingFinancePage';
import { useAnalytics } from '../AnalyticsProvider';

export default function StaffingCoveragePage() {
    const { data } = useAnalytics();
    return <BillingFinancePage data={data} />;
}
