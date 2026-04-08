"use client";

import * as React from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";

type RoleAssignment = {
    department: string;
    roleName: string;
    priority: string;
    priorityColor: string;
    filled: boolean;
};

const roleAssignments: RoleAssignment[] = [
    { department: "Surgery", roleName: "Lead Surgeon", priority: "Critical", priorityColor: "var(--accent-red)", filled: true },
    { department: "Diagnostics", roleName: "Lab Technician", priority: "Standard", priorityColor: "var(--accent-green)", filled: true },
    { department: "Emergency", roleName: "ER Physician", priority: "Critical", priorityColor: "var(--accent-red)", filled: false },
    { department: "Outpatient", roleName: "Nurse Practitioner", priority: "Standard", priorityColor: "var(--accent-green)", filled: true },
    { department: "Medicine", roleName: "Attending Doctor", priority: "Standard", priorityColor: "var(--accent-green)", filled: true },
];

const ClaimsOwedByDepartment: React.FC = () => {
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
                                    <tr key={role.roleName} className={`${index % 2 === 1 ? "bg-secondary" : ""} ${index < roleAssignments.length - 1 ? "border-b border-tertiary" : ""}`}>
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
