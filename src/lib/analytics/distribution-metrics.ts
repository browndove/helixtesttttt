/**
 * Five-number summary blocks on usage-metrics (min, Q1, median, Q3, max + avg).
 * All-zero distributions mean no events in the window — treat as no data.
 */

export type MinutesDistribution = {
    avg_minutes: number;
    min_minutes: number;
    q1_minutes: number;
    median_minutes: number;
    q3_minutes: number;
    max_minutes: number;
};

export type CallAnsweredDistribution = {
    answered_calls?: number;
    avg_duration_seconds?: number;
    avg_duration_minutes?: number;
    min_duration_seconds?: number;
    q1_duration_seconds?: number;
    median_duration_seconds?: number;
    q3_duration_seconds?: number;
    max_duration_seconds?: number;
};

function num(v: unknown): number {
    if (v === null || v === undefined || v === "") return 0;
    const n = typeof v === "string" ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return v != null && typeof v === "object" && !Array.isArray(v);
}

function pickDefinedNum(obj: Record<string, unknown>, ...keys: string[]): number | undefined {
    for (const key of keys) {
        if (!(key in obj)) continue;
        const v = obj[key];
        if (v === undefined || v === null || v === "") continue;
        return num(v);
    }
    return undefined;
}

/** True when at least one spread field is > 0 (or answered_calls > 0 for call duration). */
export function minutesDistributionHasData(d?: Partial<MinutesDistribution> | null): boolean {
    if (!d) return false;
    return (
        num(d.median_minutes) > 0 ||
        num(d.avg_minutes) > 0 ||
        num(d.q1_minutes) > 0 ||
        num(d.q3_minutes) > 0 ||
        num(d.min_minutes) > 0 ||
        num(d.max_minutes) > 0
    );
}

export function answeredDistributionHasData(d?: Partial<CallAnsweredDistribution> | null): boolean {
    if (!d) return false;
    if (num(d.answered_calls) > 0) return true;
    return (
        num(d.median_duration_seconds) > 0 ||
        num(d.avg_duration_seconds) > 0 ||
        num(d.q1_duration_seconds) > 0 ||
        num(d.q3_duration_seconds) > 0 ||
        num(d.min_duration_seconds) > 0 ||
        num(d.max_duration_seconds) > 0
    );
}

export function mapMinutesDistribution(raw: unknown): MinutesDistribution | undefined {
    if (!isRecord(raw)) return undefined;
    const avg = pickDefinedNum(raw, "avg_minutes", "avgMinutes");
    const min = pickDefinedNum(raw, "min_minutes", "minMinutes");
    const q1 = pickDefinedNum(raw, "q1_minutes", "q1Minutes");
    const median = pickDefinedNum(raw, "median_minutes", "medianMinutes");
    const q3 = pickDefinedNum(raw, "q3_minutes", "q3Minutes");
    const max = pickDefinedNum(raw, "max_minutes", "maxMinutes");
    if ([avg, min, q1, median, q3, max].every((v) => v === undefined)) return undefined;
    const dist: MinutesDistribution = {
        avg_minutes: avg ?? 0,
        min_minutes: min ?? 0,
        q1_minutes: q1 ?? 0,
        median_minutes: median ?? 0,
        q3_minutes: q3 ?? 0,
        max_minutes: max ?? 0,
    };
    return minutesDistributionHasData(dist) ? dist : undefined;
}

