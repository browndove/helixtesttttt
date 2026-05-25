'use client';

import { Fragment, useCallback, useState } from 'react';
import type { BulkUploadHistoryEntry } from '@/lib/bulk-upload-history';
import './import-history-ledger.css';

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
    if (Number.isNaN(t)) return dateStr;
    return new Date(t).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
}

function shortId(id: string): string {
    const t = id.trim();
    if (!t) return '—';
    if (t.length <= 8) return t;
    return `${t.slice(0, 8)}…`;
}

function formatRecords(count: number): string {
    const n = Number.isFinite(count) ? count : 0;
    return `${n.toLocaleString()} record${n === 1 ? '' : 's'}`;
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
    kindLabel,
}: ImportHistoryLedgerProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const countLabel = loading
        ? '…'
        : `${entries.length} import${entries.length === 1 ? '' : 's'}`;

    const toggle = useCallback((id: string) => {
        setExpandedId(prev => (prev === id ? null : id));
    }, []);

    return (
        <section className="import-ledger-table" aria-label="Import history">
            <header className="import-ledger-table__hd">
                <div className="import-ledger-table__hd-start">
                    <h2 className="import-ledger-table__title">Import history</h2>
                    <span className="import-ledger-table__count">{countLabel}</span>
                </div>
                {kindLabel ? (
                    <span className="import-ledger-table__kind">{kindLabel}</span>
                ) : null}
            </header>

            {loading ? (
                <p className="import-ledger-table__state">Loading…</p>
            ) : entries.length === 0 ? (
                <p className="import-ledger-table__state">{emptyMessage}</p>
            ) : (
                <div className="import-ledger-table__card card">
                    <table className="import-ledger-table__grid">
                        <thead>
                            <tr>
                                <th
                                    scope="col"
                                    className="import-ledger-table__th import-ledger-table__th--file"
                                >
                                    File
                                </th>
                                <th
                                    scope="col"
                                    className="import-ledger-table__th import-ledger-table__th--records"
                                >
                                    Records
                                </th>
                                <th
                                    scope="col"
                                    className="import-ledger-table__th import-ledger-table__th--date"
                                >
                                    Date
                                </th>
                                <th
                                    scope="col"
                                    className="import-ledger-table__th import-ledger-table__th--warnings"
                                >
                                    Warnings
                                </th>
                                <th
                                    scope="col"
                                    className="import-ledger-table__th import-ledger-table__th--chevron"
                                />
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map(entry => {
                                const hasErrors = entry.errors.length > 0;
                                const isExpanded = expandedId === entry.id;
                                const { base, ext } = splitFilename(entry.file);
                                const canExpand = hasErrors;

                                return (
                                    <Fragment key={entry.id}>
                                        <tr
                                            className={[
                                                'import-ledger-table__row',
                                                canExpand
                                                    ? 'import-ledger-table__row--expandable'
                                                    : '',
                                                isExpanded
                                                    ? 'import-ledger-table__row--open'
                                                    : '',
                                            ]
                                                .filter(Boolean)
                                                .join(' ')}
                                            onClick={
                                                canExpand
                                                    ? () => toggle(entry.id)
                                                    : undefined
                                            }
                                        >
                                            <td className="import-ledger-table__td import-ledger-table__td--file">
                                                <div className="import-ledger-table__file-name">
                                                    {base}
                                                    {ext ? (
                                                        <span className="import-ledger-table__file-ext">
                                                            {ext}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div className="import-ledger-table__file-sub">
                                                    <span className="import-ledger-table__file-sub-records">
                                                        {formatRecords(entry.records)}
                                                        {' · '}
                                                    </span>
                                                    <span title={entry.id}>
                                                        ID: {shortId(entry.id)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="import-ledger-table__td import-ledger-table__td--records">
                                                {formatRecords(entry.records)}
                                            </td>
                                            <td className="import-ledger-table__td import-ledger-table__td--date">
                                                {formatTableDate(entry.date)}
                                            </td>
                                            <td className="import-ledger-table__td import-ledger-table__td--warnings">
                                                {entry.warnings > 0 ? (
                                                    <span className="import-ledger-table__warnings-val">
                                                        {entry.warnings}
                                                    </span>
                                                ) : (
                                                    <span className="import-ledger-table__muted">
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                            <td className="import-ledger-table__td import-ledger-table__td--chevron">
                                                <span
                                                    className={[
                                                        'material-icons-round import-ledger-table__chevron',
                                                        canExpand
                                                            ? ''
                                                            : 'import-ledger-table__chevron--hidden',
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
                                            <tr className="import-ledger-table__row import-ledger-table__row--detail">
                                                <td
                                                    colSpan={5}
                                                    className="import-ledger-table__td import-ledger-table__td--detail"
                                                >
                                                    <div className="import-ledger-table__detail-label">
                                                        Row errors
                                                    </div>
                                                    <ul className="import-ledger-table__error-list">
                                                        {entry.errors.map(
                                                            (err, idx) => (
                                                                <li
                                                                    key={`${entry.id}-err-${err.row}-${idx}`}
                                                                    className="import-ledger-table__error-item"
                                                                >
                                                                    <span className="import-ledger-table__error-row">
                                                                        Row {err.row}
                                                                    </span>
                                                                    <span className="import-ledger-table__error-email">
                                                                        {err.email?.trim() || '—'}
                                                                    </span>
                                                                    <span className="import-ledger-table__error-msg">
                                                                        {err.message}
                                                                    </span>
                                                                </li>
                                                            )
                                                        )}
                                                    </ul>
                                                </td>
                                            </tr>
                                        ) : null}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
