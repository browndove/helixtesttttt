import type { BedStatus } from '@/lib/beds';
import type { Block, Floor, GenderRestriction, HierarchyBed, Room, Ward } from '@/lib/bed-hierarchy';

/**
 * Applies edits to the sample layout in memory, so the page behaves normally
 * while the block/floor/ward/room endpoints are missing. Swapped out entirely
 * once the API answers: nothing here runs against real data.
 */

export type PreviewLevel = 'block' | 'floor' | 'ward' | 'room' | 'bed';

export type PreviewOp =
    | { kind: 'create'; level: 'block'; body: Payload }
    | { kind: 'create'; level: 'floor'; parentId: string; body: Payload }
    | { kind: 'create'; level: 'ward'; parentId: string; body: Payload }
    | { kind: 'create'; level: 'room'; parentId: string; body: Payload }
    | { kind: 'create'; level: 'bed'; parentId: string; body: Payload }
    | { kind: 'edit'; level: PreviewLevel; id: string; body: Payload }
    | { kind: 'delete'; level: PreviewLevel; id: string }
    | { kind: 'status'; id: string; status: BedStatus };

type Payload = Record<string, unknown>;

let counter = 0;
function newId(prefix: string): string {
    counter += 1;
    return `preview-${prefix}-${counter}`;
}

