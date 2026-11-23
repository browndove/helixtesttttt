'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import TopBar from '@/components/TopBar';
import CustomSelect from '@/components/CustomSelect';
import { MacVibrancyToast, MacVibrancyToastPortal } from '@/components/MacVibrancyToast';
import { appendFacilityIdForProxy } from '@/lib/facility-client';
import { API_ENDPOINTS } from '@/lib/config';
import { HeroKpi, HeroKpis, SplitBar } from '@/components/glass/hero';
import { MiniBars, Ring } from '@/components/glass/kpi';
import '@/components/glass/glass-page.css';
import '@/components/glass/glass-kit.css';
import '@/components/glass/staff-glass.css';

type RoleRow = {
    id: string;
    name: string;
    department: string;
    external_messaging: boolean;
    is_transfer_role: boolean;
};

function readIsTransferRoleFromRaw(raw: Record<string, unknown>): boolean {
    const keys = ['is_transfer_role', 'transfer_role', 'isTransferRole'] as const;
    for (const k of keys) {
        if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
        const v = raw[k as string];
        if (v === true || v === 1) return true;
        if (v === false || v === 0) return false;
        if (typeof v === 'string') {
            const s = v.trim().toLowerCase();
            if (s === 'true' || s === '1' || s === 'yes') return true;
            if (s === 'false' || s === '0' || s === 'no' || s === '') return false;
        }
        if (v == null) continue;
        return Boolean(v);
    }
    return false;
}

