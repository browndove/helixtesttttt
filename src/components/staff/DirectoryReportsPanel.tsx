'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, Inbox, RotateCw } from 'lucide-react';
import { API_ENDPOINTS } from '@/lib/config';
import { appendFacilityIdForProxy, resolveClientFacilityId } from '@/lib/facility-client';
import {
    apiErrorMessage,
    formatReportWhen,
    parseDirectoryReportsResponse,
    reportLookupLabel,
    reportLookupMeta,
    reportNoteLabel,
    type DirectoryReport,
} from '@/lib/directory-reports';
import { cn } from '@/lib/utils';

type Notify = (message: string, variant?: 'success' | 'error' | 'info') => void;

const CARD = 'rounded-2xl bg-white ring-1 ring-slate-900/6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.05),0_8px_20px_-10px_rgba(15,23,42,0.10)]';
const ROW_GRID = 'lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_200px]';

async function resolveFacilityId(): Promise<string> {
    return (await resolveClientFacilityId()) || '';
}

/** Open report count for the tab badge. */
export async function fetchOpenDirectoryReportCount(): Promise<number> {
    try {
        const facilityId = await resolveFacilityId();
        if (!facilityId) return 0;
        const res = await fetch(
            await appendFacilityIdForProxy(API_ENDPOINTS.FACILITY_DIRECTORY_REPORTS(facilityId)),
            { credentials: 'include' },
        );
        if (!res.ok) return 0;
        return parseDirectoryReportsResponse(await res.json()).openCount;
    } catch {
        return 0;
    }
}

function Bone({ className }: { className: string }) {
    return <div className={cn('animate-pulse rounded-md bg-slate-100', className)} />;
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

function ReportRow({
    report,
    busy,
    canOpen,
    onOpen,
    onDismiss,
}: {
    report: DirectoryReport;
    busy: boolean;
    canOpen: boolean;
    onOpen: () => void;
    onDismiss: () => void;
}) {
    const lookup = reportLookupLabel(report);
    const lookupMeta = reportLookupMeta(report);
    const note = report.note.trim() ? reportNoteLabel(report) : '';
    const when = formatReportWhen(report.createdAt);

    return (
        <li
            className={cn(
                'grid grid-cols-1 items-start gap-x-3 gap-y-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70',
                ROW_GRID,
            )}
        >
            <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:hidden">
                    They entered
                </div>
                <div className="truncate text-[13.5px] font-semibold text-slate-900">{lookup}</div>
                <div className="mt-0.5 text-[12px] text-slate-500">{lookupMeta}</div>
            </div>

            <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:hidden">
                    Directory showed
                </div>
                <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-b from-white to-slate-100 text-[11.5px] font-semibold text-slate-700 ring-1 ring-slate-200">
                        {initials(report.shown.name)}
                    </span>
                    <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-semibold text-slate-900">
                            {report.shown.name}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[12px] text-slate-500">
                            {report.shown.employeeId ? (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11.5px] text-slate-700 ring-1 ring-slate-200/70">
                                    {report.shown.employeeId}
                                </span>
                            ) : null}
                            {report.shown.dob ? <span>DOB {report.shown.dob}</span> : null}
                        </div>
                    </div>
                </div>
            </div>

            <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:hidden">
                    Report
                </div>
                <div className="text-[12.5px] leading-5 text-slate-700">
                    {note ? (
                        <>
                            <span className="font-medium text-slate-900">They said:</span> {note}
                            {/[.!?]$/.test(note) ? '' : '.'}
                        </>
                    ) : (
                        <span className="text-slate-400">No note left</span>
                    )}
                </div>
                {when ? (
                    <div className="mt-1 text-[12px] text-slate-400" title={report.createdAt}>
                        {when}
                    </div>
                ) : null}
            </div>

            <div className="flex items-center justify-start gap-2 lg:justify-end">
                {canOpen ? (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={onOpen}
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-3 text-[12.5px] font-medium text-slate-600 ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition hover:text-slate-900 disabled:opacity-60"
                    >
                        <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                        Fix
                    </button>
                ) : null}
                <button
                    type="button"
                    disabled={busy}
                    onClick={onDismiss}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#1E3A5F] px-3 text-[12.5px] font-medium text-white shadow-[0_1px_2px_rgba(15,23,42,0.15)] transition hover:bg-[#172E4B] disabled:opacity-60"
                >
                    <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
                    {busy ? '…' : 'Dismiss'}
                </button>
            </div>
        </li>
    );
}

