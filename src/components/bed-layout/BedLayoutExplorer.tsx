'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bed as BedIcon, Building2, ChevronDown, ChevronLeft, DoorOpen, Layers, MoreHorizontal, Plus } from 'lucide-react';
import TopBar from '@/components/TopBar';
import { MacVibrancyToast, MacVibrancyToastPortal } from '@/components/MacVibrancyToast';
import { parseCareUnits, type CareUnit } from '@/lib/care-units';
import { API_ENDPOINTS } from '@/lib/config';
import { appendFacilityIdForProxy } from '@/lib/facility-client';
import type { BedStatus } from '@/lib/beds';
import {
    genderLabel,
    hierarchyApiMessage,
    lastModified,
    parseBeds,
    parseBlocks,
    parseRooms,
    wardTypeLabel,
    type Block,
    type Floor,
    type HierarchyBed,
    type Room,
    type Ward,
} from '@/lib/bed-hierarchy';
import CustomSelect from '@/components/CustomSelect';
import BedLayoutFormDialog, { type FormDialogRequest, type LayoutLevel } from './BedLayoutFormDialog';
import BedLayoutToolbar, { type StatusFilter } from './BedLayoutToolbar';
import BedTile from './BedTile';
import { SAMPLE_BLOCKS } from './bed-layout-sample';
import { applyPreviewOp, type PreviewLevel, type PreviewOp } from './preview-store';
import { BED_STATUS_META, card, formatDate, linkButton, primaryButton, secondaryButton } from './bed-layout-ui';

type Toast = { message: string; variant: 'success' | 'error' | 'info' };

type DeleteTarget = { label: string; level: PreviewLevel; id: string; endpoint: string; warning?: string };

type FloorRow = { block: Block; floor: Floor };

type HomeRow = { block: Block; floor: Floor | null };

