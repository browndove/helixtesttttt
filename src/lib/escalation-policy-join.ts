/**
 * Joining escalation policies to roles for the Roles page.
 *
 * The facility-scoped `GET /escalation-policies` list is unreliable: it may omit
 * a role's policy entirely, return it under a `role_id` that does not match the
 * role's id, or return it with a stale/empty `steps` array. Individual policy
 * reads (`GET /escalation-policies/by-role/{roleId}`) are also sometimes wrapped
 * in a `data`/`policy`/`item`/`result`/`payload` envelope.
 *
 * These helpers make the join resilient by
 *   1. matching a role to a policy by `role_id` and then by role name,
 *   2. unwrapping wrapped single-policy payloads, and
 *   3. backfilling any role that is still missing a policy via a `by-role` read.
 */

export type JoinablePolicy = {
    id?: string;
    role_id?: string;
    role_name?: string;
    roleName?: string;
    initial_timeout_seconds?: number;
    steps?: unknown;
};

export type JoinableRole = {
    id?: string;
    name?: string;
    role_name?: string;
};

/** Keys a single policy object may be nested under when the backend wraps it. */
const OBJECT_WRAPPER_KEYS = ['data', 'policy', 'item', 'result', 'payload'] as const;
/** Keys a policy list may be nested under (we take the first usable entry). */
const LIST_WRAPPER_KEYS = ['data', 'items', 'policies', 'results'] as const;

function looksLikePolicyObject(cur: Record<string, unknown>): boolean {
    const id = cur.id ?? cur.role_id ?? cur.policy_id;
    return (
        (typeof id === 'string' && id.trim().length > 0) ||
        Array.isArray(cur.steps) ||
        cur.initial_timeout_seconds !== undefined
    );
}

/**
 * Normalize any policy payload (possibly wrapped in an object envelope or a list)
 * into the underlying single policy record, or `null` when none is present.
 */
export function unwrapEscalationPolicyPayload(input: unknown): Record<string, unknown> | null {
    if (Array.isArray(input)) {
        for (const el of input) {
            const unwrapped = unwrapEscalationPolicyPayload(el);
            if (unwrapped) return unwrapped;
        }
        return null;
    }
    if (!input || typeof input !== 'object') return null;

    let cur = input as Record<string, unknown>;
    for (let depth = 0; depth < 6; depth++) {
        if (looksLikePolicyObject(cur)) return cur;

        let next: Record<string, unknown> | undefined;
        for (const key of OBJECT_WRAPPER_KEYS) {
            const candidate = cur[key];
            if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
                next = candidate as Record<string, unknown>;
                break;
            }
        }
        if (!next) {
            for (const key of LIST_WRAPPER_KEYS) {
                const candidate = cur[key];
                if (Array.isArray(candidate)) {
                    const fromList = unwrapEscalationPolicyPayload(candidate);
                    if (fromList) return fromList;
                }
            }
            break;
        }
        cur = next;
    }

    return Object.keys(cur).length > 0 ? cur : null;
}

export function normalizeRoleMatchName(name: unknown): string {
    return String(name ?? '').trim().toLowerCase();
}

export function policyStepsArray(policy: JoinablePolicy | undefined | null): unknown[] {
    return policy && Array.isArray(policy.steps) ? policy.steps : [];
}

export type PolicyLookup<P extends JoinablePolicy> = {
    byId: Map<string, P>;
    byName: Map<string, P>;
};

/** Index policies for lookup by `role_id` and by (lowercased) role name. */
export function buildPolicyLookup<P extends JoinablePolicy>(policies: P[]): PolicyLookup<P> {
    const byId = new Map<string, P>();
    const byName = new Map<string, P>();
    for (const policy of policies) {
        const id = String(policy.role_id ?? '').trim();
        if (id && !byId.has(id)) byId.set(id, policy);
        const name = normalizeRoleMatchName(policy.role_name ?? policy.roleName);
        if (name && !byName.has(name)) byName.set(name, policy);
    }
    return { byId, byName };
}

/**
 * Resolve the policy for a role: exact `role_id` first, then a name-based
 * fallback. The name fallback rescues policies whose `role_id` in the
 * facility-scoped list does not line up with the role's id.
 */
export function matchPolicyForRole<P extends JoinablePolicy>(
    role: JoinableRole,
    lookup: PolicyLookup<P>,
): P | undefined {
    const roleId = String(role.id ?? '').trim();
    if (roleId) {
        const byId = lookup.byId.get(roleId);
        if (byId) return byId;
    }
    const roleName = normalizeRoleMatchName(role.name ?? role.role_name);
    if (roleName) {
        const byName = lookup.byName.get(roleName);
        if (byName) return byName;
    }
    return undefined;
}

/** Role ids that have no matching policy (by id or name) in the current list. */
export function rolesNeedingPolicyBackfill<P extends JoinablePolicy>(
    roles: JoinableRole[],
    policies: P[],
): string[] {
    const lookup = buildPolicyLookup(policies);
    const seen = new Set<string>();
    const missing: string[] = [];
    for (const role of roles) {
        const roleId = String(role.id ?? '').trim();
        if (!roleId || seen.has(roleId)) continue;
        seen.add(roleId);
        if (!matchPolicyForRole(role, lookup)) missing.push(roleId);
    }
    return missing;
}

/**
 * Fetch `by-role` policies for every role missing from `policies` and merge them
 * in. `fetchByRole` returns the raw (possibly wrapped) payload for a role id, or
 * `null`/throws when there is nothing to backfill. Backfilled policies are
 * stamped with the role's id and name so the id-based join always resolves them.
 */
export async function backfillMissingRolePolicies<P extends JoinablePolicy>(
    roles: JoinableRole[],
    policies: P[],
    fetchByRole: (roleId: string) => Promise<unknown>,
): Promise<P[]> {
    const missingIds = rolesNeedingPolicyBackfill(roles, policies);
    if (missingIds.length === 0) return policies;

    const roleById = new Map<string, JoinableRole>();
    for (const role of roles) {
        const id = String(role.id ?? '').trim();
        if (id && !roleById.has(id)) roleById.set(id, role);
    }

    const backfilled = await Promise.all(
        missingIds.map(async (roleId): Promise<P | null> => {
            let raw: unknown;
            try {
                raw = await fetchByRole(roleId);
            } catch {
                return null;
            }
            const policy = unwrapEscalationPolicyPayload(raw);
            if (!policy) return null;
            const role = roleById.get(roleId);
            return {
                ...(policy as P),
                role_id: roleId,
                role_name:
                    (typeof policy.role_name === 'string' && policy.role_name.trim())
                        ? (policy.role_name as string)
                        : (role?.name ?? role?.role_name ?? undefined),
                steps: Array.isArray(policy.steps) ? policy.steps : [],
            } as P;
        }),
    );

    const merged = [...policies];
    const existingIds = new Set(policies.map(p => String(p.role_id ?? '').trim()).filter(Boolean));
    for (const policy of backfilled) {
        if (!policy) continue;
        const id = String(policy.role_id ?? '').trim();
        if (id && existingIds.has(id)) continue;
        if (id) existingIds.add(id);
        merged.push(policy);
    }
    return merged;
}
