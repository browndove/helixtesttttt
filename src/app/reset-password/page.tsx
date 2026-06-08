import HospitalAdminResetPassword from '@/components/HospitalAdminResetPassword';

export default async function ResetPasswordPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    const raw = params.reset_token ?? params.token;
    const resetToken = (Array.isArray(raw) ? raw[0] : raw) || '';

    return <HospitalAdminResetPassword resetToken={resetToken.trim()} />;
}
