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
    department_id?: string;
    department_name?: string;
    block_id?: string;
    gender_restriction?: string;
    type?: string;
    facility_id?: string;
    patient_count?: number;
    floor_count: number;
    floors: CareUnitFloor[];
    created_at?: string;
};

function sortFloors(floors: CareUnitFloor[]): CareUnitFloor[] {
    return [...floors].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
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
    const departmentId = String(rec.department_id || '').trim();
    const departmentName = String(rec.department_name || '').trim();
    const blockId = String(rec.block_id || '').trim();
    const gender = String(rec.gender_restriction || '').trim().toLowerCase();
    const type = String(rec.type || '').trim();
    const description = typeof rec.description === 'string' ? rec.description : '';
    const facilityId = String(rec.facility_id || '').trim();
    const createdAt = String(rec.created_at || '').trim();
    const patientCount = Number(rec.patient_count);
    return {
        id,
        name,
        ...(description ? { description } : {}),
        ...(departmentId ? { department_id: departmentId } : {}),
        ...(departmentName ? { department_name: departmentName } : {}),
        ...(blockId ? { block_id: blockId } : {}),
        ...(gender === 'male' || gender === 'female' || gender === 'mixed' ? { gender_restriction: gender } : {}),
        ...(type ? { type } : {}),
        ...(facilityId ? { facility_id: facilityId } : {}),
        ...(Number.isFinite(patientCount) ? { patient_count: patientCount } : {}),
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
