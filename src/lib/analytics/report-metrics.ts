/**
 * Report metric definitions for CSV export.
 * `id` values are stable keys used in the report UI and CSV builder.
 */

import {
    fillDailyMessageVolumePeriod,
    fillDailyMessageVolumeRange,
} from "@/lib/analytics/daily-volume";
import { medianResponseMinutes, type ResponseMinuteKind } from "@/lib/analytics/distribution-metrics";

export type ReportMetricKind =
    | "scalar"
    | "table_daily"
    | "table_department"
    | "table_roles_escalated"
    | "table_roles_escalated_least"
    | "table_roles_metrics"
    | "table_call_by_role"
    | "table_call_by_department"
    | "table_transfer_by_counterparty"
    | "table_transfer_by_role";

export type ReportMetricDef = {
    id: string;
    label: string;
    group: string;
    kind: ReportMetricKind;
    /** For scalars: key on the analytics payload */
    field?: string;
};

export type ReportScalarRow = { label: string; value: string; group: string };

export const GROUP_ORDER: string[] = [
    "Staff & activity",
    "Messaging",
    "Escalation",
    "Roles",
    "Response times",
    "Scheduling",
    "Window",
    "Charts",
    "Calls",
    "Transfers",
];

export const REPORT_METRICS: ReportMetricDef[] = [
    { id: "scalar_active_users_count", group: "Staff & activity", label: "Active users (count)", kind: "scalar", field: "active_users_count" },
    { id: "scalar_active_users_rate_percent", group: "Staff & activity", label: "Active users (% of registered)", kind: "scalar", field: "active_users_rate_percent" },
    { id: "scalar_registered_staff_count", group: "Staff & activity", label: "Registered staff (count)", kind: "scalar", field: "registered_staff_count" },

    { id: "scalar_total_messages", group: "Messaging", label: "Total messages", kind: "scalar", field: "total_messages" },
    { id: "scalar_critical_messages", group: "Messaging", label: "Critical messages", kind: "scalar", field: "critical_messages" },
    { id: "scalar_critical_messages_rate_percent", group: "Messaging", label: "Critical messages (% of total)", kind: "scalar", field: "critical_messages_rate_percent" },
    { id: "scalar_standard_messages", group: "Messaging", label: "Standard messages", kind: "scalar", field: "standard_messages" },

    { id: "scalar_escalation_rate_percent", group: "Escalation", label: "Escalation rate (% of critical)", kind: "scalar", field: "escalation_rate_percent" },
    { id: "scalar_escalated_critical_messages", group: "Escalation", label: "Escalated critical messages (count)", kind: "scalar", field: "escalated_critical_messages" },
    { id: "scalar_escalation_rate_of_total_messages_percent", group: "Escalation", label: "Escalation as % of all messages", kind: "scalar", field: "escalation_rate_of_total_messages_percent" },

    { id: "scalar_role_fill_rate_percent", group: "Roles", label: "Role fill rate (%)", kind: "scalar", field: "role_fill_rate_percent" },
    { id: "scalar_filled_roles", group: "Roles", label: "Filled roles (count)", kind: "scalar", field: "filled_roles" },
    { id: "scalar_total_roles", group: "Roles", label: "Total roles (count)", kind: "scalar", field: "total_roles" },
    { id: "scalar_critical_role_fill_rate_percent", group: "Roles", label: "Critical role fill rate (%)", kind: "scalar", field: "critical_role_fill_rate_percent" },
    { id: "scalar_critical_filled_roles", group: "Roles", label: "Critical roles filled (count)", kind: "scalar", field: "critical_filled_roles" },
    { id: "scalar_critical_total_roles", group: "Roles", label: "Critical roles total (count)", kind: "scalar", field: "critical_total_roles" },

    { id: "scalar_avg_critical_ack_minutes", group: "Response times", label: "Median critical acknowledgment (minutes)", kind: "scalar", field: "critical_ack_minutes.median_minutes" },
    { id: "scalar_avg_first_read_minutes_all", group: "Response times", label: "Median read — all messages (minutes)", kind: "scalar", field: "read_minutes.all.median_minutes" },
    { id: "scalar_avg_first_read_minutes_critical", group: "Response times", label: "Median read — critical (minutes)", kind: "scalar", field: "read_minutes.critical.median_minutes" },
    { id: "scalar_avg_first_read_minutes_non_critical", group: "Response times", label: "Median read — non-critical (minutes)", kind: "scalar", field: "read_minutes.standard.median_minutes" },
    { id: "scalar_avg_read_minutes_standard", group: "Response times", label: "Median read — standard messages (minutes)", kind: "scalar", field: "read_minutes.standard.median_minutes" },
    { id: "scalar_critical_messages_read_percent", group: "Response times", label: "Critical messages read (%)", kind: "scalar", field: "critical_messages_read_percent" },
    { id: "scalar_critical_messages_acknowledged_percent", group: "Response times", label: "Critical messages acknowledged (%)", kind: "scalar", field: "critical_messages_acknowledged_percent" },
    { id: "scalar_total_calls_made", group: "Response times", label: "Total calls made", kind: "scalar", field: "total_calls_made" },

    { id: "scalar_avg_sign_in_minutes_since_midnight_utc", group: "Scheduling", label: "Avg sign-in (minutes since midnight UTC)", kind: "scalar", field: "avg_sign_in_minutes_since_midnight_utc" },
    { id: "scalar_avg_sign_out_minutes_since_midnight_utc", group: "Scheduling", label: "Avg sign-out (minutes since midnight UTC)", kind: "scalar", field: "avg_sign_out_minutes_since_midnight_utc" },

    { id: "scalar_window_days", group: "Window", label: "Report window (days returned by API)", kind: "scalar", field: "window_days" },

    { id: "table_daily_message_volume", group: "Charts", label: "Daily message volume (trend chart)", kind: "table_daily" },
    { id: "table_department_metrics", group: "Charts", label: "Department escalation & fill rates", kind: "table_department" },
    { id: "table_top_escalated_roles", group: "Charts", label: "Top escalated roles", kind: "table_roles_escalated" },
    { id: "table_least_escalated_roles", group: "Charts", label: "Least escalated roles", kind: "table_roles_escalated_least" },
    { id: "table_role_metrics", group: "Charts", label: "Role message volume (top roles)", kind: "table_roles_metrics" },

    // Call metrics (scalars)
    { id: "scalar_call_total_calls_made", group: "Calls", label: "Total calls placed", kind: "scalar", field: "call_metrics.total_calls_made" },
    { id: "scalar_call_answered_calls", group: "Calls", label: "Answered calls", kind: "scalar", field: "call_metrics.total_answered_calls" },
    { id: "scalar_call_unanswered_calls", group: "Calls", label: "Unanswered calls", kind: "scalar", field: "call_metrics.total_unanswered_calls" },
    { id: "scalar_call_answer_rate_percent", group: "Calls", label: "Answer rate (%)", kind: "scalar", field: "call_metrics.answer_rate_percent" },
    { id: "scalar_call_missed_calls", group: "Calls", label: "Missed calls (inbound)", kind: "scalar", field: "call_metrics.total_missed_calls" },
    { id: "scalar_call_avg_duration_seconds", group: "Calls", label: "Avg call duration (seconds)", kind: "scalar", field: "call_metrics.answered.avg_duration_seconds" },
    { id: "scalar_call_avg_duration_minutes", group: "Calls", label: "Avg call duration (minutes)", kind: "scalar", field: "call_metrics.answered.avg_duration_minutes" },
    { id: "scalar_call_min_duration_seconds", group: "Calls", label: "Min call duration (seconds)", kind: "scalar", field: "call_metrics.answered.min_duration_seconds" },
    { id: "scalar_call_median_duration_seconds", group: "Calls", label: "Median call duration (seconds)", kind: "scalar", field: "call_metrics.answered.median_duration_seconds" },
    { id: "scalar_call_q1_duration_seconds", group: "Calls", label: "Q1 call duration (seconds)", kind: "scalar", field: "call_metrics.answered.q1_duration_seconds" },
    { id: "scalar_call_q3_duration_seconds", group: "Calls", label: "Q3 call duration (seconds)", kind: "scalar", field: "call_metrics.answered.q3_duration_seconds" },
    { id: "scalar_call_max_duration_seconds", group: "Calls", label: "Max call duration (seconds)", kind: "scalar", field: "call_metrics.answered.max_duration_seconds" },

    // Call charts
    { id: "table_call_by_role", group: "Calls", label: "Outbound calls by role (chart)", kind: "table_call_by_role" },
    { id: "table_call_by_department", group: "Calls", label: "Outbound calls by department (chart)", kind: "table_call_by_department" },

    // Transfer metrics (scalars)
    { id: "scalar_transfer_total", group: "Transfers", label: "Total transfer requests", kind: "scalar", field: "transfer_metrics.total_transfer_requests" },
    { id: "scalar_transfer_sent", group: "Transfers", label: "Transfer requests sent", kind: "scalar", field: "transfer_metrics.transfer_requests_sent" },
    { id: "scalar_transfer_outbound", group: "Transfers", label: "Transfer requests outbound", kind: "scalar", field: "transfer_metrics.transfer_requests_outbound" },
    { id: "scalar_transfer_inbound", group: "Transfers", label: "Transfer requests inbound", kind: "scalar", field: "transfer_metrics.transfer_requests_inbound" },
    { id: "scalar_transfer_accepted", group: "Transfers", label: "Transfer requests accepted", kind: "scalar", field: "transfer_metrics.transfer_requests_accepted" },
    { id: "scalar_transfer_declined", group: "Transfers", label: "Transfer requests declined", kind: "scalar", field: "transfer_metrics.transfer_requests_declined" },
    { id: "scalar_transfer_pending", group: "Transfers", label: "Transfer requests pending", kind: "scalar", field: "transfer_metrics.transfer_requests_pending" },

    // Transfer charts
    { id: "table_transfer_by_counterparty", group: "Transfers", label: "Transfers by counterparty (chart)", kind: "table_transfer_by_counterparty" },
    { id: "table_transfer_by_role", group: "Transfers", label: "Transfers by role (chart)", kind: "table_transfer_by_role" },
];

