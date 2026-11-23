'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { API_ENDPOINTS } from '@/lib/config';
import { appendFacilityIdForProxy, resolveClientFacilityId } from '@/lib/facility-client';
import {
    apiErrorMessage,
    initials,
    parseJoinCode,
    parseJoinRequests,
    primaryWorkstationLabel,
    timeAgo,
    type JoinCodeInfo,
    type JoinRequest,
} from '@/lib/join-requests';
import { sendStaffInviteEmails } from '@/lib/staff-invite-emails';
import { cn } from '@/lib/utils';

type PendingInviteResend = { userId: string; name: string };

type Notify = (message: string, variant?: 'success' | 'error' | 'info') => void;
type Facility = { id: string; name: string };

const ROW_GRID = 'lg:grid-cols-[20px_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_200px]';

async function resolveFacility(): Promise<Facility> {
    const [id, hospital] = await Promise.all([
        resolveClientFacilityId(),
        appendFacilityIdForProxy(API_ENDPOINTS.HOSPITAL)
            .then(url => fetch(url, { credentials: 'include' }))
            .then(res => (res.ok ? res.json() : null))
            .catch(() => null),
    ]);
    const rec = hospital && typeof hospital === 'object' ? hospital as Record<string, unknown> : {};
    return {
        id: id || (typeof rec.id === 'string' ? rec.id : ''),
        name: typeof rec.name === 'string' && rec.name.trim() ? rec.name.trim() : 'your facility',
    };
}

/** Pending count for the tab badge; resolves to 0 when the endpoint isn't reachable. */
export async function fetchPendingJoinCount(): Promise<number> {
    try {
        const facility = await resolveFacility();
        if (!facility.id) return 0;
        const res = await fetch(await appendFacilityIdForProxy(API_ENDPOINTS.FACILITY_JOIN_REQUESTS(facility.id)), { credentials: 'include' });
        if (!res.ok) return 0;
        return parseJoinRequests(await res.json()).length;
    } catch {
        return 0;
    }
}

function formatCode(code: string): string {
    const clean = code.replace(/\s+/g, '');
    if (/[-_]/.test(clean) || clean.length < 6) return clean.toUpperCase();
    const size = clean.length % 4 === 0 ? 4 : 3;
    return (clean.match(new RegExp(`.{1,${size}}`, 'g')) || [clean]).join(' ').toUpperCase();
}

function inviteMessage(facilityName: string, code: string): string {
    return `Join ${facilityName} on Helix: open the Helix app, choose to join a facility, and enter the code ${code}. Your request will be approved by the admin.`;
}

function Switch({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: (next: boolean) => void; label: string }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className="st-switch"
        />
    );
}

function Bone({ className }: { className: string }) {
    return <div className={cn('st-bone', className)} />;
}

function Icon({ name, size }: { name: string; size?: number }) {
    return <span className="material-icons-round" aria-hidden style={size ? { fontSize: size } : undefined}>{name}</span>;
}

