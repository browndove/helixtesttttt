import {
    backfillMissingRolePolicies,
    type JoinablePolicy,
    type JoinableRole,
    unwrapEscalationPolicyPayload,
} from '@/lib/escalation-policy-join';
import { isClientInternalSupportMode, resolveClientFacilityId } from '@/lib/facility-client';

/** Page size for each GET /escalation-policies request while loading the full list. */
export const ESCALATION_POLICY_LIST_PAGE_SIZE = 100;

const MAX_POLICY_PAGES = 100;

export type EscalationPolicyListItem = JoinablePolicy & {
    id?: string;
    initial_timeout_seconds?: number;
    steps?: unknown;
    [key: string]: unknown;
};

function looksLikePolicyRecord(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const rec = value as Record<string, unknown>;
    return (
        (typeof rec.id === 'string' && rec.id.trim().length > 0)
        || (typeof rec.role_id === 'string' && rec.role_id.trim().length > 0)
        || Array.isArray(rec.steps)
        || rec.initial_timeout_seconds !== undefined
    );
}

/** Extract a policy array from a bare list or a common envelope shape. */
export function extractEscalationPoliciesArray(raw: unknown): EscalationPolicyListItem[] {
    if (Array.isArray(raw)) {
        return raw.filter(looksLikePolicyRecord) as EscalationPolicyListItem[];
    }
    if (!raw || typeof raw !== 'object') return [];

    const obj = raw as Record<string, unknown>;
    const preferredKeys = ['items', 'data', 'policies', 'results', 'rows', 'records'];
    for (const key of preferredKeys) {
        const value = obj[key];
        if (Array.isArray(value)) {
            return value.filter(looksLikePolicyRecord) as EscalationPolicyListItem[];
        }
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const nested = value as Record<string, unknown>;
            for (const nestedKey of preferredKeys) {
                const nestedValue = nested[nestedKey];
                if (Array.isArray(nestedValue)) {
                    return nestedValue.filter(looksLikePolicyRecord) as EscalationPolicyListItem[];
                }
            }
        }
    }

    for (const value of Object.values(obj)) {
        if (!Array.isArray(value) || value.length === 0) continue;
        if (value.some(looksLikePolicyRecord)) {
            return value.filter(looksLikePolicyRecord) as EscalationPolicyListItem[];
        }
    }

    return [];
}

function readPolicyListTotal(raw: unknown): number | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const o = raw as Record<string, unknown>;
    const candidates = [o.total, o.total_count, o.totalCount, o.count];
    for (const c of candidates) {
        const n = Number(c);
        if (Number.isFinite(n) && n >= 0) return n;
    }
    for (const nestKey of ['pagination', 'meta', 'page'] as const) {
        const nest = o[nestKey];
        if (!nest || typeof nest !== 'object') continue;
        const p = nest as Record<string, unknown>;
        for (const k of ['total', 'total_count', 'totalCount'] as const) {
            const n = Number(p[k]);
            if (Number.isFinite(n) && n >= 0) return n;
        }
    }
    return undefined;
}

function policyDedupeKey(policy: EscalationPolicyListItem): string {
    const id = String(policy.id ?? '').trim();
    if (id) return `id:${id}`;
    const roleId = String(policy.role_id ?? '').trim();
    if (roleId) return `role:${roleId}`;
    const roleName = String(policy.role_name ?? policy.roleName ?? '').trim().toLowerCase();
    if (roleName) return `name:${roleName}`;
    return '';
}

function policyListPageUrl(pageId: number, pageSize = ESCALATION_POLICY_LIST_PAGE_SIZE, facilityId?: string): string {
    const params = new URLSearchParams({
        page_size: String(pageSize),
        page_id: String(pageId),
    });
    if (facilityId) params.set('facility_id', facilityId);
    return `/api/proxy/escalation-policies?${params.toString()}`;
}

/**
 * Fetches every escalation-policy page until the API reports no more rows.
 * Dedupes overlapping pages (backends that ignore page_id would otherwise loop).
 */
