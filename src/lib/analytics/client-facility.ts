import { FACILITY_ID_COOKIE } from "@/lib/analytics/auth-cookies";
import { API_ENDPOINTS } from "@/lib/analytics/config";
import { type ApiFacility, mapApiList } from "@/lib/analytics/facility-directory";
import { extractFacilityIdFromPayload, extractFacilityNameFromPayload } from "@/lib/analytics/facility-payload";

/** Read helix-facility from document.cookie (support mode sets this for client hints). */
export function readClientFacilityIdFromCookie(): string | undefined {
    if (typeof document === "undefined") return undefined;
    const match = document.cookie
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${FACILITY_ID_COOKIE}=`));
    if (!match) return undefined;
    const value = decodeURIComponent(match.split("=")[1] || "");
    return value.trim() || undefined;
}

/** Current facility in support mode, from cookie or act-as status endpoint. */
export async function resolveClientFacilityId(): Promise<string | undefined> {
    const fromCookie = readClientFacilityIdFromCookie();
    if (fromCookie) return fromCookie;

    try {
        const res = await fetch(API_ENDPOINTS.INTERNAL_ACT_AS, { credentials: "include" });
        if (!res.ok) return undefined;
        const data = (await res.json()) as { support_mode?: boolean; facility_id?: string | null };
        if (data.support_mode && data.facility_id) return String(data.facility_id);
    } catch {
        return undefined;
    }
    return undefined;
}

async function lookupFacilityNameById(facilityId: string): Promise<string | undefined> {
    const endpoints = [API_ENDPOINTS.FACILITIES, API_ENDPOINTS.INTERNAL_FACILITIES];

    for (const endpoint of endpoints) {
        try {
            const res = await fetch(endpoint, { credentials: "include" });
            if (!res.ok) continue;
            const rows = (await res.json()) as ApiFacility[];
            const match = mapApiList(Array.isArray(rows) ? rows : []).find((f) => f.id === facilityId);
            if (match?.name) return match.name;
        } catch {
            continue;
        }
    }

    return undefined;
}

/** Resolve the current user's facility display name for client UI. */
export async function resolveClientFacilityName(): Promise<string | undefined> {
    try {
        const actAsRes = await fetch(API_ENDPOINTS.INTERNAL_ACT_AS, { credentials: "include" });
        if (actAsRes.ok) {
            const actAs = (await actAsRes.json()) as { support_mode?: boolean; facility_id?: string | null };
            if (actAs.support_mode && actAs.facility_id) {
                return lookupFacilityNameById(String(actAs.facility_id));
            }
        }
    } catch {
        /* fall through */
    }

    try {
        const meRes = await fetch(API_ENDPOINTS.AUTH_ME, { credentials: "include" });
        if (meRes.ok) {
            const me = await meRes.json();
            const fromMe = extractFacilityNameFromPayload(me);
            if (fromMe) return fromMe;

            const facilityId = extractFacilityIdFromPayload(me) || readClientFacilityIdFromCookie();
            if (facilityId) return lookupFacilityNameById(facilityId);
        }
    } catch {
        /* fall through */
    }

    const cookieId = readClientFacilityIdFromCookie();
    if (cookieId) return lookupFacilityNameById(cookieId);

    return undefined;
}
