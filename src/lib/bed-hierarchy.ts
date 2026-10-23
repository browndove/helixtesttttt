import type { BedStatus } from '@/lib/beds';

/**
 * Block → floor → unit (ward) → room → bed.
 * Hierarchy wards are /units. /floors/{id}/wards is the list/create alias.
 * /wards/{id} is the old department-ward API and is not used here.
 * Department is not part of this hierarchy — do not send department_id on create/edit.
 * Unit type is an open string. Bed status is available | occupied | blocked.
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
    department_id?: string;
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
    updated_at?: string;
    floor_id: string;
    floor_name?: string;
    block_id?: string;
    block_name?: string;
    department_id?: string;
    department_name?: string;
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
    updated_at?: string;
    block_id: string;
    block_name?: string;
    name: string;
    ward_count: number;
    sort_order: number;
    wards: Ward[];
};

export type Block = BedCounts & {
    id: string;
    updated_at?: string;
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
        ...(optionalStr(rec.department_id) ? { department_id: str(rec.department_id) } : {}),
        bed_number: bedNumber,
        ...(!isClearedOptional(optionalStr(rec.bed_code ?? rec.code))
            ? { bed_code: str(rec.bed_code ?? rec.code) }
            : {}),
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
    // The rooms table stores the cubicle number in `name`. The API returns that as `number`.
    // Older payloads only have `name`. `label` is not a room field.
    const number = str(rec.number ?? rec.room_number) || str(rec.name);
    if (!id || !number) return null;
    const displayName = str(rec.name);
    const beds = parseBeds(rec.beds);
    return {
        id,
        ward_id: str(rec.ward_id ?? rec.unit_id),
        ...(optionalStr(rec.ward_name) ? { ward_name: str(rec.ward_name) } : {}),
        ...(optionalStr(rec.floor_name) ? { floor_name: str(rec.floor_name) } : {}),
        ...(optionalStr(rec.block_name) ? { block_name: str(rec.block_name) } : {}),
        number,
        ...(displayName && displayName !== number ? { name: displayName } : {}),
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
        ...(optionalStr(rec.department_name) ? { department_name: str(rec.department_name) } : {}),
        name,
        ...(!isClearedOptional(optionalStr(rec.code)) ? { code: str(rec.code) } : {}),
        ...(!isClearedOptional(optionalStr(rec.type)) ? { type: str(rec.type) } : {}),
        ...(GENDER_RESTRICTIONS.includes(gender as GenderRestriction)
            ? { gender_restriction: gender as GenderRestriction }
            : {}),
        room_count: rooms.length || int(rec.room_count),
        sort_order: int(rec.sort_order),
        rooms,
        ...(optionalStr(rec.updated_at) ? { updated_at: str(rec.updated_at) } : {}),
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
        ...(optionalStr(rec.updated_at) ? { updated_at: str(rec.updated_at) } : {}),
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
        ...(optionalStr(rec.updated_at) ? { updated_at: str(rec.updated_at) } : {}),
        ...countsFrom(rec, floors),
    };
}

/** Newest timestamp in a subtree, for the tables' "last modified" column. */
export function lastModified(node: { updated_at?: string; rooms?: Room[]; wards?: Ward[]; floors?: Floor[] }): string {
    const candidates: string[] = node.updated_at ? [node.updated_at] : [];
    for (const room of node.rooms || []) {
        if (room.updated_at) candidates.push(room.updated_at);
    }
    for (const ward of node.wards || []) {
        const nested = lastModified(ward);
        if (nested) candidates.push(nested);
    }
    for (const floor of node.floors || []) {
        const nested = lastModified(floor);
        if (nested) candidates.push(nested);
    }
    return candidates.sort().at(-1) || '';
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

const OCCUPIED_BEDS_FALLBACK =
    'Can’t delete this location. Some beds are occupied. Free those beds first.';

export type HierarchyDeleteContext = {
    level?: 'block' | 'floor' | 'ward' | 'room' | 'bed';
    label?: string;
    /** Known occupied count from the tree (helps when the API only names the first bed). */
    occupiedCount?: number;
};

type OccupiedPlace = {
    building?: string;
    floor?: string;
    unit?: string;
    room?: string;
    bed?: string;
};

/** Drop a duplicated type word the API prefixes onto a name that already includes it. */
function stripTypePrefix(value: string, typeWord: string): string {
    const trimmed = value.trim();
    const re = new RegExp(`^${typeWord}\\s+`, 'i');
    return trimmed.replace(re, '').trim() || trimmed;
}

function formatDeleteTarget(level: HierarchyDeleteContext['level'], label: string): string {
    const name = label.trim();
    if (!name) return 'this location';
    switch (level) {
        case 'bed': {
            const num = stripTypePrefix(name.replace(/^Bed\s+/i, ''), 'Bed');
            return `Bed ${num}`;
        }
        case 'room': {
            const room = stripTypePrefix(name, 'Room');
            return /^Room\b/i.test(name) ? name : `Room ${room}`;
        }
        case 'ward':
            // Use the unit name as stored — do not prefix "Unit".
            return stripTypePrefix(name, 'Unit');
        case 'floor': {
            const floor = stripTypePrefix(name, 'Floor');
            return /^Floor\b/i.test(name) ? name : `Floor ${floor}`;
        }
        case 'block': {
            const building = stripTypePrefix(name, 'Building');
            return /^Building\b/i.test(name) ? name : `Building ${building}`;
        }
        default:
            return name;
    }
}

/** Tidy the "in …" scope from the new multi-bed occupied_beds copy. */
function polishOccupiedScope(scope: string): string {
    return scope
        // Drop API "Unit " prefixes without touching names that end in Unit.
        .replace(/(^|,\s*|;?\s*\([a-z]\)\s*)Unit\s+/gi, '$1')
        .replace(/\bbuilding\b/gi, 'Building')
        .replace(/\bfloor\b/gi, 'Floor')
        .replace(/\broom\b/gi, 'Room')
        .replace(/\s*-\s*/g, ' — ')
        // Letter groups: ", (b)" or "C (c)" → "; (b)" / "C; (c)"
        .replace(/,\s*\(([a-z])\)/gi, '; ($1)')
        .replace(/([^;—\s])\s+\(([a-z])\)/gi, '$1; ($2)')
        .replace(/\)\s*(?=[A-Za-z])/g, ') ')
        .replace(/;\s*;+/g, ';')
        .replace(/^[\s;—]+/, '')
        .replace(/,\s*/g, ', ')
        .replace(/;\s*/g, '; ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * New API shape:
 * "Some beds in Room A are occupied. Please free up all beds before deleting."
 * "Some beds in Male Ward, Room A & B are occupied…"
 * "Some bed(s) in Floor 1 - (a) Male Ward Room A, Room B; (b)Female ward Room D are occupied…"
 */
function parseMultiOccupiedScope(text: string): string | null {
    const match = text.match(/Some beds?(?:\(s\))? in (.+?)\s+are occupied/i);
    if (!match?.[1]) return null;
    return polishOccupiedScope(match[1]);
}

/** Legacy single-bed copy: "… Room A, bed 02 is occupied. Free it before deleting." */
export function parseOccupiedBedsMessage(text: string): OccupiedPlace | null {
    const head = text
        .replace(/\s*Please\s+free(?:\s+up)?\s+all\s+beds?\s+before\s+deleting\.?\s*$/i, '')
        .replace(/\s*Free it before deleting\.?\s*$/i, '')
        .replace(/\s*is occupied\.?\s*$/i, '')
        .replace(/\s*are occupied\.?\s*$/i, '')
        .trim();
    if (!head) return null;

    const place: OccupiedPlace = {};
    const bedMatch = head.match(/,\s*bed\s+(.+)$/i) || head.match(/\s+bed\s+(.+)$/i);
    if (!bedMatch || bedMatch.index == null) return null;
    place.bed = bedMatch[1].trim();
    const before = head.slice(0, bedMatch.index).trim();

    if (/^Room\s+/i.test(before) && !before.includes(',')) {
        place.room = stripTypePrefix(before, 'Room');
        return place;
    }

    for (const part of before.split(',').map(item => item.trim()).filter(Boolean)) {
        if (/^Building\s+/i.test(part)) place.building = stripTypePrefix(part, 'Building');
        else if (/^Floor\s+/i.test(part)) place.floor = stripTypePrefix(part, 'Floor');
        else if (/^Unit\s+/i.test(part)) place.unit = stripTypePrefix(part, 'Unit');
        else if (/^Room\s+/i.test(part)) place.room = stripTypePrefix(part, 'Room');
    }
    return place.bed ? place : null;
}

function occupiedLocationPhrase(place: OccupiedPlace): string {
    const bed = place.bed ? `Bed ${place.bed}` : 'A bed';
    if (place.room) {
        const nest = [
            place.unit,
            place.floor ? `Floor ${place.floor}` : '',
            place.building ? `Building ${place.building}` : '',
        ].filter(Boolean);
        return nest.length
            ? `${bed} in Room ${place.room} (${nest.join(', ')})`
            : `${bed} in Room ${place.room}`;
    }
    const nest = [
        place.unit,
        place.floor ? `Floor ${place.floor}` : '',
        place.building ? `Building ${place.building}` : '',
    ].filter(Boolean);
    return nest.length ? `${bed} in ${nest.join(', ')}` : bed;
}

/** Rewrite occupied_beds copy: outcome first, clear place, bed-focused next step. */
export function formatOccupiedBedsMessage(
    text: string,
    context?: HierarchyDeleteContext,
): string {
    const target = formatDeleteTarget(context?.level, context?.label || '');
    const freeBeds = 'Free those beds first.';

    const multiScope = parseMultiOccupiedScope(text);
    if (multiScope) {
        // Deleting a room: scope is usually just that room — don't repeat it.
        if (context?.level === 'room') {
            return `Can’t delete ${target}. Some beds are occupied. ${freeBeds}`;
        }
        // Drop a leading copy of the delete target ("Male Ward, Room A" → "Room A").
        const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const label = (context?.label || '').trim();
        const patterns = [
            target,
            label,
            label ? `Building ${label}` : '',
            label ? `${label} Building` : '',
            label ? `Floor ${label}` : '',
        ].filter(Boolean);
        let scope = multiScope;
        for (const pattern of patterns) {
            const next = scope
                .replace(new RegExp(`^${escape(pattern)}\\s*[,—-]\\s*`, 'i'), '')
                .replace(new RegExp(`^${escape(pattern)}$`, 'i'), '')
                .trim();
            if (next && next !== scope) {
                scope = next;
                break;
            }
        }
        return `Can’t delete ${target}. Some beds in ${scope || multiScope} are occupied. ${freeBeds}`;
    }

    const place = parseOccupiedBedsMessage(text);
    if (!place) {
        return `Can’t delete ${target}. Some beds are occupied. ${freeBeds}`;
    }
    const action = place.bed ? `Free Bed ${place.bed} first.` : freeBeds;
    return `Can’t delete ${target}. ${occupiedLocationPhrase(place)} is occupied. ${action}`;
}

/** Reads the `{ status, message, code }` envelope, falling back to older shapes. */
export function hierarchyApiMessage(
    raw: unknown,
    fallback: string,
    context?: HierarchyDeleteContext,
): string {
    if (!raw || typeof raw !== 'object') return fallback;
    const rec = raw as Record<string, unknown>;
    const reason = String(rec.reason || '').trim().toLowerCase();
    const message = rec.message ?? rec.error ?? rec.detail ?? rec.details;
    const text = typeof message === 'string' ? message.trim() : '';

    if (reason === 'occupied_beds') {
        return text ? formatOccupiedBedsMessage(text, context) : OCCUPIED_BEDS_FALLBACK;
    }
    if (reason === 'has_children') {
        return text || 'This still has child locations. Delete with contents, or remove the children first.';
    }
    if (text) {
        // Never surface raw endpoint paths from the hierarchy APIs.
        if (/still has rooms|\/units\/\{?id\}?\/(reassign|contents)/i.test(text)) {
            return 'This unit still has rooms or beds. Free any occupied beds first, then try deleting again.';
        }
        if (/\/floors\/\{?id\}?\/(reassign|contents)|\/blocks\/\{?id\}?\/(reassign|contents)/i.test(text)) {
            return OCCUPIED_BEDS_FALLBACK;
        }
        if (/occupied/i.test(text) && /bed/i.test(text)) {
            return formatOccupiedBedsMessage(text, context);
        }
        // Gateway/HTML bodies used to surface as "Backend returned invalid response".
        if (/backend returned invalid response/i.test(text)) {
            const details = typeof rec.details === 'string' ? rec.details.trim() : '';
            if (details && !/backend returned invalid response/i.test(details)) {
                if (/occupied/i.test(details) && /bed/i.test(details)) {
                    return formatOccupiedBedsMessage(details, context);
                }
                return details;
            }
            return 'Delete failed. Free any occupied beds first, then try again.';
        }
        return text;
    }
    return fallback;
}

/**
 * The units API ignores null/"" on PUT for optional strings, so a cleared value
 * is stored as this sentinel and rendered as empty in the admin UI.
 */
export const CLEARED_OPTIONAL = '__none__';

export function isClearedOptional(value?: string | null): boolean {
    const trimmed = (value ?? '').trim().toLowerCase();
    return !trimmed || trimmed === CLEARED_OPTIONAL || trimmed === 'none';
}

/** Form/display value for an optional string returned by the API. */
export function optionalFromApi(value?: string | null): string {
    return isClearedOptional(value) ? '' : String(value).trim();
}

/** Value to send on edit when an optional string may have been cleared. */
export function optionalForApi(value: string): string {
    const trimmed = value.trim();
    return trimmed ? trimmed : CLEARED_OPTIONAL;
}

export function wardTypeLabel(type?: string): string {
    if (isClearedOptional(type)) return '';
    const known: Partial<Record<WardType, string>> = {
        icu: 'ICU',
        nicu: 'NICU',
    };
    if ((WARD_TYPES as readonly string[]).includes(type!)) {
        return known[type as WardType] || type!.charAt(0).toUpperCase() + type!.slice(1);
    }
    return type!;
}

export function genderLabel(value?: GenderRestriction | string): string {
    if (!value || isClearedOptional(value)) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
}
