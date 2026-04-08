"use client";

import * as React from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";

type RoleCategory = {
    name: string;
    percentage: number;
    color: string;
    bgColor: string;
    textColor: string;
};

const MessagesByRoleBreakdown: React.FC<{ data?: any }> = ({ data }) => {
    // Top 5 colors to use for the stacked bar
    const colorPalette = [
        { color: "var(--accent-red)", bgColor: "rgba(248, 81, 73, 0.1)", textColor: "var(--accent-red)" },
        { color: "#FF9257", bgColor: "#FF92571A", textColor: "#FF9257" },
        { color: "#FFCA57", bgColor: "#FFCA5733", textColor: "#C68904" },
        { color: "var(--accent-green)", bgColor: "rgba(63, 185, 80, 0.1)", textColor: "var(--accent-green)" },
        { color: "var(--accent-primary)", bgColor: "rgba(41, 128, 211, 0.1)", textColor: "var(--accent-primary)" },
    ];

    const totalMessages = data?.total_messages || 0;

    // Map the real role names (top 3 standard + top 2 critical) sorting by total_messages descending
    const roleCategories: RoleCategory[] = React.useMemo(() => {
        if (!data?.role_metrics || data.role_metrics.length === 0) return [];
        
        // Separate by priority
        const standardRoles = [...data.role_metrics].filter(r => r.priority === 'standard').sort((a, b) => (b.total_messages || 0) - (a.total_messages || 0)).slice(0, 3);
        const criticalRoles = [...data.role_metrics].filter(r => r.priority === 'critical').sort((a, b) => (b.total_messages || 0) - (a.total_messages || 0)).slice(0, 2);
        
        // Combine: critical first, then standard
        const selectedRoles = [...criticalRoles, ...standardRoles];
        
        // Sum the selected roles so the bar perfectly fills 100%
        const selectedSum = selectedRoles.reduce((acc, curr) => acc + (curr.total_messages || 0), 0);
        
        return selectedRoles.map((role, index) => {
            const rawPercent = selectedSum > 0 ? (role.total_messages / selectedSum) * 100 : 0;
            return {
                name: role.role_name,
                percentage: Math.round(rawPercent),
                color: colorPalette[index % colorPalette.length].color,
                bgColor: colorPalette[index % colorPalette.length].bgColor,
                textColor: colorPalette[index % colorPalette.length].textColor
            };
        });
    }, [data]);

    // Calculate selected total for the display
    const selectedTotal = React.useMemo(() => {
        if (!data?.role_metrics || data.role_metrics.length === 0) return 0;
        const standardRoles = [...data.role_metrics].filter(r => r.priority === 'standard').sort((a, b) => (b.total_messages || 0) - (a.total_messages || 0)).slice(0, 3);
        const criticalRoles = [...data.role_metrics].filter(r => r.priority === 'critical').sort((a, b) => (b.total_messages || 0) - (a.total_messages || 0)).slice(0, 2);
        const selectedRoles = [...criticalRoles, ...standardRoles];
        return selectedRoles.reduce((acc, curr) => acc + (curr.total_messages || 0), 0);
    }, [data]);

    const [animatedBars, setAnimatedBars] = React.useState([0, 0, 0, 0, 0]);
    const [animatedTotal, setAnimatedTotal] = React.useState(0);
    const [isVisible, setIsVisible] = React.useState(false);

    React.useEffect(() => { setIsVisible(true); }, []);

    // Re-trigger animation when data updates
    React.useEffect(() => {
        if (!isVisible || roleCategories.length === 0) return;
        const duration = 2500;
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setAnimatedBars(roleCategories.map(item => item.percentage * eased).concat(Array(5 - roleCategories.length).fill(0)));
            setAnimatedTotal(Math.round(selectedTotal * eased));
            if (progress < 1) requestAnimationFrame(animate);
            else { 
                setAnimatedBars(roleCategories.map(item => item.percentage).concat(Array(5 - roleCategories.length).fill(0))); 
                setAnimatedTotal(selectedTotal); 
            }
        };
        requestAnimationFrame(animate);
    }, [isVisible, roleCategories, selectedTotal]);

    return (
        <DashboardCard className="flex flex-col flex-1" padding="none" style={{ padding: 16, gap: 15 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Text variant="body-md-semibold" color="text-primary" className="font-bold">Messages by Role Breakdown</Text>
                    <Text variant="body-sm" color="text-secondary">Top 3 Standard & 2 Critical · Current Window</Text>
                </div>
                <div className="bg-accent-primary/10 rounded-[5px] whitespace-nowrap" style={{ padding: '4px 7px' }}>
                    <Text variant="body-sm-semibold" color="accent-primary"><span className="tabular-nums">{animatedTotal > 1000 ? (animatedTotal / 1000).toFixed(1) + 'k' : animatedTotal}</span> Total</Text>
                </div>
            </div>
            <div className="flex h-[35px] rounded-[10px] overflow-hidden">
                {[0, 1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className={i === 4 ? "flex-1 transition-all duration-100" : "shrink-0 transition-all duration-100"}
                        style={{
                            width: i === 4 ? `${animatedBars[i]}%` : `${animatedBars[i]}%`,
                            minWidth: i === 4 ? `${animatedBars[i]}%` : undefined,
                            backgroundColor: roleCategories[i]?.color || 'transparent'
                        }}
                    />
                ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {roleCategories.map((category, index) => (
                    <React.Fragment key={category.name}>
                        <div className="flex items-center justify-between hover:bg-secondary/50 rounded-md px-1 -mx-1 transition-colors">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <div className="w-[10px] h-[10px] rounded-[2px]" style={{ backgroundColor: category.color }} />
                                <Text variant="body-sm" color="text-primary">{category.name}</Text>
                            </div>
                            <div className="rounded-[5px]" style={{ backgroundColor: category.bgColor, padding: '4px 7px' }}>
                                <span className="text-[12px] font-semibold tabular-nums" style={{ color: category.textColor }}>{Math.round(animatedBars[index])}%</span>
                            </div>
                        </div>
                        {index < roleCategories.length - 1 && <div className="border-t border-tertiary" />}
                    </React.Fragment>
                ))}
            </div>
        </DashboardCard>
    );
};

export default MessagesByRoleBreakdown;
