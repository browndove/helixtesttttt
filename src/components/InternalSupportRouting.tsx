'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_ENDPOINTS } from '@/lib/config';
import {
    apiErrorMessage,
    movedConversationsCount,
    parseSupportRouting,
    type SupportFacility,
    type SupportRole,
    type SupportRoutingPayload,
} from '@/lib/helix-support-routing';
import { MacVibrancyToast, MacVibrancyToastPortal } from '@/components/MacVibrancyToast';
import InternalAdminShell from '@/components/InternalAdminShell';
import CustomSelect from '@/components/CustomSelect';
import './internal-admin-dashboard.css';

const DEFAULT_VALUE = '__default__';
const FILTER_ALL = 'all';
const FILTER_DEFAULT = 'default';

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function shortRoleLabel(name: string): string {
    return name.replace(/^HH\s*[-–—]\s*/i, '').trim() || name;
}

export default function InternalSupportRouting() {
    const [payload, setPayload] = useState<SupportRoutingPayload>({ supportRoles: [], facilities: [] });
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<string>(FILTER_ALL);
    const [savingDefault, setSavingDefault] = useState(false);
    const [savingFacilityId, setSavingFacilityId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3200);
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await fetch(API_ENDPOINTS.INTERNAL_HELIX_SUPPORT_ROUTING, {
                credentials: 'include',
                cache: 'no-store',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const message = apiErrorMessage(data, `Could not load support routing (${res.status}).`);
                setLoadError(message);
                showToast(message, 'error');
                setPayload({ supportRoles: [], facilities: [] });
                return;
            }
            setPayload(parseSupportRouting(data));
        } catch {
            const message = 'Could not load support routing.';
            setLoadError(message);
            showToast(message, 'error');
            setPayload({ supportRoles: [], facilities: [] });
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        void load();
    }, [load]);

    const defaultRole = useMemo(
        () => payload.supportRoles.find(role => role.isDefault) || null,
        [payload.supportRoles],
    );

    const roleNameById = useMemo(() => {
        const map = new Map<string, string>();
        for (const role of payload.supportRoles) map.set(role.id, role.name);
        return map;
    }, [payload.supportRoles]);

    const routedCountByRole = useMemo(() => {
        const counts = new Map<string, number>();
        for (const facility of payload.facilities) {
            const key = facility.routedRoleId || '';
            if (!key) continue;
            counts.set(key, (counts.get(key) || 0) + 1);
        }
        return counts;
    }, [payload.facilities]);

    const explicitCountByRole = useMemo(() => {
        const counts = new Map<string, number>();
        for (const facility of payload.facilities) {
            if (!facility.assignedRoleId) continue;
            counts.set(facility.assignedRoleId, (counts.get(facility.assignedRoleId) || 0) + 1);
        }
        return counts;
    }, [payload.facilities]);

    const defaultFacilityCount = useMemo(
        () => payload.facilities.filter(f => !f.assignedRoleId).length,
        [payload.facilities],
    );

    const roleOptions = useMemo(() => {
        const options = payload.supportRoles.map(role => ({
            label: role.isDefault
                ? `${shortRoleLabel(role.name)} (default)`
                : shortRoleLabel(role.name),
            value: role.id,
            triggerLabel: shortRoleLabel(role.name),
        }));
        return [
            { label: 'Use default', value: DEFAULT_VALUE, triggerLabel: 'Default' },
            ...options,
        ];
    }, [payload.supportRoles]);

    const filteredFacilities = useMemo(() => {
        const q = search.trim().toLowerCase();
        return payload.facilities.filter(facility => {
            if (filter === FILTER_DEFAULT && facility.assignedRoleId) return false;
            if (filter !== FILTER_ALL && filter !== FILTER_DEFAULT) {
                if (facility.routedRoleId !== filter) return false;
            }
            if (!q) return true;
            return (
                facility.name.toLowerCase().includes(q)
                || facility.code.toLowerCase().includes(q)
            );
        });
    }, [payload.facilities, search, filter]);

    const setDefaultRole = async (roleId: string) => {
        if (!roleId || savingDefault || defaultRole?.id === roleId) return;
        setSavingDefault(true);
        try {
            const res = await fetch(API_ENDPOINTS.INTERNAL_HELIX_SUPPORT_DEFAULT, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ support_role_id: roleId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                showToast(apiErrorMessage(data, 'Could not update the default support role.'), 'error');
                return;
            }
            showToast('Default support role updated.', 'success');
            await load();
        } catch {
            showToast('Could not update the default support role.', 'error');
        } finally {
            setSavingDefault(false);
        }
    };

    const assignFacility = async (facility: SupportFacility, nextValue: string) => {
        const nextAssigned = nextValue === DEFAULT_VALUE ? null : nextValue;
        const currentAssigned = facility.assignedRoleId;
        if ((currentAssigned || null) === (nextAssigned || null) || savingFacilityId) return;

        setSavingFacilityId(facility.facilityId);
        try {
            const res = await fetch(API_ENDPOINTS.INTERNAL_HELIX_SUPPORT_FACILITY(facility.facilityId), {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ support_role_id: nextAssigned }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                showToast(apiErrorMessage(data, 'Could not update facility routing.'), 'error');
                return;
            }
            const moved = movedConversationsCount(data);
            const roleLabel = nextAssigned
                ? shortRoleLabel(roleNameById.get(nextAssigned) || 'selected role')
                : 'default';
            showToast(
                moved > 0
                    ? `${facility.name} → ${roleLabel}. Moved ${moved} conversation${moved === 1 ? '' : 's'}.`
                    : `${facility.name} → ${roleLabel}.`,
                'success',
            );
            await load();
        } catch {
            showToast('Could not update facility routing.', 'error');
        } finally {
            setSavingFacilityId(null);
        }
    };

    return (
        <>
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast.message} variant={toast.type} dismissible={false} />
                </MacVibrancyToastPortal>
            )}

            <InternalAdminShell>
                <div className="internal-dash__page-header">
                    <div className="internal-dash__page-header-row">
                        <div>
                            <h1 className="internal-dash__title">Support routing</h1>
                            <p className="internal-dash__subtitle">
                                Staff still message Tech Support. This decides which assistant receives each facility.
                            </p>
                        </div>
                        <button
                            type="button"
                            className="internal-dash__btn internal-dash__btn--outline"
                            onClick={() => { void load(); }}
                            disabled={loading}
                        >
                            <span className="material-icons-round" style={{ fontSize: 16 }}>refresh</span>
                            Refresh
                        </button>
                    </div>
                </div>

                <main className="internal-dash__main">
                    {loadError ? (
                        <p className="internal-support__error" role="alert">{loadError}</p>
                    ) : null}

                    <section className="isr-assistants" aria-label="Support assistants">
                        {loading ? (
                            <div className="isr-assistant isr-assistant--skeleton">
                                <div className="isr-assistant__avatar" />
                                <div className="isr-assistant__body">
                                    <div className="isr-skeleton-line" style={{ width: '55%' }} />
                                    <div className="isr-skeleton-line" style={{ width: '40%' }} />
                                </div>
                            </div>
                        ) : payload.supportRoles.length === 0 ? (
                            <div className="isr-empty">
                                No support assistants yet. Create a Helix Health role marked as a support role
                                with external messaging, then refresh.
                            </div>
                        ) : (
                            payload.supportRoles.map((role: SupportRole) => {
                                const person = role.signedInName || 'Nobody signed in';
                                const routed = routedCountByRole.get(role.id) || 0;
                                const explicit = explicitCountByRole.get(role.id) || 0;
                                const selected = filter === role.id;
                                return (
                                    <div
                                        key={role.id}
                                        className={[
                                            'isr-assistant',
                                            role.isDefault ? 'isr-assistant--default' : '',
                                            selected ? 'isr-assistant--selected' : '',
                                        ].filter(Boolean).join(' ')}
                                    >
                                        <button
                                            type="button"
                                            className="isr-assistant__select"
                                            onClick={() => setFilter(selected ? FILTER_ALL : role.id)}
                                            aria-pressed={selected}
                                        >
                                            <div className="isr-assistant__avatar" aria-hidden>
                                                {initials(role.signedInName || shortRoleLabel(role.name))}
                                            </div>
                                            <div className="isr-assistant__body">
                                                <div className="isr-assistant__top">
                                                    <span className="isr-assistant__name">{person}</span>
                                                    {role.isDefault ? (
                                                        <span className="isr-pill">Default</span>
                                                    ) : null}
                                                </div>
                                                <div className="isr-assistant__role">{shortRoleLabel(role.name)}</div>
                                                <div className="isr-assistant__meta">
                                                    {routed} facilit{routed === 1 ? 'y' : 'ies'} routed
                                                    {explicit > 0 ? ` · ${explicit} assigned` : ''}
                                                </div>
                                            </div>
                                        </button>
                                        {!role.isDefault ? (
                                            <button
                                                type="button"
                                                className="isr-assistant__action"
                                                disabled={savingDefault}
                                                onClick={() => { void setDefaultRole(role.id); }}
                                            >
                                                {savingDefault ? 'Saving…' : 'Make default'}
                                            </button>
                                        ) : null}
                                    </div>
                                );
                            })
                        )}
                    </section>

                    {payload.supportRoles.length === 1 ? (
                        <p className="isr-hint">
                            Add a second Helix Health support role to split facilities between assistants
                            (for example David vs Reginald). Until then, everything uses the default.
                        </p>
                    ) : payload.supportRoles.length > 1 ? (
                        <p className="isr-hint">
                            For cover, one person can sign into both roles. Facility assignments stay the same.
                        </p>
                    ) : null}

                    <section className="isr-board">
                        <div className="isr-board__toolbar">
                            <div className="internal-dash__filter-pills" role="tablist" aria-label="Filter facilities">
                                <button
                                    type="button"
                                    className={`internal-dash__filter-pill${filter === FILTER_ALL ? ' internal-dash__filter-pill--active' : ''}`}
                                    onClick={() => setFilter(FILTER_ALL)}
                                >
                                    All ({payload.facilities.length})
                                </button>
                                <button
                                    type="button"
                                    className={`internal-dash__filter-pill${filter === FILTER_DEFAULT ? ' internal-dash__filter-pill--active' : ''}`}
                                    onClick={() => setFilter(FILTER_DEFAULT)}
                                >
                                    On default ({defaultFacilityCount})
                                </button>
                                {payload.supportRoles.map(role => (
                                    <button
                                        key={role.id}
                                        type="button"
                                        className={`internal-dash__filter-pill${filter === role.id ? ' internal-dash__filter-pill--active' : ''}`}
                                        onClick={() => setFilter(role.id)}
                                    >
                                        {role.signedInName
                                            ? role.signedInName.split(/\s+/)[0]
                                            : shortRoleLabel(role.name)}
                                        {' '}
                                        ({routedCountByRole.get(role.id) || 0})
                                    </button>
                                ))}
                            </div>
                            <div className="internal-dash__search-wrap isr-board__search">
                                <span className="material-icons-round internal-dash__search-icon" aria-hidden>
                                    search
                                </span>
                                <input
                                    className="internal-dash__input"
                                    placeholder="Find a facility…"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        {defaultRole && filter === FILTER_ALL ? (
                            <p className="isr-board__note">
                                Unassigned facilities go to{' '}
                                <strong>{defaultRole.signedInName || shortRoleLabel(defaultRole.name)}</strong>
                                {' '}({shortRoleLabel(defaultRole.name)}).
                            </p>
                        ) : null}

                        {loading ? (
                            <p className="internal-support__muted">Loading facilities…</p>
                        ) : filteredFacilities.length === 0 ? (
                            <div className="isr-empty isr-empty--inset">
                                {search.trim() || filter !== FILTER_ALL
                                    ? 'No facilities match this filter.'
                                    : 'No facilities found.'}
                            </div>
                        ) : (
                            <ul className="isr-facility-list">
                                {filteredFacilities.map(facility => {
                                    const selectValue = facility.assignedRoleId || DEFAULT_VALUE;
                                    const routedName = facility.routedRoleId
                                        ? shortRoleLabel(roleNameById.get(facility.routedRoleId) || 'Unknown')
                                        : '—';
                                    const routedPerson = facility.routedRoleId
                                        ? (
                                            payload.supportRoles.find(r => r.id === facility.routedRoleId)?.signedInName
                                            || null
                                        )
                                        : null;
                                    const busy = savingFacilityId === facility.facilityId;
                                    return (
                                        <li key={facility.facilityId} className="isr-facility">
                                            <div className="isr-facility__main">
                                                <div className="isr-facility__name">{facility.name}</div>
                                                <div className="isr-facility__sub">
                                                    {facility.code ? (
                                                        <span className="isr-facility__code">{facility.code}</span>
                                                    ) : null}
                                                    <span className="isr-facility__route">
                                                        {routedPerson || routedName}
                                                        {!facility.assignedRoleId ? ' · default' : ''}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="isr-facility__assign">
                                                <CustomSelect
                                                    value={selectValue}
                                                    onChange={v => { void assignFacility(facility, v); }}
                                                    options={roleOptions}
                                                    placeholder="Default"
                                                    disabled={busy || payload.supportRoles.length === 0}
                                                    style={{ minWidth: 180 }}
                                                />
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                </main>
            </InternalAdminShell>
        </>
    );
}
