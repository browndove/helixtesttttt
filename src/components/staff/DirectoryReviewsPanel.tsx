'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    return <div className={cn('st-bone', className)} />;
}

function Icon({ name, size }: { name: string; size?: number }) {
    return <span className="material-icons-round" aria-hidden style={size ? { fontSize: size } : undefined}>{name}</span>;
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
        <label className="st-field">
            <span className="st-field__label">{label}</span>
            <input
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className={cn('st-input', mono && 'st-input--mono')}
            />
        </label>
    );
}

function SnapshotBlock({
    icon,
    title,
    subtitle,
    person,
}: {
    icon: string;
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
        <div className="st-well st-snap">
            <span className="material-icons-round gx-mark" aria-hidden>{icon}</span>
            <div className="st-snap__head">
                <div className="st-label" style={{ margin: 0 }}><Icon name={icon} />{title}</div>
                {person.hasJoined ? <span className="st-pill st-pill--ok"><Icon name="verified" />Joined</span> : null}
            </div>
            {subtitle ? <div className="st-note" style={{ marginTop: 2 }}>{subtitle}</div> : null}
            <div className="st-snap__name">{personDisplayName(person)}</div>
            <dl>
                <div>
                    <dt>Employee ID</dt>
                    <dd>{person.employeeId ? <span className="st-mono">{person.employeeId}</span> : '—'}</dd>
                </div>
                <div>
                    <dt>Date of birth</dt>
                    <dd>{person.dob || '—'}</dd>
                </div>
                <div>
                    <dt>Schedule</dt>
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
        <article className="st-card gx-reveal">
            <span className="material-icons-round gx-mark" aria-hidden>rule</span>
            <div className="st-card__head">
                <div className="st-card__id">
                    <span className="gx-ico"><Icon name={review.kind === 'incomplete' ? 'edit_note' : 'compare_arrows'} /></span>
                    <div className="min-w-0">
                        <span className="st-pill">{kindLabel(review.kind)}</span>
                        <p className="st-card__sub" style={{ marginTop: 6, maxWidth: '72ch' }}>{kindHint(review)}</p>
                    </div>
                </div>
            </div>

            <div className="st-card__body">
                <div className="st-versus">
                    {review.directory ? (
                        <SnapshotBlock icon="folder_shared" title="In the directory" subtitle="Already stored" person={review.directory} />
                    ) : (
                        <div className="st-well st-snap st-snap--empty">
                            <span className="gx-ico"><Icon name="person_search" /></span>
                            No matching directory person for this row yet.
                        </div>
                    )}
                    <SnapshotBlock icon="upload_file" title="In the file" subtitle="From this upload" person={review.file} />
                    {review.directory ? <span className="st-versus__vs" aria-hidden><Icon name="sync_alt" /></span> : null}
                </div>
            </div>

            <div className="st-card__section st-card__section--tint">
                <p className="st-label">
                    <Icon name="edit" />
                    {review.kind === 'incomplete' ? 'Complete the row before adding' : 'Edit file values before confirming'}
                </p>
                <div className="st-form-grid">
                    <Field label="First name" value={form.firstName} onChange={v => patch('firstName', v)} />
                    <Field label="Middle name" value={form.middleName} onChange={v => patch('middleName', v)} placeholder="Optional" />
                    <Field label="Last name" value={form.lastName} onChange={v => patch('lastName', v)} />
                    <Field label="Employee ID" value={form.employeeId} onChange={v => patch('employeeId', v)} placeholder="Optional" mono />
                    <Field label="Date of birth" value={form.dob} onChange={v => patch('dob', v)} placeholder="YYYY-MM-DD" />
                    <label className="st-field">
                        <span className="st-field__label">Can manage schedule</span>
                        <select
                            value={form.canManageSchedule === null ? '' : form.canManageSchedule ? 'yes' : 'no'}
                            onChange={e => {
                                const v = e.target.value;
                                patch('canManageSchedule', v === '' ? null : v === 'yes');
                            }}
                            className="st-input"
                        >
                            <option value="">Select…</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </label>
                </div>

                <div className="st-actions" style={{ marginTop: 16 }}>
                    <button type="button" disabled={busy} onClick={() => onResolve('dismiss', form)} className="st-btn">
                        <Icon name="person_off" />
                        {review.directory ? 'Keep directory' : 'Discard row'}
                    </button>

                    {allowReplace ? (
                        <button
                            type="button"
                            disabled={busy || !replaceReady}
                            onClick={() => onResolve('replace', form)}
                            className="st-btn st-btn--primary"
                        >
                            <Icon name="swap_horiz" />
                            Use the file
                        </button>
                    ) : null}

                    {allowAdd ? (
                        <button
                            type="button"
                            disabled={busy || !addReady}
                            onClick={() => onResolve('add', form)}
                            className="st-btn st-btn--mint"
                        >
                            <Icon name="person_add" />
                            Add as new person
                        </button>
                    ) : null}

                    {review.directory?.hasJoined && allowReplace === false ? (
                        <span className="st-note">This person already joined — the directory row cannot be replaced.</span>
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
        <div className="st-stack">
            <section className="gx-hero st-hero gx-reveal">
                <span className="material-icons-round gx-hero__mark" aria-hidden>rule</span>
                <div className="gx-hero__id">
                    <span className="gx-hero__chip"><Icon name="rule" /></span>
                    <div className="min-w-0">
                        <div className="gx-kicker">Staff Management</div>
                        <h2 className="gx-title">
                            Directory review
                            {!loading && titleCount > 0 ? <span className="st-count">{titleCount}</span> : null}
                        </h2>
                        <p className="gx-lede">
                            Decide what to do with upload rows that match someone already stored, or that are incomplete.
                            Nothing here changes a person who already joined.
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
                            <div className="st-versus" style={{ marginTop: 16 }}>
                                <Bone className="h-28 w-full" />
                                <Bone className="h-28 w-full" />
                            </div>
                            <Bone className="mt-4 h-24 w-full" />
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
            ) : reviews.length === 0 ? (
                <section className="st-card st-empty gx-reveal">
                    <span className="material-icons-round gx-mark" aria-hidden>task_alt</span>
                    <div className="st-empty__art"><Icon name="task_alt" /></div>
                    <p className="st-empty__title">Nothing needs a decision</p>
                    <p className="st-empty__text">
                        When a bulk upload finds the same employee ID, the same name and date of birth, or an incomplete row, those cards appear here.
                    </p>
                </section>
            ) : (
                <div className="st-stack">
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
