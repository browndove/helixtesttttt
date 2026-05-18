import { API_ENDPOINTS } from '@/lib/config';

export const STAFF_INVITE_EMAILS_MAX_PER_REQUEST = 100;

export type StaffInviteEmailError = {
    staff_id: string;
    email?: string;
    message: string;
};

export type SendStaffInviteEmailsResult = {
    queued: number;
    errors: StaffInviteEmailError[];
    /** True when every chunk returned HTTP 200 (partial per-staff errors may still exist). */
    ok: boolean;
    /** Set when the server cannot send mail (e.g. missing RESEND_API_KEY). */
    emailNotConfigured?: boolean;
};

function getFacilityIdFromAuthMe(raw: unknown): string {
    const rec = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const user = rec.user && typeof rec.user === 'object' ? (rec.user as Record<string, unknown>) : null;
    const rootCandidates = [rec.facility_id, rec.facilityId, rec.current_facility_id, rec.currentFacilityId];
    const userCandidates = user
        ? [user.facility_id, user.facilityId, user.current_facility_id, user.currentFacilityId]
        : [];
    const resolved = [...rootCandidates, ...userCandidates].find(v => typeof v === 'string' && v.trim());
    return typeof resolved === 'string' ? resolved.trim() : '';
}

function getFacilityIdFromFacilityPayload(raw: unknown): string {
    if (Array.isArray(raw)) {
        const first = raw[0];
        return getFacilityIdFromFacilityPayload(first);
    }
    const rec = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const id = [rec.id, rec.facility_id, rec.facilityId].find(v => typeof v === 'string' && v.trim());
    return typeof id === 'string' ? id.trim() : '';
}

/** Resolves facility UUID for tenant-scoped staff APIs (cookie → auth/me → hospital → facilities). */
export async function resolveClientFacilityId(): Promise<string> {
    if (typeof document !== 'undefined') {
        const cookieMatch = document.cookie.match(/helix-facility=([^;]+)/);
        if (cookieMatch?.[1]?.trim()) return cookieMatch[1].trim();
    }

    const meRes = await fetch('/api/proxy/auth/me', { credentials: 'include' });
    if (meRes.ok) {
        const meData = await meRes.json().catch(() => ({}));
        const fromMe = getFacilityIdFromAuthMe(meData);
        if (fromMe) return fromMe;
    }

    const hospitalRes = await fetch('/api/proxy/hospital', { credentials: 'include' });
    if (hospitalRes.ok) {
        const hospitalData = await hospitalRes.json().catch(() => ({}));
        const fromHospital = getFacilityIdFromFacilityPayload(hospitalData);
        if (fromHospital) return fromHospital;
    }

    const facilitiesRes = await fetch('/api/proxy/facilities', { credentials: 'include' });
    if (facilitiesRes.ok) {
        const facilitiesData = await facilitiesRes.json().catch(() => ([]));
        const fromList = getFacilityIdFromFacilityPayload(facilitiesData);
        if (fromList) return fromList;
    }

    return '';
}

function parseInviteErrors(raw: unknown): StaffInviteEmailError[] {
    if (!Array.isArray(raw)) return [];
    return raw.map(e => {
        if (!e || typeof e !== 'object') {
            return { staff_id: '', message: String(e || 'Unknown error') };
        }
        const er = e as Record<string, unknown>;
        return {
            staff_id: String(er.staff_id || er.staffId || '').trim(),
            email: String(er.email || '').trim() || undefined,
            message: String(er.message || er.detail || er.error || '').trim() || 'Unknown error',
        };
    });
}

function uniqueStaffIds(ids: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of ids) {
        const trimmed = id.trim();
        if (!trimmed || seen.has(trimmed)) continue;
        seen.add(trimmed);
        out.push(trimmed);
    }
    return out;
}

function chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

/**
 * POST /staff/send-invite-emails — explicit invite delivery (chunks of 100 IDs).
 */
export async function sendStaffInviteEmails(staffIds: string[]): Promise<SendStaffInviteEmailsResult> {
    const ids = uniqueStaffIds(staffIds);
    if (ids.length === 0) {
        return { queued: 0, errors: [], ok: false };
    }

    const facilityId = await resolveClientFacilityId();
    let totalQueued = 0;
    const allErrors: StaffInviteEmailError[] = [];
    let allOk = true;
    let emailNotConfigured = false;

    for (const batch of chunk(ids, STAFF_INVITE_EMAILS_MAX_PER_REQUEST)) {
        const body: Record<string, unknown> = { staff_ids: batch };
        if (facilityId) body.facility_id = facilityId;

        const res = await fetch(API_ENDPOINTS.STAFF_SEND_INVITE_EMAILS, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

        if (res.status === 503) {
            emailNotConfigured = true;
            allOk = false;
            break;
        }

        if (!res.ok) {
            allOk = false;
            const topMessage = String(data.message || data.error || data.detail || '').trim();
            if (topMessage) {
                allErrors.push({ staff_id: '', message: topMessage });
            }
            allErrors.push(...parseInviteErrors(data.errors));
            if (res.status >= 500) break;
            continue;
        }

        totalQueued += typeof data.queued === 'number' ? data.queued : 0;
        allErrors.push(...parseInviteErrors(data.errors));
    }

    return {
        queued: totalQueued,
        errors: allErrors,
        ok: allOk && !emailNotConfigured,
        emailNotConfigured,
    };
}

/** Extract user/staff UUID from a bulk `created[]` entry. */
export function extractStaffIdFromBulkCreated(raw: unknown): string {
    if (!raw || typeof raw !== 'object') return '';
    const r = raw as Record<string, unknown>;
    const nest = (k: string): Record<string, unknown> | null => {
        const v = r[k];
        return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    };
    const staff = nest('staff') || nest('staff_member') || nest('user') || r;
    return String(r.id || staff.id || r.staff_id || staff.staff_id || r.user_id || '').trim();
}
