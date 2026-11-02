export type CriticalAlertSoundKey = 'classic' | 'pulse' | 'siren' | string;

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
        key: 'classic',
        label: 'Classic',
        file: 'critical_alert.mp3',
        blurb: 'The familiar critical alert already used in Helix.',
    },
    {
        key: 'pulse',
        label: 'Pulse',
        file: 'critical_alert_pulse.mp3',
        previewUrl: '/sounds/critical_alert_pulse.mp3',
        blurb: 'A steady fire-alarm pulse for urgent attention.',
    },
    {
        key: 'siren',
        label: 'Siren',
        file: 'critical_alert_siren.mp3',
        previewUrl: '/sounds/critical_alert_siren.mp3',
        blurb: 'A rising siren for maximum urgency.',
    },
];

const BLURBS: Record<string, string> = {
    classic: 'The familiar critical alert already used in Helix.',
    pulse: 'A steady fire-alarm pulse for urgent attention.',
    siren: 'A rising siren for maximum urgency.',
};

const PREVIEW_BY_FILE: Record<string, string> = {
    'critical_alert_pulse.mp3': '/sounds/critical_alert_pulse.mp3',
    'critical_alert_siren.mp3': '/sounds/critical_alert_siren.mp3',
};

const PREVIEW_BY_KEY: Record<string, string> = {
    pulse: '/sounds/critical_alert_pulse.mp3',
    siren: '/sounds/critical_alert_siren.mp3',
};

function asRec(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
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
        const previewUrl = PREVIEW_BY_KEY[key] || (file ? PREVIEW_BY_FILE[file] : undefined) || (file ? `/sounds/${file}` : undefined);
        return {
            key,
            label: label.charAt(0).toUpperCase() + label.slice(1),
            file,
            previewUrl,
            blurb: BLURBS[key] || 'Critical alert tone for this facility.',
        };
    }).filter((item): item is CriticalAlertSoundOption => Boolean(item));

    return parsed.length ? parsed : FALLBACK_OPTIONS;
}

export function readCriticalAlertSound(raw: unknown): string {
    const rec = asRec(raw);
    if (!rec) return 'classic';
    const value = String(rec.critical_alert_sound || rec.criticalAlertSound || '').trim().toLowerCase();
    return value || 'classic';
}
