'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { BulkUploadHistoryEntry } from '@/lib/bulk-upload-history';
import './import-history-ledger.css';

const PAGE_SIZE_OPTIONS = [5, 10, 20] as const;
const DEFAULT_PAGE_SIZE = 5;

function splitFilename(file: string): { base: string; ext: string } {
    let trimmed = file.trim() || '—';
    const embeddedId = trimmed.match(/^(.+?\.(csv|xlsx|xls|tsv))([0-9a-f-]{8,}.*)$/i);
    if (embeddedId) {
        trimmed = embeddedId[1];
    }
    const dot = trimmed.lastIndexOf('.');
    if (dot <= 0 || dot === trimmed.length - 1) {
        return { base: trimmed, ext: '' };
    }
    return { base: trimmed.slice(0, dot), ext: trimmed.slice(dot) };
}

function formatTableDate(dateStr: string): string {
    const t = Date.parse(dateStr);
    if (Number.isNaN(t)) {
        const parts = dateStr.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
            const timePart = parts[parts.length - 1];
            if (/^\d{1,2}:\d{2}/.test(timePart) && timePart === '00:00') {
                return parts.slice(0, -1).join(', ');
            }
        }
        return dateStr || '—';
    }
    const d = new Date(t);
    const date = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    const time = d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    return time === '00:00' ? date : `${date} · ${time}`;
}

function shortId(id: string): string {
    const t = id.trim();
    if (!t) return '—';
    if (t.length <= 8) return t;
    return `${t.slice(0, 8)}`;
}

type EntryTone = 'error' | 'warn' | 'ok';

function entryTone(entry: BulkUploadHistoryEntry): EntryTone {
    if (entry.status === 'error') return 'error';
    if (entry.warnings > 0 || entry.errors.length > 0) return 'warn';
    return 'ok';
}

function statusLabel(tone: EntryTone): string {
    if (tone === 'error') return 'Failed';
    if (tone === 'warn') return 'Issues';
    return 'Imported';
}

function pageWindow(current: number, total: number): number[] {
    if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 3) return [1, 2, 3, 4, 5].filter(p => p <= total);
    if (current >= total - 2) return [total - 4, total - 3, total - 2, total - 1, total].filter(p => p >= 1);
    return [current - 2, current - 1, current, current + 1, current + 2];
}

type ImportHistoryLedgerProps = {
    entries: BulkUploadHistoryEntry[];
    loading?: boolean;
    emptyMessage?: string;
    kindLabel?: string;
};

