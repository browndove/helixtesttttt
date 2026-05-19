export type BulkImportToastError = {
    row: number;
    email: string;
    message: string;
};

/** One line per failed row for display inside a toast. */
export function formatBulkImportErrorLines(errors: BulkImportToastError[], maxLines = 12): string[] {
    const lines = errors.slice(0, maxLines).map((e) => {
        const row = e.row > 0 ? `Row ${e.row}` : 'Row ?';
        const id = e.email?.trim() || '—';
        const reason = e.message?.trim() || 'Unknown error';
        return `${row} · ${id} — ${reason}`;
    });
    if (errors.length > maxLines) {
        lines.push(`…and ${errors.length - maxLines} more`);
    }
    return lines;
}

export function bulkImportToastHeadline(created: number, errorCount: number): string {
    if (created > 0 && errorCount > 0) {
        return `${created} added · ${errorCount} row(s) failed`;
    }
    if (created > 0) {
        return `Imported ${created} staff member(s)`;
    }
    if (errorCount > 0) {
        return `No rows imported · ${errorCount} issue${errorCount === 1 ? '' : 's'}`;
    }
    return 'Bulk import completed';
}

export function patientBulkImportToastHeadline(created: number, errorCount: number): string {
    if (created > 0 && errorCount > 0) {
        return `${created} added · ${errorCount} row(s) failed`;
    }
    if (created > 0) {
        return `Imported ${created} patient(s)`;
    }
    if (errorCount > 0) {
        return `No rows imported · ${errorCount} issue${errorCount === 1 ? '' : 's'}`;
    }
    return 'Bulk import completed';
}
