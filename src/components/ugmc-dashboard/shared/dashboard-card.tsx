"use client";

import * as React from "react";
import clsx from "clsx";

type DashboardCardProps = {
    children: React.ReactNode;
    className?: string;
    padding?: "none" | "sm" | "md" | "lg";
    borderColor?: string;
} & React.HTMLAttributes<HTMLDivElement>;

const paddingValues: Record<string, number> = {
    none: 0,
    sm: 12,
    md: 16,
    lg: 20,
};

const DashboardCard: React.FC<DashboardCardProps> = ({
    children,
    className,
    padding = "md",
    borderColor,
    style,
    ...rest
}) => {
    const inlinePadding = padding !== "none" ? paddingValues[padding] : undefined;
    return (
        <div
            {...rest}
            className={clsx(
                "bg-primary rounded-[15px] shadow-soft",
                "transition-all duration-300 ease-out",
                "hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:-translate-y-0.5",
                borderColor && `border border-[${borderColor}]`,
                className
            )}
            style={{
                minWidth: 0,
                ...(style || {}),
                ...(inlinePadding !== undefined ? { padding: inlinePadding } : {}),
                ...(borderColor ? { borderColor } : {}),
            }}
        >
            {children}
        </div>
    );
};

export default DashboardCard;
