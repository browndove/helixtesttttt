"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

interface FullscreenOverlayProps {
    children: ReactNode;
    onClose: () => void;
    panelClassName?: string;
    backdropClassName?: string;
}

const FullscreenOverlay = ({ children, onClose, panelClassName, backdropClassName }: FullscreenOverlayProps) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    if (!mounted) return null;

    return createPortal(
        <div
            className={clsx(
                "fixed inset-0 z-100 bg-text-primary/5 backdrop-blur-sm p-4 flex items-center justify-center",
                "animate-fade-in-up",
                backdropClassName,
            )}
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            {children}
        </div>,
        document.body,
    );
};

export default FullscreenOverlay;
