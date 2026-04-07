"use client";

import * as React from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";

type DepartmentClaim = {
    department: string;
    amountOwed: string;
    days: string;
    daysColor: string;
    claimCount: number;
};

const departmentClaims: DepartmentClaim[] = [
    { department: "Surgery", amountOwed: "GH₵ 385k", days: "32d", daysColor: "var(--accent-red)", claimCount: 247 },
    { department: "Diagnostics", amountOwed: "GH₵ 385k", days: "13d", daysColor: "var(--accent-green)", claimCount: 412 },
    { department: "Emergency", amountOwed: "GH₵ 385k", days: "32d", daysColor: "var(--accent-red)", claimCount: 356 },
    { department: "Outpatient", amountOwed: "GH₵ 385k", days: "13d", daysColor: "var(--accent-green)", claimCount: 524 },
    { department: "Medicine", amountOwed: "GH₵ 385k", days: "13d", daysColor: "var(--accent-green)", claimCount: 189 },
];

const ClaimsOwedByDepartment: React.FC = () => {
    return (
        <DashboardCard className="flex flex-col flex-1 h-full" padding="none" style={{ padding: 20, gap: 15 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Text variant="body-md-semibold" color="text-primary" className="font-bold">Outstanding Claim Reimbursement By Department</Text>
                <Text variant="body-sm" color="text-secondary">Across all insurers</Text>
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
                                <th className="text-left" style={{ padding: '16px 12px' }}><Text variant="body-md-semibold" color="text-primary" className="font-bold">Amount Owed</Text></th>
                                <th className="text-left" style={{ padding: '16px 12px' }}><Text variant="body-md-semibold" color="text-primary" className="font-bold">Days</Text></th>
                                <th className="text-left" style={{ padding: '16px 12px' }}><Text variant="body-md-semibold" color="text-primary" className="font-bold">Claim Count</Text></th>
                            </tr>
                        </thead>
                        <tbody>
                            {departmentClaims.map((claim, index) => {
                                const daysBgColor = claim.daysColor === "var(--accent-red)" ? "rgba(248, 81, 73, 0.1)" : "rgba(63, 185, 80, 0.1)";
                                return (
                                    <tr key={claim.department} className={`${index % 2 === 1 ? "bg-secondary" : ""} ${index < departmentClaims.length - 1 ? "border-b border-tertiary" : ""}`}>
                                        <td style={{ padding: '16px 12px' }}><Text variant="body-sm" color="text-primary">{claim.department}</Text></td>
                                        <td style={{ padding: '16px 12px' }}><Text variant="body-sm" color="accent-primary">{claim.amountOwed}</Text></td>
                                        <td style={{ padding: '16px 12px' }}>
                                            <span className="text-[14px] font-semibold rounded-[4px]" style={{ color: claim.daysColor, backgroundColor: daysBgColor, padding: '4px 8px' }}>{claim.days}</span>
                                        </td>
                                        <td style={{ padding: '16px 12px' }}><Text variant="body-sm" color="text-primary">{claim.claimCount}</Text></td>
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
