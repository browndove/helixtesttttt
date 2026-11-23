export type SupportRole = {
    id: string;
    name: string;
    isDefault: boolean;
    signedInName: string;
    assignedFacilities: number;
};

export type SupportFacility = {
    facilityId: string;
    name: string;
    code: string;
    /** Explicit assignment; null means facility uses the default role. */
    assignedRoleId: string | null;
    /** Effective role after default resolution. */
    routedRoleId: string;
};

export type SupportRoutingPayload = {
    supportRoles: SupportRole[];
    facilities: SupportFacility[];
};

type Rec = Record<string, unknown>;

function asRec(value: unknown): Rec | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : null;
}

function str(rec: Rec | null, ...keys: string[]): string {
    if (!rec) return '';
    for (const key of keys) {
        const value = rec[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
        if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return '';
}

function bool(rec: Rec | null, ...keys: string[]): boolean {
    if (!rec) return false;
    for (const key of keys) {
        const value = rec[key];
        if (typeof value === 'boolean') return value;
        if (value === 1 || value === 'true') return true;
        if (value === 0 || value === 'false') return false;
    }
    return false;
}

function num(rec: Rec | null, ...keys: string[]): number {
    if (!rec) return 0;
    for (const key of keys) {
        const value = rec[key];
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string' && value.trim()) {
            const n = Number(value);
            if (Number.isFinite(n)) return n;
        }
    }
    return 0;
}

function parseRole(raw: unknown): SupportRole | null {
    const rec = asRec(raw);
    if (!rec) return null;
    const id = str(rec, 'id', 'role_id', 'support_role_id');
    if (!id) return null;
    return {
        id,
        name: str(rec, 'name', 'role_name') || 'Support role',
        isDefault: bool(rec, 'is_default', 'isDefault', 'default'),
        signedInName: str(rec, 'signed_in_name', 'signedInName', 'signed_in_user_name', 'assignee_name'),
        assignedFacilities: num(rec, 'assigned_facilities', 'assignedFacilities', 'facility_count'),
    };
}

function parseFacility(raw: unknown): SupportFacility | null {
    const rec = asRec(raw);
    if (!rec) return null;
    const facilityId = str(rec, 'facility_id', 'facilityId', 'id');
    if (!facilityId) return null;
    const assignedRaw = rec.assigned_role_id ?? rec.assignedRoleId;
    const assignedRoleId =
        assignedRaw == null || assignedRaw === ''
            ? null
            : String(assignedRaw).trim() || null;
    const routedRoleId = str(rec, 'routed_role_id', 'routedRoleId') || assignedRoleId || '';
    return {
        facilityId,
        name: str(rec, 'name', 'facility_name') || 'Facility',
        code: str(rec, 'code', 'facility_code'),
        assignedRoleId,
        routedRoleId,
    };
}

export function parseSupportRouting(raw: unknown): SupportRoutingPayload {
    const root = asRec(raw) || {};
    const data = asRec(root.data) || root;
    const rolesRaw = Array.isArray(data.support_roles)
        ? data.support_roles
        : Array.isArray(data.supportRoles)
            ? data.supportRoles
            : Array.isArray(root.support_roles)
                ? root.support_roles
                : [];
    const facilitiesRaw = Array.isArray(data.facilities)
        ? data.facilities
        : Array.isArray(root.facilities)
            ? root.facilities
            : [];

    const supportRoles = rolesRaw
        .map(parseRole)
        .filter((r): r is SupportRole => Boolean(r))
        .sort((a, b) => {
            if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

    const facilities = facilitiesRaw
        .map(parseFacility)
        .filter((f): f is SupportFacility => Boolean(f))
        .sort((a, b) => a.name.localeCompare(b.name));

    return { supportRoles, facilities };
}

export function apiErrorMessage(data: unknown, fallback: string): string {
    const rec = asRec(data);
    if (!rec) return fallback;
    const nested = asRec(rec.data) || asRec(rec.error);
    return (
        str(rec, 'message', 'detail', 'error', 'reason', 'details')
        || str(nested, 'message', 'detail', 'error', 'reason')
        || fallback
    );
}

export function movedConversationsCount(data: unknown): number {
    const rec = asRec(data);
    if (!rec) return 0;
    return num(rec, 'moved_conversations', 'movedConversations', 'conversations_moved');
}