export function defaultMetricSelection(): Record<string, boolean> {
    const m: Record<string, boolean> = {};
    for (const def of REPORT_METRICS) m[def.id] = true;
    return m;
}

function csvCell(v: unknown): string {
    if (v === null || v === undefined) return "";
    const s = typeof v === "number" && !Number.isFinite(v) ? "" : String(v);
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

type AnalyticsRow = Record<string, unknown>;

/** Format report values: numbers to at most one decimal place; leave others as-is. */
export function formatReportValue(v: unknown): string {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") {
        if (!Number.isFinite(v)) return "";
        if (Number.isInteger(v)) return String(v);
        return (Math.round(v * 10) / 10).toFixed(1);
    }
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (typeof v === "string") {
        const trimmed = v.trim();
        if (trimmed === "") return "";
        // Numeric strings from API (e.g. "12.345") → one decimal
        if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
            const n = Number(trimmed);
            if (!Number.isFinite(n)) return trimmed;
            if (Number.isInteger(n)) return String(n);
            return (Math.round(n * 10) / 10).toFixed(1);
        }
        return v;
    }
    return String(v);
}

/** Hand-written labels for keys whose mechanical humanization reads badly. */
const HEADER_LABEL_OVERRIDES: Record<string, string> = {
    day: "Date",
    department_name: "Department",
    role_name: "Role",
    facility_name: "Facility",
    counterparty_facility_name: "Counterparty facility",
    role_fill_rate_percent: "Role fill %",
    critical_role_fill_rate_percent: "Critical role fill %",
    critical_messages_rate_percent: "Critical %",
    escalation_rate_percent: "Escalation %",
    escalation_rate_of_total_messages_percent: "Escalation % of all msgs",
    escalation_rate_vs_dept_critical_messages_percent: "Escalation % of dept critical",
    avg_critical_ack_minutes: "Median critical ack (min)",
    median_critical_ack_minutes: "Median critical ack (min)",
    avg_reply_response_minutes_all: "Median reply (min)",
    median_reply_minutes_all: "Median reply (min)",
    avg_reply_response_minutes_critical: "Median reply critical (min)",
    median_reply_minutes_critical: "Median reply critical (min)",
    avg_sign_in_minutes_since_midnight_utc: "Avg sign-in (UTC min)",
    avg_sign_out_minutes_since_midnight_utc: "Avg sign-out (UTC min)",
    total_messages: "Total msgs",
    critical_messages: "Critical msgs",
    standard_messages: "Standard msgs",
    critical_messages_sent: "Critical msgs sent",
    escalation_count: "Escalations",
    escalated_critical_messages: "Escalated critical",
};

