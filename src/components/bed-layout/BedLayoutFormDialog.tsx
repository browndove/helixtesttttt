'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { API_ENDPOINTS } from '@/lib/config';
import { appendFacilityIdForProxy } from '@/lib/facility-client';
import type { BedStatus } from '@/lib/beds';
import {
    GENDER_RESTRICTIONS,
    NESTED_LIMITS,
    WARD_TYPES,
    genderLabel,
    hierarchyApiMessage,
    wardTypeLabel,
    type Block,
    type Floor,
    type HierarchyBed,
    type Room,
    type Ward,
} from '@/lib/bed-hierarchy';
import {
    BED_STATUS_META,
    dangerLinkButton,
    fieldLabel,
    input,
    linkButton,
    primaryButton,
    secondaryButton,
    select as selectStyle,
} from './bed-layout-ui';

export type LayoutLevel = 'block' | 'floor' | 'ward' | 'room' | 'bed';

export type LayoutContext = {
    blockId?: string;
    floorId?: string;
    wardId?: string;
    roomId?: string;
};

export type FormDialogRequest =
    | { kind: 'create'; level: LayoutLevel; context: LayoutContext }
    | { kind: 'edit'; level: 'block'; entity: Block }
    | { kind: 'edit'; level: 'floor'; entity: Floor }
    | { kind: 'edit'; level: 'ward'; entity: Ward }
    | { kind: 'edit'; level: 'room'; entity: Room }
    | { kind: 'edit'; level: 'bed'; entity: HierarchyBed };

type WardDraft = { name: string; code: string; type: string; typeOther: string; gender: string };
type RoomDraft = { number: string; name: string };
type BedDraft = { bed_number: string; bed_code: string; status: BedStatus };

const NEW = '__new';
const OTHER = '__other';

const LEVEL_TITLES: Record<LayoutLevel, { create: string; edit: string }> = {
    block: { create: 'Add building / block', edit: 'Edit block info' },
    floor: { create: 'Add floor', edit: 'Edit floor info' },
    ward: { create: 'Add ward / unit', edit: 'Edit ward info' },
    room: { create: 'Add room / cubicle', edit: 'Edit room info' },
    bed: { create: 'Add bed', edit: 'Edit bed info' },
};

function emptyWard(): WardDraft {
    return { name: '', code: '', type: '', typeOther: '', gender: '' };
}

function emptyRoom(): RoomDraft {
    return { number: '', name: '' };
}

function emptyBed(): BedDraft {
    return { bed_number: '', bed_code: '', status: 'available' };
}

function wardPayload(draft: WardDraft): Record<string, unknown> {
    const type = draft.type === OTHER ? draft.typeOther.trim() : draft.type;
    return {
        name: draft.name.trim(),
        ...(draft.code.trim() ? { code: draft.code.trim() } : {}),
        ...(type ? { type } : {}),
        ...(draft.gender ? { gender_restriction: draft.gender } : {}),
    };
}

function roomPayload(draft: RoomDraft, beds?: BedDraft[]): Record<string, unknown> {
    const usable = (beds || []).filter(bed => bed.bed_number.trim());
    return {
        number: draft.number.trim(),
        ...(draft.name.trim() ? { name: draft.name.trim() } : {}),
        ...(usable.length ? { beds: usable.map(bedPayload) } : {}),
    };
}

function bedPayload(draft: BedDraft): Record<string, unknown> {
    return {
        bed_number: draft.bed_number.trim(),
        ...(draft.bed_code.trim() ? { bed_code: draft.bed_code.trim() } : {}),
        status: draft.status,
    };
}

