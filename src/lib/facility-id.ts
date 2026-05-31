/**
 * Pure helpers for reading facility_id from API payloads (safe for client + server).
 */

function extractFacilityIdFromObject(source: Record<string, unknown>): string | undefined {
    const id = String(
        source.facility_id
        || source.facilityId
        || source.current_facility_id
        || source.currentFacilityId
        || '',
    ).trim();
    if (id) return id;

    if (source.facility && typeof source.facility === 'object') {
        const f = source.facility as Record<string, unknown>;
        const nestedId = String(f.id || f.facility_id || '').trim();
        if (nestedId) return nestedId;
    }
    return undefined;
}

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
