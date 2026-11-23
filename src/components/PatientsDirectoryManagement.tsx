'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TopBar from '@/components/TopBar';
import CustomSelect from '@/components/CustomSelect';
import {
    parseBulkUploadHistoryResponse,
    type BulkUploadHistoryEntry,
} from '@/lib/bulk-upload-history';
import ImportHistoryLedger from '@/components/ImportHistoryLedger';
import { MacVibrancyToast, MacVibrancyToastPortal } from '@/components/MacVibrancyToast';
import { BulkImportErrorsSheet } from '@/components/BulkImportErrorsSheet';
import { patientBulkImportToastHeadline } from '@/lib/bulk-import-toast';
import { HeroKpi, HeroKpis, SplitBar } from '@/components/glass/hero';
import { DotGrid, Ring } from '@/components/glass/kpi';
import '@/components/glass/glass-page.css';
import '@/components/glass/glass-kit.css';
import '@/components/glass/staff-glass.css';

/* ── Types ─────────────────────────────────────────────────── */

type Patient = {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    medical_record_number: string;
    department_id: string;
    department_name: string;
    age?: number;
    unit: string;
    unit_id: string;
    care_unit_name: string;
    provider_team_id: string;
    care_provider_team_name: string;
    room: string;
    bed: string;
    room_bed_display: string;
    status: string;
    admitted_date: string;
    discharge_date: string;
    dob: string;
    gender: string;
};

type Dept = { id: string; name: string };

type PatientBulkRowError = { row: number; email: string; message: string };
type PatientToastVariant = 'success' | 'error' | 'info';
type PatientToastState = {
    message: string;
    variant: PatientToastVariant;
    opaque?: boolean;
    details?: string[];
    wide?: boolean;
};

/* ── Helpers ───────────────────────────────────────────────── */

const R = (v: unknown) => (v && typeof v === 'object' ? v as Record<string, unknown> : {});
const S = (v: unknown, fb = '') => String(v ?? fb);
const N = (v: unknown) => (typeof v === 'number' ? v : 0);

function extractList(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    const r = R(raw);
    return Array.isArray(r.data) ? r.data : Array.isArray(r.items) ? r.items : [];
}

function parseApiErrorMessage(raw: string, fallback: string): string {
    const text = String(raw || '').trim();
    if (!text) return fallback;
    try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        const message =
            (typeof parsed.message === 'string' && parsed.message.trim()) ||
            (typeof parsed.detail === 'string' && parsed.detail.trim()) ||
            (typeof parsed.error === 'string' && parsed.error.trim());
        if (message) return message;
    } catch {
        // plain text response body
    }
    return text;
}

function parsePatient(row: unknown, idx: number): Patient | null {
    if (!row || typeof row !== 'object') return null;
    const r = row as Record<string, unknown>;
    const id = S(r.id || r.patient_id, `p-${idx}`);
    if (!id || (id === `p-${idx}` && !r.id)) return null;
    const cu = R(r.care_unit);
    const cpt = R(r.care_provider_team);
    return {
        id,
        first_name: S(r.first_name, 'Unknown'),
        last_name: S(r.last_name, 'Patient'),
        email: S(r.email),
        phone: S(r.phone),
        medical_record_number: S(r.medical_record_number || r.mrn),
        department_id: S(r.department_id),
        department_name: S(r.department_name, 'Unassigned'),
        age: typeof r.age === 'number' ? r.age : undefined,
        unit: S(r.unit),
        unit_id: S(r.unit_id),
        care_unit_name: S(r.care_unit_name || cu.name),
        provider_team_id: S(r.provider_team_id),
        care_provider_team_name: S(r.care_provider_team_name || cpt.name),
        room: S(r.room),
        bed: S(r.bed),
        room_bed_display: S(r.room_bed_display),
        status: S(r.status, 'admitted'),
        admitted_date: S(r.admitted_date),
        discharge_date: S(r.discharge_date),
        dob: S(r.dob),
        gender: S(r.gender),
    };
}

