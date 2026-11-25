"use client";

import * as React from "react";
import Text from "@/components/analytics/text";
import DashboardCard from "@/components/analytics/ugmc-dashboard/shared/dashboard-card";
import { CardTitle } from "@/components/analytics/glass/illustrations";
import { EmptyState, Pill } from "@/components/analytics/glass/ui";
import { splitRoleName } from "@/lib/analytics/role-name";

type RoleCategory = {
    name: string;
    messages: number;
    critical: boolean;
    percentage: number;
    color: string;
    bgColor: string;
    textColor: string;
};

const MessagesByRoleBreakdown: React.FC<{ data?: any }> = ({ data }) => {
    // Top 5 colors to use for the stacked bar
    // Critical roles come first (warm tones), then standard roles (cool tones).
    const colorPalette = [
        { color: "#e0656b", bgColor: "#fcebed", textColor: "#c2414b" },
        { color: "#ec8f4f", bgColor: "#fdf0e6", textColor: "#b8662c" },
        { color: "#2f6fb8", bgColor: "#eaf2fc", textColor: "#2f6fb8" },
        { color: "#4aa3d8", bgColor: "#e8f4fb", textColor: "#2b7fb0" },
        { color: "#2a9a74", bgColor: "#e6f5ef", textColor: "#2a9a74" },
    ];

    const totalMessages = data?.total_messages || 0;

    // Map the real role names (top 3 standard + top 2 critical) sorting by total_messages descending
    const roleCategories: RoleCategory[] = React.useMemo(() => {
        if (!data?.role_metrics || data.role_metrics.length === 0) return [];
        
        // Separate by priority
        const standardRoles = [...data.role_metrics]
            .filter((r) => r.priority === "standard" && (r.total_messages || 0) > 0)
            .sort((a, b) => (b.total_messages || 0) - (a.total_messages || 0))
            .slice(0, 3);
        const criticalRoles = [...data.role_metrics]
            .filter((r) => r.priority === "critical" && (r.total_messages || 0) > 0)
            .sort((a, b) => (b.total_messages || 0) - (a.total_messages || 0))
            .slice(0, 2);
        
        // Combine: critical first, then standard
        const selectedRoles = [...criticalRoles, ...standardRoles];
        
        // Sum the selected roles so the bar perfectly fills 100%
        const selectedSum = selectedRoles.reduce((acc, curr) => acc + (curr.total_messages || 0), 0);
        
        return selectedRoles.map((role, index) => {
            const rawPercent = selectedSum > 0 ? (role.total_messages / selectedSum) * 100 : 0;
            return {
                name: role.role_name,
                messages: Number(role.total_messages) || 0,
                critical: role.priority === "critical",
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
        const standardRoles = [...data.role_metrics]
            .filter((r) => r.priority === "standard" && (r.total_messages || 0) > 0)
            .sort((a, b) => (b.total_messages || 0) - (a.total_messages || 0))
            .slice(0, 3);
        const criticalRoles = [...data.role_metrics]
            .filter((r) => r.priority === "critical" && (r.total_messages || 0) > 0)
            .sort((a, b) => (b.total_messages || 0) - (a.total_messages || 0))
            .slice(0, 2);
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
        <DashboardCard data-watermark="forum" className="flex flex-col flex-1" padding="none" style={{ padding: 16, gap: 15 }}>
            <div className="flex items-start justify-between gap-3">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <CardTitle icon="pie_chart" variant="body-md-semibold" className="font-bold">Messages by Role Breakdown</CardTitle>
                    <Text variant="body-sm" color="text-secondary">Top 2 critical & 3 standard roles</Text>
                </div>
                <Pill tone="blue">
                    {animatedTotal > 1000 ? `${(animatedTotal / 1000).toFixed(1)}k` : animatedTotal} msgs
                </Pill>
            </div>

            {roleCategories.length === 0 ? (
                <EmptyState icon="forum" title="No role messages yet" hint="The busiest roles appear here once messages are sent." />
            ) : (
                <>
                    <div className="an-stack" role="img" aria-label="Share of messages by role">
                        {roleCategories.map((category, i) => (
                            <span key={`${i}-${category.name}`} style={{ width: `${animatedBars[i]}%`, background: category.color }} />
                        ))}
                    </div>
                    <div className="an-list flex-1">
                        {roleCategories.map((category, index) => {
                            const { role: roleTitle, unit } = splitRoleName(category.name);
                            return (
                                <div key={`${index}-${category.name}`} className="an-row" title={category.name}>
                                    <span className="an-swatch" style={{ background: category.color }} aria-hidden />
                                    <div className="an-row__main">
                                        <span className="an-row__title">{roleTitle}</span>
                                        <span className="an-row__sub">
                                            {[unit, category.critical ? "Critical" : "Standard", `${category.messages.toLocaleString()} msgs`].filter(Boolean).join(" · ")}
                                        </span>
                                    </div>
                                    <span className="an-pill" style={{ color: category.textColor, background: category.bgColor }}>
                                        {Math.round(animatedBars[index])}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </DashboardCard>
    );
};

export default MessagesByRoleBreakdown;
