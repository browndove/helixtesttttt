export function isCriticalRole(role: { priority?: string; mandatory?: boolean }): boolean {
    return role.priority?.toString().trim().toLowerCase() === 'critical' || Boolean(role.mandatory);
}

/** Align priority/mandatory for UI after API or optimistic updates (honours either field). */
export function normalizeRoleCriticalFields<T extends { priority?: string; mandatory?: boolean }>(role: T): T {
    const isCritical = isCriticalRole(role);
    return {
        ...role,
        priority: isCritical ? 'Critical' : 'Standard',
        mandatory: isCritical,
    } as T;
}

type EscalationRoleRef = { id: string; name: string; priority?: string; mandatory?: boolean };

function resolveEscalationTargetRole(
    target: string,
    targetRoleId: string | undefined,
    roles: EscalationRoleRef[],
    roleNameToIdLower: Map<string, string>,
): EscalationRoleRef | undefined {
    if (targetRoleId) {
        const byId = roles.find(r => r.id === targetRoleId);
        if (byId) return byId;
    }
    const targetLower = target.toLowerCase();
    const byExactName = roles.find(r => r.name.trim().toLowerCase() === targetLower);
    if (byExactName) return byExactName;
    return roles.find(r => roleNamesConflictForEscalation(target, r.name, roleNameToIdLower));
}

/** Merge in-flight edits (e.g. edit modal) before validating ladder targets. */
export function applyEscalationRoleOverrides<T extends EscalationRoleRef>(
    roles: T[],
    overrides: Array<{ id: string; mandatory?: boolean; priority?: string; name?: string }>,
): T[] {
    const byId = new Map(overrides.map(o => [o.id, o]));
    return roles.map(r => {
        const patch = byId.get(r.id);
        if (!patch) return r;
        return normalizeRoleCriticalFields({
            ...r,
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.mandatory !== undefined ? { mandatory: patch.mandatory } : {}),
            ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        });
    });
}

/** First ladder target that is not a Critical role, if any. */
export function findNonCriticalEscalationTarget(
    levels: Array<{ target?: string; target_role_id?: string }>,
    roles: EscalationRoleRef[],
): string | undefined {
    const roleNameToIdLower = new Map<string, string>();
    for (const r of roles) {
        if (r.name?.trim()) roleNameToIdLower.set(r.name.trim().toLowerCase(), r.id);
    }
    for (const level of levels) {
        const target = level.target?.trim();
        if (!target) continue;
        const matched = resolveEscalationTargetRole(target, level.target_role_id, roles, roleNameToIdLower);
        if (!matched || !isCriticalRole(matched)) return target;
    }
    return undefined;
}

/** Resolve role id for a ladder target label (exact name, then prefix/suffix rules). */
export function resolveEscalationTargetRoleId(
    targetName: string,
    roles: EscalationRoleRef[],
    roleNameToIdLower?: Map<string, string>,
): string | undefined {
    const trimmed = targetName.trim();
    if (!trimmed) return undefined;
    const nameMap =
        roleNameToIdLower
        ?? new Map(roles.filter(r => r.name?.trim()).map(r => [r.name.trim().toLowerCase(), r.id]));
    const matched = resolveEscalationTargetRole(trimmed, undefined, roles, nameMap);
    return matched?.id;
}

/**
 * Escalation ladder: treat two role display names as the same slot when they are
 * identical, share the same role id, or match the "Prefix - Suffix" pattern (e.g.
 * primary "IT Test Officer" vs target "SMH - IT Test Officer").
 */

export function splitRoleNameForEscalation(name: string): { prefix: string; suffix: string } {
    const trimmed = String(name || '').trim();
    if (!trimmed) return { prefix: '', suffix: '' };
    const [first, ...rest] = trimmed.split(' - ');
    if (rest.length === 0) {
        return { prefix: '', suffix: trimmed };
    }
    return {
        prefix: first.trim(),
        suffix: rest.join(' - ').trim(),
    };
}

export function roleNamesConflictForEscalation(
    a: string,
    b: string,
    roleNameToIdLower: Map<string, string>,
): boolean {
    const ta = a.trim();
    const tb = b.trim();
    if (!ta || !tb) return false;
    if (ta.toLowerCase() === tb.toLowerCase()) return true;
    const ida = roleNameToIdLower.get(ta.toLowerCase());
    const idb = roleNameToIdLower.get(tb.toLowerCase());
    if (ida && idb && ida === idb) return true;
    const { prefix: pa, suffix: sa } = splitRoleNameForEscalation(ta);
    const { prefix: pb, suffix: sb } = splitRoleNameForEscalation(tb);
    const sal = sa.trim().toLowerCase();
    const sbl = sb.trim().toLowerCase();
    if (ta.toLowerCase() === sbl || tb.toLowerCase() === sal) return true;
    if (pa && pb && sal && sal === sbl) return true;
    return false;
}

/** True if candidate conflicts with any occupied name (same rules as {@link roleNamesConflictForEscalation}). */
export function escalationTargetsConflict(
    candidate: string,
    occupied: string[],
    roleNameToIdLower: Map<string, string>,
): boolean {
    const c = candidate.trim();
    if (!c) return false;
    return occupied.some(occ => occ.trim() && roleNamesConflictForEscalation(c, occ, roleNameToIdLower));
}

export function escalationLevelsHaveConflictingTargets(
    targets: string[],
    roleNameToIdLower: Map<string, string>,
): boolean {
    const list = targets.map(t => t.trim()).filter(Boolean);
    for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
            if (roleNamesConflictForEscalation(list[i], list[j], roleNameToIdLower)) return true;
        }
    }
    return false;
}

/** Labels involved in at least one pairwise conflict (for UI warnings). */
export function findEscalationConflictingTargetLabels(
    targets: string[],
    roleNameToIdLower: Map<string, string>,
): string[] {
    const list = targets.map(t => t.trim()).filter(Boolean);
    const bad = new Set<string>();
    for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
            if (roleNamesConflictForEscalation(list[i], list[j], roleNameToIdLower)) {
                bad.add(list[i]);
                bad.add(list[j]);
            }
        }
    }
    return [...bad];
}
