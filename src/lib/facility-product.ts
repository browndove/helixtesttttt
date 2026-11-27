/**
 * Facility product (internal admins only): `full` is all of Helix; `scheduling_only` keeps
 * rosters, leave, requests, clock-in/attendance, staff, departments, roles and sites, and
 * turns off messaging, calls, patients, escalations, clinical tools and gamification.
 */
export type FacilityProduct = 'full' | 'scheduling_only';

export const FACILITY_PRODUCT_OPTIONS: { value: FacilityProduct; label: string; hint: string }[] = [
    { value: 'full', label: 'Full Helix', hint: 'Messaging, calls, patients, escalations, clinical tools and scheduling.' },
    { value: 'scheduling_only', label: 'Scheduling only', hint: 'Rosters, leave, requests and clock-in. No messaging, calls, patients or clinical tools.' },
];

/** Missing or unknown values mean `full` (the backend default). */
export function readFacilityProduct(raw: unknown): FacilityProduct {
    if (!raw || typeof raw !== 'object') return 'full';
    const rec = raw as Record<string, unknown>;
    const source = (rec.data && typeof rec.data === 'object' ? rec.data : rec) as Record<string, unknown>;
    return source.product === 'scheduling_only' ? 'scheduling_only' : 'full';
}

export function facilityProductLabel(product: FacilityProduct): string {
    return product === 'scheduling_only' ? 'Scheduling only' : 'Full Helix';
}

/** Friendly text for the product-specific API errors (falls back to the backend message). */
export function facilityProductErrorMessage(data: Record<string, unknown>, fallback: string): string {
    const code = String(data.code || data.error_code || data.error || '').trim();
    if (code === 'invalid_product') return 'Product must be Full Helix or Scheduling only.';
    if (code === 'product_internal_only') return 'Only Helix internal admins can change a facility’s product.';
    return String(data.message || data.detail || data.error || fallback);
}
