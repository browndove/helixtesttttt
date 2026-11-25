"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 14 14" fill="none">
        <path
            d="M7.0005 0C8.85715 0 10.6378 0.737551 11.9506 2.0504C13.2634 3.36325 14.001 5.14385 14.001 7.0005C14.001 8.85715 13.2634 10.6378 11.9506 11.9506C10.6378 13.2634 8.85715 14.001 7.0005 14.001C5.14385 14.001 3.36325 13.2634 2.0504 11.9506C0.73755 10.6378 0 8.85715 0 7.0005C0 5.14385 0.73755 3.36325 2.0504 2.0504C3.36325 0.737551 5.14385 0 7.0005 0ZM8.0505 4.298C8.5705 4.298 8.9925 3.937 8.9925 3.402C8.9925 2.867 8.5695 2.506 8.0505 2.506C7.5305 2.506 7.1105 2.867 7.1105 3.402C7.1105 3.937 7.5305 4.298 8.0505 4.298ZM8.2335 9.925C8.2335 9.818 8.2705 9.54 8.2495 9.382L7.4275 10.328C7.2575 10.507 7.0445 10.631 6.9445 10.598C6.89913 10.5813 6.86121 10.549 6.83756 10.5068C6.81391 10.4646 6.80609 10.4154 6.8155 10.368L8.1855 6.04C8.2975 5.491 7.9895 4.99 7.3365 4.926C6.6475 4.926 5.6335 5.625 5.0165 6.512C5.0165 6.618 4.9965 6.882 5.0175 7.04L5.8385 6.093C6.0085 5.916 6.2065 5.791 6.3065 5.825C6.35577 5.84268 6.39614 5.87898 6.41895 5.92609C6.44176 5.97321 6.44519 6.02739 6.4285 6.077L5.0705 10.384C4.9135 10.888 5.2105 11.382 5.9305 11.494C6.9905 11.494 7.6165 10.812 8.2345 9.925H8.2335Z"
            fill="currentColor"
        />
    </svg>
);

interface InfoTooltipProps {
    text: string;
    show?: boolean;
}

const GAP = 6;
const MARGIN = 8;
const STAT_LINE = /^([A-Za-z][A-Za-z0-9 /%+-]{0,24}):\s+(.+)$/;

function parseTooltipContent(text: string): { summary: string; stats: { label: string; value: string }[] } {
    const prose: string[] = [];
    const stats: { label: string; value: string }[] = [];

    for (const raw of text.split("\n")) {
        const line = raw.trim();
        if (!line) continue;
        const match = line.match(STAT_LINE);
        if (match) {
            stats.push({ label: match[1], value: match[2] });
        } else {
            prose.push(line);
        }
    }

    return {
        summary: prose.join(" ").replace(/\s+/g, " ").trim(),
        stats,
    };
}

/** Prefer a short lead sentence when the card already shows the metric name. */
function shortenSummary(summary: string): string {
    if (!summary) return "";
    // Drop the redundant "Middle 50%…" clause — the Q1/Q3 rows already say that.
    return summary
        .replace(/\s*Middle 50% fell between Q1 and Q3\.?/i, "")
        .replace(/\s+/g, " ")
        .trim();
}

