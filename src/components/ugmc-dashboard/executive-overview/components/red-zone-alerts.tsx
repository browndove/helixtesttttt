'use client';

import { useState, useEffect } from "react";
import Text from "@/components/text";
import InfoTooltip from "@/components/info-tooltip";
import { MdWarning } from "react-icons/md";
import { IoSearch } from "react-icons/io5";
import clsx from "clsx";

const infoText = "Roles with the highest escalation counts, indicating positions that frequently trigger escalation notifications.";

export interface EscalatedRole {
    role_name: string;
    escalation_count: number;
}

interface RedZoneAlertsProps {
    roles?: EscalatedRole[];
}

const RedZoneAlerts = ({ roles = [] }: RedZoneAlertsProps) => {
    const displayRoles = roles.slice(0, 5);
    const [isHovered, setIsHovered] = useState(false);
    const [visibleAlerts, setVisibleAlerts] = useState<number[]>([]);

    const rolesKey = JSON.stringify(displayRoles);
    useEffect(() => {
        setVisibleAlerts([]);
        displayRoles.forEach((_, index) => {
            setTimeout(() => {
                setVisibleAlerts(prev => [...prev, index]);
            }, 100 * (index + 1));
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rolesKey]);

    return (
        <div
            className={clsx(
                "bg-primary border rounded-[15px] flex flex-col shadow-soft overflow-hidden relative",
                "transition-all duration-500",
                "animate-border-glow",
                isHovered ? "border-accent-red/70 shadow-[0_0_20px_rgba(255,95,87,0.15)]" : "border-accent-red/50"
            )}
            style={{ padding: 16, width: '100%', height: 'fit-content' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Animated gradient overlay */}
            <div
                className={clsx(
                    "absolute inset-0 pointer-events-none transition-opacity duration-500",
                    isHovered ? "opacity-100" : "opacity-70"
                )}
                style={{
                    background: "linear-gradient(140deg, rgba(255, 255, 255, 0) 5%, rgba(255, 95, 87, 0.06) 95%)"
                }}
            />

            {/* Header */}
            <div className="flex items-center justify-between relative z-10">
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                        <Text variant="body-md-semibold" color="accent-red">
                            Top Escalated Roles
                        </Text>
                        {/* Pulsing indicator */}
                        <div className="relative">
                            <div className="size-2 bg-accent-red rounded-full animate-breathe" />
                            <div className="absolute inset-0 size-2 bg-accent-red rounded-full animate-ping opacity-75" />
                        </div>
                    </div>
                    <Text variant="body-sm" color="text-secondary">
                        Highest escalation counts
                    </Text>
                </div>
                <div className="flex items-center gap-2">
                    <div className={clsx(
                        "flex items-center justify-center size-[31px] bg-tertiary rounded-[8.378px]",
                        "transition-all duration-300 cursor-pointer",
                        "hover:bg-accent-red/10 hover:scale-110"
                    )}>
                        <IoSearch className="w-[13px] h-[13px] text-text-primary" />
                    </div>
                </div>
            </div>

            {/* Escalated roles list */}
            <div className="flex flex-col relative z-10 mt-3">
                {displayRoles.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '12px 0' }}>
                        <Text variant="body-sm" color="text-secondary">No escalated roles in this period</Text>
                    </div>
                )}
                {displayRoles.map((role, index) => {
                    const isTop = index === 0;
                    const isLast = index === displayRoles.length - 1;
                    return (
                        <div
                            key={role.role_name}
                            className={clsx(
                                "transition-all duration-500",
                                !isLast && "border-b border-[var(--bg-tertiary)]",
                                visibleAlerts.includes(index)
                                    ? "opacity-100 translate-x-0"
                                    : "opacity-0 -translate-x-4"
                            )}
                            style={{ padding: '10px 0', transitionDelay: `${index * 50}ms` }}
                        >
                            <div className={clsx(
                                "flex items-center gap-2 rounded-lg",
                                "transition-all duration-300",
                            )}>
                                <div className={clsx(
                                    "flex items-center justify-center size-[33px] bg-[rgba(255,95,87,0.15)] rounded-lg shrink-0",
                                    "transition-transform duration-300",
                                    isTop && "animate-pulse"
                                )}>
                                    <MdWarning className={clsx(
                                        "w-3.5 h-3.5 text-accent-red",
                                        isTop && "animate-icon-bounce"
                                    )} />
                                </div>
                                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                    <Text variant="body-sm" color="text-primary" className="truncate">
                                        {role.role_name}
                                    </Text>
                                    <div className="flex items-center gap-1.5">
                                        {isTop && (
                                            <div className="relative">
                                                <div className="size-2 bg-accent-red rounded-full" />
                                                <div className="absolute inset-0 size-2 bg-accent-red rounded-full animate-ping" />
                                            </div>
                                        )}
                                        <Text variant="body-sm" color="text-secondary">
                                            {role.escalation_count} escalation{role.escalation_count !== 1 ? 's' : ''}
                                        </Text>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RedZoneAlerts;
