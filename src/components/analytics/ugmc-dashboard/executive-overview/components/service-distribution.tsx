'use client';

import { useState, useEffect, useMemo } from "react";
import Text from "@/components/analytics/text";
import InfoTooltip from "@/components/analytics/info-tooltip";
import RoleCoverageModal from "./RoleCoverageModal";
import { tailwindTextColors } from "@/lib/analytics/theme-colors";
import clsx from "clsx";
import { CardTitle } from "@/components/analytics/glass/illustrations";

const infoText = "Top departments by role count showing filled vs total positions and fill rate percentages.";

export interface DepartmentMetricItem {
    department_name: string;
    role_fill_rate_percent: number;
    filled_roles: number;
    total_roles: number;
    critical_messages_sent: number;
    escalation_rate_vs_dept_critical_messages_percent: number;
    critical_role_fill_rate_percent: number;
    critical_filled_roles: number;
    critical_total_roles: number;
}

interface ServiceDistributionProps {
    departments?: DepartmentMetricItem[];
}

const STYLES: { color: string; bgColor: string; bubbleBg: string; textColor: keyof typeof tailwindTextColors; hexColor: string }[] = [
    { color: "bg-accent-red", bgColor: "bg-[rgba(224,101,107,0.1)]", bubbleBg: "bg-[rgba(224,101,107,0.2)]", textColor: "accent-red", hexColor: "#e0656b" },
    { color: "bg-accent-violet", bgColor: "bg-[rgba(74,143,214,0.1)]", bubbleBg: "bg-[rgba(74,143,214,0.2)]", textColor: "accent-violet", hexColor: "#4a8fd6" },
    { color: "bg-accent-primary", bgColor: "bg-[rgba(47,111,184,0.1)]", bubbleBg: "bg-[rgba(47,111,184,0.2)]", textColor: "accent-primary", hexColor: "#2f6fb8" },
];