const InfoTooltip = ({ text, show = true }: InfoTooltipProps) => {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const tipRef = useRef<HTMLDivElement>(null);
    const [anchor, setAnchor] = useState<DOMRect | null>(null);
    const [placement, setPlacement] = useState<{ top: number; right: number } | null>(null);

    const content = useMemo(() => {
        const parsed = parseTooltipContent(text);
        return {
            summary: shortenSummary(parsed.summary),
            stats: parsed.stats,
        };
    }, [text]);

    const hasStats = content.stats.length > 0;
    const useStatGrid = content.stats.length >= 4;

    const open = () => {
        const rect = buttonRef.current?.getBoundingClientRect();
        if (rect) setAnchor(rect);
    };
    const close = useCallback(() => {
        setAnchor(null);
        setPlacement(null);
    }, []);

    useLayoutEffect(() => {
        if (!anchor || !tipRef.current) return;
        const height = tipRef.current.offsetHeight;
        const width = tipRef.current.offsetWidth;
        const fitsBelow = anchor.bottom + GAP + height <= window.innerHeight - MARGIN;
        const top = fitsBelow ? anchor.bottom + GAP : Math.max(MARGIN, anchor.top - GAP - height);
        const preferredRight = window.innerWidth - anchor.right;
        const right = Math.min(
            Math.max(MARGIN, preferredRight),
            Math.max(MARGIN, window.innerWidth - width - MARGIN)
        );
        setPlacement({ top, right });
    }, [anchor, text]);

    useEffect(() => {
        if (!anchor) return;
        window.addEventListener("scroll", close, true);
        window.addEventListener("resize", close);
        return () => {
            window.removeEventListener("scroll", close, true);
            window.removeEventListener("resize", close);
        };
    }, [anchor, close]);

    if (!show) return null;

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                onMouseEnter={open}
                onMouseLeave={close}
                onFocus={open}
                onBlur={close}
                aria-label="More information"
                className="flex size-6 items-center justify-center rounded-full text-[#86868b] transition-colors hover:bg-black/[0.05] hover:text-[#1d1d1f]"
            >
                <InfoIcon />
            </button>
            {anchor &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={tipRef}
                        role="tooltip"
                        className="fixed z-[100] w-[200px] max-w-[min(200px,calc(100vw-1rem))] rounded-[8px] border border-black/[0.08] bg-[#f5f5f7] text-[#1d1d1f] shadow-[0_2px_12px_rgba(0,0,0,0.1)]"
                        style={{
                            top: placement?.top ?? anchor.bottom + GAP,
                            right: placement?.right ?? Math.max(MARGIN, window.innerWidth - anchor.right),
                            visibility: placement ? "visible" : "hidden",
                            colorScheme: "light",
                        }}
                    >
                        <div className="px-2.5 py-2">
                            {content.summary ? (
                                <p className="text-[11px] font-normal leading-[1.25] tracking-[-0.01em] text-[#6e6e73]">
                                    {content.summary}
                                </p>
                            ) : null}

                            {hasStats && useStatGrid ? (
                                <div
                                    className={
                                        content.summary
                                            ? "mt-1.5 grid grid-cols-3 gap-x-2 gap-y-1.5 border-t border-black/[0.06] pt-1.5"
                                            : "grid grid-cols-3 gap-x-2 gap-y-1.5"
                                    }
                                >
                                    {content.stats.map((stat) => {
                                        const emphasize = /median/i.test(stat.label);
                                        return (
                                            <div key={stat.label} className="min-w-0">
                                                <div className="text-[9px] font-medium uppercase tracking-[0.04em] text-[#86868b]">
                                                    {stat.label}
                                                </div>
                                                <div
                                                    className={
                                                        emphasize
                                                            ? "mt-0.5 truncate text-[12px] font-semibold tabular-nums tracking-[-0.02em] text-[#1d1d1f]"
                                                            : "mt-0.5 truncate text-[12px] font-medium tabular-nums tracking-[-0.02em] text-[#1d1d1f]"
                                                    }
                                                    title={stat.value}
                                                >
                                                    {stat.value}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : null}

                            {hasStats && !useStatGrid ? (
                                <dl
                                    className={
                                        content.summary
                                            ? "mt-1.5 space-y-0.5 border-t border-black/[0.06] pt-1.5"
                                            : "space-y-0.5"
                                    }
                                >
                                    {content.stats.map((stat) => (
                                        <div key={stat.label} className="flex items-baseline justify-between gap-3">
                                            <dt className="text-[11px] text-[#6e6e73]">{stat.label}</dt>
                                            <dd className="text-[11px] font-semibold tabular-nums tracking-[-0.02em] text-[#1d1d1f]">
                                                {stat.value}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            ) : null}

                            {!hasStats && !content.summary ? (
                                <p className="text-[11px] leading-[1.25] text-[#6e6e73]">{text}</p>
                            ) : null}
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default InfoTooltip;
