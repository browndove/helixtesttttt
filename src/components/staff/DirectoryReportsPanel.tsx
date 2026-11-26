'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, GitMerge, Inbox, RotateCw, Wrench } from 'lucide-react';
import { API_ENDPOINTS } from '@/lib/config';
import { appendFacilityIdForProxy, resolveClientFacilityId } from '@/lib/facility-client';
import {
    apiErrorMessage,
    buildReportResolveBody,
    fieldLabel,
    formFromEntered,
    formatReportWhen,
    isAccountAlreadyExistsConflict,
    parseDirectoryReportsResponse,
    personDisplayName,
    type DirectoryReport,
    type DirectoryReportAction,
    type DirectoryReportForm,
    type DirectoryRelatedRequest,
} from '@/lib/directory-reports';
import { cn } from '@/lib/utils';

type Notify = (message: string, variant?: 'success' | 'error' | 'info') => void;

const CARD = 'rounded-2xl bg-white ring-1 ring-slate-900/6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.05),0_8px_20px_-10px_rgba(15,23,42,0.10)]';

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

function FieldInput({
    label,
    value,
    onChange,
    mono,
}: {
    label: string;
    value: string;
    onChange: (next: string) => void;
    mono?: boolean;
}) {
    return (
        <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
            <input
                value={value}
                onChange={e => onChange(e.target.value)}
                className={cn(
                    'h-9 rounded-lg bg-white px-3 text-[13px] text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-[#1E3A5F]/40',
                    mono && 'font-mono text-[12.5px]',
                )}
            />
        </label>
    );
}