/** Snake_case / camelCase keys → readable labels for PDF tables. */
export function humanizeReportHeader(key: string): string {
    const override = HEADER_LABEL_OVERRIDES[key];
    if (override) return override;
    return key
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\bpercent\b/gi, "%")
        .replace(/\bpct\b/gi, "%")
        .replace(/\bvs\b/gi, "vs")
        .replace(/^\w/, (c) => c.toUpperCase())
        .replace(/\bid\b/gi, "ID")
        .replace(/\butc\b/gi, "UTC");
}

function getScalar(data: AnalyticsRow, field: string): unknown {
    if (field.includes(".")) {
        const parts = field.split(".");
        let cur: unknown = data;
        for (const p of parts) {
            if (cur == null || typeof cur !== "object") return undefined;
            cur = (cur as Record<string, unknown>)[p];
        }
        return cur;
    }
    return data[field];
}

function cell(v: unknown): string {
    return formatReportValue(v);
}

/**
 * True when a row carries no name, no id and no non-zero value. Backends emit these
 * placeholder rows for unassigned buckets; in a report they read as real records.
 */
function isBlankRow(cells: string[]): boolean {
    return cells.every((c) => c === "" || /^-?0(\.0+)?%?$/.test(c));
}

/** Look up role_metrics by role id, falling back to a normalized role name. */
function roleMetricIndex(data: AnalyticsRow): Map<string, Record<string, unknown>> {
    const index = new Map<string, Record<string, unknown>>();
    const roles = data.role_metrics;
    if (!Array.isArray(roles)) return index;
    for (const role of roles) {
        if (!role || typeof role !== "object") continue;
        const r = role as Record<string, unknown>;
        const id = r.role_id != null ? String(r.role_id).trim() : "";
        if (id) index.set(id, r);
        const name = typeof r.role_name === "string" ? r.role_name.trim().toLowerCase() : "";
        if (name && !index.has(`name:${name}`)) index.set(`name:${name}`, r);
    }
    return index;
}

