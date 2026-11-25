import {
    type CallInboundDepartmentMetric,
    type CallInboundRoleMetric,
    type CallMetricsSlice,
    type CallOutboundDepartmentMetric,
    type CallOutboundRoleMetric,
    num,
} from "@/components/analytics/ugmc-dashboard/clinical-operations/components/call-metrics-helpers";
import { mapCallAnsweredDistribution } from "@/lib/analytics/distribution-metrics";

function str(v: unknown): string {
    return typeof v === "string" ? v : "";
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return v != null && typeof v === "object" && !Array.isArray(v);
}

function unwrapUsagePayload(payload: unknown): Record<string, unknown> | undefined {
    if (!isRecord(payload)) return undefined;
    for (const key of ["data", "usage", "metrics", "result"]) {
        const inner = payload[key];
        if (isRecord(inner)) return inner;
    }
    return payload;
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

function rowHasNonZero(...values: (number | undefined)[]): boolean {
    return values.some((v) => v !== undefined && v > 0);
}

function mapOutboundRole(raw: unknown): CallOutboundRoleMetric | null {
    if (!isRecord(raw)) return null;
    const role_name = str(raw.role_name || raw.roleName).trim();
    if (!role_name) return null;
    const total_calls_made = pickDefinedNum(raw, "total_calls_made", "totalCallsMade");
    const answered_calls = pickDefinedNum(raw, "answered_calls", "answeredCalls");
    const unanswered_calls = pickDefinedNum(raw, "unanswered_calls", "unansweredCalls");
    if (!rowHasNonZero(total_calls_made, answered_calls, unanswered_calls)) return null;
    return {
        role_id: str(raw.role_id || raw.roleId) || undefined,
        role_name,
        facility_id: str(raw.facility_id || raw.facilityId) || undefined,
        facility_name: str(raw.facility_name || raw.facilityName) || undefined,
        total_calls_made,
        answered_calls,
        unanswered_calls,
    };
}

function mapOutboundDepartment(raw: unknown): CallOutboundDepartmentMetric | null {
    if (!isRecord(raw)) return null;
    const department_name = str(raw.department_name || raw.departmentName).trim();
    if (!department_name) return null;
    const total_calls_made = pickDefinedNum(raw, "total_calls_made", "totalCallsMade");
    const answered_calls = pickDefinedNum(raw, "answered_calls", "answeredCalls");
    const unanswered_calls = pickDefinedNum(raw, "unanswered_calls", "unansweredCalls");
    if (!rowHasNonZero(total_calls_made, answered_calls, unanswered_calls)) return null;
    return {
        department_id: str(raw.department_id || raw.departmentId) || undefined,
        department_name,
        facility_id: str(raw.facility_id || raw.facilityId) || undefined,
        facility_name: str(raw.facility_name || raw.facilityName) || undefined,
        total_calls_made,
        answered_calls,
        unanswered_calls,
    };
}

function mapInboundRole(raw: unknown): CallInboundRoleMetric | null {
    if (!isRecord(raw)) return null;
    const role_name = str(raw.role_name || raw.roleName).trim();
    if (!role_name) return null;
    const answered_calls = pickDefinedNum(raw, "answered_calls", "answeredCalls");
    const missed_calls = pickDefinedNum(raw, "missed_calls", "missedCalls");
    if (!rowHasNonZero(answered_calls, missed_calls)) return null;
    return {
        role_id: str(raw.role_id || raw.roleId) || undefined,
        role_name,
        facility_id: str(raw.facility_id || raw.facilityId) || undefined,
        facility_name: str(raw.facility_name || raw.facilityName) || undefined,
        answered_calls,
        missed_calls,
    };
}

function mapInboundDepartment(raw: unknown): CallInboundDepartmentMetric | null {
    if (!isRecord(raw)) return null;
    const department_name = str(raw.department_name || raw.departmentName).trim();
    if (!department_name) return null;
    const answered_calls = pickDefinedNum(raw, "answered_calls", "answeredCalls");
    const missed_calls = pickDefinedNum(raw, "missed_calls", "missedCalls");
    if (!rowHasNonZero(answered_calls, missed_calls)) return null;
    return {
        department_id: str(raw.department_id || raw.departmentId) || undefined,
        department_name,
        facility_id: str(raw.facility_id || raw.facilityId) || undefined,
        facility_name: str(raw.facility_name || raw.facilityName) || undefined,
        answered_calls,
        missed_calls,
    };
}

function mapRowArray<T>(value: unknown, map: (row: unknown) => T | null): T[] {
    if (!Array.isArray(value)) return [];
    return value.map(map).filter((r): r is T => r !== null);
}

/**
 * Extract call metrics from GET usage-metrics / analytics payload.
 * Prefer call_metrics.answered and by_outbound_* / by_inbound_* arrays.
 */
export function normalizeCallMetricsFromUsage(payload: unknown): CallMetricsSlice | undefined {
    const root = unwrapUsagePayload(payload);
    if (!root) return undefined;

    const nested = isRecord(root.call_metrics)
        ? root.call_metrics
        : isRecord(root.callMetrics)
          ? root.callMetrics
          : undefined;

    const src: Record<string, unknown> = nested ? { ...root, ...nested } : root;

    const total_calls_made = pickDefinedNum(src, "total_calls_made", "totalCallsMade");
    const total_answered_calls = pickDefinedNum(
        src,
        "total_answered_calls",
        "totalAnsweredCalls"
    );
    const total_unanswered_calls = pickDefinedNum(
        src,
        "total_unanswered_calls",
        "totalUnansweredCalls"
    );
    const total_missed_calls = pickDefinedNum(
        src,
        "total_missed_calls",
        "totalMissedCalls",
        "missed_calls"
    );
    const answer_rate_percent = pickDefinedNum(src, "answer_rate_percent", "answerRatePercent");

    const answered =
        mapCallAnsweredDistribution(nested?.answered) ??
        mapCallAnsweredDistribution(src.answered);

    const by_outbound_role = mapRowArray(src.by_outbound_role, mapOutboundRole);
    const by_outbound_department = mapRowArray(src.by_outbound_department, mapOutboundDepartment);
    const by_inbound_role = mapRowArray(src.by_inbound_role, mapInboundRole);
    const by_inbound_department = mapRowArray(src.by_inbound_department, mapInboundDepartment);

    const hasCallMetrics =
        total_calls_made !== undefined ||
        total_answered_calls !== undefined ||
        total_unanswered_calls !== undefined ||
        total_missed_calls !== undefined ||
        answer_rate_percent !== undefined ||
        answered != null ||
        by_outbound_role.length > 0 ||
        by_outbound_department.length > 0 ||
        by_inbound_role.length > 0 ||
        by_inbound_department.length > 0 ||
        nested != null;

    if (!hasCallMetrics) return undefined;

    return {
        total_calls_made,
        total_answered_calls,
        total_unanswered_calls,
        answer_rate_percent,
        total_missed_calls,
        answered,
        by_outbound_role: by_outbound_role.length ? by_outbound_role : undefined,
        by_outbound_department: by_outbound_department.length ? by_outbound_department : undefined,
        by_inbound_role: by_inbound_role.length ? by_inbound_role : undefined,
        by_inbound_department: by_inbound_department.length ? by_inbound_department : undefined,
    };
}