export default function DirectoryReportsPanel({
    onNotify,
    onCountChange,
    onOpenDirectoryUser,
}: {
    onNotify: Notify;
    onCountChange?: (count: number) => void;
    onOpenDirectoryUser?: (directoryUserId: string) => void;
}) {
    const [facilityId, setFacilityId] = useState('');
    const [reports, setReports] = useState<DirectoryReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
    const onCountChangeRef = useRef(onCountChange);
    onCountChangeRef.current = onCountChange;

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        const id = await resolveFacilityId();
        setFacilityId(id);
        if (!id) {
            setError('Could not work out which facility you’re in.');
            setReports([]);
            setLoading(false);
            return;
        }
        try {
            const res = await fetch(
                await appendFacilityIdForProxy(API_ENDPOINTS.FACILITY_DIRECTORY_REPORTS(id)),
                { credentials: 'include' },
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok && res.status !== 404) {
                setError(apiErrorMessage(data, 'Couldn’t load directory reports.'));
                setReports([]);
            } else {
                const parsed = res.ok ? parseDirectoryReportsResponse(data) : { reports: [], openCount: 0 };
                // Surface empty lookup mapping once so we can align with the API payload.
                const missingLookup = parsed.reports.find(
                    r => !r.employeeId && !r.firstName && !r.lastName && !r.dob,
                );
                if (missingLookup && process.env.NODE_ENV !== 'production') {
                    console.warn('[directory-reports] report missing lookup fields', missingLookup.id, data);
                }
                setReports(parsed.reports);
            }
        } catch {
            setError('Couldn’t load directory reports.');
            setReports([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    // Publish badge count after commit — never inside a setState updater / render.
    useEffect(() => {
        if (loading) return;
        onCountChangeRef.current?.(reports.length);
    }, [loading, reports.length]);

    const dismiss = useCallback(async (report: DirectoryReport) => {
        if (!facilityId) return;
        setBusyIds(prev => new Set([...prev, report.id]));
        try {
            const res = await fetch(
                await appendFacilityIdForProxy(
                    API_ENDPOINTS.FACILITY_DIRECTORY_REPORT_DISMISS(facilityId, report.id),
                ),
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                },
            );
            const data = await res.json().catch(() => ({}));
            if (res.status === 404) {
                setReports(prev => prev.filter(item => item.id !== report.id));
                onNotify('That report was already dismissed.', 'info');
                return;
            }
            if (!res.ok) {
                throw new Error(apiErrorMessage(data, `Dismiss failed (${res.status})`));
            }
            setReports(prev => prev.filter(item => item.id !== report.id));
            onNotify('Report dismissed', 'success');
        } catch (err) {
            onNotify(err instanceof Error ? err.message : 'Couldn’t dismiss that report.', 'error');
        } finally {
            setBusyIds(prev => {
                const next = new Set(prev);
                next.delete(report.id);
                return next;
            });
        }
    }, [facilityId, onNotify]);

    return (
        <section className={cn(CARD, 'min-w-0 overflow-hidden')} aria-labelledby="directory-reports-title">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <h2 id="directory-reports-title" className="text-[15px] font-semibold leading-6 text-slate-900">
                            Directory reports
                        </h2>
                        {!loading && reports.length > 0 ? (
                            <span className="rounded-full bg-[#1E3A5F] px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums shadow-[0_1px_2px_rgba(30,58,95,0.3)]">
                                {reports.length}
                            </span>
                        ) : null}
                    </div>
                    <p className="text-[12.5px] text-slate-500">
                        Wrong directory matches from the app. Fix the row, then dismiss the report.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void load()}
                    disabled={loading}
                    aria-label="Refresh"
                    title="Refresh"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition hover:text-slate-800 disabled:opacity-60"
                >
                    <RotateCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} strokeWidth={2} />
                </button>
            </div>

            {loading ? (
                <ul className="divide-y divide-slate-100 border-t border-slate-100">
                    {[0, 1, 2].map(key => (
                        <li key={key} className={cn('grid items-center gap-3 px-5 py-3.5', ROW_GRID)}>
                            <Bone className="h-4 w-28" />
                            <div className="flex items-center gap-2">
                                <Bone className="h-8 w-8 rounded-full" />
                                <Bone className="h-4 w-32" />
                            </div>
                            <Bone className="h-4 w-40" />
                            <Bone className="ml-auto h-8 w-28" />
                        </li>
                    ))}
                </ul>
            ) : error ? (
                <div className="border-t border-slate-100 px-5 py-10 text-center">
                    <div className="text-[13.5px] font-medium text-slate-800">{error}</div>
                    <button
                        type="button"
                        onClick={() => void load()}
                        className="mt-3 h-8 rounded-lg bg-white px-3 text-[12.5px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                    >
                        Try again
                    </button>
                </div>
            ) : reports.length === 0 ? (
                <div className="border-t border-slate-100 px-5 py-14 text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_6px_14px_-8px_rgba(15,23,42,0.18)]">
                        <Inbox className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <div className="mt-4 text-[14px] font-semibold text-slate-900">
                        No one has reported a wrong directory match.
                    </div>
                    <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-5 text-slate-500">
                        When someone flags a wrong name, date of birth, or employee ID, it shows up here.
                    </p>
                </div>
            ) : (
                <>
                    <div
                        className={cn(
                            'hidden items-center gap-x-3 border-y border-slate-100 bg-slate-50/80 px-5 py-2 text-[11.5px] font-medium uppercase tracking-wide text-slate-500 lg:grid',
                            ROW_GRID,
                        )}
                    >
                        <div>They entered</div>
                        <div>Directory showed</div>
                        <div>Report</div>
                        <div className="text-right">Actions</div>
                    </div>
                    <ul className="divide-y divide-slate-100">
                        {reports.map(report => (
                            <ReportRow
                                key={report.id}
                                report={report}
                                busy={busyIds.has(report.id)}
                                canOpen={Boolean(report.shown.directoryUserId && onOpenDirectoryUser)}
                                onOpen={() => onOpenDirectoryUser?.(report.shown.directoryUserId)}
                                onDismiss={() => void dismiss(report)}
                            />
                        ))}
                    </ul>
                </>
            )}
        </section>
    );
}
