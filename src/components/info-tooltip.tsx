'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7.0005 0C8.85715 0 10.6378 0.737551 11.9506 2.0504C13.2634 3.36325 14.001 5.14385 14.001 7.0005C14.001 8.85715 13.2634 10.6378 11.9506 11.9506C10.6378 13.2634 8.85715 14.001 7.0005 14.001C5.14385 14.001 3.36325 13.2634 2.0504 11.9506C0.73755 10.6378 0 8.85715 0 7.0005C0 5.14385 0.73755 3.36325 2.0504 2.0504C3.36325 0.737551 5.14385 0 7.0005 0ZM8.0505 4.298C8.5705 4.298 8.9925 3.937 8.9925 3.402C8.9925 2.867 8.5695 2.506 8.0505 2.506C7.5305 2.506 7.1105 2.867 7.1105 3.402C7.1105 3.937 7.5305 4.298 8.0505 4.298ZM8.2335 9.925C8.2335 9.818 8.2705 9.54 8.2495 9.382L7.4275 10.328C7.2575 10.507 7.0445 10.631 6.9445 10.598C6.89913 10.5813 6.86121 10.549 6.83756 10.5068C6.81391 10.4646 6.80609 10.4154 6.8155 10.368L8.1855 6.04C8.2975 5.491 7.9895 4.99 7.3365 4.926C6.6475 4.926 5.6335 5.625 5.0165 6.512C5.0165 6.618 4.9965 6.882 5.0175 7.04L5.8385 6.093C6.0085 5.916 6.2065 5.791 6.3065 5.825C6.35577 5.84268 6.39614 5.87898 6.41895 5.92609C6.44176 5.97321 6.44519 6.02739 6.4285 6.077L5.0705 10.384C4.9135 10.888 5.2105 11.382 5.9305 11.494C6.9905 11.494 7.6165 10.812 8.2345 9.925H8.2335Z" fill="currentColor" />
    </svg>
);

interface InfoTooltipProps {
    text: string;
    show?: boolean;
}

function parseSections(text: string): Array<{ title?: string; body: string }> {
    return text
        .split(/\n{2,}/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
            const newline = part.indexOf('\n');
            if (newline > 0 && newline < 48) {
                return { title: part.slice(0, newline).trim(), body: part.slice(newline + 1).trim() };
            }
            return { body: part };
        });
}

const InfoTooltip = ({ text, show = true }: InfoTooltipProps) => {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 360 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const closeTimer = useRef<number | null>(null);

    useEffect(() => {
        setMounted(true);
        return () => {
            if (closeTimer.current) window.clearTimeout(closeTimer.current);
        };
    }, []);

    const clearClose = () => {
        if (closeTimer.current) {
            window.clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }
    };

    const scheduleClose = () => {
        clearClose();
        closeTimer.current = window.setTimeout(() => setOpen(false), 120);
    };

    useLayoutEffect(() => {
        if (!open || !buttonRef.current) return;

        const place = () => {
            const anchor = buttonRef.current?.getBoundingClientRect();
            if (!anchor) return;
            const width = Math.min(360, window.innerWidth - 24);
            const padding = 12;
            const panelHeight = panelRef.current?.offsetHeight || 220;
            let left = anchor.right - width;
            if (left < padding) left = padding;
            if (left + width > window.innerWidth - padding) {
                left = window.innerWidth - width - padding;
            }
            let top = anchor.bottom + 8;
            if (top + panelHeight > window.innerHeight - padding) {
                top = Math.max(padding, anchor.top - panelHeight - 8);
            }
            setCoords({ top, left, width });
        };

        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => {
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [open, text]);

    if (!show) return null;

    const sections = parseSections(text);

    return (
        <div className="relative shrink-0">
            <button
                ref={buttonRef}
                type="button"
                onMouseEnter={() => {
                    clearClose();
                    setOpen(true);
                }}
                onMouseLeave={scheduleClose}
                onFocus={() => {
                    clearClose();
                    setOpen(true);
                }}
                onBlur={scheduleClose}
                className="p-1 rounded-md hover:bg-secondary transition-colors text-text-tertiary hover:text-text-secondary"
                aria-label="Metric definition"
            >
                <InfoIcon />
            </button>
            {mounted && open && createPortal(
                <div
                    ref={panelRef}
                    role="tooltip"
                    className="downloads-info-tooltip"
                    style={{ top: coords.top, left: coords.left, width: coords.width }}
                    onMouseEnter={clearClose}
                    onMouseLeave={scheduleClose}
                >
                    {sections.map((section, index) => (
                        <div key={`${section.title || 'body'}-${index}`} className="downloads-info-tooltip__section">
                            {section.title && <p className="downloads-info-tooltip__kicker">{section.title}</p>}
                            <p className="downloads-info-tooltip__body">{section.body}</p>
                        </div>
                    ))}
                </div>,
                document.body,
            )}
        </div>
    );
};

export default InfoTooltip;
