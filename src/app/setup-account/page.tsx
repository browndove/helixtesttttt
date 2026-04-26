import SetupAccountForm from '@/components/SetupAccountForm';

export default async function SetupAccountPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    const rawToken = params.token;
    const token = Array.isArray(rawToken) ? (rawToken[0] || '') : (rawToken || '');
    const rawFacility = params.facility;
    const facilityParam = Array.isArray(rawFacility) ? (rawFacility[0] || '') : (rawFacility || '');
    const variant = facilityParam === '1' || facilityParam === 'true' ? 'facility' : 'account';

    return <SetupAccountForm token={token.trim()} variant={variant} />;
}
