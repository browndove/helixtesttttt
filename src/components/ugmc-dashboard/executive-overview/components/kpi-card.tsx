'use client';

import { useState, useEffect, useMemo } from "react";
import Text from "@/components/text";
import InfoTooltip from "@/components/info-tooltip";
import { FaArrowTrendUp, FaArrowTrendDown } from "react-icons/fa6";
import clsx from "clsx";

interface KpiCardProps {
    icon: React.ReactNode;
    iconBgColor: string;
    label: string;
    value: string;
    change?: {
        value: string;
        label: string;
        trend: 'up' | 'down';
    };
    infoText?: string;
    animationDelay?: number;
}

// Parse value to extract number and format info
const parseValue = (value: string): { prefix: string; number: number; suffix: string; decimals: number } => {
    // Match patterns like "GH₵ 28K", "1,170", "29%", etc.
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

const KpiCard = ({ icon, iconBgColor, label, value, change, infoText, animationDelay = 0 }: KpiCardProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [animatedNumber, setAnimatedNumber] = useState(0);
    const isPositive = change?.trend === 'up';

    const parsedValue = useMemo(() => parseValue(value), [value]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, animationDelay * 100);
        return () => clearTimeout(timer);
    }, [animationDelay]);

    // Animate the number counting up
    useEffect(() => {
        if (!isVisible) return;

        const duration = 1200; // Animation duration in ms
        const startTime = Date.now();
        const startDelay = animationDelay * 100;

        const timer = setTimeout(() => {
            const animate = () => {
                const elapsed = Date.now() - startTime - startDelay;
                const progress = Math.min(elapsed / duration, 1);
                // Ease out cubic for smooth deceleration
                const eased = 1 - Math.pow(1 - progress, 3);

                setAnimatedNumber(parsedValue.number * eased);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    setAnimatedNumber(parsedValue.number);
                }
            };
            requestAnimationFrame(animate);
        }, startDelay);

        return () => clearTimeout(timer);
    }, [isVisible, parsedValue.number, animationDelay]);

    return (
        <div
            className={clsx(
                "relative bg-primary rounded-[15px] shadow-soft",
                "transition-all duration-500 ease-out",
                "hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:-translate-y-1",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            )}
            style={{
                padding: 24,
                transitionDelay: `${animationDelay * 100}ms`
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex flex-col gap-3">
                {/* Top row */}
                <div className="flex items-center justify-between">
                    <div
                        className={clsx(
                            "flex items-center justify-center size-[37px] rounded-[10px]",
                            "transition-transform duration-300",
                            iconBgColor,
                            isHovered && "scale-110"
                        )}
                    >
                        <div className={clsx(
                            "transition-transform duration-500",
                            isHovered && "animate-icon-bounce"
                        )}>
                            {icon}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {change && (
                            <div className="flex items-center gap-1.5">
                                {isPositive ? (
                                    <FaArrowTrendUp className="w-3 h-3 text-accent-green" />
                                ) : (
                                    <FaArrowTrendDown className="w-3 h-3 text-accent-red" />
                                )}
                                <Text
                                    variant="body-sm-semibold"
                                    color="none"
                                    className={isPositive ? "text-accent-green" : "text-accent-red"}
                                >
                                    {change.value}
                                </Text>
                                <Text
                                    variant="body-sm-semibold"
                                    color="none"
                                    className={isPositive ? "text-accent-green" : "text-accent-red"}
                                >
                                    {change.label}
                                </Text>
                            </div>
                        )}
                        {infoText && <InfoTooltip text={infoText} show={isHovered} />}
                    </div>
                </div>

                {/* Bottom row */}
                <div className="flex flex-col gap-1">
                    <Text variant="body-sm-semibold" color="text-primary" className={clsx(
                        "transition-colors duration-300",
                        isHovered && "text-accent-primary"
                    )}>
                        {label}
                    </Text>
                    <Text
                        variant="heading-lg"
                        color="text-primary"
                        className={clsx(
                            "text-[32px] font-bold transition-transform duration-300 tabular-nums",
                            isHovered && "scale-[1.02] origin-left"
                        )}
                    >
                        {parsedValue.prefix}{formatNumber(animatedNumber, parsedValue.decimals)}{parsedValue.suffix}
                    </Text>
                </div>
            </div>

            {/* Subtle gradient overlay on hover */}
            <div
                className={clsx(
                    "absolute inset-0 rounded-[15px] pointer-events-none transition-opacity duration-500",
                    isHovered ? "opacity-100" : "opacity-0"
                )}
                style={{
                    background: "linear-gradient(135deg, rgba(41, 128, 211, 0.03) 0%, transparent 50%)"
                }}
            />
        </div>
    );
};

export default KpiCard;
