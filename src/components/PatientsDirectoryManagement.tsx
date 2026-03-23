'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';
import CustomSelect from '@/components/CustomSelect';

type Patient = {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    medical_record_number: string;
    department_id: string;
    department_name: string;
    unit: string;
    room: string;
    bed: string;
    status: 'admitted' | 'discharged' | 'outpatient' | string;
    admitted_date?: string;
    discharge_date?: string;
    dob?: string;
    gender?: string;
};

type PagedPatients = {
    items: Patient[];
    total: number;
    page_id: number;
    page_size: number;
};

function formatPhoneForCall(raw: string): string {
    const input = raw.trim();
    if (!input) return '-';
    const digits = input.replace(/\D/g, '');
    if (!digits) return '-';
    const local = digits.startsWith('233') ? digits.slice(3) : (digits.startsWith('0') ? digits.slice(1) : digits);
    const nine = local.slice(0, 9);
    if (!nine) return '-';
    return `+233 ${nine}`;
}

function parsePatients(raw: unknown): PagedPatients {
    const rec = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const listRaw = Array.isArray(raw)
        ? raw
        : (Array.isArray(rec.items) ? rec.items
            : Array.isArray(rec.data) ? rec.data
            : Array.isArray(rec.results) ? rec.results
            : []);
    const list = listRaw
        .map((row, idx): Patient | null => {
            if (!row || typeof row !== 'object') return null;
            const r = row as Record<string, unknown>;
            const first = String(r.first_name || '').trim();
            const last = String(r.last_name || '').trim();
            const full = String(r.name || '').trim();
            const [fullFirst = '', ...rest] = full.split(' ');
            const fullLast = rest.join(' ');
            const id = String(r.id || r.patient_id || `patient-${idx}`);
            return {
                id,
                first_name: first || fullFirst || 'Unknown',
                last_name: last || fullLast || 'Patient',
                email: String(r.email || ''),
                phone: String(r.phone || ''),
                medical_record_number: String(r.medical_record_number || r.mrn || ''),
                department_id: String(r.department_id || ''),
                department_name: String(r.department_name || r.department || 'Unassigned'),
                unit: String(r.unit || ''),
                room: String(r.room || ''),
                bed: String(r.bed || ''),
                status: String(r.status || 'admitted'),
                admitted_date: String(r.admitted_date || ''),
                discharge_date: String(r.discharge_date || ''),
                dob: String(r.dob || ''),
                gender: String(r.gender || ''),
            };
        })
        .filter((p): p is Patient => Boolean(p));

    const total = typeof rec.total === 'number'
        ? rec.total
        : typeof rec.count === 'number'
            ? rec.count
            : list.length;
    const page_id = typeof rec.page_id === 'number' ? rec.page_id : 1;
    const page_size = typeof rec.page_size === 'number' ? rec.page_size : 20;

    return { items: list, total, page_id, page_size };
}

