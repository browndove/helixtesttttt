'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import { API_ENDPOINTS } from '@/lib/config';
import { appendFacilityIdForProxy } from '@/lib/facility-client';
import type { BedStatus } from '@/lib/beds';
import {
    GENDER_RESTRICTIONS,
    NESTED_LIMITS,
    WARD_TYPES,
    genderLabel,
    hierarchyApiMessage,
    optionalForApi,
    optionalFromApi,
    parseFloors,
    parseRoom,
    parseRooms,
    parseWards,
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
} from './bed-layout-ui';
import type { PreviewOp } from './preview-store';

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

type WardDraft = {
    name: string;
    nameChoice: string;
    code: string;
    type: string;
    gender: string;
};
type RoomDraft = { number: string; name: string };
type BedDraft = { bed_number: string; bed_code: string; status: BedStatus };

const NEW = '__new';
const OTHER = '__other';

const fieldSelectStyle = {
    height: 38,
    borderRadius: 8,
    border: '1px solid #E1E7EF',
    fontSize: 13,
};

function readCreatedId(raw: unknown): string {
    if (!raw || typeof raw !== 'object') return '';
    const rec = raw as Record<string, unknown>;
    if (typeof rec.id === 'string' && rec.id) return rec.id;
    for (const key of ['room', 'data', 'unit', 'ward', 'department']) {
        const nested = rec[key];
        if (nested && typeof nested === 'object' && typeof (nested as Record<string, unknown>).id === 'string') {
            return (nested as Record<string, unknown>).id as string;
        }
    }
    const rooms = rec.rooms;
    if (Array.isArray(rooms) && rooms[0] && typeof rooms[0] === 'object' && typeof (rooms[0] as Record<string, unknown>).id === 'string') {
        return (rooms[0] as Record<string, unknown>).id as string;
    }
    return '';
}

function withTypedOption(options: { label: string; value: string }[], current: string) {
    const typed = current.trim();
    if (!typed || options.some(option => option.value === typed || option.label.trim().toLowerCase() === typed.toLowerCase())) {
        return options;
    }
    return [{ label: typed, value: typed }, ...options];
}

function matchedOption(value: string, options: { label: string; value: string }[]) {
    const typed = value.trim().toLowerCase();
    return options.find(option => option.value === value || option.value.toLowerCase() === typed || option.label.trim().toLowerCase() === typed);
}

/** The facility keeps unit names unique, so a second floor stores the same label with a hidden mark. */
function visibleUnitName(name: string): string {
    return name.replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, '').trim();
}

function sameUnitName(a: string, b: string): boolean {
    return visibleUnitName(a).toLowerCase() === visibleUnitName(b).toLowerCase();
}

function unitNameForFloor(name: string, floorId: string): string {
    const visible = visibleUnitName(name);
    let mark = '\u2060';
    for (let i = 0; i < floorId.length; i += 1) {
        mark += (floorId.charCodeAt(i) + i) % 2 === 0 ? '\u200B' : '\u200C';
    }
    return `${visible}${mark}`;
}

const LEVEL_TITLES: Record<LayoutLevel, { create: string; edit: string }> = {
    block: { create: 'Add building / block', edit: 'Edit block info' },
    floor: { create: 'Add floor', edit: 'Edit floor info' },
    ward: { create: 'Add ward / unit', edit: 'Edit ward info' },
    room: { create: 'Add room / cubicle', edit: 'Edit room info' },
    bed: { create: 'Add bed', edit: 'Edit bed info' },
};

function emptyWard(): WardDraft {
    return { name: '', nameChoice: '', code: '', type: '', gender: '' };
}

function emptyRoom(): RoomDraft {
    return { number: '', name: '' };
}

function emptyBed(): BedDraft {
    return { bed_number: '', bed_code: '', status: 'available' };
}

function wardPayload(draft: WardDraft, opts?: { clearOptional?: boolean }): Record<string, unknown> {
    const type = draft.type.trim();
    const code = draft.code.trim();
    const gender = draft.gender.trim();
    // Backend ignores null/"" on PUT, so cleared strings use a sentinel shown as empty in the UI.
    // gender_restriction is an enum and cannot be cleared by the API — omit when empty on edit.
    if (opts?.clearOptional) {
        return {
            name: draft.name.trim(),
            code: optionalForApi(code),
            type: optionalForApi(type),
            ...(gender ? { gender_restriction: gender } : {}),
        };
    }
    return {
        name: draft.name.trim(),
        ...(code ? { code } : {}),
        ...(type ? { type } : {}),
        ...(gender ? { gender_restriction: gender } : {}),
    };
}

function bedPayload(draft: BedDraft, opts?: { clearOptional?: boolean }): Record<string, unknown> {
    const bedCode = draft.bed_code.trim();
    return {
        bed_number: draft.bed_number.trim(),
        ...(opts?.clearOptional
            ? { bed_code: optionalForApi(bedCode) }
            : (bedCode ? { bed_code: bedCode } : {})),
        status: draft.status,
    };
}

/** Finds a room id for this number anywhere in a list or error payload. */
function roomIdForNumber(raw: unknown, number: string): string {
    const want = number.trim().toLowerCase();
    if (!want) return '';
    const seen = new Set<unknown>();
    const visit = (node: unknown): string => {
        if (!node || typeof node !== 'object' || seen.has(node)) return '';
        seen.add(node);
        if (Array.isArray(node)) {
            for (const item of node) {
                const found = visit(item);
                if (found) return found;
            }
            return '';
        }
        const parsed = parseRoom(node);
        if (parsed && parsed.number.trim().toLowerCase() === want) return parsed.id;
        for (const value of Object.values(node as Record<string, unknown>)) {
            const found = visit(value);
            if (found) return found;
        }
        return '';
    };
    const listed = parseRooms(raw).find(item => item.number.trim().toLowerCase() === want);
    return listed?.id || visit(raw);
}

