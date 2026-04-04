'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import TopBar from '@/components/TopBar';
import CustomSelect from '@/components/CustomSelect';

type RoleRow = {
    id: string;
    name: string;
    department: string;
    external_messaging: boolean;
};

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
        out.push({ id, name, department, external_messaging });
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

    /** Roles currently enabled for external messaging (the only rows we show in the list). */
    const addedRoles = useMemo(
        () => roles.filter(r => roleExternal[r.id]).sort((a, b) => a.name.localeCompare(b.name)),
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
        () => roles.filter(r => !roleExternal[r.id]).sort((a, b) => a.name.localeCompare(b.name)),
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
                for (const r of list) map[r.id] = r.external_messaging;
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

    const setDraftFacilityEnabledGuarded = (next: boolean) => {
        setDraftFacilityEnabled(next);
    };

    const toggleRoleExternal = (roleId: string, next: boolean) => {
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
            let facRes = await fetch(`/api/proxy/facilities/${facilityId}/external-messaging`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ external_messaging_enabled: draftFacilityEnabled }),
            });
            if (facRes.status === 404) {
                facRes = await fetch(`/api/proxy/facilities/${facilityId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ external_messaging_enabled: draftFacilityEnabled }),
                });
            }
            if (!facRes.ok) {
                const err = await facRes.json().catch(() => ({} as { error?: string; detail?: string }));
                showToast(String(err.error || err.detail || 'Failed to update facility'));
                setSaving(false);
                return;
            }
            setFacilityEnabled(draftFacilityEnabled);

            for (const r of roles) {
                const was = r.external_messaging;
                const now = Boolean(roleExternal[r.id]);
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

            setRoles(prev => prev.map(r => ({ ...r, external_messaging: Boolean(roleExternal[r.id]) })));
            showToast('External communication settings saved');
        } catch {
            showToast('Failed to save');
        }
        setSaving(false);
    };

    const dirty =
        draftFacilityEnabled !== facilityEnabled
        || roles.some(r => Boolean(roleExternal[r.id]) !== r.external_messaging);

    if (loading) {
        return (
                <div className="app-main">
                    <TopBar title="External communication" subtitle="Cross-facility messaging for this facility" />
                    <main style={{ flex: 1, width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '20px 24px 28px', background: 'var(--bg-900)' }}>
                        <div className="card" style={{ padding: 24, width: '100%', boxSizing: 'border-box' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
                        </div>
                    </main>
                </div>
        );
    }

    return (
        <>
            {toast && (
                <div
                    className="toast-enter"
                    style={{
                        position: 'fixed',
                        top: 20,
                        right: 20,
                        zIndex: 999,
                        background: 'var(--surface-card)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)',
                        padding: '10px 18px',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                >
                    {toast}
                </div>
            )}

            <div className="app-main" style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
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
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>

                        <div className="card" style={{ padding: '20px 22px', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                            {/* Facility — full width at top */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                                <div style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 10,
                                    background: 'rgba(14,165,233,0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                                >
                                    <span className="material-icons-round" style={{ fontSize: 22, color: '#0ea5e9' }}>forum</span>
                                </div>
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
                                borderRadius: 'var(--radius-md)',
                                background: draftFacilityEnabled ? 'rgba(14,165,233,0.06)' : 'var(--surface-2)',
                                border: `1px solid ${draftFacilityEnabled ? 'rgba(14,165,233,0.2)' : 'var(--border-subtle)'}`,
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
                                    aria-pressed={draftFacilityEnabled}
                                    onClick={() => setDraftFacilityEnabledGuarded(!draftFacilityEnabled)}
                                    style={{
                                        width: 44,
                                        height: 24,
                                        borderRadius: 12,
                                        background: draftFacilityEnabled ? '#0ea5e9' : 'var(--border-default)',
                                        border: 'none',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        transition: 'background 0.2s',
                                        flexShrink: 0,
                                    }}
                                >
                                    <span
                                        style={{
                                            width: 18,
                                            height: 18,
                                            borderRadius: 9,
                                            background: '#fff',
                                            position: 'absolute',
                                            top: 3,
                                            left: draftFacilityEnabled ? 23 : 3,
                                            transition: 'left 0.2s',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                        }}
                                    />
                                </button>
                            </div>

                            {draftFacilityEnabled && externalRoleCount === 0 && (
                                <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', fontSize: 12, color: 'var(--text-secondary)' }}>
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

                            {/* External messaging roles — only roles you have added */}
                            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>External messaging roles</h2>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
                                Add duty roles that may send or receive cross-facility messages when this facility allows it. If external communication is on, keep at least one role on the list.
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
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 16px', textAlign: 'center', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-default)', background: 'var(--surface-2)' }}>
                                    No roles added yet. Choose a role above and click Add.
                                </div>
                            ) : filteredAddedRoles.length === 0 ? (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0' }}>No added roles match this search.</div>
                            ) : (
                                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(100px, auto)', gap: 0, background: 'var(--surface-2)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px' }}>
                                        <span>Role</span>
                                        <span style={{ textAlign: 'right' }}>Remove</span>
                                    </div>
                                    {filteredAddedRoles.map(r => (
                                        <div
                                            key={r.id}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr minmax(100px, auto)',
                                                alignItems: 'center',
                                                padding: '12px 14px',
                                                borderTop: '1px solid var(--border-subtle)',
                                                gap: 12,
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</div>
                                                {r.department ? (
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{r.department}</div>
                                                ) : null}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-xs"
                                                    onClick={() => toggleRoleExternal(r.id, false)}
                                                    title="Remove from external messaging"
                                                >
                                                    <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
                                                    Remove
                                                </button>
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
