/** Resolve ISO 3166-1 alpha-2 (and common aliases) to a display country name. */

const REGION_ALIASES: Record<string, string> = {
    UK: 'GB',
    EL: 'GR',
    USA: 'US',
    UAE: 'AE',
};

/** Common alpha-3 → alpha-2 for App Store territory labels. */
const ALPHA3_TO_ALPHA2: Record<string, string> = {
    USA: 'US', GBR: 'GB', ARE: 'AE', DEU: 'DE', FRA: 'FR', CAN: 'CA',
    AUS: 'AU', IND: 'IN', NGA: 'NG', GHA: 'GH', KEN: 'KE', ZAF: 'ZA',
    NLD: 'NL', BEL: 'BE', CHE: 'CH', AUT: 'AT', ESP: 'ES', ITA: 'IT',
    PRT: 'PT', BRA: 'BR', MEX: 'MX', JPN: 'JP', KOR: 'KR', CHN: 'CN',
    HKG: 'HK', SGP: 'SG', MYS: 'MY', PHL: 'PH', IDN: 'ID', THA: 'TH',
    VNM: 'VN', TUR: 'TR', SAU: 'SA', EGY: 'EG', ISR: 'IL', POL: 'PL',
    SWE: 'SE', NOR: 'NO', DNK: 'DK', FIN: 'FI', IRL: 'IE', NZL: 'NZ',
    ARG: 'AR', CHL: 'CL', COL: 'CO', PER: 'PE', PAK: 'PK', BGD: 'BD',
    RUS: 'RU', UKR: 'UA', ROU: 'RO', CZE: 'CZ', HUN: 'HU', GRC: 'GR',
};

let displayNames: Intl.DisplayNames | null | undefined;
let nameToCode: Map<string, string> | null = null;

function getDisplayNames(): Intl.DisplayNames | null {
    if (displayNames !== undefined) return displayNames;
    try {
        displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
        displayNames = null;
    }
    return displayNames;
}

function getNameToCode(): Map<string, string> {
    if (nameToCode) return nameToCode;
    const map = new Map<string, string>();
    const names = getDisplayNames();
    if (names) {
        // Cover the common ISO 3166-1 alpha-2 range used by store reports.
        for (let a = 65; a <= 90; a += 1) {
            for (let b = 65; b <= 90; b += 1) {
                const code = String.fromCharCode(a, b);
                const label = names.of(code);
                if (label && label !== code) map.set(label.toLowerCase(), code);
            }
        }
    }
    nameToCode = map;
    return map;
}

/**
 * Normalize a store territory / country label to ISO 3166-1 alpha-2 when possible.
 * Apple may send a full English name or a code; Play usually sends alpha-2.
 */
export function normalizeCountryCode(codeOrName: string): string {
    const raw = (codeOrName || '').trim();
    if (!raw) return '';

    if (/^[A-Za-z]{2}$/.test(raw)) {
        const upper = raw.toUpperCase();
        return REGION_ALIASES[upper] || upper;
    }

    if (/^[A-Za-z]{3}$/.test(raw)) {
        const upper = raw.toUpperCase();
        return ALPHA3_TO_ALPHA2[upper] || REGION_ALIASES[upper] || upper;
    }

    const fromName = getNameToCode().get(raw.toLowerCase());
    if (fromName) return fromName;
    return raw;
}

export function countryCodeToName(codeOrName: string): string {
    const raw = (codeOrName || '').trim();
    if (!raw) return 'Unknown';

    const code = normalizeCountryCode(raw);
    if (!/^[A-Za-z]{2}$/.test(code)) return raw;

    const names = getDisplayNames();
    const resolved = names?.of(code);
    if (resolved && resolved !== code) return resolved;
    return code;
}
