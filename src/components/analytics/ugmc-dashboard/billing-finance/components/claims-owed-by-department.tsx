"use client";

import * as React from "react";
import Text from "@/components/analytics/text";
import DashboardCard from "@/components/analytics/ugmc-dashboard/shared/dashboard-card";
import clsx from "clsx";
import { CardTitle } from "@/components/analytics/glass/illustrations";
import { EmptyState, Meter, Pill, RowIcon } from "@/components/analytics/glass/ui";
import { splitRoleName } from "@/lib/analytics/role-name";

type RoleAssignment = {
    role_id?: string;
    department: string;
    roleName: string;
    priority: string;
    filled: boolean;
};

const ClaimsOwedByDepartment: React.FC<{ data?: any; onEditRole?: (role: any) => void }> = ({ data, onEditRole }) => {
    // Convert role_metrics to display format
    const roleAssignments: RoleAssignment[] = React.useMemo(() => {
        if (!data?.role_metrics || data.role_metrics.length === 0) {
            return [];
        }
        const mapped: RoleAssignment[] = data.role_metrics.map((role: any) => ({
            role_id: role.role_id,
            department: role.department_name,
            roleName: role.role_name,
            priority: role.priority === "critical" ? "Critical" : "Standard",
            filled: role.filled
        }));

        // Show at most 5 rows, preferring a 3 Standard + 2 Critical mix.
        const standard = mapped.filter((r) => r.priority === "Standard");
        const critical = mapped.filter((r) => r.priority === "Critical");
        const selected: RoleAssignment[] = [
            ...standard.slice(0, 3),
            ...critical.slice(0, 2),
        ];

        if (selected.length < 5) {
            const selectedIds = new Set(selected.map((r) => r.role_id ?? `${r.department}|${r.roleName}`));
            const remaining = mapped.filter((r) => !selectedIds.has(r.role_id ?? `${r.department}|${r.roleName}`));
            selected.push(...remaining.slice(0, 5 - selected.length));
        }

        return selected.slice(0, 5);
    }, [data]);
    const filled = Number(data?.filled_roles) || 0;
    const total = Number(data?.total_roles) || 0;
    const fillPct = total > 0 ? (filled / total) * 100 : 0;

    return (
        <DashboardCard data-watermark="badge" className="flex flex-col flex-1 h-full" padding="none" style={{ padding: 20, gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <CardTitle icon="assignment_ind" variant="body-md-semibold" className="font-bold">Role Assignment Status</CardTitle>
                <Text variant="body-sm" color="text-secondary">Across all departments</Text>
            </div>

            <div className="flex flex-col gap-2">
                <div className="an-bigstat">
                    <span className="an-bigstat__value">{filled}<span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>/{total}</span></span>
                    <span className="an-bigstat__label">roles filled</span>
                    <span className="ml-auto"><Pill tone={fillPct >= 70 ? 'mint' : 'amber'}>{Math.round(fillPct)}%</Pill></span>
                </div>
                <Meter pct={fillPct} tone={fillPct >= 70 ? 'mint' : 'amber'} label={`${filled} of ${total} roles filled`} />
            </div>

            {roleAssignments.length === 0 ? (
                <EmptyState icon="assignment_ind" title="No roles yet" hint="Roles appear here once they are set up for this facility." />
            ) : (
                <div className="an-list flex-1">
                    {roleAssignments.map((role, index) => {
                        const critical = role.priority === "Critical";
                        const { role: roleTitle, unit } = splitRoleName(role.roleName);
                        return (
                            <div
                                key={role.role_id || `${index}-${role.roleName}`}
                                className={clsx("an-row", onEditRole && "cursor-pointer")}
                                onClick={() => onEditRole?.(role)}
                                title={role.roleName}
                            >
                                <RowIcon icon={critical ? "emergency" : "badge"} tone={critical ? "rose" : "blue"} />
                                <div className="an-row__main">
                                    <span className="an-row__title">{roleTitle}</span>
                                    <span className="an-row__sub">{unit && unit !== role.department ? `${unit} · ${role.department}` : role.department}</span>
                                </div>
                                <div className="an-row__end">
                                    <Pill tone={critical ? "rose" : "slate"}>{role.priority}</Pill>
                                    <Pill tone={role.filled ? "mint" : "amber"} dot>{role.filled ? "Filled" : "Open"}</Pill>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </DashboardCard>
    );
};

export default ClaimsOwedByDepartment;
