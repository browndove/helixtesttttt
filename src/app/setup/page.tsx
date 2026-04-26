import { redirect } from 'next/navigation';

export default async function SetupAliasPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    const sp = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) value.forEach(v => sp.append(key, v));
        else if (typeof value === 'string') sp.set(key, value);
    });

    const setupKind = String(sp.get('setup_kind') || '').toLowerCase();
    const facilityRouting = sp.get('facility') === '1' || sp.get('facility') === 'true' || setupKind === 'facility' || setupKind === 'organization';
    if (facilityRouting) {
        sp.delete('facility');
        sp.delete('setup_kind');
    }
    const target = facilityRouting ? '/setup-facility' : '/setup-account';
    const query = sp.toString();
    redirect(query ? `${target}?${query}` : target);
}
