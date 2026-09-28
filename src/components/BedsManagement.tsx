'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import TopBar from '@/components/TopBar';
import { MacVibrancyToast, MacVibrancyToastPortal } from '@/components/MacVibrancyToast';
import { API_ENDPOINTS } from '@/lib/config';
import { appendFacilityIdForProxy } from '@/lib/facility-client';
import type { Bed, BedStatus, FacilityBedSummary, DepartmentBedSummary } from '@/lib/beds';
import {
    Bed as BedIcon,
    Users,
    ShieldCheck,
    Lock,
    Activity,
    Plus,
    Search,
    Filter,
    ChevronDown,
    MoreVertical,
    ChevronLeft,
    ChevronRight,
    X,
} from 'lucide-react';

/* ─── constants ─────────────────────────────────────────────────────── */

const POLL_INTERVAL_MS = 20_000;

type ToastItem = { message: string; variant: 'success' | 'error' | 'info' };

type Ward = { id: string; name: string };
type DepartmentDetail = {
    id: string;
    name: string;
    wards: Ward[];
};

type ConfirmAction = {
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => Promise<void> | void;
};

/* ─── helpers ───────────────────────────────────────────────────────── */

/** Expand "1-20" → ["1","2",…,"20"]. Non-numeric or reversed ranges pass through as-is. */
function expandBedLabels(input: string): string[] {
    const trimmed = input.trim();
    if (!trimmed) return [];
    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        if (start <= end && end - start < 200) {
            const result: string[] = [];
            for (let i = start; i <= end; i++) result.push(String(i));
            return result;
        }
    }
    return [trimmed];
}

function bedSortKey(b: Bed): [number, string] {
    return [b.sort_order ?? 0, b.bed_number.toLowerCase()];
}

function compareBeds(a: Bed, b: Bed): number {
    const [aSort, aNum] = bedSortKey(a);
    const [bSort, bNum] = bedSortKey(b);
    if (aSort !== bSort) return aSort - bSort;
    return aNum.localeCompare(bNum, undefined, { numeric: true, sensitivity: 'base' });
}

function relativeTime(iso: string): string {
    if (!iso) return '1 day ago';
    const diff = Date.now() - new Date(iso).getTime();
    if (isNaN(diff)) return '1 day ago';
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
    return '1 day ago';
}

const BED_STATUS_COLORS: Record<BedStatus, { bg: string; fg: string; border: string; label: string }> = {
    available: { bg: '#ECFBF5', fg: '#008B60', border: '#BCEBD9', label: 'Available' },
    occupied: { bg: '#FEF2F2', fg: '#DC2626', border: '#FECACA', label: 'Occupied' },
    blocked: { bg: '#F3F4F6', fg: '#4B5563', border: '#E5E7EB', label: 'Blocked' },
};

/* Department metadata mapping for secondary unit subtitle line */
const DEPT_SUBTITLES: Record<string, string> = {
    administration: 'Wing 4-A · Executive & Overnight Observation Suites',
    anesthesiology: 'Floor 2 · Post-Anesthesia Recovery (PACU)',
    cardiology: 'Floor 3 · Heart & Vascular Institute (Cardiac Care Unit)',
    emergency: 'Ground Floor · Trauma Bay & Rapid Assessment Unit',
    'gym center': 'Floor 1 · Physical Therapy & Neuro Rehab Suites',
    'intensive care unit': 'Floor 2 · Medical & Surgical Critical Care (MICU/SICU)',
    'internal medicine': 'Floor 3 · General Inpatient Ward C',
    'neurology & neurosurgery': 'Floor 4 · Stroke Care & Neurological Monitoring',
    oncology: 'Floor 5 · Infusion & Chemotherapy Inpatient Bay',
    pediatrics: 'Floor 2 · Pediatric Medical Inpatient Wing',
};

function getDeptSubtitle(deptName: string): string {
    const key = deptName.toLowerCase().trim();
    if (DEPT_SUBTITLES[key]) return DEPT_SUBTITLES[key];
    return 'Main Hospital Building · Clinical Care Suite';
}

/* ─── component ─────────────────────────────────────────────────────── */

