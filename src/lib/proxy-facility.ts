import { NextRequest } from 'next/server';
import { getTokenFromCookie } from '@/lib/proxy-auth';

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

/**
 * Extract a facility id from an object that may contain facility fields.
 */
function extractFacilityIdFromObject(source: Record<string, unknown>): string | undefined {
    const id = String(source.facility_id || source.facilityId || source.current_facility_id || source.currentFacilityId || '').trim();
    if (id) return id;

    // Check nested facility object
    if (source.facility && typeof source.facility === 'object') {
        const f = source.facility as Record<string, unknown>;
        const nestedId = String(f.id || f.facility_id || '').trim();
        if (nestedId) return nestedId;
    }
    return undefined;
}

/**
 * Extract facility id from common backend payload shapes.
 */
export function extractFacilityIdFromPayload(payload: unknown): string | undefined {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined;
    const root = payload as Record<string, unknown>;

    const topLevel = extractFacilityIdFromObject(root);
    if (topLevel) return topLevel;

    const data = root.data && typeof root.data === 'object' && !Array.isArray(root.data)
        ? root.data as Record<string, unknown>
        : undefined;

    const candidates: unknown[] = [
        root.user,
        root.staff,
        root.admin,
        root.facility,
        data,
        data?.user,
        data?.staff,
        data?.admin,
        data?.facility,
    ];

    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
        const id = extractFacilityIdFromObject(candidate as Record<string, unknown>);
        if (id) return id;
    }

    return undefined;
}

/**
 * Best-effort helper that resolves facility_id from the authenticated user context.
 * Priority: 1) explicit facility cookie  2) /auth/me user.facility_id
 * Returns undefined if not resolvable; callers should decide fallback behavior.
 */
export async function resolveFacilityId(req: NextRequest, apiBaseUrl: string): Promise<string | undefined> {
    const token = getTokenFromCookie(req);
    if (!token) return undefined;

    // 0. Check explicit facility cookie (set during OTP verification)
    const cookieFacilityId = req.cookies.get('helix-facility')?.value;
    if (cookieFacilityId) {
        setCachedFacilityId(token, cookieFacilityId);
        return cookieFacilityId;
    }

    // 0.5 Try short-lived in-memory cache to avoid repeated auth/me calls.
    const cachedFacilityId = getCachedFacilityId(token);
    if (cachedFacilityId) {
        return cachedFacilityId;
    }

    const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };

    // 1. Try to get facility_id from the authenticated user's profile
    try {
        const meRes = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
            method: 'GET',
            headers,
        });
        if (meRes.ok) {
            const meData = await meRes.json();
            const fid = extractFacilityIdFromPayload(meData);
            if (fid) {
                console.log('[resolveFacilityId] Resolved from auth/me:', fid);
                setCachedFacilityId(token, fid);
                return fid;
            }
            // Log for debugging if nothing found
            if (meData?.staff && typeof meData.staff === 'object') {
                console.log('[resolveFacilityId] staff keys:', JSON.stringify(Object.keys(meData.staff)));
            }
            console.log('[resolveFacilityId] No facility_id found in auth/me');
        } else {
            console.log('[resolveFacilityId] auth/me status:', meRes.status);
        }
    } catch {
        return undefined;
    }

    return undefined;
}
