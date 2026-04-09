'use client';

import { useState, useEffect, useMemo } from "react";
import Text from "@/components/text";
import InfoTooltip from "@/components/info-tooltip";
import { tailwindTextColors } from "@/lib/theme-colors";
import clsx from "clsx";

const infoText =
    "Bar = department escalation index (from facility usage metrics), not role-level escalation counts. " +
    "Use Top Escalated Roles for per-role escalation volume. " +
    "Numbers show critical messages sent, escalation notifications, and average time to first reply on critical threads.";

function fmtCriticalReplyMin(minutes: unknown): string | null {
    if (minutes === undefined || minutes === null || minutes === "") return null;
    const n = typeof minutes === "string" ? parseFloat(minutes) : Number(minutes);
    if (!Number.isFinite(n) || n < 0) return null;
    if (n === 0) return "0 min reply";
    if (n < 60) return `${Math.round(n)} min reply`;
    const h = Math.floor(n / 60);
    const m = Math.round(n % 60);
    return m > 0 ? `${h}h ${m}m reply` : `${h}h reply`;
}

export interface DepartmentMetricItem {
    department_name: string;
    role_fill_rate_percent: number;
    escalation_rate_vs_dept_critical_messages_percent: number;
    filled_roles: number;
    total_roles: number;
    critical_messages_sent: number;
    /** Per-department avg first reply on critical messages (facility usage metrics). */
    avg_reply_response_minutes_critical?: number;
    /** Escalation notifications attributed to this department in the window. */
    escalation_notifications?: number;
}

const COLORS: { color: string; bgColor: string; textColor: keyof typeof tailwindTextColors }[] = [
    { color: "bg-[#6974f7]", bgColor: "bg-[rgba(105,116,247,0.15)]", textColor: "accent-violet" },
    { color: "bg-[#e89b00]", bgColor: "bg-[#E89B0026]", textColor: "accent-orange" },
    { color: "bg-accent-green", bgColor: "bg-[rgba(0,200,179,0.15)]", textColor: "accent-green" },
    { color: "bg-accent-primary", bgColor: "bg-[rgba(36,132,199,0.15)]", textColor: "accent-primary" },
    { color: "bg-accent-red", bgColor: "bg-[rgba(255,95,87,0.15)]", textColor: "accent-red" },
];

interface ResourceUtilizationProps {
    departments?: DepartmentMetricItem[];
}

const ResourceUtilization = ({ departments = [] }: ResourceUtilizationProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [animatedPercentages, setAnimatedPercentages] = useState<number[]>([]);
    const [isVisible, setIsVisible] = useState(false);

    const depsKey = JSON.stringify(departments);
    const depts = useMemo(() =>
        [...departments]
            .sort((a, b) => b.escalation_rate_vs_dept_critical_messages_percent - a.escalation_rate_vs_dept_critical_messages_percent)
            .slice(0, 4),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [depsKey]
    );

    /** Bar fill is normalized within the visible rows so rates above 100% still read visually; badge shows the real rate. */
    const maxEscalationRate = useMemo(
        () => Math.max(...depts.map(d => Number(d.escalation_rate_vs_dept_critical_messages_percent) || 0), 1),
        [depts]
    );

    useEffect(() => {
        setTimeout(() => setIsVisible(true), 100);

        setAnimatedPercentages(new Array(depts.length).fill(0));
        depts.forEach((dept, index) => {
            setTimeout(() => {
                const targetRate = Number(dept.escalation_rate_vs_dept_critical_messages_percent) || 0;
                const targetBarPercent = maxEscalationRate > 0
                    ? Math.min(100, (targetRate / maxEscalationRate) * 100)
                    : 0;
                const duration = 1000;
                const startTime = Date.now();
                const animate = () => {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);

                    setAnimatedPercentages(prev => {
                        const newPercentages = [...prev];
                        newPercentages[index] = Math.round(targetBarPercent * eased);
                        return newPercentages;
                    });

                    if (progress < 1) {
                        requestAnimationFrame(animate);
                    }
                };
                requestAnimationFrame(animate);
            }, 200 * (index + 1));
        });
    }, [depts, maxEscalationRate]);

    return (
        <div
            className={clsx(
                "bg-primary rounded-[15px] shadow-soft flex flex-col justify-between h-full min-h-[250px] w-full",
                "transition-all duration-500",
                isHovered && "shadow-[0_8px_30px_rgba(0,0,0,0.1)]"
            )}
            style={{ padding: 24 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                    <Text variant="body-md-semibold" color="text-primary">
                        Department critical traffic
                    </Text>
                    <Text variant="body-sm" color="text-secondary">
                        Escalation index, critical volume & reply time
                    </Text>
                </div>
                <InfoTooltip text={infoText} show={isHovered} />
            </div>

            {/* Departments */}
            <div className="flex flex-col gap-5">
                {depts.length === 0 && (
                    <Text variant="body-sm" color="text-secondary" className="text-center py-4">No department data available</Text>
                )}
                {depts.map((dept, index) => {
                    const style = COLORS[index % COLORS.length];
                    const badgeRate = Math.round(Number(dept.escalation_rate_vs_dept_critical_messages_percent) || 0);
                    const criticalSent = Math.round(Number(dept.critical_messages_sent) || 0);
                    const alerts = Math.round(Number(dept.escalation_notifications) || 0);
                    const replyLabel = fmtCriticalReplyMin(dept.avg_reply_response_minutes_critical);
                    const criticalLabel =
                        criticalSent === 1
                            ? '1 critical message'
                            : `${criticalSent.toLocaleString()} critical messages`;
                    const detailParts = [
                        replyLabel,
                        criticalLabel,
                        `${alerts.toLocaleString()} alert${alerts === 1 ? "" : "s"}`,
                    ].filter(Boolean);
                    return (
                        <div
                            key={dept.department_name}
                            className={clsx(
                                "flex flex-col gap-[7px] transition-all duration-500",
                                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                            )}
                            style={{ transitionDelay: `${index * 150}ms` }}
                        >
                            {/* Label row */}
                            <div className="flex items-start justify-between gap-2">
                                <Text variant="body-sm" color="text-primary" className="min-w-0 shrink">
                                    {dept.department_name}
                                </Text>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                        <div className={clsx(
                                            `${style.bgColor} px-3.5 py-1.5 flex rounded-full`,
                                            "transition-transform duration-300",
                                            isHovered && "scale-105"
                                        )}>
                                            <Text variant="body-sm-semibold" color={style.textColor}>
                                                {badgeRate}% index
                                            </Text>
                                        </div>
                                    </div>
                                    {detailParts.length > 0 && (
                                        <Text variant="body-xs" color="text-secondary" className="text-right max-w-[220px]">
                                            {detailParts.join(" · ")}
                                        </Text>
                                    )}
                                </div>
                            </div>

                            {/* Progress bar with animation */}
                            <div className={`${style.bgColor} h-[7px] rounded-full w-full overflow-hidden`}>
                                <div
                                    className={clsx(
                                        `${style.color} h-full rounded-full`,
                                        "transition-all duration-1000 ease-out"
                                    )}
                                    style={{ width: `${animatedPercentages[index] ?? 0}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ResourceUtilization;
