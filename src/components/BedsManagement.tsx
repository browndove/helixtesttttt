'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { MacVibrancyToast, MacVibrancyToastPortal } from '@/components/MacVibrancyToast';
import { API_ENDPOINTS } from '@/lib/config';
import { appendFacilityIdForProxy } from '@/lib/facility-client';
import type { Bed, BedStatus, FacilityBedSummary, DepartmentBedSummary, BedCapacity } from '@/lib/beds';
import { parseCareUnits, type CareUnit, type CareUnitFloor } from '@/lib/care-units';
import UnitFloorsEditor from '@/components/UnitFloorsEditor';
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
    LayoutGrid,
    List,
    Building2,
} from 'lucide-react';

/* ─── constants ─────────────────────────────────────────────────────── */

const POLL_INTERVAL_MS = 20_000;

type ToastItem = { message: string; variant: 'success' | 'error' | 'info' };

type UnitBedRow = DepartmentBedSummary & {
    unit_id: string;
    floors: CareUnitFloor[];
    floor_count: number;
};

const UNMAPPED_CAPACITY: BedCapacity = {
    total: 0,
    occupied: 0,
    blocked: 0,
    available: 0,
    occupancy_percent: 0,
    capacity_level: 'unmapped',
    capacity_color: '',
    capacity_label: 'Unmapped',
};

function replaceUnitFloors(units: CareUnit[], unitId: string, floors: CareUnitFloor[]): CareUnit[] {
    return units.map(unit => (
        unit.id === unitId ? { ...unit, floors, floor_count: floors.length } : unit
    ));
}

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

