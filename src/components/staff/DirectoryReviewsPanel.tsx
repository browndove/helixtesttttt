'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Inbox, RotateCw, UserPlus, UserRound, UserX } from 'lucide-react';
import { API_ENDPOINTS } from '@/lib/config';
import { appendFacilityIdForProxy, resolveClientFacilityId } from '@/lib/facility-client';
import {
    apiErrorMessage,
    buildResolveBody,
    canAddAsNew,
    canReplace,
    incompleteFormReady,
    kindHint,
    kindLabel,
    parseDirectoryReviewsResponse,
    personDisplayName,
    type DirectoryFileSnapshot,
    type DirectoryResolveAction,
    type DirectoryReview,
} from '@/lib/directory-reviews';
import { cn } from '@/lib/utils';

type Notify = (message: string, variant?: 'success' | 'error' | 'info') => void;

const CARD = 'rounded-2xl bg-white ring-1 ring-slate-900/6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.05),0_8px_20px_-10px_rgba(15,23,42,0.10)]';

type FormState = {
    firstName: string;
    middleName: string;
    lastName: string;
    employeeId: string;
    dob: string;
    canManageSchedule: boolean | null;
};

function formFromFile(file: DirectoryFileSnapshot): FormState {
    return {
        firstName: file.firstName,
        middleName: file.middleName,
        lastName: file.lastName,
        employeeId: file.employeeId,
        dob: file.dob,
        canManageSchedule: file.canManageSchedule,
    };
}

async function resolveFacilityId(): Promise<string> {
    return (await resolveClientFacilityId()) || '';
}

/** Open review count for the tab badge. */
export async function fetchOpenDirectoryReviewCount(): Promise<number> {
    try {
        const facilityId = await resolveFacilityId();
        if (!facilityId) return 0;
        const res = await fetch(
            await appendFacilityIdForProxy(API_ENDPOINTS.FACILITY_DIRECTORY_REVIEWS(facilityId)),
            { credentials: 'include' },
        );
        if (!res.ok) return 0;
        return parseDirectoryReviewsResponse(await res.json()).openCount;
    } catch {
        return 0;
    }
}

function Bone({ className }: { className: string }) {
    return <div className={cn('animate-pulse rounded-md bg-slate-100', className)} />;
}

function Field({
    label,
    value,
    onChange,
    placeholder,
    mono,
}: {
    label: string;
    value: string;
    onChange: (next: string) => void;
    placeholder?: string;
    mono?: boolean;
}) {
    return (
        <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
            <input
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className={cn(
                    'h-9 rounded-lg bg-white px-3 text-[13px] text-slate-900 ring-1 ring-slate-200 outline-none placeholder:text-slate-400 focus:ring-[#1E3A5F]/40',
                    mono && 'font-mono text-[12.5px]',
                )}
            />
        </label>
    );
}

function SnapshotBlock({
    title,
    subtitle,
    person,
}: {
    title: string;
    subtitle?: string;
    person: {
        firstName: string;
        middleName?: string;
        lastName: string;
        employeeId: string;
        dob: string;
        canManageSchedule?: boolean | null;
        hasJoined?: boolean;
    };
}) {
    return (
        <div className="rounded-xl bg-slate-50 px-3.5 py-3 ring-1 ring-slate-200/80">
            <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</div>
                {person.hasJoined ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                        Joined
                    </span>
                ) : null}
            </div>
            {subtitle ? <div className="mt-0.5 text-[11.5px] text-slate-500">{subtitle}</div> : null}
            <div className="mt-2 text-[14px] font-semibold text-slate-900">
                {personDisplayName(person)}
            </div>
            <dl className="mt-2 grid gap-1 text-[12.5px] text-slate-600">
                <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-slate-400">Employee ID</dt>
                    <dd className="font-mono text-[12px] text-slate-800">{person.employeeId || '—'}</dd>
                </div>
                <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-slate-400">Date of birth</dt>
                    <dd>{person.dob || '—'}</dd>
                </div>
                <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-slate-400">Schedule</dt>
                    <dd>
                        {person.canManageSchedule === null || person.canManageSchedule === undefined
                            ? '—'
                            : person.canManageSchedule
                                ? 'Yes'
                                : 'No'}
                    </dd>
                </div>
            </dl>
        </div>
    );
}

