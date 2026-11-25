"use client";

import * as React from "react";
import clsx from "clsx";

type DashboardCardProps = {
    children: React.ReactNode;
    className?: string;
    padding?: "none" | "sm" | "md" | "lg";
    borderColor?: string;
} & React.HTMLAttributes<HTMLDivElement>;

const paddingClasses = {
    none: "",
    sm: "p-3",
    md: "p-4",
    lg: "p-5",
};

const DashboardCard: React.FC<DashboardCardProps> = ({
    children,
    className,
    padding = "md",
    borderColor,
    style,
    ...rest
}) => {
    return (
        <div
            {...rest}
            className={clsx(
                "bg-primary rounded-[18px] border border-black/[0.08]",
                "transition-[border-color,background-color] duration-200 ease-out",
                "hover:border-black/[0.12]",
                paddingClasses[padding],
                borderColor && `border border-[${borderColor}]`,
                className
            )}
            style={{ boxShadow: "none", ...(borderColor ? { ...(style || {}), borderColor } : style) }}
        >
            {children}
        </div>
    );
};

export default DashboardCard;
