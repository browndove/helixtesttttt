'use client';

import { useState, useEffect, useMemo } from "react";
import Text from "@/components/text";
import InfoTooltip from "@/components/info-tooltip";
import { tailwindTextColors } from "@/lib/theme-colors";
import clsx from "clsx";

const infoText = "Top departments by role count showing filled vs total positions and fill rate percentages.";

export interface DepartmentMetricItem {
    department_name: string;
    role_fill_rate_percent: number;
    filled_roles: number;
    total_roles: number;
    critical_messages_sent: number;
    escalation_rate_vs_dept_critical_messages_percent: number;
}

interface ServiceDistributionProps {
    departments?: DepartmentMetricItem[];
}

const STYLES: { color: string; bgColor: string; bubbleBg: string; textColor: keyof typeof tailwindTextColors; hexColor: string }[] = [
    { color: "bg-accent-red", bgColor: "bg-[rgba(255,95,87,0.1)]", bubbleBg: "bg-[rgba(255,95,87,0.2)]", textColor: "accent-red", hexColor: "#ff5f57" },
    { color: "bg-accent-violet", bgColor: "bg-[rgba(105,116,247,0.1)]", bubbleBg: "bg-[rgba(105,116,247,0.2)]", textColor: "accent-violet", hexColor: "#6974f7" },
    { color: "bg-accent-primary", bgColor: "bg-[rgba(41,128,211,0.1)]", bubbleBg: "bg-[rgba(36,132,199,0.2)]", textColor: "accent-primary", hexColor: "#2484c7" },
];

const ServiceDistribution = ({ departments = [] }: ServiceDistributionProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [bubblesVisible, setBubblesVisible] = useState(false);
    const [legendVisible, setLegendVisible] = useState<number[]>([]);

    // Take top 3 departments by total_roles
    const depsKey = JSON.stringify(departments);
    const top3 = useMemo(() =>
        [...departments]
            .sort((a, b) => b.total_roles - a.total_roles)
            .slice(0, 3),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [depsKey]
    );

    useEffect(() => {
        setBubblesVisible(false);
        setLegendVisible([]);
        setTimeout(() => setBubblesVisible(true), 200);
        top3.forEach((_, index) => {
            setTimeout(() => {
                setLegendVisible(prev => [...prev, index]);
            }, 400 + (index * 150));
        });
    }, [top3]);

    return (
        <div
            className={clsx(
                "bg-primary rounded-[15px] flex flex-col items-between h-fit w-full gap-4 shadow-soft",
                "transition-all duration-500",
                isHovered && "shadow-[0_8px_30px_rgba(0,0,0,0.1)]"
            )}
            style={{ padding: 24 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex justify-between">
                <div className="flex flex-col gap-1">
                    <Text variant="body-md-semibold" color="text-primary">
                        Role Coverage
                    </Text>
                    <Text variant="body-sm" color="text-secondary">
                        Critical & standard role fill rates
                    </Text>
                </div>
                <InfoTooltip text={infoText} show={isHovered} />
            </div>

            <div className="flex-1 flex gap-[150px] items-center justify-between">
                {/* Left side - Chart visualization */}
                <div className="flex flex-col gap-2.5 h-[180px] w-[220px]">
                    {/* Bubble chart visualization */}
                    <div className="relative flex-1">
                        {/* Large bubble */}
                        {top3[0] && (
                            <div
                                className={clsx(
                                    `absolute left-0 top-0 size-[133px] rounded-full ${STYLES[0].bubbleBg} flex items-center justify-center`,
                                    "transition-all duration-700 ease-out",
                                    bubblesVisible ? "opacity-100 scale-100" : "opacity-0 scale-50",
                                    "animate-bubble-float"
                                )}
                                style={{ animationDelay: '0s' }}
                            >
                                <Text variant="heading-lg" color={STYLES[0].textColor}>
                                    {Math.round(top3[0].role_fill_rate_percent)}%
                                </Text>
                            </div>
                        )}

                        {/* Medium bubble */}
                        {top3[1] && (
                            <div
                                className={clsx(
                                    `absolute left-[119px] top-[33px] size-[100px] rounded-full ${STYLES[1].bubbleBg} flex items-center justify-center`,
                                    "transition-all duration-700 ease-out",
                                    bubblesVisible ? "opacity-100 scale-100" : "opacity-0 scale-50",
                                    "animate-bubble-float"
                                )}
                                style={{ transitionDelay: '150ms', animationDelay: '0.5s' }}
                            >
                                <Text variant="heading-md" color={STYLES[1].textColor}>
                                    {Math.round(top3[1].role_fill_rate_percent)}%
                                </Text>
                            </div>
                        )}

                        {/* Small bubble */}
                        {top3[2] && (
                            <div
                                className={clsx(
                                    `absolute left-[79px] top-[103px] size-[80px] rounded-full ${STYLES[2].bubbleBg} flex items-center justify-center`,
                                    "transition-all duration-700 ease-out",
                                    bubblesVisible ? "opacity-100 scale-100" : "opacity-0 scale-50",
                                    "animate-bubble-float"
                                )}
                                style={{ transitionDelay: '300ms', animationDelay: '1s' }}
                            >
                                <Text variant="body-md-semibold" color={STYLES[2].textColor}>
                                    {Math.round(top3[2].role_fill_rate_percent)}%
                                </Text>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right side - Legend */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                    {top3.length === 0 && (
                        <Text variant="body-sm" color="text-secondary" className="text-center py-4">No department data</Text>
                    )}
                    {top3.map((dept, index) => {
                        const s = STYLES[index % STYLES.length];
                        return (
                            <div
                                key={dept.department_name}
                                className={clsx(
                                    `${s.bgColor} flex items-center justify-between rounded-[10px] w-full`,
                                    "transition-all duration-500 cursor-pointer",
                                    "hover:scale-[1.02] hover:shadow-md",
                                    legendVisible.includes(index)
                                        ? "opacity-100 translate-x-0"
                                        : "opacity-0 translate-x-4"
                                )}
                                style={{ padding: '16px 16px', transitionDelay: `${index * 100}ms` }}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className={clsx(
                                            "size-[21px] rounded-full border flex items-center justify-center",
                                            "transition-transform duration-300",
                                            isHovered && "scale-110"
                                        )}
                                        style={{ borderColor: s.hexColor, borderWidth: '0.7px' }}
                                    >
                                        <div
                                            className={clsx(
                                                `size-[7px] rounded-full shadow-sm ${s.color}`,
                                                isHovered && "animate-breathe"
                                            )}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <Text variant="body-sm" color={s.textColor}>
                                            {dept.department_name}
                                        </Text>
                                        <Text variant="body-lg-semibold" color="text-primary">
                                            {dept.filled_roles}/{dept.total_roles}
                                        </Text>
                                    </div>
                                </div>
                                <Text variant="body-sm-semibold" color={s.textColor}>
                                    {Math.round(dept.role_fill_rate_percent)}%
                                </Text>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ServiceDistribution;
