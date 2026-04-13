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
 * Top-right frosted-glass sheet listing bulk-import row errors (staff or patients).
 * Uses `helix-mac-sheet-*` styles from globals.css.
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
        <div
            className="helix-mac-sheet-item"
            style={{
                position: 'fixed',
                top: 20,
                right: 20,
                zIndex: 10001,
                width: 'min(440px, calc(100vw - 32px))',
                maxHeight: 'min(78vh, 600px)',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <div
                role="dialog"
                aria-modal="false"
                aria-labelledby={titleId}
                aria-describedby={descId}
                aria-live="polite"
                className="helix-mac-sheet-surface"
            >
                <div className="helix-mac-sheet-header">
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                            <div id={titleId} className="helix-mac-sheet-title">
                                {title}
                            </div>
                            <p id={descId} className="helix-mac-sheet-desc">
                                {description}
                            </p>
                        </div>
                        <span className="helix-mac-sheet-badge">{errors.length}</span>
                    </div>
                    <div className="helix-mac-sheet-actions">
                        <button type="button" className="helix-mac-sheet-close" onClick={onDismiss}>
                            Close
                        </button>
                    </div>
                </div>
                <div className="helix-mac-sheet-table-wrap">
                    <table className="helix-mac-sheet-table">
                        <thead>
                            <tr>
                                <th scope="col">Row</th>
                                <th scope="col">Identifier</th>
                                <th scope="col">Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            {errors.map((err, idx) => (
                                <tr key={`err-${err.row}-${err.email}-${idx}`}>
                                    <td className="helix-mac-sheet-col-row">{err.row}</td>
                                    <td className="helix-mac-sheet-col-id">{err.email?.trim() ? err.email : '—'}</td>
                                    <td className="helix-mac-sheet-col-reason">{err.message}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