export default function BedLayoutFormDialog({
    request,
    blocks,
    rooms,
    onClose,
    onSaved,
}: {
    request: FormDialogRequest;
    blocks: Block[];
    /** Rooms of the ward in context, for the bed parent picker. */
    rooms: Room[];
    onClose: () => void;
    onSaved: (message: string) => void;
}) {
    const { kind, level } = request;
    const context = useMemo<LayoutContext>(
        () => (request.kind === 'create' ? request.context : {}),
        [request],
    );

    const [blockChoice, setBlockChoice] = useState('');
    const [newBlockName, setNewBlockName] = useState('');
    const [floorChoice, setFloorChoice] = useState('');
    const [newFloorName, setNewFloorName] = useState('');
    const [wardChoice, setWardChoice] = useState('');
    const [roomChoice, setRoomChoice] = useState('');

    const [name, setName] = useState('');
    const [floorNameChoice, setFloorNameChoice] = useState('');
    const [ward, setWard] = useState<WardDraft>(emptyWard);
    const [room, setRoom] = useState<RoomDraft>(emptyRoom);
    const [bed, setBed] = useState<BedDraft>(emptyBed);

    const [childFloors, setChildFloors] = useState<{ name: string }[]>([]);
    const [childWards, setChildWards] = useState<WardDraft[]>([]);
    const [childRooms, setChildRooms] = useState<RoomDraft[]>([]);
    const [childBeds, setChildBeds] = useState<BedDraft[]>([]);

    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    /* ── prefill ────────────────────────────────────────────────────── */
    useEffect(() => {
        setError('');
        setBlockChoice(context.blockId || '');
        setFloorChoice(context.floorId || '');
        setWardChoice(context.wardId || '');
        setRoomChoice(context.roomId || '');
        setNewBlockName('');
        setNewFloorName('');
        setChildFloors([]);
        setChildWards([]);
        setChildRooms([]);
        setChildBeds([]);

        if (kind === 'edit') {
            if (request.level === 'block') setName(request.entity.name);
            if (request.level === 'floor') {
                setName(request.entity.name);
                setFloorNameChoice(/^([1-9]|10)$/.test(request.entity.name) ? request.entity.name : OTHER);
            }
            if (request.level === 'ward') {
                const entity = request.entity;
                const known = entity.type && (WARD_TYPES as readonly string[]).includes(entity.type);
                setWard({
                    name: entity.name,
                    code: entity.code || '',
                    type: entity.type ? (known ? entity.type : OTHER) : '',
                    typeOther: known ? '' : entity.type || '',
                    gender: entity.gender_restriction || '',
                });
            }
            if (request.level === 'room') setRoom({ number: request.entity.number, name: request.entity.name || '' });
            if (request.level === 'bed') {
                setBed({
                    bed_number: request.entity.bed_number,
                    bed_code: request.entity.bed_code || '',
                    status: request.entity.status,
                });
            }
            return;
        }

        setName('');
        setFloorNameChoice('');
        setWard(emptyWard());
        setRoom(emptyRoom());
        setBed(emptyBed());
        if (level === 'bed') setChildBeds([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [request]);

    /* ── cascading options ──────────────────────────────────────────── */
    const selectedBlock = useMemo(
        () => blocks.find(item => item.id === blockChoice) || null,
        [blocks, blockChoice],
    );
    const floorOptions = useMemo(() => selectedBlock?.floors || [], [selectedBlock]);
    const selectedFloor = useMemo(
        () => floorOptions.find(item => item.id === floorChoice) || null,
        [floorOptions, floorChoice],
    );
    const wardOptions = useMemo(() => selectedFloor?.wards || [], [selectedFloor]);
    const selectedWard = useMemo(
        () => wardOptions.find(item => item.id === wardChoice) || null,
        [wardOptions, wardChoice],
    );
    const roomOptions = useMemo(() => {
        if (selectedWard?.rooms.length) return selectedWard.rooms;
        return context.wardId && context.wardId === wardChoice ? rooms : [];
    }, [selectedWard, rooms, context.wardId, wardChoice]);

    /** Parent fields the form must ask for, because the caller didn't supply them. */
    const needs = {
        block: level !== 'block' && !context.blockId,
        floor: (level === 'ward' || level === 'room' || level === 'bed') && !context.floorId,
        ward: (level === 'room' || level === 'bed') && !context.wardId,
        room: level === 'bed' && !context.roomId,
    };

    const resolvedFloorName = floorNameChoice === OTHER ? name.trim() : floorNameChoice;

    /* ── submit ─────────────────────────────────────────────────────── */
    const post = useCallback(async (endpoint: string, method: 'POST' | 'PUT' | 'PATCH', body: unknown) => {
        const url = await appendFacilityIdForProxy(endpoint);
        const res = await fetch(url, {
            method,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(hierarchyApiMessage(data, `Request failed (${res.status})`));
        return data;
    }, []);

    const submit = useCallback(async () => {
        setError('');

        const blockId = context.blockId || (blockChoice && blockChoice !== NEW ? blockChoice : '');
        const floorId = context.floorId || (floorChoice && floorChoice !== NEW ? floorChoice : '');
        const wardId = context.wardId || wardChoice;
        const roomId = context.roomId || roomChoice;

        setSaving(true);
        try {
            if (kind === 'edit') {
                if (level === 'block') {
                    if (!name.trim()) throw new Error('Block name is required.');
                    await post(API_ENDPOINTS.BLOCK(request.entity.id), 'PUT', { name: name.trim() });
                } else if (level === 'floor') {
                    if (!resolvedFloorName) throw new Error('Floor name is required.');
                    await post(API_ENDPOINTS.FLOOR(request.entity.id), 'PUT', { name: resolvedFloorName });
                } else if (level === 'ward') {
                    if (!ward.name.trim()) throw new Error('Ward name is required.');
                    await post(API_ENDPOINTS.WARD(request.entity.id), 'PUT', wardPayload(ward));
                } else if (level === 'room') {
                    if (!room.number.trim()) throw new Error('Room number is required.');
                    await post(API_ENDPOINTS.ROOM(request.entity.id), 'PUT', roomPayload(room));
                } else {
                    if (!bed.bed_number.trim()) throw new Error('Bed number is required.');
                    await post(API_ENDPOINTS.BED(request.entity.id), 'PATCH', bedPayload(bed));
                }
                onSaved(`${LEVEL_TITLES[level].edit.replace('Edit ', '').replace(' info', '')} updated`);
                return;
            }

            if (level === 'block') {
                if (!name.trim()) throw new Error('Block name is required.');
                const floors = childFloors.filter(floor => floor.name.trim());
                await post(API_ENDPOINTS.BLOCKS, 'POST', {
                    name: name.trim(),
                    ...(floors.length ? { floors: floors.map(floor => ({ name: floor.name.trim() })) } : {}),
                });
                onSaved('Block created');
                return;
            }

            if (level === 'floor') {
                if (!resolvedFloorName) throw new Error('Floor name or number is required.');
                const wards = childWards.filter(item => item.name.trim()).map(wardPayload);
                const floorBody = { name: resolvedFloorName, ...(wards.length ? { wards } : {}) };
                if (blockId) {
                    await post(API_ENDPOINTS.BLOCK_FLOORS(blockId), 'POST', floorBody);
                } else if (newBlockName.trim()) {
                    await post(API_ENDPOINTS.BLOCKS, 'POST', { name: newBlockName.trim(), floors: [floorBody] });
                } else {
                    throw new Error('Pick a block or enter a new block name.');
                }
                onSaved('Floor created');
                return;
            }

            if (level === 'ward') {
                if (!ward.name.trim()) throw new Error('Ward name is required.');
                const roomsPayload = childRooms.filter(item => item.number.trim()).map(item => roomPayload(item));
                const body = { ...wardPayload(ward), ...(roomsPayload.length ? { rooms: roomsPayload } : {}) };
                if (floorId) {
                    await post(API_ENDPOINTS.FLOOR_WARDS(floorId), 'POST', body);
                } else if (blockId && newFloorName.trim()) {
                    await post(API_ENDPOINTS.BLOCK_FLOORS(blockId), 'POST', { name: newFloorName.trim(), wards: [body] });
                } else if (newBlockName.trim() && newFloorName.trim()) {
                    await post(API_ENDPOINTS.BLOCKS, 'POST', {
                        name: newBlockName.trim(),
                        floors: [{ name: newFloorName.trim(), wards: [body] }],
                    });
                } else {
                    throw new Error('Pick the block and floor this ward belongs to.');
                }
                onSaved('Ward created');
                return;
            }

            if (level === 'room') {
                if (!wardId) throw new Error('Pick the ward this room belongs to.');
                if (!room.number.trim()) throw new Error('Room number is required.');
                await post(API_ENDPOINTS.WARD_ROOMS(wardId), 'POST', roomPayload(room, childBeds));
                onSaved('Room created');
                return;
            }

            if (!roomId) throw new Error('Pick the room this bed belongs to.');
            const beds = [bed, ...childBeds].filter(item => item.bed_number.trim());
            if (!beds.length) throw new Error('Bed number is required.');
            await post(API_ENDPOINTS.ROOM_BEDS(roomId), 'POST', { beds: beds.map(bedPayload) });
            onSaved(beds.length === 1 ? 'Bed added' : `${beds.length} beds added`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong.');
        } finally {
            setSaving(false);
        }
    }, [
        kind, level, request, context, blockChoice, floorChoice, wardChoice, roomChoice,
        name, resolvedFloorName, ward, room, bed, childFloors, childWards, childRooms, childBeds,
        newBlockName, newFloorName, post, onSaved,
    ]);

    /* ── field renderers ────────────────────────────────────────────── */
    const floorNameField = (
        <div style={{ display: 'grid', gridTemplateColumns: floorNameChoice === OTHER ? '1fr 1fr' : '1fr', gap: 10 }}>
            <div>
                <label style={fieldLabel}>Floor name / number</label>
                <select
                    value={floorNameChoice}
                    onChange={e => setFloorNameChoice(e.target.value)}
                    style={selectStyle}
                >
                    <option value="">Select…</option>
                    {Array.from({ length: 10 }, (_, i) => String(i + 1)).map(n => (
                        <option key={n} value={n}>{n}</option>
                    ))}
                    <option value={OTHER}>Type a name…</option>
                </select>
            </div>
            {floorNameChoice === OTHER && (
                <div>
                    <label style={fieldLabel}>Name</label>
                    <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Ground floor"
                        style={input}
                    />
                </div>
            )}
        </div>
    );

    const wardFields = (draft: WardDraft, update: (next: WardDraft) => void) => (
        <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                    <label style={fieldLabel}>Ward / unit name *</label>
                    <input
                        value={draft.name}
                        onChange={e => update({ ...draft, name: e.target.value })}
                        placeholder="e.g. Labour & Delivery Unit"
                        style={input}
                    />
                </div>
                <div>
                    <label style={fieldLabel}>Ward / unit code</label>
                    <input
                        value={draft.code}
                        onChange={e => update({ ...draft, code: e.target.value })}
                        placeholder="Optional"
                        style={input}
                    />
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                    <label style={fieldLabel}>Ward / unit type</label>
                    <select
                        value={draft.type}
                        onChange={e => update({ ...draft, type: e.target.value })}
                        style={selectStyle}
                    >
                        <option value="">Select…</option>
                        {WARD_TYPES.map(type => (
                            <option key={type} value={type}>{wardTypeLabel(type)}</option>
                        ))}
                        <option value={OTHER}>Type a type…</option>
                    </select>
                </div>
                <div>
                    <label style={fieldLabel}>Gender restriction</label>
                    <select
                        value={draft.gender}
                        onChange={e => update({ ...draft, gender: e.target.value })}
                        style={selectStyle}
                    >
                        <option value="">Select…</option>
                        {GENDER_RESTRICTIONS.map(value => (
                            <option key={value} value={value}>{genderLabel(value)}</option>
                        ))}
                    </select>
                </div>
            </div>
            {draft.type === OTHER && (
                <div>
                    <label style={fieldLabel}>Custom type</label>
                    <input
                        value={draft.typeOther}
                        onChange={e => update({ ...draft, typeOther: e.target.value })}
                        placeholder="e.g. Day case"
                        style={input}
                    />
                </div>
            )}
        </div>
    );

    const roomFields = (draft: RoomDraft, update: (next: RoomDraft) => void) => (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
                <label style={fieldLabel}>Room / cubicle number *</label>
                <input
                    value={draft.number}
                    onChange={e => update({ ...draft, number: e.target.value })}
                    placeholder="e.g. 101"
                    style={input}
                />
            </div>
            <div>
                <label style={fieldLabel}>Room / cubicle name</label>
                <input
                    value={draft.name}
                    onChange={e => update({ ...draft, name: e.target.value })}
                    placeholder="Optional"
                    style={input}
                />
            </div>
        </div>
    );

    const bedFields = (draft: BedDraft, update: (next: BedDraft) => void) => (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
                <label style={fieldLabel}>Bed number *</label>
                <input
                    value={draft.bed_number}
                    onChange={e => update({ ...draft, bed_number: e.target.value })}
                    placeholder="e.g. 01"
                    style={input}
                />
            </div>
            <div>
                <label style={fieldLabel}>Bed code / name</label>
                <input
                    value={draft.bed_code}
                    onChange={e => update({ ...draft, bed_code: e.target.value })}
                    placeholder="Optional"
                    style={input}
                />
            </div>
            <div>
                <label style={fieldLabel}>Bed status</label>
                <select
                    value={draft.status}
                    onChange={e => update({ ...draft, status: e.target.value as BedStatus })}
                    style={selectStyle}
                >
                    {(Object.keys(BED_STATUS_META) as BedStatus[]).map(status => (
                        <option key={status} value={status}>{BED_STATUS_META[status].label}</option>
                    ))}
                </select>
            </div>
        </div>
    );

    const sectionShell = (title: string, onRemove: (() => void) | null, children: React.ReactNode) => (
        <div style={{ border: '1px solid #EDF1F6', borderRadius: 10, padding: 12, background: '#FBFCFE' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#344054' }}>{title}</span>
                {onRemove && (
                    <button type="button" onClick={onRemove} style={{ ...dangerLinkButton, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <X size={12} strokeWidth={2} /> Remove
                    </button>
                )}
            </div>
            {children}
        </div>
    );

    const addMoreButton = (label: string, disabled: boolean, onClick: () => void) => (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            style={{
                ...linkButton,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                opacity: disabled ? 0.45 : 1,
                cursor: disabled ? 'default' : 'pointer',
            }}
        >
            <Plus size={13} strokeWidth={2} /> {label}
        </button>
    );

    return (
        <div
            role="dialog"
            aria-modal="true"
            style={{
                position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(15, 23, 42, 0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            }}
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: 'min(640px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                    background: '#FFFFFF', borderRadius: 14, boxShadow: '0 24px 60px rgba(15, 23, 42, 0.26)',
                }}
            >
                <div style={{
                    padding: '16px 20px', borderBottom: '1px solid #EDF1F6',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#101828' }}>
                            {kind === 'create' ? LEVEL_TITLES[level].create : LEVEL_TITLES[level].edit}
                        </div>
                        <div style={{ fontSize: 12, color: '#7B8798', marginTop: 2 }}>
                            {kind === 'create'
                                ? 'Only the details we don\u2019t already know are shown.'
                                : 'Update the details below.'}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#98A2B3', display: 'flex' }}
                        aria-label="Close"
                    >
                        <X size={18} strokeWidth={1.8} />
                    </button>
                </div>

                <div style={{ padding: 20, overflowY: 'auto', display: 'grid', gap: 14 }}>
                    {error && (
                        <div style={{
                            padding: '9px 12px', borderRadius: 8, background: '#FEF3F2',
                            border: '1px solid #FEE4E2', color: '#B42318', fontSize: 12.5,
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Parent context the caller didn't supply */}
                    {needs.block && (
                        <div style={{ display: 'grid', gridTemplateColumns: blockChoice === NEW ? '1fr 1fr' : '1fr', gap: 10 }}>
                            <div>
                                <label style={fieldLabel}>Building / block *</label>
                                <select
                                    value={blockChoice}
                                    onChange={e => { setBlockChoice(e.target.value); setFloorChoice(''); setWardChoice(''); setRoomChoice(''); }}
                                    style={selectStyle}
                                >
                                    <option value="">Select…</option>
                                    {blocks.map(block => (
                                        <option key={block.id} value={block.id}>{block.name}</option>
                                    ))}
                                    <option value={NEW}>Add a new block…</option>
                                </select>
                            </div>
                            {blockChoice === NEW && (
                                <div>
                                    <label style={fieldLabel}>New block name *</label>
                                    <input
                                        value={newBlockName}
                                        onChange={e => setNewBlockName(e.target.value)}
                                        placeholder="e.g. Maternity Block"
                                        style={input}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {needs.floor && (
                        <div style={{ display: 'grid', gridTemplateColumns: floorChoice === NEW || blockChoice === NEW ? '1fr 1fr' : '1fr', gap: 10 }}>
                            <div>
                                <label style={fieldLabel}>Floor *</label>
                                <select
                                    value={blockChoice === NEW ? NEW : floorChoice}
                                    disabled={blockChoice === NEW || !blockChoice}
                                    onChange={e => { setFloorChoice(e.target.value); setWardChoice(''); setRoomChoice(''); }}
                                    style={{ ...selectStyle, opacity: blockChoice === NEW || !blockChoice ? 0.6 : 1 }}
                                >
                                    <option value="">Select…</option>
                                    {floorOptions.map(floor => (
                                        <option key={floor.id} value={floor.id}>{floor.name}</option>
                                    ))}
                                    <option value={NEW}>Add a new floor…</option>
                                </select>
                            </div>
                            {(floorChoice === NEW || blockChoice === NEW) && (
                                <div>
                                    <label style={fieldLabel}>New floor name / number *</label>
                                    <input
                                        value={newFloorName}
                                        onChange={e => setNewFloorName(e.target.value)}
                                        placeholder="e.g. 2"
                                        style={input}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {needs.ward && (
                        <div>
                            <label style={fieldLabel}>Ward / unit *</label>
                            <select
                                value={wardChoice}
                                disabled={!floorChoice || floorChoice === NEW}
                                onChange={e => { setWardChoice(e.target.value); setRoomChoice(''); }}
                                style={{ ...selectStyle, opacity: !floorChoice || floorChoice === NEW ? 0.6 : 1 }}
                            >
                                <option value="">Select…</option>
                                {wardOptions.map(option => (
                                    <option key={option.id} value={option.id}>{option.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {needs.room && (
                        <div>
                            <label style={fieldLabel}>Room / cubicle *</label>
                            <select
                                value={roomChoice}
                                disabled={!wardChoice}
                                onChange={e => setRoomChoice(e.target.value)}
                                style={{ ...selectStyle, opacity: !wardChoice ? 0.6 : 1 }}
                            >
                                <option value="">Select…</option>
                                {roomOptions.map(option => (
                                    <option key={option.id} value={option.id}>
                                        {option.name ? `${option.number} · ${option.name}` : option.number}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* The level's own fields */}
                    {level === 'block' && (
                        <div>
                            <label style={fieldLabel}>Building / block name *</label>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Maternity Block"
                                style={input}
                            />
                        </div>
                    )}
                    {level === 'floor' && floorNameField}
                    {level === 'ward' && wardFields(ward, setWard)}
                    {level === 'room' && roomFields(room, setRoom)}
                    {level === 'bed' && bedFields(bed, setBed)}

                    {/* Optional children, per the spec's nested add forms */}
                    {kind === 'create' && level === 'block' && (
                        <div style={{ display: 'grid', gap: 10 }}>
                            {childFloors.map((floor, index) => sectionShell(
                                `Floor ${index + 1}`,
                                () => setChildFloors(prev => prev.filter((_, i) => i !== index)),
                                <div>
                                    <label style={fieldLabel}>Floor name / number</label>
                                    <input
                                        value={floor.name}
                                        onChange={e => setChildFloors(prev => prev.map((item, i) => i === index ? { name: e.target.value } : item))}
                                        placeholder="e.g. 1"
                                        style={input}
                                    />
                                </div>,
                            ))}
                            {addMoreButton(
                                childFloors.length === 0 ? 'Add floor' : 'Add another floor',
                                childFloors.length >= NESTED_LIMITS.floorsPerBlock,
                                () => setChildFloors(prev => [...prev, { name: '' }]),
                            )}
                            {childFloors.length >= NESTED_LIMITS.floorsPerBlock && (
                                <span style={{ fontSize: 12, color: '#98A2B3' }}>
                                    Up to {NESTED_LIMITS.floorsPerBlock} floors per block here. Add more from the block page.
                                </span>
                            )}
                        </div>
                    )}

                    {kind === 'create' && level === 'floor' && (
                        <div style={{ display: 'grid', gap: 10 }}>
                            {childWards.map((draft, index) => sectionShell(
                                `Ward ${index + 1}`,
                                () => setChildWards(prev => prev.filter((_, i) => i !== index)),
                                wardFields(draft, next => setChildWards(prev => prev.map((item, i) => i === index ? next : item))),
                            ))}
                            {addMoreButton(
                                childWards.length === 0 ? 'Add ward' : 'Add another ward',
                                childWards.length >= NESTED_LIMITS.wardsPerFloor,
                                () => setChildWards(prev => [...prev, emptyWard()]),
                            )}
                            {childWards.length >= NESTED_LIMITS.wardsPerFloor && (
                                <span style={{ fontSize: 12, color: '#98A2B3' }}>
                                    Up to {NESTED_LIMITS.wardsPerFloor} wards per floor here.
                                </span>
                            )}
                        </div>
                    )}

                    {kind === 'create' && level === 'ward' && (
                        <div style={{ display: 'grid', gap: 10 }}>
                            {childRooms.map((draft, index) => sectionShell(
                                `Room ${index + 1}`,
                                () => setChildRooms(prev => prev.filter((_, i) => i !== index)),
                                roomFields(draft, next => setChildRooms(prev => prev.map((item, i) => i === index ? next : item))),
                            ))}
                            {addMoreButton(
                                childRooms.length === 0 ? 'Add room' : 'Add another room',
                                childRooms.length >= NESTED_LIMITS.roomsPerWard,
                                () => setChildRooms(prev => [...prev, emptyRoom()]),
                            )}
                            {childRooms.length >= NESTED_LIMITS.roomsPerWard && (
                                <span style={{ fontSize: 12, color: '#98A2B3' }}>
                                    Up to {NESTED_LIMITS.roomsPerWard} rooms per ward here.
                                </span>
                            )}
                        </div>
                    )}

                    {kind === 'create' && (level === 'room' || level === 'bed') && (
                        <div style={{ display: 'grid', gap: 10 }}>
                            {childBeds.map((draft, index) => sectionShell(
                                `Bed ${index + (level === 'bed' ? 2 : 1)}`,
                                () => setChildBeds(prev => prev.filter((_, i) => i !== index)),
                                bedFields(draft, next => setChildBeds(prev => prev.map((item, i) => i === index ? next : item))),
                            ))}
                            {addMoreButton(
                                childBeds.length === 0 && level === 'room' ? 'Add bed' : 'Add another bed',
                                childBeds.length >= NESTED_LIMITS.bedsPerRoom,
                                () => setChildBeds(prev => [...prev, emptyBed()]),
                            )}
                        </div>
                    )}
                </div>

                <div style={{
                    padding: '14px 20px', borderTop: '1px solid #EDF1F6',
                    display: 'flex', justifyContent: 'flex-end', gap: 10,
                }}>
                    <button type="button" onClick={onClose} style={secondaryButton}>Cancel</button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={saving}
                        style={{ ...primaryButton, opacity: saving ? 0.6 : 1, cursor: saving ? 'default' : 'pointer' }}
                    >
                        {saving ? 'Saving…' : kind === 'create' ? 'Submit' : 'Save changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
