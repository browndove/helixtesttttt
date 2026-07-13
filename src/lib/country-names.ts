/** Resolve ISO 3166-1 alpha-2 (and common aliases) to a display country name. */

const REGION_ALIASES: Record<string, string> = {
    UK: 'GB',
    EL: 'GR',
};

let displayNames: Intl.DisplayNames | null | undefined;

function getDisplayNames(): Intl.DisplayNames | null {
    if (displayNames !== undefined) return displayNames;
    try {
        displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
        displayNames = null;
    }
    return displayNames;
}

export function countryCodeToName(codeOrName: string): string {
    const raw = (codeOrName || '').trim();
    if (!raw) return 'Unknown';

    // Already a full name (or non-code label)
    if (!/^[A-Za-z]{2}$/.test(raw)) return raw;

    const code = (REGION_ALIASES[raw.toUpperCase()] || raw).toUpperCase();
    const names = getDisplayNames();
    const resolved = names?.of(code);
    if (resolved && resolved !== code) return resolved;
    return code;
}