function roomPayload(
    draft: RoomDraft,
    beds?: BedDraft[],
    opts?: { clearOptional?: boolean },
): Record<string, unknown> {
    const usable = (beds || []).filter(bed => bed.bed_number.trim());
    const name = draft.name.trim();
    return {
        number: draft.number.trim(),
        ...(opts?.clearOptional
            ? { name: optionalForApi(name) }
            : (name ? { name } : {})),
        ...(usable.length ? { beds: usable.map(item => bedPayload(item)) } : {}),
    };
}

export default function BedLayoutFormDialog({
    request,
    blocks,
    rooms,
    preview = false,
    onClose,
    onSaved,
    onPreviewOp,
}: {
    request: FormDialogRequest;
    blocks: Block[];
    /** Rooms of the ward in context, for the bed parent picker. */
    rooms: Room[];
    /** Showing the sample layout: apply locally instead of calling the API. */
    preview?: boolean;
    onClose: () => void;
    onSaved: (message: string) => void;
    onPreviewOp?: (op: PreviewOp) => void;
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
    const [bedUnitType, setBedUnitType] = useState('');
    const [bedUnitGender, setBedUnitGender] = useState('');
    const [roomChoice, setRoomChoice] = useState('');

    const [name, setName] = useState('');
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
        setBedUnitType('');
        setBedUnitGender('');
        setRoomChoice(context.roomId || '');
        setNewBlockName('');
        setNewFloorName('');
        setChildFloors([]);
        setChildWards([]);
        setChildRooms([]);
        setChildBeds([]);

        if (kind === 'edit') {
            if (request.level === 'block') setName(request.entity.name);
            if (request.level === 'floor') setName(request.entity.name);
            if (request.level === 'ward') {
                const entity = request.entity;
                setWard({
                    name: visibleUnitName(entity.name),
                    nameChoice: OTHER,
                    code: optionalFromApi(entity.code),
                    type: optionalFromApi(entity.type),
                    gender: optionalFromApi(entity.gender_restriction),
                });
            }
            if (request.level === 'room') {
                setRoom({ number: request.entity.number, name: optionalFromApi(request.entity.name) });
            }
            if (request.level === 'bed') {
                setBed({
                    bed_number: request.entity.bed_number,
                    bed_code: optionalFromApi(request.entity.bed_code),
                    status: request.entity.status,
                });
            }
            return;
        }

        setName('');
        setWard(emptyWard());
        setRoom(emptyRoom());
        setBed(emptyBed());
        if (level === 'bed' && context.wardId) {
            const existing = blocks.flatMap(block => block.floors.flatMap(floor => floor.wards)).find(item => item.id === context.wardId);
            if (existing) {
                setBedUnitType(existing.type || '');
                setBedUnitGender(existing.gender_restriction || '');
            }
        }
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

    /** Parent fields the form must ask for on create, because the caller didn't supply them. */
    const needs = {
        block: kind === 'create' && level !== 'block' && !context.blockId,
        floor: kind === 'create' && (level === 'ward' || level === 'room' || level === 'bed') && !context.floorId,
        ward: kind === 'create' && (level === 'room' || level === 'bed') && !context.wardId,
        room: kind === 'create' && level === 'bed' && !context.roomId,
    };

    const savedBuildings = useMemo(
        () => blocks.filter(block => block.name.trim().toLowerCase() !== 'unassigned'),
        [blocks],
    );
    const resolvedFloorName = name.trim();
    const chosenBuildingId = savedBuildings.some(block => block.id === name) ? name : '';
    const floorBlockId = context.blockId
        || (blockChoice && blockChoice !== NEW ? blockChoice : '')
        || (level === 'block' ? chosenBuildingId : '');
    const buildingFloors = useMemo(() => {
        const parent = blocks.find(item => item.id === floorBlockId);
        return (parent?.floors || [])
            .filter(floor => {
                const key = floor.name.trim().toLowerCase();
                return key !== 'unassigned' && key !== 'attached units';
            })
            .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }));
    }, [blocks, floorBlockId]);
    const targetFloorId = context.floorId || (floorChoice && floorChoice !== NEW ? floorChoice : '');
    /** Units already on the floor being edited. The same name may exist on other floors and in other buildings. */
    const unitsOnPlace = useMemo(() => {
        if (!targetFloorId) return [];
        for (const block of blocks) {
            const floor = block.floors.find(item => item.id === targetFloorId);
            if (floor) return floor.wards;
        }
        return [];
    }, [blocks, targetFloorId]);
    const takenFloorNames = useMemo(() => {
        const ignoreId = kind === 'edit' && level === 'floor' ? request.entity.id : '';
        return new Set(
            buildingFloors
                .filter(floor => floor.id !== ignoreId)
                .map(floor => floor.name.trim().toLowerCase()),
        );
    }, [buildingFloors, kind, level, request]);

    /* ── submit ─────────────────────────────────────────────────────── */
    /** Sends to the API, or applies the equivalent op to the sample layout. */
    const send = useCallback(async (
        endpoint: string,
        method: 'POST' | 'PUT' | 'PATCH',
        body: Record<string, unknown>,
        op: PreviewOp,
    ) => {
        if (preview) {
            onPreviewOp?.(op);
            return null;
        }
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
    }, [preview, onPreviewOp]);

    const submit = useCallback(async () => {
        setError('');

        const blockId = context.blockId || (blockChoice && blockChoice !== NEW ? blockChoice : '');
        const floorId = context.floorId || (floorChoice && floorChoice !== NEW ? floorChoice : '');
        const pickedWard = wardOptions.find(item => item.id === wardChoice || sameUnitName(item.name, wardChoice));
        const wardId = context.wardId || pickedWard?.id || '';

        setSaving(true);
        try {
            const resolveNewFloor = async () => {
                if (!blockId) throw new Error('Pick a block or enter a new block name.');
                const floorName = newFloorName.trim();
                const floorBody = { name: floorName };
                try {
                    const createdFloor = await send(API_ENDPOINTS.BLOCK_FLOORS(blockId), 'POST', floorBody, {
                        kind: 'create', level: 'floor', parentId: blockId, body: floorBody,
                    });
                    const createdId = readCreatedId(createdFloor) || (preview ? `preview-floor-${floorName}` : '');
                    if (!createdId) throw new Error('Floor was created, but its id could not be read.');
                    return createdId;
                } catch (err) {
                    const message = err instanceof Error ? err.message : '';
                    if (!/already exists/i.test(message) || preview) throw err;
                    const url = await appendFacilityIdForProxy(API_ENDPOINTS.BLOCK_FLOORS(blockId));
                    const res = await fetch(url, { credentials: 'include' });
                    const data = await res.json().catch(() => ({}));
                    const match = (res.ok ? parseFloors(data) : []).find(floor => floor.name.trim().toLowerCase() === floorName.toLowerCase());
                    if (!match) throw err;
                    return match.id;
                }
            };
            if (kind === 'edit') {
                const id = request.entity.id;
                if (level === 'block') {
                    if (!name.trim()) throw new Error('Block name is required.');
                    const body = { name: name.trim() };
                    await send(API_ENDPOINTS.BLOCK(id), 'PUT', body, { kind: 'edit', level, id, body });
                } else if (level === 'floor') {
                    if (!resolvedFloorName) throw new Error('Floor name is required.');
                    if (takenFloorNames.has(resolvedFloorName.trim().toLowerCase())) {
                        throw new Error(`Floor ${resolvedFloorName} is already on this building. Pick another name.`);
                    }
                    const body = { name: resolvedFloorName };
                    await send(API_ENDPOINTS.FLOOR(id), 'PUT', body, { kind: 'edit', level, id, body });
                } else if (level === 'ward') {
                    if (!ward.name.trim()) throw new Error('Ward name is required.');
                    const body = wardPayload(ward, { clearOptional: true });
                    // Keep the previous gender when the field is left empty — the API enum cannot be cleared.
                    if (!ward.gender.trim() && request.entity.gender_restriction) {
                        body.gender_restriction = request.entity.gender_restriction;
                    }
                    await send(API_ENDPOINTS.WARD(id), 'PUT', body, { kind: 'edit', level, id, body });
                } else if (level === 'room') {
                    if (!room.number.trim()) throw new Error('Room number is required.');
                    const body = roomPayload(room, undefined, { clearOptional: true });
                    await send(API_ENDPOINTS.ROOM(id), 'PUT', body, { kind: 'edit', level, id, body });
                } else {
                    if (!bed.bed_number.trim()) throw new Error('Bed number is required.');
                    const body = bedPayload(bed, { clearOptional: true });
                    await send(API_ENDPOINTS.BED(id), 'PATCH', body, { kind: 'edit', level, id, body });
                }
                onSaved(`${LEVEL_TITLES[level].edit.replace('Edit ', '').replace(' info', '')} updated`);
                return;
            }

            if (level === 'block') {
                const floors = childFloors.filter(floor => floor.name.trim());
                const existing = savedBuildings.find(block => block.id === name);
                if (existing) {
                    const taken = new Set(existing.floors.map(floor => floor.name.trim().toLowerCase()));
                    for (const floor of floors) {
                        const floorName = floor.name.trim();
                        if (taken.has(floorName.toLowerCase())) continue;
                        try {
                            await send(API_ENDPOINTS.BLOCK_FLOORS(existing.id), 'POST', { name: floorName }, {
                                kind: 'create', level: 'floor', parentId: existing.id, body: { name: floorName },
                            });
                        } catch (err) {
                            const message = err instanceof Error ? err.message : '';
                            if (!/already exists/i.test(message)) throw err;
                        }
                    }
                    onSaved(floors.length ? 'Floors added' : 'Building already saved');
                    return;
                }
                if (!name.trim()) throw new Error('Building name is required.');
                const body = {
                    name: name.trim(),
                    ...(floors.length ? { floors: floors.map(floor => ({ name: floor.name.trim() })) } : {}),
                };
                await send(API_ENDPOINTS.BLOCKS, 'POST', body, { kind: 'create', level: 'block', body });
                onSaved('Block created');
                return;
            }

            if (level === 'floor') {
                if (!resolvedFloorName) throw new Error('Floor name or number is required.');
                const wards = childWards.filter(item => item.name.trim()).map(item => wardPayload(item));
                const floorBody = { name: resolvedFloorName, ...(wards.length ? { wards } : {}) };
                const alreadyThere = takenFloorNames.has(resolvedFloorName.trim().toLowerCase());
                if (blockId) {
                    if (!alreadyThere) {
                        try {
                            await send(API_ENDPOINTS.BLOCK_FLOORS(blockId), 'POST', floorBody, {
                                kind: 'create', level: 'floor', parentId: blockId, body: floorBody,
                            });
                        } catch (err) {
                            const message = err instanceof Error ? err.message : '';
                            if (!/already exists/i.test(message)) throw err;
                        }
                    }
                } else if (newBlockName.trim()) {
                    const body = { name: newBlockName.trim(), floors: [floorBody] };
                    await send(API_ENDPOINTS.BLOCKS, 'POST', body, { kind: 'create', level: 'block', body });
                } else {
                    throw new Error('Pick a block or enter a new block name.');
                }
                onSaved('Floor created');
                return;
            }

            if (level === 'ward') {
                if (!ward.name.trim()) throw new Error('Ward name is required.');
                if (kind === 'create' && unitsOnPlace.some(unit => sameUnitName(unit.name, ward.name))) {
                    throw new Error('That unit is already on this floor.');
                }
                const roomsPayload = childRooms.filter(item => item.number.trim()).map(item => roomPayload(item));
                const wardBody = { ...wardPayload(ward), ...(roomsPayload.length ? { rooms: roomsPayload } : {}) };
                if (floorId) {
                    try {
                        await send(API_ENDPOINTS.FLOOR_WARDS(floorId), 'POST', wardBody, {
                            kind: 'create', level: 'ward', parentId: floorId, body: wardBody,
                        });
                    } catch (err) {
                        const message = err instanceof Error ? err.message : '';
                        if (!/already exists/i.test(message) || preview) throw err;
                        const aliased = { ...wardBody, name: unitNameForFloor(ward.name, floorId) };
                        await send(API_ENDPOINTS.FLOOR_WARDS(floorId), 'POST', aliased, {
                            kind: 'create', level: 'ward', parentId: floorId, body: aliased,
                        });
                    }
                } else if (blockId && newFloorName.trim()) {
                    const body = { name: newFloorName.trim(), wards: [wardBody] };
                    await send(API_ENDPOINTS.BLOCK_FLOORS(blockId), 'POST', body, {
                        kind: 'create', level: 'floor', parentId: blockId, body,
                    });
                } else if (newBlockName.trim() && newFloorName.trim()) {
                    const body = {
                        name: newBlockName.trim(),
                        floors: [{ name: newFloorName.trim(), wards: [wardBody] }],
                    };
                    await send(API_ENDPOINTS.BLOCKS, 'POST', body, { kind: 'create', level: 'block', body });
                } else {
                    throw new Error('Pick the block and floor this ward belongs to.');
                }
                onSaved('Ward created');
                return;
            }

            if (level === 'room') {
                if (!room.number.trim()) throw new Error('Room number is required.');
                let resolvedFloorId = floorId;
                if (!resolvedFloorId && newFloorName.trim()) {
                    resolvedFloorId = await resolveNewFloor();
                }
                let resolvedWardId = wardId;
                const typedUnit = wardChoice.trim();
                if (!resolvedWardId && typedUnit) {
                    if (!resolvedFloorId) throw new Error('Pick the floor this unit belongs to.');
                    const unitType = bedUnitType.trim();
                    const unitGender = bedUnitGender.trim();
                    if (!unitGender) throw new Error('Choose a gender restriction.');
                    const createUnit = async (name: string) => {
                        const wardBody = {
                            name,
                            ...(unitType ? { type: unitType } : {}),
                            gender_restriction: unitGender,
                        };
                        const createdWard = await send(API_ENDPOINTS.FLOOR_WARDS(resolvedFloorId), 'POST', wardBody, {
                            kind: 'create', level: 'ward', parentId: resolvedFloorId, body: wardBody,
                        });
                        return readCreatedId(createdWard) || (preview ? `preview-ward-${visibleUnitName(name)}` : '');
                    };
                    try {
                        resolvedWardId = await createUnit(typedUnit);
                    } catch (err) {
                        const message = err instanceof Error ? err.message : '';
                        if (!/already exists/i.test(message) || preview) throw err;
                        resolvedWardId = await createUnit(unitNameForFloor(typedUnit, resolvedFloorId));
                    }
                    if (!resolvedWardId) throw new Error('Unit was created, but its id could not be read.');
                }
                if (!resolvedWardId) throw new Error(typedUnit ? 'Pick a unit on this floor.' : 'Pick the ward this room belongs to.');
                const addingBeds = childBeds.some(item => item.bed_number.trim());
                if (addingBeds && childBeds.filter(item => item.bed_number.trim()).length > NESTED_LIMITS.bedsPerRoom) {
                    throw new Error(`A room can include up to ${NESTED_LIMITS.bedsPerRoom} beds.`);
                }
                const body = roomPayload(room, childBeds);
                await send(API_ENDPOINTS.WARD_ROOMS(resolvedWardId), 'POST', body, {
                    kind: 'create', level: 'room', parentId: resolvedWardId, body,
                });
                onSaved('Room created');
                return;
            }

            let resolvedFloorId = floorId;
            if (!resolvedFloorId && newFloorName.trim()) {
                resolvedFloorId = await resolveNewFloor();
            }
            const unitName = wardChoice.trim();
            const hiddenFloor = (name: string) => {
                const key = name.trim().toLowerCase();
                return key === 'unassigned' || key === 'attached units';
            };
            const placedUnit = blocks.flatMap(block => block.floors.flatMap(floor => floor.wards
                .filter(item => sameUnitName(item.name, unitName))
                .map(item => ({
                    id: item.id,
                    name: item.name,
                    type: item.type || '',
                    floorId: item.floor_id || floor.id,
                    onListedFloor: !hiddenFloor(floor.name),
                }))));
            const onThisFloor = placedUnit.find(item => item.floorId === resolvedFloorId);
            const selectedUnit = blocks.flatMap(block => block.floors.flatMap(floor => floor.wards)).find(item => item.id === wardId || item.id === wardChoice);
            const knownUnit = onThisFloor
                || (selectedUnit && (selectedUnit.floor_id || '') === resolvedFloorId
                    ? { id: selectedUnit.id, name: selectedUnit.name, type: selectedUnit.type || '', floorId: selectedUnit.floor_id || resolvedFloorId, onListedFloor: true }
                    : undefined);
            const unitType = bedUnitType.trim() || knownUnit?.type || '';
            const unitGender = bedUnitGender.trim();
            const unitBody = (name: string, floor: string, forEdit = false) => ({
                name,
                ...(floor ? { floor_id: floor } : {}),
                ...(forEdit
                    ? {
                        type: optionalForApi(unitType),
                        ...(unitGender ? { gender_restriction: unitGender } : {}),
                    }
                    : {
                        ...(unitType ? { type: unitType } : {}),
                        ...(unitGender ? { gender_restriction: unitGender } : {}),
                    }),
            });
            let resolvedWardId = wardId || (knownUnit?.floorId === resolvedFloorId ? knownUnit.id : '') || '';
            if (!resolvedWardId && unitName) {
                if (!resolvedFloorId) throw new Error('Pick the floor this unit belongs to.');
                if (knownUnit) {
                    const body = unitBody(knownUnit.name, resolvedFloorId, true);
                    await send(API_ENDPOINTS.WARD(knownUnit.id), 'PUT', body, {
                        kind: 'edit', level: 'ward', id: knownUnit.id, body,
                    });
                    resolvedWardId = knownUnit.id;
                } else {
                    const wardBody = unitBody(unitName, resolvedFloorId);
                    try {
                        const createdWard = await send(API_ENDPOINTS.FLOOR_WARDS(resolvedFloorId), 'POST', wardBody, {
                            kind: 'create', level: 'ward', parentId: resolvedFloorId, body: wardBody,
                        });
                        resolvedWardId = readCreatedId(createdWard) || (preview ? `preview-ward-${unitName}` : '');
                    } catch (err) {
                        const message = err instanceof Error ? err.message : '';
                        if (!/already exists/i.test(message) || preview) throw err;
                        const url = await appendFacilityIdForProxy(API_ENDPOINTS.FLOOR_WARDS(resolvedFloorId));
                        const res = await fetch(url, { credentials: 'include' });
                        const data = await res.json().catch(() => ({}));
                        const here = (res.ok ? parseWards(data) : []).find(item => sameUnitName(item.name, unitName));
                        if (here) {
                            resolvedWardId = here.id;
                        } else {
                            const aliased = unitBody(unitNameForFloor(unitName, resolvedFloorId), resolvedFloorId);
                            try {
                                const createdWard = await send(API_ENDPOINTS.FLOOR_WARDS(resolvedFloorId), 'POST', aliased, {
                                    kind: 'create', level: 'ward', parentId: resolvedFloorId, body: aliased,
                                });
                                resolvedWardId = readCreatedId(createdWard) || '';
                            } catch (retryErr) {
                                const retryMessage = retryErr instanceof Error ? retryErr.message : '';
                                if (!/already exists/i.test(retryMessage)) throw retryErr;
                                const again = await fetch(url, { credentials: 'include' });
                                const againData = await again.json().catch(() => ({}));
                                const placed = (again.ok ? parseWards(againData) : []).find(item => sameUnitName(item.name, unitName));
                                if (!placed) throw err;
                                resolvedWardId = placed.id;
                            }
                        }
                    }
                    if (!resolvedWardId) throw new Error('Unit was created, but its id could not be read.');
                }
            } else if (resolvedWardId && !context.wardId) {
                // Only update unit metadata when the unit was chosen in this form — not when adding a bed inside a known room.
                const named = knownUnit?.name
                    || blocks.flatMap(block => block.floors.flatMap(floor => floor.wards)).find(item => item.id === resolvedWardId)?.name
                    || unitName;
                if (named) {
                    const body = unitBody(named, resolvedFloorId, true);
                    await send(API_ENDPOINTS.WARD(resolvedWardId), 'PUT', body, {
                        kind: 'edit', level: 'ward', id: resolvedWardId, body,
                    });
                }
            }
            if (!resolvedWardId) throw new Error('Pick the ward this bed belongs to.');
            if ([bed, ...childBeds].some(item => item.bed_number.trim() && !BED_STATUS_META[item.status])) {
                throw new Error('Choose a bed status.');
            }
            const beds = [bed, ...childBeds].filter(item => item.bed_number.trim());
            if (!beds.length) throw new Error('Bed number is required.');
            if (beds.length > NESTED_LIMITS.bedsPerRoom) {
                throw new Error(`A room can include up to ${NESTED_LIMITS.bedsPerRoom} beds.`);
            }
            const typedRoom = roomChoice.trim();
            const unitOnThisFloor = blocks.flatMap(block => block.floors
                .filter(floor => floor.id === resolvedFloorId)
                .flatMap(floor => floor.wards))
                .find(item => item.id === resolvedWardId);
            const sameNumber = (item: { id: string; number: string }) => (
                item.id === context.roomId
                || item.number.trim().toLowerCase() === typedRoom.toLowerCase()
            );
            const existingRoom = unitOnThisFloor?.rooms.find(sameNumber)
                || roomOptions.find(item => item.ward_id === resolvedWardId && sameNumber(item));
            const roomNumber = (existingRoom?.number || typedRoom || beds[0].bed_number).trim();
            let resolvedRoomId = existingRoom?.id || '';
            if (!resolvedRoomId) {
                const body = { number: roomNumber };
                if (preview) {
                    onPreviewOp?.({ kind: 'create', level: 'room', parentId: resolvedWardId, body });
                    resolvedRoomId = `preview-room-${roomNumber}`;
                } else {
                    const url = await appendFacilityIdForProxy(API_ENDPOINTS.WARD_ROOMS(resolvedWardId));
                    const res = await fetch(url, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok) {
                        resolvedRoomId = readCreatedId(data);
                    } else if (res.status === 409 || /already exists/i.test(hierarchyApiMessage(data, ''))) {
                        resolvedRoomId = roomIdForNumber(data, roomNumber);
                        if (!resolvedRoomId) {
                            const listUrl = await appendFacilityIdForProxy(API_ENDPOINTS.WARD_ROOMS(resolvedWardId));
                            const listed = await fetch(listUrl, { credentials: 'include' });
                            const listedData = await listed.json().catch(() => ({}));
                            resolvedRoomId = listed.ok ? roomIdForNumber(listedData, roomNumber) : '';
                        }
                        if (!resolvedRoomId) {
                            const byWard = await appendFacilityIdForProxy(`${API_ENDPOINTS.ROOMS}?ward_id=${encodeURIComponent(resolvedWardId)}`);
                            const listed = await fetch(byWard, { credentials: 'include' });
                            const listedData = await listed.json().catch(() => ({}));
                            resolvedRoomId = listed.ok ? roomIdForNumber(listedData, roomNumber) : '';
                        }
                    } else {
                        throw new Error(hierarchyApiMessage(data, `Request failed (${res.status})`));
                    }
                }
                if (!resolvedRoomId) throw new Error('Room was created, but its id could not be read.');
            }
            const body = { beds: beds.map(item => bedPayload(item)) };
            await send(API_ENDPOINTS.ROOM_BEDS(resolvedRoomId), 'POST', body, {
                kind: 'create', level: 'bed', parentId: resolvedRoomId, body,
            });
            onSaved(beds.length === 1 ? 'Bed added' : `${beds.length} beds added`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong.');
        } finally {
            setSaving(false);
        }
    }, [
        kind, level, request, context, blockChoice, floorChoice, wardChoice, roomChoice,
        name, resolvedFloorName, ward, room, bed, childFloors, childWards, childRooms, childBeds,
        newBlockName, newFloorName, send, onSaved, onPreviewOp, bedUnitType, bedUnitGender,
        takenFloorNames, savedBuildings, unitsOnPlace, wardOptions, roomOptions, preview, blocks,
    ]);

    /* ── field renderers ────────────────────────────────────────────── */
    const floorNameOptions = (current: string, extraTaken: Iterable<string> = []) => {
        const blocked = new Set(extraTaken);
        const existing = buildingFloors
            .filter(floor => !blocked.has(floor.name.trim().toLowerCase()))
            .map(floor => ({ label: floor.name, value: floor.name }));
        const used = new Set(existing.map(option => option.value.toLowerCase()));
        const numbers = Array.from({ length: 10 }, (_, i) => String(i + 1))
            .filter(value => !used.has(value.toLowerCase()) && !blocked.has(value.toLowerCase()))
            .map(value => ({ label: value, value }));
        const options = [...existing, ...numbers];
        const typed = current.trim();
        if (typed && !options.some(option => option.value.toLowerCase() === typed.toLowerCase())) {
            return [{ label: typed, value: typed }, ...options];
        }
        return options;
    };

    const floorNameSelect = (value: string, onChange: (next: string) => void, extraTaken?: Iterable<string>) => (
        <CustomSelect
            value={value}
            onChange={onChange}
            options={floorNameOptions(value, extraTaken)}
            placeholder="Select a floor"
            allowCustom
            customEntryTitle="Custom floor"
            customEntryHint="Not listed? Type here, then Enter."
            customPlaceholder="Type floor — Enter"
            style={fieldSelectStyle}
            maxH={280}
        />
    );

    const buildingOptions = (current: string) => {
        const listed = savedBuildings.map(block => ({ label: block.name, value: block.id }));
        const typed = current.trim();
        if (typed && !savedBuildings.some(block => block.id === typed || block.name.trim().toLowerCase() === typed.toLowerCase())) {
            return [{ label: typed, value: typed }, ...listed];
        }
        return listed;
    };

    const buildingSelect = (value: string, onChange: (next: string) => void) => (
        <CustomSelect
            value={value}
            onChange={next => {
                const match = savedBuildings.find(block => block.id === next || block.name.trim().toLowerCase() === next.trim().toLowerCase());
                onChange(match ? match.id : next);
            }}
            options={buildingOptions(value)}
            placeholder="Select a building"
            allowCustom
            customEntryTitle="Custom building"
            customEntryHint="Not listed? Type here, then Enter."
            customPlaceholder="Type building — Enter"
            style={fieldSelectStyle}
            maxH={280}
        />
    );

    const floorNameField = (
        <div>
            <label style={fieldLabel}>Floor name / number</label>
            {floorNameSelect(name, setName)}
        </div>
    );

    const wardFields = (draft: WardDraft, update: (next: WardDraft) => void) => (
        <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                    <label style={fieldLabel}>Ward / unit name *</label>
                    {kind === 'edit' || unitsOnPlace.length === 0 ? (
                        <input
                            value={draft.name}
                            onChange={e => update({ ...draft, nameChoice: OTHER, name: e.target.value })}
                            placeholder="e.g. Labour & Delivery Unit"
                            style={input}
                        />
                    ) : (
                        <CustomSelect
                            value={draft.nameChoice && draft.nameChoice !== OTHER ? draft.nameChoice : draft.name}
                            onChange={value => {
                                const picked = unitsOnPlace.find(unit => unit.id === value || sameUnitName(unit.name, value));
                                update({
                                    ...draft,
                                    nameChoice: picked ? picked.id : OTHER,
                                    name: picked ? visibleUnitName(picked.name) : value,
                                });
                            }}
                            options={(() => {
                                const listed = unitsOnPlace.map(unit => ({
                                    label: visibleUnitName(unit.name),
                                    value: unit.id,
                                }));
                                const typed = draft.name.trim();
                                if (typed && !unitsOnPlace.some(unit => sameUnitName(unit.name, typed))) {
                                    return [{ label: typed, value: typed }, ...listed];
                                }
                                // Keep the closed trigger readable when value is a unit id.
                                if (
                                    draft.nameChoice
                                    && draft.nameChoice !== OTHER
                                    && typed
                                    && !listed.some(option => option.value === draft.nameChoice)
                                ) {
                                    return [{ label: typed, value: draft.nameChoice }, ...listed];
                                }
                                return listed;
                            })()}
                            placeholder="Select a unit"
                            allowCustom
                            customEntryTitle="New unit"
                            customEntryHint="Not listed? Type here, then Enter."
                            customPlaceholder="Type unit — Enter"
                            style={fieldSelectStyle}
                            maxH={240}
                        />
                    )}
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
                    <CustomSelect
                        value={draft.type}
                        onChange={type => update({ ...draft, type })}
                        options={(() => {
                            const listed = WARD_TYPES.map(type => ({ label: wardTypeLabel(type), value: type }));
                            const typed = draft.type.trim();
                            if (typed && !(WARD_TYPES as readonly string[]).includes(typed)) {
                                return [{ label: typed, value: typed }, ...listed];
                            }
                            return listed;
                        })()}
                        placeholder="Optional"
                        allowCustom
                        allowClear
                        clearLabel="No type"
                        customEntryTitle="Custom type"
                        customEntryHint="Not listed? Type here, then Enter."
                        customPlaceholder="Type a type — Enter"
                        style={fieldSelectStyle}
                        maxH={280}
                    />
                </div>
                <div>
                    <label style={fieldLabel}>Gender restriction</label>
                    <CustomSelect
                        value={draft.gender}
                        onChange={gender => {
                            const match = matchedOption(gender, GENDER_RESTRICTIONS.map(value => ({ label: genderLabel(value), value })));
                            update({ ...draft, gender: match ? match.value : gender });
                        }}
                        options={withTypedOption(
                            GENDER_RESTRICTIONS.map(value => ({ label: genderLabel(value), value })),
                            draft.gender,
                        )}
                        placeholder="Optional"
                        allowCustom
                        customEntryTitle="Custom gender"
                        customEntryHint="Not listed? Type here, then Enter."
                        customPlaceholder="Type gender — Enter"
                        style={fieldSelectStyle}
                        maxH={240}
                    />
                </div>
            </div>
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
                <CustomSelect
                    value={draft.status}
                    onChange={status => {
                        const choices = (Object.keys(BED_STATUS_META) as BedStatus[]).map(item => ({
                            label: BED_STATUS_META[item].label,
                            value: item,
                        }));
                        const match = matchedOption(status, choices);
                        if (match) update({ ...draft, status: match.value as BedStatus });
                    }}
                    options={(Object.keys(BED_STATUS_META) as BedStatus[]).map(status => ({
                        label: BED_STATUS_META[status].label,
                        value: status,
                    }))}
                    placeholder="Select a status"
                    allowCustom
                    customEntryTitle="Custom status"
                    customEntryHint="Not listed? Type here, then Enter."
                    customPlaceholder="Type status — Enter"
                    style={fieldSelectStyle}
                    maxH={240}
                />
            </div>
        </div>
    );

    const sectionShell = (key: string, title: string, onRemove: (() => void) | null, children: React.ReactNode) => (
        <div key={key} style={{ border: '1px solid #EDF1F6', borderRadius: 10, padding: 12, background: '#FBFCFE' }}>
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
                        <div>
                            <label style={fieldLabel}>Building / block *</label>
                            {buildingSelect(blockChoice === NEW ? newBlockName : blockChoice, value => {
                                const match = savedBuildings.find(block => block.id === value);
                                setBlockChoice(match ? match.id : value ? NEW : '');
                                setNewBlockName(match ? '' : value);
                                setFloorChoice('');
                                setWardChoice('');
                                setRoomChoice('');
                            })}
                        </div>
                    )}

                    {needs.floor && (
                        <div>
                            <label style={fieldLabel}>Floor *</label>
                            <CustomSelect
                                value={floorChoice === NEW ? newFloorName : floorChoice}
                                disabled={!blockChoice}
                                onChange={value => {
                                    const match = floorOptions.find(floor => floor.id === value || floor.name.trim().toLowerCase() === value.trim().toLowerCase());
                                    setFloorChoice(match ? match.id : value ? NEW : '');
                                    setNewFloorName(match ? '' : value);
                                    setWardChoice('');
                                    setRoomChoice('');
                                }}
                                options={(() => {
                                    const listed = floorOptions
                                        .filter(floor => {
                                            const key = floor.name.trim().toLowerCase();
                                            return key !== 'unassigned' && key !== 'attached units';
                                        })
                                        .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }))
                                        .map(floor => ({ label: floor.name, value: floor.id }));
                                    const used = new Set(listed.map(option => option.label.toLowerCase()));
                                    const numbers = Array.from({ length: 10 }, (_, index) => String(index + 1))
                                        .filter(value => !used.has(value))
                                        .map(value => ({ label: value, value }));
                                    return withTypedOption([...listed, ...numbers], floorChoice === NEW ? newFloorName : '');
                                })()}
                                placeholder={blockChoice ? 'Select a floor' : 'Select a building first'}
                                allowCustom
                                customEntryTitle="Custom floor"
                                customEntryHint="Not listed? Type here, then Enter."
                                customPlaceholder="Type floor — Enter"
                                style={fieldSelectStyle}
                                maxH={280}
                            />
                        </div>
                    )}

                    {needs.ward && (
                        <div>
                            <label style={fieldLabel}>Ward / unit *</label>
                            <CustomSelect
                                value={wardChoice}
                                disabled={!floorChoice || (floorChoice === NEW && !newFloorName.trim())}
                                onChange={value => {
                                    const match = matchedOption(value, wardOptions.map(option => ({ label: option.name, value: option.id })));
                                    const picked = match ? wardOptions.find(option => option.id === match.value) : undefined;
                                    setWardChoice(match ? match.value : value);
                                    setRoomChoice('');
                                    if (picked) {
                                        setBedUnitType(picked.type || '');
                                        setBedUnitGender(picked.gender_restriction || '');
                                    } else {
                                        setBedUnitGender('');
                                    }
                                }}
                                options={withTypedOption(
                                    wardOptions.map(option => ({ label: option.name, value: option.id })),
                                    wardChoice,
                                )}
                                placeholder={floorChoice && (floorChoice !== NEW || newFloorName.trim()) ? 'Select a unit' : 'Select a floor first'}
                                allowCustom
                                customEntryTitle="New unit"
                                customEntryHint="Not listed? Type here, then Enter."
                                customPlaceholder="Type unit — Enter"
                                style={fieldSelectStyle}
                                maxH={280}
                            />
                        </div>
                    )}

                    {/* Type/gender only when the unit is still being chosen or created — not when adding a bed inside a known room. */}
                    {kind === 'create' && needs.ward && (level === 'bed' || level === 'room') && (
                        <div>
                            <label style={fieldLabel}>Ward / unit type</label>
                            <CustomSelect
                                value={bedUnitType}
                                onChange={setBedUnitType}
                                options={(() => {
                                    const listed = WARD_TYPES.map(type => ({ label: wardTypeLabel(type), value: type }));
                                    const typed = bedUnitType.trim();
                                    if (typed && !(WARD_TYPES as readonly string[]).includes(typed)) {
                                        return [{ label: typed, value: typed }, ...listed];
                                    }
                                    return listed;
                                })()}
                                placeholder="Optional"
                                allowCustom
                                allowClear
                                clearLabel="No type"
                                customEntryTitle="Custom type"
                                customEntryHint="Not listed? Type here, then Enter."
                                customPlaceholder="Type a type — Enter"
                                style={fieldSelectStyle}
                                maxH={280}
                            />
                        </div>
                    )}

                    {kind === 'create' && needs.ward && (level === 'bed' || level === 'room') && (
                        <div>
                            <label style={fieldLabel}>Gender restriction{level === 'room' ? ' *' : ''}</label>
                            <CustomSelect
                                value={bedUnitGender}
                                onChange={gender => {
                                    const match = matchedOption(gender, GENDER_RESTRICTIONS.map(value => ({ label: genderLabel(value), value })));
                                    setBedUnitGender(match ? match.value : gender);
                                }}
                                options={withTypedOption(
                                    GENDER_RESTRICTIONS.map(value => ({ label: genderLabel(value), value })),
                                    bedUnitGender,
                                )}
                                placeholder={level === 'room' ? 'Select a gender' : 'Optional'}
                                allowCustom
                                customEntryTitle="Custom gender"
                                customEntryHint="Not listed? Type here, then Enter."
                                customPlaceholder="Type gender — Enter"
                                style={fieldSelectStyle}
                                maxH={240}
                            />
                        </div>
                    )}

                    {needs.room && (
                        <div>
                            <label style={fieldLabel}>Room / cubicle</label>
                            <CustomSelect
                                value={roomChoice}
                                disabled={!wardChoice && !context.wardId}
                                onChange={value => {
                                    const match = roomOptions.find(option => (
                                        option.id === value || option.number.trim().toLowerCase() === value.trim().toLowerCase()
                                    ));
                                    setRoomChoice(match ? match.id : value);
                                }}
                                options={withTypedOption(
                                    roomOptions.map(option => ({
                                        label: option.name ? `${option.number} · ${option.name}` : option.number,
                                        value: option.id,
                                    })),
                                    roomChoice,
                                )}
                                placeholder="Optional"
                                allowCustom
                                customEntryTitle="Room"
                                customEntryHint="Not listed? Type here, then Enter."
                                customPlaceholder="Type room — Enter"
                                style={fieldSelectStyle}
                                maxH={240}
                            />
                        </div>
                    )}

                    {/* The level's own fields */}
                    {level === 'block' && (
                        <div>
                            <label style={fieldLabel}>Building / block name *</label>
                            {kind === 'edit' ? (
                                <input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. Maternity Block"
                                    style={input}
                                />
                            ) : buildingSelect(name, setName)}
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
                                `floor-${index}`,
                                `Floor ${index + 1}`,
                                () => setChildFloors(prev => prev.filter((_, i) => i !== index)),
                                <div>
                                    <label style={fieldLabel}>Floor name / number</label>
                                    {floorNameSelect(
                                        floor.name,
                                        value => setChildFloors(prev => prev.map((item, i) => i === index ? { ...item, name: value } : item)),
                                        childFloors.flatMap((item, i) => i === index || !item.name.trim() ? [] : [item.name.trim().toLowerCase()]),
                                    )}
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
                                `ward-${index}`,
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
                                `room-${index}`,
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
                                `bed-${index}`,
                                `Bed ${index + (level === 'bed' ? 2 : 1)}`,
                                () => setChildBeds(prev => prev.filter((_, i) => i !== index)),
                                bedFields(draft, next => setChildBeds(prev => prev.map((item, i) => i === index ? next : item))),
                            ))}
                            {addMoreButton(
                                childBeds.length === 0 && level === 'room' ? 'Add bed' : 'Add another bed',
                                childBeds.length >= (level === 'bed' ? NESTED_LIMITS.bedsPerRoom - 1 : NESTED_LIMITS.bedsPerRoom),
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
