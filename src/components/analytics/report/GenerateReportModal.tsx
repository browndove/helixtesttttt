"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import CalendarRangePicker from "@/components/analytics/CalendarRangePicker";
import { REPORT_METRICS, defaultMetricSelection, type ReportMetricDef } from "@/lib/analytics/report-metrics";
import { appendUsageMetricsRange } from "@/lib/analytics/usage-metrics-range";
import { resolveClientFacilityId, resolveClientFacilityName } from "@/lib/analytics/client-facility";
import { extractFacilityNameFromPayload } from "@/lib/analytics/facility-payload";
import { API_ENDPOINTS } from "@/lib/analytics/config";
import type { ApiFacility } from "@/lib/analytics/facility-directory";

const METRIC_TOTAL = REPORT_METRICS.length;

const GROUP_ORDER = [
    "Staff & activity",
    "Messaging",
    "Escalation",
    "Roles",
    "Response times",
    "Calls",
    "Transfers",
    "Scheduling",
    "Window",
    "Charts",
];

type Preset = "today" | "7d" | "30d" | "quarter" | "ytd" | "custom";
type TemplateId = "all" | "executive" | "clinical" | "surgical" | "custom";

const TEMPLATE_GROUPS: Record<Exclude<TemplateId, "custom">, string[] | null> = {
    all: null,
    executive: ["Staff & activity", "Messaging", "Escalation", "Roles", "Response times", "Window"],
    clinical: ["Messaging", "Escalation", "Response times", "Calls", "Charts"],
    surgical: ["Roles", "Transfers"],
};

const GROUP_TONE: Record<string, string> = {
    "Staff & activity": "bg-sky-500 text-white",
    Messaging: "bg-sky-100 text-sky-700",
    Escalation: "bg-amber-100 text-amber-700",
    Roles: "bg-indigo-100 text-indigo-700",
    "Response times": "bg-teal-100 text-teal-700",
    Calls: "bg-emerald-100 text-emerald-700",
    Transfers: "bg-purple-100 text-purple-700",
    Scheduling: "bg-teal-100 text-teal-700",
    Window: "bg-rose-100 text-rose-700",
    Charts: "bg-sky-100 text-sky-700",
};

const PREVIEW_LABELS: Record<string, string> = {
    scalar_active_users_rate_percent: "Active users",
    scalar_critical_messages: "Critical msgs",
    scalar_avg_critical_ack_minutes: "Response time",
    scalar_role_fill_rate_percent: "Role fill",
};

function GroupMark({ name }: { name: string }) {
    const path =
        name === "Messaging"
            ? "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            : name === "Escalation"
              ? "M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              : name === "Roles"
                ? "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                : name === "Calls"
                  ? "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  : name === "Transfers"
                    ? "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    : name === "Charts"
                      ? "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      : name === "Scheduling" || name === "Window"
                        ? "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        : "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z";
    return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d={path} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
    );
}

function selectionForTemplate(id: Exclude<TemplateId, "custom">): Record<string, boolean> {
    const groups = TEMPLATE_GROUPS[id];
    const next: Record<string, boolean> = {};
    for (const metric of REPORT_METRICS) {
        next[metric.id] = !groups || groups.includes(metric.group);
    }
    return next;
}

function readPath(source: unknown, path: string): unknown {
    let cursor: unknown = source;
    for (const part of path.split(".")) {
        if (!cursor || typeof cursor !== "object") return undefined;
        cursor = (cursor as Record<string, unknown>)[part];
    }
    return cursor;
}

function formatLiveValue(metric: ReportMetricDef, payload: Record<string, unknown> | null): string | null {
    if (!payload || !metric.field) return null;
    const raw = readPath(payload, metric.field);
    if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
    if (metric.field.includes("percent") || metric.field.endsWith("_rate")) return `${raw.toFixed(1)}%`;
    if (metric.field.includes("minutes")) return raw >= 10 ? `${raw.toFixed(0)}m` : `${raw.toFixed(1)}m`;
    return Math.round(raw).toLocaleString();
}

