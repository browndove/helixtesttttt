import type { BedStatus } from '@/lib/beds';

/**
 * Block → Floor → Ward → Room → Bed, per BED_MANAGEMENT_API_CONTRACT.md.
 * The backend does not serve these resources yet, so every parser tolerates
 * missing aggregates and missing embedded children.
 */

export const WARD_TYPES = [
    'general',
    'emergency',
    'icu',
    'maternity',
    'labour',
    'nicu',
    'paediatric',
    'isolation',
    'recovery',
    'private',
    'psychiatric',
    'surgical',
] as const;

export type WardType = (typeof WARD_TYPES)[number];

export const GENDER_RESTRICTIONS = ['male', 'female', 'mixed'] as const;

export type GenderRestriction = (typeof GENDER_RESTRICTIONS)[number];

/** Max children the spec allows inside a single create form. */
export const NESTED_LIMITS = {
    floorsPerBlock: 5,
    wardsPerFloor: 3,
    roomsPerWard: 6,
    bedsPerRoom: 50,
} as const;

export type BedCounts = {
    bed_count: number;
    available_count: number;
    occupied_count: number;
    blocked_count: number;
};

export type HierarchyBed = {
    id: string;
    room_id: string;
    bed_number: string;
    bed_code?: string;
    status: BedStatus;
    occupied_patient_id?: string | null;
    sort_order: number;
    updated_at?: string;
    updated_by?: { id: string; name: string };
};

export type Room = BedCounts & {
    id: string;
    ward_id: string;
    ward_name?: string;
    floor_name?: string;
    block_name?: string;
    number: string;
    name?: string;
    sort_order: number;
    updated_at?: string;
    beds: HierarchyBed[];
};

export type Ward = BedCounts & {
    id: string;
    floor_id: string;
    floor_name?: string;
    block_id?: string;
    block_name?: string;
    department_id?: string;
    name: string;
    code?: string;
    type?: string;
    gender_restriction?: GenderRestriction;
    room_count: number;
    sort_order: number;
    rooms: Room[];
};

export type Floor = BedCounts & {
    id: string;
    block_id: string;
    block_name?: string;
    name: string;
    ward_count: number;
    sort_order: number;
    wards: Ward[];
};

export type Block = BedCounts & {
    id: string;
    facility_id?: string;
    name: string;
    floor_count: number;
    sort_order: number;
    floors: Floor[];
};

/* ─── parsing helpers ───────────────────────────────────────────────── */

function str(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function optionalStr(value: unknown): string | undefined {
    const trimmed = str(value);
    return trimmed || undefined;
}

function int(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function list(raw: unknown, key: string): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') {
        const nested = (raw as Record<string, unknown>)[key];
        if (Array.isArray(nested)) return nested;
        const data = (raw as Record<string, unknown>).data;
        if (Array.isArray(data)) return data;
        if (data && typeof data === 'object') {
            const inner = (data as Record<string, unknown>)[key];
            if (Array.isArray(inner)) return inner;
        }
    }
    return [];
}

function bySort<T extends { sort_order: number }>(items: T[], label: (item: T) => string): T[] {
    return [...items].sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return label(a).localeCompare(label(b), undefined, { numeric: true, sensitivity: 'base' });
    });
}

function bedStatus(value: unknown): BedStatus {
    const raw = str(value).toLowerCase();
    if (raw === 'available' || raw === 'occupied' || raw === 'blocked') return raw;
    return 'available';
}

/**
 * Rolls counts up from children when the backend omits the aggregates. The
 * contract asks for them on list responses; this keeps the UI honest until then.
 */
function countsFrom(rec: Record<string, unknown>, children: BedCounts[], beds?: HierarchyBed[]): BedCounts {
    if (beds?.length) {
        return {
            bed_count: beds.length,
            available_count: beds.filter(bed => bed.status === 'available').length,
            occupied_count: beds.filter(bed => bed.status === 'occupied').length,
            blocked_count: beds.filter(bed => bed.status === 'blocked').length,
        };
    }
    if (children.length) {
        return {
            bed_count: children.reduce((sum, child) => sum + child.bed_count, 0),
            available_count: children.reduce((sum, child) => sum + child.available_count, 0),
            occupied_count: children.reduce((sum, child) => sum + child.occupied_count, 0),
            blocked_count: children.reduce((sum, child) => sum + child.blocked_count, 0),
        };
    }
    return {
        bed_count: int(rec.bed_count ?? rec.total_beds ?? rec.total),
        available_count: int(rec.available_count ?? rec.available),
        occupied_count: int(rec.occupied_count ?? rec.occupied),
        blocked_count: int(rec.blocked_count ?? rec.blocked),
    };
}

/* ─── parsers ───────────────────────────────────────────────────────── */

export function parseBed(raw: unknown): HierarchyBed | null {
    if (!raw || typeof raw !== 'object') return null;
    const rec = raw as Record<string, unknown>;
    const id = str(rec.id);
    const bedNumber = str(rec.bed_number ?? rec.number);
    if (!id || !bedNumber) return null;
    return {
        id,
        room_id: str(rec.room_id),
        bed_number: bedNumber,
        ...(optionalStr(rec.bed_code ?? rec.code) ? { bed_code: str(rec.bed_code ?? rec.code) } : {}),
        status: bedStatus(rec.status),
        ...(rec.occupied_patient_id != null ? { occupied_patient_id: str(rec.occupied_patient_id) || null } : {}),
        sort_order: int(rec.sort_order),
        ...(optionalStr(rec.updated_at) ? { updated_at: str(rec.updated_at) } : {}),
        ...(rec.updated_by && typeof rec.updated_by === 'object'
            ? {
                updated_by: {
                    id: str((rec.updated_by as Record<string, unknown>).id),
                    name: str((rec.updated_by as Record<string, unknown>).name),
                },
            }
            : {}),
    };
}