export function mapCallAnsweredDistribution(raw: unknown): CallAnsweredDistribution | undefined {
    if (!isRecord(raw)) return undefined;
    const answered_calls = pickDefinedNum(raw, "answered_calls", "answeredCalls");
    const avg_duration_seconds = pickDefinedNum(raw, "avg_duration_seconds", "avgDurationSeconds");
    const avg_duration_minutes = pickDefinedNum(raw, "avg_duration_minutes", "avgDurationMinutes");
    const min_duration_seconds = pickDefinedNum(raw, "min_duration_seconds", "minDurationSeconds");
    const q1_duration_seconds = pickDefinedNum(raw, "q1_duration_seconds", "q1DurationSeconds");
    const median_duration_seconds = pickDefinedNum(
        raw,
        "median_duration_seconds",
        "medianDurationSeconds"
    );
    const q3_duration_seconds = pickDefinedNum(raw, "q3_duration_seconds", "q3DurationSeconds");
    const max_duration_seconds = pickDefinedNum(raw, "max_duration_seconds", "maxDurationSeconds");

    if (
        answered_calls === undefined &&
        avg_duration_seconds === undefined &&
        median_duration_seconds === undefined
    ) {
        return undefined;
    }

    const dist: CallAnsweredDistribution = {
        answered_calls,
        avg_duration_seconds,
        avg_duration_minutes,
        min_duration_seconds,
        q1_duration_seconds,
        median_duration_seconds,
        q3_duration_seconds,
        max_duration_seconds,
    };
    return answeredDistributionHasData(dist) ? dist : undefined;
}

