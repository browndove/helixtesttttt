import { NextRequest } from 'next/server';
import { extractFacilityIdFromPayload } from '@/lib/facility-id';
import { getInternalTokenFromCookie, getTokenFromCookie, isInternalScopedRequest } from '@/lib/proxy-auth';

const FACILITY_CACHE_TTL_MS = 60_000;
const facilityIdCache = new Map<string, { facilityId: string; expiresAt: number }>();

function getCachedFacilityId(token: string): string | undefined {
    const entry = facilityIdCache.get(token);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
        facilityIdCache.delete(token);
        return undefined;
    }
    return entry.facilityId;
}

function setCachedFacilityId(token: string, facilityId: string): void {
    facilityIdCache.set(token, {
        facilityId,
        expiresAt: Date.now() + FACILITY_CACHE_TTL_MS,
    });
}

export { extractFacilityIdFromPayload } from '@/lib/facility-id';

/** Read facility id from request cookies/query (no upstream call). */
export function readFacilityIdFromRequest(req: NextRequest): string | undefined {
    const fromQuery = req.nextUrl.searchParams.get('facility_id')?.trim();
    if (fromQuery) return fromQuery;

    const fromHeader = req.headers.get('x-helix-facility-id')?.trim();
    if (fromHeader) return fromHeader;

    return (
        req.cookies.get('helix-support-facility')?.value?.trim()
        || req.cookies.get('helix-facility')?.value?.trim()
        || undefined
    );
}

async function fetchFacilityIdFromAuthMe(token: string, apiBaseUrl: string): Promise<string | undefined> {
    const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };

    try {
        const meRes = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
            method: 'GET',
            headers,
        });
        if (!meRes.ok) {
            console.log('[resolveFacilityId] auth/me status:', meRes.status);
            return undefined;
        }
        const meData = await meRes.json();
        const fid = extractFacilityIdFromPayload(meData);
        if (fid) {
            console.log('[resolveFacilityId] Resolved from auth/me:', fid);
            return fid;
        }
        if (meData?.staff && typeof meData.staff === 'object') {
            console.log('[resolveFacilityId] staff keys:', JSON.stringify(Object.keys(meData.staff)));
        }
        console.log('[resolveFacilityId] No facility_id found in auth/me');
    } catch {
        return undefined;
    }

    return undefined;
}

/**
 * Resolves facility_id for proxy → upstream calls.
 * Internal act-as: cookie/query wins.
 * Tenant admins: session facility from auth/me wins over stale client query params.
 */
export async function resolveFacilityId(req: NextRequest, apiBaseUrl: string): Promise<string | undefined> {
    const token = getTokenFromCookie(req) || getInternalTokenFromCookie(req);
    const fromRequest = readFacilityIdFromRequest(req);

    if (isInternalScopedRequest(req)) {
        if (fromRequest) {
            if (token) setCachedFacilityId(token, fromRequest);
            return fromRequest;
        }
        if (token) {
            const cached = getCachedFacilityId(token);
            if (cached) return cached;
        }
        return undefined;
    }

    if (token) {
        const fromMe = await fetchFacilityIdFromAuthMe(token, apiBaseUrl);
        if (fromMe) {
            setCachedFacilityId(token, fromMe);
            if (fromRequest && fromRequest !== fromMe) {
                console.warn(
                    '[resolveFacilityId] Ignoring client facility_id',
                    fromRequest,
                    '— using session facility',
                    fromMe,
                );
            }
            return fromMe;
        }

        const cached = getCachedFacilityId(token);
        if (cached) return cached;
    }

    return fromRequest;
}

/** Upstream Helix API expects ?facility_id= for internal-admin (support-mode) requests. */
export function withFacilityIdQuery(apiUrl: string, facilityId: string): string {
    const url = new URL(apiUrl);
    url.searchParams.set('facility_id', facilityId);
    return url.toString();
}