function RelatedRequestCard({
    request,
    selected,
    onSelect,
}: {
    request: DirectoryRelatedRequest;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={cn(
                'w-full rounded-xl px-3.5 py-3 text-left ring-1 transition',
                selected
                    ? 'bg-[#EFF4FA] ring-[#1E3A5F]/35'
                    : 'bg-slate-50 ring-slate-200/80 hover:bg-white',
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-semibold text-slate-900">
                        {personDisplayName(request)}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-slate-500">
                        {request.employeeId ? <span className="font-mono text-[11.5px]">{request.employeeId}</span> : null}
                        {request.dob ? <span>DOB {request.dob}</span> : null}
                        {request.jobTitle ? <span>{request.jobTitle}</span> : null}
                        {request.department ? <span>{request.department}</span> : null}
                    </div>
                    {(request.email || request.phone) ? (
                        <div className="mt-1 text-[12px] text-slate-500">
                            {[request.email, request.phone].filter(Boolean).join(' · ')}
                        </div>
                    ) : null}
                </div>
                {selected ? (
                    <span className="shrink-0 rounded-full bg-[#1E3A5F] px-2 py-0.5 text-[10.5px] font-semibold text-white">
                        Selected
                    </span>
                ) : null}
            </div>
        </button>
    );
}

function ReportCard({
    report,
    busy,
    onResolve,
}: {
    report: DirectoryReport;
    busy: boolean;
    onResolve: (action: DirectoryReportAction, form: DirectoryReportForm, requestId?: string) => void;
}) {
    const [form, setForm] = useState<DirectoryReportForm>(() => formFromEntered(report.entered));
    const [requestId, setRequestId] = useState(report.relatedRequests[0]?.requestId || '');
    const canDismiss = report.actions.includes('dismiss');
    const canCorrect = report.actions.includes('correct_directory') && !report.directory.hasAccount;
    const canMerge = report.actions.includes('merge') && report.relatedRequests.length > 0;
    const when = formatReportWhen(report.createdAt);

    useEffect(() => {
        setForm(formFromEntered(report.entered));
        setRequestId(report.relatedRequests[0]?.requestId || '');
    }, [report.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const patch = <K extends keyof DirectoryReportForm>(key: K, value: DirectoryReportForm[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    return (
        <article className={cn(CARD, 'overflow-hidden')}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-slate-900">
                        Wrong-person report
                        {report.directory.hasAccount ? (
                            <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                Directory person has an account
                            </span>
                        ) : null}
                    </div>
                    <p className="mt-1 text-[12.5px] leading-5 text-slate-500">
                        {report.note.trim()
                            ? <>They said: <span className="text-slate-700">{report.note.trim()}</span></>
                            : 'Someone flagged this directory match as wrong.'}
                        {when ? <span className="text-slate-400"> · {when}</span> : null}
                    </p>
                </div>
            </div>

            <div className="px-5 py-4">
                <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
                    <div className="grid grid-cols-[140px_1fr_1fr] border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        <div className="px-3 py-2">Field</div>
                        <div className="px-3 py-2">They entered</div>
                        <div className="px-3 py-2">In the directory</div>
                    </div>
                    {report.differences.map(diff => (
                        <div
                            key={diff.field}
                            className={cn(
                                'grid grid-cols-[140px_1fr_1fr] border-b border-slate-100 last:border-b-0 text-[13px]',
                                diff.differs ? 'bg-amber-50/70' : 'bg-white',
                            )}
                        >
                            <div className="px-3 py-2.5 font-medium text-slate-500">{fieldLabel(diff.field)}</div>
                            <div className={cn('px-3 py-2.5', diff.differs ? 'font-semibold text-slate-900' : 'text-slate-700')}>
                                {diff.entered || '—'}
                            </div>
                            <div className={cn('px-3 py-2.5', diff.differs ? 'font-semibold text-slate-900' : 'text-slate-700')}>
                                {diff.directory || '—'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {report.relatedRequests.length > 0 ? (
                <div className="border-t border-slate-100 px-5 py-4">
                    <div className="mb-2 text-[12px] font-semibold text-slate-700">
                        Related pending signups
                    </div>
                    <p className="mb-3 text-[12px] text-slate-500">
                        These join requests look like the same person. Pick one to merge into the directory record.
                    </p>
                    <div className="grid gap-2">
                        {report.relatedRequests.map(req => (
                            <RelatedRequestCard
                                key={req.requestId}
                                request={req}
                                selected={requestId === req.requestId}
                                onSelect={() => setRequestId(req.requestId)}
                            />
                        ))}
                    </div>
                </div>
            ) : null}

            {(canCorrect || canMerge) ? (
                <div className="border-t border-slate-100 bg-[#F8FAFC] px-5 py-4">
                    <div className="mb-3 text-[12px] font-semibold text-slate-700">
                        Edit values before confirming (optional)
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <FieldInput label="First name" value={form.firstName} onChange={v => patch('firstName', v)} />
                        <FieldInput label="Middle name" value={form.middleName} onChange={v => patch('middleName', v)} />
                        <FieldInput label="Last name" value={form.lastName} onChange={v => patch('lastName', v)} />
                        <FieldInput label="Employee ID" value={form.employeeId} onChange={v => patch('employeeId', v)} mono />
                        <FieldInput label="Date of birth" value={form.dob} onChange={v => patch('dob', v)} />
                    </div>
                </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-4">
                {canMerge ? (
                    <button
                        type="button"
                        disabled={busy || !requestId}
                        onClick={() => onResolve('merge', form, requestId)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-[12.5px] font-medium text-white shadow-[0_1px_2px_rgba(15,23,42,0.12)] transition hover:bg-emerald-800 disabled:opacity-60"
                    >
                        <GitMerge className="h-3.5 w-3.5" strokeWidth={2} />
                        Merge into this record
                    </button>
                ) : null}
                {canCorrect ? (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => onResolve('correct_directory', form)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1E3A5F] px-3 text-[12.5px] font-medium text-white shadow-[0_1px_2px_rgba(15,23,42,0.15)] transition hover:bg-[#172E4B] disabled:opacity-60"
                    >
                        <Wrench className="h-3.5 w-3.5" strokeWidth={2} />
                        Fix the directory record
                    </button>
                ) : null}
                {canDismiss ? (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => onResolve('dismiss', form)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-[12.5px] font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                        <Check className="h-3.5 w-3.5" strokeWidth={2} />
                        Dismiss
                    </button>
                ) : null}
                {report.directory.hasAccount && !canCorrect && !canMerge ? (
                    <span className="text-[12px] text-slate-500">
                        This person already has an account — only dismiss is available.
                    </span>
                ) : null}
            </div>
        </article>
    );
}

export default function DirectoryReportsPanel({
    onNotify,
    onCountChange,
}: {
    onNotify: Notify;
    onCountChange?: (count: number) => void;
    /** Kept for call-site compatibility; resolve now happens in-panel. */
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

    useEffect(() => {
        if (loading) return;
        onCountChangeRef.current?.(reports.length);
    }, [loading, reports.length]);

    const resolve = useCallback(async (
        report: DirectoryReport,
        action: DirectoryReportAction,
        form: DirectoryReportForm,
        requestId?: string,
    ) => {
        if (!facilityId) return;
        setBusyIds(prev => new Set([...prev, report.id]));
        try {
            const res = await fetch(
                await appendFacilityIdForProxy(
                    API_ENDPOINTS.FACILITY_DIRECTORY_REPORT_RESOLVE(facilityId, report.id),
                ),
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(buildReportResolveBody(action, form, requestId)),
                },
            );
            const data = await res.json().catch(() => ({}));
            if (res.status === 404) {
                setReports(prev => prev.filter(item => item.id !== report.id));
                onNotify('That report was already resolved.', 'info');
                return;
            }
            if (res.status === 409) {
                const msg = apiErrorMessage(data, 'That decision does not fit.');
                onNotify(msg, 'error');
                if (isAccountAlreadyExistsConflict(msg)) {
                    // Leave card open; only dismiss should remain viable from the actions list.
                    setReports(prev => prev.map(item => (
                        item.id === report.id
                            ? { ...item, actions: item.actions.includes('dismiss') ? ['dismiss'] : item.actions, directory: { ...item.directory, hasAccount: true } }
                            : item
                    )));
                }
                return;
            }
            if (!res.ok) {
                throw new Error(apiErrorMessage(data, `Resolve failed (${res.status})`));
            }
            setReports(prev => prev.filter(item => item.id !== report.id));
            const status = String((data as { status?: string })?.status || action).toLowerCase();
            if (status === 'merged' || action === 'merge') {
                const emailed = Boolean((data as { invite_email_sent?: boolean })?.invite_email_sent);
                onNotify(
                    emailed ? 'Merged into directory and invite email sent' : 'Merged into directory',
                    'success',
                );
            } else if (status === 'corrected' || action === 'correct_directory') {
                onNotify('Directory record updated from what they entered', 'success');
            } else {
                onNotify('Report dismissed', 'success');
            }
        } catch (err) {
            onNotify(err instanceof Error ? err.message : 'Couldn’t resolve that report.', 'error');
        } finally {
            setBusyIds(prev => {
                const next = new Set(prev);
                next.delete(report.id);
                return next;
            });
        }
    }, [facilityId, onNotify]);

    return (
        <div className="grid gap-4">
            <section className={cn(CARD, 'overflow-hidden')}>
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-[15px] font-semibold leading-6 text-slate-900">Directory reports</h2>
                            {!loading && reports.length > 0 ? (
                                <span className="rounded-full bg-[#1E3A5F] px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums">
                                    {reports.length}
                                </span>
                            ) : null}
                        </div>
                        <p className="mt-0.5 text-[12.5px] text-slate-500">
                            Compare what they entered with the directory record, then merge, fix, or dismiss.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void load()}
                        disabled={loading}
                        aria-label="Refresh"
                        title="Refresh"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200 transition hover:text-slate-800 disabled:opacity-60"
                    >
                        <RotateCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} strokeWidth={2} />
                    </button>
                </div>
            </section>

            {loading ? (
                <div className="grid gap-4">
                    {[0, 1].map(key => (
                        <div key={key} className={cn(CARD, 'p-5')}>
                            <Bone className="h-4 w-40" />
                            <Bone className="mt-4 h-32 w-full rounded-xl" />
                            <Bone className="mt-4 h-10 w-48" />
                        </div>
                    ))}
                </div>
            ) : error ? (
                <section className={cn(CARD, 'px-5 py-10 text-center')}>
                    <div className="text-[13.5px] font-medium text-slate-800">{error}</div>
                    <button
                        type="button"
                        onClick={() => void load()}
                        className="mt-3 h-8 rounded-lg bg-white px-3 text-[12.5px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                    >
                        Try again
                    </button>
                </section>
            ) : reports.length === 0 ? (
                <section className={cn(CARD, 'px-5 py-14 text-center')}>
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-200">
                        <Inbox className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <div className="mt-4 text-[14px] font-semibold text-slate-900">
                        No one has reported a wrong directory match.
                    </div>
                    <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-5 text-slate-500">
                        When someone taps “Not me” during self-join, the comparison shows up here.
                    </p>
                </section>
            ) : (
                <div className="grid gap-4">
                    {reports.map(report => (
                        <ReportCard
                            key={report.id}
                            report={report}
                            busy={busyIds.has(report.id)}
                            onResolve={(action, form, reqId) => void resolve(report, action, form, reqId)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