export default function ImportHistoryLedger({
    entries,
    loading = false,
    emptyMessage = 'No imports recorded.',
}: ImportHistoryLedgerProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

    const total = entries.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

    const summary = useMemo(() => {
        let failed = 0;
        let issues = 0;
        let ok = 0;
        for (const entry of entries) {
            const tone = entryTone(entry);
            if (tone === 'error') failed += 1;
            else if (tone === 'warn') issues += 1;
            else ok += 1;
        }
        return { failed, issues, ok };
    }, [entries]);

    useEffect(() => {
        setPage(1);
        setExpandedId(null);
    }, [entries]);

    useEffect(() => {
        setPage(p => Math.min(p, totalPages));
    }, [totalPages]);

    const pageEntries = useMemo(() => {
        const start = (page - 1) * pageSize;
        return entries.slice(start, start + pageSize);
    }, [entries, page, pageSize]);

    const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const rangeEnd = Math.min(page * pageSize, total);
    const pages = pageWindow(page, totalPages);

    const toggle = useCallback((id: string) => {
        setExpandedId(prev => (prev === id ? null : id));
    }, []);

    const goPage = useCallback((next: number) => {
        setPage(Math.min(totalPages, Math.max(1, next)));
        setExpandedId(null);
    }, [totalPages]);

    return (
        <section className="import-ledger" aria-label="Import logs and diagnostics">
            <div className="import-ledger__shell">
                <header className="import-ledger__hd">
                    <div className="import-ledger__hd-main">
                        <h2 className="import-ledger__title">
                            Import Logs &amp; Diagnostics
                            {!loading && total > 0 ? (
                                <span className="import-ledger__title-count"> ({total} uploads)</span>
                            ) : null}
                        </h2>
                        <p className="import-ledger__subtitle">
                            {loading
                                ? 'Loading recent uploads…'
                                : total === 0
                                    ? emptyMessage
                                    : 'Audit trail of batch sync events, row verifications, and conflict exceptions.'}
                        </p>
                    </div>
                    {!loading && total > 0 ? (
                        <div className="import-ledger__filters" aria-label="Import summary">
                            <span className="import-ledger__filter import-ledger__filter--error">
                                {summary.failed} Failed
                            </span>
                            <span className="import-ledger__filter import-ledger__filter--muted">
                                {summary.issues} Issues
                            </span>
                            <span className="import-ledger__filter import-ledger__filter--ok">
                                {summary.ok} Imported
                            </span>
                        </div>
                    ) : null}
                </header>

                {loading ? (
                    <p className="import-ledger__state">Loading import history…</p>
                ) : total === 0 ? (
                    <div className="import-ledger__empty">
                        <span className="material-icons-round import-ledger__empty-icon" aria-hidden>
                            history
                        </span>
                        <p className="import-ledger__empty-title">No imports yet</p>
                        <p className="import-ledger__state">{emptyMessage}</p>
                    </div>
                ) : (
                    <>
                        <div className="import-ledger__scroll">
                            <table className="import-ledger__grid">
                                <thead>
                                    <tr>
                                        <th scope="col" className="import-ledger__th import-ledger__th--status">Status</th>
                                        <th scope="col" className="import-ledger__th import-ledger__th--file">File &amp; Transaction ID</th>
                                        <th scope="col" className="import-ledger__th import-ledger__th--records">Rows</th>
                                        <th scope="col" className="import-ledger__th import-ledger__th--date">Timestamp</th>
                                        <th scope="col" className="import-ledger__th import-ledger__th--issues">Errors</th>
                                        <th scope="col" className="import-ledger__th import-ledger__th--chevron">
                                            <span className="sr-only">Details</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageEntries.map(entry => {
                                        const tone = entryTone(entry);
                                        const hasErrors = entry.errors.length > 0;
                                        const isExpanded = expandedId === entry.id;
                                        const { base, ext } = splitFilename(entry.file);
                                        const canExpand = hasErrors;
                                        const issueCount = Math.max(entry.warnings, entry.errors.length);

                                        return (
                                            <Fragment key={entry.id}>
                                                <tr
                                                    className={[
                                                        'import-ledger__row',
                                                        `import-ledger__row--${tone}`,
                                                        canExpand ? 'import-ledger__row--expandable' : '',
                                                        isExpanded ? 'import-ledger__row--open' : '',
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' ')}
                                                    onClick={canExpand ? () => toggle(entry.id) : undefined}
                                                    aria-expanded={canExpand ? isExpanded : undefined}
                                                >
                                                    <td className="import-ledger__td import-ledger__td--status">
                                                        <span className={`import-ledger__badge import-ledger__badge--${tone}`}>
                                                            <span className="import-ledger__badge-dot" aria-hidden />
                                                            {statusLabel(tone)}
                                                        </span>
                                                    </td>
                                                    <td className="import-ledger__td import-ledger__td--file">
                                                        <div className="import-ledger__file-name">
                                                            {base}
                                                            {ext ? <span className="import-ledger__file-ext">{ext}</span> : null}
                                                        </div>
                                                        <div className="import-ledger__file-sub" title={entry.id}>
                                                            #{shortId(entry.id)}
                                                            {entry.user && entry.user !== '—' ? ` · ${entry.user}` : ''}
                                                        </div>
                                                    </td>
                                                    <td className="import-ledger__td import-ledger__td--records">
                                                        <span className="import-ledger__records">
                                                            {entry.records.toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="import-ledger__td import-ledger__td--date">
                                                        {formatTableDate(entry.date)}
                                                    </td>
                                                    <td className="import-ledger__td import-ledger__td--issues">
                                                        {issueCount > 0 ? (
                                                            <span className={`import-ledger__issues import-ledger__issues--${tone}`}>
                                                                {issueCount}
                                                            </span>
                                                        ) : (
                                                            <span className="import-ledger__muted">0</span>
                                                        )}
                                                    </td>
                                                    <td className="import-ledger__td import-ledger__td--chevron">
                                                        <span
                                                            className={[
                                                                'material-icons-round import-ledger__chevron',
                                                                canExpand ? '' : 'import-ledger__chevron--hidden',
                                                            ]
                                                                .filter(Boolean)
                                                                .join(' ')}
                                                            aria-hidden
                                                        >
                                                            expand_more
                                                        </span>
                                                    </td>
                                                </tr>
                                                {canExpand && isExpanded ? (
                                                    <tr className="import-ledger__row import-ledger__row--detail">
                                                        <td colSpan={6} className="import-ledger__td import-ledger__td--detail">
                                                            <div className="import-ledger__detail">
                                                                <ul className="import-ledger__error-list">
                                                                    {entry.errors.map((err, idx) => {
                                                                        const email = err.email?.trim();
                                                                        return (
                                                                            <li
                                                                                key={`${entry.id}-err-${err.row}-${idx}`}
                                                                                className="import-ledger__error-item"
                                                                            >
                                                                                <div className="import-ledger__error-main">
                                                                                    <span className="import-ledger__error-row">
                                                                                        Row {err.row}
                                                                                    </span>
                                                                                    <div className="import-ledger__error-body">
                                                                                        <p className="import-ledger__error-msg">
                                                                                            {err.message}
                                                                                        </p>
                                                                                        {email ? (
                                                                                            <span className="import-ledger__error-email">
                                                                                                {email}
                                                                                            </span>
                                                                                        ) : null}
                                                                                    </div>
                                                                                </div>
                                                                            </li>
                                                                        );
                                                                    })}
                                                                </ul>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : null}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <footer className="import-ledger__footer">
                            <div className="import-ledger__footer-meta">
                                Showing{' '}
                                <strong>
                                    {rangeStart}–{rangeEnd}
                                </strong>{' '}
                                of <strong>{total}</strong> imports
                            </div>
                            <div className="import-ledger__footer-controls">
                                <label className="import-ledger__page-size">
                                    <span>Rows</span>
                                    <select
                                        value={pageSize}
                                        onChange={e => {
                                            setPageSize(Number(e.target.value));
                                            setPage(1);
                                            setExpandedId(null);
                                        }}
                                    >
                                        {PAGE_SIZE_OPTIONS.map(size => (
                                            <option key={size} value={size}>
                                                {size}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <div className="import-ledger__pager">
                                    <button
                                        type="button"
                                        className="import-ledger__page-btn"
                                        disabled={page <= 1}
                                        onClick={() => goPage(page - 1)}
                                    >
                                        Previous
                                    </button>
                                    {pages.map(p => (
                                        <button
                                            key={p}
                                            type="button"
                                            className={[
                                                'import-ledger__page-btn',
                                                p === page ? 'import-ledger__page-btn--active' : '',
                                            ]
                                                .filter(Boolean)
                                                .join(' ')}
                                            onClick={() => goPage(p)}
                                            aria-current={p === page ? 'page' : undefined}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        className="import-ledger__page-btn"
                                        disabled={page >= totalPages}
                                        onClick={() => goPage(page + 1)}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </footer>
                    </>
                )}
            </div>
        </section>
    );
}
