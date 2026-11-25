/**
 * Facility geofence helpers. There is no backend for geofences yet, so zones are kept as a
 * per-browser draft in localStorage and can be exported as GeoJSON for the API hand-off.
 */

export type LatLng = [number, number];

export type GeofenceZone = {
    id: string;
    name: string;
    /** Outer ring, unclosed (first point is not repeated at the end). */
    points: LatLng[];
    createdAt: string;
    updatedAt: string;
};

export type PlaceResult = {
    id: string;
    name: string;
    address: string;
    kind: string;
    center: LatLng;
    bounds: [LatLng, LatLng] | null;
};

const EARTH_RADIUS_M = 6371008.8;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Geodesic polygon area in square metres (spherical excess, accurate to well under 1% at facility scale). */
export function polygonAreaM2(points: LatLng[]): number {
    if (points.length < 3) return 0;
    let total = 0;
    for (let i = 0; i < points.length; i++) {
        const [lat1, lng1] = points[i];
        const [lat2, lng2] = points[(i + 1) % points.length];
        total += rad(lng2 - lng1) * (2 + Math.sin(rad(lat1)) + Math.sin(rad(lat2)));
    }
    return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

function distanceM([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function polygonPerimeterM(points: LatLng[]): number {
    if (points.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < points.length; i++) total += distanceM(points[i], points[(i + 1) % points.length]);
    return total;
}

/** Area-weighted centroid; falls back to the vertex average for degenerate rings. */
export function polygonCentroid(points: LatLng[]): LatLng {
    let a = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < points.length; i++) {
        const [y1, x1] = points[i];
        const [y2, x2] = points[(i + 1) % points.length];
        const f = x1 * y2 - x2 * y1;
        a += f;
        cx += (x1 + x2) * f;
        cy += (y1 + y2) * f;
    }
    if (Math.abs(a) < 1e-12) {
        const n = points.length || 1;
        return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n];
    }
    return [cy / (3 * a), cx / (3 * a)];
}

export function formatArea(m2: number): string {
    if (m2 >= 1_000_000) {
        const km2 = m2 / 1_000_000;
        return `${km2.toLocaleString(undefined, { maximumFractionDigits: km2 >= 100 ? 0 : 2 })} km²`;
    }
    if (m2 >= 10_000) return `${(m2 / 10_000).toFixed(2)} ha`;
    return `${Math.round(m2).toLocaleString()} m²`;
}

export function formatDistance(m: number): string {
    return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

export function newZoneId(): string {
    return `zone-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ── Local draft storage ─────────────────────────────────────── */

const storageKey = (facilityId: string) => `helix-geofence-draft:${facilityId || 'default'}`;

function isLatLng(v: unknown): v is LatLng {
    return Array.isArray(v) && v.length === 2 && v.every(n => typeof n === 'number' && Number.isFinite(n));
}

export function loadDraftZones(facilityId: string): GeofenceZone[] {
    try {
        const raw = window.localStorage.getItem(storageKey(facilityId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((z): z is GeofenceZone =>
            z && typeof z.id === 'string' && typeof z.name === 'string'
            && Array.isArray(z.points) && z.points.length >= 3 && z.points.every(isLatLng));
    } catch {
        return [];
    }
}

export function saveDraftZones(facilityId: string, zones: GeofenceZone[]): boolean {
    try {
        window.localStorage.setItem(storageKey(facilityId), JSON.stringify(zones));
        return true;
    } catch {
        return false;
    }
}

/** GeoJSON FeatureCollection (lng/lat order, closed rings) for the future API. */
export function zonesToGeoJson(zones: GeofenceZone[], facility: { id: string; name: string }) {
    return {
        type: 'FeatureCollection' as const,
        features: zones.map(zone => ({
            type: 'Feature' as const,
            id: zone.id,
            properties: {
                name: zone.name,
                facility_id: facility.id || null,
                facility_name: facility.name || null,
                area_m2: Math.round(polygonAreaM2(zone.points)),
                created_at: zone.createdAt,
                updated_at: zone.updatedAt,
            },
            geometry: {
                type: 'Polygon' as const,
                coordinates: [[...zone.points, zone.points[0]].map(([lat, lng]) => [lng, lat])],
            },
        })),
    };
}

/* ── Place search ────────────────────────────────────────────────
 * Two providers, queried together: Mapbox Search Box knows named places (hospitals,
 * clinics, schools), while MapTiler (OpenStreetMap) covers Ghana's suburbs and streets,
 * which Mapbox's data mostly lacks. */

/** Search is limited to these ISO country codes (Helix facilities are in Ghana). */
export const SEARCH_COUNTRIES = 'gh';

/** Minimal shape of a Mapbox Search Box `forward` feature that this page reads. */
export type SearchFeatureLike = {
    geometry?: { type?: string; coordinates?: unknown };
    properties?: {
        mapbox_id?: string;
        name?: string;
        full_address?: string;
        place_formatted?: string;
        feature_type?: string;
        bbox?: number[];
        poi_category?: string[];
    };
};

/** Minimal shape of a MapTiler geocoding feature that this page reads. */
export type MapTilerFeatureLike = {
    id?: string | number;
    text?: string;
    place_name?: string;
    place_type?: string[];
    place_type_name?: string[];
    center?: number[];
    bbox?: number[];
};

const KIND_LABELS: Record<string, string> = {
    address: 'street', place: 'area', locality: 'area', neighbourhood: 'neighbourhood',
    neighborhood: 'neighbourhood', county: 'district', municipality: 'town', poi: '',
};

/** bbox is [w, s, e, n]; points with no extent come back as a zero-size box. */
function boundsFromBbox(bbox: unknown): [LatLng, LatLng] | null {
    const bb = Array.isArray(bbox) && bbox.length === 4 && bbox.every(Number.isFinite) ? bbox as number[] : null;
    return bb && (bb[0] !== bb[2] || bb[1] !== bb[3]) ? [[bb[1], bb[0]], [bb[3], bb[2]]] : null;
}

export function mapboxToPlaces(features: SearchFeatureLike[]): PlaceResult[] {
    return features.flatMap((f, idx) => {
        const coords = Array.isArray(f.geometry?.coordinates) ? f.geometry.coordinates as number[] : [];
        const [lng, lat] = coords;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
        const p = f.properties || {};
        const type = p.feature_type || '';
        return [{
            id: `mb-${p.mapbox_id || `${idx}-${lat},${lng}`}`,
            name: p.name || 'Unnamed place',
            address: p.place_formatted || p.full_address || '',
            kind: (p.poi_category?.[0] || (KIND_LABELS[type] ?? type)).replace(/_/g, ' '),
            center: [lat, lng] as LatLng,
            bounds: boundsFromBbox(p.bbox),
        }];
    });
}

export function maptilerToPlaces(features: MapTilerFeatureLike[]): PlaceResult[] {
    return features.flatMap((f, idx) => {
        const [lng, lat] = Array.isArray(f.center) ? f.center : [NaN, NaN];
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
        const full = f.place_name || '';
        const name = f.text || full.split(',')[0] || 'Unnamed place';
        const type = f.place_type?.[0] || '';
        return [{
            id: `mt-${f.id ?? `${idx}-${lat},${lng}`}`,
            name,
            address: full.startsWith(name) ? full.slice(name.length).replace(/^,\s*/, '') : full,
            kind: (KIND_LABELS[type] ?? f.place_type_name?.[0] ?? type).replace(/_/g, ' '),
            center: [lat, lng] as LatLng,
            bounds: boundsFromBbox(f.bbox),
        }];
    });
}

const normName = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Closest name match first (exact, then prefix, then the rest). On a tie, Mapbox's named
 * places lead, then areas and streets, then other places. The same name within ~3 km is
 * shown once.
 */
export function mergePlaces(query: string, mapbox: PlaceResult[], maptiler: PlaceResult[], limit = 8): PlaceResult[] {
    const q = normName(query);
    const match = (p: PlaceResult) => {
        const n = normName(p.name);
        return n === q ? 0 : n.startsWith(q) ? 1 : 2;
    };
    const isArea = (p: PlaceResult) => !!p.bounds || ['area', 'street', 'neighbourhood', 'district', 'town'].includes(p.kind);
    const tagged = [
        ...mapbox.map(p => ({ p, tier: isArea(p) ? 1 : 0 })),
        ...maptiler.map(p => ({ p, tier: isArea(p) ? 1 : 2 })),
    ];
    // Array.sort is stable, so each provider's own relevance order survives within a tier.
    tagged.sort((a, b) => match(a.p) - match(b.p) || a.tier - b.tier);
    const out: PlaceResult[] = [];
    for (const { p } of tagged) {
        if (out.some(o => normName(o.name) === normName(p.name) && distanceM(o.center, p.center) < 3000)) continue;
        out.push(p);
        if (out.length >= limit) break;
    }
    return out;
}
