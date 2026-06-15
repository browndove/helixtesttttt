'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_ENDPOINTS } from '@/lib/config';
import { primeClientFacilityId } from '@/lib/facility-client';
import { MacVibrancyToast, MacVibrancyToastPortal } from '@/components/MacVibrancyToast';

type FacilityRow = { id: string; name: string; code: string };

function parseFacilities(raw: unknown): FacilityRow[] {
    const list = Array.isArray(raw) ? raw : [];
    return list
        .map((f: unknown, i) => {
            if (!f || typeof f !== 'object') return null;
            const rec = f as Record<string, unknown>;
            const id = String(rec.id || rec.facility_id || `f-${i}`);
            const name = String(rec.name || rec.facility_name || rec.hospital_name || '').trim();
            const code = String(rec.code || rec.facility_code || '').trim();
            if (!id || !name) return null;
            return { id, name, code };
        })
        .filter((f): f is FacilityRow => Boolean(f))
        .sort((a, b) => a.name.localeCompare(b.name));
}

const EMPTY_FACILITY_FORM = {
    name: '',
    code: '',
    address: '',
    city: '',
    region: '',
    email: '',
    contact_phone: '',
    admin_email: '',
    primary_contact_first_name: '',
    primary_contact_last_name: '',
    primary_contact_email: '',
    primary_contact_phone: '',
    subscription_type: '1yr',
    external_messaging_enabled: true,
    screenshots_allowed: true,
};

type FacilityForm = typeof EMPTY_FACILITY_FORM;

/* ── Shared field row ─────────────────────────────────────── */

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="label" style={{ marginBottom: 0 }}>
                {label}{required && <span style={{ color: 'var(--error)', marginLeft: 2 }}>*</span>}
            </label>
            {children}
        </div>
    );
}

