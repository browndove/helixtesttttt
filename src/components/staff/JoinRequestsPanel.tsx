'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    BadgeCheck,
    Check,
    Copy,
    Inbox,
    KeyRound,
    Mail,
    MessageSquareText,
    Phone,
    RotateCw,
    Search,
    ShieldAlert,
    X,
} from 'lucide-react';
import { API_ENDPOINTS } from '@/lib/config';
import { appendFacilityIdForProxy, resolveClientFacilityId } from '@/lib/facility-client';
import {
    apiErrorMessage,
    initials,
    parseJoinCode,
    parseJoinRequests,
    timeAgo,
    type JoinCodeInfo,
    type JoinRequest,
} from '@/lib/join-requests';
import { cn } from '@/lib/utils';

type Notify = (message: string, variant?: 'success' | 'error' | 'info') => void;
type Facility = { id: string; name: string };

const CARD = 'rounded-2xl bg-white ring-1 ring-slate-900/6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.05),0_8px_20px_-10px_rgba(15,23,42,0.10)]';
const ROW_GRID = 'lg:grid-cols-[20px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_220px]';

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
            className={cn(
                'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]/30 disabled:cursor-not-allowed disabled:opacity-60',
                checked ? 'bg-[#1E3A5F]' : 'bg-slate-200 shadow-[inset_0_1px_2px_rgba(15,23,42,0.12)]',
            )}
        >
            <span
                className={cn(
                    'inline-block h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.25)] transition-transform duration-200',
                    checked ? 'translate-x-5.5' : 'translate-x-0.5',
                )}
            />
        </button>
    );
}