function ActionMenu({ items }: { items: { label: string; onClick: () => void; danger?: boolean }[] }) {
    const [open, setOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (!open) return;
        const place = () => {
            const rect = buttonRef.current?.getBoundingClientRect();
            if (!rect) return;
            setPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 180) });
        };
        place();
        const onPointer = (event: MouseEvent) => {
            const target = event.target as Node;
            if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onPointer);
        window.addEventListener('scroll', place, true);
        window.addEventListener('resize', place);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            window.removeEventListener('scroll', place, true);
            window.removeEventListener('resize', place);
        };
    }, [open]);

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                aria-label="Actions"
                aria-expanded={open}
                onClick={() => setOpen(current => !current)}
                style={{
                    width: 28, height: 28, borderRadius: 8, border: '1px solid #E6EBF1',
                    background: open ? '#F4F7FB' : '#FFFFFF', color: '#475467',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
            >
                <MoreHorizontal size={16} strokeWidth={2} />
            </button>
            {open && typeof document !== 'undefined' && createPortal(
                <div
                    ref={menuRef}
                    style={{
                        position: 'fixed', top: pos.top, left: pos.left, width: 180, zIndex: 99999,
                        background: '#FFFFFF', border: '1px solid #E6EBF1', borderRadius: 10,
                        boxShadow: '0 8px 24px rgba(16, 24, 40, 0.12)', padding: 4,
                    }}
                >
                    {items.map(item => (
                        <button
                            key={item.label}
                            type="button"
                            onClick={() => { setOpen(false); item.onClick(); }}
                            style={{
                                width: '100%', textAlign: 'left', border: 'none', background: 'none',
                                padding: '8px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 13,
                                fontWeight: 600, color: item.danger ? '#B42318' : '#172033',
                            }}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>,
                document.body,
            )}
        </>
    );
}

type DeptRef = { id: string; name: string };

type DirectoryGroup = { id: string; name: string; units: Ward[] };

function readDepartments(raw: unknown): DeptRef[] {
    const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
    const rows = Array.isArray(raw)
        ? raw
        : record
            ? (['departments', 'items', 'data', 'results'] as const)
                .map(key => record[key])
                .find(Array.isArray) || []
            : [];
    return rows.flatMap(item => {
        if (!item || typeof item !== 'object') return [];
        const row = item as Record<string, unknown>;
        const id = typeof row.id === 'string' ? row.id : '';
        const name = typeof row.name === 'string' ? row.name.trim() : '';
        return id && name ? [{ id, name }] : [];
    });
}

/** The floor list is the facility's departments and care units, not a room table. */
function directoryGroups(wards: Ward[], departments: DeptRef[], units: CareUnit[]): DirectoryGroup[] | null {
    const deptName = new Map(departments.map(item => [item.id, item.name]));
    const unitById = new Map(units.map(item => [item.id, item]));
    if (!wards.some(item => deptName.has(item.id) || unitById.has(item.id))) return null;

    const groups = new Map<string, DirectoryGroup>();
    const ensure = (id: string, name: string) => {
        const key = id || name || 'unassigned';
        const existing = groups.get(key);
        if (existing) return existing;
        const created = { id: key, name: name || 'Unassigned', units: [] };
        groups.set(key, created);
        return created;
    };

    for (const ward of wards) {
        if (deptName.has(ward.id) && !unitById.has(ward.id)) {
            ensure(ward.id, deptName.get(ward.id) || ward.name);
            continue;
        }
        const unit = unitById.get(ward.id);
        const departmentId = unit?.department_id || ward.department_id || '';
        const departmentName = unit?.department_name || ward.department_name || deptName.get(departmentId) || 'Unassigned';
        ensure(departmentId || departmentName, departmentName).units.push(ward);
    }

    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function genderOf(unit: Ward, careUnits: CareUnit[]): string {
    const listed = careUnits.find(item => item.id === unit.id)?.gender_restriction;
    const value = unit.gender_restriction
        || (listed === 'male' || listed === 'female' || listed === 'mixed' ? listed : undefined);
    return genderLabel(value) || '—';
}

/** The API backfills one Unassigned block and floor. That bucket is not a building or a floor. */
function isBackfill(name: string): boolean {
    return name.trim().toLowerCase() === 'unassigned';
}

/** Units saved on a building before it has a real floor live on this hidden floor. */
const BUILDING_UNIT_FLOOR = 'attached units';

function isListedFloor(name: string): boolean {
    return !isBackfill(name) && name.trim().toLowerCase() !== BUILDING_UNIT_FLOOR;
}

/** The Unassigned backfill floor comes back with every unit in the facility. Those are not its wards. */
function wardsPlacedOnFloor(floor: Floor, careUnits: CareUnit[]): Ward[] {
    const placed = floor.wards.filter(ward => !ward.floor_id || ward.floor_id === floor.id);
    const unitIds = new Set(careUnits.map(unit => unit.id));
    const holdsEveryUnit = unitIds.size > 0
        && placed.length === unitIds.size
        && placed.every(ward => unitIds.has(ward.id));
    if (/unassigned/i.test(floor.name) && holdsEveryUnit) return [];
    return placed;
}

function unitsOnBlock(block: Block, careUnits: CareUnit[]): { id: string; name: string }[] {
    const seen = new Set<string>();
    const units: { id: string; name: string }[] = [];
    const add = (id: string, name: string) => {
        const label = name.trim();
        if (!id || !label || seen.has(id)) return;
        seen.add(id);
        units.push({ id, name: label });
    };
    for (const floor of block.floors) {
        for (const ward of wardsPlacedOnFloor(floor, careUnits)) add(ward.id, ward.name);
    }
    for (const unit of careUnits) {
        if (unit.block_id === block.id) add(unit.id, unit.name);
    }
    return units.sort((a, b) => a.name.localeCompare(b.name));
}

function blockDirectory(block: Block, careUnits: CareUnit[]) {
    const floors = block.floors.filter(floor => isListedFloor(floor.name));
    const units = unitsOnBlock(block, careUnits);
    return { floors: floors.length, units, unitNames: units.map(unit => unit.name) };
}

function existingWardChoices(blocks: Block[], careUnits: CareUnit[]): { id: string; name: string; departmentId?: string; blockId?: string }[] {
    const seen = new Set<string>();
    const options: { id: string; name: string; departmentId?: string; blockId?: string }[] = [];
    const add = (id: string, name: string, departmentId?: string, blockId?: string) => {
        const label = name.trim();
        const key = label.toLowerCase();
        if (!id || !key || seen.has(key)) return;
        seen.add(key);
        options.push({ id, name: label, ...(departmentId ? { departmentId } : {}), ...(blockId ? { blockId } : {}) });
    };
    for (const unit of careUnits) add(unit.id, unit.name, unit.department_id, unit.block_id);
    for (const block of blocks) {
        for (const floor of block.floors) {
            for (const ward of floor.wards) add(ward.id, ward.name, ward.department_id);
        }
    }
    return options.sort((a, b) => a.name.localeCompare(b.name));
}

/** Expands "1-20" into individual labels; anything else passes through. */
function expandBedLabels(input: string): string[] {
    return input.split(',').flatMap(part => {
        const trimmed = part.trim();
        if (!trimmed) return [];
        const range = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)$/);
        if (range) {
            const start = parseInt(range[1], 10);
            const end = parseInt(range[2], 10);
            if (start <= end && end - start < 200) {
                return Array.from({ length: end - start + 1 }, (_, i) => String(start + i));
            }
        }
        return [trimmed];
    });
}

function matchesStatus(counts: { available_count: number; occupied_count: number; blocked_count: number }, status: StatusFilter): boolean {
    if (status === 'all') return true;
    if (status === 'available') return counts.available_count > 0;
    if (status === 'occupied') return counts.occupied_count > 0;
    return counts.blocked_count > 0;
}

const TH: React.CSSProperties = {
    padding: '10px 14px', fontSize: 10, fontWeight: 750, letterSpacing: '0.07em',
    textTransform: 'uppercase', color: '#A3AEBD', borderBottom: '1px solid #EDF1F6',
    whiteSpace: 'nowrap', background: '#FAFBFD',
};

const TD: React.CSSProperties = {
    padding: '12px 14px', borderBottom: '1px solid #F4F6F9', fontSize: 13, color: '#344054',
};

function bone(width: number | string, height = 12): React.ReactNode {
    return <div className="skeleton" style={{ width, height, borderRadius: 6 }} />;
}

function TableSkeleton({ headers, groups = 2, rowsPerGroup = 3 }: {
    headers: string[];
    groups?: number;
    rowsPerGroup?: number;
}) {
    return (
        <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: headers.length > 5 ? 940 : 760, borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            {headers.map((header, index) => (
                                <th
                                    key={header}
                                    style={{
                                        ...TH,
                                        textAlign: index === 0 ? 'left' : index === headers.length - 1 ? 'right' : 'center',
                                    }}
                                >
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    {Array.from({ length: groups }, (_, group) => (
                        <tbody key={group}>
                            <tr>
                                <td colSpan={headers.length} style={{ padding: '9px 14px', background: '#F6F8FB', borderBottom: '1px solid #EDF1F6' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                            {bone(group === 0 ? 148 : 112, 14)}
                                            {bone(92, 18)}
                                        </div>
                                        <div style={{ display: 'flex', gap: 10 }}>
                                            {bone(52, 12)}
                                            {bone(88, 12)}
                                        </div>
                                    </div>
                                </td>
                            </tr>
                            {Array.from({ length: rowsPerGroup }, (_, row) => (
                                <tr key={row}>
                                    {headers.map((header, col) => (
                                        <td key={header} style={TD}>
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: col === 0 ? 'flex-start' : col === headers.length - 1 ? 'flex-end' : 'center',
                                            }}>
                                                {bone(col === 0 ? 132 - row * 12 : col === headers.length - 1 ? 72 : 28)}
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    ))}
                </table>
            </div>
        </div>
    );
}

const FLOOR_HEADERS = ['Floor', 'Total beds', 'Available beds', 'Last modified', 'Action'];
const ROOM_HEADERS = ['Room / cubicle', 'Total beds', 'Available', 'Occupied', 'Out of service', 'Last modified', 'Action'];

function HomeSkeleton() {
    return (
        <div aria-busy="true" aria-label="Loading bed layout">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 16 }}>
                <div>
                    {bone(168, 22)}
                    <div style={{ marginTop: 10 }}>{bone(196, 14)}</div>
                </div>
                {bone(108, 36)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                {bone(280, 34)}
                {bone(72, 34)}
                {bone(148, 34)}
            </div>
            <TableSkeleton headers={FLOOR_HEADERS} />
        </div>
    );
}

export default function BedLayoutExplorer() {
    const [isAdmin, setIsAdmin] = useState(true);

    const [blocks, setBlocks] = useState<Block[]>([]);
    const [loading, setLoading] = useState(true);
    /** The sample layout stands in while the endpoints are missing. */
    const [preview, setPreview] = useState(false);

    const [floorId, setFloorId] = useState('');
    const [unitId, setUnitId] = useState('');
    const [roomId, setRoomId] = useState('');
    const [departments, setDepartments] = useState<DeptRef[]>([]);
    const [careUnits, setCareUnits] = useState<CareUnit[]>([]);

    const [rooms, setRooms] = useState<Room[]>([]);
    const [roomsLoading, setRoomsLoading] = useState(false);
    const [bedsByRoom, setBedsByRoom] = useState<Record<string, HierarchyBed[]>>({});

    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<StatusFilter>('all');
    const [pageSize, setPageSize] = useState(20);
    const [page, setPage] = useState(1);
    const [wardFilter, setWardFilter] = useState('all');

    const [quickInput, setQuickInput] = useState('');
    const [addingBeds, setAddingBeds] = useState(false);
    const [addMenuOpen, setAddMenuOpen] = useState(false);

    const [dialog, setDialog] = useState<FormDialogRequest | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [openBedId, setOpenBedId] = useState<string | null>(null);
    const [toast, setToast] = useState<Toast | null>(null);

    const showToast = useCallback((message: string, variant: Toast['variant'] = 'success') => {
        setToast({ message, variant });
        setTimeout(() => setToast(null), 2600);
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const url = await appendFacilityIdForProxy(API_ENDPOINTS.AUTH_ME);
                const res = await fetch(url, { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    const role = String(data?.role || data?.user?.role || '').toLowerCase();
                    setIsAdmin(role.includes('admin'));
                }
            } catch { /* default to admin */ }
        })();
    }, []);

    /* ── tree ───────────────────────────────────────────────────────── */
    const fetchBlocks = useCallback(async () => {
        try {
            const url = await appendFacilityIdForProxy(`${API_ENDPOINTS.BLOCKS}?depth=full`);
            const res = await fetch(url, { credentials: 'include' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setPreview(true);
                setBlocks(SAMPLE_BLOCKS);
            } else {
                setPreview(false);
                setBlocks(parseBlocks(data));
                const [deptRes, unitRes] = await Promise.all([
                    fetch(await appendFacilityIdForProxy(API_ENDPOINTS.DEPARTMENTS), { credentials: 'include' }),
                    fetch(await appendFacilityIdForProxy(API_ENDPOINTS.UNITS), { credentials: 'include' }),
                ]);
                setDepartments(deptRes.ok ? readDepartments(await deptRes.json()) : []);
                setCareUnits(unitRes.ok ? parseCareUnits(await unitRes.json()) : []);
            }
        } catch {
            setPreview(true);
            setBlocks(SAMPLE_BLOCKS);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

    /* ── where we are ───────────────────────────────────────────────── */
    const floorRows = useMemo<FloorRow[]>(
        () => blocks.flatMap(block => (
            isBackfill(block.name)
                ? []
                : block.floors.filter(floor => isListedFloor(floor.name)).map(floor => ({ block, floor }))
        )),
        [blocks],
    );
    const buildings = useMemo(() => blocks.filter(block => !isBackfill(block.name)), [blocks]);

    const current = useMemo(() => floorRows.find(row => row.floor.id === floorId) || null, [floorRows, floorId]);
    const block = current?.block || null;
    const floor = current?.floor || null;
    const wards = useMemo(() => (floor ? wardsPlacedOnFloor(floor, careUnits) : []), [floor, careUnits]);
    const groups = useMemo(
        () => (preview ? null : directoryGroups(wards, departments, careUnits)),
        [preview, wards, departments, careUnits],
    );
    const selectedUnit = useMemo(() => wards.find(item => item.id === unitId) || null, [wards, unitId]);
    const room = useMemo(() => rooms.find(item => item.id === roomId) || null, [rooms, roomId]);
    const roomWard = useMemo<Ward | null>(
        () => wards.find(item => item.id === room?.ward_id) || null,
        [wards, room],
    );

    const level: 'home' | 'floor' | 'room' = room ? 'room' : floor ? 'floor' : 'home';

    useEffect(() => {
        setSearch('');
        setStatus('all');
        setPage(1);
        setWardFilter('all');
        setUnitId('');
        setOpenBedId(null);
    }, [floorId]);

    useEffect(() => {
        setSearch('');
        setPage(1);
        setOpenBedId(null);
    }, [roomId]);

    /* ── rooms + beds for the open floor ────────────────────────────── */
    const roomParentIds = groups
        ? (selectedUnit ? [selectedUnit.id] : [])
        : wards.map(item => item.id);
    const wardKey = roomParentIds.join(',');
    const [reloadToken, setReloadToken] = useState(0);

    useEffect(() => {
        const ids = wardKey ? wardKey.split(',') : [];
        if (!ids.length) {
            setRooms([]);
            setBedsByRoom({});
            return;
        }
        if (preview) {
            const sampleRooms = wards.flatMap(item => item.rooms);
            setRooms(sampleRooms);
            setBedsByRoom(Object.fromEntries(sampleRooms.map(item => [item.id, item.beds])));
            setRoomsLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            setRoomsLoading(true);
            try {
                const lists = await Promise.all(ids.map(async id => {
                    const url = await appendFacilityIdForProxy(API_ENDPOINTS.WARD_ROOMS(id));
                    const res = await fetch(url, { credentials: 'include' });
                    if (res.ok) return parseRooms(await res.json());
                    const embedded = wards.find(item => item.id === id)?.rooms || [];
                    return embedded;
                }));
                if (cancelled) return;
                const flat = lists.flat();
                setRooms(flat);

                const bedLists = await Promise.all(flat.map(async item => {
                    if (item.beds.length) return [item.id, item.beds] as const;
                    const url = await appendFacilityIdForProxy(API_ENDPOINTS.ROOM_BEDS(item.id));
                    const res = await fetch(url, { credentials: 'include' });
                    return [item.id, res.ok ? parseBeds(await res.json()) : []] as const;
                }));
                if (cancelled) return;
                setBedsByRoom(Object.fromEntries(bedLists));
            } catch {
                if (!cancelled) { setRooms([]); setBedsByRoom({}); }
            }
            if (!cancelled) setRoomsLoading(false);
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wardKey, reloadToken, preview, blocks]);

    const applyLocally = useCallback((op: PreviewOp) => {
        setBlocks(prev => applyPreviewOp(prev, op));
    }, []);

    const afterMutation = useCallback(async (message: string) => {
        setDialog(null);
        showToast(message);
        if (preview) return;
        await fetchBlocks();
        setReloadToken(token => token + 1);
    }, [preview, fetchBlocks, showToast]);

    const countsOf = useCallback((item: Room) => {
        const beds = bedsByRoom[item.id] || [];
        return {
            bed_count: beds.length,
            available_count: beds.filter(bed => bed.status === 'available').length,
            occupied_count: beds.filter(bed => bed.status === 'occupied').length,
            blocked_count: beds.filter(bed => bed.status === 'blocked').length,
        };
    }, [bedsByRoom]);

    /* ── mutations ──────────────────────────────────────────────────── */
    const runDelete = useCallback(async () => {
        if (!deleteTarget) return;
        if (preview) {
            try {
                applyLocally({ kind: 'delete', level: deleteTarget.level, id: deleteTarget.id });
                if (deleteTarget.level === 'room' && deleteTarget.id === roomId) setRoomId('');
                if (deleteTarget.level === 'floor' && deleteTarget.id === floorId) { setFloorId(''); setRoomId(''); }
                showToast(`${deleteTarget.label} deleted`);
            } catch (err) {
                showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
            }
            setDeleteTarget(null);
            return;
        }
        setDeleting(true);
        try {
            const url = await appendFacilityIdForProxy(deleteTarget.endpoint);
            const res = await fetch(url, { method: 'DELETE', credentials: 'include' });
            if (!res.ok && res.status !== 204) {
                const data = await res.json().catch(() => ({}));
                throw new Error(hierarchyApiMessage(data, `Could not delete (${res.status}).`));
            }
            if (deleteTarget.level === 'room' && deleteTarget.id === roomId) setRoomId('');
            if (deleteTarget.level === 'floor' && deleteTarget.id === floorId) { setFloorId(''); setRoomId(''); }
            await afterMutation(`${deleteTarget.label} deleted`);
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
        }
        setDeleting(false);
        setDeleteTarget(null);
    }, [deleteTarget, preview, applyLocally, afterMutation, showToast, roomId, floorId]);

    const patchBedStatus = useCallback(async (bed: HierarchyBed, next: BedStatus) => {
        setOpenBedId(null);
        if (preview) {
            applyLocally({ kind: 'status', id: bed.id, status: next });
            return;
        }
        try {
            const url = await appendFacilityIdForProxy(API_ENDPOINTS.BED(bed.id));
            const res = await fetch(url, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: next }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(hierarchyApiMessage(data, 'Could not update the bed.'));
            }
            setBedsByRoom(prev => ({
                ...prev,
                [bed.room_id]: (prev[bed.room_id] || []).map(item => item.id === bed.id ? { ...item, status: next } : item),
            }));
            fetchBlocks();
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Update failed', 'error');
        }
    }, [preview, applyLocally, fetchBlocks, showToast]);

    const quickAddBeds = useCallback(async () => {
        const labels = expandBedLabels(quickInput);
        if (!roomId || !labels.length) return;
        const body = { beds: labels.map(label => ({ bed_number: label, status: 'available' })) };
        if (preview) {
            applyLocally({ kind: 'create', level: 'bed', parentId: roomId, body });
            setQuickInput('');
            showToast(labels.length === 1 ? 'Bed added' : `${labels.length} beds added`);
            return;
        }
        setAddingBeds(true);
        try {
            const url = await appendFacilityIdForProxy(API_ENDPOINTS.ROOM_BEDS(roomId));
            const res = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(hierarchyApiMessage(data, 'Could not add the beds.'));
            }
            setQuickInput('');
            await afterMutation(labels.length === 1 ? 'Bed added' : `${labels.length} beds added`);
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Could not add the beds', 'error');
        }
        setAddingBeds(false);
    }, [quickInput, roomId, preview, applyLocally, afterMutation, showToast]);

    /* ── rows per page ──────────────────────────────────────────────── */
    const visibleFloors = useMemo<HomeRow[]>(() => {
        const needle = search.trim().toLowerCase();
        return buildings.flatMap((block): HomeRow[] => {
            const floors = block.floors.filter(floor => isListedFloor(floor.name));
            const matched = floors.filter(floor => {
                const haystack = `${block.name} ${floor.name}`.toLowerCase();
                return (!needle || haystack.includes(needle)) && matchesStatus(floor, status);
            }).sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }));
            if (matched.length) return matched.map(floor => ({ block, floor }));
            const nameMatches = !needle || block.name.toLowerCase().includes(needle);
            if (!floors.length && nameMatches) return [{ block, floor: null }];
            return [];
        });
    }, [buildings, search, status]);

    const visibleUnits = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return (groups || []).flatMap(group => {
            const departmentMatches = group.name.toLowerCase().includes(needle);
            return group.units
                .filter(unit => {
                    if (!matchesStatus(unit, status)) return false;
                    if (!needle || departmentMatches) return true;
                    return unit.name.toLowerCase().includes(needle);
                })
                .map(unit => ({ group, unit }));
        });
    }, [groups, search, status]);

    const visibleRooms = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return rooms.filter(item => {
            const wardName = wards.find(entry => entry.id === item.ward_id)?.name || '';
            const haystack = `${item.number} ${item.name || ''} ${wardName}`.toLowerCase();
            if (needle && !haystack.includes(needle)) return false;
            if (wardFilter !== 'all' && item.ward_id !== wardFilter) return false;
            return matchesStatus(countsOf(item), status);
        });
    }, [rooms, wards, search, status, wardFilter, countsOf]);

    const roomBeds = useMemo(() => (room ? bedsByRoom[room.id] || [] : []), [room, bedsByRoom]);

    const visibleBeds = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return roomBeds.filter(bed => {
            const haystack = `${bed.bed_number} ${bed.bed_code || ''}`.toLowerCase();
            if (needle && !haystack.includes(needle)) return false;
            if (status === 'all') return true;
            return bed.status === status;
        });
    }, [roomBeds, search, status]);

    const showingDirectory = level === 'floor' && !!groups && !selectedUnit;
    const activeList = level === 'home' ? visibleFloors : showingDirectory ? visibleUnits : level === 'room' ? visibleBeds : visibleRooms;
    const pageCount = Math.max(1, Math.ceil(activeList.length / pageSize));
    const safePage = Math.min(page, pageCount);
    const from = (safePage - 1) * pageSize;

    const pagedFloors = useMemo(() => visibleFloors.slice(from, from + pageSize), [visibleFloors, from, pageSize]);
    const pagedRooms = useMemo(() => visibleRooms.slice(from, from + pageSize), [visibleRooms, from, pageSize]);
    const pagedUnits = useMemo(() => visibleUnits.slice(from, from + pageSize), [visibleUnits, from, pageSize]);
    const pagedBeds = useMemo(() => visibleBeds.slice(from, from + pageSize), [visibleBeds, from, pageSize]);

    /** Groups paginated rows under their parent, as in the spec sheet. */
    function groupBy<T>(items: T[], key: (item: T) => string): [string, T[]][] {
        const map = new Map<string, T[]>();
        for (const item of items) {
            const id = key(item);
            map.set(id, [...(map.get(id) || []), item]);
        }
        return [...map.entries()];
    }

    /* ── shared bits ────────────────────────────────────────────────── */
    const addMenuItems: { level: LayoutLevel; label: string }[] = level === 'home'
        ? [
            { level: 'block', label: 'Building / block' },
            { level: 'floor', label: 'Floor' },
            { level: 'ward', label: 'Ward / unit' },
            { level: 'room', label: 'Room / cubicle' },
            { level: 'bed', label: 'Bed' },
        ]
        : [
            { level: 'ward', label: 'Ward / unit' },
            { level: 'room', label: 'Room / cubicle' },
            { level: 'bed', label: 'Bed' },
        ];

    const addMenu = isAdmin ? (
        <div style={{ position: 'relative', flexShrink: 0 }}>
            <button type="button" onClick={() => setAddMenuOpen(open => !open)} style={primaryButton}>
                <Plus size={14} strokeWidth={2} /> Add
                <ChevronDown size={13} strokeWidth={2} />
            </button>
            {addMenuOpen && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setAddMenuOpen(false)} />
                    <div style={{
                        position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 31, minWidth: 190,
                        background: '#FFFFFF', border: '1px solid #E6EBF1', borderRadius: 10,
                        boxShadow: '0 14px 32px rgba(16, 24, 40, 0.16)', overflow: 'hidden', padding: 5,
                    }}>
                        {addMenuItems.map(item => (
                            <button
                                key={item.level}
                                type="button"
                                onClick={() => {
                                    setAddMenuOpen(false);
                                    setDialog({
                                        kind: 'create',
                                        level: item.level,
                                        context: {
                                            ...(block ? { blockId: block.id } : {}),
                                            ...(floor ? { floorId: floor.id } : {}),
                                            ...(room ? { wardId: room.ward_id, roomId: room.id } : {}),
                                        },
                                    });
                                }}
                                style={{
                                    display: 'block', width: '100%', textAlign: 'left', border: 'none',
                                    background: 'transparent', padding: '8px 10px', borderRadius: 7,
                                    fontSize: 12.5, color: '#344054', cursor: 'pointer',
                                }}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    ) : null;

    const pageHeader = (title: string, badgeIcon: React.ReactNode, badgeText: string, actions: React.ReactNode, back?: () => void) => (
        <div style={{ marginBottom: 16 }}>
            {back && (
                <button
                    type="button"
                    onClick={back}
                    style={{ ...linkButton, color: '#7B8798', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 10 }}
                >
                    <ChevronLeft size={13} strokeWidth={2} /> Back
                </button>
            )}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 750, color: '#101828', letterSpacing: '-0.02em' }}>{title}</div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 7 }}>
                        <span style={{
                            width: 24, height: 24, borderRadius: 7, background: '#F2F4F7', color: '#667085',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                            {badgeIcon}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 650, color: '#344054' }}>{badgeText}</span>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{actions}</div>
            </div>
        </div>
    );

    const groupRow = (label: string, count: string, actions: React.ReactNode, columns: number) => (
        <tr>
            <td colSpan={columns} style={{ padding: '9px 14px', background: '#F6F8FB', borderBottom: '1px solid #EDF1F6' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 750, color: '#101828' }}>{label}</span>
                        <span style={{
                            fontSize: 10.5, fontWeight: 700, color: '#667085', background: '#FFFFFF',
                            border: '1px solid #E6EBF1', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap',
                        }}>
                            {count}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>{actions}</div>
                </div>
            </td>
        </tr>
    );

    const rowActions = (editRequest: FormDialogRequest, target: DeleteTarget, label: string) => (
        isAdmin ? (
            <ActionMenu items={[
                { label, onClick: () => setDialog(editRequest) },
                { label: 'Delete', danger: true, onClick: () => setDeleteTarget(target) },
            ]} />
        ) : <span style={{ fontSize: 12, color: '#A3AEBD' }}>View only</span>
    );

    const countCell = (value: number, color = '#172033') => (
        <td style={{ ...TD, textAlign: 'center', fontWeight: 700, color: value === 0 ? '#A3AEBD' : color }}>{value}</td>
    );

    const emptyPanel = (icon: React.ReactNode, title: string, hint: string, action?: React.ReactNode) => (
        <div style={{ ...card, padding: '44px 20px', textAlign: 'center' }}>
            <div style={{ marginBottom: 10 }}>{icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#172033', marginBottom: 4 }}>{title}</div>
            <div style={{ fontSize: 12.5, color: '#8290A5', marginBottom: action ? 16 : 0 }}>{hint}</div>
            {action}
        </div>
    );

    const toolbar = (placeholder: string, statusOptions?: { value: StatusFilter; label: string }[], extra?: React.ReactNode) => (
        <div style={{ marginBottom: 12 }}>
            <BedLayoutToolbar
                search={search}
                onSearch={setSearch}
                placeholder={placeholder}
                pageSize={pageSize}
                onPageSize={setPageSize}
                page={safePage}
                pageCount={pageCount}
                onPage={setPage}
                status={status}
                onStatus={setStatus}
                statusOptions={statusOptions}
                extraFilters={extra}
            />
        </div>
    );

    return (
        <div className="app-main" style={{
            height: '100vh', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            background: '#F8FAFC', color: '#0E182A',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            minWidth: 0, flex: 1,
        }}>
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast.message} variant={toast.variant} dismissible={false} />
                </MacVibrancyToastPortal>
            )}

            <TopBar title="Bed management" subtitle="Buildings, floors, wards, rooms and beds" />

            <main style={{ flex: 1, overflowY: 'auto', padding: '20px 26px 44px' }}>
                {loading ? (
                    <HomeSkeleton />
                ) : buildings.length === 0 ? (
                    emptyPanel(
                        <Building2 size={34} strokeWidth={1.6} color="#CBD5E1" />,
                        'No buildings yet',
                        'Add a building, then add a floor and the units on that floor.',
                        isAdmin ? (
                            <button type="button" onClick={() => setDialog({ kind: 'create', level: 'block', context: {} })} style={primaryButton}>
                                <Plus size={14} strokeWidth={2} /> Add building / block
                            </button>
                        ) : undefined,
                    )
                ) : level === 'home' ? (
                    <>
                        {pageHeader(
                            'Bed management',
                            <Building2 size={13} strokeWidth={1.9} />,
                            `${buildings.length} block${buildings.length === 1 ? '' : 's'} · ${floorRows.length} floor${floorRows.length === 1 ? '' : 's'}`,
                            addMenu,
                        )}
                        {toolbar('Search floors or blocks')}
                        <div style={{ ...card, overflow: 'hidden' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ ...TH, textAlign: 'left' }}>Floor</th>
                                            <th style={{ ...TH, textAlign: 'center' }}>Total beds</th>
                                            <th style={{ ...TH, textAlign: 'center' }}>Available beds</th>
                                            <th style={{ ...TH, textAlign: 'center' }}>Last modified</th>
                                            <th style={{ ...TH, textAlign: 'right' }}>Action</th>
                                        </tr>
                                    </thead>
                                    {groupBy(pagedFloors, row => row.block.id).map(([blockId, group]) => {
                                        const groupBlock = group[0].block;
                                        const attached = blockDirectory(groupBlock, careUnits);
                                        return (
                                            <tbody key={blockId}>
                                                {groupRow(
                                                    groupBlock.name,
                                                    `${attached.floors} floor${attached.floors === 1 ? '' : 's'}`,
                                                    isAdmin ? (
                                                        <ActionMenu items={[
                                                            { label: 'Add floor', onClick: () => setDialog({ kind: 'create', level: 'floor', context: { blockId: groupBlock.id } }) },
                                                            { label: 'Edit block info', onClick: () => setDialog({ kind: 'edit', level: 'block', entity: groupBlock }) },
                                                            {
                                                                label: 'Delete',
                                                                danger: true,
                                                                onClick: () => setDeleteTarget({
                                                                    label: groupBlock.name, level: 'block', id: groupBlock.id,
                                                                    endpoint: API_ENDPOINTS.BLOCK(groupBlock.id),
                                                                    warning: groupBlock.floor_count > 0 ? `This block has ${groupBlock.floor_count} floor(s).` : undefined,
                                                                }),
                                                            },
                                                        ]} />
                                                    ) : null,
                                                    5,
                                                )}
                                                {group.every(row => !row.floor) ? (
                                                    <tr>
                                                        <td colSpan={5} style={{ ...TD, color: '#A3AEBD', fontSize: 12.5 }}>
                                                            No floors in this building yet.
                                                        </td>
                                                    </tr>
                                                ) : group.map(({ floor: item }) => {
                                                    if (!item) return null;
                                                    const placedWards = wardsPlacedOnFloor(item, careUnits);
                                                    return (
                                                    <Fragment key={item.id}>
                                                    <tr>
                                                        <td style={TD}>
                                                            <button
                                                                type="button"
                                                                onClick={() => { setFloorId(item.id); setRoomId(''); }}
                                                                style={{
                                                                    border: 'none', background: 'none', padding: 0, cursor: 'pointer',
                                                                    fontSize: 13.5, fontWeight: 700, color: '#1D6FB8', textAlign: 'left',
                                                                }}
                                                            >
                                                                Floor {item.name}
                                                            </button>
                                                            <div style={{ fontSize: 11.5, color: '#A3AEBD', marginTop: 2 }}>
                                                                {placedWards.length} unit{placedWards.length === 1 ? '' : 's'}
                                                            </div>
                                                        </td>
                                                        {countCell(item.bed_count)}
                                                        {countCell(item.available_count, '#17803D')}
                                                        <td style={{ ...TD, textAlign: 'center', color: '#8290A5', whiteSpace: 'nowrap' }}>
                                                            {formatDate(lastModified(item))}
                                                        </td>
                                                        <td style={{ ...TD, textAlign: 'right' }}>
                                                            {rowActions(
                                                                { kind: 'edit', level: 'floor', entity: item },
                                                                {
                                                                    label: `Floor ${item.name}`, level: 'floor', id: item.id,
                                                                    endpoint: API_ENDPOINTS.FLOOR(item.id),
                                                                    warning: placedWards.length > 0 ? `This floor has ${placedWards.length} ward(s).` : undefined,
                                                                },
                                                                'Edit floor info',
                                                            )}
                                                        </td>
                                                    </tr>
                                                    {placedWards.map(unit => (
                                                        <tr key={unit.id}>
                                                            <td style={{ ...TD, paddingLeft: 36 }}>
                                                                <div style={{ fontSize: 13, fontWeight: 650, color: '#172033' }}>{unit.name}</div>
                                                                <div style={{ fontSize: 11.5, color: '#A3AEBD', marginTop: 2 }}>
                                                                    Unit{genderOf(unit, careUnits) !== '—' ? ` · ${genderOf(unit, careUnits)}` : ''}
                                                                </div>
                                                            </td>
                                                            <td colSpan={4} style={TD} />
                                                        </tr>
                                                    ))}
                                                    </Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        );
                                    })}
                                </table>
                            </div>
                            {pagedFloors.length === 0 && (
                                <div style={{ padding: '36px 16px', textAlign: 'center', fontSize: 13, color: '#8290A5' }}>
                                    No floors match this search.
                                </div>
                            )}
                        </div>
                    </>
                ) : level === 'floor' && floor && block && showingDirectory ? (
                    <>
                        {pageHeader(
                            block.name,
                            <Layers size={13} strokeWidth={1.9} />,
                            `Floor ${floor.name}`,
                            addMenu,
                            () => setFloorId(''),
                        )}
                        {toolbar('Search departments or units')}
                        <div style={{ ...card, overflow: 'hidden' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ ...TH, textAlign: 'left' }}>Unit</th>
                                            <th style={{ ...TH, textAlign: 'left' }}>Gender restriction</th>
                                            <th style={{ ...TH, textAlign: 'center' }}>Total beds</th>
                                            <th style={{ ...TH, textAlign: 'center' }}>Available</th>
                                            <th style={{ ...TH, textAlign: 'center' }}>Occupied</th>
                                            <th style={{ ...TH, textAlign: 'center' }}>Out of service</th>
                                            <th style={{ ...TH, textAlign: 'center' }}>Last modified</th>
                                            <th style={{ ...TH, textAlign: 'right' }}>Action</th>
                                        </tr>
                                    </thead>
                                    {(groups || []).map(group => {
                                        const rows = pagedUnits.filter(item => item.group.id === group.id);
                                        const departmentVisible = rows.length > 0 || (!search.trim() && group.units.length === 0);
                                        if (!departmentVisible) return null;
                                        return (
                                            <tbody key={group.id}>
                                                {groupRow(
                                                    group.name,
                                                    `${group.units.length} unit${group.units.length === 1 ? '' : 's'}`,
                                                    null,
                                                    8,
                                                )}
                                                {rows.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={8} style={{ ...TD, color: '#A3AEBD', fontSize: 12.5 }}>
                                                            No units in this department yet.
                                                        </td>
                                                    </tr>
                                                ) : rows.map(({ unit }) => (
                                                    <tr key={unit.id}>
                                                        <td style={TD}>
                                                            <button
                                                                type="button"
                                                                onClick={() => setUnitId(unit.id)}
                                                                style={{
                                                                    border: 'none', background: 'none', padding: 0, cursor: 'pointer',
                                                                    fontSize: 13.5, fontWeight: 700, color: '#1D6FB8', textAlign: 'left',
                                                                }}
                                                            >
                                                                {unit.name}
                                                            </button>
                                                        </td>
                                                        <td style={{ ...TD, color: '#475467', fontSize: 13 }}>{genderOf(unit, careUnits)}</td>
                                                        {countCell(unit.bed_count)}
                                                        {countCell(unit.available_count, '#17803D')}
                                                        {countCell(unit.occupied_count, '#1D4ED8')}
                                                        {countCell(unit.blocked_count, '#6B7280')}
                                                        <td style={{ ...TD, textAlign: 'center', color: '#8290A5', whiteSpace: 'nowrap' }}>
                                                            {formatDate(unit.updated_at)}
                                                        </td>
                                                        <td style={{ ...TD, textAlign: 'right' }}>
                                                            {rowActions(
                                                                { kind: 'edit', level: 'ward', entity: unit },
                                                                {
                                                                    label: unit.name, level: 'ward', id: unit.id,
                                                                    endpoint: API_ENDPOINTS.WARD(unit.id),
                                                                    warning: unit.room_count > 0 ? `This unit has ${unit.room_count} room(s).` : undefined,
                                                                },
                                                                'Edit unit info',
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        );
                                    })}
                                </table>
                            </div>
                            {pagedUnits.length === 0 && (!!search.trim() || status !== 'all') && (
                                <div style={{ padding: '36px 16px', textAlign: 'center', fontSize: 13, color: '#8290A5' }}>
                                    No departments or units match this search.
                                </div>
                            )}
                        </div>
                    </>
                ) : level === 'floor' && floor && block ? (
                    <>
                        {pageHeader(
                            selectedUnit ? selectedUnit.name : block.name,
                            <Layers size={13} strokeWidth={1.9} />,
                            selectedUnit
                                ? [
                                    groups?.find(group => group.units.some(unit => unit.id === selectedUnit.id))?.name || `Floor ${floor.name}`,
                                    genderOf(selectedUnit, careUnits) !== '—' ? genderOf(selectedUnit, careUnits) : '',
                                ].filter(Boolean).join(' · ')
                                : `Floor ${floor.name}`,
                            addMenu,
                            () => selectedUnit ? setUnitId('') : setFloorId(''),
                        )}
                        {toolbar(
                            selectedUnit ? 'Search rooms' : 'Search rooms or wards',
                            undefined,
                            !selectedUnit && wards.length > 1 ? (
                                <div style={{ width: 180 }}>
                                    <CustomSelect
                                        value={wardFilter}
                                        onChange={value => { setWardFilter(value); setPage(1); }}
                                        options={[
                                            { label: 'All wards', value: 'all' },
                                            ...wards.map(item => ({ label: item.name, value: item.id })),
                                        ]}
                                        style={{ height: 34, fontSize: 12.5, borderRadius: 8, border: '1px solid #E1E7EF' }}
                                    />
                                </div>
                            ) : undefined,
                        )}
                        {roomsLoading ? (
                            <div aria-busy="true" aria-label="Loading rooms">
                                <TableSkeleton headers={ROOM_HEADERS} />
                            </div>
                        ) : wards.length === 0 ? emptyPanel(
                            <DoorOpen size={34} strokeWidth={1.6} color="#CBD5E1" />,
                            'No wards on this floor',
                            'Add a ward or unit, and optionally its rooms, in one step.',
                            isAdmin ? (
                                <button
                                    type="button"
                                    onClick={() => setDialog({ kind: 'create', level: 'ward', context: { blockId: block.id, floorId: floor.id } })}
                                    style={primaryButton}
                                >
                                    <Plus size={14} strokeWidth={2} /> Add ward
                                </button>
                            ) : undefined,
                        ) : (
                            <div style={{ ...card, overflow: 'hidden' }}>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', minWidth: 940, borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ ...TH, textAlign: 'left' }}>Room / cubicle</th>
                                                <th style={{ ...TH, textAlign: 'center' }}>Total beds</th>
                                                <th style={{ ...TH, textAlign: 'center' }}>Available</th>
                                                <th style={{ ...TH, textAlign: 'center' }}>Occupied</th>
                                                <th style={{ ...TH, textAlign: 'center' }}>Out of service</th>
                                                <th style={{ ...TH, textAlign: 'center' }}>Last modified</th>
                                                <th style={{ ...TH, textAlign: 'right' }}>Action</th>
                                            </tr>
                                        </thead>
                                        {(selectedUnit ? [selectedUnit] : wards).map(wardItem => {
                                            if (wardFilter !== 'all' && wardFilter !== wardItem.id) return null;
                                            const group = pagedRooms.filter(item => item.ward_id === wardItem.id);
                                            return (
                                                <tbody key={wardItem.id}>
                                                    {groupRow(
                                                        wardItem.name,
                                                        [
                                                            wardItem.code,
                                                            wardTypeLabel(wardItem.type),
                                                            genderLabel(wardItem.gender_restriction),
                                                        ].filter(Boolean).join(' · ') || `${wardItem.room_count} rooms`,
                                                        isAdmin ? (
                                                            <ActionMenu items={[
                                                                {
                                                                    label: 'Add room',
                                                                    onClick: () => setDialog({
                                                                        kind: 'create', level: 'room',
                                                                        context: { blockId: block.id, floorId: floor.id, wardId: wardItem.id },
                                                                    }),
                                                                },
                                                                { label: 'Edit ward info', onClick: () => setDialog({ kind: 'edit', level: 'ward', entity: wardItem }) },
                                                                {
                                                                    label: 'Delete',
                                                                    danger: true,
                                                                    onClick: () => setDeleteTarget({
                                                                        label: wardItem.name, level: 'ward', id: wardItem.id,
                                                                        endpoint: API_ENDPOINTS.WARD(wardItem.id),
                                                                        warning: wardItem.room_count > 0 ? `This ward has ${wardItem.room_count} room(s).` : undefined,
                                                                    }),
                                                                },
                                                            ]} />
                                                        ) : null,
                                                        7,
                                                    )}
                                                    {group.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={7} style={{ ...TD, color: '#A3AEBD', fontSize: 12.5 }}>
                                                                {selectedUnit ? 'No rooms in this unit yet.' : 'No rooms in this ward yet.'}
                                                            </td>
                                                        </tr>
                                                    ) : group.map(item => {
                                                        const counts = countsOf(item);
                                                        return (
                                                            <tr key={item.id}>
                                                                <td style={TD}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setRoomId(item.id)}
                                                                        style={{
                                                                            border: 'none', background: 'none', padding: 0, cursor: 'pointer',
                                                                            fontSize: 13.5, fontWeight: 700, color: '#1D6FB8', textAlign: 'left',
                                                                        }}
                                                                    >
                                                                        {item.name || `Room ${item.number}`}
                                                                    </button>
                                                                    {item.name && (
                                                                        <div style={{ fontSize: 11.5, color: '#A3AEBD', marginTop: 2 }}>No. {item.number}</div>
                                                                    )}
                                                                </td>
                                                                {countCell(counts.bed_count)}
                                                                {countCell(counts.available_count, '#17803D')}
                                                                {countCell(counts.occupied_count, '#1D4ED8')}
                                                                {countCell(counts.blocked_count, '#6B7280')}
                                                                <td style={{ ...TD, textAlign: 'center', color: '#8290A5', whiteSpace: 'nowrap' }}>
                                                                    {formatDate(item.updated_at)}
                                                                </td>
                                                                <td style={{ ...TD, textAlign: 'right' }}>
                                                                    {rowActions(
                                                                        { kind: 'edit', level: 'room', entity: item },
                                                                        {
                                                                            label: item.name || `Room ${item.number}`, level: 'room', id: item.id,
                                                                            endpoint: API_ENDPOINTS.ROOM(item.id),
                                                                            warning: counts.bed_count ? `This room has ${counts.bed_count} bed(s).` : undefined,
                                                                        },
                                                                        'Edit room info',
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            );
                                        })}
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                ) : level === 'room' && room ? (
                    <>
                        {pageHeader(
                            roomWard?.name || 'Ward',
                            <DoorOpen size={13} strokeWidth={1.9} />,
                            room.name ? `${room.name} · No. ${room.number}` : `Room ${room.number}`,
                            isAdmin ? (
                                <button
                                    type="button"
                                    onClick={() => setDialog({
                                        kind: 'create', level: 'bed',
                                        context: { blockId: block?.id, floorId: floor?.id, wardId: room.ward_id, roomId: room.id },
                                    })}
                                    style={primaryButton}
                                >
                                    <Plus size={14} strokeWidth={2} /> Add bed
                                </button>
                            ) : null,
                            () => setRoomId(''),
                        )}
                        {toolbar('Search beds', [
                            { value: 'all', label: 'All status' },
                            { value: 'available', label: 'Available' },
                            { value: 'occupied', label: 'Occupied' },
                            { value: 'blocked', label: 'Unavailable' },
                        ])}

                        {isAdmin && (
                            <div style={{ ...card, padding: '11px 13px', marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#172033', flexShrink: 0 }}>Quick add</span>
                                <input
                                    value={quickInput}
                                    onChange={e => setQuickInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') quickAddBeds(); }}
                                    placeholder="Bed numbers, e.g. 1-20, ICU-1, 12A"
                                    style={{
                                        flex: 1, minWidth: 190, height: 34, padding: '0 11px', borderRadius: 8,
                                        border: '1px solid #E1E7EF', background: '#FFFFFF', fontSize: 12.5,
                                        color: '#172033', outline: 'none',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={quickAddBeds}
                                    disabled={!quickInput.trim() || addingBeds}
                                    style={{
                                        ...secondaryButton, height: 34, flexShrink: 0,
                                        opacity: !quickInput.trim() || addingBeds ? 0.45 : 1,
                                        cursor: !quickInput.trim() || addingBeds ? 'default' : 'pointer',
                                    }}
                                >
                                    <Plus size={13} strokeWidth={2} /> {addingBeds ? 'Adding…' : 'Add'}
                                </button>
                            </div>
                        )}

                        {roomBeds.length === 0 ? emptyPanel(
                            <BedIcon size={34} strokeWidth={1.6} color="#CBD5E1" />,
                            'No beds in this room yet',
                            'Add bed numbers to start tracking occupancy here.',
                        ) : (
                            <div style={{ ...card, padding: 16 }}>
                                <div style={{
                                    display: 'grid', gap: 10,
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                                }}>
                                    {pagedBeds.map(bed => (
                                        <BedTile
                                            key={bed.id}
                                            bed={bed}
                                            canEdit={isAdmin}
                                            open={openBedId === bed.id}
                                            onToggle={() => setOpenBedId(openBedId === bed.id ? null : bed.id)}
                                            onStatus={next => patchBedStatus(bed, next)}
                                            onEdit={() => { setOpenBedId(null); setDialog({ kind: 'edit', level: 'bed', entity: bed }); }}
                                            onDelete={() => {
                                                setOpenBedId(null);
                                                setDeleteTarget({
                                                    label: `Bed ${bed.bed_number}`, level: 'bed', id: bed.id,
                                                    endpoint: API_ENDPOINTS.BED(bed.id),
                                                    warning: bed.status === 'occupied' ? 'This bed is occupied.' : undefined,
                                                });
                                            }}
                                        />
                                    ))}
                                </div>
                                {pagedBeds.length === 0 && (
                                    <div style={{ padding: '26px 8px', textAlign: 'center', fontSize: 13, color: '#8290A5' }}>
                                        No beds match this filter.
                                    </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
                                    {(Object.keys(BED_STATUS_META) as BedStatus[]).map(key => (
                                        <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#667085' }}>
                                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: BED_STATUS_META[key].dot }} />
                                            <span style={{ fontWeight: 700, color: '#172033' }}>
                                                {roomBeds.filter(bed => bed.status === key).length}
                                            </span>
                                            {key === 'blocked' ? 'Unavailable' : BED_STATUS_META[key].label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    emptyPanel(
                        <Building2 size={34} strokeWidth={1.6} color="#CBD5E1" />,
                        'Nothing to show',
                        'That location no longer exists.',
                        <button type="button" onClick={() => { setFloorId(''); setRoomId(''); }} style={primaryButton}>
                            Back to all floors
                        </button>,
                    )
                )}
            </main>

            {dialog && (
                <BedLayoutFormDialog
                    request={dialog}
                    blocks={blocks}
                    rooms={rooms}
                    existingWards={existingWardChoices(blocks, careUnits)}
                    preview={preview}
                    onClose={() => setDialog(null)}
                    onSaved={afterMutation}
                    onPreviewOp={applyLocally}
                />
            )}

            {deleteTarget && (
                <div
                    role="dialog"
                    aria-modal="true"
                    style={{
                        position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(15, 23, 42, 0.45)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
                    }}
                    onClick={() => !deleting && setDeleteTarget(null)}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{ width: 'min(420px, 100%)', background: '#FFFFFF', borderRadius: 14, padding: 20, boxShadow: '0 24px 60px rgba(15, 23, 42, 0.26)' }}
                    >
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#101828', marginBottom: 6 }}>
                            Delete {deleteTarget.label}?
                        </div>
                        <div style={{ fontSize: 12.5, color: '#667085', marginBottom: 18 }}>
                            {deleteTarget.warning
                                ? `${deleteTarget.warning} Delete stays blocked while children or occupied beds are still attached.`
                                : 'This cannot be undone. An occupied bed stays until it is free.'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} style={secondaryButton}>Cancel</button>
                            <button
                                type="button"
                                onClick={runDelete}
                                disabled={deleting}
                                style={{ ...primaryButton, background: '#B42318', opacity: deleting ? 0.6 : 1 }}
                            >
                                {deleting ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
