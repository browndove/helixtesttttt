'use client';

import { useEffect, useMemo, useState } from 'react';
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

export default function InternalAdminDashboard() {
    const router = useRouter();
    const [facilities, setFacilities] = useState<FacilityRow[]>([]);
    const [search, setSearch] = useState('');
    const [reason, setReason] = useState('');
    const [ticketId, setTicketId] = useState('');
    const [loading, setLoading] = useState(true);
    const [switchingId, setSwitchingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(API_ENDPOINTS.INTERNAL_FACILITIES, { credentials: 'include' });
                if (!res.ok) {
                    if (!cancelled) showToast('Could not load facilities for internal support.', 'error');
                    return;
                }
                const data = await res.json();
                if (!cancelled) setFacilities(parseFacilities(data));
            } catch {
                if (!cancelled) showToast('Failed to load facilities.', 'error');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

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

    return (
        <>
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast.message} variant={toast.type} dismissible={false} />
                </MacVibrancyToastPortal>
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
                            <button type="button" className="btn btn-secondary btn-sm" onClick={logoutInternal}>
                                Exit internal session
                            </button>
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
