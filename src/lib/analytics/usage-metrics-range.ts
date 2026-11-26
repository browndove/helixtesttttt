/**
 * Usage metrics API: `from` is inclusive RFC3339 UTC, `to` is exclusive RFC3339 UTC.
 * UI stores inclusive calendar dates (YYYY-MM-DD).
 */
export function appendUsageMetricsRange(params: URLSearchParams, fromYmd: string, toYmd: string): void {
    params.set("from", `${fromYmd}T00:00:00.000Z`);
    const endExclusive = new Date(`${toYmd}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    params.set("to", endExclusive.toISOString().replace(/\.\d{3}Z$/, "Z"));
}
