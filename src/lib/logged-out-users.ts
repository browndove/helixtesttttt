import { API_ENDPOINTS } from '@/lib/config';

export type LoggedOutUser = {
    userId: string;
    email?: string;
    facilityId?: string;
};

type Rec = Record<string, unknown>;

function asRec(value: unknown): Rec | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : null;
}

function str(rec: Rec | null, ...keys: string[]): string {
    if (!rec) return '';
    for (const key of keys) {
        const value = rec[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
}

function num(rec: Rec | null, ...keys: string[]): number | undefined {
    if (!rec) return undefined;
    for (const key of keys) {
        const value = rec[key];
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
    }
    return undefined;
}

function parseUser(raw: unknown): LoggedOutUser | null {
    const rec = asRec(raw);
    if (!rec) return null;
    const userId = str(rec, 'user_id', 'userId', 'id');
    if (!userId) return null;
    return {
        userId,
        email: str(rec, 'email') || undefined,
        facilityId: str(rec, 'facility_id', 'facilityId') || undefined,
    };
}

/**
 * Loads every logged-out user for one facility (paginated upstream, max page_size 100).
 * Returns a lowercase set of user_id + email keys for row matching.
 */
export async function fetchLoggedOutMatchKeys(facilityId: string): Promise<Set<string>> {
    const keys = new Set<string>();
    if (!facilityId) return keys;

    const pageSize = 100;
    let pageId = 1;
    let total = Infinity;

    while ((pageId - 1) * pageSize < total && pageId <= 50) {
        const qs = new URLSearchParams({
            facility_id: facilityId,
            page_id: String(pageId),
            page_size: String(pageSize),
        });
        const res = await fetch(`${API_ENDPOINTS.INTERNAL_USERS_LOGGED_OUT}?${qs}`, {
            credentials: 'include',
            cache: 'no-store',
        });
        if (!res.ok) break;

        const raw = await res.json().catch(() => null);
        const rec = asRec(raw);
        const usersRaw = Array.isArray(rec?.users) ? rec!.users
            : Array.isArray(rec?.data) ? rec!.data
            : [];
        total = num(rec, 'count', 'total') ?? usersRaw.length;

        for (const item of usersRaw) {
            const user = parseUser(item);
            if (!user) continue;
            keys.add(user.userId.toLowerCase());
            if (user.email) keys.add(user.email.toLowerCase());
        }

        if (usersRaw.length === 0 || usersRaw.length < pageSize) break;
        pageId += 1;
    }

    return keys;
}

export function isStaffLoggedOut(
    staff: { user_id?: string; id?: string; email?: string },
    loggedOutKeys: Set<string>,
): boolean {
    if (!loggedOutKeys.size) return false;
    const candidates = [staff.user_id, staff.id, staff.email].filter(Boolean) as string[];
    return candidates.some(c => loggedOutKeys.has(c.trim().toLowerCase()));
}
