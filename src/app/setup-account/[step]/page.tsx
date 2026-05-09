import { redirect } from 'next/navigation';
import SetupAccountStepper from '@/components/SetupAccountStepper';

type SetupStep = 'info' | 'phone' | 'security';

function normalizeStep(raw: string): SetupStep | null {
    if (raw === 'info' || raw === 'phone' || raw === 'security') return raw;
    return null;
}

export default async function SetupAccountStepPage({
    params,
    searchParams,
}: {
    params: Promise<{ step: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [routeParams, queryParams] = await Promise.all([params, searchParams]);
    const step = normalizeStep(routeParams.step);
    if (!step) {
        const sp = new URLSearchParams();
        Object.entries(queryParams).forEach(([key, value]) => {
            if (Array.isArray(value)) value.forEach(v => sp.append(key, v));
            else if (typeof value === 'string') sp.set(key, value);
        });
        const query = sp.toString();
        redirect(query ? `/setup-account/info?${query}` : '/setup-account/info');
    }

    const rawToken = queryParams.token;
    const token = Array.isArray(rawToken) ? (rawToken[0] || '') : (rawToken || '');
    return <SetupAccountStepper token={token.trim()} step={step} />;
}
