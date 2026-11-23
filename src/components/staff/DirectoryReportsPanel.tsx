'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
    return <div className={cn('st-bone', className)} />;
}

function Icon({ name, size }: { name: string; size?: number }) {
    return <span className="material-icons-round" aria-hidden style={size ? { fontSize: size } : undefined}>{name}</span>;
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
        <label className="st-field">
            <span className="st-field__label">{label}</span>
            <input
                value={value}
                onChange={e => onChange(e.target.value)}
                className={cn('st-input', mono && 'st-input--mono')}
            />
        </label>
    );
}

function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
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
        <button type="button" onClick={onSelect} className={cn('st-pick', selected && 'is-selected')} aria-pressed={selected}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="st-avatar" aria-hidden>{initialsOf(personDisplayName(request))}</span>
                    <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-semibold text-(--text-primary)">{personDisplayName(request)}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-(--text-muted)">
                            {request.employeeId ? <span className="st-mono">{request.employeeId}</span> : null}
                            {request.dob ? <span>DOB {request.dob}</span> : null}
                            {request.jobTitle ? <span>{request.jobTitle}</span> : null}
                            {request.department ? <span>{request.department}</span> : null}
                        </div>
                        {(request.email || request.phone) ? (
                            <div className="mt-1 text-[12px] text-(--text-muted)">
                                {[request.email, request.phone].filter(Boolean).join(' · ')}
                            </div>
                        ) : null}
                    </div>
                </div>
                {selected ? <span className="st-pill st-pill--navy"><Icon name="check" />Selected</span> : null}
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
        <article className="st-card gx-reveal">
            <span className="material-icons-round gx-mark" aria-hidden>report_problem</span>
            <div className="st-card__head">
                <div className="st-card__id">
                    <span className="gx-ico"><Icon name="manage_accounts" /></span>
                    <div className="min-w-0">
                        <h3 className="st-card__title">
                            Wrong-person report
                            {report.directory.hasAccount ? (
                                <span className="st-pill st-pill--ok" style={{ marginLeft: 8, verticalAlign: 2 }}>
                                    <Icon name="verified" />Directory person has an account
                                </span>
                            ) : null}
                        </h3>
                        <p className="st-card__sub">
                            {report.note.trim()
                                ? <>They said: <span className="text-(--text-primary)">“{report.note.trim()}”</span></>
                                : 'Someone flagged this directory match as wrong.'}
                            {when ? <span> · {when}</span> : null}
                        </p>
                    </div>
                </div>
            </div>

            <div className="st-card__body">
                <div className="st-well st-diff">
                    <div className="st-diff__row st-diff__row--head">
                        <div>Field</div>
                        <div>They entered</div>
                        <div>In the directory</div>
                    </div>
                    {report.differences.map(diff => (
                        <div key={diff.field} className={cn('st-diff__row', diff.differs && 'is-diff')}>
                            <div className="st-diff__field">
                                {diff.differs ? <span className="st-diff__flag" aria-label="Differs" /> : null}
                                {fieldLabel(diff.field)}
                            </div>
                            <div>{diff.entered || '—'}</div>
                            <div>{diff.directory || '—'}</div>
                        </div>
                    ))}
                </div>
            </div>

            {report.relatedRequests.length > 0 ? (
                <div className="st-card__section">
                    <p className="st-label"><Icon name="how_to_reg" />Related pending signups</p>
                    <p className="st-note" style={{ margin: '-4px 0 10px' }}>
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
                <div className="st-card__section st-card__section--tint">
                    <p className="st-label"><Icon name="edit" />Edit values before confirming (optional)</p>
                    <div className="st-form-grid">
                        <FieldInput label="First name" value={form.firstName} onChange={v => patch('firstName', v)} />
                        <FieldInput label="Middle name" value={form.middleName} onChange={v => patch('middleName', v)} />
                        <FieldInput label="Last name" value={form.lastName} onChange={v => patch('lastName', v)} />
                        <FieldInput label="Employee ID" value={form.employeeId} onChange={v => patch('employeeId', v)} mono />
                        <FieldInput label="Date of birth" value={form.dob} onChange={v => patch('dob', v)} />
                    </div>
                </div>
            ) : null}

            <div className="st-card__section st-actions">
                {canMerge ? (
                    <button
                        type="button"
                        disabled={busy || !requestId}
                        onClick={() => onResolve('merge', form, requestId)}
                        className="st-btn st-btn--mint"
                    >
                        <Icon name="call_merge" />
                        Merge into this record
                    </button>
                ) : null}
                {canCorrect ? (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => onResolve('correct_directory', form)}
                        className="st-btn st-btn--primary"
                    >
                        <Icon name="build" />
                        Fix the directory record
                    </button>
                ) : null}
                {canDismiss ? (
                    <button type="button" disabled={busy} onClick={() => onResolve('dismiss', form)} className="st-btn">
                        <Icon name="check" />
                        Dismiss
                    </button>
                ) : null}
                {report.directory.hasAccount && !canCorrect && !canMerge ? (
                    <span className="st-note">This person already has an account — only dismiss is available.</span>
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
        <div className="st-stack">
            <section className="gx-hero st-hero gx-reveal">
                <span className="material-icons-round gx-hero__mark" aria-hidden>report_problem</span>
                <div className="gx-hero__id">
                    <span className="gx-hero__chip"><Icon name="report_problem" /></span>
                    <div className="min-w-0">
                        <div className="gx-kicker">Staff Management</div>
                        <h2 className="gx-title">
                            Directory reports
                            {!loading && reports.length > 0 ? <span className="st-count">{reports.length}</span> : null}
                        </h2>
                        <p className="gx-lede">
                            Compare what they entered with the directory record, then merge, fix, or dismiss.
                        </p>
                    </div>
                </div>
                <div className="st-hero__actions">
                    <button
                        type="button"
                        onClick={() => void load()}
                        disabled={loading}
                        aria-label="Refresh"
                        title="Refresh"
                        className="st-btn st-iconbtn"
                    >
                        <Icon name="refresh" size={18} />
                    </button>
                </div>
            </section>

            {loading ? (
                <div className="st-stack">
                    {[0, 1].map(key => (
                        <div key={key} className="st-card" style={{ padding: 20 }}>
                            <Bone className="h-4 w-40" />
                            <Bone className="mt-4 h-32 w-full" />
                            <Bone className="mt-4 h-9 w-48" />
                        </div>
                    ))}
                </div>
            ) : error ? (
                <section className="st-card st-empty">
                    <div className="st-empty__art st-empty__art--bad"><Icon name="cloud_off" /></div>
                    <p className="st-empty__title">{error}</p>
                    <button type="button" onClick={() => void load()} className="st-btn">
                        <Icon name="refresh" /> Try again
                    </button>
                </section>
            ) : reports.length === 0 ? (
                <section className="st-card st-empty gx-reveal">
                    <span className="material-icons-round gx-mark" aria-hidden>verified_user</span>
                    <div className="st-empty__art"><Icon name="verified_user" /></div>
                    <p className="st-empty__title">No one has reported a wrong directory match.</p>
                    <p className="st-empty__text">
                        When someone taps “Not me” during self-join, the comparison shows up here.
                    </p>
                </section>
            ) : (
                <div className="st-stack">
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
