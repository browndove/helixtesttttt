import { API_ENDPOINTS } from '@/lib/config';
import { extractFacilityIdFromPayload } from '@/lib/facility-id';

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

export function readClientSupportModeFromDocument(): boolean {
    if (typeof document === 'undefined') return false;
    return /(?:^|;\s*)helix-support-mode=1(?:;|$)/.test(document.cookie);
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

export async function isClientInternalSupportMode(): Promise<boolean> {
    if (readClientSupportModeFromDocument()) return true;
    try {
        const res = await fetch(API_ENDPOINTS.INTERNAL_ACT_AS, { credentials: 'include' });
        if (!res.ok) return false;
        const data = (await res.json()) as { support_mode?: boolean };
        return Boolean(data.support_mode);
    } catch {
        return false;
    }
}

/**
 * Resolves facility_id for browser → proxy calls.
 * Tenant admins: sync from auth/me (facility_id query is optional on the API).
 * Internal act-as: cookie / act-as context is required.
 */
export async function resolveClientFacilityId(): Promise<string | undefined> {
    const support = await isClientInternalSupportMode();

    if (!support) {
        try {
            const meRes = await fetch(API_ENDPOINTS.AUTH_ME, { credentials: 'include' });
            if (meRes.ok) {
                const data = await meRes.json();
                const fid = extractFacilityIdFromPayload(data);
                if (fid) {
                    const cached = getCachedClientFacilityId();
                    if (cached && cached !== fid) clearClientFacilityIdCache();
                    return cacheClientFacilityId(fid);
                }
            }
        } catch {
            /* ignore */
        }
        clearClientFacilityIdCache();
        return readHelixFacilityIdFromDocument();
    }

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

/** Only adds facility_id for internal act-as; tenant sessions use the proxy auth cookie. */
export async function appendFacilityIdForProxy(url: string): Promise<string> {
    if (!(await isClientInternalSupportMode())) return url;
    const facilityId = await resolveClientFacilityId();
    return appendFacilityIdToProxyUrl(url, facilityId);
}

export function clearClientFacilityIdCache(): void {
    memoryFacilityId = undefined;
    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        /* ignore */
    }
}
