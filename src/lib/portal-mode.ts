'use client';

import { useSyncExternalStore } from 'react';
import { getCachedClientFacilityId, readHelixFacilityIdFromDocument } from '@/lib/facility-client';

/**
 * Admin portal view: the full Helix sidebar, or a trimmed one for facilities that only use
 * scheduling. It is a per-browser preference (kept per facility), not a permission — hidden
 * pages stay reachable by URL.
 */
export type PortalMode = 'full' | 'scheduling';

const EVENT = 'helix-portal-mode';

/** Pages shown in Scheduling mode; everything else in the sidebar is hidden. */
export const SCHEDULING_MODE_HREFS = new Set(['/home', '/departments', '/roles', '/staff', '/scheduling', '/audit-log']);

function storageKey(): string {
    const facilityId = getCachedClientFacilityId() || readHelixFacilityIdFromDocument() || 'default';
    return `helix-portal-mode:${facilityId}`;
}

export function readPortalMode(): PortalMode {
    try {
        return window.localStorage.getItem(storageKey()) === 'scheduling' ? 'scheduling' : 'full';
    } catch {
        return 'full';
    }
}

export function writePortalMode(mode: PortalMode): boolean {
    try {
        window.localStorage.setItem(storageKey(), mode);
        window.dispatchEvent(new Event(EVENT));
        return true;
    } catch {
        return false;
    }
}

function subscribe(onChange: () => void) {
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
        window.removeEventListener(EVENT, onChange);
        window.removeEventListener('storage', onChange);
    };
}

export function usePortalMode(): PortalMode {
    return useSyncExternalStore(subscribe, readPortalMode, () => 'full');
}