export default function InternalAdminDashboard() {
    const router = useRouter();
    const [facilities, setFacilities] = useState<FacilityRow[]>([]);
    const [search, setSearch] = useState('');
    const [reason, setReason] = useState('');
    const [ticketId, setTicketId] = useState('');
    const [loading, setLoading] = useState(true);
    const [switchingId, setSwitchingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Create Facility modal
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState<FacilityForm>({ ...EMPTY_FACILITY_FORM });

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const loadFacilities = useCallback(async () => {
        try {
            const res = await fetch(API_ENDPOINTS.INTERNAL_FACILITIES, { credentials: 'include' });
            if (!res.ok) {
                showToast('Could not load facilities for internal support.', 'error');
                return;
            }
            const data = await res.json();
            setFacilities(parseFacilities(data));
        } catch {
            showToast('Failed to load facilities.', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadFacilities();
    }, [loadFacilities]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return facilities;
        return facilities.filter((f) =>
            f.name.toLowerCase().includes(q) || f.code.toLowerCase().includes(q),
        );
    }, [facilities, search]);

    const enterFacility = async (facility: FacilityRow) => {
        setSwitchingId(facility.id);
        try {
            const res = await fetch(API_ENDPOINTS.INTERNAL_ACT_AS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    facility_id: facility.id,
                    reason: reason.trim() || undefined,
                    ticket_id: ticketId.trim() || undefined,
                }),
            });
            const data = await res.json().catch(() => ({} as Record<string, unknown>));
            if (!res.ok) {
                showToast(String(data.error || data.message || 'Could not enter support mode.'), 'error');
                return;
            }
            const actAsFacilityId = String(data.facility_id || facility.id || '').trim();
            if (actAsFacilityId) primeClientFacilityId(actAsFacilityId);
            showToast(`Support mode enabled for ${facility.name}.`, 'success');
            if (typeof window !== 'undefined') window.location.assign('/home');
            else router.replace('/home');
        } catch {
            showToast('Could not enter support mode.', 'error');
        } finally {
            setSwitchingId(null);
        }
    };

    const logoutInternal = async () => {
        await fetch(API_ENDPOINTS.INTERNAL_EXIT_ACT_AS, { method: 'POST', credentials: 'include' }).catch(() => null);
        await fetch(API_ENDPOINTS.LOGOUT, { method: 'POST', credentials: 'include' }).catch(() => null);
        if (typeof window !== 'undefined') window.location.assign('/internal/login');
        else router.replace('/internal/login');
    };

    /* ── Create facility ──────────────────────────────────── */

    /** Sanitise a phone string into E.164: strip non-digits, ensure leading +. */
    const toE164 = (raw: string): string => {
        const digits = raw.replace(/[^\d]/g, '');
        if (!digits) return '';
        return `+${digits}`;
    };

    const PHONE_KEYS: (keyof FacilityForm)[] = ['contact_phone', 'primary_contact_phone'];

    const setField = <K extends keyof FacilityForm>(key: K, value: FacilityForm[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const openCreateModal = () => {
        setForm({ ...EMPTY_FACILITY_FORM });
        setShowCreate(true);
    };

    const closeCreateModal = () => {
        if (creating) return;
        setShowCreate(false);
    };

    const handleCreate = async () => {
        if (!form.name.trim() || !form.code.trim()) {
            showToast('Facility name and code are required.', 'error');
            return;
        }
        setCreating(true);
        try {
            const payload: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(form)) {
                if (typeof v === 'string' && !v.trim()) continue;
                // Sanitise phone fields to E.164
                if (PHONE_KEYS.includes(k as keyof FacilityForm) && typeof v === 'string') {
                    const cleaned = toE164(v);
                    if (cleaned && (cleaned.length < 9 || cleaned.length > 16)) {
                        showToast(`Phone number "${v}" must be 8–15 digits in E.164 format (e.g. +233301234567).`, 'error');
                        setCreating(false);
                        return;
                    }
                    if (cleaned) payload[k] = cleaned;
                    continue;
                }
                payload[k] = v;
            }
            const res = await fetch(API_ENDPOINTS.INTERNAL_FACILITIES, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({} as Record<string, unknown>));
            if (!res.ok) {
                showToast(String(data.error || data.message || 'Failed to create facility.'), 'error');
                return;
            }
            showToast('Facility created successfully.', 'success');
            setShowCreate(false);
            setLoading(true);
            void loadFacilities();
        } catch {
            showToast('Failed to create facility.', 'error');
        } finally {
            setCreating(false);
        }
    };

    return (
        <>
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast.message} variant={toast.type} dismissible={false} />
                </MacVibrancyToastPortal>
            )}

            {/* ── Create Facility Modal ──────────────────────── */}
            {showCreate && (
                <div
                    className="modal-overlay"
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9000,
                        background: 'rgba(0,0,0,0.35)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 24,
                    }}
                    onClick={(e) => { if (e.target === e.currentTarget) closeCreateModal(); }}
                >
                    <div
                        className="modal-content card"
                        style={{
                            width: '100%', maxWidth: 680,
                            maxHeight: 'calc(100vh - 48px)',
                            display: 'flex', flexDirection: 'column',
                            overflow: 'hidden', padding: 0,
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            padding: '20px 24px 16px',
                            borderBottom: '1px solid var(--border-subtle)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <div>
                                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Create New Facility</h2>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                    Provision a new tenant on the platform.
                                </p>
                            </div>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={closeCreateModal}
                                style={{ fontSize: 18, padding: '4px 8px', lineHeight: 1 }}
                            >
                                <span className="material-icons-round" style={{ fontSize: 20 }}>close</span>
                            </button>
                        </div>

                        {/* Body */}
                        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px 24px' }}>
                            {/* Facility Info */}
                            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
                                Facility Information
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
                                <Field label="Facility Name" required>
                                    <input className="input" placeholder="e.g. Cape Coast Teaching Hospital" value={form.name} onChange={(e) => setField('name', e.target.value)} />
                                </Field>
                                <Field label="Code" required>
                                    <input className="input" placeholder="e.g. CCTH" value={form.code} onChange={(e) => setField('code', e.target.value.toUpperCase())} style={{ textTransform: 'uppercase' }} />
                                </Field>
                                <Field label="Address">
                                    <input className="input" placeholder="Street address" value={form.address} onChange={(e) => setField('address', e.target.value)} />
                                </Field>
                                <Field label="City">
                                    <input className="input" placeholder="City" value={form.city} onChange={(e) => setField('city', e.target.value)} />
                                </Field>
                                <Field label="Region">
                                    <input className="input" placeholder="Region" value={form.region} onChange={(e) => setField('region', e.target.value)} />
                                </Field>
                                <Field label="Facility Email">
                                    <input className="input" type="email" placeholder="info@hospital.org" value={form.email} onChange={(e) => setField('email', e.target.value)} />
                                </Field>
                                <Field label="Contact Phone">
                                    <input className="input" type="tel" placeholder="+233301234567" value={form.contact_phone} onChange={(e) => setField('contact_phone', e.target.value)} onBlur={() => { const v = toE164(form.contact_phone); if (v) setField('contact_phone', v); }} />
                                </Field>
                                <Field label="Admin Email">
                                    <input className="input" type="email" placeholder="admin@hospital.org" value={form.admin_email} onChange={(e) => setField('admin_email', e.target.value)} />
                                </Field>
                            </div>

                            <hr className="divider" style={{ margin: '20px 0' }} />

                            {/* Primary Contact */}
                            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
                                Primary Contact
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
                                <Field label="First Name">
                                    <input className="input" placeholder="First name" value={form.primary_contact_first_name} onChange={(e) => setField('primary_contact_first_name', e.target.value)} />
                                </Field>
                                <Field label="Last Name">
                                    <input className="input" placeholder="Last name" value={form.primary_contact_last_name} onChange={(e) => setField('primary_contact_last_name', e.target.value)} />
                                </Field>
                                <Field label="Email">
                                    <input className="input" type="email" placeholder="contact@hospital.org" value={form.primary_contact_email} onChange={(e) => setField('primary_contact_email', e.target.value)} />
                                </Field>
                                <Field label="Phone">
                                    <input className="input" type="tel" placeholder="+233201234567" value={form.primary_contact_phone} onChange={(e) => setField('primary_contact_phone', e.target.value)} onBlur={() => { const v = toE164(form.primary_contact_phone); if (v) setField('primary_contact_phone', v); }} />
                                </Field>
                            </div>

                            <hr className="divider" style={{ margin: '20px 0' }} />

                            {/* Settings */}
                            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
                                Settings
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
                                <Field label="Subscription">
                                    <select className="input" value={form.subscription_type} onChange={(e) => setField('subscription_type', e.target.value)}>
                                        <option value="1yr">1 Year</option>
                                        <option value="2yr">2 Years</option>
                                        <option value="3yr">3 Years</option>
                                        <option value="trial">Trial</option>
                                    </select>
                                </Field>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
                                        <span className="toggle">
                                            <input type="checkbox" checked={form.external_messaging_enabled} onChange={(e) => setField('external_messaging_enabled', e.target.checked)} />
                                            <span className="toggle-slider" />
                                        </span>
                                        External Messaging
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
                                        <span className="toggle">
                                            <input type="checkbox" checked={form.screenshots_allowed} onChange={(e) => setField('screenshots_allowed', e.target.checked)} />
                                            <span className="toggle-slider" />
                                        </span>
                                        Screenshots Allowed
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{
                            padding: '14px 24px',
                            borderTop: '1px solid var(--border-subtle)',
                            display: 'flex', justifyContent: 'flex-end', gap: 10,
                            background: 'var(--surface-2)',
                        }}>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={closeCreateModal} disabled={creating}>
                                Cancel
                            </button>
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => { void handleCreate(); }} disabled={creating}>
                                {creating ? 'Creating…' : 'Create Facility'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="app-main">
                <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>
                    <div className="card" style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div>
                                <h2 style={{ fontSize: 20, fontWeight: 700 }}>Internal Admin Dashboard</h2>
                                <p style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 12.5 }}>
                                    Select a facility to enter support mode and view the tenant app context.
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" className="btn btn-primary btn-sm" onClick={openCreateModal}>
                                    <span className="material-icons-round" style={{ fontSize: 16 }}>add</span>
                                    Add Facility
                                </button>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={logoutInternal}>
                                    Exit internal session
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="card" style={{ marginBottom: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 220px', gap: 10 }}>
                            <input className="input" placeholder="Search facility by name or code..." value={search} onChange={(e) => setSearch(e.target.value)} />
                            <input className="input" placeholder="Ticket ID (optional)" value={ticketId} onChange={(e) => setTicketId(e.target.value)} />
                            <input className="input" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
                        </div>
                    </div>

                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Facility</th>
                                        <th>Code</th>
                                        <th style={{ width: 160, textAlign: 'right' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={3} style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)' }}>Loading facilities…</td></tr>
                                    ) : filtered.length === 0 ? (
                                        <tr><td colSpan={3} style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)' }}>No facilities found.</td></tr>
                                    ) : filtered.map((facility) => (
                                        <tr key={facility.id}>
                                            <td style={{ fontWeight: 600 }}>{facility.name}</td>
                                            <td><span className="badge badge-neutral">{facility.code || '—'}</span></td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button
                                                    type="button"
                                                    className="btn btn-primary btn-sm"
                                                    disabled={switchingId === facility.id}
                                                    onClick={() => { void enterFacility(facility); }}
                                                >
                                                    {switchingId === facility.id ? 'Entering…' : 'Access facility'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
