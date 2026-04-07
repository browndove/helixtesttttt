"use client";

import * as React from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import InfoTooltip from "@/components/info-tooltip";
import clsx from "clsx";

type TrendType = "up" | "down" | "neutral";

type KPICardProps = {
    title: string;
    value: string;
    subtitle: string;
    trend?: {
        type: TrendType;
        value: string;
        isPositive: boolean;
    };
    indicator?: "active";
    infoText?: string;
};

const parseValue = (value: string): { prefix: string; number: number; suffix: string; decimals: number } => {
    const match = value.match(/^([^\d]*)([\d,]+\.?\d*)(.*)$/);
    if (!match) return { prefix: '', number: 0, suffix: '', decimals: 0 };
    const prefix = match[1] || '';
    const numStr = match[2].replace(/,/g, '');
    const suffix = match[3] || '';
    const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0;
    return { prefix, number: parseFloat(numStr), suffix, decimals };
};

const formatNumber = (num: number, decimals: number): string => {
    if (decimals > 0) return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const DecreaseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="7" viewBox="0 0 12 7" fill="none">
        <path d="M7.57129 6H10.7141V2.85714" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.7143 6L6.275 1.56071C6.20156 1.48873 6.10283 1.44841 6 1.44841C5.89717 1.44841 5.79844 1.48873 5.725 1.56071L3.91786 3.36786C3.84442 3.43984 3.74569 3.48016 3.64286 3.48016C3.54003 3.48016 3.44129 3.43984 3.36786 3.36786L0.5 0.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const IncreaseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="7" viewBox="0 0 12 7" fill="none">
        <path d="M7.57129 0.5H10.7141V3.64286" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.7143 0.5L6.275 4.93929C6.20156 5.01127 6.10283 5.05159 6 5.05159C5.89717 5.05159 5.79844 5.01127 5.725 4.93929L3.91786 3.13214C3.84442 3.06016 3.74569 3.01984 3.64286 3.01984C3.54003 3.01984 3.44129 3.06016 3.36786 3.13214L0.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const KPICard: React.FC<KPICardProps> = ({ title, value, subtitle, trend, indicator, infoText }) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const [animatedNumber, setAnimatedNumber] = React.useState(0);
    const [isVisible, setIsVisible] = React.useState(false);
    const trendBgColor = trend?.isPositive ? "bg-accent-green/10" : "bg-accent-red/10";
    const trendTextColor = trend?.isPositive ? "text-accent-green" : "text-accent-red";

    const parsedValue = React.useMemo(() => parseValue(value), [value]);

    React.useEffect(() => { setIsVisible(true); }, []);

    React.useEffect(() => {
        if (!isVisible) return;
        const duration = 1200;
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setAnimatedNumber(parsedValue.number * eased);
            if (progress < 1) requestAnimationFrame(animate);
            else setAnimatedNumber(parsedValue.number);
        };
        requestAnimationFrame(animate);
    }, [isVisible, parsedValue.number]);

    return (
        <DashboardCard
            className="flex flex-col min-h-[149px] relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {infoText && isHovered && (
                <div className="absolute top-2 right-2">
                    <InfoTooltip text={infoText} />
                </div>
            )}
            <div className="flex items-start justify-between min-h-0 flex-shrink" style={{ paddingRight: 24, gap: 8 }}>
                <div className="min-w-0 flex-1" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <Text variant="body-md-semibold" color="text-primary" className="break-words leading-tight">
                        {title}
                    </Text>
                    <span className={clsx(
                        "text-[28px] font-bold tracking-tight text-text-primary break-words leading-tight tabular-nums",
                        "transition-transform duration-300",
                        isHovered && "scale-[1.02] origin-left"
                    )}>
                        {parsedValue.prefix}{formatNumber(animatedNumber, parsedValue.decimals)}{parsedValue.suffix}
                    </span>
                </div>
                <div className="shrink-0" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {trend && (
                        <div className={`flex items-center rounded-full whitespace-nowrap ${trendBgColor} ${trendTextColor}`} style={{ gap: 5, padding: '4px 10px' }}>
                            {trend.isPositive ? <IncreaseIcon /> : <DecreaseIcon />}
                            <span className="text-[12px] font-semibold">{trend.value}</span>
                        </div>
                    )}
                    {indicator === "active" && (
                        <div className="w-[10px] h-[10px] rounded-[2px] bg-[#00C8B3] animate-breathe" />
                    )}
                </div>
            </div>
            <div className="border-t-2 border-dashed border-tertiary w-full flex-shrink-0" style={{ marginTop: 28 }} />
            <Text variant="body-md" color="text-secondary" className="break-words overflow-wrap-anywhere leading-tight flex-shrink" style={{ marginTop: 12 }}>
                {subtitle}
            </Text>
        </DashboardCard>
    );
};

export default KPICard;
