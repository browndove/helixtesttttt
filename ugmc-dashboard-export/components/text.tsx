"use client";

import { Montserrat } from "next/font/google";
import * as React from "react";
import clsx from "clsx";
import { tailwindTextColors } from "@/lib/theme-colors";

const montserrat = Montserrat({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-montserrat",
});

/* --------------------------------------------
 * Typography scale (design tokens)
 * -------------------------------------------- */
const textVariants = {
    "body-xs": "text-[10px] leading-[1.05] font-medium",
    "body-xs-semibold": "text-[10px] leading-[1.05] font-semibold",
    "body-sm": "text-xs leading-[1.05] font-medium",
    "body-sm-semibold": "text-xs leading-[1.05] font-semibold",
    "body-md": "text-sm leading-[1.05] font-medium",
    "body-md-semibold": "text-sm leading-[1.05] font-bold",
    "body-lg": "text-base leading-[1.05] font-bold",
    "body-lg-semibold": "text-base leading-[1.05] font-bold",

    "heading-sm": "text-base leading-[1.05] font-bold",
    "heading-md": "text-lg leading-[1.05] font-bold",
    "heading-lg": "text-2xl leading-[1.05] font-bold",
    "heading-xl": "text-3xl leading-[1.05] font-bold",
    "heading-2xl": "text-4xl leading-[1.05] font-bold",
    "heading-3xl": "text-5xl leading-[1.05] font-bold",
} as const;

type TextVariant = keyof typeof textVariants;

type TextColor = keyof typeof tailwindTextColors | "none";

/* --------------------------------------------
 * Polymorphic typing
 * -------------------------------------------- */
type TextProps<T extends React.ElementType> = {
    as?: T;
    variant?: TextVariant;
    color?: TextColor;
    truncate?: boolean;
    clampLines?: 1 | 2 | 3 | 4;
    className?: string;
    children: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "children">;

/* --------------------------------------------
 * Component
 * -------------------------------------------- */
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
                montserrat.variable,
                "tracking-tight",
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
