export type CriticalAlertSoundKey = string;

export type CriticalAlertSoundOption = {
    key: CriticalAlertSoundKey;
    label: string;
    file: string;
    /** Local admin preview path under /public/sounds (copied from docs/assets/critical-alert-sounds). */
    previewUrl?: string;
    blurb?: string;
};

/** Legacy / unset values that are not selectable options in the picker. */
const UNSET_KEYS = new Set(['', 'classic', 'pulse', 'siren']);

function asRec(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function previewUrlFor(key: string, file: string): string | undefined {
    if (file) return `/sounds/${file.replace(/^\/+/, '')}`;
    if (key) return `/sounds/critical_alert_${key}.mp3`;
    return undefined;
}

/** Build the picker list from GET /facilities/critical-alert-sounds only — no hard-coded catalog. */
export function parseCriticalAlertSoundOptions(raw: unknown): CriticalAlertSoundOption[] {
    const list = Array.isArray(raw)
        ? raw
        : Array.isArray(asRec(raw)?.options) ? (asRec(raw)!.options as unknown[])
        : Array.isArray(asRec(raw)?.sounds) ? (asRec(raw)!.sounds as unknown[])
        : Array.isArray(asRec(raw)?.data) ? (asRec(raw)!.data as unknown[])
        : null;

    if (!list?.length) return [];

    return list.map((item): CriticalAlertSoundOption | null => {
        const rec = asRec(item);
        if (!rec) return null;
        const key = String(rec.key || rec.id || rec.sound || '').trim().toLowerCase();
        if (!key || UNSET_KEYS.has(key)) return null;
        const file = String(rec.file || rec.filename || '').trim();
        const labelRaw = String(rec.label || rec.name || key).trim() || key;
        const label = labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1);
        return {
            key,
            label,
            file,
            previewUrl: previewUrlFor(key, file),
            blurb: String(rec.description || rec.blurb || '').trim() || undefined,
        };
    }).filter((item): item is CriticalAlertSoundOption => Boolean(item));
}

export function readCriticalAlertSound(raw: unknown): string {
    const rec = asRec(raw);
    if (!rec) return 'classic';
    const value = String(rec.critical_alert_sound || rec.criticalAlertSound || '').trim().toLowerCase();
    return value || 'classic';
}

/** True when the facility still uses the default (classic) or a retired key. */
export function isDefaultCriticalAlertSound(
    key: string,
    options: CriticalAlertSoundOption[] = [],
): boolean {
    const k = (key || '').trim().toLowerCase();
    if (UNSET_KEYS.has(k)) return true;
    if (!options.length) return UNSET_KEYS.has(k);
    return !options.some(option => option.key === k);
}