export function formatDurationSeconds(sec: number): string {
    if (!sec || sec <= 0) return "—";
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function formatMinutes(m: number): string {
    if (!m || m <= 0) return "—";
    if (m < 1) return `${Math.round(m * 60)}s`;
    if (m < 60) return `${m.toFixed(1)} min`;
    const h = Math.floor(m / 60);
    const min = Math.round(m % 60);
    return min > 0 ? `${h}h ${min}m` : `${h}h`;
}

/** Shorter label for tight KPI spread cells — drops minutes when hours are large. */
export function formatMinutesCompact(m: number): string {
    if (!m || m <= 0) return "—";
    if (m < 1) return `${Math.round(m * 60)}s`;
    if (m < 60) return `${m.toFixed(1)}m`;
    const h = Math.floor(m / 60);
    const min = Math.round(m % 60);
    if (h >= 24) return `${h}h`;
    return min > 0 ? `${h}h${min}m` : `${h}h`;
}

export function typicalSecondsRange(q1: number, q3: number): string {
    if (q1 <= 0 && q3 <= 0) return "—";
    return `${formatDurationSeconds(q1)} – ${formatDurationSeconds(q3)}`;
}

export function typicalMinutesRange(q1: number, q3: number): string {
    if (q1 <= 0 && q3 <= 0) return "—";
    return `${formatMinutes(q1)} – ${formatMinutes(q3)}`;
}

export function minutesSinceMidnightToClock(m: number, tz = "UTC"): string {
    if (!m || m <= 0) return "—";
    const h = Math.floor(m / 60) % 24;
    const min = Math.round(m % 60);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(min).padStart(2, "0")} ${ampm} ${tz}`;
}

export type UsageTimeDistributions = {
    readAll?: MinutesDistribution;
    readCritical?: MinutesDistribution;
    readStandard?: MinutesDistribution;
    replyAll?: MinutesDistribution;
    replyCritical?: MinutesDistribution;
    criticalAck?: MinutesDistribution;
    signIn?: MinutesDistribution;
    signOut?: MinutesDistribution;
};

function pickNestedMinutes(
    root: Record<string, unknown>,
    parentKey: string,
    childKey?: string
): MinutesDistribution | undefined {
    const parent = root[parentKey];
    if (!isRecord(parent)) return undefined;
    if (childKey) {
        return mapMinutesDistribution(parent[childKey]);
    }
    return mapMinutesDistribution(parent);
}

/** Unwrap a `data` / `usage` / `metrics` / `result` envelope, if present. */
export function unwrapUsageRoot(payload: unknown): Record<string, unknown> | undefined {
    if (!isRecord(payload)) return undefined;
    for (const key of ["data", "usage", "metrics", "result"]) {
        const inner = payload[key];
        if (isRecord(inner)) return inner;
    }
    return payload;
}

/** Unwrap `data` / `usage` envelopes then extract nested MinutesDistribution blocks. */
export function extractUsageTimeDistributions(payload: unknown): UsageTimeDistributions {
    const root = unwrapUsageRoot(payload);
    if (!root) return {};

    return {
        readAll: pickNestedMinutes(root, "read_minutes", "all"),
        readCritical: pickNestedMinutes(root, "read_minutes", "critical"),
        readStandard: pickNestedMinutes(root, "read_minutes", "standard"),
        replyAll: pickNestedMinutes(root, "reply_minutes", "all"),
        replyCritical: pickNestedMinutes(root, "reply_minutes", "critical"),
        criticalAck: pickNestedMinutes(root, "critical_ack_minutes"),
        signIn: pickNestedMinutes(root, "sign_in_minutes"),
        signOut: pickNestedMinutes(root, "sign_out_minutes"),
    };
}

export type ResponseMinuteKind =
    | "critical_ack"
    | "read_all"
    | "read_critical"
    | "read_standard"
    | "reply_all"
    | "reply_critical";

function blockMedian(value: unknown): number | null {
    if (!isRecord(value)) return null;
    const median = pickDefinedNum(value, "median_minutes", "medianMinutes", "p50_minutes", "p50", "median");
    return median === undefined ? null : median;
}

/**
 * Median minutes for a response-time bucket.
 * Reads the distribution block (and flat median_* aliases). Does not substitute avg_*.
 */
export function medianResponseMinutes(
    row: Record<string, unknown> | null | undefined,
    kind: ResponseMinuteKind
): number | null {
    if (!row) return null;
    const root = unwrapUsageRoot(row) ?? row;

    if (kind === "critical_ack") {
        return (
            blockMedian(root.critical_ack_minutes) ??
            (pickDefinedNum(root, "median_critical_ack_minutes", "critical_ack_median_minutes") ?? null)
        );
    }

    if (kind === "read_all" || kind === "read_critical" || kind === "read_standard") {
        const child = kind === "read_all" ? "all" : kind === "read_critical" ? "critical" : "standard";
        const parent = root.read_minutes;
        if (isRecord(parent)) {
            const nested = blockMedian(parent[child]);
            if (nested != null) return nested;
            if (child === "all") {
                const top = blockMedian(parent);
                if (top != null) return top;
            }
        }
        const flat =
            kind === "read_all"
                ? ["median_read_minutes_all", "median_first_read_minutes_all"]
                : kind === "read_critical"
                  ? ["median_read_minutes_critical", "median_first_read_minutes_critical"]
                  : [
                        "median_read_minutes_standard",
                        "median_first_read_minutes_non_critical",
                        "median_read_minutes_non_critical",
                    ];
        const value = pickDefinedNum(root, ...flat);
        return value === undefined ? null : value;
    }

    const child = kind === "reply_all" ? "all" : "critical";
    const parent = root.reply_minutes;
    if (isRecord(parent)) {
        const nested = blockMedian(parent[child]);
        if (nested != null) return nested;
        if (child === "all") {
            const top = blockMedian(parent);
            if (top != null) return top;
        }
    }
    const flat =
        kind === "reply_all"
            ? ["median_reply_minutes_all", "median_reply_response_minutes_all"]
            : ["median_reply_minutes_critical", "median_reply_response_minutes_critical"];
    const value = pickDefinedNum(root, ...flat);
    return value === undefined ? null : value;
}

/** Median when the payload has one, otherwise the legacy average. */
export function responseMinutes(
    row: Record<string, unknown> | null | undefined,
    kind: ResponseMinuteKind,
    averageKeys: string[]
): number | null {
    const median = medianResponseMinutes(row, kind);
    if (median != null) return median;
    if (!row) return null;
    const root = unwrapUsageRoot(row) ?? row;
    const average = pickDefinedNum(root, ...averageKeys);
    return average === undefined ? null : average;
}

/** Prefer median, then avg, from a MinutesDistribution. */
export function pickTypicalMinutes(dist?: MinutesDistribution | null): number | null {
    if (!dist || !minutesDistributionHasData(dist)) return null;
    const median = num(dist.median_minutes);
    if (median > 0) return median;
    const avg = num(dist.avg_minutes);
    return avg > 0 ? avg : null;
}

export function pickAvgMinutes(dist?: MinutesDistribution | null): number | null {
    if (!dist || !minutesDistributionHasData(dist)) return null;
    const avg = num(dist.avg_minutes);
    return avg > 0 ? avg : null;
}

/** Nested distribution first, then legacy flat scalar fields on root. */
export function resolveReadMinutes(
    root: Record<string, unknown> | undefined,
    bucket: "all" | "critical" | "standard"
): MinutesDistribution | undefined {
    if (!root) return undefined;
    const dists = extractUsageTimeDistributions(root);
    const fromNested =
        bucket === "all"
            ? dists.readAll
            : bucket === "critical"
              ? dists.readCritical
              : dists.readStandard;
    if (fromNested) return fromNested;

    const legacyKey =
        bucket === "all"
            ? ["avg_read_minutes_all", "avg_first_read_minutes_all"]
            : bucket === "critical"
              ? ["avg_read_minutes_critical", "avg_first_read_minutes_critical"]
              : ["avg_read_minutes_standard", "avg_first_read_minutes_non_critical", "avg_read_minutes_non_critical"];

    for (const key of legacyKey) {
        const v = pickDefinedNum(root, key);
        if (v !== undefined && v > 0) {
            return {
                avg_minutes: v,
                min_minutes: 0,
                q1_minutes: 0,
                median_minutes: v,
                q3_minutes: 0,
                max_minutes: 0,
            };
        }
    }
    return undefined;
}

export function resolveCriticalAckMinutes(
    root: Record<string, unknown> | undefined
): MinutesDistribution | undefined {
    if (!root) return undefined;
    const nested = extractUsageTimeDistributions(root).criticalAck;
    if (nested) return nested;
    const legacy = pickDefinedNum(root, "avg_critical_ack_minutes");
    if (legacy !== undefined && legacy > 0) {
        return {
            avg_minutes: legacy,
            min_minutes: 0,
            q1_minutes: 0,
            median_minutes: legacy,
            q3_minutes: 0,
            max_minutes: 0,
        };
    }
    return undefined;
}

const CRITICAL_COVERAGE_KEYS = {
    read: ["critical_messages_read_percent"],
    acknowledged: ["critical_messages_acknowledged_percent", "critical_messages_acked_percent"],
} as const;

/**
 * Share of critical messages read / acknowledged, as a 0–100 percentage.
 * Unlike the minutes resolvers, 0 is a valid reading (nothing covered), so only
 * a missing or non-numeric field yields null.
 */
export function resolveCriticalCoveragePercent(
    payload: unknown,
    kind: "read" | "acknowledged"
): number | null {
    const root = unwrapUsageRoot(payload);
    if (!root) return null;

    for (const key of CRITICAL_COVERAGE_KEYS[kind]) {
        if (!(key in root)) continue;
        const raw = root[key];
        if (raw === undefined || raw === null || raw === "") continue;
        const parsed = typeof raw === "string" ? parseFloat(raw) : Number(raw);
        if (!Number.isFinite(parsed)) continue;
        return Math.min(100, Math.max(0, parsed));
    }
    return null;
}

export function resolveRoleSignInMinutes(role?: Record<string, unknown> | null): number | null {
    if (!role) return null;
    const roleDist = mapMinutesDistribution(role.sign_in_minutes);
    const fromRole = pickTypicalMinutes(roleDist);
    if (fromRole != null) return fromRole;
    const legacy = pickDefinedNum(role, "avg_sign_in_minutes_since_midnight_utc");
    return legacy !== undefined && legacy > 0 ? legacy : null;
}

export function resolveRoleSignOutMinutes(role?: Record<string, unknown> | null): number | null {
    if (!role) return null;
    const roleDist = mapMinutesDistribution(role.sign_out_minutes);
    const fromRole = pickTypicalMinutes(roleDist);
    if (fromRole != null) return fromRole;
    const legacy = pickDefinedNum(role, "avg_sign_out_minutes_since_midnight_utc");
    return legacy !== undefined && legacy > 0 ? legacy : null;
}

export function roleHasSignInOutData(role?: Record<string, unknown> | null): boolean {
    return resolveRoleSignInMinutes(role) != null || resolveRoleSignOutMinutes(role) != null;
}

export function resolveSignInMinutes(
    root: Record<string, unknown> | undefined,
    role?: Record<string, unknown> | null
): number | null {
    if (role) return resolveRoleSignInMinutes(role);
    if (!root) return null;
    const globalDist = extractUsageTimeDistributions(root).signIn;
    const fromGlobal = pickTypicalMinutes(globalDist);
    if (fromGlobal != null) return fromGlobal;
    const legacy = pickDefinedNum(root, "avg_sign_in_minutes_since_midnight_utc");
    return legacy !== undefined && legacy > 0 ? legacy : null;
}

export function resolveSignOutMinutes(
    root: Record<string, unknown> | undefined,
    role?: Record<string, unknown> | null
): number | null {
    if (role) return resolveRoleSignOutMinutes(role);
    if (!root) return null;
    const globalDist = extractUsageTimeDistributions(root).signOut;
    const fromGlobal = pickTypicalMinutes(globalDist);
    if (fromGlobal != null) return fromGlobal;
    const legacy = pickDefinedNum(root, "avg_sign_out_minutes_since_midnight_utc");
    return legacy !== undefined && legacy > 0 ? legacy : null;
}

export function pickTypicalSeconds(answered?: CallAnsweredDistribution | null): number | null {
    if (!answered || !answeredDistributionHasData(answered)) return null;
    const median = num(answered.median_duration_seconds);
    if (median > 0) return median;
    const avg = num(answered.avg_duration_seconds);
    return avg > 0 ? avg : null;
}

export type SpreadStatItem = { label: string; value: string };

function spreadMinuteValue(m: number, compact = false): string {
    return m > 0 ? (compact ? formatMinutesCompact(m) : formatMinutes(m)) : "—";
}

/** Build min / Q1 / median / Q3 / max rows for KPI cards. */
export function buildMinutesSpreadForKpi(dist?: MinutesDistribution | null): {
    inline: SpreadStatItem[];
    overflow: SpreadStatItem[];
    infoDetail: string;
} {
    if (!dist || !minutesDistributionHasData(dist)) {
        return { inline: [], overflow: [], infoDetail: "" };
    }

    const stats: SpreadStatItem[] = [
        { label: "Min", value: spreadMinuteValue(dist.min_minutes) },
        { label: "Q1", value: spreadMinuteValue(dist.q1_minutes, true) },
        { label: "Median", value: spreadMinuteValue(dist.median_minutes, true) },
        { label: "Q3", value: spreadMinuteValue(dist.q3_minutes, true) },
        { label: "Max", value: spreadMinuteValue(dist.max_minutes) },
    ];

    const hasSpread =
        num(dist.q1_minutes) > 0 ||
        num(dist.q3_minutes) > 0 ||
        num(dist.min_minutes) > 0 ||
        num(dist.max_minutes) > 0;

    const detailLines = [...stats.map((s) => `${s.label}: ${s.value}`)];
    if (num(dist.avg_minutes) > 0) {
        detailLines.push(`Avg: ${formatMinutes(dist.avg_minutes)}`);
    }

    if (!hasSpread) {
        const medianOnly = stats.filter((s) => s.label === "Median");
        return {
            inline: medianOnly,
            overflow: [],
            infoDetail: detailLines.join("\n"),
        };
    }

    // Card: Q1 / median / Q3 only. Min & max live in the info popup to avoid crowding.
    return {
        inline: stats.filter((s) => s.label === "Q1" || s.label === "Median" || s.label === "Q3"),
        overflow: stats.filter((s) => s.label === "Min" || s.label === "Max"),
        infoDetail: detailLines.join("\n"),
    };
}

export function mergeInfoWithSpread(base: string, infoDetail: string): string {
    if (!infoDetail.trim()) return base;
    return `${base}\n\n${infoDetail}`;
}
