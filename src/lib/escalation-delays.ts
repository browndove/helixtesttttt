/** Minimum delay for escalation timers (API and UI); zero is not allowed. */
export const MIN_ESCALATION_DELAY_SEC = 30;

/** Preset delay labels (no zero-duration option). */
export const ESCALATION_DELAY_OPTIONS = [
    '30 sec',
    '45 sec',
    '1 min',
    '2 min',
    '3 min',
    '5 min',
    '7 min',
    '10 min',
    '12 min',
    '15 min',
    '20 min',
    '30 min',
    '1 hr',
    '2 hr',
] as const;

export function delayToSeconds(d: string): number {
    const raw = d.trim().toLowerCase();
    const match = raw.match(/(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)?/);
    if (!match) return 0;
    const value = Number(match[1]);
    const unit = match[2] || 'm';
    if (!Number.isFinite(value)) return 0;
    if (unit.startsWith('h')) return Math.round(value * 3600);
    if (unit === 's' || unit.startsWith('sec')) return Math.round(value);
    return Math.round(value * 60);
}

/** Display string for a stored timeout; never returns a zero-duration label. */
export function secondsToDelay(s: number): string {
    if (s <= 0) return '30 sec';
    if (s < 60) return `${s} sec`;
    if (s % 3600 === 0) return `${s / 3600} hr`;
    return `${Math.round(s / 60)} min`;
}

export function clampEscalationDelaySeconds(parsed: number): number {
    return Math.max(MIN_ESCALATION_DELAY_SEC, parsed);
}