function JoinCodeCard({
    facility,
    info,
    loading,
    error,
    saving,
    onToggleEmployeeIds,
    onCopy,
}: {
    facility: Facility | null;
    info: JoinCodeInfo | null;
    loading: boolean;
    error: string;
    saving: boolean;
    onToggleEmployeeIds: (next: boolean) => void;
    onCopy: (text: string, what: string) => void;
}) {
    const steps = [
        'Share the code with your staff.',
        'They sign up in the Helix app using the code.',
        'You approve them here. Then they can sign in.',
    ];
    return (
        <section className="st-card st-sticky gx-feature" aria-labelledby="join-code-title">
            <span className="gx-feature__glow" aria-hidden />
            <span className="material-icons-round gx-mark" aria-hidden>vpn_key</span>
            <div style={{ padding: 20 }}>
                <div className="st-card__id">
                    <span className="gx-ico" style={{ background: '#fff' }}><Icon name="vpn_key" /></span>
                    <div className="min-w-0">
                        <h3 id="join-code-title" className="st-card__title">Join code</h3>
                        <p className="st-card__sub" style={{ color: '#4a6a93' }}>
                            Staff enter this in the Helix app to ask to join {facility?.name || 'your facility'}.
                        </p>
                    </div>
                </div>

                <div className="st-code">
                    {loading ? (
                        <Bone className="mx-auto h-9 w-44" />
                    ) : info ? (
                        <div className="st-code__value">{formatCode(info.code)}</div>
                    ) : (
                        <div className="st-note">{error || 'No join code for this facility yet.'}</div>
                    )}
                    {info?.expiresAt ? (
                        <div className="st-code__meta">Valid until {new Date(info.expiresAt).toLocaleDateString()}</div>
                    ) : null}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" disabled={!info} onClick={() => info && onCopy(info.code, 'Code')} className="st-btn">
                        <Icon name="content_copy" /> Copy code
                    </button>
                    <button
                        type="button"
                        disabled={!info}
                        onClick={() => info && onCopy(inviteMessage(facility?.name || 'our facility', info.code), 'Invite message')}
                        className="st-btn st-btn--primary"
                    >
                        <Icon name="sms" /> Copy invite
                    </button>
                </div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(47, 111, 184, 0.14)' }}>
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="text-[13.5px] font-semibold text-(--text-primary)">Ask for employee ID</div>
                        <p className="mt-0.5 text-[12.5px] leading-5" style={{ color: '#4a6a93' }}>
                            {info?.usesEmployeeIds
                                ? 'Staff must enter an employee ID that matches your staff directory.'
                                : 'Anyone with the code can send a request. You review every one.'}
                        </p>
                    </div>
                    <Switch
                        checked={!!info?.usesEmployeeIds}
                        disabled={!info || saving}
                        onChange={onToggleEmployeeIds}
                        label="Ask for employee ID"
                    />
                </div>
                {info?.usesEmployeeIds ? (
                    <div className="st-callout" style={{ marginTop: 12 }}>
                        <Icon name="info" />
                        <span>Make sure your staff are in the directory with their employee IDs, or they won’t be able to join.</span>
                    </div>
                ) : null}
            </div>

            <div style={{ padding: '14px 20px 18px', borderTop: '1px solid rgba(47, 111, 184, 0.14)' }}>
                <p className="st-label"><Icon name="route" />How joining works</p>
                <ol className="st-steps">
                    {steps.map((step, index) => (
                        <li key={step}>
                            <span className="st-steps__num">{index + 1}</span>
                            {step}
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}

function EmployeeIdChip({ request }: { request: JoinRequest }) {
    if (!request.employeeId) return <span className="st-note">No employee ID</span>;
    const matched = request.employeeMatched;
    return (
        <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="st-mono">{request.employeeId}</span>
            {matched === true ? (
                <span className="st-pill st-pill--ok"><Icon name="verified" /> In directory</span>
            ) : matched === false ? (
                <span className="st-pill st-pill--warn"><Icon name="gpp_maybe" /> Not in directory</span>
            ) : null}
        </span>
    );
}

function RequestRow({
    request,
    selected,
    busy,
    confirmingReject,
    onSelect,
    onApprove,
    onAskReject,
    onCancelReject,
    onConfirmReject,
}: {
    request: JoinRequest;
    selected: boolean;
    busy: boolean;
    confirmingReject: boolean;
    onSelect: (next: boolean) => void;
    onApprove: () => void;
    onAskReject: () => void;
    onCancelReject: () => void;
    onConfirmReject: () => void;
}) {
    const contact = [request.email, request.phone].filter(Boolean);
    const workstation = primaryWorkstationLabel(request);
    const extraWorkstations = (request.workstationIds || []).filter(id => {
        const primary = (request.primaryWorkstationId || '').trim().toLowerCase();
        return id.trim() && id.trim().toLowerCase() !== primary && !/^not[_-]?applicable$/i.test(id);
    });
    const placementBits = [
        request.department ? `Dept: ${request.department}` : '',
        workstation ? `Primary: ${workstation}` : '',
        extraWorkstations.length ? `Also: ${extraWorkstations.join(', ')}` : '',
        request.roomCubicle ? `Room/cubicle: ${request.roomCubicle}` : '',
    ].filter(Boolean);
    return (
        <li className={cn('st-row grid grid-cols-[20px_minmax(0,1fr)] items-center gap-x-3 gap-y-2', ROW_GRID, selected && 'is-selected')}>
            <input
                type="checkbox"
                checked={selected}
                onChange={e => onSelect(e.target.checked)}
                aria-label={`Select ${request.fullName}`}
                className="st-check"
            />
            <div className="flex min-w-0 items-center gap-3">
                <span className="st-avatar">{initials(request.fullName)}</span>
                <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-[13.5px] font-semibold text-(--text-primary)">{request.fullName}</span>
                        {request.emailVerified ? (
                            <span
                                role="img"
                                aria-label="Email verified"
                                className="material-icons-round"
                                style={{ fontSize: 15, color: '#2a9a74', flexShrink: 0 }}
                                title={request.emailVerifiedAt
                                    ? `Email verified ${timeAgo(request.emailVerifiedAt) || request.emailVerifiedAt}`
                                    : 'Email verified'}
                            >
                                verified
                            </span>
                        ) : null}
                    </div>
                    {contact.length ? (
                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-(--text-muted)">
                            {request.email ? (
                                <span className="inline-flex min-w-0 items-center gap-1 truncate">
                                    <Icon name="mail" size={13} />
                                    <span className="truncate">{request.email}</span>
                                </span>
                            ) : null}
                            {request.phone ? <span className="inline-flex items-center gap-1"><Icon name="call" size={13} />{request.phone}</span> : null}
                        </div>
                    ) : null}
                </div>
            </div>
            <div className="col-start-2 min-w-0 lg:col-start-auto">
                <EmployeeIdChip request={request} />
            </div>
            <div className="col-start-2 min-w-0 lg:col-start-auto">
                <div className="truncate text-[12.5px] font-medium text-(--text-primary)">{request.role || <span className="text-(--text-muted)">No role given</span>}</div>
                {placementBits.length ? (
                    <div className="mt-0.5 space-y-0.5 text-[12px] text-(--text-muted)">
                        {placementBits.map(line => (
                            <div key={line} className="truncate">{line}</div>
                        ))}
                    </div>
                ) : null}
                {request.submittedAt ? (
                    <div className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-(--text-muted)">
                        <Icon name="schedule" size={12} />{timeAgo(request.submittedAt)}
                    </div>
                ) : null}
            </div>
            <div className="col-start-2 flex items-center justify-end gap-2 lg:col-start-auto">
                {confirmingReject ? (
                    <>
                        <span className="mr-1 text-[12.5px] text-(--text-secondary)">Reject?</span>
                        <button type="button" onClick={onCancelReject} disabled={busy} className="st-btn st-btn--sm st-btn--ghost">
                            Keep
                        </button>
                        <button type="button" onClick={onConfirmReject} disabled={busy} className="st-btn st-btn--sm st-btn--danger">
                            {busy ? 'Rejecting…' : 'Reject'}
                        </button>
                    </>
                ) : (
                    <>
                        <button type="button" onClick={onAskReject} disabled={busy} className="st-btn st-btn--sm st-btn--reject">
                            <Icon name="close" size={15} /> Reject
                        </button>
                        <button type="button" onClick={onApprove} disabled={busy} className="st-btn st-btn--sm st-btn--primary">
                            <Icon name="check" size={15} /> {busy ? 'Approving…' : 'Approve'}
                        </button>
                    </>
                )}
            </div>
        </li>
    );
}

export default function JoinRequestsPanel({ onNotify, onCountChange }: { onNotify: Notify; onCountChange?: (count: number) => void }) {
    const [facility, setFacility] = useState<Facility | null>(null);
    const [codeInfo, setCodeInfo] = useState<JoinCodeInfo | null>(null);
    const [codeLoading, setCodeLoading] = useState(true);
    const [codeError, setCodeError] = useState('');
    const [savingCode, setSavingCode] = useState(false);

    const [requests, setRequests] = useState<JoinRequest[]>([]);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState('');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
    const [confirmRejectId, setConfirmRejectId] = useState('');
    const [bulkConfirmReject, setBulkConfirmReject] = useState(false);
    const [pendingInviteResends, setPendingInviteResends] = useState<PendingInviteResend[]>([]);
    const [resendingInviteIds, setResendingInviteIds] = useState<Set<string>>(new Set());

    const load = useCallback(async () => {
        setCodeLoading(true);
        setListLoading(true);
        setCodeError('');
        setListError('');
        const fac = await resolveFacility();
        setFacility(fac);
        if (!fac.id) {
            setCodeError('Could not work out which facility you’re in.');
            setListError('Could not work out which facility you’re in.');
            setCodeLoading(false);
            setListLoading(false);
            return;
        }
        const [codeRes, listRes] = await Promise.all([
            appendFacilityIdForProxy(API_ENDPOINTS.FACILITY_JOIN_CODE(fac.id)).then(url => fetch(url, { credentials: 'include' })).catch(() => null),
            appendFacilityIdForProxy(API_ENDPOINTS.FACILITY_JOIN_REQUESTS(fac.id)).then(url => fetch(url, { credentials: 'include' })).catch(() => null),
        ]);

        const codeData = codeRes ? await codeRes.json().catch(() => ({})) : {};
        if (codeRes?.ok) setCodeInfo(parseJoinCode(codeData));
        else setCodeError(codeRes?.status === 404 ? 'No join code for this facility yet.' : apiErrorMessage(codeData, 'Couldn’t load the join code.'));
        setCodeLoading(false);

        const listData = listRes ? await listRes.json().catch(() => ({})) : {};
        if (listRes?.ok || listRes?.status === 404) {
            const parsed = listRes.ok ? parseJoinRequests(listData) : [];
            setRequests(parsed);
            onCountChange?.(parsed.length);
        } else {
            setListError(apiErrorMessage(listData, 'Couldn’t load join requests.'));
        }
        setSelected(new Set());
        setListLoading(false);
    }, [onCountChange]);

    useEffect(() => {
        void load();
    }, [load]);

    const copy = useCallback(async (text: string, what: string) => {
        try {
            await navigator.clipboard.writeText(text);
            onNotify(`${what} copied`, 'success');
        } catch {
            onNotify('Couldn’t copy. Select the text and copy it instead.', 'error');
        }
    }, [onNotify]);

    const toggleEmployeeIds = useCallback(async (next: boolean) => {
        if (!facility?.id || !codeInfo) return;
        const previous = codeInfo;
        setCodeInfo({ ...codeInfo, usesEmployeeIds: next });
        setSavingCode(true);
        try {
            const res = await fetch(await appendFacilityIdForProxy(API_ENDPOINTS.FACILITY_JOIN_CODE(facility.id)), {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uses_employee_ids: next }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(apiErrorMessage(data, 'Couldn’t save that setting.'));
            const updated = parseJoinCode(data);
            if (updated) setCodeInfo(updated);
            onNotify(next ? 'Employee ID is now required to join' : 'Employee ID is no longer required', 'success');
        } catch (err) {
            setCodeInfo(previous);
            onNotify(err instanceof Error ? err.message : 'Couldn’t save that setting.', 'error');
        } finally {
            setSavingCode(false);
        }
    }, [facility, codeInfo, onNotify]);

    const resendInvite = useCallback(async (userId: string) => {
        setResendingInviteIds(prev => new Set([...prev, userId]));
        try {
            const result = await sendStaffInviteEmails([userId]);
            if (result.emailNotConfigured) {
                onNotify('Invite email is not configured on the server.', 'error');
                return;
            }
            if (result.queued > 0) {
                setPendingInviteResends(prev => prev.filter(item => item.userId !== userId));
                onNotify('Invite email sent', 'success');
                return;
            }
            const msg = result.errors[0]?.message || 'Couldn’t send invite email.';
            onNotify(msg, 'error');
        } catch {
            onNotify('Couldn’t send invite email.', 'error');
        } finally {
            setResendingInviteIds(prev => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
        }
    }, [onNotify]);

    const decide = useCallback(async (ids: string[], decision: 'approve' | 'reject') => {
        if (!facility?.id || !ids.length) return;
        setBusyIds(prev => new Set([...prev, ...ids]));
        const results = await Promise.allSettled(ids.map(async id => {
            const res = await fetch(await appendFacilityIdForProxy(API_ENDPOINTS.FACILITY_JOIN_DECIDE(facility.id, id)), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decision }),
            });
            const data = await res.json().catch(() => ({})) as Record<string, unknown>;
            if (!res.ok) throw new Error(apiErrorMessage(data, `Request failed (${res.status})`));
            return {
                id,
                userId: String(data.user_id || data.userId || '').trim(),
                inviteEmailSent: data.invite_email_sent === true || data.inviteEmailSent === true,
                name: requests.find(item => item.id === id)?.fullName || '',
            };
        }));
        const fulfilled = results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []));
        const done = new Set(fulfilled.map(r => r.id));
        const failed = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];

        setRequests(prev => {
            const next = prev.filter(item => !done.has(item.id));
            onCountChange?.(next.length);
            return next;
        });
        setSelected(prev => new Set([...prev].filter(id => !done.has(id))));
        setBusyIds(prev => new Set([...prev].filter(id => !ids.includes(id))));
        setConfirmRejectId('');
        setBulkConfirmReject(false);

        if (decision === 'approve') {
            const missingEmail = fulfilled.filter(r => r.userId && !r.inviteEmailSent);
            if (missingEmail.length) {
                setPendingInviteResends(prev => {
                    const map = new Map(prev.map(item => [item.userId, item]));
                    for (const row of missingEmail) {
                        map.set(row.userId, { userId: row.userId, name: row.name || 'Approved staff' });
                    }
                    return [...map.values()];
                });
            }
        }

        if (done.size) {
            const name = ids.length === 1 ? requests.find(item => item.id === ids[0])?.fullName : '';
            const verb = decision === 'approve' ? 'Approved' : 'Rejected';
            const missing = decision === 'approve'
                ? fulfilled.filter(r => r.userId && !r.inviteEmailSent).length
                : 0;
            if (missing > 0 && done.size === missing) {
                onNotify(
                    name
                        ? `Approved ${name}, but the invite email was not sent`
                        : `Approved ${done.size}, but invite email was not sent`,
                    'info',
                );
            } else {
                onNotify(name ? `${verb} ${name}` : `${verb} ${done.size} request${done.size === 1 ? '' : 's'}`, 'success');
            }
        }
        if (failed.length) {
            const reason = failed[0].reason instanceof Error ? failed[0].reason.message : 'Something went wrong.';
            onNotify(`${failed.length} couldn’t be ${decision === 'approve' ? 'approved' : 'rejected'}: ${reason}`, 'error');
        }
    }, [facility, requests, onNotify, onCountChange]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return requests;
        return requests.filter(item => {
            const haystack = [
                item.fullName,
                item.firstName,
                item.lastName,
                `${item.firstName} ${item.lastName}`,
                item.employeeId,
            ];
            return haystack.some(value => value?.toLowerCase().includes(q));
        });
    }, [requests, search]);

    const allSelected = filtered.length > 0 && filtered.every(item => selected.has(item.id));
    const selectedIds = [...selected];

    return (
        <div className="st-stack">
            <section className="gx-hero st-hero gx-reveal">
                <span className="material-icons-round gx-hero__mark" aria-hidden>how_to_reg</span>
                <div className="gx-hero__id">
                    <span className="gx-hero__chip"><Icon name="how_to_reg" /></span>
                    <div className="min-w-0">
                        <div className="gx-kicker">Staff Management</div>
                        <h2 className="gx-title">
                            Join requests
                            {!listLoading && requests.length ? <span className="st-count">{requests.length}</span> : null}
                        </h2>
                        <p className="gx-lede">
                            Staff who signed up with your join code wait here. Check each person works at <strong>{facility?.name || 'your facility'}</strong> before you approve them.
                        </p>
                    </div>
                </div>
                <div className="st-hero__actions">
                    {!listLoading && !listError && requests.length > 0 ? (
                        <label className="st-search">
                            <Search className="h-3.5 w-3.5" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Employee ID or name"
                                aria-label="Search by employee ID or name"
                                className="st-input"
                            />
                        </label>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => void load()}
                        disabled={listLoading}
                        aria-label="Refresh"
                        title="Refresh"
                        className="st-btn st-iconbtn"
                    >
                        <Icon name="refresh" size={18} />
                    </button>
                </div>
            </section>

            <div className="grid items-start gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
                <JoinCodeCard
                    facility={facility}
                    info={codeInfo}
                    loading={codeLoading}
                    error={codeError}
                    saving={savingCode}
                    onToggleEmployeeIds={toggleEmployeeIds}
                    onCopy={copy}
                />

                <section className="st-card gx-reveal" aria-labelledby="join-requests-title">
                    <span className="material-icons-round gx-mark" aria-hidden>pending_actions</span>
                    <div className="st-card__head">
                        <div className="st-card__id">
                            <span className="gx-ico"><Icon name="pending_actions" /></span>
                            <div className="min-w-0">
                                <h3 id="join-requests-title" className="st-card__title">Waiting for approval</h3>
                                <p className="st-card__sub">Approve to create their account, or reject if they don’t work here.</p>
                            </div>
                        </div>
                    </div>

                    {pendingInviteResends.length > 0 ? (
                        <div className="st-callout" style={{ margin: '0 20px 12px', display: 'block' }}>
                            <div className="flex items-center gap-2">
                                <Icon name="mark_email_unread" />
                                <strong>Invite email not sent</strong>
                            </div>
                            <p className="mt-1">The account was created, but the setup email failed. Resend it so they can set a password.</p>
                            <ul className="mt-2 grid gap-2">
                                {pendingInviteResends.map(item => (
                                    <li key={item.userId} className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="text-[12.5px] font-semibold text-(--text-primary)">{item.name}</span>
                                        <button
                                            type="button"
                                            disabled={resendingInviteIds.has(item.userId)}
                                            onClick={() => void resendInvite(item.userId)}
                                            className="st-btn st-btn--sm st-btn--primary"
                                        >
                                            <Icon name="send" size={14} />
                                            {resendingInviteIds.has(item.userId) ? 'Sending…' : 'Resend invite'}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    {selectedIds.length ? (
                        <div className="st-selbar">
                            <span className="st-selbar__count">{selectedIds.length} selected</span>
                            <div className="flex items-center gap-2">
                                {bulkConfirmReject ? (
                                    <>
                                        <span className="text-[12.5px] text-(--text-secondary)">Reject {selectedIds.length}?</span>
                                        <button type="button" onClick={() => setBulkConfirmReject(false)} className="st-btn st-btn--sm st-btn--ghost">Keep</button>
                                        <button type="button" onClick={() => void decide(selectedIds, 'reject')} className="st-btn st-btn--sm st-btn--danger">Reject</button>
                                    </>
                                ) : (
                                    <>
                                        <button type="button" onClick={() => setBulkConfirmReject(true)} className="st-btn st-btn--sm st-btn--reject">Reject</button>
                                        <button type="button" onClick={() => void decide(selectedIds, 'approve')} className="st-btn st-btn--sm st-btn--primary">
                                            <Icon name="done_all" size={15} /> Approve {selectedIds.length}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : null}

                    {listLoading ? (
                        <ul className="st-list">
                            {[0, 1, 2].map(key => (
                                <li key={key} className="st-row flex items-center gap-3">
                                    <Bone className="h-9 w-9 st-bone--round" />
                                    <div className="grid flex-1 gap-1.5"><Bone className="h-3.5 w-40" /><Bone className="h-3 w-56" /></div>
                                    <Bone className="h-8 w-40" />
                                </li>
                            ))}
                        </ul>
                    ) : listError ? (
                        <div className="st-empty">
                            <div className="st-empty__art st-empty__art--bad"><Icon name="cloud_off" /></div>
                            <p className="st-empty__title">{listError}</p>
                            <button type="button" onClick={() => void load()} className="st-btn">
                                <Icon name="refresh" /> Try again
                            </button>
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="st-empty">
                            <div className="st-empty__art"><Icon name="inbox" /></div>
                            <p className="st-empty__title">No one is waiting for approval.</p>
                            <p className="st-empty__text">
                                When staff sign up with your join code, their requests appear here for you to approve.
                            </p>
                            {codeInfo ? (
                                <button
                                    type="button"
                                    onClick={() => void copy(inviteMessage(facility?.name || 'our facility', codeInfo.code), 'Invite message')}
                                    className="st-btn"
                                >
                                    <Icon name="sms" /> Copy invite message
                                </button>
                            ) : null}
                        </div>
                    ) : (
                        <>
                            <div className={cn('st-list-head hidden items-center gap-x-3 lg:grid', ROW_GRID)}>
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={e => setSelected(e.target.checked ? new Set(filtered.map(item => item.id)) : new Set())}
                                    aria-label="Select all"
                                    className="st-check"
                                />
                                <div>Person</div>
                                <div>Employee ID</div>
                                <div>Role · placement</div>
                                <div className="text-right">Decision</div>
                            </div>
                            {filtered.length ? (
                                <ul className="st-list" style={{ paddingTop: 6 }}>
                                    {filtered.map(item => (
                                        <RequestRow
                                            key={item.id}
                                            request={item}
                                            selected={selected.has(item.id)}
                                            busy={busyIds.has(item.id)}
                                            confirmingReject={confirmRejectId === item.id}
                                            onSelect={next => setSelected(prev => {
                                                const copySet = new Set(prev);
                                                if (next) copySet.add(item.id); else copySet.delete(item.id);
                                                return copySet;
                                            })}
                                            onApprove={() => void decide([item.id], 'approve')}
                                            onAskReject={() => setConfirmRejectId(item.id)}
                                            onCancelReject={() => setConfirmRejectId('')}
                                            onConfirmReject={() => void decide([item.id], 'reject')}
                                        />
                                    ))}
                                </ul>
                            ) : (
                                <div className="st-empty" style={{ padding: '32px 20px' }}>
                                    <p className="st-empty__text">No requests match “{search}”.</p>
                                </div>
                            )}
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
