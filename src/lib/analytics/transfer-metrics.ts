export interface TransferCounterpartyRow {
    counterparty_facility_id: string;
    counterparty_facility_name: string;
    total_transfer_requests: number;
    outbound_transfer_requests: number;
    inbound_transfer_requests: number;
    accepted_transfer_requests: number;
    declined_transfer_requests: number;
    pending_transfer_requests: number;
}

export interface TransferRoleRow {
    role_id: string;
    role_name: string;
    facility_id: string;
    facility_name: string;
    total_transfer_requests: number;
    outbound_transfer_requests: number;
    inbound_transfer_requests: number;
    accepted_transfer_requests: number;
    declined_transfer_requests: number;
    pending_transfer_requests: number;
}

export interface TransferMetricsData {
    facility_id: string;
    window_days: number;
    from: string;
    to: string;
    total_transfer_requests: number;
    transfer_requests_sent: number;
    transfer_requests_outbound: number;
    transfer_requests_inbound: number;
    transfer_requests_accepted: number;
    transfer_requests_declined: number;
    transfer_requests_pending: number;
    transfer_by_counterparty_facility: TransferCounterpartyRow[];
    transfer_by_role: TransferRoleRow[];
}

function num(value: unknown): number {
    return typeof value === "number" && !Number.isNaN(value) ? value : 0;
}

function str(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function mapCounterpartyRow(row: unknown): TransferCounterpartyRow | null {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const r = row as Record<string, unknown>;
    const name = str(r.counterparty_facility_name || r.facility_name || r.name);
    const id = str(r.counterparty_facility_id || r.facility_id || r.id);
    if (!name && !id) return null;
    return {
        counterparty_facility_id: id,
        counterparty_facility_name: name || id,
        total_transfer_requests: num(r.total_transfer_requests),
        outbound_transfer_requests: num(r.outbound_transfer_requests ?? r.transfer_requests_outbound),
        inbound_transfer_requests: num(r.inbound_transfer_requests ?? r.transfer_requests_inbound),
        accepted_transfer_requests: num(r.accepted_transfer_requests ?? r.transfer_requests_accepted),
        declined_transfer_requests: num(r.declined_transfer_requests ?? r.transfer_requests_declined),
        pending_transfer_requests: num(r.pending_transfer_requests ?? r.transfer_requests_pending),
    };
}

function mapRoleRow(row: unknown): TransferRoleRow | null {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const r = row as Record<string, unknown>;
    const roleName = str(r.role_name || r.name);
    const roleId = str(r.role_id || r.id);
    if (!roleName && !roleId) return null;
    return {
        role_id: roleId,
        role_name: roleName || roleId,
        facility_id: str(r.facility_id),
        facility_name: str(r.facility_name),
        total_transfer_requests: num(r.total_transfer_requests),
        outbound_transfer_requests: num(r.outbound_transfer_requests ?? r.transfer_requests_outbound),
        inbound_transfer_requests: num(r.inbound_transfer_requests ?? r.transfer_requests_inbound),
        accepted_transfer_requests: num(r.accepted_transfer_requests ?? r.transfer_requests_accepted),
        declined_transfer_requests: num(r.declined_transfer_requests ?? r.transfer_requests_declined),
        pending_transfer_requests: num(r.pending_transfer_requests ?? r.transfer_requests_pending),
    };
}

function mapRowArray<T>(value: unknown, map: (row: unknown) => T | null): T[] {
    if (!Array.isArray(value)) return [];
    return value.map(map).filter((r): r is T => r !== null);
}

/** Transfer metrics are included on GET /api/v1/facilities/{id}/usage-metrics. */
export function extractTransferMetricsFromUsage(payload: unknown): TransferMetricsData | null {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

    const root = payload as Record<string, unknown>;
    const nestedCandidates = [root.transfer_metrics, root.transferMetrics, root.transfer];
    let src: Record<string, unknown> = root;

    for (const candidate of nestedCandidates) {
        if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
            src = { ...root, ...(candidate as Record<string, unknown>) };
            break;
        }
    }

    const hasTransfer =
        "total_transfer_requests" in src ||
        "transfer_requests_outbound" in src ||
        "transfer_requests_inbound" in src ||
        "transfer_by_counterparty_facility" in src;

    if (!hasTransfer) return null;

    const outbound = num(src.transfer_requests_outbound ?? src.outbound_transfer_requests);
    const inbound = num(src.transfer_requests_inbound ?? src.inbound_transfer_requests);
    const total = num(src.total_transfer_requests) || outbound + inbound;

    return {
        facility_id: str(src.facility_id ?? root.facility_id),
        window_days: num(src.window_days ?? root.window_days),
        from: str(src.from ?? root.from),
        to: str(src.to ?? root.to),
        total_transfer_requests: total,
        transfer_requests_sent: num(src.transfer_requests_sent ?? src.transfer_requests_outbound_sent ?? outbound),
        transfer_requests_outbound: outbound,
        transfer_requests_inbound: inbound,
        transfer_requests_accepted: num(src.transfer_requests_accepted),
        transfer_requests_declined: num(src.transfer_requests_declined),
        transfer_requests_pending: num(src.transfer_requests_pending),
        transfer_by_counterparty_facility: mapRowArray(
            src.transfer_by_counterparty_facility,
            mapCounterpartyRow,
        ),
        transfer_by_role: mapRowArray(src.transfer_by_role, mapRoleRow),
    };
}

export function acceptanceRatePercent(data: TransferMetricsData): number {
    if (data.total_transfer_requests <= 0) return 0;
    return (data.transfer_requests_accepted / data.total_transfer_requests) * 100;
}

export function windowLabel(data: TransferMetricsData): string {
    if (data.window_days === 0) return "Selected period";
    if (data.window_days === 1) return "Today";
    return `Last ${data.window_days} days`;
}