function ReviewCard({
    review,
    busy,
    onResolve,
}: {
    review: DirectoryReview;
    busy: boolean;
    onResolve: (action: DirectoryResolveAction, form: FormState) => void;
}) {
    const [form, setForm] = useState<FormState>(() => formFromFile(review.file));
    const allowReplace = canReplace(review);
    const allowAdd =
        review.kind === 'incomplete'
        || canAddAsNew(review)
        || (!review.directory && review.kind !== 'same_employee_id');
    const formReady = incompleteFormReady(form);
    // Same name+DOB "add as new" requires a different employee ID than the stored person.
    const addIdOk =
        review.kind !== 'same_name_dob'
        || (
            Boolean(form.employeeId.trim())
            && form.employeeId.trim() !== (review.directory?.employeeId || '').trim()
        );
    const addReady = formReady && addIdOk;
    const replaceReady = Boolean(form.firstName.trim() && form.lastName.trim() && form.dob.trim());

    useEffect(() => {
        setForm(formFromFile(review.file));
        // Reset editable values when this card's review identity changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [review.id]);

    const patch = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
    }, []);

    return (
        <article className={cn(CARD, 'overflow-hidden')}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#EFF4FA] px-2 py-0.5 text-[11px] font-semibold text-[#1E3A5F] ring-1 ring-[#D7E0EC]">
                            {kindLabel(review.kind)}
                        </span>
                    </div>
                    <p className="mt-1.5 max-w-2xl text-[12.5px] leading-5 text-slate-500">
                        {kindHint(review)}
                    </p>
                </div>
            </div>

            <div className="grid gap-3 px-5 py-4 lg:grid-cols-2">
                {review.directory ? (
                    <SnapshotBlock
                        title="In the directory"
                        subtitle="Already stored"
                        person={review.directory}
                    />
                ) : (
                    <div className="rounded-xl bg-slate-50 px-3.5 py-3 text-[12.5px] text-slate-500 ring-1 ring-slate-200/80">
                        No matching directory person for this row yet.
                    </div>
                )}
                <SnapshotBlock title="In the file" subtitle="From this upload" person={review.file} />
            </div>

            <div className="border-t border-slate-100 bg-[#F8FAFC] px-5 py-4">
                <div className="mb-3 text-[12px] font-semibold text-slate-700">
                    {review.kind === 'incomplete' ? 'Complete the row before adding' : 'Edit file values before confirming'}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="First name" value={form.firstName} onChange={v => patch('firstName', v)} />
                    <Field label="Middle name" value={form.middleName} onChange={v => patch('middleName', v)} placeholder="Optional" />
                    <Field label="Last name" value={form.lastName} onChange={v => patch('lastName', v)} />
                    <Field label="Employee ID" value={form.employeeId} onChange={v => patch('employeeId', v)} placeholder="Optional" mono />
                    <Field label="Date of birth" value={form.dob} onChange={v => patch('dob', v)} placeholder="YYYY-MM-DD" />
                    <label className="grid gap-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Can manage schedule
                        </span>
                        <select
                            value={form.canManageSchedule === null ? '' : form.canManageSchedule ? 'yes' : 'no'}
                            onChange={e => {
                                const v = e.target.value;
                                patch('canManageSchedule', v === '' ? null : v === 'yes');
                            }}
                            className="h-9 rounded-lg bg-white px-3 text-[13px] text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-[#1E3A5F]/40"
                        >
                            <option value="">Select…</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => onResolve('dismiss', form)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-[12.5px] font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                        <UserX className="h-3.5 w-3.5" strokeWidth={2} />
                        {review.directory ? 'Keep directory' : 'Discard row'}
                    </button>

                    {allowReplace ? (
                        <button
                            type="button"
                            disabled={busy || !replaceReady}
                            onClick={() => onResolve('replace', form)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1E3A5F] px-3 text-[12.5px] font-medium text-white shadow-[0_1px_2px_rgba(15,23,42,0.15)] transition hover:bg-[#172E4B] disabled:opacity-60"
                        >
                            <UserRound className="h-3.5 w-3.5" strokeWidth={2} />
                            Use the file
                        </button>
                    ) : null}

                    {allowAdd ? (
                        <button
                            type="button"
                            disabled={busy || !addReady}
                            onClick={() => onResolve('add', form)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-[12.5px] font-medium text-white shadow-[0_1px_2px_rgba(15,23,42,0.12)] transition hover:bg-emerald-800 disabled:opacity-60"
                        >
                            <UserPlus className="h-3.5 w-3.5" strokeWidth={2} />
                            Add as new person
                        </button>
                    ) : null}

                    {review.directory?.hasJoined && allowReplace === false ? (
                        <span className="text-[12px] text-slate-500">
                            This person already joined — the directory row cannot be replaced.
                        </span>
                    ) : null}
                </div>
            </div>
        </article>
    );
}

export default function DirectoryReviewsPanel({
    onNotify,
    onCountChange,
}: {
    onNotify: Notify;
    onCountChange?: (count: number) => void;
}) {
    const [facilityId, setFacilityId] = useState('');
    const [reviews, setReviews] = useState<DirectoryReview[]>([]);
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
            setReviews([]);
            setLoading(false);
            return;
        }
        try {
            const res = await fetch(
                await appendFacilityIdForProxy(API_ENDPOINTS.FACILITY_DIRECTORY_REVIEWS(id)),
                { credentials: 'include' },
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok && res.status !== 404) {
                setError(apiErrorMessage(data, 'Couldn’t load directory reviews.'));
                setReviews([]);
            } else {
                const parsed = res.ok ? parseDirectoryReviewsResponse(data) : { reviews: [], openCount: 0 };
                setReviews(parsed.reviews);
            }
        } catch {
            setError('Couldn’t load directory reviews.');
            setReviews([]);
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
        onCountChangeRef.current?.(reviews.length);
    }, [loading, reviews.length]);

    const resolve = useCallback(async (review: DirectoryReview, action: DirectoryResolveAction, form: FormState) => {
        if (!facilityId) return;
        setBusyIds(prev => new Set([...prev, review.id]));
        try {
            const res = await fetch(
                await appendFacilityIdForProxy(
                    API_ENDPOINTS.FACILITY_DIRECTORY_REVIEW_RESOLVE(facilityId, review.id),
                ),
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(buildResolveBody(action, form)),
                },
            );
            const data = await res.json().catch(() => ({}));
            if (res.status === 404) {
                setReviews(prev => prev.filter(item => item.id !== review.id));
                onNotify('Another administrator already closed this review.', 'info');
                return;
            }
            if (res.status === 409) {
                onNotify(apiErrorMessage(data, 'That decision does not fit. The card stays open.'), 'error');
                return;
            }
            if (!res.ok) {
                throw new Error(apiErrorMessage(data, `Resolve failed (${res.status})`));
            }
            setReviews(prev => prev.filter(item => item.id !== review.id));
            const status = String((data as { status?: string })?.status || action).toLowerCase();
            if (status === 'replaced' || action === 'replace') onNotify('Directory updated from the file', 'success');
            else if (status === 'added' || action === 'add') onNotify('Person added to the directory', 'success');
            else onNotify(review.directory ? 'Kept the directory person' : 'Row discarded', 'success');
        } catch (err) {
            onNotify(err instanceof Error ? err.message : 'Couldn’t resolve that review.', 'error');
        } finally {
            setBusyIds(prev => {
                const next = new Set(prev);
                next.delete(review.id);
                return next;
            });
        }
    }, [facilityId, onNotify]);

    const titleCount = useMemo(() => reviews.length, [reviews.length]);

    return (
        <div className="grid gap-4">
            <section className={cn(CARD, 'overflow-hidden')}>
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-[15px] font-semibold leading-6 text-slate-900">Directory review</h2>
                            {!loading && titleCount > 0 ? (
                                <span className="rounded-full bg-[#1E3A5F] px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums">
                                    {titleCount}
                                </span>
                            ) : null}
                        </div>
                        <p className="mt-0.5 text-[12.5px] text-slate-500">
                            Decide what to do with upload rows that match someone already stored, or that are incomplete.
                            Nothing here changes a person who already joined.
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
                            <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                <Bone className="h-28 w-full rounded-xl" />
                                <Bone className="h-28 w-full rounded-xl" />
                            </div>
                            <Bone className="mt-4 h-24 w-full rounded-xl" />
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
            ) : reviews.length === 0 ? (
                <section className={cn(CARD, 'px-5 py-14 text-center')}>
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-200">
                        <Inbox className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <div className="mt-4 text-[14px] font-semibold text-slate-900">Nothing needs a decision</div>
                    <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-5 text-slate-500">
                        When a bulk upload finds the same employee ID, the same name and date of birth, or an incomplete row, those cards appear here.
                    </p>
                </section>
            ) : (
                <div className="grid gap-4">
                    {reviews.map(review => (
                        <ReviewCard
                            key={review.id}
                            review={review}
                            busy={busyIds.has(review.id)}
                            onResolve={(action, form) => void resolve(review, action, form)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
