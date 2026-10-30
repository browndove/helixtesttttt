import { optionalFromApi, parseRooms, type Room } from '@/lib/bed-hierarchy';

export type CareUnitFloor = {
    id: string;
    unit_id: string;
    name: string;
    description?: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
};

export type CareUnit = {
    id: string;
    name: string;
    description?: string;
    code?: string;
    department_id?: string;
    department_name?: string;
    block_id?: string;
    block_name?: string;
    floor_id?: string;
    floor_name?: string;
    gender_restriction?: string;
    type?: string;
    facility_id?: string;
    patient_count?: number;
    room_count: number;
    /** Total mapped beds (API `total`). */
    bed_count: number;
    available_count: number;
    occupied_count: number;
    blocked_count: number;
    occupancy_percent?: number;
    capacity_level?: string;
    capacity_color?: string;
    capacity_label?: string;
    rooms: Room[];
    floor_count: number;
    floors: CareUnitFloor[];
    created_at?: string;
};

function sortFloors(floors: CareUnitFloor[]): CareUnitFloor[] {
    return [...floors].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

function int(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

export function parseCareUnitFloor(raw: unknown): CareUnitFloor | null {
    if (!raw || typeof raw !== 'object') return null;
    const rec = raw as Record<string, unknown>;
    const id = String(rec.id || '').trim();
    const unitId = String(rec.unit_id || '').trim();
    const name = String(rec.name || '').trim();
    if (!id || !name) return null;
    const description = typeof rec.description === 'string' ? rec.description.trim() : '';
    const sortOrder = Number(rec.sort_order);
    return {
        id,
        unit_id: unitId,
        name,
        ...(description ? { description } : {}),
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
        created_at: String(rec.created_at || ''),
        updated_at: String(rec.updated_at || ''),
    };
}

export function parseCareUnitFloors(raw: unknown): CareUnitFloor[] {
    const list = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === 'object' && Array.isArray((raw as { floors?: unknown }).floors)
            ? (raw as { floors: unknown[] }).floors
            : []);
    return sortFloors(list.flatMap(item => {
        const floor = parseCareUnitFloor(item);
        return floor ? [floor] : [];
    }));
}

export function parseCareUnit(raw: unknown): CareUnit | null {
    if (!raw || typeof raw !== 'object') return null;
    const rec = raw as Record<string, unknown>;
    const id = String(rec.id || '').trim();
    const name = String(rec.name || '').trim();
    if (!id || !name) return null;
    const floors = parseCareUnitFloors(rec.floors);
    const rooms = parseRooms(rec.rooms);
    const departmentId = String(rec.department_id || '').trim();
    const departmentName = String(rec.department_name || '').trim();
    const blockId = String(rec.block_id || '').trim();
    const blockName = String(rec.block_name || '').trim();
    const floorId = String(rec.floor_id || '').trim();
    const floorName = String(rec.floor_name || '').trim();
    const gender = String(rec.gender_restriction || '').trim().toLowerCase();
    const type = optionalFromApi(typeof rec.type === 'string' ? rec.type : '');
    const code = optionalFromApi(typeof rec.code === 'string' ? rec.code : '');
    const description = typeof rec.description === 'string' ? rec.description : '';
    const facilityId = String(rec.facility_id || '').trim();
    const createdAt = String(rec.created_at || '');
    const patientCount = Number(rec.patient_count);
    const capacityLevel = String(rec.capacity_level || '').trim();
    const capacityColor = String(rec.capacity_color || '').trim();
    const capacityLabel = String(rec.capacity_label || '').trim();
    const occupancyPercent = Number(rec.occupancy_percent);

    const bedCount = int(rec.total ?? rec.bed_count ?? rec.total_beds);
    const availableCount = int(rec.available ?? rec.available_count);
    const occupiedCount = int(rec.occupied ?? rec.occupied_count);
    const blockedCount = int(rec.blocked ?? rec.blocked_count);
    const roomCount = rooms.length || int(rec.room_count);

    return {
        id,
        name,
        ...(description ? { description } : {}),
        ...(code ? { code } : {}),
        ...(departmentId ? { department_id: departmentId } : {}),
        ...(departmentName ? { department_name: departmentName } : {}),
        ...(blockId ? { block_id: blockId } : {}),
        ...(blockName ? { block_name: blockName } : {}),
        ...(floorId ? { floor_id: floorId } : {}),
        ...(floorName ? { floor_name: floorName } : {}),
        ...(gender === 'male' || gender === 'female' || gender === 'mixed' ? { gender_restriction: gender } : {}),
        ...(type ? { type } : {}),
        ...(facilityId ? { facility_id: facilityId } : {}),
        ...(Number.isFinite(patientCount) ? { patient_count: patientCount } : {}),
        room_count: roomCount,
        bed_count: bedCount || rooms.reduce((sum, room) => sum + room.bed_count, 0),
        available_count: availableCount || rooms.reduce((sum, room) => sum + room.available_count, 0),
        occupied_count: occupiedCount || rooms.reduce((sum, room) => sum + room.occupied_count, 0),
        blocked_count: blockedCount || rooms.reduce((sum, room) => sum + room.blocked_count, 0),
        ...(Number.isFinite(occupancyPercent) ? { occupancy_percent: occupancyPercent } : {}),
        ...(capacityLevel ? { capacity_level: capacityLevel } : {}),
        ...(capacityColor ? { capacity_color: capacityColor } : {}),
        ...(capacityLabel ? { capacity_label: capacityLabel } : {}),
        rooms,
        floor_count: floors.length,
        floors,
        ...(createdAt ? { created_at: createdAt } : {}),
    };
}

export function parseCareUnits(raw: unknown): CareUnit[] {
    const list = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === 'object' && Array.isArray((raw as { units?: unknown }).units)
            ? (raw as { units: unknown[] }).units
            : []);
    return list.flatMap(item => {
        const unit = parseCareUnit(item);
        return unit ? [unit] : [];
    });
}

export function careUnitApiMessage(raw: unknown, fallback: string): string {
    if (!raw || typeof raw !== 'object') return fallback;
    const rec = raw as Record<string, unknown>;
    const message = rec.message || rec.error || rec.detail;
    return typeof message === 'string' && message.trim() ? message : fallback;
}

export function unitIsUnmapped(unit: Pick<CareUnit, 'capacity_level' | 'rooms' | 'bed_count'>): boolean {
    if (String(unit.capacity_level || '').toLowerCase() === 'unmapped') return true;
    return (unit.rooms?.length || 0) === 0 && (unit.bed_count || 0) === 0;
}

/**
 * API capacity_label can lag thresholds (e.g. "almost full" at 100%). Prefer occupancy.
 */
export function unitCapacityLabel(
    unit: Pick<CareUnit, 'capacity_label' | 'occupancy_percent' | 'available_count' | 'bed_count' | 'occupied_count'>,
): string {
    const raw = String(unit.capacity_label || '').trim();
    const pct = typeof unit.occupancy_percent === 'number' && Number.isFinite(unit.occupancy_percent)
        ? unit.occupancy_percent
        : undefined;
    const beds = unit.bed_count || 0;
    const available = unit.available_count;
    const occupied = unit.occupied_count || 0;
    const isFull = (pct !== undefined && pct >= 100)
        || (beds > 0 && typeof available === 'number' && available === 0 && occupied >= beds);

    if (isFull) {
        if (!raw) return 'Critical — full';
        return raw
            .replace(/\balmost\s+full\b/gi, 'full')
            .replace(/\bnear(?:ly)?\s+full\b/gi, 'full')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }
    return raw;
}
