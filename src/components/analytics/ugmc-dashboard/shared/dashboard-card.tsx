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
                "bg-primary rounded-[18px] border border-black/[0.08]",
                "transition-[border-color,background-color] duration-200 ease-out",
                "hover:border-black/[0.12]",
                borderColor && `border border-[${borderColor}]`,
                className
            )}
            style={{
                minWidth: 0,
                boxShadow: "none",
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