export async function fetchAllEscalationPoliciesPayload(
    init?: RequestInit,
): Promise<{ ok: boolean; data: EscalationPolicyListItem[]; total: number }> {
    const allRows: EscalationPolicyListItem[] = [];
    const seen = new Set<string>();
    let pageId = 1;
    let reportedTotal: number | undefined;
    const facilityId = (await isClientInternalSupportMode())
        ? await resolveClientFacilityId()
        : undefined;

    while (pageId <= MAX_POLICY_PAGES) {
        const pageUrl = policyListPageUrl(pageId, ESCALATION_POLICY_LIST_PAGE_SIZE, facilityId);
        const res = await fetch(pageUrl, init);
        if (!res.ok) {
            if (pageId === 1) {
                // Fall back to the unparameterized list once if paging is rejected.
                const fallbackRes = await fetch('/api/proxy/escalation-policies', init);
                if (!fallbackRes.ok) return { ok: false, data: [], total: 0 };
                let fallbackJson: unknown;
                try {
                    fallbackJson = await fallbackRes.json();
                } catch {
                    return { ok: false, data: [], total: 0 };
                }
                const fallbackRows = extractEscalationPoliciesArray(fallbackJson);
                return {
                    ok: true,
                    data: fallbackRows,
                    total: readPolicyListTotal(fallbackJson) ?? fallbackRows.length,
                };
            }
            break;
        }

        let pageJson: unknown;
        try {
            pageJson = await res.json();
        } catch {
            if (pageId === 1) return { ok: false, data: [], total: 0 };
            break;
        }

        const pageRows = extractEscalationPoliciesArray(pageJson);
        if (reportedTotal === undefined) {
            reportedTotal = readPolicyListTotal(pageJson);
        }

        let newOnPage = 0;
        for (const row of pageRows) {
            const key = policyDedupeKey(row);
            if (key) {
                if (seen.has(key)) continue;
                seen.add(key);
            }
            allRows.push(row);
            newOnPage += 1;
        }

        if (pageRows.length === 0) break;
        // Backend ignored paging and re-sent the same slice.
        if (newOnPage === 0) break;
        if (pageRows.length < ESCALATION_POLICY_LIST_PAGE_SIZE) break;
        if (reportedTotal !== undefined && allRows.length >= reportedTotal) break;

        pageId += 1;
    }

    return {
        ok: true,
        data: allRows,
        total: reportedTotal ?? allRows.length,
    };
}

/**
 * Always reload steps via by-role. The policies list often returns stale/partial
 * `steps` (including non-empty outdated arrays).
 */
export async function hydrateEscalationPolicySteps<P extends EscalationPolicyListItem>(
    policies: P[],
    fetchByRole: (roleId: string) => Promise<unknown>,
): Promise<P[]> {
    if (policies.length === 0) return policies;
    return Promise.all(policies.map(async (policy) => {
        const roleId = String(policy.role_id || '').trim();
        if (!roleId) return policy;
        try {
            const raw = await fetchByRole(roleId);
            const detail = unwrapEscalationPolicyPayload(raw);
            if (!detail) return policy;
            const steps = Array.isArray(detail.steps) ? detail.steps : policy.steps;
            const initialTimeout = typeof detail.initial_timeout_seconds === 'number'
                ? detail.initial_timeout_seconds
                : policy.initial_timeout_seconds;
            return {
                ...policy,
                steps,
                initial_timeout_seconds: initialTimeout,
            };
        } catch {
            return policy;
        }
    }));
}

async function defaultFetchByRole(roleId: string): Promise<unknown> {
    const res = await fetch(`/api/proxy/escalation-policies/by-role/${roleId}`, {
        credentials: 'include',
    });
    return res.ok ? res.json() : null;
}

/**
 * Load the full facility policy set for the given roles:
 * 1) page through GET /escalation-policies,
 * 2) hydrate steps via by-role,
 * 3) backfill any role still missing a policy via by-role.
 */
export async function loadAllEscalationPoliciesForRoles<P extends EscalationPolicyListItem>(
    roles: JoinableRole[],
    options?: {
        init?: RequestInit;
        fetchByRole?: (roleId: string) => Promise<unknown>;
        hydrate?: boolean;
    },
): Promise<{ ok: boolean; policies: P[] }> {
    const fetchByRole = options?.fetchByRole ?? defaultFetchByRole;
    const list = await fetchAllEscalationPoliciesPayload(options?.init);
    if (!list.ok) return { ok: false, policies: [] };

    let policies = list.data as P[];
    if (options?.hydrate !== false) {
        policies = await hydrateEscalationPolicySteps(policies, fetchByRole);
    }
    policies = await backfillMissingRolePolicies(roles, policies, fetchByRole);
    return { ok: true, policies };
}
