/** Persists admin sidebar context in sessionStorage so brand + profile row do not flash placeholders on navigation or first paint. */
const FACILITY_DISPLAY_NAME_KEY = 'helix_admin_facility_display_name';
const SIDEBAR_USER_KEY = 'helix_admin_sidebar_user_json';

export type CachedSidebarUser = {
    name: string;
    role: string;
    email: string;
};

const GENERIC_NAMES = new Set(['facility', 'facilities', 'hospital']);

export function readFacilityDisplayName(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        const v = window.sessionStorage.getItem(FACILITY_DISPLAY_NAME_KEY);
        return v && v.trim() ? v.trim() : null;
    } catch {
        return null;
    }
}

export function writeFacilityDisplayName(name: string): void {
    const trimmed = String(name || '').trim();
    if (!trimmed || !isLikelyFacilityDisplayName(trimmed)) return;
    try {
        window.sessionStorage.setItem(FACILITY_DISPLAY_NAME_KEY, trimmed);
    } catch {
        /* quota / private mode */
    }
}

export function clearFacilityDisplayName(): void {
    try {
        window.sessionStorage.removeItem(FACILITY_DISPLAY_NAME_KEY);
    } catch {
        /* ignore */
    }
}

export function readCachedSidebarUser(): CachedSidebarUser | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.sessionStorage.getItem(SIDEBAR_USER_KEY);
        if (!raw) return null;
        const o = JSON.parse(raw) as Record<string, unknown>;
        const name = String(o.name || '').trim();
        const role = String(o.role || 'Admin').trim();
        const email = String(o.email || '').trim();
        if (!name) return null;
        return { name, role: role || 'Admin', email };
    } catch {
        return null;
    }
}

export function writeCachedSidebarUser(user: CachedSidebarUser): void {
    const name = String(user.name || '').trim();
    const role = String(user.role || 'Admin').trim();
    if (!name) return;
    try {
        window.sessionStorage.setItem(
            SIDEBAR_USER_KEY,
            JSON.stringify({ name, role, email: String(user.email || '').trim() }),
        );
    } catch {
        /* ignore */
    }
}

export function clearCachedSidebarUser(): void {
    try {
        window.sessionStorage.removeItem(SIDEBAR_USER_KEY);
    } catch {
        /* ignore */
    }
}

import { clearSettingsPageCache } from '@/lib/settingsPageCache';

/** Clear all admin sidebar session cache (call on logout). */
export function clearAdminSidebarSession(): void {
    clearFacilityDisplayName();
    clearCachedSidebarUser();
    clearSettingsPageCache();
}

export function isLikelyFacilityDisplayName(name: string): boolean {
    const n = name.trim().toLowerCase();
    if (!n) return false;
    return !GENERIC_NAMES.has(n);
}