function relativeTime(iso?: string): string {
    if (!iso) return '—';
    const when = new Date(iso);
    const diff = Date.now() - when.getTime();
    if (isNaN(diff)) return '—';
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
    return when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const BED_STATUS_COLORS: Record<BedStatus, { bg: string; fg: string; dot: string; label: string; border: string }> = {
    available: { bg: '#E7F8EF', fg: '#17803D', dot: '#22A35A', label: 'Available', border: '#B7E4C7' },
    occupied: { bg: '#E7F0FE', fg: '#1D4ED8', dot: '#3B82F6', label: 'Occupied', border: '#BFDBFE' },
    blocked: { bg: '#F3F4F6', fg: '#4B5563', dot: '#6B7280', label: 'Blocked', border: '#E5E7EB' },
};

function formatBedLabel(bedNumber: string): string {
    const trimmed = bedNumber.trim();
    if (/^bed\b/i.test(trimmed)) return trimmed;
    if (/^\d+$/.test(trimmed)) return `Bed ${trimmed.padStart(2, '0')}`;
    return `Bed ${trimmed}`;
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
    const [units, setUnits] = useState<CareUnit[]>([]);
    const [summaryLoading, setSummaryLoading] = useState(true);
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
    const [selectedUnitName, setSelectedUnitName] = useState<string | null>(null);

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
    const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
    const [bedStatusFilter, setBedStatusFilter] = useState<'all' | BedStatus>('all');
    const [inventoryLayout, setInventoryLayout] = useState<'floors' | 'matrix'>('floors');

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
            const [res, unitsRes] = await Promise.all([
                fetch(url, { credentials: 'include' }),
                fetch('/api/proxy/units', { credentials: 'include' }),
            ]);
            if (res.ok) {
                const data = await res.json();
                setSummary(data as FacilityBedSummary);
            } else {
                const err = await res.json().catch(() => ({}));
                console.error('Beds summary error:', err);
            }
            if (unitsRes.ok) {
                setUnits(parseCareUnits(await unitsRes.json()));
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

    const fetchDeptBeds = useCallback(async (deptId: string, floorId?: string | null) => {
        setDeptBedsLoading(true);
        try {
            let url = API_ENDPOINTS.DEPARTMENT_BEDS(deptId);
            if (floorId) url += `?floor_id=${encodeURIComponent(floorId)}`;
            url = await appendFacilityIdForProxy(url);
            const res = await fetch(url, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                const rawList = Array.isArray(data) ? data : (Array.isArray(data?.beds) ? data.beds : []);
                const normalized = rawList.map((bed: Record<string, unknown>) => {
                    const fId = bed.floor_id || bed.care_unit_floor_id || bed.unit_floor_id || bed.floorId || (typeof bed.floor === 'object' && bed.floor ? (bed.floor as { id?: string }).id : undefined);
                    return {
                        ...bed,
                        floor_id: fId ? String(fId) : undefined,
                    } as Bed;
                });
                setDeptBeds(normalized.sort(compareBeds));
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
    }, [fetchDeptDetail]);

    const openUnit = useCallback((row: UnitBedRow) => {
        setSelectedUnitId(row.unit_id);
        setSelectedUnitName(row.department_name);
        setBedChips([]);
        setChipInput('');
        setStatusMenuBedId(null);
        setSelectedFloorId(null);
        setBedStatusFilter('all');
        if (!row.department_id) {
            setSelectedDeptId(null);
            setDeptDetail(null);
            setDeptBeds([]);
            setActiveWardId(null);
            setSelectedFloorId(null);
            return;
        }
        openDepartment(row.department_id);
    }, [openDepartment]);

    const closeDrawer = useCallback(() => {
        setSelectedDeptId(null);
        setSelectedUnitId(null);
        setSelectedUnitName(null);
        setDeptDetail(null);
        setDeptBeds([]);
        setActiveWardId(null);
        setSelectedFloorId(null);
        setBedStatusFilter('all');
        setBedChips([]);
        setChipInput('');
        setStatusMenuBedId(null);
    }, []);

    /* load every bed in the department so floor tabs can show counts */
    useEffect(() => {
        if (!selectedDeptId) return;
        fetchDeptBeds(selectedDeptId);
    }, [selectedDeptId, fetchDeptBeds]);

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
        if (!selectedDeptId || !selectedFloorId || bedChips.length === 0) return;
        setAddingBeds(true);
        try {
            let url = API_ENDPOINTS.DEPARTMENT_BEDS(selectedDeptId);
            url = await appendFacilityIdForProxy(url);
            const body: Record<string, unknown> = {
                bed_numbers: bedChips,
                floor_id: selectedFloorId,
                care_unit_floor_id: selectedFloorId,
                unit_floor_id: selectedFloorId,
            };
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
                fetchDeptBeds(selectedDeptId);
                fetchSummary();
            } else {
                const err = await res.json().catch(() => ({} as Record<string, string>));
                showToast(err.error || err.message || 'Failed to add beds', 'error');
            }
        } catch {
            showToast('Failed to add beds', 'error');
        }
        setAddingBeds(false);
    }, [selectedDeptId, selectedFloorId, bedChips, activeWardId, fetchDeptBeds, fetchSummary, showToast]);

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
                        if (selectedDeptId) fetchDeptBeds(selectedDeptId);
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
    }, [selectedDeptId, fetchDeptBeds, fetchSummary, showToast]);

    const replaceAllBeds = useCallback(() => {
        if (!selectedDeptId || !selectedFloorId) return;
        const floorName = units.find(unit => unit.id === selectedUnitId)?.floors.find(floor => floor.id === selectedFloorId)?.name || 'this floor';
        setConfirmAction({
            title: 'Replace beds on this floor',
            message: `This replaces every mapped bed on ${floorName}. Occupancy resets to available. This cannot be undone.`,
            confirmLabel: 'Replace All',
            onConfirm: async () => {
                try {
                    let url = API_ENDPOINTS.DEPARTMENT_BEDS(selectedDeptId);
                    url = await appendFacilityIdForProxy(url);
                    const body: Record<string, unknown> = {
                        bed_numbers: bedChips,
                        floor_id: selectedFloorId,
                        care_unit_floor_id: selectedFloorId,
                        unit_floor_id: selectedFloorId,
                    };
                    const res = await fetch(url, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(body),
                    });
                    if (res.ok) {
                        showToast(`Replaced beds on ${floorName}`);
                        setBedChips([]);
                        setChipInput('');
                        fetchDeptBeds(selectedDeptId);
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
    }, [selectedDeptId, selectedFloorId, selectedUnitId, units, bedChips, fetchDeptBeds, fetchSummary, showToast]);

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

    const unitRows = useMemo<UnitBedRow[]>(() => {
        const byDepartment = new Map(
            (summary?.departments || []).map(dept => [dept.department_id, dept]),
        );
        return units.map(unit => {
            const dept = unit.department_id ? byDepartment.get(unit.department_id) : undefined;
            return {
                ...(dept ?? UNMAPPED_CAPACITY),
                department_id: unit.department_id || '',
                department_name: unit.name,
                unit_id: unit.id,
                floors: unit.floors,
                floor_count: unit.floors.length,
            };
        });
    }, [summary, units]);

    /* ── filtering & pagination calculation ─────────────────────────── */
    const filteredUnits = useMemo(() => {
        return unitRows.filter(unit => {
            const matchesSearch = !searchQuery.trim() ||
                unit.department_name.toLowerCase().includes(searchQuery.toLowerCase());

            let matchesStatus = true;
            if (selectedStatusFilter !== 'all') {
                if (selectedStatusFilter === 'available') matchesStatus = unit.available > 0;
                else if (selectedStatusFilter === 'occupied') matchesStatus = unit.occupied > 0;
                else if (selectedStatusFilter === 'blocked') matchesStatus = unit.blocked > 0;
                else if (selectedStatusFilter === 'unmapped') matchesStatus = unit.capacity_level === 'unmapped';
            }
            return matchesSearch && matchesStatus;
        });
    }, [unitRows, searchQuery, selectedStatusFilter]);

    const totalPages = Math.ceil(filteredUnits.length / pageSize) || 1;
    const paginatedUnits = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredUnits.slice(start, start + pageSize);
    }, [filteredUnits, currentPage, pageSize]);

    const assignedCount = useMemo(() => {
        return unitRows.filter(unit => unit.total > 0).length;
    }, [unitRows]);

    /* ── filtered beds for ward tab ─────────────────────────────────── */
    const scopeBeds = useMemo(() => {
        const rows = selectedFloorId
            ? deptBeds.filter(bed => bed.floor_id === selectedFloorId)
            : deptBeds;
        return [...rows].sort(compareBeds);
    }, [deptBeds, selectedFloorId]);

    const displayedBeds = useMemo(() => {
        if (bedStatusFilter === 'all') return scopeBeds;
        return scopeBeds.filter(bed => bed.status === bedStatusFilter);
    }, [scopeBeds, bedStatusFilter]);

    const bedGroups = useMemo(() => {
        const floors = units.find(unit => unit.id === selectedUnitId)?.floors ?? [];
        const floorName = new Map(floors.map(floor => [floor.id, floor.name]));
        const buckets = new Map<string, Bed[]>();
        for (const bed of displayedBeds) {
            const key = bed.floor_id || 'unassigned';
            const list = buckets.get(key) ?? [];
            list.push(bed);
            buckets.set(key, list);
        }
        const groups: { id: string; name: string; beds: Bed[] }[] = [];
        const orderedIds = selectedFloorId ? [selectedFloorId] : floors.map(floor => floor.id);
        for (const id of orderedIds) {
            const beds = buckets.get(id);
            if (beds?.length) groups.push({ id, name: floorName.get(id) || 'Floor', beds });
            buckets.delete(id);
        }
        for (const [id, beds] of buckets) {
            if (!beds.length) continue;
            groups.push({
                id,
                name: id === 'unassigned' ? 'Unassigned' : (floorName.get(id) || 'Floor'),
                beds,
            });
        }
        return groups;
    }, [displayedBeds, units, selectedUnitId, selectedFloorId]);

    const floorBedCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const bed of deptBeds) {
            if (!bed.floor_id) continue;
            counts[bed.floor_id] = (counts[bed.floor_id] || 0) + 1;
        }
        return counts;
    }, [deptBeds]);

    /* ── shimmer loading skeleton ────────────────────────────────────── */
    const shimmer: React.CSSProperties = {
        background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        borderRadius: 6,
    };

    /* ── RENDER ──────────────────────────────────────────────────────── */

    const selectedUnit = units.find(unit => unit.id === selectedUnitId) || null;
    const unitHasFloors = (selectedUnit?.floors.length ?? 0) > 0;
    const selectedFloorName = selectedUnit?.floors.find(floor => floor.id === selectedFloorId)?.name || '';
    const canManageBeds = unitHasFloors && Boolean(selectedDeptId);

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
                accessory={(
                    <Link
                        href="/beds/layout-setup"
                        style={{
                            height: 28, padding: '0 10px', borderRadius: 999, flexShrink: 0,
                            border: '1px solid #DCE4ED', background: '#FFFFFF',
                            fontSize: 12, fontWeight: 600, color: '#1D6FB8', textDecoration: 'none',
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                        }}
                    >
                        <Building2 size={13} strokeWidth={1.8} />
                        Blocks & rooms
                    </Link>
                )}
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
                                placeholder="Filter by unit name..."
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

            <style>{BEDS_TABLE_CSS}</style>
            <main className="beds-page" style={{
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
                            Real-time unit bed capacity and occupancy.
                        </div>
                    </div>
                </div>

                {/* ── Summary Cards Row (5 Cards) ───────────────────────────── */}
                {summary && (
                    <div className="beds-summary-grid" style={{ flexShrink: 0 }}>
                        {/* 1. TOTAL BED CAPACITY */}
                        <SummaryCard
                            label="TOTAL BED CAPACITY"
                            icon={<BedIcon size={14} strokeWidth={1.7} color="#718097" />}
                            number={summary.total}
                            unitLabel="registered beds"
                            subtext={`${units.length} Units`}
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
                <div className="beds-table-shell" style={{
                    flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
                    background: '#FFFFFF', border: '1px solid #E7ECF2', borderRadius: 6,
                    overflow: 'hidden', minWidth: 0,
                }}>
                    <div className="beds-table-scroll">
                        <table className="beds-data-table">
                            <thead>
                                <tr style={{
                                    height: 38, background: '#FFFFFF', borderBottom: '1px solid #E7ECF2',
                                }}>
                                    <th style={{
                                        padding: '0 14px', textAlign: 'left',
                                        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                                        color: '#718097', textTransform: 'uppercase',
                                    }}>
                                        UNIT
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
                                        padding: '0 14px', textAlign: 'right', width: 132,
                                        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                                        color: '#718097', textTransform: 'uppercase',
                                    }}>
                                        ACTIONS
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedUnits.map(unit => (
                                    <DepartmentRow
                                        key={unit.unit_id}
                                        dept={unit}
                                        isSelected={selectedUnitId === unit.unit_id}
                                        isAdmin={isAdmin}
                                        onClick={() => openUnit(unit)}
                                    />
                                ))}
                                {paginatedUnits.length === 0 && (
                                    <tr>
                                        <td colSpan={8} style={{ padding: '36px 14px', textAlign: 'center', color: '#9AA7B8', fontSize: 12.5 }}>
                                            {searchQuery ? 'No matching units found.' : 'No units configured yet.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="beds-card-list">
                        {paginatedUnits.map(unit => (
                            <DepartmentCard
                                key={unit.unit_id}
                                dept={unit}
                                isSelected={selectedUnitId === unit.unit_id}
                                isAdmin={isAdmin}
                                onClick={() => openUnit(unit)}
                            />
                        ))}
                        {paginatedUnits.length === 0 && (
                            <div style={{ padding: '36px 14px', textAlign: 'center', color: '#9AA7B8', fontSize: 12.5 }}>
                                {searchQuery ? 'No matching units found.' : 'No units configured yet.'}
                            </div>
                        )}
                    </div>

                    {/* Table Footer / Pagination */}
                    <div className="beds-table-footer" style={{
                        height: 38, padding: '0 14px', borderTop: '1px solid #F0F3F6',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        fontSize: 12.5, color: '#8290A5', background: '#FFFFFF', flexShrink: 0
                    }}>
                        <div>
                            Showing <strong style={{ color: '#0E182A' }}>{filteredUnits.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredUnits.length)}</strong> of <strong style={{ color: '#0E182A' }}>{filteredUnits.length}</strong> units
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
            {selectedUnitId && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 1000,
                        display: 'flex', justifyContent: 'flex-end',
                        background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(8px)',
                    }}
                    onClick={closeDrawer}
                >
                    <div
                        style={{
                            width: 'min(780px, 100vw)', height: '100vh',
                            display: 'flex', flexDirection: 'column', overflow: 'hidden',
                            borderLeft: '1px solid #E2E8F0', background: '#F8FAFC',
                            boxShadow: '-16px 0 36px -8px rgba(15, 23, 42, 0.16)',
                            animation: 'slideInRight 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Drawer Header */}
                        <div style={{
                            padding: '20px 24px 16px',
                            background: '#FFFFFF',
                            borderBottom: '1px solid #E2E8F0',
                            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexShrink: 0,
                        }}>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: 10, background: '#EFF6FF',
                                        border: '1px solid #DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <BedIcon size={18} color="#2563EB" strokeWidth={2} />
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
                                                {selectedUnitName || deptDetail?.name || 'Unit'}
                                            </h2>
                                            <span style={{
                                                fontSize: 11, fontWeight: 600, color: '#2563EB',
                                                background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 999, padding: '2px 8px',
                                            }}>
                                                Bed Mapping & Census
                                            </span>
                                            <span style={{ fontSize: 12, fontWeight: 500, color: '#64748B' }}>
                                                {selectedUnit?.floors.length ?? 0} floor{(selectedUnit?.floors.length ?? 0) === 1 ? '' : 's'}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                                            Map bed slots, manage patient occupancy, and configure unit capacity
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                style={{
                                    background: '#F1F5F9', border: '1px solid #E2E8F0', cursor: 'pointer',
                                    color: '#64748B', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8,
                                    transition: 'all 0.15s ease',
                                }}
                                onClick={closeDrawer}
                                aria-label="Close drawer"
                            >
                                <X size={16} strokeWidth={2} />
                            </button>
                        </div>

                        {/* Floor Navigation Bar */}
                        {selectedUnit && (
                            <div style={{ padding: '14px 24px 10px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', flexShrink: 0, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
                                <UnitFloorsEditor
                                    unitId={selectedUnit.id}
                                    floors={selectedUnit.floors}
                                    canEdit={isAdmin}
                                    showBedGate
                                    showAllTab
                                    selectedFloorId={selectedFloorId}
                                    floorCounts={floorBedCounts}
                                    allCount={deptBeds.length}
                                    onSelectFloor={floorId => {
                                        setSelectedFloorId(floorId);
                                        setBedStatusFilter('all');
                                        setBedChips([]);
                                        setChipInput('');
                                    }}
                                    onChange={floors => setUnits(prev => replaceUnitFloors(prev, selectedUnit.id, floors))}
                                />
                                {unitHasFloors && !selectedDeptId && (
                                    <p style={{ fontSize: 12, color: '#64748B', margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        ⚠️ Link this unit to a department before mapping beds.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Visual Census Meter & Filter Bar */}
                        {canManageBeds && (
                            <div style={{
                                padding: '12px 24px',
                                background: '#FFFFFF',
                                borderBottom: '1px solid #E2E8F0',
                                display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0,
                            }}>
                                {/* Visual Census Meter */}
                                {scopeBeds.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 600, color: '#475569' }}>
                                            <span>Occupancy Progress</span>
                                            <span>{scopeBeds.filter(b => b.status === 'occupied').length} / {scopeBeds.length} Occupied ({scopeBeds.length > 0 ? Math.round((scopeBeds.filter(b => b.status === 'occupied').length / scopeBeds.length) * 100) : 0}%)</span>
                                        </div>
                                        <div style={{ height: 6, width: '100%', background: '#F1F5F9', borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
                                            <div style={{ width: `${scopeBeds.length > 0 ? (scopeBeds.filter(b => b.status === 'occupied').length / scopeBeds.length) * 100 : 0}%`, background: '#2563EB', transition: 'width 0.3s ease' }} />
                                            <div style={{ width: `${scopeBeds.length > 0 ? (scopeBeds.filter(b => b.status === 'available').length / scopeBeds.length) * 100 : 0}%`, background: '#16A34A', transition: 'width 0.3s ease' }} />
                                            <div style={{ width: `${scopeBeds.length > 0 ? (scopeBeds.filter(b => b.status === 'blocked').length / scopeBeds.length) * 100 : 0}%`, background: '#94A3B8', transition: 'width 0.3s ease' }} />
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflowX: 'auto' }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#64748B', flexShrink: 0, marginRight: 2 }}>FILTER:</span>
                                        {([
                                            ['all', 'All', scopeBeds.length, '#0F172A'],
                                            ['available', 'Available', scopeBeds.filter(bed => bed.status === 'available').length, '#16A34A'],
                                            ['occupied', 'Occupied', scopeBeds.filter(bed => bed.status === 'occupied').length, '#2563EB'],
                                            ['blocked', 'Blocked', scopeBeds.filter(bed => bed.status === 'blocked').length, '#64748B'],
                                        ] as const).map(([key, label, count, dot]) => {
                                            const active = bedStatusFilter === key;
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => setBedStatusFilter(key)}
                                                    style={{
                                                        flex: '0 0 auto',
                                                        height: 28,
                                                        padding: '0 10px',
                                                        borderRadius: 7,
                                                        border: active ? '1px solid #0F172A' : '1px solid #E2E8F0',
                                                        background: active ? '#0F172A' : '#FFFFFF',
                                                        color: active ? '#FFFFFF' : '#475569',
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                    }}
                                                >
                                                    {key !== 'all' && (
                                                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? '#FFFFFF' : dot }} />
                                                    )}
                                                    {label} <span style={{ opacity: active ? 0.9 : 0.6, fontSize: 11 }}>({count})</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <span style={{ fontSize: 12, fontWeight: 500, color: '#64748B', flexShrink: 0 }}>
                                        <strong style={{ color: '#0F172A' }}>{scopeBeds.length}</strong> beds mapped
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Add Bed Generator Card */}
                        {canManageBeds && isAdmin && (
                            <div style={{ padding: '16px 24px 8px', flexShrink: 0 }}>
                                <div style={{
                                    border: '1px solid #E2E8F0', borderRadius: 14, background: '#FFFFFF', padding: '16px',
                                    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Plus size={15} color="#2563EB" strokeWidth={2.5} />
                                            Add bed numbers{selectedFloorName ? ` to ${selectedFloorName}` : ''}
                                        </div>
                                        <div style={{ fontSize: 11.5, color: '#94A3B8' }}>Comma or hyphen separated (e.g. 1-10, ICU-1)</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                        <div style={{
                                            flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
                                            minHeight: 42, padding: '6px 12px', border: '1px solid #CBD5E1', borderRadius: 10, background: '#F8FAFC',
                                            transition: 'border-color 0.15s ease',
                                        }}>
                                            {bedChips.map((chip, i) => (
                                                <span
                                                    key={`${chip}-${i}`}
                                                    style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 5,
                                                        padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600,
                                                        background: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0',
                                                    }}
                                                >
                                                    {chip}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeChip(i)}
                                                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#15803D', display: 'flex' }}
                                                    >
                                                        <X size={12} strokeWidth={2} />
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
                                                placeholder={bedChips.length === 0 ? 'Type bed numbers (e.g. 1-20, ICU-12)' : ''}
                                                style={{
                                                    flex: 1, minWidth: 160, border: 'none', outline: 'none',
                                                    background: 'transparent', fontSize: 13, color: '#0F172A',
                                                }}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            disabled={!selectedFloorId || bedChips.length === 0 || addingBeds}
                                            onClick={addBeds}
                                            style={{
                                                height: 42, padding: '0 16px', borderRadius: 10, border: 'none',
                                                background: '#0F172A', color: '#FFFFFF', fontSize: 13, fontWeight: 650,
                                                display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                                                cursor: !selectedFloorId || bedChips.length === 0 || addingBeds ? 'default' : 'pointer',
                                                opacity: !selectedFloorId || bedChips.length === 0 || addingBeds ? 0.45 : 1,
                                                transition: 'all 0.15s ease',
                                                boxShadow: bedChips.length > 0 ? '0 2px 8px rgba(15, 23, 42, 0.2)' : 'none'
                                            }}
                                        >
                                            <Plus size={15} strokeWidth={2.5} />
                                            {addingBeds ? 'Adding…' : 'Add Beds'}
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#64748B' }}>Quick presets:</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const labels = expandBedLabels('1-10');
                                                    setBedChips(prev => {
                                                        const seen = new Set(prev.map(chip => chip.toLowerCase()));
                                                        const next = [...prev];
                                                        for (const label of labels) {
                                                            if (!seen.has(label.toLowerCase())) {
                                                                seen.add(label.toLowerCase());
                                                                next.push(label);
                                                            }
                                                        }
                                                        return next;
                                                    });
                                                }}
                                                style={{
                                                    border: '1px solid #DBEAFE', background: '#EFF6FF', borderRadius: 6,
                                                    padding: '2px 8px', color: '#2563EB', fontSize: 11.5, fontWeight: 600, cursor: 'pointer'
                                                }}
                                            >
                                                Beds 1–10
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const labels = expandBedLabels('11-20');
                                                    setBedChips(prev => {
                                                        const seen = new Set(prev.map(chip => chip.toLowerCase()));
                                                        const next = [...prev];
                                                        for (const label of labels) {
                                                            if (!seen.has(label.toLowerCase())) {
                                                                seen.add(label.toLowerCase());
                                                                next.push(label);
                                                            }
                                                        }
                                                        return next;
                                                    });
                                                }}
                                                style={{
                                                    border: '1px solid #DBEAFE', background: '#EFF6FF', borderRadius: 6,
                                                    padding: '2px 8px', color: '#2563EB', fontSize: 11.5, fontWeight: 600, cursor: 'pointer'
                                                }}
                                            >
                                                Beds 11–20
                                            </button>
                                        </div>

                                        {bedChips.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={replaceAllBeds}
                                                style={{ border: 'none', background: 'none', padding: 0, color: '#EF4444', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
                                            >
                                                Replace beds on this floor
                                            </button>
                                        )}
                                        {!selectedFloorId && (
                                            <span style={{ fontSize: 11.5, color: '#D97706', fontWeight: 500 }}>Select a floor tab to add beds there.</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Bed Inventory Cards Grid */}
                        {canManageBeds && (
                        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 24px 24px', background: '#F8FAFC' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: '#0F172A', textTransform: 'uppercase' }}>
                                        BED INVENTORY & LAYOUT
                                    </span>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: '#2563EB', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                                        {scopeBeds.length} slot{scopeBeds.length === 1 ? '' : 's'} mapped
                                    </span>
                                </div>
                                <div style={{
                                    display: 'inline-flex', padding: 2, borderRadius: 8, background: '#E2E8F0',
                                    border: '1px solid #CBD5E1', flexShrink: 0,
                                }}>
                                    {([
                                        ['floors', 'Floor layout', LayoutGrid],
                                        ['matrix', 'Matrix list', List],
                                    ] as const).map(([key, label, Icon]) => {
                                        const active = inventoryLayout === key;
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => setInventoryLayout(key)}
                                                style={{
                                                    height: 28, padding: '0 10px', borderRadius: 6, border: 'none',
                                                    background: active ? '#FFFFFF' : 'transparent',
                                                    color: active ? '#0F172A' : '#64748B',
                                                    boxShadow: active ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
                                                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <Icon size={13} strokeWidth={2} />
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            {deptBedsLoading ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                                    {[1, 2, 3, 4].map(i => <div key={i} style={{ ...shimmer, height: 92 }} />)}
                                </div>
                            ) : displayedBeds.length === 0 ? (
                                <div style={{
                                    textAlign: 'center', padding: '48px 16px', color: '#64748B',
                                    background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0'
                                }}>
                                    <BedIcon size={40} strokeWidth={1.5} color="#94A3B8" style={{ marginBottom: 10 }} />
                                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>
                                        {selectedFloorName ? `No beds on ${selectedFloorName} yet` : 'No beds mapped yet'}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#94A3B8' }}>Use the box above to add bed slots to this floor.</div>
                                </div>
                            ) : inventoryLayout === 'matrix' ? (
                                <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', background: '#FFFFFF' }}>
                                    {displayedBeds.map((bed, index) => {
                                        const floorName = selectedUnit?.floors.find(floor => floor.id === bed.floor_id)?.name;
                                        return (
                                            <div
                                                key={bed.id}
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr) auto auto',
                                                    gap: 12,
                                                    alignItems: 'center',
                                                    padding: '12px 16px',
                                                    borderTop: index === 0 ? 'none' : '1px solid #F1F5F9',
                                                    background: '#FFFFFF',
                                                }}
                                            >
                                                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>{formatBedLabel(bed.bed_number)}</span>
                                                <span style={{ fontSize: 12.5, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {floorName || 'Unassigned'}
                                                </span>
                                                <BedStatusControl
                                                    bed={bed}
                                                    isAdmin={isAdmin}
                                                    open={statusMenuBedId === bed.id}
                                                    menuRef={statusMenuRef}
                                                    onToggle={() => setStatusMenuBedId(prev => prev === bed.id ? null : bed.id)}
                                                    onSelect={status => patchBedStatus(bed.id, status)}
                                                />
                                                {isAdmin ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => deleteBed(bed)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, display: 'flex', borderRadius: 4 }}
                                                        aria-label={`Remove bed ${bed.bed_number}`}
                                                    >
                                                        <X size={14} strokeWidth={2} />
                                                    </button>
                                                ) : <span />}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {bedGroups.map(group => {
                                        const available = group.beds.filter(bed => bed.status === 'available').length;
                                        const occupied = group.beds.filter(bed => bed.status === 'occupied').length;
                                        const blocked = group.beds.filter(bed => bed.status === 'blocked').length;
                                        return (
                                            <section key={group.id} style={{ border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB', flexShrink: 0 }} />
                                                        <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {group.name}
                                                        </span>
                                                        {selectedUnitName && (
                                                            <span style={{ fontSize: 12, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                · {selectedUnitName}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, fontSize: 12, fontWeight: 600 }}>
                                                        {available > 0 && <span style={{ color: '#16A34A', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A' }} />{available} Available</span>}
                                                        {occupied > 0 && <span style={{ color: '#2563EB', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563EB' }} />{occupied} Occupied</span>}
                                                        {blocked > 0 && <span style={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#64748B' }} />{blocked} Blocked</span>}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
                                                    {group.beds.map(bed => (
                                                        <BedSlotCard
                                                            key={bed.id}
                                                            bed={bed}
                                                            isAdmin={isAdmin}
                                                            menuOpen={statusMenuBedId === bed.id}
                                                            menuRef={statusMenuRef}
                                                            onToggleMenu={() => setStatusMenuBedId(prev => prev === bed.id ? null : bed.id)}
                                                            onSelectStatus={status => patchBedStatus(bed.id, status)}
                                                            onRemove={() => deleteBed(bed)}
                                                        />
                                                    ))}
                                                </div>
                                            </section>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        )}
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

function BedStatusMenu({
    bed,
    menuRef,
    onSelect,
}: {
    bed: Bed;
    menuRef: React.RefObject<HTMLDivElement | null>;
    onSelect: (status: BedStatus) => void;
}) {
    return (
        <div
            ref={menuRef}
            style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 20, marginTop: 4,
                background: '#FFFFFF', border: '1px solid #E6EBF1',
                borderRadius: 8, boxShadow: '0 8px 20px rgba(16, 24, 40, 0.12)',
                minWidth: 140, overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
        >
            {(['available', 'occupied', 'blocked'] as BedStatus[]).map(status => (
                <button
                    key={status}
                    type="button"
                    disabled={bed.status === status}
                    onClick={() => onSelect(status)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        width: '100%', padding: '8px 12px',
                        border: 'none', background: bed.status === status ? '#F8FAFC' : 'transparent',
                        cursor: bed.status === status ? 'default' : 'pointer',
                        fontSize: 12, color: '#172033', textAlign: 'left',
                    }}
                >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: BED_STATUS_COLORS[status].dot }} />
                    {BED_STATUS_COLORS[status].label}
                </button>
            ))}
        </div>
    );
}

function BedStatusControl({
    bed,
    isAdmin,
    open,
    menuRef,
    onToggle,
    onSelect,
}: {
    bed: Bed;
    isAdmin: boolean;
    open: boolean;
    menuRef: React.RefObject<HTMLDivElement | null>;
    onToggle: () => void;
    onSelect: (status: BedStatus) => void;
}) {
    const statusConfig = BED_STATUS_COLORS[bed.status] || BED_STATUS_COLORS.blocked;
    return (
        <div style={{ position: 'relative' }}>
            <button
                type="button"
                onClick={isAdmin ? onToggle : undefined}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    height: 26, padding: '0 8px', borderRadius: 999, border: 'none',
                    fontSize: 12, fontWeight: 650,
                    background: statusConfig.bg, color: statusConfig.fg,
                    cursor: isAdmin ? 'pointer' : 'default',
                }}
            >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusConfig.dot }} />
                {statusConfig.label}
            </button>
            {isAdmin && open && <BedStatusMenu bed={bed} menuRef={menuRef} onSelect={onSelect} />}
        </div>
    );
}

function BedSlotCard({
    bed,
    isAdmin,
    menuOpen,
    menuRef,
    onToggleMenu,
    onSelectStatus,
    onRemove,
}: {
    bed: Bed;
    isAdmin: boolean;
    menuOpen: boolean;
    menuRef: React.RefObject<HTMLDivElement | null>;
    onToggleMenu: () => void;
    onSelectStatus: (status: BedStatus) => void;
    onRemove: () => void;
}) {
    const statusConfig = BED_STATUS_COLORS[bed.status] || BED_STATUS_COLORS.blocked;
    return (
        <div
            style={{
                position: 'relative',
                padding: '14px 16px',
                minHeight: 92,
                borderRadius: 14,
                border: `1.5px solid ${menuOpen ? '#2563EB' : statusConfig.border}`,
                background: '#FFFFFF',
                cursor: isAdmin ? 'pointer' : 'default',
                boxShadow: menuOpen ? '0 4px 12px rgba(37, 99, 235, 0.12)' : '0 1px 3px rgba(15, 23, 42, 0.04)',
                transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
            }}
            onClick={() => isAdmin && onToggleMenu()}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 28, height: 28, borderRadius: 8, background: statusConfig.bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                        <BedIcon size={14} color={statusConfig.fg} strokeWidth={2} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 750, color: '#0F172A', lineHeight: '20px' }}>
                        {formatBedLabel(bed.bed_number)}
                    </div>
                </div>
                {isAdmin && (
                    <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onRemove(); }}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#94A3B8', padding: 2, display: 'flex', borderRadius: 4,
                            transition: 'color 0.15s ease',
                        }}
                        aria-label={`Remove bed ${bed.bed_number}`}
                    >
                        <X size={14} strokeWidth={2} />
                    </button>
                )}
            </div>
            <div style={{ marginTop: 12 }} onClick={e => e.stopPropagation()}>
                <BedStatusControl
                    bed={bed}
                    isAdmin={isAdmin}
                    open={menuOpen}
                    menuRef={menuRef}
                    onToggle={onToggleMenu}
                    onSelect={onSelectStatus}
                />
            </div>
        </div>
    );
}

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

function capacityStatus(dept: DepartmentBedSummary) {
    const isUnmapped = dept.capacity_level === 'unmapped';
    let statusBg = '#ECFBF5';
    let statusFg = '#008B60';
    let statusBorder = '#BCEBD9';
    let statusDotColor = '#009B68';
    let statusLabel = 'Beds available';

    if (isUnmapped) {
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

    return { isUnmapped, statusBg, statusFg, statusBorder, statusDotColor, statusLabel };
}

const BEDS_TABLE_CSS = `
.beds-page { container-type: inline-size; }
.beds-table-shell { container-type: inline-size; min-width: 0; }
.beds-table-scroll { min-width: 0; width: 100%; overflow-x: auto; flex: 1; }
.beds-data-table { width: 100%; min-width: 980px; border-collapse: collapse; }
.beds-data-table th { white-space: nowrap; }
.beds-card-list { display: none; }
.beds-card-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
.beds-summary-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
@container (max-width: 980px) {
  .beds-summary-grid { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
}
@container (max-width: 860px) {
  .beds-table-scroll { display: none; }
  .beds-card-list { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: auto; }
  .beds-table-footer { height: auto !important; flex-wrap: wrap; gap: 10px; padding-top: 10px !important; padding-bottom: 10px !important; }
}
@container (max-width: 420px) {
  .beds-card-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;

function DepartmentRow({ dept, isSelected, isAdmin, onClick }: {
    dept: UnitBedRow;
    isSelected: boolean;
    isAdmin: boolean;
    onClick: () => void;
}) {
    const { isUnmapped, statusBg, statusFg, statusBorder, statusDotColor, statusLabel } = capacityStatus(dept);

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
            <td style={{ padding: '0 14px', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#152033', lineHeight: '17px' }}>
                        {dept.department_name}
                    </div>

                    {dept.floor_count === 0 && isAdmin && (
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
                            + Add floors
                        </button>
                    )}
                    {dept.floor_count > 0 && isUnmapped && isAdmin && (
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
                {relativeTime(dept.last_updated_at)}
            </td>

            {/* Actions */}
            <td style={{ padding: '0 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                    <span style={{
                        fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
                        color: dept.floor_count === 0 || isUnmapped ? '#718097' : '#1685D1',
                    }}>
                        {dept.floor_count === 0 ? 'Add floors' : isUnmapped ? 'Configure' : 'Manage'}
                    </span>
                    <MoreVertical size={14} strokeWidth={1.7} color="#9AA7B8" />
                </div>
            </td>
        </tr>
    );
}

function DepartmentCard({ dept, isSelected, isAdmin, onClick }: {
    dept: UnitBedRow;
    isSelected: boolean;
    isAdmin: boolean;
    onClick: () => void;
}) {
    const { isUnmapped, statusBg, statusFg, statusBorder, statusDotColor, statusLabel } = capacityStatus(dept);
    const stats = [
        { label: 'Total', value: dept.total, color: '#40516A' },
        { label: 'Occupied', value: dept.occupied, color: dept.occupied > 0 ? '#DC2626' : '#40516A' },
        { label: 'Available', value: dept.available, color: dept.available > 0 ? '#009B68' : '#40516A' },
        { label: 'Blocked', value: dept.blocked, color: '#40516A' },
    ];

    return (
        <article
            onClick={onClick}
            style={{
                padding: '12px 14px', cursor: 'pointer',
                background: isSelected ? '#F8FAFC' : '#FFFFFF',
                borderBottom: '1px solid #F0F3F6',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0, fontSize: 13.5, fontWeight: 600, color: '#152033', lineHeight: '17px' }}>
                    {dept.department_name}
                </div>
                <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                    height: 22, padding: '0 10px', borderRadius: 9999,
                    fontSize: 11, fontWeight: 600,
                    background: statusBg, border: `1px solid ${statusBorder}`,
                    color: statusFg,
                }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusDotColor }} />
                    {statusLabel}
                </span>
            </div>

            <div className="beds-card-stats">
                {stats.map(stat => (
                    <div key={stat.label} style={{
                        background: '#F8FAFC', border: '1px solid #F0F3F6', borderRadius: 6, padding: '8px 10px',
                    }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: '#718097', textTransform: 'uppercase' }}>
                            {stat.label}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: stat.color, marginTop: 2 }}>{stat.value}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 }}>
                <span style={{ fontSize: 11.5, color: '#8290A5' }}>{relativeTime(dept.last_updated_at)}</span>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {dept.floor_count === 0 && isAdmin && (
                        <span style={{
                            fontSize: 10.5, fontWeight: 500, color: '#1685D1',
                            background: '#F4FAFF', border: '1px solid #CDE7FA',
                            borderRadius: 4, padding: '2px 6px',
                        }}>
                            + Add floors
                        </span>
                    )}
                    {dept.floor_count > 0 && isUnmapped && isAdmin && (
                        <span style={{
                            fontSize: 10.5, fontWeight: 500, color: '#1685D1',
                            background: '#F4FAFF', border: '1px solid #CDE7FA',
                            borderRadius: 4, padding: '2px 6px',
                        }}>
                            + Add Beds
                        </span>
                    )}
                    <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', color: dept.floor_count === 0 || isUnmapped ? '#718097' : '#1685D1' }}>
                        {dept.floor_count === 0 ? 'Add floors' : isUnmapped ? 'Configure' : 'Manage'}
                    </span>
                </div>
            </div>
        </article>
    );
}
