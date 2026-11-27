/**
 * Staff workstations from a staff record (GET /staff, GET /staff/{id}): `workstations` is
 * always an array of {id, name, is_primary}; `primary_workstation` may be an object or an id.
 * Ids are care unit ids, or `not_applicable` (same values as self-join `workstation_ids`).
 */
export type StaffWorkstation = { id: string; name: string; is_primary: boolean };

function rec(v: unknown): Record<string, unknown> | null {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string {
    return typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
}

/** Accepts the staff record itself or a `{ data }` / `{ staff }` wrapper. */
export function staffRecordFrom(raw: unknown): Record<string, unknown> {
    const top = rec(raw) || {};
    return rec(top.data) || rec(top.staff) || top;
}

export function parseStaffWorkstations(raw: unknown): StaffWorkstation[] {
    const r = staffRecordFrom(raw);
    const primary = rec(r.primary_workstation);
    const primaryId = primary ? str(primary.id) : str(r.primary_workstation_id || r.primary_workstation);
    const list: StaffWorkstation[] = (Array.isArray(r.workstations) ? r.workstations : [])
        .map((w): StaffWorkstation | null => {
            const wr = rec(w);
            if (!wr) return null;
            const id = str(wr.id);
            const name = str(wr.name) || id;
            if (!name) return null;
            return { id, name, is_primary: Boolean(wr.is_primary) || (!!id && id === primaryId) };
        })
        .filter((w): w is StaffWorkstation => Boolean(w));
    if (primary && !list.some(w => w.is_primary) && str(primary.name)) {
        list.unshift({ id: str(primary.id), name: str(primary.name), is_primary: true });
    }
    return list;
}

/** Main workstation id ('' when none) and the other ids, for edit forms. */
export function splitStaffWorkstations(list: StaffWorkstation[]): { primary: string; others: string[] } {
    const primary = list.find(w => w.is_primary)?.id || '';
    return { primary, others: list.filter(w => w.id && w.id !== primary).map(w => w.id) };
}
