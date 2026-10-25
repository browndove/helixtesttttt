import { invalidateCachedJson, writeCachedJson } from '@/lib/getJsonCache';
import { fetchAllStaffPayload, STAFF_CACHE_LIST_KEY } from '@/lib/fetch-all-staff';
import {
    appendFacilityIdToProxyUrl,
    getCachedClientFacilityId,
    readHelixFacilityIdFromDocument,
} from '@/lib/facility-client';

export const ROLES_PAGE_CACHE_TTL_MS = 120_000;
export const ROLES_CACHE_ROLES = '/api/proxy/roles';
export const ROLES_CACHE_DEPTS = '/api/proxy/departments';
export const ROLES_CACHE_POLICIES = '/api/proxy/escalation-policies';
export const ROLES_CACHE_STAFF = STAFF_CACHE_LIST_KEY;
export const ROLES_CACHE_HOSPITAL = '/api/proxy/hospital';

/** Scope Roles page cache entries to the current facility so act-as switches cannot leak data. */
export function rolesPageCacheKey(base: string, facilityId?: string | null): string {
    const fid = String(facilityId || '').trim();
    return fid ? `${base}#facility=${fid}` : base;
}

export function currentRolesPageFacilityId(): string {
    return readHelixFacilityIdFromDocument() || getCachedClientFacilityId() || '';
}

export function rolesPageCacheKeyForCurrent(base: string): string {
    return rolesPageCacheKey(base, currentRolesPageFacilityId());
}

/** Drop Roles page caches so the next facility never paints the previous one's roles. */
export function invalidateRolesPageCache(facilityId?: string | null): void {
    const bases = [
        ROLES_CACHE_ROLES,
        ROLES_CACHE_DEPTS,
        ROLES_CACHE_POLICIES,
        ROLES_CACHE_STAFF,
        ROLES_CACHE_HOSPITAL,
    ];
    for (const base of bases) {
        invalidateCachedJson(base);
        const fid = String(facilityId || '').trim();
        if (fid) invalidateCachedJson(rolesPageCacheKey(base, fid));
    }
    // Also clear whatever facility is currently selected (previous act-as target).
    const current = currentRolesPageFacilityId();
    if (current && current !== facilityId) {
        for (const base of bases) {
            invalidateCachedJson(rolesPageCacheKey(base, current));
        }
    }
}

/** Fire-and-forget: populate the same GET cache the Roles page reads so first paint after OTP can be instant. */
export function warmRolesPageCache(): void {
    void (async () => {
        try {
            const facilityId = currentRolesPageFacilityId();
            const rolesUrl = appendFacilityIdToProxyUrl(ROLES_CACHE_ROLES, facilityId || undefined);
            const deptsUrl = appendFacilityIdToProxyUrl(ROLES_CACHE_DEPTS, facilityId || undefined);
            const hospitalUrl = appendFacilityIdToProxyUrl(ROLES_CACHE_HOSPITAL, facilityId || undefined);
            const [rolesRes, deptsRes, staffFetch, hospitalRes] = await Promise.all([
                fetch(rolesUrl),
                fetch(deptsUrl),
                fetchAllStaffPayload({ credentials: 'include' }),
                fetch(hospitalUrl),
            ]);
            const [rolesJson, deptsJson, hospitalJson] = await Promise.all([
                rolesRes.ok ? rolesRes.json() : Promise.resolve(null),
                deptsRes.ok ? deptsRes.json() : Promise.resolve(null),
                hospitalRes.ok ? hospitalRes.json() : Promise.resolve(null),
            ]);
            if (rolesRes.ok && rolesJson != null) {
                writeCachedJson(rolesPageCacheKey(ROLES_CACHE_ROLES, facilityId), rolesJson);
            }
            if (deptsRes.ok && deptsJson != null) {
                writeCachedJson(rolesPageCacheKey(ROLES_CACHE_DEPTS, facilityId), deptsJson);
            }
            // Do not warm ROLES_CACHE_POLICIES from the raw list — incomplete steps poison Roles.
            if (staffFetch.ok && staffFetch.data != null) {
                writeCachedJson(rolesPageCacheKey(ROLES_CACHE_STAFF, facilityId), staffFetch.data);
            }
            if (hospitalRes.ok && hospitalJson != null) {
                writeCachedJson(rolesPageCacheKey(ROLES_CACHE_HOSPITAL, facilityId), hospitalJson);
            }
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