function parseRolesPayload(data: unknown): RoleRow[] {
    const raw = Array.isArray(data) ? data : [];
    const out: RoleRow[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const r = item as Record<string, unknown>;
        const id = typeof r.id === 'string' ? r.id : '';
        if (!id) continue;
        const name = typeof r.name === 'string' ? r.name : 'Unnamed role';
        let department = '';
        const dn = r.department_name;
        if (typeof dn === 'string' && dn.trim()) department = dn.trim();
        else if (r.department && typeof r.department === 'object' && !Array.isArray(r.department)) {
            const n = (r.department as Record<string, unknown>).name;
            if (typeof n === 'string') department = n.trim();
        } else if (typeof r.department === 'string') department = r.department.trim();
        const em = r.external_messaging;
        const external_messaging = em === true || em === 'true' || em === 1;
        const is_transfer_role = readIsTransferRoleFromRaw(r);
        out.push({ id, name, department, external_messaging, is_transfer_role });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}

function facilityExternalDefaultTrue(rec: Record<string, unknown>): boolean {
    const v = rec.external_messaging_enabled;
    if (v === false || v === 'false' || v === 0) return false;
    return true;
}

export default function ExternalCommunicationManagement() {
    const [facilityId, setFacilityId] = useState<string | null>(null);
    const [facilityEnabled, setFacilityEnabled] = useState(true);
    const [draftFacilityEnabled, setDraftFacilityEnabled] = useState(true);
    const [roles, setRoles] = useState<RoleRow[]>([]);
    const [roleExternal, setRoleExternal] = useState<Record<string, boolean>>({});
    const [addedListSearch, setAddedListSearch] = useState('');
    const [addRolePickerId, setAddRolePickerId] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    const showToast = useCallback((msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2800);
    }, []);

    const externalRoleCount = useMemo(
        () => Object.values(roleExternal).filter(Boolean).length,
        [roleExternal],
    );

    /** External messaging roles plus all transfer roles (transfer flag is separate on Roles page). */
    const addedRoles = useMemo(
        () => roles.filter(r => roleExternal[r.id] || r.is_transfer_role).sort((a, b) => a.name.localeCompare(b.name)),
        [roles, roleExternal],
    );

    const filteredAddedRoles = useMemo(() => {
        const q = addedListSearch.trim().toLowerCase();
        if (!q) return addedRoles;
        return addedRoles.filter(r => {
            const name = r.name.toLowerCase();
            const dept = (r.department || '').toLowerCase();
            return name.includes(q) || (!!dept && dept.includes(q));
        });
    }, [addedRoles, addedListSearch]);

    const rolesAvailableToAdd = useMemo(
        () => roles.filter(r => !roleExternal[r.id] && !r.is_transfer_role).sort((a, b) => a.name.localeCompare(b.name)),
        [roles, roleExternal],
    );

    const addRoleFromPicker = () => {
        const id = addRolePickerId.trim();
        if (!id) return;
        setRoleExternal(prev => ({ ...prev, [id]: true }));
        setAddRolePickerId('');
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const hRes = await fetch('/api/proxy/hospital');
            if (!hRes.ok) {
                showToast('Could not load facility');
                setLoading(false);
                return;
            }
            const hospital = await hRes.json();
            const fid = typeof hospital?.id === 'string' ? hospital.id : '';
            if (!fid) {
                showToast('No facility in session');
                setLoading(false);
                return;
            }
            setFacilityId(fid);

            const fRes = await fetch(`/api/proxy/facilities/${fid}`);
            if (fRes.ok) {
                const fac = await fRes.json();
                const rec = fac && typeof fac === 'object' ? (fac as Record<string, unknown>) : {};
                const enabled = facilityExternalDefaultTrue(rec);
                setFacilityEnabled(enabled);
                setDraftFacilityEnabled(enabled);
            } else {
                setFacilityEnabled(true);
                setDraftFacilityEnabled(true);
            }

            const rRes = await fetch('/api/proxy/roles');
            if (rRes.ok) {
                const data = await rRes.json();
                const list = parseRolesPayload(data);
                setRoles(list);
                const map: Record<string, boolean> = {};
                for (const r of list) {
                    // Transfer roles must remain external contacts (Explore + transfer workflows).
                    map[r.id] = Boolean(r.external_messaging || r.is_transfer_role);
                }
                setRoleExternal(map);
            } else {
                setRoles([]);
                setRoleExternal({});
            }
        } catch {
            showToast('Failed to load external communication settings');
        }
        setLoading(false);
    }, [showToast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const toggleRoleExternal = (roleId: string, next: boolean) => {
        const role = roles.find(r => r.id === roleId);
        if (!next && role?.is_transfer_role) {
            showToast('Transfer roles stay on this list. Turn off Transfer role under Setup → Roles to remove.');
            return;
        }
        if (!next && draftFacilityEnabled) {
            const others = externalRoleCount - (roleExternal[roleId] ? 1 : 0);
            if (others < 1) {
                showToast('At least one role must stay on the list while external communication is on');
                return;
            }
        }
        setRoleExternal(prev => ({ ...prev, [roleId]: next }));
    };

    const save = async () => {
        if (!facilityId) return;
        if (draftFacilityEnabled && externalRoleCount === 0) {
            showToast('Add at least one role for external messaging, or turn off facility external communication');
            return;
        }
        setSaving(true);
        try {
            let facRes = await fetch(
                await appendFacilityIdForProxy(API_ENDPOINTS.FACILITY_EXTERNAL_MESSAGING(facilityId)),
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ external_messaging_enabled: draftFacilityEnabled }),
                },
            );
            if (facRes.status === 404) {
                facRes = await fetch(
                    await appendFacilityIdForProxy(API_ENDPOINTS.FACILITY(facilityId)),
                    {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ external_messaging_enabled: draftFacilityEnabled }),
                    },
                );
            }
            if (!facRes.ok) {
                const err = await facRes.json().catch(() => ({} as { error?: string; detail?: string; message?: string }));
                const msg = String(err.error || err.message || err.detail || 'Failed to update facility');
                if (facRes.status === 403) {
                    showToast(msg.includes('access') ? msg : 'You do not have access to this facility');
                } else {
                    showToast(msg);
                }
                setSaving(false);
                return;
            }
            setFacilityEnabled(draftFacilityEnabled);

            for (const r of roles) {
                const was = r.external_messaging;
                const now = Boolean(roleExternal[r.id] || r.is_transfer_role);
                if (was === now) continue;
                const putRes = await fetch(`/api/proxy/roles/${r.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ external_messaging: now }),
                });
                if (!putRes.ok) {
                    const err = await putRes.json().catch(() => ({} as { error?: string }));
                    showToast(String(err.error || `Failed to update role: ${r.name}`));
                    setSaving(false);
                    return;
                }
            }

            setRoles(prev => prev.map(r => ({
                ...r,
                external_messaging: Boolean(roleExternal[r.id] || r.is_transfer_role),
            })));
            showToast('External communication settings saved');
        } catch {
            showToast('Failed to save');
        }
        setSaving(false);
    };

    const dirty =
        draftFacilityEnabled !== facilityEnabled
        || roles.some(r => Boolean(roleExternal[r.id] || r.is_transfer_role) !== r.external_messaging);

    if (loading) {
        return (
                <div className="app-main gx-page">
                    <TopBar title="External communication" subtitle="Cross-facility messaging for this facility" />
                    <main style={{ flex: 1, width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '20px 24px 28px', background: 'var(--bg-900)' }}>
                        <div className="card gx-empty" style={{ width: '100%', boxSizing: 'border-box', color: 'var(--text-muted)', fontSize: 13 }}>
                            <span className="gx-empty__art"><span className="material-icons-round">hourglass_empty</span></span>
                            Loading…
                        </div>
                    </main>
                </div>
        );
    }

    return (
        <>
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast} variant="info" dismissible={false} />
                </MacVibrancyToastPortal>
            )}

            <div className="app-main gx-page" style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <TopBar title="External communication" subtitle="Cross-facility role messaging for this facility" />

                <main style={{
                    flex: 1,
                    width: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box',
                    overflow: 'auto',
                    padding: '20px 24px 28px',
                    background: 'var(--bg-900)',
                }}
                >
                    {(() => {
                        const transfer = addedRoles.filter(r => r.is_transfer_role).length;
                        const reachPct = roles.length > 0 ? Math.round((addedRoles.length / roles.length) * 100) : 0;
                        const deptCounts = new Map<string, number>();
                        for (const r of addedRoles) {
                            const dept = r.department.trim();
                            if (dept) deptCounts.set(dept, (deptCounts.get(dept) ?? 0) + 1);
                        }
                        const byDept = [...deptCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6);
                        return (
                            <HeroKpis label="External communication overview" mark="forum">
                                <HeroKpi
                                    tone={draftFacilityEnabled ? 'mint' : 'amber'}
                                    icon={draftFacilityEnabled ? 'wifi_tethering' : 'portable_wifi_off'}
                                    label="Facility"
                                    value={draftFacilityEnabled ? 'On' : 'Off'}
                                    art={(
                                        <span className={`sx-radar${draftFacilityEnabled ? ' is-live' : ''}`} aria-hidden>
                                            <span className="sx-radar__ring" />
                                            <span className="sx-radar__ring sx-radar__ring--2" />
                                            <span className="sx-radar__dot" />
                                        </span>
                                    )}
                                    foot={draftFacilityEnabled ? 'Open to participating facilities' : 'In-facility messaging only'}
                                />
                                <HeroKpi
                                    tone="navy"
                                    icon="badge"
                                    label="Roles that can message out"
                                    value={addedRoles.length.toLocaleString()}
                                    art={<Ring pct={reachPct} size={56}>{roles.length > 0 ? `${reachPct}%` : '—'}</Ring>}
                                    foot={`of ${roles.length} role${roles.length === 1 ? '' : 's'} in this facility`}
                                />
                                <HeroKpi
                                    tone="sky"
                                    icon="swap_horiz"
                                    label="Transfer roles"
                                    value={transfer.toLocaleString()}
                                    art={addedRoles.length > 0 ? (
                                        <SplitBar
                                            label={`${transfer} transfer roles, ${addedRoles.length - transfer} added by hand`}
                                            parts={[
                                                { label: 'Transfer roles', n: transfer, color: '#2f6fb8' },
                                                { label: 'Added by hand', n: addedRoles.length - transfer, color: 'rgba(47, 111, 184, 0.22)' },
                                            ]}
                                        />
                                    ) : undefined}
                                    foot="Included automatically"
                                />
                                <HeroKpi
                                    tone="amber"
                                    icon="domain"
                                    label="Departments reached"
                                    value={deptCounts.size.toLocaleString()}
                                    art={byDept.length > 1 ? <MiniBars values={byDept.map(([, n]) => n)} labels={byDept.map(([d]) => d)} /> : undefined}
                                    foot={deptCounts.size > 0 ? 'With at least one external role' : 'No roles added yet'}
                                />
                            </HeroKpis>
                        );
                    })()}

                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>

                        <div className="card gx-mark-card" style={{ padding: '20px 22px', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                            <span className="material-icons-round gx-mark" aria-hidden>forum</span>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                                <span className="gx-name__icon"><span className="material-icons-round">domain</span></span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Facility</h2>
                                    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: 1.5 }}>
                                        On by default. Off disables external messaging here and in the app.
                                    </p>
                                </div>
                            </div>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 14px',
                                borderRadius: 14,
                                background: draftFacilityEnabled ? 'rgba(47,111,184,0.07)' : 'rgba(27,42,68,0.04)',
                                transition: 'background 0.2s',
                            }}
                            >
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>Allow external communication</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                        {draftFacilityEnabled ? 'Open to all participating facilities (send and receive)' : 'Only in-facility messaging'}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="gx-switch"
                                    aria-pressed={draftFacilityEnabled}
                                    aria-label="Allow external communication"
                                    onClick={() => setDraftFacilityEnabled(!draftFacilityEnabled)}
                                />
                            </div>

                            {draftFacilityEnabled && externalRoleCount === 0 && (
                                <div className="gx-callout" style={{ marginTop: 12 }}>
                                    <span className="material-icons-round" aria-hidden>info</span>
                                    Add at least one role in the list below before you can save with external communication on.
                                </div>
                            )}

                            <div style={{
                                borderTop: '1px solid var(--border-subtle)',
                                marginTop: 24,
                                paddingTop: 24,
                                opacity: draftFacilityEnabled ? 1 : 0.4,
                                pointerEvents: draftFacilityEnabled ? 'auto' : 'none',
                                transition: 'opacity 0.25s ease',
                            }}>

                            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span className="gx-ico"><span className="material-icons-round">badge</span></span>
                                External messaging roles
                            </h2>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
                                Add duty roles that may send or receive cross-facility messages when this facility allows it. Transfer roles appear automatically with a tag. If external communication is on, keep at least one role with external messaging enabled.
                            </p>

                            {roles.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
                                    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                                        <label className="label" style={{ marginBottom: 6 }}>Add role</label>
                                        <CustomSelect
                                            value={addRolePickerId}
                                            onChange={v => setAddRolePickerId(v)}
                                            options={rolesAvailableToAdd.map(r => ({
                                                label: r.department ? `${r.name} — ${r.department}` : r.name,
                                                value: r.id,
                                            }))}
                                            placeholder={rolesAvailableToAdd.length === 0 ? 'All roles are already added' : '-- Select a role --'}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={addRoleFromPicker}
                                        disabled={!addRolePickerId.trim() || rolesAvailableToAdd.length === 0}
                                        style={{ flexShrink: 0 }}
                                    >
                                        <span className="material-icons-round" style={{ fontSize: 14 }}>add</span>
                                        Add
                                    </button>
                                </div>
                            )}

                            {addedRoles.length > 0 && (
                                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
                                    <div style={{ position: 'relative', maxWidth: 280, width: '100%' }}>
                                        <span className="material-icons-round" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--text-disabled)', pointerEvents: 'none' }}>search</span>
                                        <input
                                            className="input"
                                            placeholder="Search added roles…"
                                            value={addedListSearch}
                                            onChange={e => setAddedListSearch(e.target.value)}
                                            style={{ paddingLeft: 30, fontSize: 12.5, height: 32 }}
                                        />
                                    </div>
                                </div>
                            )}

                            {roles.length === 0 ? (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0' }}>No roles found. Create roles under Setup → Roles first.</div>
                            ) : addedRoles.length === 0 ? (
                                <div className="gx-empty" style={{ fontSize: 13, color: 'var(--text-muted)', borderRadius: 16, border: '1.5px dashed rgba(47,111,184,0.3)', background: 'rgba(47,111,184,0.04)' }}>
                                    <span className="gx-empty__art"><span className="material-icons-round">forum</span></span>
                                    No roles added yet. Choose a role above and click Add.
                                </div>
                            ) : filteredAddedRoles.length === 0 ? (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0' }}>No added roles match this search.</div>
                            ) : (
                                <div style={{ border: '1px solid rgba(27,42,68,0.07)', borderRadius: 16, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 2px rgba(27,42,68,0.04), 0 10px 22px -16px rgba(27,42,68,0.35)' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(100px, auto)', gap: 0, background: 'rgba(244,247,251,0.85)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px' }}>
                                        <span>Role</span>
                                        <span style={{ textAlign: 'right' }}>Remove</span>
                                    </div>
                                    {filteredAddedRoles.map(r => (
                                        <div
                                            key={r.id}
                                            className="gx-row"
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr minmax(100px, auto)',
                                                alignItems: 'center',
                                                padding: '12px 14px',
                                                borderTop: '1px solid var(--border-subtle)',
                                                gap: 12,
                                            }}
                                        >
                                            <div className="gx-name">
                                                <span className="gx-name__icon"><span className="material-icons-round">{r.is_transfer_role ? 'swap_horiz' : 'badge'}</span></span>
                                                <div style={{ minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
                                                    {r.is_transfer_role ? (
                                                        <span className="gx-tag">Transfer role</span>
                                                    ) : null}
                                                </div>
                                                {r.department ? (
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{r.department}</div>
                                                ) : null}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                {r.is_transfer_role ? (
                                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-xs"
                                                        onClick={() => toggleRoleExternal(r.id, false)}
                                                        title="Remove from external messaging"
                                                    >
                                                        <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={fetchData} disabled={saving}>
                                Reload
                            </button>
                            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving || !dirty || (draftFacilityEnabled && externalRoleCount === 0)}>
                                {saving ? 'Saving…' : 'Save changes'}
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
