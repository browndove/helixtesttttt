/** Query value for GET /api/v1/bulk-upload-history */
export type BulkUploadHistoryKind = 'staff' | 'patient';

export type BulkUploadHistoryEntry = {
    id: string;
    file: string;
    records: number;
    status: 'success' | 'error';
    warnings: number;
    date: string;
    user: string;
};

function readNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const n = Number(value);
        if (Number.isFinite(n)) return n;
    }
    return 0;
}

function S(v: unknown, fb = ''): string {
    return String(v ?? fb).trim();
}

function formatHistoryDate(v: unknown): string {
    if (typeof v === 'string' && v.trim()) {
        const t = Date.parse(v);
        if (!Number.isNaN(t)) {
            return new Date(t).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        }
        return v.trim();
    }
    return '—';
}

function extractHistoryRows(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== 'object') return [];
    const r = raw as Record<string, unknown>;
    for (const key of ['items', 'data', 'history', 'results', 'imports']) {
        const v = r[key];
        if (Array.isArray(v)) return v;
    }
    const data = r.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        const d = data as Record<string, unknown>;
        for (const key of ['items', 'history', 'results', 'imports']) {
            const v = d[key];
            if (Array.isArray(v)) return v;
        }
    }
    return [];
}

function parseHistoryRow(row: unknown, idx: number): BulkUploadHistoryEntry | null {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    const r = row as Record<string, unknown>;
    const id = S(r.id || r.uuid || r.import_id || r.bulk_upload_id, '');
    const file = S(
        r.file || r.file_name || r.filename || r.source_file || r.original_filename || r.name,
        '—'
    );
    const records = readNumber(
        r.records ?? r.records_count ?? r.record_count ?? r.rows_imported ?? r.imported_count ?? r.success_count
    );
    const failed = readNumber(r.failed_count ?? r.errors_count ?? r.error_count ?? r.failed_rows);
    const warnings = readNumber(
        r.warnings ?? r.warning_count ?? r.warnings_count ?? failed
    );
    const statusRaw = S(r.status, '').toLowerCase();
    let status: 'success' | 'error' = 'success';
    if (statusRaw === 'error' || statusRaw === 'failed' || statusRaw === 'failure') {
        status = 'error';
    } else if (r.success === false || r.ok === false) {
        status = 'error';
    } else if (records === 0 && failed > 0) {
        status = 'error';
    }
    const user = S(
        r.user || r.user_name || r.imported_by || r.created_by_name || r.created_by || r.uploaded_by,
        '—'
    );
    const date = formatHistoryDate(
        r.created_at ?? r.imported_at ?? r.updated_at ?? r.completed_at ?? r.date ?? r.timestamp
    );
    return {
        id: id || `hist-${idx}`,
        file: file || '—',
        records,
        status,
        warnings: warnings || failed,
        date,
        user: user || '—',
    };
}

/** Normalize backend JSON for bulk-upload-history into UI rows. */
export function parseBulkUploadHistoryResponse(raw: unknown): BulkUploadHistoryEntry[] {
    return extractHistoryRows(raw)
        .map((row, idx) => parseHistoryRow(row, idx))
        .filter((e): e is BulkUploadHistoryEntry => Boolean(e));
}
