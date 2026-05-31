import { NextRequest, NextResponse } from 'next/server';
import { hasInternalSupportContext, isInternalScopedRequest } from '@/lib/proxy-auth';
import { resolveFacilityId, withFacilityIdQuery } from '@/lib/proxy-facility';

export const FACILITY_SESSION_ERROR =
    'Unable to resolve facility for current session. Please log in again.';

export const INTERNAL_ADMIN_FACILITY_ERROR = 'facility_id is required for internal admin requests';

export type TenantUpstream = { url: string; facilityId: string };

function facilityErrorResponse(req: NextRequest): NextResponse {
    const message = isInternalScopedRequest(req)
        ? INTERNAL_ADMIN_FACILITY_ERROR
        : FACILITY_SESSION_ERROR;
    if (isInternalScopedRequest(req)) {
        return NextResponse.json(
            { status: 'error', message, code: 400, error: message },
            { status: 400 },
        );
    }
    return NextResponse.json({ error: message }, { status: 400 });
}

/** Resolves facility_id or returns 400 when unavailable (always for support-mode). */
export async function requireFacilityId(
    req: NextRequest,
    apiBaseUrl: string,
): Promise<string | NextResponse> {
    const facilityId = await resolveFacilityId(req, apiBaseUrl);
    if (facilityId) return facilityId;
    return facilityErrorResponse(req);
}

function toAbsoluteApiUrl(apiBaseUrl: string, pathOrUrl: string): string {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
        return pathOrUrl;
    }
    if (pathOrUrl.startsWith('/api/')) {
        return `${apiBaseUrl}${pathOrUrl}`;
    }
    const normalized = pathOrUrl.startsWith('/') ? pathOrUrl.slice(1) : pathOrUrl;
    return `${apiBaseUrl}/api/v1/${normalized}`;
}

/**
 * Builds an upstream URL with ?facility_id= for tenant-scoped Helix API calls.
 * Required for internal-admin (support-mode) requests.
 */
export async function buildTenantUpstreamUrl(
    req: NextRequest,
    apiBaseUrl: string,
    pathOrUrl: string,
    query?: Record<string, string | null | undefined>,
): Promise<TenantUpstream | NextResponse> {
    const facilityId = await requireFacilityId(req, apiBaseUrl);
    if (facilityId instanceof NextResponse) return facilityId;

    const urlObj = new URL(withFacilityIdQuery(toAbsoluteApiUrl(apiBaseUrl, pathOrUrl), facilityId));
    if (query) {
        for (const [key, value] of Object.entries(query)) {
            if (value != null && value !== '') {
                urlObj.searchParams.set(key, value);
            }
        }
    }
    return { url: urlObj.toString(), facilityId };
}

/** Ensures a URL (often built with client query params) includes facility_id. */
export async function ensureFacilityOnUrl(
    req: NextRequest,
    apiBaseUrl: string,
    url: URL,
): Promise<URL | NextResponse> {
    const facilityId = await requireFacilityId(req, apiBaseUrl);
    if (facilityId instanceof NextResponse) return facilityId;
    url.searchParams.set('facility_id', facilityId);
    return url;
}

export function mergeFacilityIntoBody<T extends Record<string, unknown>>(
    body: T,
    facilityId: string,
): T & { facility_id: string } {
    return { ...body, facility_id: facilityId };
}
