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
    const rest = sorted.map((s, i) => ({
        level: i + 2,
        target: s.target_role_name || roleNameById?.get(s.target_role_id) || '',
        target_role_id: s.target_role_id,
        delay: secondsToDelay(s.timeout_seconds),
        stepId: s.id,
    }));

    return [primary, ...rest];
}

function stepsOnlyToLadderLevels(
    steps: EscalationPolicyStep[],
    roleNameById?: Map<string, string>,
): EscalationLadderLevel[] {
    return [...steps]
        .sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0))
        .map((s, i) => ({
            level: i + 1,
            target: s.target_role_name || roleNameById?.get(s.target_role_id) || '',
            target_role_id: s.target_role_id,
            delay: secondsToDelay(s.timeout_seconds),
            stepId: s.id,
        }));
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

/**
 * Split UI ladder into policy initial timeout (level 1 / primary) and bulk step payloads.
 * Level 1 is the policy's primary role — not stored as an escalation step.
 */
export function ladderLevelsToPolicyPayload(
    levels: EscalationLadderLevel[],
    primaryRoleId: string,
    primaryRoleName: string,
    resolveRoleId: (targetName: string) => string | undefined,
): {
    initial_timeout_seconds: number;
    steps: Array<{ target_role_id: string; timeout_seconds: number }>;
} {
    const roleNameToIdLower = new Map<string, string>();
    const registerId = (name: string, id: string) => {
        if (name.trim() && id.trim()) roleNameToIdLower.set(name.trim().toLowerCase(), id.trim());
    };
    registerId(primaryRoleName, primaryRoleId);

    const sorted = [...levels].filter(l => l.target?.trim()).sort((a, b) => a.level - b.level);

    const primaryLevel = sorted.find(l => levelMatchesPrimary(l, primaryRoleId, primaryRoleName, roleNameToIdLower))
        ?? sorted[0];
    const initial_timeout_seconds = clampEscalationDelaySeconds(
        delayToSeconds(primaryLevel?.delay || '30 sec'),
    );

    const escalations = sorted.filter(
        l => !levelMatchesPrimary(l, primaryRoleId, primaryRoleName, roleNameToIdLower),
    );

    const steps = escalations
        .map((l, idx, arr) => {
            const target_role_id = (l.target_role_id || resolveRoleId(l.target) || '').trim();
            if (target_role_id && l.target.trim()) {
                registerId(l.target, target_role_id);
            }
            return {
                target_role_id,
                timeout_seconds: arr.length > 1 && idx === arr.length - 1
                    ? MIN_ESCALATION_DELAY_SEC
                    : clampEscalationDelaySeconds(delayToSeconds(l.delay)),
            };
        })
        .filter(s => s.target_role_id);

    return { initial_timeout_seconds, steps };
}