function parsePaged(raw: unknown) {
    const rec = R(raw);
    const items = extractList(raw).map(parsePatient).filter((p): p is Patient => Boolean(p));
    return {
        items,
        total: N(rec.total) || items.length,
        totalPages: N(rec.total_pages) || 1,
    };
}

const statusBadge = (s: string) =>
    s === 'admitted' ? 'badge-critical' : s === 'discharged' ? 'badge-neutral' : 'badge-info';

const thStyle: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '10px 14px', fontSize: 12.5 };

function parsePatientBulkErrors(raw: unknown): PatientBulkRowError[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((e, i) => {
        if (!e || typeof e !== 'object') {
            return { row: i + 2, email: '', message: String(e) };
        }
        const er = e as Record<string, unknown>;
        const rowRaw = er.row;
        const rowNum =
            typeof rowRaw === 'number' && Number.isFinite(rowRaw)
                ? rowRaw
                : typeof rowRaw === 'string' && rowRaw.trim() !== '' && Number.isFinite(Number(rowRaw))
                  ? Number(rowRaw)
                  : i + 2;
        return {
            row: rowNum,
            email: String(er.email || '').trim(),
            message: String(er.message || er.detail || er.error || '').trim() || 'Unknown error',
        };
    });
}

function summarizePatientBulkCreated(raw: unknown): { name: string; email: string; meta: string } {
    if (!raw || typeof raw !== 'object') {
        return { name: 'Patient', email: '', meta: '' };
    }
    const r = raw as Record<string, unknown>;
    const nest = (k: string): Record<string, unknown> | null => {
        const v = r[k];
        return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    };
    const p = nest('patient') || r;
    const first = String(p.first_name || r.first_name || '').trim();
    const last = String(p.last_name || r.last_name || '').trim();
    const name =
        [first, last].filter(Boolean).join(' ') ||
        String(p.name || r.name || 'Patient').trim();
    const email = String(p.email || r.email || '').trim();
    const mrn = String(p.medical_record_number || r.medical_record_number || p.mrn || r.mrn || '').trim();
    const status = String(p.status || r.status || '').trim();
    const id = String(r.id || p.id || r.patient_id || '').trim();
    const meta = [mrn && `MRN ${mrn}`, status, id ? `ID ${id.length > 10 ? `${id.slice(0, 8)}…` : id}` : '']
        .filter(Boolean)
        .join(' · ');
    return { name, email, meta };
}

function getFacilityIdFromAuthMe(raw: unknown): string {
    const rec = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const user = rec.user && typeof rec.user === 'object' ? rec.user as Record<string, unknown> : null;
    const rootCandidates = [rec.facility_id, rec.facilityId, rec.current_facility_id, rec.currentFacilityId];
    const userCandidates = user ? [user.facility_id, user.facilityId, user.current_facility_id, user.currentFacilityId] : [];
    const resolved = [...rootCandidates, ...userCandidates].find(v => typeof v === 'string' && v.trim());
    return typeof resolved === 'string' ? resolved.trim() : '';
}

function getFacilityIdFromFacilityPayload(raw: unknown): string {
    if (Array.isArray(raw)) {
        return getFacilityIdFromFacilityPayload(raw[0]);
    }
    const rec = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const id = [rec.id, rec.facility_id, rec.facilityId].find(v => typeof v === 'string' && v.trim());
    return typeof id === 'string' ? id.trim() : '';
}

function interpretPatientBulkOutcome(
    resOk: boolean,
    raw: unknown
): { toastText: string; toastVariant: PatientToastVariant; shouldRefresh: boolean; shouldClearFile: boolean } {
    const rec = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const created = Array.isArray(rec.created) ? rec.created : [];
    const errors = Array.isArray(rec.errors) ? rec.errors : [];
    const nCreated = created.length;
    const nErrors = errors.length;

    if (nCreated > 0 || nErrors > 0) {
        let toastText: string;
        if (nCreated > 0 && nErrors > 0) {
            toastText = `${nCreated} added · ${nErrors} row(s) failed (errors in top-right panel).`;
        } else if (nCreated > 0) {
            toastText = `Imported ${nCreated} patient(s). See created rows below.`;
        } else {
            toastText = `No rows imported · ${nErrors} issue(s) in the top-right panel.`;
        }
        return {
            toastText,
            toastVariant: nCreated === 0 ? 'error' : nErrors > 0 ? 'info' : 'success',
            shouldRefresh: nCreated > 0,
            shouldClearFile: nCreated > 0,
        };
    }
    if (resOk) {
        return {
            toastText: 'Import completed.',
            toastVariant: 'success',
            shouldRefresh: true,
            shouldClearFile: true,
        };
    }
    return {
        toastText: String(rec.message || rec.detail || rec.error || 'Bulk import failed'),
        toastVariant: 'error',
        shouldRefresh: false,
        shouldClearFile: false,
    };
}

