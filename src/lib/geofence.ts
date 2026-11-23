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
    outline: LatLng[] | null;
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

/* ── Place search (MapTiler geocoding) ───────────────────────── */

type GeoJsonGeometry = { type?: string; coordinates?: unknown };

/** Minimal shape of a MapTiler geocoding feature that this page reads. */
export type GeocodingFeatureLike = {
    id?: string | number;
    text?: string;
    place_name?: string;
    place_type_name?: string[];
    place_type?: string[];
    center?: number[];
    bbox?: number[];
    geometry?: GeoJsonGeometry;
    properties?: Record<string, unknown>;
};

/** Largest outer ring of a (Multi)Polygon GeoJSON geometry, as unclosed lat/lng points. */
function outlineFromGeoJson(geo: GeoJsonGeometry | undefined): LatLng[] | null {
    if (!geo || !Array.isArray(geo.coordinates)) return null;
    const rings: unknown[] =
        geo.type === 'Polygon' ? [geo.coordinates[0]]
            : geo.type === 'MultiPolygon' ? (geo.coordinates as unknown[][]).map(poly => poly?.[0])
                : [];
    let best: LatLng[] | null = null;
    let bestArea = 0;
    for (const ring of rings) {
        if (!Array.isArray(ring)) continue;
        const pts = ring
            .filter((c): c is [number, number] => Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number')
            .map(([lng, lat]) => [lat, lng] as LatLng);
        if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
        if (pts.length < 3) continue;
        const area = polygonAreaM2(pts);
        if (area > bestArea) {
            best = pts;
            bestArea = area;
        }
    }
    // Very large outlines (towns, regions) are not useful as a facility fence.
    return best && bestArea <= 25_000_000 ? best : null;
}

export function featuresToPlaces(features: GeocodingFeatureLike[]): PlaceResult[] {
    return features.flatMap((f, idx) => {
        const [lng, lat] = Array.isArray(f.center) ? f.center : [NaN, NaN];
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
        const full = f.place_name || '';
        const name = f.text || full.split(',')[0] || 'Unnamed place';
        const bb = Array.isArray(f.bbox) && f.bbox.length === 4 && f.bbox.every(Number.isFinite) ? f.bbox : null;
        return [{
            id: String(f.id ?? `${idx}-${lat},${lng}`),
            name,
            address: full.startsWith(name) ? full.slice(name.length).replace(/^,\s*/, '') : full,
            kind: (f.place_type_name?.[0] || f.place_type?.[0] || '').replace(/_/g, ' '),
            center: [lat, lng] as LatLng,
            // bbox is [w, s, e, n]; points with no extent come back as a zero-size box.
            bounds: bb && (bb[0] !== bb[2] || bb[1] !== bb[3]) ? [[bb[1], bb[0]], [bb[3], bb[2]]] as [LatLng, LatLng] : null,
            outline: outlineFromGeoJson(f.geometry),
        }];
    });
}
