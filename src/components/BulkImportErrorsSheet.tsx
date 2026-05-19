'use client';

export type BulkImportRowError = {
    row: number;
    email: string;
    message: string;
};

type BulkImportErrorsSheetProps = {
    errors: BulkImportRowError[];
    onDismiss: () => void;
    title: string;
    description: string;
    titleId?: string;
    descId?: string;
};

/**
 * Top-right panel for bulk-import row errors. Opaque card with list layout.
 */
export function BulkImportErrorsSheet({
    errors,
    onDismiss,
    title,
    description,
    titleId = 'bulk-import-errors-title',
    descId = 'bulk-import-errors-desc',
}: BulkImportErrorsSheetProps) {
    if (errors.length === 0) return null;

    return (
        <div className="bulk-import-errors-root" role="presentation">
            <div
                role="dialog"
                aria-modal="false"
                aria-labelledby={titleId}
                aria-describedby={descId}
                aria-live="polite"
                className="bulk-import-errors-panel"
            >
                <header className="bulk-import-errors-header">
                    <div className="bulk-import-errors-header-main">
                        <div className="bulk-import-errors-icon" aria-hidden>
                            <span className="material-icons-round">report_problem</span>
                        </div>
                        <div className="bulk-import-errors-heading">
                            <div className="bulk-import-errors-title-row">
                                <h2 id={titleId} className="bulk-import-errors-title">
                                    {title}
                                </h2>
                                <span className="bulk-import-errors-count">{errors.length}</span>
                            </div>
                            <p id={descId} className="bulk-import-errors-desc">
                                {description}
                            </p>
                        </div>
                        <button
                            type="button"
                            className="bulk-import-errors-icon-close"
                            onClick={onDismiss}
                            aria-label="Close"
                        >
                            <span className="material-icons-round">close</span>
                        </button>
                    </div>
                </header>

                <ul className="bulk-import-errors-list">
                    {errors.map((err, idx) => (
                        <li key={`err-${err.row}-${err.email}-${idx}`} className="bulk-import-errors-item">
                            <span className="bulk-import-errors-item-row">Row {err.row}</span>
                            <span className="bulk-import-errors-item-email">
                                {err.email?.trim() ? err.email : '—'}
                            </span>
                            <span className="bulk-import-errors-item-message">{err.message}</span>
                        </li>
                    ))}
                </ul>

                <footer className="bulk-import-errors-footer">
                    <button type="button" className="bulk-import-errors-dismiss" onClick={onDismiss}>
                        Dismiss
                    </button>
                </footer>
            </div>
        </div>
    );
}
