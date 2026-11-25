/**
 * Role display names are facility-prefixed ("WGH - Doctor On Duty - A&E"). Inside one
 * facility's analytics the prefix is noise and pushes the meaningful part out of view.
 */
const FACILITY_PREFIX = /^[A-Z0-9]{2,6}\s*-\s*/;

export function shortRoleName(name: string): string {
    const trimmed = name.trim();
    const stripped = trimmed.replace(FACILITY_PREFIX, '');
    return stripped || trimmed;
}

/** "Doctor On Duty - A&E" → { role: "Doctor On Duty", unit: "A&E" } (unit empty when absent). */
export function splitRoleName(name: string): { role: string; unit: string } {
    const short = shortRoleName(name);
    const cut = short.lastIndexOf(' - ');
    if (cut <= 0) return { role: short, unit: '' };
    return { role: short.slice(0, cut), unit: short.slice(cut + 3) };
}