function text(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function rows(body: Payload, key: string): Payload[] {
    const value = body[key];
    return Array.isArray(value) ? value.filter((item): item is Payload => !!item && typeof item === 'object') : [];
}

/* ─── builders ──────────────────────────────────────────────────────── */

function makeBed(roomId: string, body: Payload, order: number): HierarchyBed {
    const status = text(body.status) as BedStatus;
    return {
        id: newId('bed'),
        room_id: roomId,
        ...(text(body.department_id) ? { department_id: text(body.department_id) } : {}),
        bed_number: text(body.bed_number) || String(order + 1),
        ...(text(body.bed_code) ? { bed_code: text(body.bed_code) } : {}),
        status: status === 'occupied' || status === 'blocked' ? status : 'available',
        sort_order: order,
        updated_at: new Date().toISOString(),
    };
}

function makeRoom(wardId: string, body: Payload, order: number): Room {
    const id = newId('room');
    return countRoom({
        id,
        ward_id: wardId,
        number: text(body.number) || String(order + 1),
        ...(text(body.name) ? { name: text(body.name) } : {}),
        sort_order: order,
        updated_at: new Date().toISOString(),
        beds: rows(body, 'beds').map((bed, index) => makeBed(id, bed, index)),
        bed_count: 0,
        available_count: 0,
        occupied_count: 0,
        blocked_count: 0,
    });
}

function makeWard(floorId: string, body: Payload, order: number): Ward {
    const id = newId('ward');
    const gender = text(body.gender_restriction) as GenderRestriction;
    return countWard({
        id,
        floor_id: floorId,
        name: text(body.name) || 'New ward',
        ...(text(body.department_id) ? { department_id: text(body.department_id) } : {}),
        ...(text(body.code) ? { code: text(body.code) } : {}),
        ...(text(body.type) ? { type: text(body.type) } : {}),
        ...(gender ? { gender_restriction: gender } : {}),
        sort_order: order,
        rooms: rows(body, 'rooms').map((room, index) => makeRoom(id, room, index)),
        room_count: 0,
        bed_count: 0,
        available_count: 0,
        occupied_count: 0,
        blocked_count: 0,
    });
}

function makeFloor(blockId: string, body: Payload, order: number): Floor {
    const id = newId('floor');
    return countFloor({
        id,
        block_id: blockId,
        name: text(body.name) || String(order + 1),
        sort_order: order,
        wards: rows(body, 'wards').map((ward, index) => makeWard(id, ward, index)),
        ward_count: 0,
        bed_count: 0,
        available_count: 0,
        occupied_count: 0,
        blocked_count: 0,
    });
}

function makeBlock(body: Payload, order: number): Block {
    const id = newId('block');
    return countBlock({
        id,
        name: text(body.name) || 'New block',
        sort_order: order,
        floors: rows(body, 'floors').map((floor, index) => makeFloor(id, floor, index)),
        floor_count: 0,
        bed_count: 0,
        available_count: 0,
        occupied_count: 0,
        blocked_count: 0,
    });
}

/* ─── counting ──────────────────────────────────────────────────────── */

function countRoom(room: Room): Room {
    return {
        ...room,
        bed_count: room.beds.length,
        available_count: room.beds.filter(bed => bed.status === 'available').length,
        occupied_count: room.beds.filter(bed => bed.status === 'occupied').length,
        blocked_count: room.beds.filter(bed => bed.status === 'blocked').length,
    };
}

function sum<T>(items: T[], pick: (item: T) => number): number {
    return items.reduce((total, item) => total + pick(item), 0);
}

function countWard(ward: Ward): Ward {
    const rooms = ward.rooms.map(countRoom);
    return {
        ...ward,
        rooms,
        room_count: rooms.length,
        bed_count: sum(rooms, room => room.bed_count),
        available_count: sum(rooms, room => room.available_count),
        occupied_count: sum(rooms, room => room.occupied_count),
        blocked_count: sum(rooms, room => room.blocked_count),
    };
}

function countFloor(floor: Floor): Floor {
    const wards = floor.wards.map(countWard);
    return {
        ...floor,
        wards,
        ward_count: wards.length,
        bed_count: sum(wards, ward => ward.bed_count),
        available_count: sum(wards, ward => ward.available_count),
        occupied_count: sum(wards, ward => ward.occupied_count),
        blocked_count: sum(wards, ward => ward.blocked_count),
    };
}

function countBlock(block: Block): Block {
    const floors = block.floors.map(countFloor);
    return {
        ...block,
        floors,
        floor_count: floors.length,
        bed_count: sum(floors, floor => floor.bed_count),
        available_count: sum(floors, floor => floor.available_count),
        occupied_count: sum(floors, floor => floor.occupied_count),
        blocked_count: sum(floors, floor => floor.blocked_count),
    };
}

/* ─── mapping helpers ───────────────────────────────────────────────── */

function mapBlocks(blocks: Block[], fn: (block: Block) => Block): Block[] {
    return blocks.map(block => countBlock(fn(block)));
}

function mapFloors(block: Block, fn: (floor: Floor) => Floor): Block {
    return { ...block, floors: block.floors.map(fn) };
}

function mapWards(floor: Floor, fn: (ward: Ward) => Ward): Floor {
    return { ...floor, wards: floor.wards.map(fn) };
}

function mapRooms(ward: Ward, fn: (room: Room) => Room): Ward {
    return { ...ward, rooms: ward.rooms.map(fn) };
}

function everyWard(blocks: Block[], fn: (ward: Ward) => Ward): Block[] {
    return mapBlocks(blocks, block => mapFloors(block, floor => mapWards(floor, fn)));
}

function everyRoom(blocks: Block[], fn: (room: Room) => Room): Block[] {
    return everyWard(blocks, ward => mapRooms(ward, fn));
}

/* ─── apply ─────────────────────────────────────────────────────────── */

export function applyPreviewOp(blocks: Block[], op: PreviewOp): Block[] {
    if (op.kind === 'create') {
        switch (op.level) {
            case 'block':
                return [...blocks, makeBlock(op.body, blocks.length)];
            case 'floor':
                return mapBlocks(blocks, block => (
                    block.id === op.parentId
                        ? { ...block, floors: [...block.floors, makeFloor(block.id, op.body, block.floors.length)] }
                        : block
                ));
            case 'ward':
                return mapBlocks(blocks, block => mapFloors(block, floor => (
                    floor.id === op.parentId
                        ? { ...floor, wards: [...floor.wards, makeWard(floor.id, op.body, floor.wards.length)] }
                        : floor
                )));
            case 'room':
                return everyWard(blocks, ward => (
                    ward.id === op.parentId
                        ? { ...ward, rooms: [...ward.rooms, makeRoom(ward.id, op.body, ward.rooms.length)] }
                        : ward
                ));
            case 'bed':
                return everyRoom(blocks, room => {
                    if (room.id !== op.parentId) return room;
                    const incoming = rows(op.body, 'beds');
                    const list = incoming.length ? incoming : [op.body];
                    return {
                        ...room,
                        updated_at: new Date().toISOString(),
                        beds: [...room.beds, ...list.map((bed, index) => makeBed(room.id, bed, room.beds.length + index))],
                    };
                });
        }
    }

    if (op.kind === 'status') {
        return everyRoom(blocks, room => (
            room.beds.some(bed => bed.id === op.id)
                ? {
                    ...room,
                    updated_at: new Date().toISOString(),
                    beds: room.beds.map(bed => bed.id === op.id ? { ...bed, status: op.status } : bed),
                }
                : room
        ));
    }

    if (op.kind === 'delete') {
        switch (op.level) {
            case 'block': {
                const block = blocks.find(item => item.id === op.id);
                if (block?.floors.length) throw new Error(`${block.name} still has floors.`);
                return blocks.filter(item => item.id !== op.id);
            }
            case 'floor': {
                const floor = blocks.flatMap(block => block.floors).find(item => item.id === op.id);
                if (floor?.wards.length) throw new Error(`${floor.name} still has wards.`);
                return mapBlocks(blocks, block => ({ ...block, floors: block.floors.filter(item => item.id !== op.id) }));
            }
            case 'ward': {
                const ward = blocks.flatMap(block => block.floors.flatMap(floor => floor.wards)).find(item => item.id === op.id);
                if (ward?.rooms.length) throw new Error(`${ward.name} still has rooms.`);
                return mapBlocks(blocks, block => mapFloors(block, floor => ({
                    ...floor,
                    wards: floor.wards.filter(item => item.id !== op.id),
                })));
            }
            case 'room': {
                const room = blocks.flatMap(block => block.floors.flatMap(floor => floor.wards.flatMap(ward => ward.rooms))).find(item => item.id === op.id);
                if (room?.beds.length) throw new Error(`Room ${room.number} still has beds.`);
                return everyWard(blocks, ward => ({ ...ward, rooms: ward.rooms.filter(item => item.id !== op.id) }));
            }
            case 'bed': {
                const bed = blocks.flatMap(block => block.floors.flatMap(floor => floor.wards.flatMap(ward => ward.rooms.flatMap(room => room.beds)))).find(item => item.id === op.id);
                if (bed?.status === 'occupied') throw new Error(`Bed ${bed.bed_number} is occupied.`);
                return everyRoom(blocks, room => ({ ...room, beds: room.beds.filter(item => item.id !== op.id) }));
            }
        }
    }

    const { body, id } = op;
    switch (op.level) {
        case 'block':
            return mapBlocks(blocks, block => block.id === id ? { ...block, name: text(body.name) || block.name } : block);
        case 'floor':
            return mapBlocks(blocks, block => mapFloors(block, floor => (
                floor.id === id ? { ...floor, name: text(body.name) || floor.name } : floor
            )));
        case 'ward': {
            const nextFloorId = text(body.floor_id);
            let moved: Ward | null = null;
            const updated = mapBlocks(blocks, block => mapFloors(block, floor => {
                const current = floor.wards.find(ward => ward.id === id);
                if (!current) return floor;
                const gender = text(body.gender_restriction) as GenderRestriction;
                const next: Ward = {
                    ...current,
                    name: text(body.name) || current.name,
                    code: text(body.code) || undefined,
                    type: text(body.type) || undefined,
                    gender_restriction: gender || undefined,
                    department_id: text(body.department_id) || current.department_id,
                    floor_id: nextFloorId || current.floor_id,
                };
                if (nextFloorId && nextFloorId !== floor.id) {
                    moved = next;
                    return { ...floor, wards: floor.wards.filter(ward => ward.id !== id) };
                }
                return { ...floor, wards: floor.wards.map(ward => ward.id === id ? next : ward) };
            }));
            if (!moved || !nextFloorId) return updated;
            const placed = moved;
            return mapBlocks(updated, block => mapFloors(block, floor => (
                floor.id === nextFloorId ? { ...floor, wards: [...floor.wards, placed] } : floor
            )));
        }
        case 'room':
            return everyRoom(blocks, room => (
                room.id === id
                    ? {
                        ...room,
                        number: text(body.number) || room.number,
                        name: text(body.name) || undefined,
                        updated_at: new Date().toISOString(),
                    }
                    : room
            ));
        case 'bed':
            return everyRoom(blocks, room => (
                room.beds.some(bed => bed.id === id)
                    ? {
                        ...room,
                        updated_at: new Date().toISOString(),
                        beds: room.beds.map(bed => {
                            if (bed.id !== id) return bed;
                            const status = text(body.status) as BedStatus;
                            return {
                                ...bed,
                                bed_number: text(body.bed_number) || bed.bed_number,
                                bed_code: text(body.bed_code) || undefined,
                                status: status || bed.status,
                                department_id: text(body.department_id) || bed.department_id,
                            };
                        }),
                    }
                    : room
            ));
    }
}
