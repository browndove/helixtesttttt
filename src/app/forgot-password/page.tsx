import HospitalAdminForgotPassword from '@/components/HospitalAdminForgotPassword';

export default async function ForgotPasswordPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    const rawEmail = params.email;
    const initialEmail = (Array.isArray(rawEmail) ? rawEmail[0] : rawEmail) || '';
    const rawCode = params.facility_code ?? params.code;
    const initialFacilityCode = (Array.isArray(rawCode) ? rawCode[0] : rawCode) || '';

    return (
        <HospitalAdminForgotPassword
            initialEmail={initialEmail.trim()}
            initialFacilityCode={initialFacilityCode.trim()}
        />
    );
}