export function parseBeds(raw: unknown): HierarchyBed[] {
    return bySort(
        list(raw, 'beds').flatMap(item => {
            const bed = parseBed(item);
            return bed ? [bed] : [];
        }),
        bed => bed.bed_number,
    );
}

export function parseRoom(raw: unknown): Room | null {
    if (!raw || typeof raw !== 'object') return null;
    const rec = raw as Record<string, unknown>;
    const id = str(rec.id);
    const number = str(rec.number ?? rec.room_number);
    if (!id || !number) return null;
    const beds = parseBeds(rec.beds);
    return {
        id,
        ward_id: str(rec.ward_id ?? rec.unit_id),
        ...(optionalStr(rec.ward_name) ? { ward_name: str(rec.ward_name) } : {}),
        ...(optionalStr(rec.floor_name) ? { floor_name: str(rec.floor_name) } : {}),
        ...(optionalStr(rec.block_name) ? { block_name: str(rec.block_name) } : {}),
        number,
        ...(optionalStr(rec.name) ? { name: str(rec.name) } : {}),
        sort_order: int(rec.sort_order),
        ...(optionalStr(rec.updated_at) ? { updated_at: str(rec.updated_at) } : {}),
        beds,
        ...countsFrom(rec, [], beds.length ? beds : undefined),
    };
}

export function parseRooms(raw: unknown): Room[] {
    return bySort(
        list(raw, 'rooms').flatMap(item => {
            const room = parseRoom(item);
            return room ? [room] : [];
        }),
        room => room.number,
    );
}

export function parseWard(raw: unknown): Ward | null {
    if (!raw || typeof raw !== 'object') return null;
    const rec = raw as Record<string, unknown>;
    const id = str(rec.id);
    const name = str(rec.name);
    if (!id || !name) return null;
    const rooms = parseRooms(rec.rooms);
    const gender = str(rec.gender_restriction).toLowerCase();
    return {
        id,
        floor_id: str(rec.floor_id),
        ...(optionalStr(rec.floor_name) ? { floor_name: str(rec.floor_name) } : {}),
        ...(optionalStr(rec.block_id) ? { block_id: str(rec.block_id) } : {}),
        ...(optionalStr(rec.block_name) ? { block_name: str(rec.block_name) } : {}),
        ...(optionalStr(rec.department_id) ? { department_id: str(rec.department_id) } : {}),
        name,
        ...(optionalStr(rec.code) ? { code: str(rec.code) } : {}),
        ...(optionalStr(rec.type) ? { type: str(rec.type) } : {}),
        ...(GENDER_RESTRICTIONS.includes(gender as GenderRestriction)
            ? { gender_restriction: gender as GenderRestriction }
            : {}),
        room_count: rooms.length || int(rec.room_count),
        sort_order: int(rec.sort_order),
        rooms,
        ...countsFrom(rec, rooms),
    };
}

export function parseWards(raw: unknown): Ward[] {
    return bySort(
        list(raw, 'wards').flatMap(item => {
            const ward = parseWard(item);
            return ward ? [ward] : [];
        }),
        ward => ward.name,
    );
}

export function parseFloor(raw: unknown): Floor | null {
    if (!raw || typeof raw !== 'object') return null;
    const rec = raw as Record<string, unknown>;
    const id = str(rec.id);
    if (!id) return null;
    const wards = parseWards(rec.wards);
    return {
        id,
        block_id: str(rec.block_id),
        ...(optionalStr(rec.block_name) ? { block_name: str(rec.block_name) } : {}),
        name: str(rec.name) || 'Unnamed floor',
        ward_count: wards.length || int(rec.ward_count),
        sort_order: int(rec.sort_order),
        wards,
        ...countsFrom(rec, wards),
    };
}

export function parseFloors(raw: unknown): Floor[] {
    return bySort(
        list(raw, 'floors').flatMap(item => {
            const floor = parseFloor(item);
            return floor ? [floor] : [];
        }),
        floor => floor.name,
    );
}

export function parseBlock(raw: unknown): Block | null {
    if (!raw || typeof raw !== 'object') return null;
    const rec = raw as Record<string, unknown>;
    const id = str(rec.id);
    const name = str(rec.name);
    if (!id || !name) return null;
    const floors = parseFloors(rec.floors);
    return {
        id,
        ...(optionalStr(rec.facility_id) ? { facility_id: str(rec.facility_id) } : {}),
        name,
        floor_count: floors.length || int(rec.floor_count),
        sort_order: int(rec.sort_order),
        floors,
        ...countsFrom(rec, floors),
    };
}

export function parseBlocks(raw: unknown): Block[] {
    return bySort(
        list(raw, 'blocks').flatMap(item => {
            const block = parseBlock(item);
            return block ? [block] : [];
        }),
        block => block.name,
    );
}

/** Reads the `{ status, message, code }` envelope, falling back to older shapes. */
export function hierarchyApiMessage(raw: unknown, fallback: string): string {
    if (!raw || typeof raw !== 'object') return fallback;
    const rec = raw as Record<string, unknown>;
    const message = rec.message ?? rec.error ?? rec.detail ?? rec.details;
    return typeof message === 'string' && message.trim() ? message.trim() : fallback;
}

export function wardTypeLabel(type?: string): string {
    if (!type) return '';
    const known: Partial<Record<WardType, string>> = {
        icu: 'ICU',
        nicu: 'NICU',
    };
    if ((WARD_TYPES as readonly string[]).includes(type)) {
        return known[type as WardType] || type.charAt(0).toUpperCase() + type.slice(1);
    }
    return type;
}

export function genderLabel(value?: GenderRestriction): string {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
}