/* ── Component ─────────────────────────────────────────────── */

export default function PatientsDirectoryManagement() {
    const [activeTab, setActiveTab] = useState<'directory' | 'bulk'>('directory');
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [total, setTotal] = useState(0);
    const [pageId, setPageId] = useState(1);
    const [pageSize] = useState(20);
    const [totalPages, setTotalPages] = useState(1);

    const [search, setSearch] = useState('');
    const [departmentId, setDepartmentId] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [departments, setDepartments] = useState<Dept[]>([]);

    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [bulkResultCreated, setBulkResultCreated] = useState<unknown[]>([]);
    const [bulkResultErrors, setBulkResultErrors] = useState<PatientBulkRowError[]>([]);
    const [bulkHistory, setBulkHistory] = useState<BulkUploadHistoryEntry[]>([]);
    const [bulkHistoryLoading, setBulkHistoryLoading] = useState(false);
    const [toast, setToast] = useState<PatientToastState | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const dismissToast = useCallback(() => setToast(null), []);
    const dismissBulkErrors = useCallback(() => {
        setBulkResultErrors([]);
    }, []);
    const showToast = useCallback(
        (message: string, variant: PatientToastVariant = 'info', opaque = false, details?: string[], wide = false) => {
            setToast({ message, variant, opaque, details, wide: wide || Boolean(details?.length) });
        },
        [],
    );

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (bulkResultErrors.length > 0) {
                dismissBulkErrors();
            } else if (toast) {
                dismissToast();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [toast, dismissToast, bulkResultErrors.length, dismissBulkErrors]);

    const fetchDepartments = useCallback(async () => {
        try {
            const res = await fetch('/api/proxy/departments');
            if (!res.ok) return;
            const data = await res.json();
            const list = extractList(data);
            setDepartments(list.map((x: unknown) => {
                const r = R(x);
                return { id: S(r.id), name: S(r.name) };
            }).filter((d: Dept) => d.id && d.name));
        } catch { /* best effort */ }
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
            if (statusFilter !== 'all') params.set('status', statusFilter);

            const res = await fetch(`/api/proxy/patients?${params.toString()}`);
            if (!res.ok) {
                const text = await res.text();
                showToast(parseApiErrorMessage(text, 'Failed to load patients'), 'error');
                setError(null);
                setPatients([]);
                setTotal(0);
                setTotalPages(1);
                return;
            }
            const data = await res.json();
            const parsed = parsePaged(data);
            setPatients(parsed.items);
            setTotal(parsed.total);
            setTotalPages(Math.max(1, parsed.totalPages || Math.ceil(parsed.total / pageSize)));
        } catch {
            showToast('Failed to load patients', 'error');
            setError(null);
            setPatients([]);
            setTotal(0);
            setTotalPages(1);
        } finally {
            setLoading(false);
        }
    }, [departmentId, pageId, pageSize, search, showToast, statusFilter]);

    /** Facility-wide totals for the header tiles: one page_size=1 request per status, independent of the table filters. */
    const [statusTotals, setStatusTotals] = useState<{ all: number; admitted: number; discharged: number; outpatient: number } | null>(null);
    const fetchStatusTotals = useCallback(async () => {
        const count = async (status?: string) => {
            const params = new URLSearchParams({ page_size: '1', page_id: '1' });
            if (status) params.set('status', status);
            const res = await fetch(`/api/proxy/patients?${params.toString()}`);
            if (!res.ok) throw new Error('count failed');
            return parsePaged(await res.json()).total;
        };
        try {
            const [all, admitted, discharged, outpatient] = await Promise.all([
                count(), count('admitted'), count('discharged'), count('outpatient'),
            ]);
            setStatusTotals({ all, admitted, discharged, outpatient });
        } catch {
            setStatusTotals(null);
        }
    }, []);

    useEffect(() => { fetchDepartments(); }, [fetchDepartments]);
    useEffect(() => { void fetchStatusTotals(); }, [fetchStatusTotals]);
    useEffect(() => { fetchPatients(); }, [fetchPatients]);

    const computedTotalPages = useMemo(() => Math.max(1, totalPages), [totalPages]);
    const resetFilter = (setter: (v: string) => void) => (v: string) => { setPageId(1); setter(v); };

    const clearUploadedFile = () => {
        setUploadedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const fetchBulkHistory = useCallback(async () => {
        setBulkHistoryLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('kind', 'patient');
            const res = await fetch(`/api/proxy/bulk-upload-history?${params.toString()}`, { credentials: 'include' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setBulkHistory([]);
                return;
            }
            setBulkHistory(parseBulkUploadHistoryResponse(data));
        } catch {
            setBulkHistory([]);
        } finally {
            setBulkHistoryLoading(false);
        }
    }, []);

    const handlePatientBulkImport = async () => {
        if (!uploadedFile) return;
        setProcessing(true);
        setBulkResultCreated([]);
        setBulkResultErrors([]);
        try {
            let facilityId = '';
            const cookieMatch = document.cookie.match(/helix-facility=([^;]+)/);
            if (cookieMatch) facilityId = cookieMatch[1];

            const meRes = await fetch('/api/proxy/auth/me');
            if (meRes.ok) {
                const meData = await meRes.json().catch(() => ({}));
                if (!facilityId) facilityId = getFacilityIdFromAuthMe(meData);
            }
            if (!facilityId) {
                const hospitalRes = await fetch('/api/proxy/hospital');
                if (hospitalRes.ok) {
                    const hospitalData = await hospitalRes.json().catch(() => ({}));
                    facilityId = getFacilityIdFromFacilityPayload(hospitalData);
                }
            }
            if (!facilityId) {
                const facilitiesRes = await fetch('/api/proxy/facilities');
                if (facilitiesRes.ok) {
                    const facilitiesData = await facilitiesRes.json().catch(() => ([]));
                    facilityId = getFacilityIdFromFacilityPayload(facilitiesData);
                }
            }
            if (!facilityId) {
                showToast('Unable to determine facility for bulk upload', 'error');
                return;
            }

            const formData = new FormData();
            formData.append('facility_id', facilityId);
            formData.append('file', uploadedFile, uploadedFile.name);

            const res = await fetch('/api/proxy/patients/bulk', {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });
            const data = await res.json().catch(() => ({}));
            const recPayload =
                data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
            const created = Array.isArray(recPayload.created) ? [...recPayload.created] : [];
            const importErrors = parsePatientBulkErrors(recPayload.errors);
            setBulkResultCreated(created);
            setBulkResultErrors(importErrors);

            if (created.length > 0 || importErrors.length > 0) {
                if (created.length > 0) {
                    showToast(
                        patientBulkImportToastHeadline(created.length, importErrors.length),
                        importErrors.length > 0 ? 'info' : 'success',
                    );
                }
            } else {
                const outcome = interpretPatientBulkOutcome(res.ok, data);
                showToast(
                    outcome.toastText,
                    outcome.toastVariant,
                    importErrors.length > 0 || outcome.toastVariant === 'error',
                );
            }

            const outcome = interpretPatientBulkOutcome(res.ok, data);
            if (outcome.shouldClearFile) clearUploadedFile();
            if (outcome.shouldRefresh) {
                setLoading(true);
                fetchPatients();
                void fetchStatusTotals();
            }
        } catch {
            setBulkResultCreated([]);
            setBulkResultErrors([]);
            showToast('Bulk import failed', 'error', true);
        } finally {
            setProcessing(false);
            void fetchBulkHistory();
        }
    };

    useEffect(() => {
        if (activeTab !== 'bulk') return;
        void fetchBulkHistory();
    }, [activeTab, fetchBulkHistory]);

    const directoryMain = (
        <main style={{ flex: 1, overflow: 'auto', padding: '20px 24px', background: 'var(--bg-900)' }}>
            {(() => {
                const t = statusTotals;
                const pct = (n: number) => (t && t.all > 0 ? Math.round((n / t.all) * 100) : 0);
                const show = (n: number | undefined) => (t ? (n ?? 0).toLocaleString() : '—');
                return (
                    <HeroKpis label="Patients overview" mark="personal_injury">
                        <HeroKpi
                            tone="navy"
                            icon="personal_injury"
                            label="Total patients"
                            value={show(t?.all)}
                            art={t ? (
                                <SplitBar
                                    label={`${t.admitted} admitted, ${t.discharged} discharged, ${t.outpatient} outpatient`}
                                    parts={[
                                        { label: 'Admitted', n: t.admitted, color: '#2a9a74' },
                                        { label: 'Outpatient', n: t.outpatient, color: '#f0a24a' },
                                        { label: 'Discharged', n: t.discharged, color: '#9aa4b4' },
                                    ]}
                                />
                            ) : undefined}
                            foot={`Across ${departments.length} department${departments.length === 1 ? '' : 's'}`}
                        />
                        <HeroKpi
                            tone="mint"
                            icon="hotel"
                            label="Admitted"
                            value={show(t?.admitted)}
                            art={<Ring pct={pct(t?.admitted ?? 0)} size={56}>{t ? `${pct(t.admitted)}%` : '—'}</Ring>}
                            foot="Currently on a ward"
                        />
                        <HeroKpi
                            tone="amber"
                            icon="directions_walk"
                            label="Outpatient"
                            value={show(t?.outpatient)}
                            art={<Ring pct={pct(t?.outpatient ?? 0)} size={56}>{t ? `${pct(t.outpatient)}%` : '—'}</Ring>}
                            foot="Seen without admission"
                        />
                        <HeroKpi
                            tone="sky"
                            icon="logout"
                            label="Discharged"
                            value={show(t?.discharged)}
                            art={<DotGrid pct={pct(t?.discharged ?? 0)} label={`${pct(t?.discharged ?? 0)}% discharged`} />}
                            foot={t ? `${pct(t.discharged)}% of all patients` : 'Left the facility'}
                        />
                    </HeroKpis>
                );
            })()}

            <div className="card fade-in gx-table-card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                            <th style={thStyle}>Patient</th>
                            <th style={thStyle}>MRN</th>
                            <th style={thStyle}>Department</th>
                            <th style={thStyle}>Unit</th>
                            <th style={thStyle}>Room/Bed</th>
                            <th style={thStyle}>Team</th>
                            <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr><td colSpan={7} style={{ padding: 0 }}>
                                <div className="gx-empty" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                                    <span className="gx-empty__art"><span className="material-icons-round">hourglass_empty</span></span>
                                    Loading patients...
                                </div>
                            </td></tr>
                        )}
                        {!loading && patients.length === 0 && (
                            <tr><td colSpan={7} style={{ padding: 0 }}>
                                <div className="gx-empty" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                                    <span className="material-icons-round gx-mark" aria-hidden>personal_injury</span>
                                    <span className="gx-empty__art"><span className="material-icons-round">person_off</span></span>
                                    No patients found
                                </div>
                            </td></tr>
                        )}
                        {!loading && patients.map((p) => (
                            <tr key={p.id} className="gx-row" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td style={tdStyle}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span className="gx-avatar" aria-hidden>
                                            {p.first_name[0]}{p.last_name[0]}
                                        </span>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {p.first_name} {p.last_name}
                                            </div>
                                            <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                                                {p.age !== undefined ? `${p.age}y` : p.dob || ''}{p.gender ? ` · ${p.gender}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ ...tdStyle, fontFamily: 'var(--font-mono, monospace)', fontSize: 11.5 }}>{p.medical_record_number || '-'}</td>
                                <td style={tdStyle}>{p.department_name || '-'}</td>
                                <td style={tdStyle}>{p.care_unit_name || p.unit || '-'}</td>
                                <td style={tdStyle}>{p.room_bed_display || [p.room, p.bed].filter(Boolean).join('/') || '-'}</td>
                                <td style={tdStyle}>{p.care_provider_team_name || '-'}</td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    <span className={`badge ${statusBadge(p.status)}`} style={{ fontSize: 10 }}>{p.status}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {total} patient{total !== 1 ? 's' : ''}
                    </span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button className="btn btn-secondary btn-xs" disabled={pageId <= 1} onClick={() => setPageId(p => Math.max(1, p - 1))}>
                            <span className="material-icons-round" style={{ fontSize: 14 }}>chevron_left</span>
                        </button>
                        <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', minWidth: 60, textAlign: 'center' }}>{pageId} / {computedTotalPages}</span>
                        <button className="btn btn-secondary btn-xs" disabled={pageId >= computedTotalPages} onClick={() => setPageId(p => Math.min(computedTotalPages, p + 1))}>
                            <span className="material-icons-round" style={{ fontSize: 14 }}>chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );

    const bulkMain = (
        <main style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '20px 24px', background: 'var(--bg-900)' }}>
            <p className="fade-in" style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                Upload a CSV or Excel file. Download the template for column order. Facility is taken from your session.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: 20, marginBottom: 24 }}>
                <div className="fade-in delay-1 card gx-mark-card">
                    <span className="material-icons-round gx-mark" aria-hidden>cloud_upload</span>
                    <h3 className="gx-card-title" style={{ marginBottom: 14 }}><span className="material-icons-round">upload_file</span>Upload patient file</h3>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        style={{ display: 'none' }}
                        onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) setUploadedFile(file);
                        }}
                    />
                    <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={e => {
                            e.preventDefault();
                            setDragOver(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) setUploadedFile(file);
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        style={{ border: `2px dashed ${dragOver ? 'var(--helix-primary)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-lg)', padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(30,58,95,0.05)' : 'var(--surface-2)', transition: 'all 0.2s' }}
                    >
                        <div style={{ width: 52, height: 52, background: uploadedFile ? 'var(--success-bg)' : 'rgba(30,58,95,0.1)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                            <span className="material-icons-round" style={{ fontSize: 26, color: uploadedFile ? 'var(--success)' : 'var(--helix-primary-light)' }}>{uploadedFile ? 'check_circle' : 'cloud_upload'}</span>
                        </div>
                        {uploadedFile ? (
                            <><div style={{ fontWeight: 600, color: 'var(--success)' }}>{uploadedFile.name}</div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Ready to import</div></>
                        ) : (
                            <><div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Click to upload or drag and drop</div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>CSV, XLSX or XLS (max. 50MB)</div></>
                        )}
                    </div>
                    {uploadedFile && (
                        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={processing} onClick={handlePatientBulkImport}>
                                <span className="material-icons-round" style={{ fontSize: 16 }}>{processing ? 'hourglass_empty' : 'upload'}</span>
                                {processing ? 'Processing…' : 'Process import'}
                            </button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={clearUploadedFile}><span className="material-icons-round" style={{ fontSize: 16 }}>close</span></button>
                        </div>
                    )}
                </div>

                <div className="fade-in delay-2 card gx-mark-card">
                    <span className="material-icons-round gx-mark" aria-hidden>description</span>
                    <h3 className="gx-card-title" style={{ marginBottom: 14 }}><span className="material-icons-round">download</span>Download template</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}>
                        <span className="gx-name__icon"><span className="material-icons-round">person</span></span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>patient_bulk_upload.csv</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>first_name, last_name, dob, MRN, phone, email, admitted_date, status, gender, room, bed, unit, discharge_date</div>
                        </div>
                        <a
                            className="btn btn-ghost btn-xs"
                            href="/templates/patient_bulk_upload.csv"
                            download="patient_bulk_upload.csv"
                            onClick={() => showToast('patient_bulk_upload.csv downloaded')}
                        >
                            <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--text-muted)' }}>download</span>
                        </a>
                    </div>
                </div>
            </div>

            {bulkResultCreated.length > 0 && (
                <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
                    <div>
                        <h3 style={{ marginBottom: 12, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                            Created patients ({bulkResultCreated.length})
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {bulkResultCreated.map((raw, idx) => {
                                const { name, email, meta } = summarizePatientBulkCreated(raw);
                                return (
                                    <div
                                        key={`pc-${idx}-${email || name}`}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 12,
                                            padding: '14px 16px',
                                            borderRadius: 'var(--radius-lg)',
                                            background: 'var(--surface-card)',
                                            border: '1px solid var(--border-subtle)',
                                            borderLeft: '4px solid var(--success)',
                                            boxShadow: 'var(--shadow-soft)',
                                        }}
                                    >
                                        <span className="material-icons-round" style={{ fontSize: 22, color: 'var(--success)', flexShrink: 0, marginTop: 1 }} aria-hidden>person_add</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{name}</div>
                                            {email ? <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{email}</div> : null}
                                            {meta ? <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{meta}</div> : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <div className="fade-in delay-3" style={{ marginTop: 8 }}>
                <ImportHistoryLedger
                    entries={bulkHistory}
                    loading={bulkHistoryLoading}
                    emptyMessage="No patient bulk imports yet."
                    kindLabel="Patient"
                />
            </div>
        </main>
    );

    return (
        <>
            {bulkResultErrors.length > 0 && (
                <BulkImportErrorsSheet
                    errors={bulkResultErrors}
                    onDismiss={dismissBulkErrors}
                    title="Patient import — rows not imported"
                    description={`${bulkResultErrors.length} row${bulkResultErrors.length === 1 ? '' : 's'} in this file were skipped. Correct the sheet and try again, or add patients individually.`}
                    titleId="patient-bulk-errors-title"
                    descId="patient-bulk-errors-desc"
                />
            )}
            {toast && (
                <MacVibrancyToastPortal className={toast.wide ? 'helix-mac-toast-portal--front' : undefined}>
                    <MacVibrancyToast
                        message={toast.message}
                        variant={toast.variant}
                        opaque={toast.opaque}
                        wide={toast.wide}
                        details={toast.details}
                        onDismiss={dismissToast}
                    />
                </MacVibrancyToastPortal>
            )}
            <div className="app-main gx-page">
                <TopBar
                    title="Patients"
                    subtitle={activeTab === 'directory' ? 'Patient directory' : 'Bulk upload'}
                    search={activeTab === 'directory' ? { placeholder: 'Search by name or MRN...', value: search, onChange: (v) => { setPageId(1); setSearch(v); } } : undefined}
                />

                <div className="sx-tabs-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div className="sx-tabs" role="tablist" aria-label="Patient sections">
                        {([
                            ['directory', 'groups', 'Patient directory'],
                            ['bulk', 'upload_file', 'Bulk upload'],
                        ] as const).map(([id, icon, label]) => (
                            <button
                                key={id}
                                type="button"
                                role="tab"
                                aria-selected={activeTab === id}
                                className={`sx-tab${activeTab === id ? ' is-active' : ''}`}
                                onClick={() => setActiveTab(id)}
                            >
                                <span className="sx-tab__icon"><span className="material-icons-round">{icon}</span></span>
                                {label}
                            </button>
                        ))}
                    </div>
                    {activeTab === 'directory' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <CustomSelect value={departmentId} onChange={resetFilter(setDepartmentId)} options={[{ label: 'All Departments', value: 'all' }, ...departments.map(d => ({ label: d.name, value: d.id }))]} placeholder="All Departments" style={{ width: 220 }} />
                            <CustomSelect value={statusFilter} onChange={resetFilter(setStatusFilter)} options={[{ label: 'All Statuses', value: 'all' }, { label: 'Admitted', value: 'admitted' }, { label: 'Discharged', value: 'discharged' }, { label: 'Outpatient', value: 'outpatient' }]} placeholder="All Statuses" style={{ width: 170 }} />
                        </div>
                    )}
                </div>

                {activeTab === 'directory' ? directoryMain : bulkMain}
            </div>
        </>
    );
}
