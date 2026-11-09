export type CriticalAlertSoundKey =
    | 'urgent'
    | 'nuclear'
    | 'security'
    | 'klaxon'
    | 'alert'
    | 'fire'
    | string;

export type CriticalAlertSoundOption = {
    key: CriticalAlertSoundKey;
    label: string;
    file: string;
    /** Local admin preview path under /public/sounds, when bundled. */
    previewUrl?: string;
    blurb: string;
};

const FALLBACK_OPTIONS: CriticalAlertSoundOption[] = [
    {
        key: 'urgent',
        label: 'Urgent',
        file: 'critical_alert_urgent.mp3',
        previewUrl: '/sounds/critical_alert_urgent.mp3',
        blurb: 'Loud rising alarm for immediate attention.',
    },
    {
        key: 'nuclear',
        label: 'Nuclear',
        file: 'critical_alert_nuclear.mp3',
        previewUrl: '/sounds/critical_alert_nuclear.mp3',
        blurb: 'Heavy nuclear-style alert beat.',
    },
    {
        key: 'security',
        label: 'Security',
        file: 'critical_alert_security.mp3',
        previewUrl: '/sounds/critical_alert_security.mp3',
        blurb: 'Sharp security alarm tone.',
    },
    {
        key: 'klaxon',
        label: 'Klaxon',
        file: 'critical_alert_klaxon.mp3',
        previewUrl: '/sounds/critical_alert_klaxon.mp3',
        blurb: 'Short repeating security klaxon.',
    },
    {
        key: 'alert',
        label: 'Alert',
        file: 'critical_alert_alert.mp3',
        previewUrl: '/sounds/critical_alert_alert.mp3',
        blurb: 'Compact high-attention alert.',
    },
    {
        key: 'fire',
        label: 'Fire',
        file: 'critical_alert_fire.mp3',
        previewUrl: '/sounds/critical_alert_fire.mp3',
        blurb: 'Steady fire-alarm pulse.',
    },
];

const BLURBS: Record<string, string> = Object.fromEntries(
    FALLBACK_OPTIONS.map(option => [option.key, option.blurb]),
);

const PREVIEW_BY_FILE: Record<string, string> = Object.fromEntries(
    FALLBACK_OPTIONS
        .filter(option => option.previewUrl)
        .map(option => [option.file, option.previewUrl as string]),
);

const PREVIEW_BY_KEY: Record<string, string> = Object.fromEntries(
    FALLBACK_OPTIONS
        .filter(option => option.previewUrl)
        .map(option => [option.key, option.previewUrl as string]),
);

const LEGACY_KEYS = new Set(['classic', 'pulse', 'siren']);

function asRec(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function enrich(option: CriticalAlertSoundOption): CriticalAlertSoundOption {
    return {
        ...option,
        previewUrl: option.previewUrl
            || PREVIEW_BY_KEY[option.key]
            || (option.file ? PREVIEW_BY_FILE[option.file] : undefined)
            || (option.file ? `/sounds/${option.file}` : undefined),
        blurb: option.blurb || BLURBS[option.key] || 'Critical alert tone for this facility.',
    };
}

export function parseCriticalAlertSoundOptions(raw: unknown): CriticalAlertSoundOption[] {
    const list = Array.isArray(raw)
        ? raw
        : Array.isArray(asRec(raw)?.options) ? (asRec(raw)!.options as unknown[])
        : Array.isArray(asRec(raw)?.sounds) ? (asRec(raw)!.sounds as unknown[])
        : Array.isArray(asRec(raw)?.data) ? (asRec(raw)!.data as unknown[])
        : null;

    if (!list?.length) return FALLBACK_OPTIONS;

    const parsed = list.map((item): CriticalAlertSoundOption | null => {
        const rec = asRec(item);
        if (!rec) return null;
        const key = String(rec.key || rec.id || rec.sound || '').trim().toLowerCase();
        if (!key) return null;
        const file = String(rec.file || rec.filename || '').trim();
        const label = String(rec.label || rec.name || key).trim() || key;
        return enrich({
            key,
            label: label.charAt(0).toUpperCase() + label.slice(1),
            file,
            blurb: BLURBS[key] || 'Critical alert tone for this facility.',
        });
    }).filter((item): item is CriticalAlertSoundOption => Boolean(item));

    if (!parsed.length) return FALLBACK_OPTIONS;

    // Backend may still advertise the old classic/pulse/siren trio — prefer the new local catalog.
    if (parsed.every(option => LEGACY_KEYS.has(option.key))) {
        return FALLBACK_OPTIONS;
    }

    return parsed;
}

export function readCriticalAlertSound(raw: unknown): string {
    const rec = asRec(raw);
    if (!rec) return 'urgent';
    const value = String(rec.critical_alert_sound || rec.criticalAlertSound || '').trim().toLowerCase();
    return value || 'urgent';
}