/** Escalation list entries widened with their role_metrics counterpart. */
function escalationRows(
    list: unknown,
    head: readonly string[],
    roles: Map<string, Record<string, unknown>>
): string[][] {
    if (!Array.isArray(list)) return [];
    const merged: Record<string, unknown>[] = [];
    for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const entry = item as Record<string, unknown>;
        const id = entry.role_id != null ? String(entry.role_id).trim() : "";
        const name = typeof entry.role_name === "string" ? entry.role_name.trim().toLowerCase() : "";
        const match = (id && roles.get(id)) || (name && roles.get(`name:${name}`)) || undefined;
        merged.push(withMedianResponse(match ? { ...match, ...entry } : entry));
    }
    return tableRows(merged, head);
}

/** Map an API list to report cells, dropping placeholder rows. */
function tableRows(list: unknown, head: readonly string[]): string[][] {
    if (!Array.isArray(list)) return [];
    const body: string[][] = [];
    for (const row of list) {
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        const cells = head.map((h) => cell(r[h]));
        if (isBlankRow(cells)) continue;
        body.push(cells);
    }
    return body;
}

const DEPARTMENT_METRIC_HEADERS = [
    "department_name",
    "department_id",
    "role_fill_rate_percent",
    "escalation_rate_vs_dept_critical_messages_percent",
    "filled_roles",
    "total_roles",
    "critical_messages_sent",
    "median_critical_ack_minutes",
    "median_reply_minutes_all",
    "median_reply_minutes_critical",
    "escalation_notifications",
    "critical_filled_roles",
    "critical_total_roles",
    "critical_role_fill_rate_percent",
] as const;

const DAILY_VOLUME_HEADERS = ["day", "total_messages", "critical_messages", "standard_messages"] as const;

const CALL_BY_ROLE_HEADERS = [
    "role_name",
    "facility_name",
    "facility_id",
    "total_calls_made",
    "answered_calls",
    "unanswered_calls",
] as const;

const CALL_BY_DEPT_HEADERS = [
    "department_name",
    "department_id",
    "facility_name",
    "facility_id",
    "total_calls_made",
    "answered_calls",
    "unanswered_calls",
] as const;

const TRANSFER_COUNTERPARTY_HEADERS = [
    "counterparty_facility_name",
    "counterparty_facility_id",
    "total_transfer_requests",
    "outbound_transfer_requests",
    "inbound_transfer_requests",
    "accepted_transfer_requests",
    "declined_transfer_requests",
    "pending_transfer_requests",
] as const;

const TRANSFER_ROLE_HEADERS = [
    "role_name",
    "facility_name",
    "facility_id",
    "total_transfer_requests",
    "outbound_transfer_requests",
    "inbound_transfer_requests",
    "accepted_transfer_requests",
    "declined_transfer_requests",
    "pending_transfer_requests",
] as const;

/**
 * Escalation lists arrive as name/id/count only. The id is useless in a report, so the
 * remaining columns are joined in from role_metrics to give the count context.
 */
