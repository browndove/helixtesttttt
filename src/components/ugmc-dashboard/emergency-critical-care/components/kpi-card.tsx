"use client";

import * as React from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import InfoTooltip from "@/components/info-tooltip";
import clsx from "clsx";

type KPICardProps = {
    title: string;
    value: string;
    subtitle: string;
    icon: "clinician" | "leftBefore" | "boarders" | "disposition";
    valueColor?: string;
    infoText?: string;
};

// Parse value to extract number and format info
const parseValue = (value: string): { prefix: string; number: number; suffix: string; decimals: number; hasRatio: boolean } => {
    // Check for ratio format like "1 : 3.75"
    if (value.includes(':')) {
        return { prefix: '', number: 0, suffix: '', decimals: 0, hasRatio: true };
    }
    
    const match = value.match(/^([^\d]*)([\d,]+\.?\d*)(.*)$/);
    if (!match) return { prefix: '', number: 0, suffix: '', decimals: 0, hasRatio: false };
    
    const prefix = match[1] || '';
    const numStr = match[2].replace(/,/g, '');
    const suffix = match[3] || '';
    const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0;
    
    return { prefix, number: parseFloat(numStr), suffix, decimals, hasRatio: false };
};

// Format number with commas
const formatNumber = (num: number, decimals: number): string => {
    if (decimals > 0) {
        return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Custom SVG icons for each KPI type
const ClinicianIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="16" viewBox="0 0 14 16" fill="none">
        <path d="M7 8C8.06087 8 9.07828 7.57857 9.82843 6.82843C10.5786 6.07828 11 5.06087 11 4C11 2.93913 10.5786 1.92172 9.82843 1.17157C9.07828 0.421427 8.06087 0 7 0C5.93913 0 4.92172 0.421427 4.17157 1.17157C3.42143 1.92172 3 2.93913 3 4C3 5.06087 3.42143 6.07828 4.17157 6.82843C4.92172 7.57857 5.93913 8 7 8ZM4 9.725C1.6875 10.4031 0 12.5406 0 15.0719C0 15.5844 0.415625 16 0.928125 16H13.0719C13.5844 16 14 15.5844 14 15.0719C14 12.5406 12.3125 10.4031 10 9.725V11.3125C10.8625 11.5344 11.5 12.3188 11.5 13.25V14.5C11.5 14.775 11.275 15 11 15H10.5C10.225 15 10 14.775 10 14.5C10 14.225 10.225 14 10.5 14V13.25C10.5 12.6969 10.0531 12.25 9.5 12.25C8.94687 12.25 8.5 12.6969 8.5 13.25V14C8.775 14 9 14.225 9 14.5C9 14.775 8.775 15 8.5 15H8C7.725 15 7.5 14.775 7.5 14.5V13.25C7.5 12.3188 8.1375 11.5344 9 11.3125V9.52812C8.8125 9.50937 8.62188 9.5 8.42813 9.5H5.57188C5.37813 9.5 5.1875 9.50937 5 9.52812V11.5719C5.72188 11.7875 6.25 12.4563 6.25 13.25C6.25 14.2156 5.46562 15 4.5 15C3.53437 15 2.75 14.2156 2.75 13.25C2.75 12.4563 3.27813 11.7875 4 11.5719V9.725ZM4.5 14C4.69891 14 4.88968 13.921 5.03033 13.7803C5.17098 13.6397 5.25 13.4489 5.25 13.25C5.25 13.0511 5.17098 12.8603 5.03033 12.7197C4.88968 12.579 4.69891 12.5 4.5 12.5C4.30109 12.5 4.11032 12.579 3.96967 12.7197C3.82902 12.8603 3.75 13.0511 3.75 13.25C3.75 13.4489 3.82902 13.6397 3.96967 13.7803C4.11032 13.921 4.30109 14 4.5 14Z" fill="var(--accent-primary)" />
    </svg>
);

const LeftBeforeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M15.833 5.83333H9.16634V11.6667H2.49967V4.16666H0.833008V16.6667H2.49967V14.1667H17.4997V16.6667H19.1663V9.16666C19.1663 8.28261 18.8152 7.43476 18.19 6.80964C17.5649 6.18452 16.7171 5.83333 15.833 5.83333ZM5.83301 10.8333C6.49605 10.8333 7.13193 10.5699 7.60078 10.1011C8.06962 9.63226 8.33301 8.99637 8.33301 8.33333C8.33301 7.67029 8.06962 7.0344 7.60078 6.56556C7.13193 6.09672 6.49605 5.83333 5.83301 5.83333C5.16997 5.83333 4.53408 6.09672 4.06524 6.56556C3.5964 7.0344 3.33301 7.67029 3.33301 8.33333C3.33301 8.99637 3.5964 9.63226 4.06524 10.1011C4.53408 10.5699 5.16997 10.8333 5.83301 10.8333Z" fill="var(--accent-primary)" />
    </svg>
);

const BoardersIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M12 10V8H7V6H12V4L15 7L12 10ZM11 9V13H6V16L0 13V0H11V5H10V1H2L6 3V12H10V9H11Z" fill="var(--accent-primary)" />
    </svg>
);

const DispositionIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="21" height="22" viewBox="0 0 21 22" fill="none">
        <path d="M16.6513 6.77416L17.8938 5.4725C17.5 5.005 17.1063 4.58333 16.66 4.18L15.4175 5.5C14.0613 4.345 12.355 3.66666 10.5 3.66666C8.41142 3.66666 6.40838 4.53586 4.93153 6.08303C3.45469 7.63021 2.625 9.72863 2.625 11.9167C2.625 14.1047 3.45469 16.2031 4.93153 17.7503C6.40838 19.2975 8.41142 20.1667 10.5 20.1667C14.875 20.1667 18.375 16.4725 18.375 11.9167C18.375 9.97333 17.7275 8.18583 16.6513 6.77416ZM11.375 12.8333H9.625V6.41666H11.375V12.8333ZM13.125 0.916664H7.875V2.75H13.125V0.916664Z" fill="var(--accent-primary)" />
    </svg>
);

const iconMap = {
    clinician: ClinicianIcon,
    leftBefore: LeftBeforeIcon,
    boarders: BoardersIcon,
    disposition: DispositionIcon,
};



const KPICard: React.FC<KPICardProps> = ({ title, value, subtitle, icon, valueColor = "var(--text-primary)", infoText }) => {
    const IconComponent = iconMap[icon];
    const [isHovered, setIsHovered] = React.useState(false);
    const [animatedNumber, setAnimatedNumber] = React.useState(0);
    const [isVisible, setIsVisible] = React.useState(false);
    
    const parsedValue = React.useMemo(() => parseValue(value), [value]);

    React.useEffect(() => {
        setIsVisible(true);
    }, []);

    // Animate the number counting up (skip for ratio values)
    React.useEffect(() => {
        if (!isVisible || parsedValue.hasRatio) return;
        
        const duration = 1200;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            setAnimatedNumber(parsedValue.number * eased);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setAnimatedNumber(parsedValue.number);
            }
        };
        requestAnimationFrame(animate);
    }, [isVisible, parsedValue.number, parsedValue.hasRatio]);

    return (
        <DashboardCard
            className="flex flex-col h-[155px] min-h-[155px] relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {infoText && isHovered && (
                <div className="absolute top-2 right-2">
                    <InfoTooltip text={infoText} />
                </div>
            )}
            {/* Top section: Title + Icon */}
            <div className="flex items-start justify-between pr-[12px]">
                <Text variant="body-md-semibold" color="text-secondary">
                    {title}
                </Text>
                <div className={clsx(
                    "w-10 h-10 rounded-[10px] bg-accent-primary/10 flex items-center justify-center flex-shrink-0",
                    "transition-transform duration-300",
                    isHovered && "scale-110"
                )}>
                    <IconComponent />
                </div>
            </div>

            {/* Value - close to title */}
            <span
                className={clsx(
                    "text-[35px] font-bold tracking-tight leading-none mt-2 tabular-nums",
                    "transition-transform duration-300",
                    isHovered && "scale-[1.02] origin-left"
                )}
                style={{ color: valueColor }}
            >
                {parsedValue.hasRatio 
                    ? value 
                    : `${parsedValue.prefix}${formatNumber(animatedNumber, parsedValue.decimals)}${parsedValue.suffix}`
                }
            </span>

            {/* Dashed line - with spacing */}
            <div className="border-t-2 border-dashed border-tertiary w-full mt-4" />

            {/* Subtitle - with spacing */}
            <Text variant="body-sm" color="text-secondary" className="mt-3">
                {subtitle}
            </Text>
        </DashboardCard>
    );
};

export default KPICard;
