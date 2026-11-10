export type CriticalAlertSoundKey = string;

export type CriticalAlertSoundOption = {
    key: CriticalAlertSoundKey;
    label: string;
    file: string;
    /** Local admin preview path under /public/sounds (copied from docs/assets/critical-alert-sounds). */
    previewUrl?: string;
    blurb?: string;
};

/** Retired keys that are not selectable. */
const RETIRED_KEYS = new Set(['', 'pulse', 'siren']);

const CLASSIC_OPTION: CriticalAlertSoundOption = {
    key: 'classic',
    label: 'Classic',
    file: 'critical_alert.mp3',
    previewUrl: '/sounds/critical_alert.mp3',
    blurb: 'The original Helix critical alert tone.',
};

function asRec(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function previewUrlFor(key: string, file: string): string | undefined {
    if (file) return `/sounds/${file.replace(/^\/+/, '')}`;
    if (key === 'classic') return '/sounds/critical_alert.mp3';
    if (key) return `/sounds/critical_alert_${key}.mp3`;
    return undefined;
}

function parseOne(item: unknown): CriticalAlertSoundOption | null {
    const rec = asRec(item);
    if (!rec) return null;
    const key = String(rec.key || rec.id || rec.sound || '').trim().toLowerCase();
    if (!key || RETIRED_KEYS.has(key)) return null;
    const file = String(rec.file || rec.filename || '').trim()
        || (key === 'classic' ? CLASSIC_OPTION.file : '');
    const labelRaw = String(rec.label || rec.name || (key === 'classic' ? 'Classic' : key)).trim() || key;
    const label = labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1);
    return {
        key,
        label,
        file,
        previewUrl: previewUrlFor(key, file),
        blurb: String(rec.description || rec.blurb || '').trim()
            || (key === 'classic' ? CLASSIC_OPTION.blurb : undefined),
    };
}

/**
 * Build the picker list from GET /facilities/critical-alert-sounds.
 * Always includes Classic (`critical_alert.mp3`) even when the API omits it.
 */
export function parseCriticalAlertSoundOptions(raw: unknown): CriticalAlertSoundOption[] {
    const list = Array.isArray(raw)
        ? raw
        : Array.isArray(asRec(raw)?.options) ? (asRec(raw)!.options as unknown[])
        : Array.isArray(asRec(raw)?.sounds) ? (asRec(raw)!.sounds as unknown[])
        : Array.isArray(asRec(raw)?.data) ? (asRec(raw)!.data as unknown[])
        : null;

    const parsed = (list || [])
        .map(parseOne)
        .filter((item): item is CriticalAlertSoundOption => Boolean(item));

    if (!parsed.some(option => option.key === 'classic')) {
        return [CLASSIC_OPTION, ...parsed];
    }

    return parsed.map(option => (
        option.key === 'classic'
            ? {
                ...option,
                file: option.file || CLASSIC_OPTION.file,
                previewUrl: option.previewUrl || CLASSIC_OPTION.previewUrl,
                blurb: option.blurb || CLASSIC_OPTION.blurb,
                label: option.label || CLASSIC_OPTION.label,
            }
            : option
    ));
}

export function readCriticalAlertSound(raw: unknown): string {
    const rec = asRec(raw);
    if (!rec) return 'classic';
    const value = String(rec.critical_alert_sound || rec.criticalAlertSound || '').trim().toLowerCase();
    return value || 'classic';
}

/** True for retired keys (pulse/siren) or unknown values not in the option list. */
export function isDefaultCriticalAlertSound(
    key: string,
    options: CriticalAlertSoundOption[] = [],
): boolean {
    const k = (key || '').trim().toLowerCase();
    if (RETIRED_KEYS.has(k)) return true;
    if (!k) return true;
    if (!options.length) return k !== 'classic';
    return !options.some(option => option.key === k);
}
