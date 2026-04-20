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