const ServiceDistribution = ({ departments = [] }: ServiceDistributionProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [bubblesVisible, setBubblesVisible] = useState(false);
    const [legendVisible, setLegendVisible] = useState<number[]>([]);
    const [modalOpen, setModalOpen] = useState(false);

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
        <div data-watermark="shield"
            className={clsx(
                "@container min-w-0",
                "box-border flex h-full min-h-0 w-full flex-col gap-4 bg-primary rounded-[18px] border border-black/[0.08]",
                "transition-all duration-500",
                isHovered && "border-black/[0.14]"
            )}
            style={{ padding: '20px 20px 22px' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex justify-between">
                <div className="flex flex-col gap-0.5">
                    <CardTitle icon="verified_user" variant="body-md-semibold">Role Coverage</CardTitle>
                    <Text variant="body-sm" color="text-secondary">
                        Critical & standard role fill rates
                    </Text>
                </div>
                <div className="flex items-center gap-2">
                    <InfoTooltip text={infoText} show={isHovered} />
                    <button
                        onClick={() => setModalOpen(true)}
                        className={clsx(
                            "px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-200",
                            "bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary",
                            "cursor-pointer whitespace-nowrap"
                        )}
                        title="View detailed role coverage by department"
                    >
                        View More
                    </button>
                </div>
            </div>

            <div className="flex min-w-0 w-full flex-col items-stretch gap-5 @md:flex-row @md:items-start @md:justify-between @md:gap-5">
                {/* Left side - Chart visualization (compact bubbles) */}
                <div className="mx-auto flex h-[158px] w-full max-w-[200px] shrink-0 flex-col overflow-hidden @md:mx-0">
                    <div className="relative h-[158px] w-full max-w-[200px] overflow-hidden">
                        {/* Large bubble */}
                        {top3[0] && (
                            <div
                                className={clsx(
                                    `absolute left-0 top-0 size-[110px] rounded-full ${STYLES[0].bubbleBg} flex items-center justify-center`,
                                    "transition-all duration-700 ease-out",
                                    bubblesVisible ? "opacity-100 scale-100" : "opacity-0 scale-50",
                                    "animate-bubble-float"
                                )}
                                style={{ animationDelay: '0s' }}
                            >
                                <Text variant="heading-md" color={STYLES[0].textColor}>
                                    {Math.round(top3[0].role_fill_rate_percent)}%
                                </Text>
                            </div>
                        )}

                        {/* Medium bubble */}
                        {top3[1] && (
                            <div
                                className={clsx(
                                    `absolute left-[98px] top-[26px] size-[82px] rounded-full ${STYLES[1].bubbleBg} flex items-center justify-center`,
                                    "transition-all duration-700 ease-out",
                                    bubblesVisible ? "opacity-100 scale-100" : "opacity-0 scale-50",
                                    "animate-bubble-float"
                                )}
                                style={{ transitionDelay: '150ms', animationDelay: '0.5s' }}
                            >
                                <Text variant="body-lg-semibold" color={STYLES[1].textColor}>
                                    {Math.round(top3[1].role_fill_rate_percent)}%
                                </Text>
                            </div>
                        )}

                        {/* Small bubble */}
                        {top3[2] && (
                            <div
                                className={clsx(
                                    `absolute left-[64px] top-[84px] size-[66px] rounded-full ${STYLES[2].bubbleBg} flex items-center justify-center`,
                                    "transition-all duration-700 ease-out",
                                    bubblesVisible ? "opacity-100 scale-100" : "opacity-0 scale-50",
                                    "animate-bubble-float"
                                )}
                                style={{ transitionDelay: '300ms', animationDelay: '1s' }}
                            >
                                <Text variant="body-sm-semibold" color={STYLES[2].textColor}>
                                    {Math.round(top3[2].role_fill_rate_percent)}%
                                </Text>
                            </div>
                        )}

                    </div>
                </div>

                {/* Right side - Legend */}
                <div className="flex min-w-0 w-full flex-col gap-2.5">
                    {top3.length === 0 && (
                        <Text variant="body-sm" color="text-secondary" className="text-center py-4">No department data</Text>
                    )}
                    {top3.map((dept, index) => {
                        const s = STYLES[index % STYLES.length];
                        return (
                            <div
                                key={dept.department_name}
                                className={clsx(
                                    `${s.bgColor} flex min-w-0 items-center justify-between gap-2 rounded-[10px] w-full`,
                                    "transition-all duration-500 cursor-pointer",
                                    "hover:scale-[1.02] hover:shadow-md",
                                    legendVisible.includes(index)
                                        ? "opacity-100 translate-x-0"
                                        : "opacity-0 translate-x-4"
                                )}
                                style={{ padding: '8px 10px', transitionDelay: `${index * 100}ms` }}
                            >
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                    <div
                                        className={clsx(
                                            "size-[18px] shrink-0 rounded-full border flex items-center justify-center",
                                            "transition-transform duration-300",
                                            isHovered && "scale-110"
                                        )}
                                        style={{ borderColor: s.hexColor, borderWidth: '0.7px' }}
                                    >
                                        <div
                                            className={clsx(
                                                `size-[6px] rounded-full shadow-sm ${s.color}`,
                                                isHovered && "animate-breathe"
                                            )}
                                        />
                                    </div>
                                    <div className="flex min-w-0 flex-1 flex-col gap-0">
                                        <Text
                                            variant="body-sm"
                                            color={s.textColor}
                                            truncate
                                            title={dept.department_name}
                                            className="leading-tight"
                                        >
                                            {dept.department_name}
                                        </Text>
                                        <Text variant="body-md-semibold" color="text-primary" className="truncate leading-tight">
                                            {dept.filled_roles}/{dept.total_roles}
                                        </Text>
                                    </div>
                                </div>
                                <Text variant="body-sm-semibold" color={s.textColor} className="shrink-0 tabular-nums leading-tight">
                                    {Math.round(dept.role_fill_rate_percent)}%
                                </Text>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Role Coverage Modal */}
            <RoleCoverageModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                departments={departments}
            />
        </div>
    );
};

export default ServiceDistribution;