function Bone({ className }: { className: string }) {
    return <div className={cn('animate-pulse rounded-md bg-slate-100', className)} />;
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
        <section className={cn(CARD, 'overflow-hidden xl:sticky xl:top-0')} aria-labelledby="join-code-title">
            <div className="p-5">
                <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF0F7] text-[#1E3A5F] ring-1 ring-[#1E3A5F]/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.06)]">
                        <KeyRound className="h-4.5 w-4.5" strokeWidth={1.9} />
                    </span>
                    <div className="min-w-0">
                        <div id="join-code-title" className="text-[15px] font-semibold leading-6 text-slate-900">Join code</div>
                        <p className="text-[12.5px] leading-5 text-slate-500">
                            Staff enter this in the Helix app to ask to join {facility?.name || 'your facility'}.
                        </p>
                    </div>
                </div>

                <div className="mt-5 rounded-xl bg-slate-50 px-4 py-5 text-center shadow-[inset_0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/5">
                    {loading ? (
                        <Bone className="mx-auto h-9 w-44" />
                    ) : info ? (
                        <div className="font-mono text-[28px] font-semibold tracking-[0.18em] text-slate-900 tabular-nums select-all">
                            {formatCode(info.code)}
                        </div>
                    ) : (
                        <div className="text-[13px] text-slate-500">{error || 'No join code for this facility yet.'}</div>
                    )}
                    {info?.expiresAt ? (
                        <div className="mt-1.5 text-[12px] text-slate-500">Valid until {new Date(info.expiresAt).toLocaleDateString()}</div>
                    ) : null}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        disabled={!info}
                        onClick={() => info && onCopy(info.code, 'Code')}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white text-[13px] font-medium text-slate-700 ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition hover:bg-slate-50 disabled:opacity-50"
                    >
                        <Copy className="h-3.5 w-3.5" strokeWidth={2} /> Copy code
                    </button>
                    <button
                        type="button"
                        disabled={!info}
                        onClick={() => info && onCopy(inviteMessage(facility?.name || 'our facility', info.code), 'Invite message')}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#1E3A5F] text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(15,23,42,0.15),0_4px_10px_-4px_rgba(30,58,95,0.5)] transition hover:bg-[#172E4B] disabled:opacity-50"
                    >
                        <MessageSquareText className="h-3.5 w-3.5" strokeWidth={2} /> Copy invite
                    </button>
                </div>
            </div>

            <div className="border-t border-slate-100 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="text-[13.5px] font-semibold text-slate-900">Ask for employee ID</div>
                        <p className="mt-0.5 text-[12.5px] leading-5 text-slate-500">
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
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-800 ring-1 ring-amber-200/70">
                        Make sure your staff are in the directory with their employee IDs, or they won’t be able to join.
                    </p>
                ) : null}
            </div>

            <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 shadow-[inset_0_1px_3px_rgba(15,23,42,0.035)]">
                <div className="mb-2.5 text-[12px] font-medium text-slate-500">How joining works</div>
                <ol className="grid gap-2.5">
                    {steps.map((step, index) => (
                        <li key={step} className="flex items-start gap-2.5 text-[12.5px] leading-5 text-slate-600">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-[#1E3A5F] ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                                {index + 1}
                            </span>
                            {step}
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}

function EmployeeIdChip({ request }: { request: JoinRequest }) {
    if (!request.employeeId) return <span className="text-[12.5px] text-slate-400">No employee ID</span>;
    const matched = request.employeeMatched;
    return (
        <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-700 ring-1 ring-slate-200/70">{request.employeeId}</span>
            {matched === true ? (
                <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-emerald-700">
                    <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2} /> In directory
                </span>
            ) : matched === false ? (
                <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-amber-700">
                    <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} /> Not in directory
                </span>
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
    const roleLine = [request.role, request.department].filter(Boolean).join(' · ');
    return (
        <li className={cn('grid grid-cols-[20px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-5 py-3.5 transition-colors', ROW_GRID, selected ? 'bg-[#F3F6FA]' : 'hover:bg-slate-50/70')}>
            <input
                type="checkbox"
                checked={selected}
                onChange={e => onSelect(e.target.checked)}
                aria-label={`Select ${request.fullName}`}
                className="h-4 w-4 rounded border-slate-300 accent-[#1E3A5F]"
            />
            <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-b from-white to-slate-100 text-[12.5px] font-semibold text-slate-700 ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
                    {initials(request.fullName)}
                </span>
                <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-semibold text-slate-900">{request.fullName}</div>
                    {contact.length ? (
                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 text-[12px] text-slate-500">
                            {request.email ? <span className="inline-flex min-w-0 items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" />{request.email}</span> : null}
                            {request.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{request.phone}</span> : null}
                        </div>
                    ) : null}
                </div>
            </div>
            <div className="col-start-2 min-w-0 lg:col-start-auto">
                <EmployeeIdChip request={request} />
            </div>
            <div className="col-start-2 min-w-0 lg:col-start-auto">
                <div className="truncate text-[12.5px] text-slate-700">{roleLine || <span className="text-slate-400">No role given</span>}</div>
                {request.submittedAt ? <div className="text-[12px] text-slate-400">{timeAgo(request.submittedAt)}</div> : null}
            </div>
            <div className="col-start-2 flex items-center justify-end gap-2 lg:col-start-auto">
                {confirmingReject ? (
                    <>
                        <span className="mr-1 text-[12.5px] text-slate-600">Reject?</span>
                        <button type="button" onClick={onCancelReject} disabled={busy} className="h-8 rounded-lg px-3 text-[12.5px] font-medium text-slate-600 hover:bg-slate-100">
                            Keep
                        </button>
                        <button type="button" onClick={onConfirmReject} disabled={busy} className="h-8 rounded-lg bg-red-600 px-3 text-[12.5px] font-medium text-white shadow-[0_1px_2px_rgba(15,23,42,0.15)] hover:bg-red-700 disabled:opacity-60">
                            {busy ? 'Rejecting…' : 'Reject'}
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={onAskReject}
                            disabled={busy}
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-3 text-[12.5px] font-medium text-slate-600 ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition hover:text-red-700 hover:ring-red-200 disabled:opacity-60"
                        >
                            <X className="h-3.5 w-3.5" strokeWidth={2} /> Reject
                        </button>
                        <button
                            type="button"
                            onClick={onApprove}
                            disabled={busy}
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#1E3A5F] px-3 text-[12.5px] font-medium text-white shadow-[0_1px_2px_rgba(15,23,42,0.15),0_4px_10px_-4px_rgba(30,58,95,0.5)] transition hover:bg-[#172E4B] disabled:opacity-60"
                        >
                            <Check className="h-3.5 w-3.5" strokeWidth={2.25} /> {busy ? 'Approving…' : 'Approve'}
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
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(apiErrorMessage(data, `Request failed (${res.status})`));
            return id;
        }));
        const done = new Set(results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : [])));
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

        if (done.size) {
            const name = ids.length === 1 ? requests.find(item => item.id === ids[0])?.fullName : '';
            const verb = decision === 'approve' ? 'Approved' : 'Rejected';
            onNotify(name ? `${verb} ${name}` : `${verb} ${done.size} request${done.size === 1 ? '' : 's'}`, 'success');
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
        <div className="grid items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
            <JoinCodeCard
                facility={facility}
                info={codeInfo}
                loading={codeLoading}
                error={codeError}
                saving={savingCode}
                onToggleEmployeeIds={toggleEmployeeIds}
                onCopy={copy}
            />

            <section className={cn(CARD, 'min-w-0 overflow-hidden')} aria-labelledby="join-requests-title">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <div id="join-requests-title" className="text-[15px] font-semibold leading-6 text-slate-900">Waiting for approval</div>
                            {!listLoading && requests.length ? (
                                <span className="rounded-full bg-[#1E3A5F] px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums shadow-[0_1px_2px_rgba(30,58,95,0.3)]">
                                    {requests.length}
                                </span>
                            ) : null}
                        </div>
                        <p className="text-[12.5px] text-slate-500">Check each person works here before you approve them.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {!listLoading && !listError && requests.length > 0 ? (
                            <label className="relative">
                                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Employee ID or name"
                                    aria-label="Search by employee ID or name"
                                    className="h-8 w-[220px] rounded-lg bg-white pl-8 pr-3 text-[12.5px] text-slate-800 ring-1 ring-slate-200 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none placeholder:text-slate-400 focus:ring-[#1E3A5F]/40"
                                />
                            </label>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => void load()}
                            disabled={listLoading}
                            aria-label="Refresh"
                            title="Refresh"
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition hover:text-slate-800 disabled:opacity-60"
                        >
                            <RotateCw className={cn('h-3.5 w-3.5', listLoading && 'animate-spin')} strokeWidth={2} />
                        </button>
                    </div>
                </div>

                {selectedIds.length ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-y border-[#E3EAF3] bg-[#F3F6FA] px-5 py-2.5">
                        <span className="text-[12.5px] font-medium text-[#1E3A5F]">{selectedIds.length} selected</span>
                        <div className="flex items-center gap-2">
                            {bulkConfirmReject ? (
                                <>
                                    <span className="text-[12.5px] text-slate-600">Reject {selectedIds.length}?</span>
                                    <button type="button" onClick={() => setBulkConfirmReject(false)} className="h-8 rounded-lg px-3 text-[12.5px] font-medium text-slate-600 hover:bg-white">Keep</button>
                                    <button type="button" onClick={() => void decide(selectedIds, 'reject')} className="h-8 rounded-lg bg-red-600 px-3 text-[12.5px] font-medium text-white hover:bg-red-700">Reject</button>
                                </>
                            ) : (
                                <>
                                    <button type="button" onClick={() => setBulkConfirmReject(true)} className="h-8 rounded-lg bg-white px-3 text-[12.5px] font-medium text-slate-600 ring-1 ring-slate-200 hover:text-red-700">Reject</button>
                                    <button type="button" onClick={() => void decide(selectedIds, 'approve')} className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#1E3A5F] px-3 text-[12.5px] font-medium text-white shadow-[0_1px_2px_rgba(15,23,42,0.15)] hover:bg-[#172E4B]">
                                        <Check className="h-3.5 w-3.5" strokeWidth={2.25} /> Approve {selectedIds.length}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ) : null}

                {listLoading ? (
                    <ul className="divide-y divide-slate-100 border-t border-slate-100">
                        {[0, 1, 2].map(key => (
                            <li key={key} className="flex items-center gap-3 px-5 py-4">
                                <Bone className="h-9 w-9 rounded-full" />
                                <div className="grid flex-1 gap-1.5"><Bone className="h-3.5 w-40" /><Bone className="h-3 w-56" /></div>
                                <Bone className="h-8 w-40" />
                            </li>
                        ))}
                    </ul>
                ) : listError ? (
                    <div className="border-t border-slate-100 px-5 py-10 text-center">
                        <div className="text-[13.5px] font-medium text-slate-800">{listError}</div>
                        <button type="button" onClick={() => void load()} className="mt-3 h-8 rounded-lg bg-white px-3 text-[12.5px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">Try again</button>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="border-t border-slate-100 px-5 py-14 text-center">
                        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_6px_14px_-8px_rgba(15,23,42,0.18)]">
                            <Inbox className="h-5 w-5" strokeWidth={1.8} />
                        </span>
                        <div className="mt-4 text-[14px] font-semibold text-slate-900">No one is waiting</div>
                        <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-5 text-slate-500">
                            When staff sign up with your join code, their requests appear here for you to approve.
                        </p>
                        {codeInfo ? (
                            <button
                                type="button"
                                onClick={() => void copy(inviteMessage(facility?.name || 'our facility', codeInfo.code), 'Invite message')}
                                className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-[12.5px] font-medium text-slate-700 ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:bg-slate-50"
                            >
                                <MessageSquareText className="h-3.5 w-3.5" strokeWidth={2} /> Copy invite message
                            </button>
                        ) : null}
                    </div>
                ) : (
                    <>
                        <div className={cn('hidden items-center gap-x-3 border-y border-slate-100 bg-slate-50/80 px-5 py-2 text-[11.5px] font-medium uppercase tracking-wide text-slate-500 lg:grid', ROW_GRID)}>
                            <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={e => setSelected(e.target.checked ? new Set(filtered.map(item => item.id)) : new Set())}
                                aria-label="Select all"
                                className="h-4 w-4 rounded border-slate-300 accent-[#1E3A5F]"
                            />
                            <div>Person</div>
                            <div>Employee ID</div>
                            <div>Role · submitted</div>
                            <div className="text-right">Decision</div>
                        </div>
                        {filtered.length ? (
                            <ul className="divide-y divide-slate-100">
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
                            <div className="px-5 py-8 text-center text-[13px] text-slate-500">No requests match “{search}”.</div>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}
