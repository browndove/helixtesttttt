"use client";

import * as React from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";

type EscalatedRoleRow = {
    role_id?: string;
    role_name: string;
    escalation_count: number;
    total_messages_for_role?: number;
};

function unwrapAnalyticsPayload(data?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!data) return undefined;
    const inner = data.data;
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
        return inner as Record<string, unknown>;
    }
    return data;
}

function num(v: unknown): number {
    if (v === null || v === undefined) return 0;
    const n = typeof v === "string" ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
}

const TopVendors: React.FC<{ data?: Record<string, unknown> }> = ({ data }) => {
    const root = unwrapAnalyticsPayload(data);

    const roleDeptById = React.useMemo(() => {
        const m = new Map<string, string>();
        const metrics = root?.role_metrics as { role_id?: string; department_name?: string }[] | undefined;
        if (!Array.isArray(metrics)) return m;
        for (const r of metrics) {
            const id = String(r.role_id || "").trim();
            if (id) m.set(id, String(r.department_name || "").trim());
        }
        return m;
    }, [root]);

    const rows = React.useMemo(() => {
        const list = root?.top_escalated_roles as EscalatedRoleRow[] | undefined;
        if (Array.isArray(list) && list.length > 0) {
            return [...list]
                .sort((a, b) => num(b.escalation_count) - num(a.escalation_count))
                .slice(0, 5)
                .map((r, i) => ({
                    rank: i + 1,
                    name: String(r.role_name || "Role").trim() || "Role",
                    department: (r.role_id && roleDeptById.get(String(r.role_id))) || "—",
                    escalations: num(r.escalation_count),
                    messages: num(r.total_messages_for_role),
                }));
        }

        const rm = root?.role_metrics as {
            role_id?: string;
            role_name?: string;
            department_name?: string;
            escalated_critical_messages?: number;
            total_messages?: number;
        }[] | undefined;
        if (!Array.isArray(rm) || rm.length === 0) return [];

        return [...rm]
            .map((r) => ({
                role_id: r.role_id,
                role_name: String(r.role_name || "Role").trim() || "Role",
                department: String(r.department_name || "").trim() || "—",
                escalations: num(r.escalated_critical_messages),
                messages: num(r.total_messages),
            }))
            .sort((a, b) => b.escalations - a.escalations || b.messages - a.messages)
            .slice(0, 5)
            .map((r, i) => ({
                rank: i + 1,
                name: r.role_name,
                department: r.department || "—",
                escalations: r.escalations,
                messages: r.messages,
            }));
    }, [root, roleDeptById]);

    const totalEscalations = React.useMemo(() => {
        const v = root?.escalated_critical_messages;
        const fromApi = num(v);
        if (fromApi > 0) return Math.round(fromApi);
        const sumRows = rows.reduce((s, r) => s + r.escalations, 0);
        if (sumRows > 0) return sumRows;
        return 0;
    }, [root, rows]);

    const topName = rows[0]?.name;

    return (
        <DashboardCard className="flex flex-col flex-1" padding="none" style={{ padding: 20, gap: 10, height: 680 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Text variant="body-md-semibold" color="text-primary" className="font-bold">Top Escalated Roles</Text>
                    <Text variant="body-sm" color="text-secondary">By escalation count · current window</Text>
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Text variant="body-sm" color="text-secondary">Total escalations (facility)</Text>
                <span className="text-[32px] font-bold tabular-nums" style={{ color: "#0EAF9F" }}>{totalEscalations.toLocaleString()}</span>
            </div>
            <div className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {rows.length === 0 && (
                    <Text variant="body-sm" color="text-secondary" className="py-6 text-center">No escalation data for this period</Text>
                )}
                {rows.map((role) => (
                    <div key={`${role.rank}-${role.name}`} className="bg-secondary rounded-[10px] flex items-center" style={{ padding: 16, minHeight: 71 }}>
                        <div className="w-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                            <div className="flex-1 min-w-0" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <Text variant="heading-lg" color="text-tertiary" className="font-semibold shrink-0">{role.rank}</Text>
                                <div className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    <Text variant="body-md-semibold" color="text-primary" className="truncate">{role.name}</Text>
                                    <Text variant="body-sm" color="text-tertiary">{role.department}</Text>
                                </div>
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-1">
                                <div className="rounded-[4px] bg-quaternary" style={{ padding: '0 8px' }}>
                                    <Text variant="body-md-semibold" color="text-primary" className="tabular-nums">{role.escalations}</Text>
                                </div>
                                {role.messages > 0 && (
                                    <Text variant="body-xs" color="text-tertiary" className="tabular-nums">{role.messages} msgs</Text>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {topName && rows.length > 0 && (
                <div className="bg-[#0EAF9F1A] border border-[#0EAF9F33] rounded-[10px]" style={{ padding: 12 }}>
                    <Text variant="body-md" color="none" style={{ color: "#0EAF9F" }} className="font-medium break-words overflow-wrap-anywhere">
                        {topName} has the highest escalation count in this window. Review coverage and response protocols if needed.
                    </Text>
                </div>
            )}
        </DashboardCard>
    );
};

export default TopVendors;
