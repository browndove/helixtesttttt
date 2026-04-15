import { writeCachedJson } from '@/lib/getJsonCache';

export const ROLES_PAGE_CACHE_TTL_MS = 120_000;
export const ROLES_CACHE_ROLES = '/api/proxy/roles';
export const ROLES_CACHE_DEPTS = '/api/proxy/departments';
export const ROLES_CACHE_POLICIES = '/api/proxy/escalation-policies';
export const ROLES_CACHE_STAFF = '/api/proxy/staff?page_size=100&page_id=1';
export const ROLES_CACHE_HOSPITAL = '/api/proxy/hospital';

/** Fire-and-forget: populate the same GET cache the Roles page reads so first paint after OTP can be instant. */
export function warmRolesPageCache(): void {
    void (async () => {
        try {
            const [rolesRes, deptsRes, policiesRes, staffRes, hospitalRes] = await Promise.all([
                fetch(ROLES_CACHE_ROLES),
                fetch(ROLES_CACHE_DEPTS),
                fetch(ROLES_CACHE_POLICIES),
                fetch(ROLES_CACHE_STAFF),
                fetch(ROLES_CACHE_HOSPITAL),
            ]);
            const [rolesJson, deptsJson, policiesJson, staffJson, hospitalJson] = await Promise.all([
                rolesRes.ok ? rolesRes.json() : Promise.resolve(null),
                deptsRes.ok ? deptsRes.json() : Promise.resolve(null),
                policiesRes.ok ? policiesRes.json() : Promise.resolve(null),
                staffRes.ok ? staffRes.json() : Promise.resolve(null),
                hospitalRes.ok ? hospitalRes.json() : Promise.resolve(null),
            ]);
            if (rolesRes.ok && rolesJson != null) writeCachedJson(ROLES_CACHE_ROLES, rolesJson);
            if (deptsRes.ok && deptsJson != null) writeCachedJson(ROLES_CACHE_DEPTS, deptsJson);
            if (policiesRes.ok && policiesJson != null) writeCachedJson(ROLES_CACHE_POLICIES, policiesJson);
            if (staffRes.ok && staffJson != null) writeCachedJson(ROLES_CACHE_STAFF, staffJson);
            if (hospitalRes.ok && hospitalJson != null) writeCachedJson(ROLES_CACHE_HOSPITAL, hospitalJson);
            if (hospitalJson && typeof hospitalJson === 'object') {
                const fid = typeof (hospitalJson as Record<string, unknown>).id === 'string'
                    ? (hospitalJson as Record<string, unknown>).id as string
                    : '';
                if (fid) {
                    const facRes = await fetch(`/api/proxy/facilities/${fid}`);
                    if (facRes.ok) {
                        const fac = await facRes.json();
                        writeCachedJson(`/api/proxy/facilities/${fid}`, fac);
                    }
                }
            }
        } catch {
            /* ignore */
        }
    })();
}
