"use client";

import * as React from "react";
import Text from "@/components/analytics/text";
import DashboardCard from "@/components/analytics/ugmc-dashboard/shared/dashboard-card";
import { CardTitle } from "@/components/analytics/glass/illustrations";
import { Callout, EmptyState, Meter } from "@/components/analytics/glass/ui";
import { shortRoleName, splitRoleName } from "@/lib/analytics/role-name";

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

    const topName = rows[0] ? shortRoleName(rows[0].name) : undefined;
    const maxEscalations = Math.max(1, ...rows.map((r) => r.escalations));

    return (
        <DashboardCard data-watermark="campaign" className="flex flex-col flex-1" padding="none" style={{ padding: 20, gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <CardTitle icon="trending_up" variant="body-md-semibold" className="font-bold">Top Escalated Roles</CardTitle>
                <Text variant="body-sm" color="text-secondary">By escalation count · current window</Text>
            </div>

            <div className="an-bigstat">
                <span className="an-bigstat__value">{totalEscalations.toLocaleString()}</span>
                <span className="an-bigstat__label">escalations across the facility</span>
            </div>

            {rows.length === 0 ? (
                <EmptyState icon="verified" title="No escalations" hint="No role triggered an escalation in this period." />
            ) : (
                <div className="an-list flex-1">
                    {rows.map((role) => {
                        const { role: roleTitle, unit } = splitRoleName(role.name);
                        const where = [unit, role.department !== "—" && role.department !== unit ? role.department : ""].filter(Boolean).join(" · ");
                        return (
                            <div key={`${role.rank}-${role.name}`} className="an-row" title={role.name}>
                                <span className={`an-rank an-rank--${role.rank}`}>{role.rank}</span>
                                <div className="an-row__main">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="an-row__title">{roleTitle}</span>
                                        <span className="shrink-0 text-[13px] font-bold tabular-nums text-text-primary">{role.escalations}</span>
                                    </div>
                                    <Meter pct={(role.escalations / maxEscalations) * 100} tone={role.rank === 1 ? "rose" : "blue"} />
                                    <span className="an-row__sub">
                                        {where || "—"}{role.messages > 0 ? ` · ${role.messages.toLocaleString()} msgs` : ""}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {topName && (
                <Callout icon="tips_and_updates" tone="rose">
                    <strong>{topName}</strong> escalates most in this window. Review its coverage and response protocol.
                </Callout>
            )}
        </DashboardCard>
    );
};

export default TopVendors;