const ESCALATION_ROLE_HEADERS = [
    "role_name",
    "department_name",
    "escalation_count",
    "critical_messages",
    "escalation_rate_percent",
    "median_critical_ack_minutes",
] as const;

export type ReportTableSection = {
    title: string;
    head: string[];
    body: string[][];
    /**
     * Preferred column subset/order for the PDF. The CSV always keeps the full `head`,
     * so wide payload tables stay complete for analysis while the PDF stays readable.
     */
    pdfColumns?: string[];
};

/** Columns worth printing for per-role tables, in reading order. */
const ROLE_METRIC_PDF_COLUMNS = [
    "role_name",
    "department_name",
    "priority",
    "filled",
    "total_messages",
    "critical_messages",
    "escalation_rate_percent",
    "median_critical_ack_minutes",
] as const;

const RESPONSE_SCALAR_KIND: Record<string, ResponseMinuteKind> = {
    scalar_avg_critical_ack_minutes: "critical_ack",
    scalar_avg_first_read_minutes_all: "read_all",
    scalar_avg_first_read_minutes_critical: "read_critical",
    scalar_avg_first_read_minutes_non_critical: "read_standard",
    scalar_avg_read_minutes_standard: "read_standard",
};

/** Copy median response times onto stable column keys. Leaves averages out of the export. */
function withMedianResponse(row: Record<string, unknown>): Record<string, unknown> {
    const next: Record<string, unknown> = { ...row };
    const write = (kind: ResponseMinuteKind, key: string) => {
        const median = medianResponseMinutes(row, kind);
        if (median != null) next[key] = median;
    };
    write("critical_ack", "median_critical_ack_minutes");
    write("reply_all", "median_reply_minutes_all");
    write("reply_critical", "median_reply_minutes_critical");
    delete next.avg_critical_ack_minutes;
    delete next.avg_reply_response_minutes_all;
    delete next.avg_reply_response_minutes_critical;
    delete next.avg_first_read_minutes_all;
    delete next.avg_first_read_minutes_critical;
    delete next.avg_first_read_minutes_non_critical;
    delete next.avg_read_minutes_all;
    delete next.avg_read_minutes_critical;
    delete next.avg_read_minutes_standard;
    return next;
}

