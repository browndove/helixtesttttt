import { API_ENDPOINTS } from '@/lib/config';

const STORAGE_KEY = 'helix-client-facility-id';

let memoryFacilityId: string | undefined;

/** Read helix-facility from document.cookie (set during OTP or internal act-as). */
export function readHelixFacilityIdFromDocument(): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const match = document.cookie.match(/(?:^|;\s*)helix-facility=([^;]+)/);
    const raw = match?.[1]?.trim();
    if (!raw) return undefined;
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

function cacheClientFacilityId(id: string): string {
    memoryFacilityId = id;
    try {
        sessionStorage.setItem(STORAGE_KEY, id);
    } catch {
        /* ignore */
    }
    return id;
}

/** Sync read of facility id cached by resolveClientFacilityId / primeClientFacilityId. */
export function getCachedClientFacilityId(): string | undefined {
    if (memoryFacilityId) return memoryFacilityId;
    try {
        const stored = sessionStorage.getItem(STORAGE_KEY)?.trim();
        if (stored) {
            memoryFacilityId = stored;
            return stored;
        }
    } catch {
        /* ignore */
    }
    return undefined;
}

/**
 * Resolves the active facility id for browser → proxy calls.
 * Uses document cookie, session cache, then GET /api/proxy/internal/act-as (reads httpOnly cookies).
 */
export async function resolveClientFacilityId(): Promise<string | undefined> {
    const cached = getCachedClientFacilityId();
    if (cached) return cached;

    const fromDoc = readHelixFacilityIdFromDocument();
    if (fromDoc) return cacheClientFacilityId(fromDoc);

    try {
        const res = await fetch(API_ENDPOINTS.INTERNAL_ACT_AS, { credentials: 'include' });
        if (res.ok) {
            const data = (await res.json()) as { facility_id?: string; support_mode?: boolean };
            const fid = String(data.facility_id || '').trim();
            if (fid) return cacheClientFacilityId(fid);
        }
    } catch {
        /* ignore */
    }

    return undefined;
}

/** Call after act-as or when act-as GET returns facility_id so proxy fetches include it immediately. */
export function primeClientFacilityId(facilityId: string): void {
    const id = facilityId.trim();
    if (id) cacheClientFacilityId(id);
}

/** Append facility_id to a same-origin /api/proxy URL. */
export function appendFacilityIdToProxyUrl(url: string, facilityId?: string): string {
    if (!facilityId || typeof window === 'undefined') return url;
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.set('facility_id', facilityId);
    return `${parsed.pathname}${parsed.search}`;
}

export function clearClientFacilityIdCache(): void {
    memoryFacilityId = undefined;
    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        /* ignore */
    }
}
