import { redirect } from 'next/navigation';

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
    const facilityRouting = facilityParam === '1' || facilityParam === 'true' || setupKind === 'facility' || setupKind === 'organization';

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
    redirect(query ? `/setup-account/info?${query}` : '/setup-account/info');
}
