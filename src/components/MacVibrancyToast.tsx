'use client';

import { useCallback, useRef, type PointerEvent, type ReactNode } from 'react';

export type MacVibrancyToastVariant = 'success' | 'error' | 'info';

export function macToastLeading(variant: MacVibrancyToastVariant) {
    const icon = variant === 'error' ? 'error_outline' : variant === 'success' ? 'check_circle' : 'info';
    const color =
        variant === 'error' ? 'var(--critical)' : variant === 'success' ? 'var(--success)' : 'var(--helix-primary)';
    return (
        <span className="material-icons-round" style={{ fontSize: 18, color }} aria-hidden>
            {icon}
        </span>
    );
}

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
    /** Plain white background (no frosted glass) for readability over busy UIs. */
    opaque?: boolean;
    /** Extra lines shown under the headline (e.g. bulk import row errors). */
    details?: string[];
    /** Wider toast for error lists. */
    wide?: boolean;
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
    opaque = false,
    details,
    wide = false,
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
            className={['helix-mac-toast-item', wide ? 'helix-mac-toast-item--wide' : ''].filter(Boolean).join(' ')}
            style={{ touchAction: 'pan-y' }}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onPointerLeave={onPointerCancel}
        >
            <div
                role="alert"
                aria-live="polite"
                className={[
                    'helix-mac-toast-surface',
                    `helix-mac-toast-surface--${variant}`,
                    opaque ? 'helix-mac-toast-surface--solid' : '',
                ]
                    .filter(Boolean)
                    .join(' ')}
            >
                {leading ? (
                    <div className="helix-mac-toast-leading" aria-hidden>
                        {leading}
                    </div>
                ) : (
                    <div className="helix-mac-toast-accent" aria-hidden />
                )}
                <div className="helix-mac-toast-body">
                    <div className="helix-mac-toast-message">{message}</div>
                    {details && details.length > 0 ? (
                        <ul className="helix-mac-toast-details">
                            {details.map((line, i) => (
                                <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
                            ))}
                        </ul>
                    ) : null}
                </div>
                {showDismiss ? (
                    <button type="button" className="helix-mac-toast-dismiss" onClick={onDismiss} aria-label="Dismiss">
                        Dismiss
                    </button>
                ) : null}
            </div>
        </div>
    );
}
