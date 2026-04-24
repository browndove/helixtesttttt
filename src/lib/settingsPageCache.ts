import { invalidateCachedJson, readCachedJson, writeCachedJson } from '@/lib/getJsonCache';

export const SETTINGS_PAGE_CACHE_KEY = '/__helix_settings_page__';
/** Revisit the page within the same session does not re-fetch a cold cache until this TTL. */
export const SETTINGS_PAGE_TTL_MS = 4 * 60 * 60 * 1000;

export type SettingsPageSnapshotV1 = {
    v: 1;
    currentUserId: string;
    fullName: string;
    email: string;
    phone: string;
    jobTitle: string;
    userRole: string;
    twoFactor: boolean;
    sessionTimeout: string;
    sessions: Array<{
        id: string;
        device: string;
        location: string;
        time: string;
        current: boolean;
    }>;
    facilityId: string;
    screenshotsAllowed: boolean;
    admins: Array<{
        id: string;
        name: string;
        email: string;
        role: 'Super Admin' | 'Admin' | 'Editor' | 'Viewer';
        status: 'Active' | 'Invited' | 'Disabled';
        lastLogin: string;
    }>;
};

function isSnapshotV1(x: unknown): x is SettingsPageSnapshotV1 {
    if (!x || typeof x !== 'object' || (x as { v?: unknown }).v !== 1) return false;
    const o = x as SettingsPageSnapshotV1;
    return (
        Array.isArray(o.sessions) &&
        Array.isArray(o.admins) &&
        typeof o.twoFactor === 'boolean' &&
        typeof o.screenshotsAllowed === 'boolean'
    );
}

export function readSettingsPageSnapshot(): SettingsPageSnapshotV1 | null {
    const raw = readCachedJson(SETTINGS_PAGE_CACHE_KEY, SETTINGS_PAGE_TTL_MS);
    return isSnapshotV1(raw) ? raw : null;
}

export function writeSettingsPageSnapshot(snapshot: SettingsPageSnapshotV1): void {
    writeCachedJson(SETTINGS_PAGE_CACHE_KEY, snapshot);
}

export function clearSettingsPageCache(): void {
    invalidateCachedJson(SETTINGS_PAGE_CACHE_KEY);
}
