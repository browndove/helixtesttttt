/**
 * Short-lived JSON cache for GET /api/proxy/* responses (sessionStorage + memory).
 * Used so revisiting admin pages can paint cached data immediately while a fresh fetch runs.
 */

const STORAGE_PREFIX = 'helix:gj:';
const memory = new Map<string, { t: number; v: unknown }>();

export function readCachedJson(url: string, maxAgeMs: number): unknown | null {
    const now = Date.now();
    const hit = memory.get(url);
    if (hit && now - hit.t < maxAgeMs) return hit.v;
    if (typeof window === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(STORAGE_PREFIX + url);
        if (!raw) return null;
        const row = JSON.parse(raw) as { t: number; v: unknown };
        if (now - row.t >= maxAgeMs) return null;
        memory.set(url, row);
        return row.v;
    } catch {
        return null;
    }
}

export function writeCachedJson(url: string, value: unknown): void {
    const row = { t: Date.now(), v: value };
    memory.set(url, row);
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(STORAGE_PREFIX + url, JSON.stringify(row));
    } catch {
        /* quota or private mode */
    }
}