type GenerateReportModalProps = {
    open: boolean;
    onClose: () => void;
    defaultDateFrom: string;
    defaultDateTo: string;
    facilityId?: string | null;
    /** Selected facilities from the internal multi-select (empty = all). */
    facilityIds?: string[];
    facilityName?: string | null;
    globalScope?: boolean;
    /** Internal analytics can switch facility scope. Facility sessions cannot. */
    internal?: boolean;
    /** Analytics payload already shown on the dashboard for the current filter. */
    sourceData?: Record<string, unknown> | null;
};

function localYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function parseYmd(s: string): Date | null {
    if (!s) return null;
    const d = new Date(`${s}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
}

function formatPretty(s: string): string {
    const d = parseYmd(s);
    if (!d) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isValidRange(from: string, to: string): boolean {
    const fromDate = parseYmd(from);
    const toDate = parseYmd(to);
    if (!fromDate || !toDate) return false;
    return fromDate.getTime() <= toDate.getTime();
}

function rangeForPreset(preset: Exclude<Preset, "custom">): { from: string; to: string } {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    if (preset === "today") {
        /* same day */
    } else if (preset === "7d") {
        start.setDate(end.getDate() - 6);
    } else if (preset === "30d") {
        start.setDate(end.getDate() - 29);
    } else if (preset === "quarter") {
        const q = Math.floor(end.getMonth() / 3) * 3;
        start.setMonth(q, 1);
    } else {
        start.setMonth(0, 1);
    }
    return { from: localYmd(start), to: localYmd(end) };
}

function detectPreset(from: string, to: string): Preset {
    const keys: Exclude<Preset, "custom">[] = ["today", "7d", "30d", "quarter", "ytd"];
    for (const key of keys) {
        const range = rangeForPreset(key);
        if (range.from === from && range.to === to) return key;
    }
    return "custom";
}

function sortGroups(entries: [string, ReportMetricDef[]][]): [string, ReportMetricDef[]][] {
    const rank = (name: string) => {
        const i = GROUP_ORDER.indexOf(name);
        return i === -1 ? GROUP_ORDER.length + 1 : i;
    };
    return [...entries].sort((a, b) => rank(a[0]) - rank(b[0]));
}

function isNetworkLabel(name: string | null | undefined): boolean {
    return !!name && /^all facilities\b/i.test(name.trim());
}

function initials(name: string): string {
    const parts = name.replace(/[()]/g, " ").split(/\s+/).filter(Boolean);
    const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
    return letters || "H";
}

export default function GenerateReportModal({
    open,
    onClose,
    defaultDateFrom,
    defaultDateTo,
    facilityId = null,
    facilityIds = [],
    facilityName: facilityNameProp,
    globalScope = false,
    internal = false,
    sourceData = null,
}: GenerateReportModalProps) {
    const [dateFrom, setDateFrom] = useState(defaultDateFrom);
    const [dateTo, setDateTo] = useState(defaultDateTo);
    const [selected, setSelected] = useState<Record<string, boolean>>(() => defaultMetricSelection());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [resolvedFacilityName, setResolvedFacilityName] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>("Staff & activity");
    const [editingDates, setEditingDates] = useState(false);
    const [template, setTemplate] = useState<TemplateId>("all");
    const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
    const [scopeFacilities, setScopeFacilities] = useState<ApiFacility[]>([]);
    const [sessionFacilityId, setSessionFacilityId] = useState<string | null>(null);
    const [sessionChecked, setSessionChecked] = useState(false);

    const selectedFacilityIds = useMemo(() => {
        const fromList = facilityIds.map((id) => id.trim()).filter(Boolean);
        if (fromList.length > 0) return Array.from(new Set(fromList));
        const single = facilityId?.trim() || "";
        return single ? [single] : [];
    }, [facilityId, facilityIds]);

    useEffect(() => {
        if (!open) return;
        if (defaultDateFrom && defaultDateTo) {
            setDateFrom(defaultDateFrom);
            setDateTo(defaultDateTo);
        } else {
            const range = rangeForPreset("30d");
            setDateFrom(range.from);
            setDateTo(range.to);
        }
        setSelected(defaultMetricSelection());
        setError("");
        setExpanded("Staff & activity");
        setEditingDates(false);
        setTemplate("all");
        setPreview(null);
        setScopeFacilities([]);
        setSessionFacilityId(null);
        setSessionChecked(false);

        const passedName = facilityNameProp?.trim() || "";
        if (passedName && !isNetworkLabel(passedName)) {
            setResolvedFacilityName(passedName);
        } else {
            setResolvedFacilityName(null);
        }

        let cancelled = false;
        const namePromise =
            passedName && !isNetworkLabel(passedName)
                ? Promise.resolve(passedName)
                : resolveClientFacilityName().catch(() => undefined);
        Promise.all([resolveClientFacilityId().catch(() => undefined), namePromise])
            .then(([id, name]) => {
                if (cancelled) return;
                if (id) setSessionFacilityId(id);
                if (name && (!passedName || isNetworkLabel(passedName))) setResolvedFacilityName(name);
            })
            .finally(() => {
                if (!cancelled) setSessionChecked(true);
            });
        return () => {
            cancelled = true;
        };
    }, [open, defaultDateFrom, defaultDateTo, facilityNameProp]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !busy) onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, busy, onClose]);

    useEffect(() => {
        // Directory avatars only apply to the true all-facilities export.
        if (!open || !globalScope || selectedFacilityIds.length > 0) return;
        let cancelled = false;
        fetch(API_ENDPOINTS.INTERNAL_FACILITIES, { credentials: "include" })
            .then((res) => (res.ok ? res.json() : []))
            .then((json) => {
                if (!cancelled && Array.isArray(json)) setScopeFacilities(json as ApiFacility[]);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [open, globalScope, selectedFacilityIds.length]);

    const groups = useMemo(() => {
        const g = new Map<string, ReportMetricDef[]>();
        for (const m of REPORT_METRICS) {
            if (!g.has(m.group)) g.set(m.group, []);
            g.get(m.group)!.push(m);
        }
        return sortGroups(Array.from(g.entries()));
    }, []);

    const anySelected = useMemo(() => REPORT_METRICS.some((m) => selected[m.id]), [selected]);
    const selectedCount = useMemo(() => REPORT_METRICS.filter((m) => selected[m.id]).length, [selected]);
    const selectedCategories = useMemo(
        () => groups.filter(([, metrics]) => metrics.some((m) => selected[m.id])).length,
        [groups, selected],
    );
    const preset = detectPreset(dateFrom, dateTo);
    const fiscalYear = parseYmd(dateTo)?.getFullYear() ?? new Date().getFullYear();
    const templateOptions: { id: Exclude<TemplateId, "custom">; label: string }[] = [
        { id: "all", label: `All ${METRIC_TOTAL} Metrics` },
        { id: "executive", label: `Executive Summary (${REPORT_METRICS.filter((m) => TEMPLATE_GROUPS.executive?.includes(m.group)).length})` },
        { id: "clinical", label: `Clinical & Safety (${REPORT_METRICS.filter((m) => TEMPLATE_GROUPS.clinical?.includes(m.group)).length})` },
        { id: "surgical", label: `Roles and Transfer (${REPORT_METRICS.filter((m) => TEMPLATE_GROUPS.surgical?.includes(m.group)).length})` },
    ];
    const selectedFacilityId = selectedFacilityIds.length === 1 ? selectedFacilityIds[0] : "";
    const reportFacilityId = globalScope
        ? selectedFacilityId || null
        : selectedFacilityId || sessionFacilityId;
    const multiFacilityExport = selectedFacilityIds.length > 1;
    const networkExport = globalScope && selectedFacilityIds.length === 0;
    const datesMatchDashboard = dateFrom === defaultDateFrom && dateTo === defaultDateTo;
    const dashboardRecord =
        datesMatchDashboard && sourceData && typeof sourceData === "object" ? sourceData : null;
    const scopeLabel = networkExport
        ? "All facilities"
        : multiFacilityExport
          ? (!isNetworkLabel(facilityNameProp) && facilityNameProp?.trim()) ||
            `${selectedFacilityIds.length} facilities`
          : (!isNetworkLabel(facilityNameProp) && facilityNameProp?.trim()) ||
            resolvedFacilityName ||
            "This facility";
    const pageEstimate = Math.max(1, Math.ceil(selectedCount / 6));
    const facilitiesInScope =
        (networkExport || multiFacilityExport) && typeof preview?.facilities_in_scope === "number"
            ? preview.facilities_in_scope
            : multiFacilityExport
              ? selectedFacilityIds.length
              : null;
    const namedFacilities = networkExport
        ? scopeFacilities.filter((row) => String(row.name || row.facility_name || "").trim())
        : [];
    const siteCount = facilitiesInScope ?? (namedFacilities.length || null);
    const scopeTitle = networkExport
        ? `All facilities${siteCount ? ` (${siteCount} sites)` : ""}`
        : multiFacilityExport
          ? `${scopeLabel}${siteCount && !/\(\d+\s*sites?\)/i.test(scopeLabel) ? ` (${siteCount} sites)` : ""}`
          : scopeLabel;
    const avatarMarks = namedFacilities.slice(0, 2).map((row) => {
        const code = String(row.code || row.facility_code || "").trim();
        return (code || initials(String(row.name || row.facility_name || "H"))).slice(0, 2).toUpperCase();
    });
    const avatarExtra = Math.max(0, (siteCount ?? namedFacilities.length) - avatarMarks.length);
    const regionSummary = (() => {
        const counts = new Map<string, number>();
        for (const row of namedFacilities) {
            const label = String(row.region || row.city || "").trim();
            if (!label) continue;
            counts.set(label, (counts.get(label) ?? 0) + 1);
        }
        return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    })();
    const regionDots = ["bg-emerald-500", "bg-sky-500", "bg-violet-500"];
    const previewTiles = [
        "scalar_active_users_rate_percent",
        "scalar_critical_messages",
        "scalar_avg_critical_ack_minutes",
        "scalar_role_fill_rate_percent",
    ].map((id) => REPORT_METRICS.find((metric) => metric.id === id)).filter((metric): metric is ReportMetricDef => !!metric);

    const toggle = useCallback((id: string) => {
        setTemplate("custom");
        setSelected((s) => ({ ...s, [id]: !s[id] }));
    }, []);

    const selectAll = useCallback(() => {
        setTemplate("all");
        setSelected(defaultMetricSelection());
    }, []);

    const clearAll = useCallback(() => {
        setTemplate("custom");
        const cleared: Record<string, boolean> = {};
        for (const m of REPORT_METRICS) cleared[m.id] = false;
        setSelected(cleared);
    }, []);

    const applyTemplate = useCallback((id: Exclude<TemplateId, "custom">) => {
        setTemplate(id);
        setSelected(selectionForTemplate(id));
        setExpanded(id === "all" ? "Staff & activity" : (TEMPLATE_GROUPS[id]?.[0] ?? "Staff & activity"));
    }, []);

    const toggleGroup = useCallback((groupMetrics: ReportMetricDef[]) => {
        setTemplate("custom");
        const allGroupSelected = groupMetrics.every((m) => selected[m.id]);
        setSelected((prev) => {
            const next = { ...prev };
            for (const m of groupMetrics) next[m.id] = !allGroupSelected;
            return next;
        });
    }, [selected]);

    const applyPreset = (next: Exclude<Preset, "custom">) => {
        const range = rangeForPreset(next);
        setDateFrom(range.from);
        setDateTo(range.to);
        setEditingDates(false);
    };

    const analyticsUrl = useCallback(() => {
        const qs = new URLSearchParams();
        appendUsageMetricsRange(qs, dateFrom, dateTo);
        if (multiFacilityExport) {
            for (const id of selectedFacilityIds) qs.append("facility_ids", id);
            return `${API_ENDPOINTS.USAGE_METRICS}?${qs.toString()}`;
        }
        if (reportFacilityId && !networkExport) {
            qs.set("facility_id", reportFacilityId);
            return `/api/proxy/analytics?${qs.toString()}`;
        }
        if (networkExport) return `${API_ENDPOINTS.USAGE_METRICS}?${qs.toString()}`;
        return `/api/proxy/analytics?${qs.toString()}`;
    }, [dateFrom, dateTo, reportFacilityId, networkExport, multiFacilityExport, selectedFacilityIds]);

    useEffect(() => {
        if (!open || !isValidRange(dateFrom, dateTo)) return;
        if (dashboardRecord) {
            setPreview(dashboardRecord);
            return;
        }
        let cancelled = false;
        fetch(analyticsUrl(), { credentials: "include", cache: "no-store" })
            .then((res) => (res.ok ? res.json() : null))
            .then((json) => {
                if (!cancelled && json && typeof json === "object") setPreview(json as Record<string, unknown>);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [open, dateFrom, dateTo, analyticsUrl, dashboardRecord]);

    const handleGenerate = async () => {
        setError("");
        if (!isValidRange(dateFrom, dateTo)) {
            setError("Choose a valid date range (from before or equal to to).");
            return;
        }
        if (!anySelected) {
            setError("Select at least one metric to include.");
            return;
        }
        setBusy(true);
        try {
            let record: Record<string, unknown>;
            if (dashboardRecord) {
                record = dashboardRecord;
            } else {
                const res = await fetch(analyticsUrl(), { credentials: "include", cache: "no-store" });
                const payload = await res.json();
                if (!res.ok) {
                    const msg = typeof payload?.error === "string" ? payload.error : "Failed to load analytics for this range.";
                    throw new Error(msg);
                }
                record = payload as Record<string, unknown>;
            }
            setPreview(record);
            const fromPayload = extractFacilityNameFromPayload(record);
            const facilityName = networkExport || multiFacilityExport
                ? scopeTitle
                : (facilityNameProp?.trim() || resolvedFacilityName || fromPayload || "").trim() || undefined;
            const facilitySlug = facilityName
                ? `_${facilityName.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}`
                : "";
            const generatedAtIso = new Date().toISOString();
            const [{ buildAnalyticsReportPdfBlob }, { loadReportLogo }] = await Promise.all([
                import("@/lib/analytics/report-pdf"),
                import("@/lib/analytics/report-logo"),
            ]);
            const blob = buildAnalyticsReportPdfBlob(record, selected, {
                dateFrom,
                dateTo,
                generatedAtIso,
                facilityName,
                logo: await loadReportLogo(),
            });
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = objectUrl;
            a.download = `helix-analytics-report${facilitySlug}_${dateFrom}_to_${dateTo}.pdf`;
            a.rel = "noopener";
            a.click();
            URL.revokeObjectURL(objectUrl);
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
            setBusy(false);
        }
    };

    if (!open) return null;

    const presets: { id: Exclude<Preset, "custom">; label: string }[] = [
        { id: "today", label: "Today" },
        { id: "7d", label: "7D" },
        { id: "30d", label: "30D" },
        { id: "quarter", label: "Quarter" },
        { id: "ytd", label: "YTD" },
    ];

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-modal-title"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !busy) onClose();
            }}
        >
            <div
                data-generate-report-modal
                className="relative flex max-h-[92vh] w-full max-w-[1040px] flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_25px_70px_-15px_rgba(15,23,42,0.4)]"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <header className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-7 py-5">
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <div className="flex items-center gap-3">
                            <h2 id="report-modal-title" className="text-xl font-bold tracking-tight text-slate-900">
                                Generate report
                            </h2>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/60 bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
                                Executive Export
                            </span>
                        </div>
                        <p className="text-xs font-normal text-slate-500">
                            Configure date range, hospital facility scope, and metric categories for your executive operations export.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                        aria-label="Close dialog"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                        </svg>
                    </button>
                </header>

                <div className="flex min-h-0 flex-1 divide-x divide-slate-200/70 overflow-hidden">
                    <section className="flex w-full flex-col gap-6 overflow-y-auto bg-white p-6 lg:w-[61%]">
                        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-sky-600 shadow-sm">
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                                        </svg>
                                    </div>
                                    <div className="flex min-w-0 flex-col gap-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hospital scope</span>
                                            <span className="text-[11px] font-medium text-slate-400">· {networkExport ? "Active network" : "Current filter"}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="truncate text-sm font-semibold text-slate-900">{scopeTitle}</span>
                                            {avatarMarks.length > 0 ? (
                                                <span className="flex shrink-0 -space-x-1">
                                                    {avatarMarks.map((mark, index) => (
                                                        <span
                                                            key={`${mark}-${index}`}
                                                            className={clsx(
                                                                "inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ring-2 ring-white",
                                                                index === 0 ? "bg-sky-100 text-sky-800" : "bg-indigo-100 text-indigo-800",
                                                            )}
                                                        >
                                                            {mark}
                                                        </span>
                                                    ))}
                                                    {avatarExtra > 0 && (
                                                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-700 ring-2 ring-white">
                                                            +{avatarExtra}
                                                        </span>
                                                    )}
                                                </span>
                                            ) : (
                                                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[9px] font-bold text-sky-800 ring-2 ring-white">
                                                    {initials(scopeLabel)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {internal && networkExport && (
                                    <button
                                        type="button"
                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm"
                                        title="Scope follows the dashboard filter"
                                    >
                                        Change
                                        <svg className="h-3.5 w-3.5 text-slate-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                                            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            {regionSummary.length > 0 && (
                                <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5 text-[11px] text-slate-500">
                                    {regionSummary.map(([label, count], index) => (
                                        <span key={label} className="flex min-w-0 items-center gap-3">
                                            {index > 0 && <span className="text-slate-300">|</span>}
                                            <span className="flex items-center gap-1.5 truncate">
                                                <span className={clsx("h-1.5 w-1.5 rounded-full", regionDots[index])} />
                                                {label} ({count})
                                            </span>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-3">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                    Date range & comparison
                                </label>
                                <span className="text-xs font-medium text-sky-600">Fiscal Calendar {fiscalYear}</span>
                            </div>
                            <div className="flex w-full items-center justify-between rounded-xl border border-slate-200/70 bg-slate-100/90 p-1">
                                {presets.map((item) => {
                                    const active = preset === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => applyPreset(item.id)}
                                            className={clsx(
                                                "rounded-[4px] px-3 py-1 text-xs transition-colors",
                                                active
                                                    ? "bg-slate-900 font-semibold text-white shadow-sm"
                                                    : "font-medium text-slate-600 hover:text-slate-900",
                                            )}
                                        >
                                            {item.label}
                                        </button>
                                    );
                                })}
                                <button
                                    type="button"
                                    onClick={() => setEditingDates(true)}
                                    className={clsx(
                                        "rounded-[4px] px-3 py-1 text-xs transition-colors",
                                        preset === "custom" || editingDates
                                            ? "bg-slate-900 font-semibold text-white shadow-sm"
                                            : "font-medium text-slate-600 hover:text-slate-900",
                                    )}
                                >
                                    Custom
                                </button>
                            </div>
                            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
                                <div className="flex items-center gap-3 text-xs font-medium text-slate-800">
                                    <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                    </svg>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">From</span>
                                    <span className="font-semibold text-slate-900">{formatPretty(dateFrom)}</span>
                                    <span className="px-1 font-normal text-slate-300">→</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">To</span>
                                    <span className="font-semibold text-slate-900">{formatPretty(dateTo)}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEditingDates((v) => !v)}
                                    className="flex items-center gap-1 rounded-md p-1 text-xs font-semibold text-sky-600 hover:bg-sky-50 hover:text-sky-700"
                                >
                                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                                        <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                                    </svg>
                                    Edit
                                </button>
                            </div>
                            {editingDates && (
                                <CalendarRangePicker
                                    layout="block"
                                    presentation="modalPill"
                                    from={dateFrom}
                                    to={dateTo}
                                    onChange={(from, to) => {
                                        setDateFrom(from);
                                        setDateTo(to);
                                    }}
                                />
                            )}
                        </div>

                        {error && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700" role="alert">
                                {error}
                            </div>
                        )}

                        <div className="flex flex-col gap-2.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Report template presets</label>
                                <span className="text-xs text-slate-400">Auto-selects metrics</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {templateOptions.map(({ id, label }) => (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => applyTemplate(id)}
                                        className={clsx(
                                            "rounded-lg px-3 py-1.5 text-xs transition-colors",
                                            template === id
                                                ? "bg-slate-900 font-semibold text-white shadow-sm"
                                                : "bg-slate-100 font-medium text-slate-700 hover:bg-slate-200",
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setTemplate("custom")}
                                    className={clsx(
                                        "rounded-lg px-3 py-1.5 text-xs transition-colors",
                                        template === "custom"
                                            ? "bg-slate-900 font-semibold text-white shadow-sm"
                                            : "bg-slate-100 font-medium text-slate-700 hover:bg-slate-200",
                                    )}
                                >
                                    Custom
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-2">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                        Metric categories ({groups.length})
                                    </span>
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                                        {METRIC_TOTAL} total
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                    <button type="button" onClick={selectAll} className="font-semibold text-sky-600 hover:text-sky-700">
                                        Select all
                                    </button>
                                    <span className="text-slate-300">|</span>
                                    <button type="button" onClick={clearAll} className="font-medium text-slate-500 hover:text-slate-700">
                                        Clear all
                                    </button>
                                </div>
                            </div>

                            {groups.map(([groupName, metrics]) => {
                                const selectedInGroup = metrics.filter((m) => selected[m.id]).length;
                                const allOn = selectedInGroup === metrics.length && metrics.length > 0;
                                const openGroup = expanded === groupName;
                                const highlighted = openGroup && selectedInGroup > 0;
                                return (
                                    <div
                                        key={groupName}
                                        className={clsx(
                                            "overflow-hidden rounded-xl border shadow-xs",
                                            highlighted ? "border-sky-300 ring-1 ring-sky-200" : "border-slate-200",
                                        )}
                                    >
                                        <header
                                            className={clsx(
                                                "flex cursor-pointer items-center justify-between p-3.5",
                                                highlighted ? "bg-sky-50/60" : "bg-slate-50/70 hover:bg-slate-100/70",
                                            )}
                                            onClick={() => setExpanded(openGroup ? null : groupName)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={allOn}
                                                    onChange={() => toggleGroup(metrics)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                                    aria-label={`Toggle ${groupName}`}
                                                />
                                                <span className={clsx("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", GROUP_TONE[groupName] ?? "bg-slate-100 text-slate-600")}>
                                                    <GroupMark name={groupName} />
                                                </span>
                                                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-800">
                                                    {groupName}
                                                    {groupName === "Staff & activity" && (
                                                        <span className="rounded bg-sky-100/80 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-sky-700">
                                                            Core
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={clsx(
                                                    "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                                                    highlighted
                                                        ? "border-sky-200 bg-white text-sky-700"
                                                        : "border-slate-200 bg-white text-slate-500",
                                                )}>
                                                    {selectedInGroup} / {metrics.length} selected
                                                </span>
                                                <svg
                                                    className={clsx("h-4 w-4 text-slate-400 transition-transform", openGroup && "rotate-180")}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                                </svg>
                                            </div>
                                        </header>
                                        {openGroup && (
                                            <div className="grid grid-cols-1 gap-2 border-t border-slate-100 bg-white p-3.5 sm:grid-cols-2">
                                                {metrics.map((m) => {
                                                    const on = !!selected[m.id];
                                                    return (
                                                        <label
                                                            key={m.id}
                                                            className={clsx(
                                                                "flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-2 text-xs text-slate-700 hover:border-sky-300 hover:bg-sky-50/30",
                                                                metrics.length % 2 === 1 && m === metrics[metrics.length - 1] && "sm:col-span-2",
                                                            )}
                                                        >
                                                            <span className="flex min-w-0 items-center gap-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={on}
                                                                    onChange={() => toggle(m.id)}
                                                                    className="h-3.5 w-3.5 rounded text-sky-600 focus:ring-sky-500"
                                                                />
                                                                <span className="truncate font-medium">{m.label}</span>
                                                            </span>
                                                            {formatLiveValue(m, preview) && (
                                                                <span className="shrink-0 font-mono text-[10px] text-slate-400">{formatLiveValue(m, preview)}</span>
                                                            )}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <aside className="hidden w-[39%] flex-col justify-between overflow-y-auto bg-gradient-to-b from-slate-50/80 via-slate-50/40 to-slate-100/50 p-6 lg:flex">
                        <div className="flex flex-col gap-5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Live report preview</h3>
                                </div>
                                <span className="font-mono text-[11px] text-slate-500">PDF v1.4 ready</span>
                            </div>

                            <div className="relative flex aspect-[1/1.32] w-full max-w-[280px] flex-col justify-between gap-2 self-center overflow-hidden rounded-xl border border-slate-300/80 bg-white p-3.5 shadow-[0_12px_30px_-8px_rgba(15,23,42,0.12)]">
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                        <div className="flex items-center gap-1.5">
                                            <div className="flex h-4 w-4 items-center justify-center rounded bg-sky-800 text-[8px] font-bold text-white">H</div>
                                            <span className="max-w-[140px] truncate text-[8px] font-bold tracking-tight text-slate-800">{scopeLabel.toUpperCase()}</span>
                                        </div>
                                        <span className="font-mono text-[7px] text-slate-400">CONFIDENTIAL</span>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold leading-tight tracking-tight text-slate-900">
                                            STAFF & COMMUNICATIONS OPS SUMMARY
                                        </p>
                                        <p className="text-[7px] text-slate-500">
                                            Period: {formatPretty(dateFrom)} – {formatPretty(dateTo)}
                                            {siteCount ? ` · ${siteCount} Facilities` : ""}
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {previewTiles.map((metric) => {
                                        const value = formatLiveValue(metric, preview);
                                        const caption =
                                            metric.id === "scalar_active_users_rate_percent"
                                                ? "of registered"
                                                : metric.id === "scalar_critical_messages"
                                                  ? "in this range"
                                                  : metric.id === "scalar_avg_critical_ack_minutes"
                                                    ? "median acknowledgment"
                                                    : "roles filled";
                                        return (
                                            <div key={metric.id} className="rounded bg-slate-50 p-1.5">
                                                <div className="text-[6px] font-semibold uppercase tracking-wider text-slate-400">{PREVIEW_LABELS[metric.id] ?? metric.label}</div>
                                                <div className="text-[10px] font-bold text-slate-800">{value ?? "—"}</div>
                                                <div className="text-[6px] font-medium text-emerald-600">{value ? caption : "—"}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-0.5 text-[6px] text-slate-400">
                                        <span>Facility breakdown</span>
                                        <span>Variance</span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                        <div className="flex h-full w-full">
                                            <div className="w-[55%] bg-sky-500" />
                                            <div className="w-[25%] bg-indigo-500" />
                                            <div className="w-[20%] bg-teal-500" />
                                        </div>
                                    </div>
                                    <div className="h-1.5 w-full rounded bg-slate-100" />
                                    <div className="h-1.5 w-4/5 rounded bg-slate-100" />
                                </div>
                                <div className="flex items-center justify-between border-t border-slate-100 pt-2 font-mono text-[7px] text-slate-400">
                                    <span>Helix export</span>
                                    <span>Page 1 of {pageEstimate}</span>
                                </div>
                                <div className="rounded-md bg-slate-900/90 px-2 py-1 text-center text-[9px] font-medium text-white">
                                    Live compile: ~{pageEstimate} {pageEstimate === 1 ? "Page" : "Pages"} · {selectedCount} Metrics
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 rounded-xl border border-slate-200/90 bg-white p-3">
                                <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                                    <span className="flex items-center gap-1.5">
                                        <svg className="h-3.5 w-3.5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                            <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                        </svg>
                                        Document scope
                                    </span>
                                    <span className={clsx(
                                        "rounded px-2 py-0.5 text-[11px] font-bold",
                                        anySelected ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-700",
                                    )}>
                                        {anySelected ? "All valid" : "Pick metrics"}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-500">
                                    <span><b className="text-slate-800">{selectedCount}</b> metrics</span>
                                    <span className="text-slate-300">·</span>
                                    <span><b className="text-slate-800">{selectedCategories}</b> categories</span>
                                    <span className="text-slate-300">·</span>
                                    {facilitiesInScope != null && (
                                        <>
                                            <span><b className="text-slate-800">{facilitiesInScope}</b> facilities</span>
                                            <span className="text-slate-300">·</span>
                                        </>
                                    )}
                                    <span><b className="text-slate-800">~{pageEstimate}</b> pages</span>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>

                <footer className="flex shrink-0 flex-col justify-between gap-4 border-t border-slate-200 bg-white px-7 py-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2.5">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        </span>
                        <div className="text-xs">
                            <span className="font-bold text-slate-800">
                                {selectedCount} of {METRIC_TOTAL} metrics selected
                            </span>
                            <span className="font-normal text-slate-400">
                                {siteCount ? ` across ${siteCount} facilities` : ` · ${scopeLabel}`}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 self-end sm:self-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={busy}
                            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={busy || !anySelected}
                            onClick={handleGenerate}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
                        >
                            <svg className="h-4 w-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                            </svg>
                            {busy ? "Compiling report…" : "Download PDF report"}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}