export default function PatientsDirectoryManagement() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [departmentId, setDepartmentId] = useState('all');
    const [status, setStatus] = useState('all');
    const [pageId, setPageId] = useState(1);
    const [pageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
    const [error, setError] = useState<string | null>(null);

    const fetchDepartments = useCallback(async () => {
        try {
            const res = await fetch('/api/proxy/departments');
            if (!res.ok) return;
            const data = await res.json();
            const list = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
            const parsed = list
                .map((d: unknown) => {
                    if (!d || typeof d !== 'object') return null;
                    const r = d as Record<string, unknown>;
                    const id = String(r.id || '').trim();
                    const name = String(r.name || r.department_name || '').trim();
                    if (!id || !name) return null;
                    return { id, name };
                })
                .filter((d: { id: string; name: string } | null): d is { id: string; name: string } => Boolean(d));
            setDepartments(parsed);
        } catch {
            // best effort
        }
    }, []);

    const fetchPatients = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.set('page_size', String(pageSize));
            params.set('page_id', String(pageId));
            if (search.trim()) params.set('search', search.trim());
            if (departmentId !== 'all') params.set('department_id', departmentId);
            if (status !== 'all') params.set('status', status);

            const res = await fetch(`/api/proxy/patients?${params.toString()}`);
            if (!res.ok) {
                const text = await res.text();
                setError(text || 'Failed to load patients');
                setPatients([]);
                setTotal(0);
                return;
            }
            const data = await res.json();
            const parsed = parsePatients(data);
            setPatients(parsed.items);
            setTotal(parsed.total);
        } catch {
            setError('Failed to load patients');
            setPatients([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [departmentId, pageId, pageSize, search, status]);

    useEffect(() => { fetchDepartments(); }, [fetchDepartments]);
    useEffect(() => { fetchPatients(); }, [fetchPatients]);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total]);

    return (
        <div className="app-shell">
            <Sidebar sections={navSections} />
            <div className="app-main">
                <TopBar
                    title="Patients"
                    subtitle="Patient Directory"
                    search={{ placeholder: 'Search by name or MRN...', value: search, onChange: (v) => { setPageId(1); setSearch(v); } }}
                />
                <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>
                    <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                        <CustomSelect
                            value={departmentId}
                            onChange={(v) => { setPageId(1); setDepartmentId(v); }}
                            options={[
                                { label: 'All Departments', value: 'all' },
                                ...departments.map((d) => ({ label: d.name, value: d.id })),
                            ]}
                            placeholder="All Departments"
                            style={{ maxWidth: 280, width: '100%' }}
                        />
                        <CustomSelect
                            value={status}
                            onChange={(v) => { setPageId(1); setStatus(v); }}
                            options={[
                                { label: 'All Statuses', value: 'all' },
                                { label: 'Admitted', value: 'admitted' },
                                { label: 'Discharged', value: 'discharged' },
                                { label: 'Outpatient', value: 'outpatient' },
                            ]}
                            placeholder="All Statuses"
                            style={{ maxWidth: 220, width: '100%' }}
                        />
                    </div>

                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Name</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>MRN</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>DOB</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Gender</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Phone</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Department</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Unit</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Room/Bed</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Admitted</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr><td colSpan={10} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>Loading patients...</td></tr>
                                )}
                                {!loading && error && (
                                    <tr><td colSpan={10} style={{ padding: 30, textAlign: 'center', color: 'var(--critical)' }}>{error}</td></tr>
                                )}
                                {!loading && !error && patients.length === 0 && (
                                    <tr><td colSpan={10} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>No patients found.</td></tr>
                                )}
                                {!loading && !error && patients.map((p) => (
                                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ fontWeight: 600, fontSize: 13 }}>{p.first_name} {p.last_name}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.email || '-'}</div>
                                        </td>
                                        <td style={{ padding: '12px 16px', fontSize: 12 }}>{p.medical_record_number || '-'}</td>
                                        <td style={{ padding: '12px 16px', fontSize: 12 }}>{p.dob || '-'}</td>
                                        <td style={{ padding: '12px 16px', fontSize: 12, textTransform: 'capitalize' }}>{p.gender || '-'}</td>
                                        <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'var(--font-mono, monospace)' }}>{formatPhoneForCall(p.phone)}</td>
                                        <td style={{ padding: '12px 16px', fontSize: 12 }}>{p.department_name || '-'}</td>
                                        <td style={{ padding: '12px 16px', fontSize: 12 }}>{p.unit || '-'}</td>
                                        <td style={{ padding: '12px 16px', fontSize: 12 }}>{[p.room, p.bed].filter(Boolean).join(' / ') || '-'}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                            <span className={`badge ${p.status === 'admitted' ? 'badge-critical' : p.status === 'discharged' ? 'badge-neutral' : 'badge-info'}`} style={{ fontSize: 10 }}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px', fontSize: 12 }}>{p.admitted_date || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Showing {patients.length} of {total}
                            </span>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <button className="btn btn-secondary btn-xs" disabled={pageId <= 1} onClick={() => setPageId((p) => Math.max(1, p - 1))}>Prev</button>
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Page {pageId} / {totalPages}</span>
                                <button className="btn btn-secondary btn-xs" disabled={pageId >= totalPages} onClick={() => setPageId((p) => Math.min(totalPages, p + 1))}>Next</button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

