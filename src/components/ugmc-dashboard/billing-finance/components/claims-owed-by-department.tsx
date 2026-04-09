"use client";

import * as React from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import clsx from "clsx";

type RoleAssignment = {
    role_id?: string;
    department: string;
    roleName: string;
    priority: string;
    priorityColor: string;
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
            priorityColor: role.priority === "critical" ? "var(--accent-red)" : "var(--accent-green)",
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
    return (
        <DashboardCard className="flex flex-col flex-1 h-full" padding="none" style={{ padding: 20, gap: 15 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Text variant="body-md-semibold" color="text-primary" className="font-bold">Role Assignment Status</Text>
                <Text variant="body-sm" color="text-secondary">Across all departments</Text>
            </div>
            <div className="flex-1 overflow-x-auto flex flex-col">
                <div className="flex-1 border border-tertiary rounded-[10px] overflow-hidden">
                    <table className="w-full" style={{ tableLayout: "fixed" }}>
                        <colgroup>
                            <col style={{ width: "25%" }} />
                            <col style={{ width: "25%" }} />
                            <col style={{ width: "25%" }} />
                            <col style={{ width: "25%" }} />
                        </colgroup>
                        <thead>
                            <tr className="bg-secondary border-b border-tertiary">
                                <th className="text-left" style={{ padding: '16px 12px' }}><Text variant="body-md-semibold" color="text-primary" className="font-bold">Department</Text></th>
                                <th className="text-left" style={{ padding: '16px 12px' }}><Text variant="body-md-semibold" color="text-primary" className="font-bold">Role Name</Text></th>
                                <th className="text-left" style={{ padding: '16px 12px' }}><Text variant="body-md-semibold" color="text-primary" className="font-bold">Priority</Text></th>
                                <th className="text-left" style={{ padding: '16px 12px' }}><Text variant="body-md-semibold" color="text-primary" className="font-bold">Status</Text></th>
                            </tr>
                        </thead>
                        <tbody>
                            {roleAssignments.map((role, index) => {
                                const priorityBgColor = role.priorityColor === "var(--accent-red)" ? "rgba(248, 81, 73, 0.1)" : "rgba(63, 185, 80, 0.1)";
                                const statusColor = role.filled ? "var(--accent-green)" : "var(--accent-red)";
                                const statusBgColor = role.filled ? "rgba(63, 185, 80, 0.1)" : "rgba(248, 81, 73, 0.1)";
                                return (
                                    <tr
                                        key={role.role_id || role.roleName}
                                        className={clsx(
                                            `${index % 2 === 1 ? "bg-secondary" : ""} ${index < roleAssignments.length - 1 ? "border-b border-tertiary" : ""}`,
                                            "cursor-pointer hover:bg-secondary/50 transition-colors"
                                        )}
                                        onClick={() => onEditRole?.(role)}
                                    >
                                        <td style={{ padding: '16px 12px' }}><Text variant="body-sm" color="text-primary">{role.department}</Text></td>
                                        <td style={{ padding: '16px 12px' }}><Text variant="body-sm" color="accent-primary">{role.roleName}</Text></td>
                                        <td style={{ padding: '16px 12px' }}>
                                            <span className="text-[14px] font-semibold rounded-[4px]" style={{ color: role.priorityColor, backgroundColor: priorityBgColor, padding: '4px 8px' }}>{role.priority}</span>
                                        </td>
                                        <td style={{ padding: '16px 12px' }}>
                                            <span className="text-[14px] font-semibold rounded-[4px]" style={{ color: statusColor, backgroundColor: statusBgColor, padding: '4px 8px' }}>{role.filled ? 'Filled' : 'Unfilled'}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardCard>
    );
};

export default ClaimsOwedByDepartment;
