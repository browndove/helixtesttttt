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
    timeout_seconds: number;
};

/** Full UI ladder: primary receiver (level 1) + API escalation steps. */
export function policyToLadderLevels(
    primaryRoleId: string,
    primaryRoleName: string,
    initialTimeoutSeconds: number,
    steps: EscalationPolicyStep[],
    roleNameById?: Map<string, string>,
): EscalationLadderLevel[] {
    const primaryName = primaryRoleName.trim();
    if (!primaryRoleId.trim() || !primaryName) {
        return stepsOnlyToLadderLevels(steps, roleNameById);
    }

    const primary: EscalationLadderLevel = {
        level: 1,
        target: primaryName,
        target_role_id: primaryRoleId,
        delay: secondsToDelay(initialTimeoutSeconds),
    };

    const sorted = [...steps].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0));
    const rest = sorted.map((s, i) => {
        const isLastStep = i === sorted.length - 1;
        return {
            level: i + 2,
            target: s.target_role_name || roleNameById?.get(s.target_role_id) || '',
            target_role_id: s.target_role_id,
            delay: isLastStep ? '' : secondsToDelay(s.timeout_seconds),
            stepId: s.id,
        };
    });

    return [primary, ...rest];
}

function stepsOnlyToLadderLevels(
    steps: EscalationPolicyStep[],
    roleNameById?: Map<string, string>,
): EscalationLadderLevel[] {
    const ordered = [...steps].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0));
    return ordered.map((s, i) => ({
        level: i + 2,
        target: s.target_role_name || roleNameById?.get(s.target_role_id) || '',
        target_role_id: s.target_role_id,
        delay: i === ordered.length - 1 ? '' : secondsToDelay(s.timeout_seconds),
        stepId: s.id,
    }));
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
    const filledCount = sorted.filter((lvl, i) => hasTarget(lvl, i)).length;
    return filledCount <= 1 || index !== lastFilled;
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
    timeout_seconds: number;
    step_order: number;
};

/**
 * Split UI ladder into policy fields (level 1 primary + time) and step rows (levels 2–3).
 * Level 1: stored on the policy as role_id + initial_timeout_seconds (not a step row).
 * Levels 2–3: stored as escalation steps with timeout_seconds and step_order 1 / 2 (API index).
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
    const roleNameToIdLower = new Map<string, string>();
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

    const escalations = sorted.filter(l => l.level >= 2);

    const steps = escalations
        .map((l, idx) => {
            const target_role_id = (l.target_role_id || resolveRoleId(l.target) || '').trim();
            if (target_role_id && l.target.trim()) {
                registerId(l.target, target_role_id);
            }
            const isLastEscalation = idx === escalations.length - 1;
            return {
                target_role_id,
                timeout_seconds: isLastEscalation
                    ? MIN_ESCALATION_DELAY_SEC
                    : clampEscalationDelaySeconds(delayToSeconds(l.delay)),
                step_order: idx + 1,
            };
        })
        .filter((s): s is EscalationPolicyStepPayload => Boolean(s.target_role_id));

    return {
        role_id: primaryRoleId.trim(),
        initial_timeout_seconds,
        steps,
    };
}
