"use client";

import * as React from "react";
import clsx from "clsx";
import { tailwindTextColors } from "@/lib/analytics/theme-colors";

/* --------------------------------------------
 * Typography scale — Apple rhythm, Helix colors
 * Weight ladder: 300 / 400 / 600 (no 500, sparse 700)
 * Body at 17px; display with tight tracking
 * -------------------------------------------- */
const textVariants = {
    "body-xs": "text-[12px] leading-[1.3] font-normal tracking-[-0.01em]",
    "body-xs-semibold": "text-[12px] leading-[1.3] font-semibold tracking-[-0.01em]",
    "body-sm": "text-[14px] leading-[1.43] font-normal tracking-[-0.016em]",
    "body-sm-semibold": "text-[14px] leading-[1.29] font-semibold tracking-[-0.016em]",
    "body-md": "text-[17px] leading-[1.47] font-normal tracking-[-0.022em]",
    "body-md-semibold": "text-[17px] leading-[1.24] font-semibold tracking-[-0.022em]",
    "body-lg": "text-[21px] leading-[1.19] font-semibold tracking-[0.01em]",
    "body-lg-semibold": "text-[21px] leading-[1.19] font-semibold tracking-[0.01em]",

    "heading-sm": "text-[21px] leading-[1.19] font-semibold tracking-[0.01em]",
    "heading-md": "text-[28px] leading-[1.14] font-normal tracking-[0.007em]",
    "heading-lg": "text-[34px] leading-[1.1] font-semibold tracking-[-0.01em]",
    "heading-xl": "text-[40px] leading-[1.1] font-semibold tracking-tight",
    "heading-2xl": "text-[48px] leading-[1.07] font-semibold tracking-[-0.02em]",
    "heading-3xl": "text-[56px] leading-[1.07] font-semibold tracking-[-0.02em]",
} as const;

type TextVariant = keyof typeof textVariants;

type TextColor = keyof typeof tailwindTextColors | "none";

type TextProps<T extends React.ElementType> = {
    as?: T;
    variant?: TextVariant;
    color?: TextColor;
    truncate?: boolean;
    clampLines?: 1 | 2 | 3 | 4;
    className?: string;
    children: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "children">;

function Text<T extends React.ElementType = "span">({
    as,
    variant = "body-sm",
    color = "text-primary",
    truncate = false,
    clampLines,
    className,
    children,
    ...props
}: TextProps<T>) {
    const Component = as || "span";

    return (
        <Component
            className={clsx(
                "font-[family-name:var(--font-sans)] antialiased",
                textVariants[variant],
                color !== "none" && tailwindTextColors[color],
                truncate && "truncate",
                clampLines && `line-clamp-${clampLines}`,
                className
            )}
            {...props}
        >
            {children}
        </Component>
    );
}

export default Text;
