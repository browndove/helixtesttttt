'use client';

import { useCallback, useRef, type PointerEvent, type ReactNode } from 'react';

export type MacVibrancyToastVariant = 'success' | 'error' | 'info';

/** Fixed top-right anchor; use `column-reverse` so newer items render toward the top visually when multiple children exist. */
export function MacVibrancyToastPortal({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={['helix-mac-toast-portal', className].filter(Boolean).join(' ')}>{children}</div>;
}

/** Same as portal; use when stacking multiple notifications (max 5 visible via CSS). */
export function MacVibrancyToastStack({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={['helix-mac-toast-stack', className].filter(Boolean).join(' ')}>{children}</div>;
}

type MacVibrancyToastProps = {
    message: string;
    variant?: MacVibrancyToastVariant;
    onDismiss?: () => void;
    /** When false, no dismiss control (e.g. auto-clearing toasts). */
    dismissible?: boolean;
    /** Optional leading content (icon); default is accent strip only. */
    leading?: ReactNode;
};

/**
 * macOS-style vibrancy: frosted glass, soft shadow, slide-in from right.
 * Pair with {@link MacVibrancyToastPortal} for positioning and stacking.
 */
export function MacVibrancyToast({
    message,
    variant = 'info',
    onDismiss,
    dismissible = true,
    leading,
}: MacVibrancyToastProps) {
    const showDismiss = dismissible && typeof onDismiss === 'function';
    const swipeStartX = useRef<number | null>(null);

    const onPointerDown = useCallback(
        (e: PointerEvent<HTMLDivElement>) => {
            if (!showDismiss) return;
            swipeStartX.current = e.clientX;
        },
        [showDismiss]
    );

    const onPointerUp = useCallback(
        (e: PointerEvent<HTMLDivElement>) => {
            if (!showDismiss || !onDismiss || swipeStartX.current == null) return;
            const dx = e.clientX - swipeStartX.current;
            swipeStartX.current = null;
            if (dx > 52) onDismiss();
        },
        [showDismiss, onDismiss]
    );

    const onPointerCancel = useCallback(() => {
        swipeStartX.current = null;
    }, []);

    return (
        <div
            className="helix-mac-toast-item"
            style={{ touchAction: 'pan-y' }}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onPointerLeave={onPointerCancel}
        >
            <div
                role="alert"
                aria-live="polite"
                className={`helix-mac-toast-surface helix-mac-toast-surface--${variant}`}
            >
                {leading ? (
                    <div className="helix-mac-toast-leading" aria-hidden>
                        {leading}
                    </div>
                ) : (
                    <div className="helix-mac-toast-accent" aria-hidden />
                )}
                <div className="helix-mac-toast-body">{message}</div>
                {showDismiss ? (
                    <button type="button" className="helix-mac-toast-dismiss" onClick={onDismiss} aria-label="Dismiss">
                        Dismiss
                    </button>
                ) : null}
            </div>
        </div>
    );
}
