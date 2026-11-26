import type { ApexOptions } from "apexcharts";

/** Max rows for facility list chart. */
export const TRANSFER_FACILITY_TOP_N = 5;

/** Max rows for role bar chart (fewer = more breathing room). */
export const TRANSFER_ROLE_TOP_N = 3;

/** @deprecated Use TRANSFER_FACILITY_TOP_N or TRANSFER_ROLE_TOP_N */
export const TRANSFER_CHART_TOP_N = TRANSFER_FACILITY_TOP_N;

export function formatRoleChartLabel(roleName: string, maxLen = 24): string {
    const withoutPrefix = roleName.replace(/^HH\s*-\s*/i, "").trim() || roleName.trim();
    return truncateChartLabel(withoutPrefix, maxLen);
}

export function truncateChartLabel(label: string, maxLen = 26): string {
    const trimmed = label.trim();
    if (trimmed.length <= maxLen) return trimmed;
    return `${trimmed.slice(0, maxLen - 1)}…`;
}

const chartFont = "inherit";

export const chartLabelStyle = {
    colors: "var(--text-secondary)",
    fontSize: "10px",
    fontWeight: 400,
    fontFamily: chartFont,
};

export const roleChartLabelStyle = {
    colors: "var(--text-primary)",
    fontSize: "12px",
    fontWeight: 600,
    fontFamily: chartFont,
};

export const roleChartAxisStyle = {
    colors: "var(--text-secondary)",
    fontSize: "11px",
    fontWeight: 600,
    fontFamily: chartFont,
};

export const ROLE_CHART_BAR_COLOR = "#2f6fb8";

/** Grid, motion and tooltip chrome come from the analytics house theme (glass/apex-theme.ts). */
export const baseChartOptions: ApexOptions = {
    chart: {
        toolbar: { show: false },
        zoom: { enabled: false },
        background: "transparent",
    },
    dataLabels: { enabled: false },
};
