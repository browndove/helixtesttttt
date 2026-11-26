"use client";

import * as React from "react";
import Text from "@/components/analytics/text";
import DashboardCard from "./dashboard-card";
import InfoTooltip from "@/components/analytics/info-tooltip";
import clsx from "clsx";

type TrendType = "up" | "down" | "neutral";

type KPICardProps = {
    title: string;
    value: string;
    subtitle: string;
    trend?: {
        type: TrendType;
        value: string;
        isPositive: boolean; // isPositive = good for the metric (decrease in safety issues)
    };
    indicator?: "active";
    infoText?: string;
};

// Parse value to extract number and format info
const parseValue = (value: string): { prefix: string; number: number; suffix: string; decimals: number } => {
    const match = value.match(/^([^\d]*)([\d,]+\.?\d*)(.*)$/);
    if (!match) return { prefix: '', number: 0, suffix: '', decimals: 0 };

    const prefix = match[1] || '';
    const numStr = match[2].replace(/,/g, '');
    const suffix = match[3] || '';
    const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0;

    return { prefix, number: parseFloat(numStr), suffix, decimals };
};

// Format number with commas
const formatNumber = (num: number, decimals: number): string => {
    if (decimals > 0) {
        return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Decrease icon (positive outcome - green, arrow going down)
const DecreaseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="7" viewBox="0 0 12 7" fill="none">
        <path d="M7.57129 6H10.7141V2.85714" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.7143 6L6.275 1.56071C6.20156 1.48873 6.10283 1.44841 6 1.44841C5.89717 1.44841 5.79844 1.48873 5.725 1.56071L3.91786 3.36786C3.84442 3.43984 3.74569 3.48016 3.64286 3.48016C3.54003 3.48016 3.44129 3.43984 3.36786 3.36786L0.5 0.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Increase icon (negative outcome - red, arrow going up)
const IncreaseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="7" viewBox="0 0 12 7" fill="none">
        <path d="M7.57129 0.5H10.7141V3.64286" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.7143 0.5L6.275 4.93929C6.20156 5.01127 6.10283 5.05159 6 5.05159C5.89717 5.05159 5.79844 5.01127 5.725 4.93929L3.91786 3.13214C3.84442 3.06016 3.74569 3.01984 3.64286 3.01984C3.54003 3.01984 3.44129 3.06016 3.36786 3.13214L0.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const KPICard: React.FC<KPICardProps> = ({ title, value, subtitle, trend, indicator, infoText }) => {
    // isPositive = good for safety (decrease) = green bg + down arrow
    // !isPositive = bad for safety (increase) = red bg + up arrow
    const trendBgColor = trend?.isPositive ? "bg-accent-green/10" : "bg-accent-red/10";
    const trendTextColor = trend?.isPositive ? "text-accent-green" : "text-accent-red";
    const [isHovered, setIsHovered] = React.useState(false);
    const [animatedNumber, setAnimatedNumber] = React.useState(0);
    const [isVisible, setIsVisible] = React.useState(false);

    const parsedValue = React.useMemo(() => parseValue(value), [value]);

    React.useEffect(() => {
        setIsVisible(true);
    }, []);

    // Animate the number counting up
    React.useEffect(() => {
        if (!isVisible) return;

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
    }, [isVisible, parsedValue.number]);

    return (
        <DashboardCard
            className="flex flex-col h-[135px] min-h-[135px] relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {infoText && isHovered && (
                <div className="absolute top-2 right-2">
                    <InfoTooltip text={infoText} />
                </div>
            )}
            {/* Header row with title and trend/indicator */}
            <div className="flex items-start justify-between pr-6">
                <div className="flex flex-col gap-[4px]">
                    <Text variant="body-md-semibold" color="text-primary">
                        {title}
                    </Text>
                </div>
                {trend && (
                    <div className={`flex items-center gap-[5px] px-[10px] py-[4px] rounded-full ${trendBgColor} ${trendTextColor}`}>
                        {/* isPositive = decrease (down arrow), !isPositive = increase (up arrow) */}
                        {trend.isPositive ? <DecreaseIcon /> : <IncreaseIcon />}
                        <span className="text-[12px] font-semibold">
                            {trend.value}
                        </span>
                    </div>
                )}
                {indicator === "active" && (
                    <div className="w-[10px] h-[10px] rounded-[2px] bg-[#00C8B3] animate-breathe" />
                )}
            </div>

            {/* Value + subtitle inline, centered */}
            <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center justify-center gap-3 text-center">
                    <span className={clsx(
                        "text-[44px] md:text-[52px] font-bold tracking-tight leading-none text-text-primary tabular-nums",
                        "transition-transform duration-300",
                        isHovered && "scale-[1.02]"
                    )}>
                        {parsedValue.prefix}{formatNumber(animatedNumber, parsedValue.decimals)}{parsedValue.suffix}
                    </span>
                    <Text variant="body-sm" color="text-secondary" className="leading-none -translate-y-[2px]">
                        {subtitle}
                    </Text>
                </div>
            </div>
        </DashboardCard>
    );
};

export default KPICard;
