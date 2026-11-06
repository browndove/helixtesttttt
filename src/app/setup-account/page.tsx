import SetupAccountOpenInApp from '@/components/SetupAccountOpenInApp';
import { redirect } from 'next/navigation';

/**
 * Staff setup emails deep-link here. The Helix mobile app claims /setup-account*
 * via Universal Links / App Links. This page is the browser fallback when the
 * app is not installed or the link is opened on a computer — no password form.
 * Facility/org admin invites still go to /setup-facility.
 */
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
        facilityParam === '1'
        || facilityParam === 'true'
        || setupKind === 'facility'
        || setupKind === 'organization';

    if (facilityRouting) {
        const sp = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (Array.isArray(value)) value.forEach(v => sp.append(key, v));
            else if (typeof value === 'string') sp.set(key, value);
        });
        sp.delete('facility');
        sp.delete('setup_kind');
        const query = sp.toString();
        redirect(query ? `/setup-facility?${query}` : '/setup-facility');
    }

    return <SetupAccountOpenInApp />;
}