export default function BedsManagement() {
    /* toast */
    const [toast, setToast] = useState<ToastItem | null>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const showToast = useCallback((message: string, variant: ToastItem['variant'] = 'success') => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ message, variant });
        toastTimer.current = setTimeout(() => setToast(null), 3000);
    }, []);

    /* auth / role */
    const [isAdmin, setIsAdmin] = useState(true);
    const [, setAuthChecked] = useState(false);

    /* summary board */
    const [summary, setSummary] = useState<FacilityBedSummary | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(true);

    /* Search, Pagination, and Filters */
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
    const [selectedFloorFilter, setSelectedFloorFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 15;

    /* drawer state */
    const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
    const [deptDetail, setDeptDetail] = useState<DepartmentDetail | null>(null);
    const [deptBeds, setDeptBeds] = useState<Bed[]>([]);
    const [deptBedsLoading, setDeptBedsLoading] = useState(false);
    const [activeWardId, setActiveWardId] = useState<string | null>(null);

    /* add beds input */
    const [bedChips, setBedChips] = useState<string[]>([]);
    const [chipInput, setChipInput] = useState('');
    const [addingBeds, setAddingBeds] = useState(false);

    /* confirm dialog */
    const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
    const [confirmInProgress, setConfirmInProgress] = useState(false);

    /* status toggle */
    const [statusMenuBedId, setStatusMenuBedId] = useState<string | null>(null);
    const statusMenuRef = useRef<HTMLDivElement>(null);

    /* ── auth check ─────────────────────────────────────────────────── */
    useEffect(() => {
        (async () => {
            try {
                const url = await appendFacilityIdForProxy(API_ENDPOINTS.AUTH_ME);
                const res = await fetch(url, { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    const role = String(data?.role || data?.user?.role || '').toLowerCase();
                    setIsAdmin(['admin', 'superadmin', 'facility_admin', 'facility-admin'].includes(role) || role.includes('admin'));
                }
            } catch { /* default to admin */ }
            setAuthChecked(true);
        })();
    }, []);

    /* ── fetch summary ──────────────────────────────────────────────── */
    const fetchSummary = useCallback(async () => {
        try {
            const url = await appendFacilityIdForProxy(API_ENDPOINTS.BEDS_SUMMARY);
            const res = await fetch(url, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setSummary(data as FacilityBedSummary);
            } else {
                const err = await res.json().catch(() => ({}));
                console.error('Beds summary error:', err);
            }
        } catch (e) {
            console.error('Beds summary fetch failed:', e);
        }
        setSummaryLoading(false);
    }, []);

    useEffect(() => {
        fetchSummary();
        const id = setInterval(fetchSummary, POLL_INTERVAL_MS);
        return () => clearInterval(id);
    }, [fetchSummary]);

    /* ── fetch department detail + beds ──────────────────────────────── */
    const fetchDeptDetail = useCallback(async (deptId: string) => {
        try {
            const url = await appendFacilityIdForProxy(`${API_ENDPOINTS.DEPARTMENT(deptId)}`);
            const res = await fetch(url, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setDeptDetail({
                    id: data.id,
                    name: data.name,
                    wards: Array.isArray(data.wards) ? data.wards : [],
                });
            }
        } catch { /* ignore */ }
    }, []);

    const fetchDeptBeds = useCallback(async (deptId: string, wardId?: string | null) => {
        setDeptBedsLoading(true);
        try {
            let url = API_ENDPOINTS.DEPARTMENT_BEDS(deptId);
            if (wardId) url += `?ward_id=${wardId}`;
            url = await appendFacilityIdForProxy(url);
            const res = await fetch(url, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setDeptBeds(Array.isArray(data) ? (data as Bed[]).sort(compareBeds) : []);
            }
        } catch { /* ignore */ }
        setDeptBedsLoading(false);
    }, []);

    /* open drawer */
    const openDepartment = useCallback((deptId: string) => {
        setSelectedDeptId(deptId);
        setActiveWardId(null);
        setBedChips([]);
        setChipInput('');
        setStatusMenuBedId(null);
        fetchDeptDetail(deptId);
        fetchDeptBeds(deptId);
    }, [fetchDeptDetail, fetchDeptBeds]);

    const closeDrawer = useCallback(() => {
        setSelectedDeptId(null);
        setDeptDetail(null);
        setDeptBeds([]);
        setActiveWardId(null);
        setBedChips([]);
        setChipInput('');
        setStatusMenuBedId(null);
    }, []);

    /* re-fetch beds when ward tab changes */
    useEffect(() => {
        if (!selectedDeptId) return;
        fetchDeptBeds(selectedDeptId, activeWardId);
    }, [selectedDeptId, activeWardId, fetchDeptBeds]);

    /* ── chip input ─────────────────────────────────────────────────── */
    const addChipsFromInput = useCallback(() => {
        const parts = chipInput.split(/[,\s]+/).filter(Boolean);
        const expanded: string[] = [];
        for (const p of parts) expanded.push(...expandBedLabels(p));
        if (expanded.length === 0) return;
        setBedChips(prev => {
            const set = new Set(prev.map(c => c.toLowerCase()));
            const next = [...prev];
            for (const e of expanded) {
                if (!set.has(e.toLowerCase())) {
                    set.add(e.toLowerCase());
                    next.push(e);
                }
            }
            return next;
        });
        setChipInput('');
    }, [chipInput]);

    const removeChip = useCallback((idx: number) => {
        setBedChips(prev => prev.filter((_, i) => i !== idx));
    }, []);

    /* ── mutations ──────────────────────────────────────────────────── */
    const addBeds = useCallback(async () => {
        if (!selectedDeptId || bedChips.length === 0) return;
        setAddingBeds(true);
        try {
            let url = API_ENDPOINTS.DEPARTMENT_BEDS(selectedDeptId);
            url = await appendFacilityIdForProxy(url);
            const body: Record<string, unknown> = { bed_numbers: bedChips };
            if (activeWardId) body.ward_id = activeWardId;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });
            if (res.ok) {
                showToast(`Added ${bedChips.length} bed${bedChips.length !== 1 ? 's' : ''}`);
                setBedChips([]);
                setChipInput('');
                fetchDeptBeds(selectedDeptId, activeWardId);
                fetchSummary();
            } else {
                const err = await res.json().catch(() => ({} as Record<string, string>));
                showToast(err.error || err.message || 'Failed to add beds', 'error');
            }
        } catch {
            showToast('Failed to add beds', 'error');
        }
        setAddingBeds(false);
    }, [selectedDeptId, bedChips, activeWardId, fetchDeptBeds, fetchSummary, showToast]);

    const deleteBed = useCallback(async (bed: Bed) => {
        setConfirmAction({
            title: 'Remove bed',
            message: `Remove bed "${bed.bed_number}"? ${bed.status === 'occupied' ? 'This bed is currently occupied.' : ''}`,
            confirmLabel: 'Remove',
            onConfirm: async () => {
                try {
                    let url = API_ENDPOINTS.BED(bed.id);
                    url = await appendFacilityIdForProxy(url);
                    const res = await fetch(url, { method: 'DELETE', credentials: 'include' });
                    if (res.ok || res.status === 204) {
                        showToast(`Bed ${bed.bed_number} removed`);
                        if (selectedDeptId) fetchDeptBeds(selectedDeptId, activeWardId);
                        fetchSummary();
                    } else {
                        const err = await res.json().catch(() => ({}));
                        showToast((err as Record<string, string>).error || 'Failed to remove bed', 'error');
                    }
                } catch {
                    showToast('Failed to remove bed', 'error');
                }
            },
        });
    }, [selectedDeptId, activeWardId, fetchDeptBeds, fetchSummary, showToast]);

    const replaceAllBeds = useCallback(() => {
        if (!selectedDeptId) return;
        setConfirmAction({
            title: 'Replace all beds',
            message: 'This replaces every mapped bed in this department, including all wards. Occupancy resets to available. This cannot be undone.',
            confirmLabel: 'Replace All',
            onConfirm: async () => {
                try {
                    let url = API_ENDPOINTS.DEPARTMENT_BEDS(selectedDeptId);
                    url = await appendFacilityIdForProxy(url);
                    const body: Record<string, unknown> = { bed_numbers: bedChips };
                    if (activeWardId) body.ward_id = activeWardId;
                    const res = await fetch(url, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(body),
                    });
                    if (res.ok) {
                        showToast(`Replaced beds in department`);
                        setBedChips([]);
                        setChipInput('');
                        fetchDeptBeds(selectedDeptId, activeWardId);
                        fetchSummary();
                    } else {
                        const err = await res.json().catch(() => ({} as Record<string, string>));
                        showToast(err.error || err.message || 'Failed to replace beds', 'error');
                    }
                } catch {
                    showToast('Failed to replace beds', 'error');
                }
            },
        });
    }, [selectedDeptId, bedChips, activeWardId, fetchDeptBeds, fetchSummary, showToast]);

    const patchBedStatus = useCallback(async (bedId: string, newStatus: BedStatus) => {
        setStatusMenuBedId(null);
        try {
            let url = API_ENDPOINTS.BED(bedId);
            url = await appendFacilityIdForProxy(url);
            const res = await fetch(url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                const updated = await res.json() as Bed;
                setDeptBeds(prev => prev.map(b => b.id === bedId ? updated : b).sort(compareBeds));
                fetchSummary();
            } else {
                const err = await res.json().catch(() => ({}));
                showToast((err as Record<string, string>).error || 'Failed to update status', 'error');
            }
        } catch {
            showToast('Failed to update status', 'error');
        }
    }, [fetchSummary, showToast]);

    /* close status menu on outside click */
    useEffect(() => {
        if (!statusMenuBedId) return;
        const handler = (e: MouseEvent) => {
            if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
                setStatusMenuBedId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [statusMenuBedId]);

    /* ── filtering & pagination calculation ─────────────────────────── */
    const filteredDepartments = useMemo(() => {
        if (!summary?.departments) return [];
        return summary.departments.filter(dept => {
            const matchesSearch = !searchQuery.trim() ||
                dept.department_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                getDeptSubtitle(dept.department_name).toLowerCase().includes(searchQuery.toLowerCase());

            let matchesStatus = true;
            if (selectedStatusFilter !== 'all') {
                if (selectedStatusFilter === 'available') matchesStatus = dept.available > 0;
                else if (selectedStatusFilter === 'occupied') matchesStatus = dept.occupied > 0;
                else if (selectedStatusFilter === 'blocked') matchesStatus = dept.blocked > 0;
                else if (selectedStatusFilter === 'unmapped') matchesStatus = dept.capacity_level === 'unmapped';
            }
            return matchesSearch && matchesStatus;
        });
    }, [summary, searchQuery, selectedStatusFilter]);

    const totalPages = Math.ceil(filteredDepartments.length / pageSize) || 1;
    const paginatedDepartments = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredDepartments.slice(start, start + pageSize);
    }, [filteredDepartments, currentPage, pageSize]);

    const assignedCount = useMemo(() => {
        return (summary?.departments || []).filter(d => d.total > 0).length;
    }, [summary]);

    /* ── filtered beds for ward tab ─────────────────────────────────── */
    const displayedBeds = useMemo(() => {
        return deptBeds.sort(compareBeds);
    }, [deptBeds]);

    /* ── shimmer loading skeleton ────────────────────────────────────── */
    const shimmer: React.CSSProperties = {
        background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        borderRadius: 6,
    };

    /* ── RENDER ──────────────────────────────────────────────────────── */

    if (summaryLoading && !summary) {
        return (
            <div className="app-main" style={{
                height: '100vh', display: 'flex', flexDirection: 'column', background: '#F8FAFC',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                minWidth: 0, flex: 1,
            }}>
                <TopBar title="Beds" subtitle="Manage bed mapping and occupancy" />
                <main style={{ flex: 1, padding: '20px 26px', overflow: 'auto' }}>
                    <div style={{ ...shimmer, height: 32, width: 240, marginBottom: 18 }} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
                        {[1, 2, 3, 4, 5].map(i => <div key={i} style={{ ...shimmer, height: 86 }} />)}
                    </div>
                    <div style={{ ...shimmer, height: 42, marginBottom: 14 }} />
                    <div style={{ ...shimmer, height: 400 }} />
                </main>
            </div>
        );
    }

    return (
        <div className="app-main" style={{
            height: '100vh', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            background: '#F8FAFC', color: '#0E182A',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            WebkitFontSmoothing: 'antialiased',
            minWidth: 0, flex: 1,
        }}>
            {/* Toast */}
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast.message} variant={toast.variant} dismissible={false} />
                </MacVibrancyToastPortal>
            )}

            {/* Confirm dialog */}
            {confirmAction && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirm-title"
                    style={{
                        position: 'fixed', inset: 0, zIndex: 2000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
                        background: 'rgba(14, 24, 42, 0.4)', backdropFilter: 'blur(1px)',
                    }}
                    onClick={() => !confirmInProgress && setConfirmAction(null)}
                >
                    <div
                        style={{
                            width: 'min(480px, 100%)', padding: '18px 22px',
                            background: '#FFFFFF', borderRadius: 6, border: '1px solid #E6EBF1',
                            boxShadow: '0 10px 25px -5px rgba(14, 24, 42, 0.1)',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div id="confirm-title" style={{ fontSize: 14, fontWeight: 700, color: '#0E182A', marginBottom: 6 }}>
                            {confirmAction.title}
                        </div>
                        <p style={{ fontSize: 11, color: '#718097', lineHeight: 1.45, margin: 0 }}>
                            {confirmAction.message}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                            <button
                                type="button"
                                style={{
                                    height: 28, padding: '0 12px', borderRadius: 5, border: '1px solid #DDE4EC',
                                    background: '#FFFFFF', fontSize: 11, fontWeight: 500, color: '#0E182A',
                                    cursor: confirmInProgress ? 'default' : 'pointer'
                                }}
                                onClick={() => setConfirmAction(null)}
                                disabled={confirmInProgress}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                style={{
                                    height: 28, padding: '0 12px', borderRadius: 5, border: 'none',
                                    background: '#EF4444', fontSize: 11, fontWeight: 600, color: '#FFFFFF',
                                    cursor: confirmInProgress ? 'default' : 'pointer'
                                }}
                                disabled={confirmInProgress}
                                onClick={async () => {
                                    setConfirmInProgress(true);
                                    try {
                                        await confirmAction.onConfirm();
                                    } finally {
                                        setConfirmInProgress(false);
                                        setConfirmAction(null);
                                    }
                                }}
                            >
                                {confirmInProgress ? 'Working…' : confirmAction.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <TopBar
                title="Beds"
                subtitle="Manage bed mapping and occupancy"
                actions={(
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div style={{ position: 'relative', width: 240, height: 32, flexShrink: 1 }}>
                            <Search
                                size={13}
                                strokeWidth={1.7}
                                color="#9AA7B8"
                                style={{ position: 'absolute', left: 9, top: 9.5, pointerEvents: 'none' }}
                            />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                placeholder="Filter by department name, ward, floor or service..."
                                style={{
                                    width: '100%', height: 32, padding: '0 10px 0 28px',
                                    borderRadius: 5, border: '1px solid #DCE4ED',
                                    background: '#FFFFFF', fontSize: 12.5, color: '#0E182A',
                                    outline: 'none',
                                }}
                            />
                        </div>

                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <select
                                value={selectedStatusFilter}
                                onChange={e => { setSelectedStatusFilter(e.target.value); setCurrentPage(1); }}
                                style={{
                                    height: 32, padding: '0 26px 0 10px', borderRadius: 5,
                                    border: '1px solid #DCE4ED', background: '#FFFFFF',
                                    fontSize: 12.5, fontWeight: 500, color: '#718097',
                                    appearance: 'none', cursor: 'pointer', outline: 'none',
                                }}
                            >
                                <option value="all">All Capacity Statuses</option>
                                <option value="available">Available Beds</option>
                                <option value="occupied">Occupied Beds</option>
                                <option value="blocked">Blocked Beds</option>
                                <option value="unmapped">Unmapped</option>
                            </select>
                            <ChevronDown size={13} strokeWidth={1.7} color="#9AA7B8" style={{ position: 'absolute', right: 7, top: 9.5, pointerEvents: 'none' }} />
                        </div>

                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <select
                                value={selectedFloorFilter}
                                onChange={e => setSelectedFloorFilter(e.target.value)}
                                style={{
                                    height: 32, padding: '0 26px 0 10px', borderRadius: 5,
                                    border: '1px solid #DCE4ED', background: '#FFFFFF',
                                    fontSize: 12.5, fontWeight: 500, color: '#718097',
                                    appearance: 'none', cursor: 'pointer', outline: 'none',
                                }}
                            >
                                <option value="all">All Campus Floors</option>
                                <option value="floor1">Floor 1 & Ground</option>
                                <option value="floor2">Floor 2 PACU/Pediatric</option>
                                <option value="floor3">Floor 3 Cardiac/ICU</option>
                                <option value="floor4">Floor 4 Neuro/Stroke</option>
                            </select>
                            <ChevronDown size={13} strokeWidth={1.7} color="#9AA7B8" style={{ position: 'absolute', right: 7, top: 9.5, pointerEvents: 'none' }} />
                        </div>

                        <button
                            type="button"
                            style={{
                                height: 32, padding: '0 10px', borderRadius: 5, flexShrink: 0,
                                border: '1px solid #DCE4ED', background: '#FFFFFF',
                                fontSize: 12.5, fontWeight: 500, color: '#718097',
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                cursor: 'pointer',
                            }}
                        >
                            <Filter size={12} strokeWidth={1.7} color="#718097" />
                            More Filters
                        </button>
                    </div>
                )}
            />

            <main style={{
                flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto',
                padding: '18px 24px 22px', background: '#F8FAFC', minWidth: 0,
            }}>
                {/* ── Page Header: Title & Main Action Buttons ────────────────── */}
                <div style={{
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                    gap: 12, marginBottom: 16, flexShrink: 0
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <h1 style={{
                                fontSize: 18, lineHeight: '22px', fontWeight: 700,
                                letterSpacing: '-0.3px', color: '#0E182A', margin: 0,
                            }}>
                                Bed Management
                            </h1>
                            <span style={{
                                fontSize: 9.5, fontWeight: 500, color: '#718097',
                                background: '#EBF1F7', border: '1px solid #DCE4ED',
                                borderRadius: 9999, padding: '2px 8px',
                            }}>
                                Inpatient census active
                            </span>
                        </div>
                        <div style={{ fontSize: 11.5, lineHeight: '16px', fontWeight: 400, color: '#8290A5', marginTop: 3 }}>
                            Real-time departmental bed capacity, occupancy allocation, and clinical unit assignment.
                        </div>
                    </div>
                </div>

                {/* ── Summary Cards Row (5 Cards) ───────────────────────────── */}
                {summary && (
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12,
                        marginBottom: 14, flexShrink: 0
                    }}>
                        {/* 1. TOTAL BED CAPACITY */}
                        <SummaryCard
                            label="TOTAL BED CAPACITY"
                            icon={<BedIcon size={14} strokeWidth={1.7} color="#718097" />}
                            number={summary.total}
                            unitLabel="registered beds"
                            subtext={`${summary.departments.length} Units · 2 Active wards configured`}
                        />

                        {/* 2. OCCUPIED BEDS */}
                        <SummaryCard
                            label="OCCUPIED BEDS"
                            icon={<Users size={14} strokeWidth={1.7} color="#718097" />}
                            number={summary.occupied}
                            unitLabel="current inpatients"
                            subtext="● No active admissions"
                        />

                        {/* 3. AVAILABLE FOR ADMISSION (Special Green Border & Text) */}
                        <SummaryCard
                            label="AVAILABLE FOR ADMISSION"
                            icon={<ShieldCheck size={14} strokeWidth={1.7} color="#009B68" />}
                            number={summary.available}
                            unitLabel="Beds ready"
                            subtext="● 100% Admission intake ready"
                            borderColor="#A9E8CF"
                            numberColor="#009B68"
                            labelColor="#009B68"
                            subtextColor="#009B68"
                        />

                        {/* 4. BLOCKED / ISOLATION */}
                        <SummaryCard
                            label="BLOCKED / ISOLATION"
                            icon={<Lock size={14} strokeWidth={1.7} color="#718097" />}
                            number={summary.blocked}
                            unitLabel="quarantine / repairs"
                            subtext="0 pending disinfection"
                        />

                        {/* 5. OVERALL OCCUPANCY RATE */}
                        <SummaryCard
                            label="OVERALL OCCUPANCY RATE"
                            icon={<Activity size={14} strokeWidth={1.7} color="#718097" />}
                            number={`${summary.occupancy_percent.toFixed(1)}%`}
                            unitLabel=""
                            subtext=""
                            badge={summary.capacity_label || 'Optimal'}
                        />
                    </div>
                )}

                {/* ── Table Container ────────────────────────────────────────── */}
                <div style={{
                    flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
                    background: '#FFFFFF', border: '1px solid #E7ECF2', borderRadius: 6,
                    overflow: 'hidden', minWidth: 0,
                }}>
                    <div style={{ overflowX: 'auto', flex: 1 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                            <thead>
                                <tr style={{
                                    height: 38, background: '#FFFFFF', borderBottom: '1px solid #E7ECF2',
                                }}>
                                    <th style={{
                                        padding: '0 14px', textAlign: 'left',
                                        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                                        color: '#718097', textTransform: 'uppercase',
                                    }}>
                                        DEPARTMENT / CLINICAL UNIT
                                    </th>
                                    <th style={{
                                        padding: '0 8px', textAlign: 'center', width: 90,
                                        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                                        color: '#718097', textTransform: 'uppercase',
                                    }}>
                                        TOTAL BEDS
                                    </th>
                                    <th style={{
                                        padding: '0 8px', textAlign: 'center', width: 90,
                                        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                                        color: '#718097', textTransform: 'uppercase',
                                    }}>
                                        OCCUPIED
                                    </th>
                                    <th style={{
                                        padding: '0 8px', textAlign: 'center', width: 90,
                                        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                                        color: '#718097', textTransform: 'uppercase',
                                    }}>
                                        AVAILABLE
                                    </th>
                                    <th style={{
                                        padding: '0 8px', textAlign: 'center', width: 80,
                                        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                                        color: '#718097', textTransform: 'uppercase',
                                    }}>
                                        BLOCKED
                                    </th>
                                    <th style={{
                                        padding: '0 10px', textAlign: 'center', width: 140,
                                        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                                        color: '#718097', textTransform: 'uppercase',
                                    }}>
                                        CAPACITY STATUS
                                    </th>
                                    <th style={{
                                        padding: '0 10px', textAlign: 'center', width: 120,
                                        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                                        color: '#718097', textTransform: 'uppercase',
                                    }}>
                                        LAST ACTIVITY
                                    </th>
                                    <th style={{
                                        padding: '0 14px', textAlign: 'right', width: 100,
                                        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                                        color: '#718097', textTransform: 'uppercase',
                                    }}>
                                        ACTIONS
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedDepartments.map(dept => (
                                    <DepartmentRow
                                        key={dept.department_id}
                                        dept={dept}
                                        isSelected={selectedDeptId === dept.department_id}
                                        isAdmin={isAdmin}
                                        lastUpdated={summary?.last_updated_at}
                                        onClick={() => openDepartment(dept.department_id)}
                                    />
                                ))}
                                {paginatedDepartments.length === 0 && (
                                    <tr>
                                        <td colSpan={8} style={{ padding: '36px 14px', textAlign: 'center', color: '#9AA7B8', fontSize: 12.5 }}>
                                            {searchQuery ? 'No matching departments found.' : 'No departments configured yet.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Table Footer / Pagination */}
                    <div style={{
                        height: 38, padding: '0 14px', borderTop: '1px solid #F0F3F6',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        fontSize: 12.5, color: '#8290A5', background: '#FFFFFF', flexShrink: 0
                    }}>
                        <div>
                            Showing <strong style={{ color: '#0E182A' }}>1 to {paginatedDepartments.length}</strong> of <strong style={{ color: '#0E182A' }}>{summary?.departments.length || 0}</strong> clinical departments
                            <span style={{ margin: '0 8px', color: '#CBD5E1' }}>—</span>
                            <span style={{ color: '#009B68', fontWeight: 500 }}>{assignedCount} units with assigned beds</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>Rows per view:</span>
                                <select
                                    style={{
                                        fontSize: 12.5, padding: '2px 6px', border: '1px solid #DCE4ED',
                                        borderRadius: 4, background: '#FFFFFF', color: '#0E182A', outline: 'none',
                                    }}
                                    value={pageSize}
                                    onChange={() => {}}
                                >
                                    <option value={15}>15</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                    type="button"
                                    disabled={currentPage <= 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    style={{
                                        height: 24, padding: '0 10px', borderRadius: 4,
                                        border: '1px solid #DCE4ED', background: '#FFFFFF',
                                        fontSize: 12.5, fontWeight: 500, color: '#475569',
                                        cursor: currentPage <= 1 ? 'default' : 'pointer',
                                        opacity: currentPage <= 1 ? 0.4 : 1,
                                    }}
                                >
                                    Previous
                                </button>
                                <button
                                    type="button"
                                    disabled={currentPage >= totalPages}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    style={{
                                        height: 24, padding: '0 10px', borderRadius: 4,
                                        border: '1px solid #DCE4ED', background: '#FFFFFF',
                                        fontSize: 12.5, fontWeight: 500, color: '#475569',
                                        cursor: currentPage >= totalPages ? 'default' : 'pointer',
                                        opacity: currentPage >= totalPages ? 0.4 : 1,
                                    }}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* ── Drawer for Department Bed Management ──────────────────────── */}
            {selectedDeptId && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 1000,
                        display: 'flex', justifyContent: 'flex-end',
                        background: 'rgba(14, 24, 42, 0.35)', backdropFilter: 'blur(1px)',
                    }}
                    onClick={closeDrawer}
                >
                    <div
                        style={{
                            width: 'min(600px, 100vw)', height: '100vh',
                            display: 'flex', flexDirection: 'column', overflow: 'hidden',
                            borderLeft: '1px solid #E6EBF1', background: '#FFFFFF',
                            boxShadow: '-10px 0 25px -5px rgba(14, 24, 42, 0.08)',
                            animation: 'slideInRight 0.18s ease-out',
                            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Drawer Header */}
                        <div style={{
                            padding: '16px 20px', borderBottom: '1px solid #E6EBF1',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
                            background: '#F8FAFC',
                        }}>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#0E182A' }}>
                                    {deptDetail?.name || 'Department Bed Mapping'}
                                </div>
                                <div style={{ fontSize: 11, color: '#8290A5', marginTop: 2 }}>
                                    Map beds and manage clinical status{deptDetail?.wards?.length ? ` · ${deptDetail.wards.length} ward${deptDetail.wards.length !== 1 ? 's' : ''}` : ''}
                                </div>
                            </div>
                            <button
                                type="button"
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: '#8290A5', padding: 4, display: 'flex', alignItems: 'center', borderRadius: 4
                                }}
                                onClick={closeDrawer}
                                aria-label="Close drawer"
                            >
                                <X size={18} strokeWidth={1.7} />
                            </button>
                        </div>

                        {/* Ward Tabs */}
                        {deptDetail && deptDetail.wards.length > 0 && (
                            <div style={{
                                padding: '10px 20px', borderBottom: '1px solid #E6EBF1',
                                display: 'flex', gap: 6, flexShrink: 0, overflowX: 'auto', background: '#FFFFFF',
                            }}>
                                <button
                                    type="button"
                                    style={{
                                        height: 26, padding: '0 12px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                                        border: activeWardId === null ? 'none' : '1px solid #DCE4ED',
                                        background: activeWardId === null ? '#101B30' : '#FFFFFF',
                                        color: activeWardId === null ? '#FFFFFF' : '#718097',
                                        cursor: 'pointer',
                                    }}
                                    onClick={() => setActiveWardId(null)}
                                >
                                    All Wards
                                </button>
                                {deptDetail.wards.map(w => (
                                    <button
                                        key={w.id}
                                        type="button"
                                        style={{
                                            height: 26, padding: '0 12px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                                            border: activeWardId === w.id ? 'none' : '1px solid #DCE4ED',
                                            background: activeWardId === w.id ? '#101B30' : '#FFFFFF',
                                            color: activeWardId === w.id ? '#FFFFFF' : '#718097',
                                            cursor: 'pointer',
                                        }}
                                        onClick={() => setActiveWardId(w.id)}
                                    >
                                        {w.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Add Bed Chips Input (Admin Only) */}
                        {isAdmin && (
                            <div style={{
                                padding: '14px 20px', borderBottom: '1px solid #E6EBF1', flexShrink: 0, background: '#F8FAFC',
                            }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#718097', marginBottom: 6 }}>
                                    Add Bed Numbers
                                </div>
                                <div style={{
                                    display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
                                    padding: '6px 10px', minHeight: 36,
                                    border: '1px solid #DCE4ED', borderRadius: 5,
                                    background: '#FFFFFF',
                                }}>
                                    {bedChips.map((chip, i) => (
                                        <span
                                            key={`${chip}-${i}`}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                                padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                                background: '#ECFBF5', color: '#008B60', border: '1px solid #BCEBD9',
                                            }}
                                        >
                                            {chip}
                                            <button
                                                type="button"
                                                onClick={() => removeChip(i)}
                                                style={{
                                                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                                    color: '#008B60', fontSize: 11, display: 'flex', alignItems: 'center',
                                                }}
                                            >
                                                <X size={12} strokeWidth={1.7} />
                                            </button>
                                        </span>
                                    ))}
                                    <input
                                        value={chipInput}
                                        onChange={e => setChipInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' || e.key === ',') {
                                                e.preventDefault();
                                                addChipsFromInput();
                                            }
                                            if (e.key === 'Backspace' && chipInput === '' && bedChips.length > 0) {
                                                setBedChips(prev => prev.slice(0, -1));
                                            }
                                        }}
                                        onBlur={addChipsFromInput}
                                        placeholder={bedChips.length === 0 ? 'e.g. 1-20, ICU-1, 12A' : ''}
                                        style={{
                                            flex: 1, minWidth: 120, border: 'none', outline: 'none',
                                            background: 'transparent', fontSize: 11, color: '#0E182A',
                                        }}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                    <button
                                        type="button"
                                        disabled={bedChips.length === 0 || addingBeds}
                                        onClick={addBeds}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 5,
                                            height: 28, padding: '0 12px', borderRadius: 5, border: 'none',
                                            background: '#101B30', color: '#FFFFFF', fontSize: 11, fontWeight: 600,
                                            cursor: bedChips.length === 0 || addingBeds ? 'default' : 'pointer',
                                            opacity: bedChips.length === 0 || addingBeds ? 0.5 : 1,
                                        }}
                                    >
                                        <Plus size={13} strokeWidth={1.7} />
                                        {addingBeds ? 'Adding…' : `Add ${bedChips.length || ''} bed${bedChips.length !== 1 ? 's' : ''}`}
                                    </button>
                                    {bedChips.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={replaceAllBeds}
                                            style={{
                                                height: 28, padding: '0 12px', borderRadius: 5, border: '1px solid #FECACA',
                                                background: '#FEF2F2', color: '#DC2626', fontSize: 11, fontWeight: 600,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            Replace All
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Bed Grid Display */}
                        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px', background: '#FFFFFF' }}>
                            {deptBedsLoading ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} style={{ ...shimmer, height: 60 }} />)}
                                </div>
                            ) : displayedBeds.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '44px 16px', color: '#8290A5' }}>
                                    <BedIcon size={36} strokeWidth={1.7} color="#CBD5E1" style={{ marginBottom: 8 }} />
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0E182A', marginBottom: 4 }}>
                                        {isAdmin ? 'No beds mapped yet' : 'No beds assigned to this department'}
                                    </div>
                                    {isAdmin && (
                                        <div style={{ fontSize: 11, color: '#8290A5' }}>
                                            Type ranges like 1-20 or individual numbers in the box above to generate beds.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
                                    {displayedBeds.map(bed => {
                                        const statusConfig = BED_STATUS_COLORS[bed.status] || BED_STATUS_COLORS.blocked;
                                        return (
                                            <div
                                                key={bed.id}
                                                style={{
                                                    position: 'relative',
                                                    padding: '10px 12px',
                                                    borderRadius: 5,
                                                    border: `1px solid ${statusMenuBedId === bed.id ? '#101B30' : '#E6EBF1'}`,
                                                    background: '#FFFFFF',
                                                    cursor: isAdmin ? 'pointer' : 'default',
                                                    transition: 'all 0.12s',
                                                }}
                                                onClick={() => isAdmin && setStatusMenuBedId(prev => prev === bed.id ? null : bed.id)}
                                            >
                                                {/* Delete Button */}
                                                {isAdmin && (
                                                    <button
                                                        type="button"
                                                        onClick={e => { e.stopPropagation(); deleteBed(bed); }}
                                                        style={{
                                                            position: 'absolute', top: 5, right: 5,
                                                            background: 'none', border: 'none', cursor: 'pointer',
                                                            color: '#9AA7B8', padding: 2, borderRadius: 3, display: 'flex', alignItems: 'center',
                                                        }}
                                                        aria-label={`Remove bed ${bed.bed_number}`}
                                                    >
                                                        <X size={12} strokeWidth={1.7} />
                                                    </button>
                                                )}

                                                {/* Bed Number */}
                                                <div style={{ fontSize: 13, fontWeight: 700, color: '#0E182A', marginBottom: 5 }}>
                                                    {bed.bed_number}
                                                </div>

                                                {/* Status Pill Badge */}
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                                    height: 16, padding: '0 7px', borderRadius: 9999,
                                                    fontSize: 9, fontWeight: 600,
                                                    background: statusConfig.bg, color: statusConfig.fg,
                                                    border: `1px solid ${statusConfig.border}`,
                                                }}>
                                                    <span style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: statusConfig.fg }} />
                                                    {statusConfig.label}
                                                </span>

                                                {/* Status Dropdown Options */}
                                                {isAdmin && statusMenuBedId === bed.id && (
                                                    <div
                                                        ref={statusMenuRef}
                                                        style={{
                                                            position: 'absolute', top: '100%', left: 0, zIndex: 20, marginTop: 4,
                                                            background: '#FFFFFF', border: '1px solid #E6EBF1',
                                                            borderRadius: 5, boxShadow: '0 6px 16px -2px rgba(14, 24, 42, 0.1)',
                                                            minWidth: 130, overflow: 'hidden',
                                                        }}
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        {(['available', 'occupied', 'blocked'] as BedStatus[]).map(s => (
                                                            <button
                                                                key={s}
                                                                type="button"
                                                                disabled={bed.status === s}
                                                                onClick={() => patchBedStatus(bed.id, s)}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                                    width: '100%', padding: '7px 12px',
                                                                    border: 'none', background: bed.status === s ? '#F8FAFC' : 'transparent',
                                                                    cursor: bed.status === s ? 'default' : 'pointer',
                                                                    fontSize: 10, color: '#0E182A', textAlign: 'left',
                                                                }}
                                                            >
                                                                <span style={{
                                                                    width: 6, height: 6, borderRadius: '50%',
                                                                    background: BED_STATUS_COLORS[s].fg,
                                                                }} />
                                                                {BED_STATUS_COLORS[s].label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Keyframe animations */}
            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
            `}</style>
        </div>
    );
}

/* ─── sub-components ────────────────────────────────────────────────── */

function SummaryCard({
    label,
    icon,
    number,
    unitLabel,
    subtext,
    borderColor = '#E6EBF1',
    numberColor = '#0E182A',
    labelColor = '#718097',
    subtextColor = '#A0ACBC',
    badge,
}: {
    label: string;
    icon: React.ReactNode;
    number: number | string;
    unitLabel?: string;
    subtext?: string;
    borderColor?: string;
    numberColor?: string;
    labelColor?: string;
    subtextColor?: string;
    badge?: string;
}) {
    return (
        <div style={{
            height: 86, padding: '12px 14px', borderRadius: 6,
            background: '#FFFFFF', border: `1px solid ${borderColor}`,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            boxShadow: 'none',
        }}>
            {/* Top Label & Icon */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                    fontSize: 9.5, fontWeight: 600, letterSpacing: '0.5px',
                    textTransform: 'uppercase', color: labelColor,
                }}>
                    {label}
                </span>
                <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: labelColor === '#009B68' ? '#ECFBF5' : '#F4F7FA',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    {icon}
                </div>
            </div>

            {/* Big Value Number */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{
                    fontSize: 26, lineHeight: '28px', fontWeight: 700,
                    letterSpacing: '-0.5px', color: numberColor,
                }}>
                    {number}
                </span>
                {unitLabel && (
                    <span style={{ fontSize: 9.5, fontWeight: 400, color: '#8290A5' }}>
                        {unitLabel}
                    </span>
                )}
                {badge && (
                    <span style={{
                        fontSize: 8.5, fontWeight: 600, color: '#008B60',
                        background: '#ECFBF5', border: '1px solid #BCEBD9',
                        borderRadius: 4, padding: '2px 6px', marginLeft: 4,
                    }}>
                        {badge}
                    </span>
                )}
            </div>

            {/* Bottom Supporting Text */}
            <div style={{ fontSize: 9.5, fontWeight: 400, color: subtextColor }}>
                {subtext}
            </div>
        </div>
    );
}

function DepartmentRow({ dept, isSelected, isAdmin, lastUpdated, onClick }: {
    dept: DepartmentBedSummary;
    isSelected: boolean;
    isAdmin: boolean;
    lastUpdated?: string;
    onClick: () => void;
}) {
    const isUnmapped = dept.capacity_level === 'unmapped';

    // Status Badge calculation
    let statusBg = '#ECFBF5';
    let statusFg = '#008B60';
    let statusBorder = '#BCEBD9';
    let statusDotColor = '#009B68';
    let statusLabel = 'Beds available';

    if (dept.capacity_level === 'unmapped') {
        statusBg = '#FFF9E8';
        statusFg = '#B87800';
        statusBorder = '#F4D98A';
        statusDotColor = '#D99A00';
        statusLabel = 'Unmapped';
    } else if (dept.capacity_level === 'critical' || dept.capacity_level === 'high') {
        statusBg = '#FEF2F2';
        statusFg = '#DC2626';
        statusBorder = '#FECACA';
        statusDotColor = '#DC2626';
        statusLabel = dept.capacity_label || 'High Capacity';
    } else if (dept.capacity_level === 'moderate') {
        statusBg = '#FFF7ED';
        statusFg = '#C2410C';
        statusBorder = '#FFEDD5';
        statusDotColor = '#EA580C';
        statusLabel = dept.capacity_label || 'Moderate';
    }

    const subtitle = getDeptSubtitle(dept.department_name);

    return (
        <tr
            style={{
                height: 52, cursor: 'pointer',
                background: isSelected ? '#F8FAFC' : '#FFFFFF',
                borderBottom: '1px solid #F0F3F6',
                transition: 'background 0.1s',
            }}
            onClick={onClick}
            onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#F8FAFC'; }}
            onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = isSelected ? '#F8FAFC' : '#FFFFFF'; }}
        >
            {/* Department / Clinical Unit Name & Subtitle */}
            <td style={{ padding: '0 14px', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#152033', lineHeight: '17px' }}>
                            {dept.department_name}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 400, color: '#8290A5', lineHeight: '15px', marginTop: 1 }}>
                            {subtitle}
                        </div>
                    </div>

                    {isUnmapped && isAdmin && (
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); onClick(); }}
                            style={{
                                fontSize: 10.5, fontWeight: 500, color: '#1685D1',
                                background: '#F4FAFF', border: '1px solid #CDE7FA',
                                borderRadius: 4, padding: '2px 6px', cursor: 'pointer',
                                marginLeft: 4, outline: 'none',
                            }}
                        >
                            + Add Beds
                        </button>
                    )}
                </div>
            </td>

            {/* Total Beds */}
            <td style={{ padding: '0 8px', textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: '#40516A' }}>
                {dept.total}
            </td>

            {/* Occupied */}
            <td style={{ padding: '0 8px', textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: dept.occupied > 0 ? '#DC2626' : '#40516A' }}>
                {dept.occupied}
            </td>

            {/* Available (Green if > 0) */}
            <td style={{ padding: '0 8px', textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: dept.available > 0 ? '#009B68' : '#40516A' }}>
                {dept.available}
            </td>

            {/* Blocked */}
            <td style={{ padding: '0 8px', textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: '#40516A' }}>
                {dept.blocked}
            </td>

            {/* Capacity Status Badge */}
            <td style={{ padding: '0 10px', textAlign: 'center' }}>
                <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    height: 22, padding: '0 10px', borderRadius: 9999,
                    fontSize: 11, fontWeight: 600,
                    background: statusBg, border: `1px solid ${statusBorder}`,
                    color: statusFg,
                }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusDotColor }} />
                    {statusLabel}
                </span>
            </td>

            {/* Last Activity */}
            <td style={{ padding: '0 10px', textAlign: 'center', fontSize: 11.5, fontWeight: 400, color: '#8290A5' }}>
                {relativeTime(lastUpdated || '')}
            </td>

            {/* Actions */}
            <td style={{ padding: '0 14px', textAlign: 'right' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                        fontSize: 12.5, fontWeight: 600,
                        color: isUnmapped ? '#718097' : '#1685D1',
                    }}>
                        {isUnmapped ? 'Configure' : 'Manage'}
                    </span>
                    <MoreVertical size={14} strokeWidth={1.7} color="#9AA7B8" />
                </div>
            </td>
        </tr>
    );
}
