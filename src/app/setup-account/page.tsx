import SetupAccountStepper from '@/components/SetupAccountStepper';
import { redirect } from 'next/navigation';

type SetupStep = 'info' | 'security';

function normalizeStepFromSearch(raw: string | string[] | undefined): SetupStep {
    const v = Array.isArray(raw) ? raw[0] : raw;
    const s = String(v || '').toLowerCase();
    if (s === 'security') return 'security';
    return 'info';
}

export default async function SetupAccountPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    const rawFacility = params.facility;
    const facilityParam = Array.isArray(rawFacility) ? (rawFacility[0] || '') : (rawFacility || '');
    const setupKindRaw = params.setup_kind;
    const setupKind = String(Array.isArray(setupKindRaw) ? (setupKindRaw[0] || '') : (setupKindRaw || '')).toLowerCase();
    const facilityRouting =
        facilityParam === '1' ||
        facilityParam === 'true' ||
        setupKind === 'facility' ||
        setupKind === 'organization';

    const sp = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) value.forEach(v => sp.append(key, v));
        else if (typeof value === 'string') sp.set(key, value);
    });
    sp.delete('facility');
    sp.delete('setup_kind');

    const query = sp.toString();
    if (facilityRouting) {
        redirect(query ? `/setup-facility?${query}` : '/setup-facility');
    }

    const rawToken = params.token;
    const token = Array.isArray(rawToken) ? (rawToken[0] || '') : (rawToken || '');
    const rawStep = params.step;
    const stepParam = Array.isArray(rawStep) ? rawStep[0] : rawStep;
    if (String(stepParam || '').toLowerCase() === 'phone') {
        const sp = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (key === 'step') return;
            if (Array.isArray(value)) value.forEach(v => sp.append(key, v));
            else if (typeof value === 'string') sp.set(key, value);
        });
        sp.set('step', 'security');
        redirect(sp.toString() ? `/setup-account?${sp}` : '/setup-account?step=security');
    }

    const step = normalizeStepFromSearch(params.step);

    return <SetupAccountStepper token={token.trim()} step={step} />;
}
