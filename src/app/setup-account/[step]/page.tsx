import { redirect } from 'next/navigation';

const VALID_STEPS = new Set(['info', 'security']);

/** Legacy `/setup-account/:step` URLs → `/setup-account?step=…` (omit step for info). */
export default async function LegacySetupAccountStepRedirect({
    params,
    searchParams,
}: {
    params: Promise<{ step: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [{ step }, queryParams] = await Promise.all([params, searchParams]);
    const sp = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
        if (Array.isArray(value)) value.forEach(v => sp.append(key, v));
        else if (typeof value === 'string') sp.set(key, value);
    });
    sp.delete('step');
    const normalizedStep = step === 'phone' ? 'security' : step;
    if (VALID_STEPS.has(normalizedStep) && normalizedStep !== 'info') {
        sp.set('step', normalizedStep);
    }
    const qs = sp.toString();
    redirect(qs ? `/setup-account?${qs}` : '/setup-account');
}
