export type ApiFacility = {
    id?: string;
    facility_id?: string;
    name?: string;
    facility_name?: string;
    code?: string;
    facility_code?: string;
    address?: string;
    city?: string;
    region?: string;
};

export type DirectoryFacility = {
    id: string;
    name: string;
    code: string;
    location: string;
};

/** Display locations for known facilities (API addresses may differ). */
const LOCATION_OVERRIDES: Record<string, string> = {
    "accra medical center": "Ring Road Central, Accra",
    "alpha clinic": "Osu, Accra",
    "blvck river hospital": "Kumasi Main Rd",
    "campeh clinic": "Tema Metro",
    "cape coast teaching hospital": "Cape Coast North",
    "helix health": "East Legon, Accra",
};

export function apiFacilityId(row: ApiFacility): string {
    return String(row.facility_id || row.id || "").trim();
}

export function mapApiToDirectory(row: ApiFacility): DirectoryFacility | null {
    const id = apiFacilityId(row);
    const name = String(row.name || row.facility_name || "").trim();
    const code = String(row.code || row.facility_code || "").trim();
    if (!id || !name) return null;

    const key = name.toLowerCase();
    const location =
        LOCATION_OVERRIDES[key] ||
        [row.address, row.city, row.region].filter((p) => p && String(p).trim()).join(", ") ||
        "—";

    return {
        id,
        name,
        code: code || name.slice(0, 3).toUpperCase(),
        location,
    };
}

export function mapApiList(rows: ApiFacility[]): DirectoryFacility[] {
    return rows.map(mapApiToDirectory).filter((r): r is DirectoryFacility => r !== null);
}
