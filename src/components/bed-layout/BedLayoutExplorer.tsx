'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Bed as BedIcon,
    Building2,
    ChevronLeft,
    ChevronRight,
    DoorOpen,
    Layers,
    Plus,
    X,
} from 'lucide-react';
import TopBar from '@/components/TopBar';
import { MacVibrancyToast, MacVibrancyToastPortal } from '@/components/MacVibrancyToast';
import { API_ENDPOINTS } from '@/lib/config';
import { appendFacilityIdForProxy } from '@/lib/facility-client';
import type { BedStatus } from '@/lib/beds';
import {
    genderLabel,
    hierarchyApiMessage,
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
import BedLayoutFormDialog, { type FormDialogRequest } from './BedLayoutFormDialog';
import {
    BED_STATUS_META,
    card,
    countPill,
    dangerLinkButton,
    formatDate,
    linkButton,
    primaryButton,
    secondaryButton,
} from './bed-layout-ui';

type Nav = { blockId?: string; floorId?: string; wardId?: string; roomId?: string };

type DeleteTarget = {
    label: string;
    endpoint: string;
    warning?: string;
    onDone: () => void;
};

type Toast = { message: string; variant: 'success' | 'error' | 'info' };

export default function BedLayoutExplorer() {
    const [isAdmin, setIsAdmin] = useState(true);
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [nav, setNav] = useState<Nav>({});
    const [rooms, setRooms] = useState<Room[]>([]);
    const [roomsLoading, setRoomsLoading] = useState(false);
    const [beds, setBeds] = useState<HierarchyBed[]>([]);
    const [bedsLoading, setBedsLoading] = useState(false);
    const [openBedId, setOpenBedId] = useState<string | null>(null);

    const [dialog, setDialog] = useState<FormDialogRequest | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [toast, setToast] = useState<Toast | null>(null);

    const showToast = useCallback((message: string, variant: Toast['variant'] = 'success') => {
        setToast({ message, variant });
        setTimeout(() => setToast(null), 2600);
    }, []);

    /* ── who's looking ──────────────────────────────────────────────── */
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
                setLoadError(hierarchyApiMessage(data, `Could not load the bed layout (${res.status}).`));
                setBlocks([]);
            } else {
                setLoadError('');
                setBlocks(parseBlocks(data));
            }
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : 'Could not reach the bed layout API.');
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

    const fetchRooms = useCallback(async (wardId: string) => {
        setRoomsLoading(true);
        try {
            const url = await appendFacilityIdForProxy(API_ENDPOINTS.WARD_ROOMS(wardId));
            const res = await fetch(url, { credentials: 'include' });
            if (res.ok) setRooms(parseRooms(await res.json()));
            else setRooms([]);
        } catch { setRooms([]); }
        setRoomsLoading(false);
    }, []);

    const fetchBeds = useCallback(async (roomId: string) => {
        setBedsLoading(true);
        try {
            const url = await appendFacilityIdForProxy(API_ENDPOINTS.ROOM_BEDS(roomId));
            const res = await fetch(url, { credentials: 'include' });
            if (res.ok) setBeds(parseBeds(await res.json()));
            else setBeds([]);
        } catch { setBeds([]); }
        setBedsLoading(false);
    }, []);

    useEffect(() => {
        if (nav.wardId) fetchRooms(nav.wardId);
        else setRooms([]);
    }, [nav.wardId, fetchRooms]);

    useEffect(() => {
        if (nav.roomId) fetchBeds(nav.roomId);
        else setBeds([]);
    }, [nav.roomId, fetchBeds]);

    /* ── current position ───────────────────────────────────────────── */
    const block = useMemo(() => blocks.find(item => item.id === nav.blockId) || null, [blocks, nav.blockId]);
    const floor = useMemo<Floor | null>(
        () => block?.floors.find(item => item.id === nav.floorId) || null,
        [block, nav.floorId],
    );
    const ward = useMemo<Ward | null>(
        () => floor?.wards.find(item => item.id === nav.wardId) || null,
        [floor, nav.wardId],
    );
    const room = useMemo<Room | null>(
        () => rooms.find(item => item.id === nav.roomId) || null,
        [rooms, nav.roomId],
    );

    const level: 'home' | 'block' | 'floor' | 'ward' | 'room' =
        nav.roomId ? 'room' : nav.wardId ? 'ward' : nav.floorId ? 'floor' : nav.blockId ? 'block' : 'home';

    const totals = useMemo(() => blocks.reduce(
        (acc, item) => ({
            beds: acc.beds + item.bed_count,
            available: acc.available + item.available_count,
            occupied: acc.occupied + item.occupied_count,
            blocked: acc.blocked + item.blocked_count,
            floors: acc.floors + item.floor_count,
        }),
        { beds: 0, available: 0, occupied: 0, blocked: 0, floors: 0 },
    ), [blocks]);

    const refresh = useCallback(async () => {
        await fetchBlocks();
        if (nav.wardId) await fetchRooms(nav.wardId);
        if (nav.roomId) await fetchBeds(nav.roomId);
    }, [fetchBlocks, fetchRooms, fetchBeds, nav.wardId, nav.roomId]);

    const onSaved = useCallback((message: string) => {
        setDialog(null);
        showToast(message);
        refresh();
    }, [refresh, showToast]);

    const runDelete = useCallback(async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            const url = await appendFacilityIdForProxy(deleteTarget.endpoint);
            const res = await fetch(url, { method: 'DELETE', credentials: 'include' });
            if (!res.ok && res.status !== 204) {
                const data = await res.json().catch(() => ({}));
                throw new Error(hierarchyApiMessage(data, `Could not delete (${res.status}).`));
            }
            showToast(`${deleteTarget.label} deleted`);
            deleteTarget.onDone();
            await refresh();
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
        }
        setDeleting(false);
        setDeleteTarget(null);
    }, [deleteTarget, refresh, showToast]);

    const patchBedStatus = useCallback(async (bedId: string, status: BedStatus) => {
        try {
            const url = await appendFacilityIdForProxy(API_ENDPOINTS.BED(bedId));
            const res = await fetch(url, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(hierarchyApiMessage(data, 'Could not update the bed.'));
            }
            setBeds(prev => prev.map(item => item.id === bedId ? { ...item, status } : item));
            showToast(`Bed marked ${BED_STATUS_META[status].label.toLowerCase()}`);
            fetchBlocks();
            if (nav.wardId) fetchRooms(nav.wardId);
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Update failed', 'error');
        }
    }, [showToast, fetchBlocks, fetchRooms, nav.wardId]);

    /* ── shared bits ────────────────────────────────────────────────── */
    const crumbs: { label: string; onClick: () => void }[] = [
        { label: 'All buildings', onClick: () => setNav({}) },
        ...(block ? [{ label: block.name, onClick: () => setNav({ blockId: block.id }) }] : []),
        ...(floor ? [{ label: `Floor ${floor.name}`, onClick: () => setNav({ blockId: block?.id, floorId: floor.id }) }] : []),
        ...(ward ? [{ label: ward.name, onClick: () => setNav({ blockId: block?.id, floorId: floor?.id, wardId: ward.id }) }] : []),
        ...(room ? [{ label: room.name ? `${room.number} · ${room.name}` : `Room ${room.number}`, onClick: () => {} }] : []),
    ];

    const sectionHeader = (
        title: string,
        subtitle: string,
        actions: React.ReactNode,
    ) => (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 750, color: '#101828', letterSpacing: '-0.01em' }}>{title}</div>
                <div style={{ fontSize: 12.5, color: '#7B8798', marginTop: 3 }}>{subtitle}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{actions}</div>
        </div>
    );

    const countsRow = (counts: { bed_count: number; available_count: number; occupied_count: number; blocked_count: number }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={countPill('#667085')}>{counts.bed_count} bed{counts.bed_count === 1 ? '' : 's'}</span>
            {counts.available_count > 0 && <span style={countPill('#17803D')}>{counts.available_count} available</span>}
            {counts.occupied_count > 0 && <span style={countPill('#1D4ED8')}>{counts.occupied_count} occupied</span>}
            {counts.blocked_count > 0 && <span style={countPill('#6B7280')}>{counts.blocked_count} blocked</span>}
        </div>
    );

    const addButton = (label: string, request: FormDialogRequest) => (
        isAdmin ? (
            <button type="button" onClick={() => setDialog(request)} style={primaryButton}>
                <Plus size={14} strokeWidth={2} /> {label}
            </button>
        ) : null
    );

    const emptyState = (icon: React.ReactNode, title: string, hint: string, action?: React.ReactNode) => (
        <div style={{ ...card, padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ marginBottom: 10 }}>{icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#172033', marginBottom: 4 }}>{title}</div>
            <div style={{ fontSize: 12.5, color: '#8290A5', marginBottom: action ? 16 : 0 }}>{hint}</div>
            {action}
        </div>
    );

    /* ── render ─────────────────────────────────────────────────────── */
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

            <main style={{ flex: 1, overflowY: 'auto', padding: '18px 26px 40px' }}>
                {/* Breadcrumb */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                    {level !== 'home' && (
                        <button
                            type="button"
                            onClick={() => {
                                if (nav.roomId) setNav({ blockId: nav.blockId, floorId: nav.floorId, wardId: nav.wardId });
                                else if (nav.wardId) setNav({ blockId: nav.blockId, floorId: nav.floorId });
                                else if (nav.floorId) setNav({ blockId: nav.blockId });
                                else setNav({});
                            }}
                            style={{ ...secondaryButton, height: 30, padding: '0 10px', fontSize: 12 }}
                        >
                            <ChevronLeft size={14} strokeWidth={2} /> Back
                        </button>
                    )}
                    {crumbs.map((crumb, index) => (
                        <span key={index} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {index > 0 && <ChevronRight size={13} strokeWidth={2} color="#C3CBD6" />}
                            <button
                                type="button"
                                onClick={crumb.onClick}
                                style={{
                                    ...linkButton,
                                    color: index === crumbs.length - 1 ? '#172033' : '#1D6FB8',
                                    cursor: index === crumbs.length - 1 ? 'default' : 'pointer',
                                }}
                            >
                                {crumb.label}
                            </button>
                        </span>
                    ))}
                </div>

                {loadError && (
                    <div style={{
                        ...card, borderColor: '#FEE4E2', background: '#FFFBFA',
                        padding: '12px 14px', marginBottom: 16,
                    }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#B42318', marginBottom: 3 }}>
                            Bed layout API unavailable
                        </div>
                        <div style={{ fontSize: 12.5, color: '#98514C' }}>
                            {loadError} The block, floor, ward, room and bed endpoints in
                            {' '}BED_MANAGEMENT_API_CONTRACT.md are not live yet, so this page has nothing to show.
                        </div>
                    </div>
                )}

                {loading ? (
                    <div style={{ ...card, padding: 20, color: '#8290A5', fontSize: 13 }}>Loading bed layout…</div>
                ) : level === 'home' ? (
                    <>
                        {sectionHeader(
                            'Buildings & blocks',
                            `${blocks.length} block${blocks.length === 1 ? '' : 's'} · ${totals.floors} floor${totals.floors === 1 ? '' : 's'} · ${totals.beds} bed${totals.beds === 1 ? '' : 's'}`,
                            <>
                                {isAdmin && (
                                    <>
                                        <button type="button" onClick={() => setDialog({ kind: 'create', level: 'floor', context: {} })} style={secondaryButton}>Add floor</button>
                                        <button type="button" onClick={() => setDialog({ kind: 'create', level: 'ward', context: {} })} style={secondaryButton}>Add ward</button>
                                        <button type="button" onClick={() => setDialog({ kind: 'create', level: 'room', context: {} })} style={secondaryButton}>Add room</button>
                                        <button type="button" onClick={() => setDialog({ kind: 'create', level: 'bed', context: {} })} style={secondaryButton}>Add bed</button>
                                    </>
                                )}
                                {addButton('Add building / block', { kind: 'create', level: 'block', context: {} })}
                            </>,
                        )}

                        {blocks.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
                                {([
                                    ['Total beds', totals.beds, '#101828'],
                                    ['Available', totals.available, '#17803D'],
                                    ['Occupied', totals.occupied, '#1D4ED8'],
                                    ['Blocked', totals.blocked, '#6B7280'],
                                ] as const).map(([label, value, color]) => (
                                    <div key={label} style={{ ...card, padding: '14px 16px' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#8290A5', textTransform: 'uppercase' }}>{label}</div>
                                        <div style={{ fontSize: 26, fontWeight: 750, color, letterSpacing: '-0.02em', marginTop: 6 }}>{value}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {blocks.length === 0 ? emptyState(
                            <Building2 size={34} strokeWidth={1.6} color="#CBD5E1" />,
                            'No buildings yet',
                            'Start by adding a building or block. You can add its floors in the same form.',
                            addButton('Add building / block', { kind: 'create', level: 'block', context: {} }),
                        ) : (
                            <div style={{ display: 'grid', gap: 12 }}>
                                {blocks.map(item => (
                                    <div key={item.id} style={{ ...card, padding: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                                            <button
                                                type="button"
                                                onClick={() => setNav({ blockId: item.id })}
                                                style={{ border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <Building2 size={16} strokeWidth={1.8} color="#1D6FB8" />
                                                    <span style={{ fontSize: 15, fontWeight: 700, color: '#101828' }}>{item.name}</span>
                                                </div>
                                                <div style={{ fontSize: 12, color: '#8290A5', marginTop: 4 }}>
                                                    {item.floor_count} floor{item.floor_count === 1 ? '' : 's'}
                                                </div>
                                            </button>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                {countsRow(item)}
                                                {isAdmin && (
                                                    <>
                                                        <button type="button" onClick={() => setDialog({ kind: 'edit', level: 'block', entity: item })} style={linkButton}>Edit</button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeleteTarget({
                                                                label: item.name,
                                                                endpoint: API_ENDPOINTS.BLOCK(item.id),
                                                                warning: item.floor_count > 0 ? `This block has ${item.floor_count} floor(s).` : undefined,
                                                                onDone: () => setNav({}),
                                                            })}
                                                            style={dangerLinkButton}
                                                        >
                                                            Delete
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        {item.floors.length === 0 ? (
                                            <div style={{ fontSize: 12.5, color: '#98A2B3' }}>
                                                No floors yet.{' '}
                                                {isAdmin && (
                                                    <button type="button" onClick={() => setDialog({ kind: 'create', level: 'floor', context: { blockId: item.id } })} style={linkButton}>
                                                        Add a floor
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                {item.floors.map(floorItem => (
                                                    <button
                                                        key={floorItem.id}
                                                        type="button"
                                                        onClick={() => setNav({ blockId: item.id, floorId: floorItem.id })}
                                                        style={{
                                                            border: '1px solid #E1E7EF', borderRadius: 10, background: '#FBFCFE',
                                                            padding: '9px 12px', cursor: 'pointer', textAlign: 'left',
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 650, color: '#172033' }}>
                                                            <Layers size={13} strokeWidth={1.8} color="#7B8798" />
                                                            Floor {floorItem.name}
                                                        </div>
                                                        <div style={{ fontSize: 11.5, color: '#8290A5', marginTop: 3 }}>
                                                            {floorItem.ward_count} ward{floorItem.ward_count === 1 ? '' : 's'} · {floorItem.bed_count} bed{floorItem.bed_count === 1 ? '' : 's'}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : level === 'block' && block ? (
                    <>
                        {sectionHeader(
                            block.name,
                            `${block.floor_count} floor${block.floor_count === 1 ? '' : 's'} · ${block.bed_count} bed${block.bed_count === 1 ? '' : 's'}`,
                            <>
                                {isAdmin && (
                                    <button type="button" onClick={() => setDialog({ kind: 'edit', level: 'block', entity: block })} style={secondaryButton}>
                                        Edit block info
                                    </button>
                                )}
                                {addButton('Add floor', { kind: 'create', level: 'floor', context: { blockId: block.id } })}
                            </>,
                        )}
                        {block.floors.length === 0 ? emptyState(
                            <Layers size={34} strokeWidth={1.6} color="#CBD5E1" />,
                            'No floors on this block',
                            'Add a floor, and optionally its wards, in one step.',
                            addButton('Add floor', { kind: 'create', level: 'floor', context: { blockId: block.id } }),
                        ) : (
                            <div style={{ display: 'grid', gap: 10 }}>
                                {block.floors.map(item => (
                                    <div key={item.id} style={{ ...card, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                        <button
                                            type="button"
                                            onClick={() => setNav({ blockId: block.id, floorId: item.id })}
                                            style={{ border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', minWidth: 0 }}
                                        >
                                            <div style={{ fontSize: 14.5, fontWeight: 700, color: '#101828' }}>Floor {item.name}</div>
                                            <div style={{ fontSize: 12, color: '#8290A5', marginTop: 3 }}>
                                                {item.ward_count} ward{item.ward_count === 1 ? '' : 's'}
                                            </div>
                                        </button>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            {countsRow(item)}
                                            {isAdmin && (
                                                <>
                                                    <button type="button" onClick={() => setDialog({ kind: 'edit', level: 'floor', entity: item })} style={linkButton}>Edit</button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeleteTarget({
                                                            label: `Floor ${item.name}`,
                                                            endpoint: API_ENDPOINTS.FLOOR(item.id),
                                                            warning: item.ward_count > 0 ? `This floor has ${item.ward_count} ward(s).` : undefined,
                                                            onDone: () => setNav({ blockId: block.id }),
                                                        })}
                                                        style={dangerLinkButton}
                                                    >
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : level === 'floor' && floor ? (
                    <>
                        {sectionHeader(
                            `Floor ${floor.name}`,
                            `${block?.name || ''} · ${floor.ward_count} ward${floor.ward_count === 1 ? '' : 's'}`,
                            <>
                                {isAdmin && (
                                    <>
                                        <button type="button" onClick={() => setDialog({ kind: 'edit', level: 'floor', entity: floor })} style={secondaryButton}>
                                            Edit floor info
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDeleteTarget({
                                                label: `Floor ${floor.name}`,
                                                endpoint: API_ENDPOINTS.FLOOR(floor.id),
                                                warning: floor.ward_count > 0 ? `This floor has ${floor.ward_count} ward(s).` : undefined,
                                                onDone: () => setNav({ blockId: block?.id }),
                                            })}
                                            style={{ ...secondaryButton, color: '#B42318' }}
                                        >
                                            Delete floor
                                        </button>
                                    </>
                                )}
                                {addButton('Add ward', { kind: 'create', level: 'ward', context: { blockId: block?.id, floorId: floor.id } })}
                            </>,
                        )}
                        {floor.wards.length === 0 ? emptyState(
                            <DoorOpen size={34} strokeWidth={1.6} color="#CBD5E1" />,
                            'No wards on this floor',
                            'Add a ward or unit, and optionally its rooms, in one step.',
                            addButton('Add ward', { kind: 'create', level: 'ward', context: { blockId: block?.id, floorId: floor.id } }),
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
                                {floor.wards.map(item => (
                                    <div key={item.id} style={{ ...card, padding: 15 }}>
                                        <button
                                            type="button"
                                            onClick={() => setNav({ blockId: block?.id, floorId: floor.id, wardId: item.id })}
                                            style={{ border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', width: '100%' }}
                                        >
                                            <div style={{ fontSize: 14.5, fontWeight: 700, color: '#101828' }}>{item.name}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                                                {item.code && (
                                                    <span style={{ fontSize: 11, fontWeight: 650, color: '#1D6FB8', background: '#E8F3FC', borderRadius: 999, padding: '2px 8px' }}>
                                                        {item.code}
                                                    </span>
                                                )}
                                                {item.type && (
                                                    <span style={{ fontSize: 11, fontWeight: 650, color: '#475467', background: '#F2F4F7', borderRadius: 999, padding: '2px 8px' }}>
                                                        {wardTypeLabel(item.type)}
                                                    </span>
                                                )}
                                                {item.gender_restriction && (
                                                    <span style={{ fontSize: 11, fontWeight: 650, color: '#475467', background: '#F2F4F7', borderRadius: 999, padding: '2px 8px' }}>
                                                        {genderLabel(item.gender_restriction)}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 12, color: '#8290A5', margin: '10px 0' }}>
                                                {item.room_count} room{item.room_count === 1 ? '' : 's'}
                                            </div>
                                        </button>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                            {countsRow(item)}
                                            {isAdmin && (
                                                <div style={{ display: 'flex', gap: 10 }}>
                                                    <button type="button" onClick={() => setDialog({ kind: 'edit', level: 'ward', entity: item })} style={linkButton}>Edit</button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeleteTarget({
                                                            label: item.name,
                                                            endpoint: API_ENDPOINTS.WARD(item.id),
                                                            warning: item.room_count > 0 ? `This ward has ${item.room_count} room(s).` : undefined,
                                                            onDone: () => setNav({ blockId: block?.id, floorId: floor.id }),
                                                        })}
                                                        style={dangerLinkButton}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : level === 'ward' && ward ? (
                    <>
                        {sectionHeader(
                            ward.name,
                            [block?.name, floor ? `Floor ${floor.name}` : '', wardTypeLabel(ward.type), genderLabel(ward.gender_restriction)]
                                .filter(Boolean).join(' · '),
                            <>
                                {isAdmin && (
                                    <button type="button" onClick={() => setDialog({ kind: 'edit', level: 'ward', entity: ward })} style={secondaryButton}>
                                        Edit ward info
                                    </button>
                                )}
                                {addButton('Add room', { kind: 'create', level: 'room', context: { blockId: block?.id, floorId: floor?.id, wardId: ward.id } })}
                            </>,
                        )}

                        {roomsLoading ? (
                            <div style={{ ...card, padding: 20, fontSize: 13, color: '#8290A5' }}>Loading rooms…</div>
                        ) : rooms.length === 0 ? emptyState(
                            <DoorOpen size={34} strokeWidth={1.6} color="#CBD5E1" />,
                            'No rooms in this ward',
                            'Add a room or cubicle, and optionally its beds, in one step.',
                            addButton('Add room', { kind: 'create', level: 'room', context: { blockId: block?.id, floorId: floor?.id, wardId: ward.id } }),
                        ) : (
                            <div style={{ ...card, overflow: 'hidden' }}>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#F8FAFC' }}>
                                                {['Room / cubicle', 'Total beds', 'Available', 'Occupied', 'Modified', 'Action'].map((heading, index) => (
                                                    <th
                                                        key={heading}
                                                        style={{
                                                            textAlign: index === 0 ? 'left' : index === 5 ? 'right' : 'center',
                                                            padding: '10px 14px',
                                                            fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
                                                            textTransform: 'uppercase', color: '#8290A5',
                                                            borderBottom: '1px solid #EDF1F6', whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {heading}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rooms.map(item => (
                                                <tr key={item.id}>
                                                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F4F6F9' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setNav({ blockId: block?.id, floorId: floor?.id, wardId: ward.id, roomId: item.id })}
                                                            style={{ border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                                                        >
                                                            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#101828' }}>
                                                                {item.name || `Room ${item.number}`}
                                                            </div>
                                                            {item.name && (
                                                                <div style={{ fontSize: 11.5, color: '#98A2B3', marginTop: 2 }}>No. {item.number}</div>
                                                            )}
                                                        </button>
                                                    </td>
                                                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F4F6F9', textAlign: 'center', fontSize: 13, fontWeight: 650, color: '#172033' }}>
                                                        {item.bed_count}
                                                    </td>
                                                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F4F6F9', textAlign: 'center', fontSize: 13, fontWeight: 650, color: '#17803D' }}>
                                                        {item.available_count}
                                                    </td>
                                                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F4F6F9', textAlign: 'center', fontSize: 13, fontWeight: 650, color: '#1D4ED8' }}>
                                                        {item.occupied_count}
                                                    </td>
                                                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F4F6F9', textAlign: 'center', fontSize: 12.5, color: '#667085', whiteSpace: 'nowrap' }}>
                                                        {formatDate(item.updated_at)}
                                                    </td>
                                                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F4F6F9', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                        {isAdmin ? (
                                                            <div style={{ display: 'inline-flex', gap: 12 }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setDialog({
                                                                        kind: 'create', level: 'bed',
                                                                        context: { blockId: block?.id, floorId: floor?.id, wardId: ward.id, roomId: item.id },
                                                                    })}
                                                                    style={linkButton}
                                                                >
                                                                    Add bed
                                                                </button>
                                                                <button type="button" onClick={() => setDialog({ kind: 'edit', level: 'room', entity: item })} style={linkButton}>Edit</button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setDeleteTarget({
                                                                        label: item.name || `Room ${item.number}`,
                                                                        endpoint: API_ENDPOINTS.ROOM(item.id),
                                                                        warning: item.bed_count > 0 ? `This room has ${item.bed_count} bed(s).` : undefined,
                                                                        onDone: () => setNav({ blockId: block?.id, floorId: floor?.id, wardId: ward.id }),
                                                                    })}
                                                                    style={dangerLinkButton}
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span style={{ fontSize: 12, color: '#98A2B3' }}>View only</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                ) : level === 'room' && room ? (
                    <>
                        {sectionHeader(
                            room.name || `Room ${room.number}`,
                            [ward?.name, floor ? `Floor ${floor.name}` : '', block?.name].filter(Boolean).join(' · '),
                            <>
                                {isAdmin && (
                                    <button type="button" onClick={() => setDialog({ kind: 'edit', level: 'room', entity: room })} style={secondaryButton}>
                                        Edit room info
                                    </button>
                                )}
                                {addButton('Add bed', {
                                    kind: 'create', level: 'bed',
                                    context: { blockId: block?.id, floorId: floor?.id, wardId: ward?.id, roomId: room.id },
                                })}
                            </>,
                        )}
                        {bedsLoading ? (
                            <div style={{ ...card, padding: 20, fontSize: 13, color: '#8290A5' }}>Loading beds…</div>
                        ) : beds.length === 0 ? emptyState(
                            <BedIcon size={34} strokeWidth={1.6} color="#CBD5E1" />,
                            'No beds in this room',
                            'Add bed numbers to start tracking occupancy here.',
                            addButton('Add bed', {
                                kind: 'create', level: 'bed',
                                context: { blockId: block?.id, floorId: floor?.id, wardId: ward?.id, roomId: room.id },
                            }),
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
                                {beds.map(item => {
                                    const meta = BED_STATUS_META[item.status];
                                    const open = openBedId === item.id;
                                    return (
                                        <div
                                            key={item.id}
                                            style={{
                                                ...card, padding: 14, position: 'relative',
                                                borderColor: open ? '#172033' : meta.border,
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: 16, fontWeight: 750, color: '#101828' }}>
                                                        Bed {item.bed_number}
                                                    </div>
                                                    {item.bed_code && (
                                                        <div style={{ fontSize: 11.5, color: '#98A2B3', marginTop: 2 }}>{item.bed_code}</div>
                                                    )}
                                                </div>
                                                {isAdmin && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeleteTarget({
                                                            label: `Bed ${item.bed_number}`,
                                                            endpoint: API_ENDPOINTS.BED(item.id),
                                                            onDone: () => setOpenBedId(null),
                                                        })}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#98A2B3', padding: 0, display: 'flex' }}
                                                        aria-label={`Delete bed ${item.bed_number}`}
                                                    >
                                                        <X size={14} strokeWidth={1.8} />
                                                    </button>
                                                )}
                                            </div>
                                            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                <button
                                                    type="button"
                                                    onClick={() => isAdmin && setOpenBedId(open ? null : item.id)}
                                                    style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                                        height: 26, padding: '0 9px', borderRadius: 999, border: 'none',
                                                        fontSize: 12, fontWeight: 650, background: meta.bg, color: meta.fg,
                                                        cursor: isAdmin ? 'pointer' : 'default',
                                                    }}
                                                >
                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot }} />
                                                    {meta.label}
                                                </button>
                                                {isAdmin && (
                                                    <button type="button" onClick={() => setDialog({ kind: 'edit', level: 'bed', entity: item })} style={linkButton}>
                                                        Edit bed info
                                                    </button>
                                                )}
                                            </div>
                                            {open && (
                                                <div style={{
                                                    position: 'absolute', top: '100%', left: 14, zIndex: 20, marginTop: 4,
                                                    background: '#FFFFFF', border: '1px solid #E6EBF1', borderRadius: 8,
                                                    boxShadow: '0 8px 20px rgba(16, 24, 40, 0.12)', minWidth: 150, overflow: 'hidden',
                                                }}>
                                                    {(Object.keys(BED_STATUS_META) as BedStatus[]).map(status => (
                                                        <button
                                                            key={status}
                                                            type="button"
                                                            disabled={item.status === status}
                                                            onClick={() => { setOpenBedId(null); patchBedStatus(item.id, status); }}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                                                padding: '8px 12px', border: 'none', textAlign: 'left',
                                                                background: item.status === status ? '#F8FAFC' : 'transparent',
                                                                cursor: item.status === status ? 'default' : 'pointer',
                                                                fontSize: 12, color: '#172033',
                                                            }}
                                                        >
                                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: BED_STATUS_META[status].dot }} />
                                                            {BED_STATUS_META[status].label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                ) : (
                    emptyState(
                        <Building2 size={34} strokeWidth={1.6} color="#CBD5E1" />,
                        'Nothing to show here',
                        'That location no longer exists. Go back to all buildings.',
                        <button type="button" onClick={() => setNav({})} style={primaryButton}>All buildings</button>,
                    )
                )}
            </main>

            {dialog && (
                <BedLayoutFormDialog
                    request={dialog}
                    blocks={blocks}
                    rooms={rooms}
                    onClose={() => setDialog(null)}
                    onSaved={onSaved}
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
                                ? `${deleteTarget.warning} The API will refuse the delete unless it is empty.`
                                : 'This cannot be undone.'}
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