/** Normalized rows for CSV / PDF (same selection rules). */
export function collectReportData(data: AnalyticsRow, selected: Record<string, boolean>) {
    const scalarRows: ReportScalarRow[] = [];
    for (const def of REPORT_METRICS) {
        if (!selected[def.id] || def.kind !== "scalar" || !def.field) continue;
        const responseKind = RESPONSE_SCALAR_KIND[def.id];
        const v = responseKind ? medianResponseMinutes(data, responseKind) : getScalar(data, def.field);
        scalarRows.push({ label: def.label, value: cell(v), group: def.group });
    }

    let daily: ReportTableSection | null = null;
    if (selected.table_daily_message_volume) {
        const head = [...DAILY_VOLUME_HEADERS];
        const raw = Array.isArray(data.daily_message_volume) ? data.daily_message_volume : [];
        const from =
            typeof data.daily_message_volume_from === "string" ? data.daily_message_volume_from : null;
        const to =
            typeof data.daily_message_volume_to === "string" ? data.daily_message_volume_to : null;
        const windowDays = Number(data.daily_message_volume_window_days ?? data.window_days);
        const filled =
            from && to
                ? fillDailyMessageVolumeRange(raw, from, to)
                : fillDailyMessageVolumePeriod(
                      raw,
                      Number.isFinite(windowDays) && windowDays > 0 ? windowDays : 7
                  );
        daily = {
            title: "Daily message volume",
            head,
            body: tableRows(filled, head),
        };
    }

    let departments: ReportTableSection | null = null;
    if (selected.table_department_metrics) {
        const head = [...DEPARTMENT_METRIC_HEADERS];
        departments = {
            title: "Department metrics",
            head,
            body: tableRows(
                Array.isArray(data.department_metrics)
                    ? data.department_metrics.map((row) =>
                          withMedianResponse(row as Record<string, unknown>)
                      )
                    : data.department_metrics,
                head
            ),
        };
    }

    const roleIndex = roleMetricIndex(data);

    let topEscalated: ReportTableSection | null = null;
    if (selected.table_top_escalated_roles) {
        const head = [...ESCALATION_ROLE_HEADERS];
        topEscalated = {
            title: "Top escalated roles",
            head,
            body: escalationRows(data.top_escalated_roles, head, roleIndex),
        };
    }

    let leastEscalated: ReportTableSection | null = null;
    if (selected.table_least_escalated_roles) {
        const head = [...ESCALATION_ROLE_HEADERS];
        leastEscalated = {
            title: "Least escalated roles",
            head,
            body: escalationRows(data.least_escalated_roles, head, roleIndex),
        };
    }

    let roleMetrics: ReportTableSection | null = null;
    if (selected.table_role_metrics) {
        const roles = Array.isArray(data.role_metrics)
            ? data.role_metrics.map((row) => withMedianResponse(row as Record<string, unknown>))
            : data.role_metrics;
        const first = Array.isArray(roles) ? roles[0] : undefined;
        const head =
            first && typeof first === "object"
                ? Object.keys(first as object).filter((k) => k !== "role_id")
                : [];
        roleMetrics = {
            title: "Role metrics",
            head,
            body: head.length ? tableRows(roles, head) : [],
            pdfColumns: ROLE_METRIC_PDF_COLUMNS.filter((c) => head.includes(c)),
        };
    }

    const cm = data.call_metrics as Record<string, unknown> | undefined;

    let callByRole: ReportTableSection | null = null;
    if (selected.table_call_by_role) {
        const head = [...CALL_BY_ROLE_HEADERS];
        callByRole = {
            title: "Outbound calls by role",
            head,
            body: tableRows(cm?.by_outbound_role ?? cm?.by_initiator_role, head),
        };
    }

    let callByDept: ReportTableSection | null = null;
    if (selected.table_call_by_department) {
        const head = [...CALL_BY_DEPT_HEADERS];
        callByDept = {
            title: "Outbound calls by department",
            head,
            body: tableRows(cm?.by_outbound_department ?? cm?.by_initiator_department, head),
        };
    }

    const tm = data.transfer_metrics as Record<string, unknown> | undefined;

    let transferByCounterparty: ReportTableSection | null = null;
    if (selected.table_transfer_by_counterparty) {
        const head = [...TRANSFER_COUNTERPARTY_HEADERS];
        transferByCounterparty = {
            title: "Transfers by counterparty facility",
            head,
            body: tableRows(tm?.transfer_by_counterparty_facility, head),
        };
    }

    let transferByRole: ReportTableSection | null = null;
    if (selected.table_transfer_by_role) {
        const head = [...TRANSFER_ROLE_HEADERS];
        transferByRole = {
            title: "Transfers by role",
            head,
            body: tableRows(tm?.transfer_by_role, head),
        };
    }

    return {
        scalarRows,
        daily,
        departments,
        topEscalated,
        leastEscalated,
        roleMetrics,
        callByRole,
        callByDept,
        transferByCounterparty,
        transferByRole,
    };
}

/** Build UTF-8 CSV text for selected metrics. */
export function buildAnalyticsReportCsv(
    data: AnalyticsRow,
    selected: Record<string, boolean>,
    meta: { dateFrom: string; dateTo: string; generatedAtIso: string }
): string {
    const collected = collectReportData(data, selected);
    const lines: string[] = [];
    lines.push(csvCell("Helix Analytics report"));
    lines.push(`${csvCell("Generated")},${csvCell(meta.generatedAtIso)}`);
    lines.push(`${csvCell("Date range (inclusive)")},${csvCell(`${meta.dateFrom} to ${meta.dateTo}`)}`);
    lines.push("");
    lines.push(`${csvCell("Metric")},${csvCell("Value")}`);
    for (const { label, value } of collected.scalarRows) {
        lines.push(`${csvCell(label)},${csvCell(value)}`);
    }

    const appendTableCsv = (section: ReportTableSection | null) => {
        if (!section) return;
        lines.push("");
        lines.push(csvCell(section.title));
        if (section.body.length === 0) {
            lines.push(csvCell("(no rows)"));
            return;
        }
        lines.push(section.head.map(csvCell).join(","));
        for (const row of section.body) {
            lines.push(row.map(csvCell).join(","));
        }
    };

    appendTableCsv(collected.daily);
    appendTableCsv(collected.departments);
    appendTableCsv(collected.topEscalated);
    appendTableCsv(collected.leastEscalated);
    appendTableCsv(collected.roleMetrics);
    appendTableCsv(collected.callByRole);
    appendTableCsv(collected.callByDept);
    appendTableCsv(collected.transferByCounterparty);
    appendTableCsv(collected.transferByRole);

    return lines.join("\n");
}
