import {
    clampEscalationDelaySeconds,
    delayToSeconds,
    MIN_ESCALATION_DELAY_SEC,
    secondsToDelay,
} from '@/lib/escalation-delays';
import { roleNamesConflictForEscalation } from '@/lib/role-escalation-ladder';

export type EscalationLadderLevel = {
    level: number;
    target: string;
    target_role_id?: string;
    delay: string;
    stepId?: string;
};

export type EscalationPolicyStep = {
    id?: string;
    step_order?: number;
    target_role_id: string;
    target_role_name?: string;
    timeout_seconds: number | null;
};

function stepDelayLabel(timeoutSeconds: number | null | undefined, isLastStep: boolean): string {
    if (isLastStep || timeoutSeconds == null) return '';
    return secondsToDelay(timeoutSeconds);
}

function buildRoleNameToIdLower(
    primaryRoleId: string,
    primaryRoleName: string,
    roleNameById?: Map<string, string>,
): Map<string, string> {
    const roleNameToIdLower = new Map<string, string>();
    if (primaryRoleName.trim() && primaryRoleId.trim()) {
        roleNameToIdLower.set(primaryRoleName.trim().toLowerCase(), primaryRoleId.trim());
    }
    if (roleNameById) {
        for (const [id, name] of roleNameById) {
            if (name?.trim()) roleNameToIdLower.set(name.trim().toLowerCase(), id);
        }
    }
    return roleNameToIdLower;
}

/** True when API steps already include the policy primary (step_order aligns with UI level). */
function stepsIncludePrimaryRole(
    steps: EscalationPolicyStep[],
    primaryRoleId: string,
    primaryRoleName: string,
    roleNameById?: Map<string, string>,
): boolean {
    const primaryId = primaryRoleId.trim();
    if (!primaryId || steps.length === 0) return false;
    const roleNameToIdLower = buildRoleNameToIdLower(primaryRoleId, primaryRoleName, roleNameById);
    return steps.some(s => {
        if (s.target_role_id === primaryId) return true;
        const name = s.target_role_name || roleNameById?.get(s.target_role_id) || '';
        return roleNamesConflictForEscalation(name, primaryRoleName, roleNameToIdLower);
    });
}

function stepsToLadderByStepOrder(
    steps: EscalationPolicyStep[],
    roleNameById?: Map<string, string>,
): EscalationLadderLevel[] {
    const sorted = [...steps].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0));
    return sorted.map((s, i) => ({
        level: s.step_order ?? i + 1,
        target: s.target_role_name || roleNameById?.get(s.target_role_id) || '',
        target_role_id: s.target_role_id,
        delay: stepDelayLabel(s.timeout_seconds, i === sorted.length - 1),
        stepId: s.id,
    }));
}

/** Full UI ladder: each step_order matches UI level (1 = primary, 2+ = escalation targets). */
export function policyToLadderLevels(
    primaryRoleId: string,
    primaryRoleName: string,
    initialTimeoutSeconds: number,
    steps: EscalationPolicyStep[],
    roleNameById?: Map<string, string>,
): EscalationLadderLevel[] {
    const primaryName = primaryRoleName.trim();
    const primaryId = primaryRoleId.trim();

    if (steps.length > 0 && stepsIncludePrimaryRole(steps, primaryId, primaryName, roleNameById)) {
        return stepsToLadderByStepOrder(steps, roleNameById);
    }

    if (!primaryId || !primaryName) {
        return stepsToLadderByStepOrder(steps, roleNameById);
    }

    const primary: EscalationLadderLevel = {
        level: 1,
        target: primaryName,
        target_role_id: primaryId,
        delay: secondsToDelay(initialTimeoutSeconds),
    };

    if (steps.length === 0) {
        return [primary];
    }

    // Legacy policies: primary on policy row only; steps are escalation targets (old step_order 1 → UI level 2).
    const sorted = [...steps].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0));
    const rest = sorted.map((s, i) => {
        const isLastStep = i === sorted.length - 1;
        return {
            level: (s.step_order ?? i + 1) + 1,
            target: s.target_role_name || roleNameById?.get(s.target_role_id) || '',
            target_role_id: s.target_role_id,
            delay: stepDelayLabel(s.timeout_seconds, isLastStep),
            stepId: s.id,
        };
    });

    return [primary, ...rest];
}

