"use client";

import * as React from "react";
import Text from "@/components/analytics/text";
import clsx from "clsx";

type BadgeColor = "purple" | "teal" | "coral" | "green";

type SubscriptionCardProps = {
    badge: string;
    badgeColor: BadgeColor;
    title: string;
    /** Pill label under the title (e.g. provider name or metric context). */
    provider: string;
    /** Numeric amount for animated display (used with optional currency prefix). */
    amount?: string;
    /** Literal primary value (duration, %, em dash) — overrides currency + amount. */
    displayValue?: string;
    currency?: string;
    footerLabel?: string;
    footerValue: string;
    infoText?: string;
};

const parseValue = (value: string): { number: number; decimals: number } => {
    const numStr = value.replace(/,/g, "");
    const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
    return { number: parseFloat(numStr), decimals };
};

const formatNumber = (num: number, decimals: number): string => {
    if (decimals > 0) {
        return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const badgeGradients: Record<BadgeColor, string> = {
    purple: "linear-gradient(145deg, #6974F7 6.35%, rgba(255, 95, 87, 0.50) 93.65%)",
    teal: "linear-gradient(145deg, #00C8B3 6.35%, rgba(55, 161, 82, 0.50) 93.65%)",
    coral: "linear-gradient(145deg, #F54239 6.35%, rgba(255, 95, 87, 0.50) 93.65%)",
    green: "linear-gradient(145deg, #FF8D28 6.35%, rgba(255, 141, 40, 0.50) 93.65%)",
};

const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
    badge,
    badgeColor,
    title,
    provider,
    amount = "0",
    displayValue,
    currency = "",
    footerLabel = "Next Payment",
    footerValue,
    infoText,
}) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const [showTooltip, setShowTooltip] = React.useState(false);
    const [animatedNumber, setAnimatedNumber] = React.useState(0);
    const [isVisible, setIsVisible] = React.useState(false);

    const useNumericValue = displayValue == null;
    const parsedValue = React.useMemo(() => (useNumericValue ? parseValue(amount) : { number: 0, decimals: 0 }), [amount, useNumericValue]);

    React.useEffect(() => {
        setIsVisible(true);
    }, []);

    React.useEffect(() => {
        if (!isVisible || !useNumericValue) return;

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
    }, [isVisible, parsedValue.number, useNumericValue]);

    const InfoIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7.0005 0C8.85715 0 10.6378 0.737551 11.9506 2.0504C13.2634 3.36325 14.001 5.14385 14.001 7.0005C14.001 8.85715 13.2634 10.6378 11.9506 11.9506C10.6378 13.2634 8.85715 14.001 7.0005 14.001C5.14385 14.001 3.36325 13.2634 2.0504 11.9506C0.73755 10.6378 0 8.85715 0 7.0005C0 5.14385 0.73755 3.36325 2.0504 2.0504C3.36325 0.737551 5.14385 0 7.0005 0ZM8.0505 4.298C8.5705 4.298 8.9925 3.937 8.9925 3.402C8.9925 2.867 8.5695 2.506 8.0505 2.506C7.5305 2.506 7.1105 2.867 7.1105 3.402C7.1105 3.937 7.5305 4.298 8.0505 4.298ZM8.2335 9.925C8.2335 9.818 8.2705 9.54 8.2495 9.382L7.4275 10.328C7.2575 10.507 7.0445 10.631 6.9445 10.598C6.89913 10.5813 6.86121 10.549 6.83756 10.5068C6.81391 10.4646 6.80609 10.4154 6.8155 10.368L8.1855 6.04C8.2975 5.491 7.9895 4.99 7.3365 4.926C6.6475 4.926 5.6335 5.625 5.0165 6.512C5.0165 6.618 4.9965 6.882 5.0175 7.04L5.8385 6.093C6.0085 5.916 6.2065 5.791 6.3065 5.825C6.35577 5.84268 6.39614 5.87898 6.41895 5.92609C6.44176 5.97321 6.44519 6.02739 6.4285 6.077L5.0705 10.384C4.9135 10.888 5.2105 11.382 5.9305 11.494C6.9905 11.494 7.6165 10.812 8.2345 9.925H8.2335Z" fill="var(--text-tertiary)" />
        </svg>
    );

    const tooltipContent =
        infoText || `${title}. ${provider}. ${footerLabel}: ${footerValue}.`;

    const primaryDisplay = useNumericValue
        ? `${currency ? `${currency} ` : ""}${formatNumber(animatedNumber, parsedValue.decimals)}`
        : displayValue;

    return (
        <div
            className={clsx(
                "bg-primary rounded-[18px] border border-black/[0.08] p-4 flex flex-col gap-2 min-w-[200px] flex-1 relative",
                "transition-all duration-300",
                ""
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                setShowTooltip(false);
            }}
        >
            {isHovered && infoText && (
                <div className="absolute top-3 right-3">
                    <button
                        onMouseEnter={() => setShowTooltip(true)}
                        onMouseLeave={() => setShowTooltip(false)}
                        className="p-[4px] rounded-[6px] hover:bg-secondary transition-colors"
                        title="Info"
                    >
                        <InfoIcon />
                    </button>
                    {showTooltip && (
                        <div className="absolute right-0 top-full mt-2 w-[220px] bg-[#1A1D29] text-white text-xs rounded-[8px] p-3 z-50 shadow-lg">
                            {tooltipContent}
                            <div className="absolute right-4 -top-1 w-2 h-2 bg-[#1A1D29] rotate-45" />
                        </div>
                    )}
                </div>
            )}
            <div className="flex items-start gap-3">
                <div
                    className={clsx(
                        "w-10 h-10 rounded-[10px] flex items-center justify-center text-white font-semibold text-sm shadow-[0_4px_20.2px_0_rgba(0,0,0,0.24)]",
                        "transition-transform duration-300",
                        isHovered && "scale-110"
                    )}
                    style={{ background: badgeGradients[badgeColor] }}
                >
                    {badge}
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                    <Text variant="body-md-semibold" color="text-primary" className="truncate">
                        {title}
                    </Text>
                    <span className="inline-flex max-w-full truncate px-2 py-0.5 rounded-[6px] bg-accent-primary/10 text-[11px] font-medium w-fit text-accent-primary">
                        {provider}
                    </span>
                </div>
            </div>
            <div className="mt-1 flex flex-col gap-2">
                <span
                    className={clsx(
                        "text-[28px] font-bold tracking-tight text-text-primary tabular-nums",
                        "transition-transform duration-300",
                        isHovered && "scale-[1.02] origin-left"
                    )}
                >
                    {primaryDisplay}
                </span>
                <div className="border-t-2 border-dashed border-tertiary w-full" />
            </div>
            <div className="mt-auto flex items-center justify-between gap-2">
                <Text variant="body-sm" color="text-tertiary" className="shrink-0">
                    {footerLabel}
                </Text>
                <Text variant="body-sm-semibold" color="text-primary" className="truncate text-right">
                    {footerValue}
                </Text>
            </div>
        </div>
    );
};

export default SubscriptionCard;