/** Stable React key for ladder rows (level numbers alone are not unique after load). */
export function ladderLevelReactKey(level: EscalationLadderLevel, index: number): string {
    return level.stepId || level.target_role_id || `ladder-${level.level}-${index}`;
}

/** Last filled row in the ladder (including level 1). */
export function lastFilledLadderRowIndex(
    sorted: EscalationLadderLevel[],
    hasTarget: (level: EscalationLadderLevel, index: number) => boolean,
): number {
    let last = -1;
    sorted.forEach((lvl, i) => {
        if (hasTarget(lvl, i)) last = i;
    });
    return last;
}

/** Only non-final targets get a delay — the last role in the chain never has a timer. */
export function ladderRowShowsDelay(
    sorted: EscalationLadderLevel[],
    index: number,
    hasTarget: (level: EscalationLadderLevel, index: number) => boolean,
): boolean {
    if (!hasTarget(sorted[index], index)) return false;
    const lastFilled = lastFilledLadderRowIndex(sorted, hasTarget);
    return index !== lastFilled;
}

function levelMatchesPrimary(
    level: EscalationLadderLevel,
    primaryRoleId: string,
    primaryRoleName: string,
    roleNameToIdLower: Map<string, string>,
): boolean {
    const primaryId = primaryRoleId.trim();
    const levelId = (level.target_role_id || roleNameToIdLower.get(level.target.trim().toLowerCase()) || '').trim();
    if (primaryId && levelId && primaryId === levelId) return true;
    return roleNamesConflictForEscalation(level.target, primaryRoleName, roleNameToIdLower);
}

export type EscalationPolicyStepPayload = {
    target_role_id: string;
    step_order: number;
    /** API requires a value; last step uses MIN_ESCALATION_DELAY_SEC — UI hides timer on final role. */
    timeout_seconds: number;
};

/**
 * Split UI ladder into policy fields + step rows.
 * UI level N is stored as step_order N (1 = primary role, 2+ = escalation targets).
 * Policy role_id + initial_timeout_seconds mirror level 1 for PUT/create.
 */
export function ladderLevelsToPolicyPayload(
    levels: EscalationLadderLevel[],
    primaryRoleId: string,
    primaryRoleName: string,
    resolveRoleId: (targetName: string) => string | undefined,
): {
    role_id: string;
    initial_timeout_seconds: number;
    steps: EscalationPolicyStepPayload[];
} {
    const roleNameToIdLower = buildRoleNameToIdLower(primaryRoleId, primaryRoleName);
    const registerId = (name: string, id: string) => {
        if (name.trim() && id.trim()) roleNameToIdLower.set(name.trim().toLowerCase(), id.trim());
    };
    registerId(primaryRoleName, primaryRoleId);

    const sorted = [...levels].filter(l => l.target?.trim()).sort((a, b) => a.level - b.level);

    const levelOne = sorted.find(l => l.level === 1);
    const primaryLevel = (levelOne && levelMatchesPrimary(levelOne, primaryRoleId, primaryRoleName, roleNameToIdLower))
        ? levelOne
        : sorted.find(l => levelMatchesPrimary(l, primaryRoleId, primaryRoleName, roleNameToIdLower))
            ?? sorted[0];

    const initial_timeout_seconds = clampEscalationDelaySeconds(
        delayToSeconds(primaryLevel?.delay || '30 sec'),
    );

    const steps = sorted
        .map((l, idx) => {
            const isLast = idx === sorted.length - 1;
            const target_role_id = l.level === 1
                ? primaryRoleId.trim()
                : (l.target_role_id || resolveRoleId(l.target) || '').trim();
            if (target_role_id && l.target.trim()) {
                registerId(l.target, target_role_id);
            }
            return {
                target_role_id,
                step_order: l.level,
                timeout_seconds: isLast
                    ? MIN_ESCALATION_DELAY_SEC
                    : clampEscalationDelaySeconds(delayToSeconds(l.delay)),
            };
        })
        .filter((s): s is EscalationPolicyStepPayload => Boolean(s.target_role_id));

    return {
        role_id: primaryRoleId.trim(),
        initial_timeout_seconds,
        steps,
    };
}