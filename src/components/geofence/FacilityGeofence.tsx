'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MapboxMap, MapMouseEvent, Marker } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@/components/glass/glass-page.css';
import './geofence.css';
import TopBar from '@/components/TopBar';
import { MacVibrancyToast, MacVibrancyToastPortal, macToastLeading } from '@/components/MacVibrancyToast';
import { API_ENDPOINTS } from '@/lib/config';
import { appendFacilityIdForProxy, resolveClientFacilityId } from '@/lib/facility-client';
import {
    formatArea,
    formatDistance,
    loadDraftZones,
    mapboxToPlaces,
    maptilerToPlaces,
    mergePlaces,
    newZoneId,
    polygonAreaM2,
    polygonCentroid,
    polygonPerimeterM,
    saveDraftZones,
    SEARCH_COUNTRIES,
    zonesToGeoJson,
    type GeofenceZone,
    type MapTilerFeatureLike,
    type SearchFeatureLike,
    type LatLng,
    type PlaceResult,
} from '@/lib/geofence';

type Mode = 'idle' | 'drawing' | 'editing';
type BaseLayer = 'map' | 'satellite';
type Toast = { message: string; variant: 'success' | 'error' | 'info' };
type Facility = { id: string; name: string };
type SDK = typeof import('mapbox-gl').default;
type LngLat = [number, number];

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
/** Optional: MapTiler (OpenStreetMap) search fills in the suburbs and streets Mapbox lacks in Ghana. */
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || '';
const STYLES: Record<BaseLayer, string> = {
    map: 'mapbox://styles/mapbox/standard',
    satellite: 'mapbox://styles/mapbox/standard-satellite',
};

/**
 * Basemap look: a quiet blue-grey palette in the app's colours (hospital grounds tinted
 * blue) so the zones stand out; 3D buildings only while the 3D view is on.
 */
function basemapConfig(base: BaseLayer, show3d: boolean): Record<string, string | number | boolean> {
    const shared = {
        lightPreset: 'day',
        showTransitLabels: false,
        showPedestrianRoads: false,
        colorAdminBoundaries: '#9fb0c8',
    };
    if (base === 'satellite') return shared;
    return {
        ...shared,
        show3dObjects: show3d,
        colorLand: '#f3f5f8',
        colorBuildings: '#e3e8ef',
        colorGreenspace: '#e2ede5',
        colorWater: '#cfdff0',
        colorMedical: '#e8ecf1',
        colorEducation: '#eceff3',
        colorCommercial: '#eff1f4',
        colorIndustrial: '#eaedf1',
        colorRoads: '#ffffff',
        colorTrunks: '#e8edf4',
        colorMotorways: '#dbe3ee',
        colorPlaceLabels: '#3a4658',
        colorRoadLabels: '#6f7a8a',
        backgroundPointOfInterestLabels: 'none',
        colorModePointOfInterestLabels: 'single',
        colorPointOfInterestLabels: '#7c8797',
        densityPointOfInterestLabels: 2,
    };
}

/** Ghana — most Helix facilities; replaced by the saved zones' bounds once there are any. */
const DEFAULT_CENTER: LatLng = [7.95, -1.03];
const DEFAULT_ZOOM = 6.2;
/** Pitch used for the 3D view and when flying to a searched place. */
const TILT = 55;

const NAVY = '#1b2a44';
const BLUE = '#2f6fb8';
const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

const toLngLat = ([lat, lng]: LatLng): LngLat => [lng, lat];
const ring = (pts: LatLng[]) => [...pts, pts[0]].map(toLngLat);

function boundsOf(pts: LatLng[]): [LngLat, LngLat] {
    let s = 90, w = 180, n = -90, e = -180;
    for (const [lat, lng] of pts) {
        s = Math.min(s, lat); n = Math.max(n, lat);
        w = Math.min(w, lng); e = Math.max(e, lng);
    }
    return [[w, s], [e, n]];
}

function Icon({ name, size }: { name: string; size?: number }) {
    return <span className="material-icons-round" aria-hidden style={size ? { fontSize: size } : undefined}>{name}</span>;
}

function placeIcon(place: PlaceResult): string {
    if (place.kind === 'street') return 'add_road';
    if (/hospital|clinic|health|medical|pharmacy/i.test(`${place.kind} ${place.name}`)) return 'local_hospital';
    if (place.bounds || ['area', 'neighbourhood', 'district', 'town'].includes(place.kind)) return 'map';
    return 'place';
}

function isTypingTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

/** Marker DOM element; clicks on it never reach the map (so they don't drop a drawing point). */
function markerEl(className: string, html = '', tip = ''): HTMLDivElement {
    const el = document.createElement('div');
    el.className = className;
    el.innerHTML = html;
    if (tip) el.dataset.tip = tip;
    for (const type of ['mousedown', 'mouseup', 'click', 'dblclick', 'touchstart']) {
        el.addEventListener(type, e => e.stopPropagation());
    }
    return el;
}

async function resolveFacility(): Promise<Facility> {
    const [id, hospital] = await Promise.all([
        resolveClientFacilityId().catch(() => ''),
        appendFacilityIdForProxy(API_ENDPOINTS.HOSPITAL)
            .then(url => fetch(url, { credentials: 'include' }))
            .then(res => (res.ok ? res.json() : null))
            .catch(() => null),
    ]);
    const rec = hospital && typeof hospital === 'object' ? hospital as Record<string, unknown> : {};
    return {
        id: id || (typeof rec.id === 'string' ? rec.id : ''),
        name: typeof rec.name === 'string' && rec.name.trim() ? rec.name.trim() : '',
    };
}

/** Our sources/layers; re-added after every style swap because setStyle drops them. */
function ensureLayers(map: MapboxMap): boolean {
    if (map.getSource('geo-zones')) return false;
    map.addSource('geo-zones', { type: 'geojson', data: EMPTY_FC });
    map.addSource('geo-work', { type: 'geojson', data: EMPTY_FC });
    map.addSource('geo-guide', { type: 'geojson', data: EMPTY_FC });
    // Standard styles expose slots: zones sit on the ground under labels and 3D buildings,
    // the shape being drawn sits on top so it is never hidden.
    map.addLayer({
        id: 'geo-zones-fill',
        type: 'fill',
        slot: 'middle',
        source: 'geo-zones',
        paint: {
            'fill-color': ['case', ['get', 'selected'], '#3d7fcc', '#5a92d6'],
            'fill-opacity': ['case', ['get', 'selected'], 0.42, 0.32],
        },
    });
    // Soft inner glow along the edge so the overlay reads on busy satellite imagery too.
    map.addLayer({
        id: 'geo-zones-glow',
        type: 'line',
        slot: 'middle',
        source: 'geo-zones',
        layout: { 'line-join': 'round' },
        paint: {
            'line-color': '#8fbaf0',
            'line-width': ['case', ['get', 'selected'], 14, 10],
            'line-blur': 8,
            'line-opacity': 0.55,
            'line-offset': 5,
        },
    });
    map.addLayer({
        id: 'geo-zones-line',
        type: 'line',
        slot: 'middle',
        source: 'geo-zones',
        layout: { 'line-join': 'round' },
        paint: {
            'line-color': ['case', ['get', 'selected'], NAVY, BLUE],
            'line-width': ['case', ['get', 'selected'], 3.5, 2.5],
        },
    });
    map.addLayer({
        id: 'geo-work-fill',
        type: 'fill',
        slot: 'top',
        source: 'geo-work',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': BLUE, 'fill-opacity': 0.24 },
    });
    map.addLayer({
        id: 'geo-work-line',
        type: 'line',
        slot: 'top',
        source: 'geo-work',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': NAVY, 'line-width': 3 },
    });
    map.addLayer({
        id: 'geo-guide-line',
        type: 'line',
        slot: 'top',
        source: 'geo-guide',
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': NAVY, 'line-width': 2, 'line-opacity': 0.7, 'line-dasharray': [2, 2] },
    });
    return true;
}

function setData(map: MapboxMap | null, id: string, data: GeoJSON.GeoJSON) {
    const src = map?.getSource(id) as GeoJSONSource | undefined;
    src?.setData(data);
}

function workShape(pts: LatLng[]): GeoJSON.FeatureCollection {
    if (pts.length >= 3) {
        return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring(pts)] } }] };
    }
    if (pts.length === 2) {
        return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts.map(toLngLat) } }] };
    }
    return EMPTY_FC;
}

export default function FacilityGeofence() {
    const mapEl = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const sdkRef = useRef<SDK | null>(null);
    const mapRef = useRef<MapboxMap | null>(null);
    const badgeMarkers = useRef<Marker[]>([]);
    const workMarkers = useRef<Marker[]>([]);
    const pinMarker = useRef<Marker | null>(null);

    const [ready, setReady] = useState(false);
    /** Bumped on every style load so the data effects re-push into the fresh sources. */
    const [styleTick, setStyleTick] = useState(0);
    const [mapError, setMapError] = useState(MAPBOX_TOKEN ? '' : 'missing-key');
    const [base, setBase] = useState<BaseLayer>('map');
    const [pitched, setPitched] = useState(false);
    const [bearing, setBearing] = useState(0);
    const [panelOpen, setPanelOpen] = useState(true);
    const [fullscreen, setFullscreen] = useState(false);

    const [facility, setFacility] = useState<Facility | null>(null);
    const [zones, setZones] = useState<GeofenceZone[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [selectedId, setSelectedId] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState('');

    const [mode, setMode] = useState<Mode>('idle');
    const [draft, setDraft] = useState<LatLng[]>([]);
    const [editPoints, setEditPoints] = useState<LatLng[] | null>(null);

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<PlaceResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [searched, setSearched] = useState('');
    const [pickedPlace, setPickedPlace] = useState<PlaceResult | null>(null);
    const searchSeq = useRef(0);

    const [toast, setToast] = useState<Toast | null>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const notify = useCallback((message: string, variant: Toast['variant'] = 'info') => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ message, variant });
        toastTimer.current = setTimeout(() => setToast(null), 3200);
    }, []);

    /* ── Facility + local draft ───────────────────────────────── */
    useEffect(() => {
        let alive = true;
        void resolveFacility().then(fac => {
            if (!alive) return;
            setFacility(fac);
            setZones(loadDraftZones(fac.id));
            setLoaded(true);
        });
        return () => { alive = false; };
    }, []);

    useEffect(() => {
        if (!loaded || !facility) return;
        if (!saveDraftZones(facility.id, zones)) notify('This browser blocked saving the draft.', 'error');
    }, [zones, loaded, facility, notify]);

    /* ── Map bootstrap (the library touches window, so it loads client-side only) ── */
    useEffect(() => {
        if (!MAPBOX_TOKEN) return;
        let cancelled = false;
        let map: MapboxMap | null = null;
        void import('mapbox-gl').then(({ default: mapboxgl }) => {
            if (cancelled || !mapEl.current) return;
            sdkRef.current = mapboxgl;
            mapboxgl.accessToken = MAPBOX_TOKEN;
            // Opens on the globe, then flies in once the draft is known (see the initial-fit effect).
            map = new mapboxgl.Map({
                container: mapEl.current,
                style: STYLES.map,
                config: { basemap: basemapConfig('map', false) },
                projection: 'globe',
                center: toLngLat(DEFAULT_CENTER),
                zoom: 1.6,
                attributionControl: false,
                doubleClickZoom: true,
            });
            map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
            // A style swap (Map ↔ Satellite) drops our sources, so re-add them whenever style
            // data arrives and they're missing.
            const restoreLayers = () => {
                try {
                    if (ensureLayers(map!)) setStyleTick(t => t + 1);
                } catch {
                    // Style still loading; the next styledata event retries.
                }
            };
            map.on('style.load', restoreLayers);
            map.on('styledata', restoreLayers);
            map.once('load', () => setReady(true));
            map.on('pitchend', () => setPitched(map!.getPitch() > 5));
            map.on('rotate', () => setBearing(map!.getBearing()));
            map.on('error', e => {
                const status = (e?.error as { status?: number } | undefined)?.status;
                if (status === 401 || status === 403) setMapError('bad-key');
            });
            mapRef.current = map;
        }).catch(() => setMapError('load-failed'));
        return () => {
            cancelled = true;
            map?.remove();
            mapRef.current = null;
            // Markers belong to the removed map; a fresh map must re-run every sync effect.
            badgeMarkers.current = [];
            workMarkers.current = [];
            pinMarker.current = null;
            setReady(false);
        };
    }, []);

    // Fly in from the globe once both the map and the draft are ready.
    const didInitialFit = useRef(false);
    useEffect(() => {
        const map = mapRef.current;
        if (!ready || !loaded || !map || didInitialFit.current) return;
        didInitialFit.current = true;
        const all = zones.flatMap(z => z.points);
        if (all.length) map.fitBounds(boundsOf(all), { padding: 80, maxZoom: 17.5, duration: 2600, essential: true });
        else map.flyTo({ center: toLngLat(DEFAULT_CENTER), zoom: DEFAULT_ZOOM, duration: 2600, curve: 1.6, essential: true });
    }, [ready, loaded, zones]);

    const pitchedRef = useRef(false);
    const firstStyle = useRef(true);
    useEffect(() => {
        const map = mapRef.current;
        if (!ready || !map) return;
        if (firstStyle.current && base === 'map') { firstStyle.current = false; return; }
        firstStyle.current = false;
        // The typings mark the font options required; the runtime treats them as optional.
        map.setStyle(STYLES[base], { config: { basemap: basemapConfig(base, pitchedRef.current) } } as unknown as Parameters<MapboxMap['setStyle']>[1]);
    }, [base, ready]);

    // 3D buildings come and go with the tilt; flat, the map stays a clean plan view.
    useEffect(() => {
        pitchedRef.current = pitched;
        const map = mapRef.current;
        if (!ready || !map || base !== 'map') return;
        try {
            map.setConfigProperty('basemap', 'show3dObjects', pitched);
        } catch {
            // Style mid-swap; the next setStyle carries the right config.
        }
    }, [pitched, base, ready, styleTick]);

    const toggleTilt = useCallback(() => {
        const map = mapRef.current;
        if (!map) return;
        map.easeTo({ pitch: map.getPitch() > 5 ? 0 : TILT, duration: 900, essential: true });
    }, []);

    const resetNorth = useCallback(() => {
        mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 700, essential: true });
    }, []);

    useEffect(() => {
        const onChange = () => {
            setFullscreen(document.fullscreenElement === stageRef.current);
            setTimeout(() => mapRef.current?.resize(), 60);
        };
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    const toggleFullscreen = useCallback(() => {
        const el = stageRef.current;
        if (!el) return;
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
        else void el.requestFullscreen?.().catch(() => notify('Full screen isn’t available here.', 'error'));
    }, [notify]);

    /* ── Saved zones ──────────────────────────────────────────── */
    const focusZone = useCallback((zone: GeofenceZone) => {
        mapRef.current?.fitBounds(boundsOf(zone.points), { padding: 90, maxZoom: 18, duration: 1200, essential: true });
    }, []);

    const selectZone = useCallback((id: string, fly = true) => {
        setSelectedId(id);
        setConfirmDeleteId('');
        const zone = zones.find(z => z.id === id);
        if (zone && fly) focusZone(zone);
    }, [zones, focusZone]);

    const selectRef = useRef(selectZone);
    useEffect(() => { selectRef.current = selectZone; }, [selectZone]);
    const modeRef = useRef<Mode>('idle');
    useEffect(() => { modeRef.current = mode; }, [mode]);

    // Polygons as a vector layer.
    useEffect(() => {
        const map = mapRef.current;
        if (!ready || !map) return;
        setData(map, 'geo-zones', {
            type: 'FeatureCollection',
            features: zones
                .filter(z => !(mode === 'editing' && z.id === selectedId))
                .map(z => ({
                    type: 'Feature' as const,
                    properties: { id: z.id, selected: z.id === selectedId },
                    geometry: { type: 'Polygon' as const, coordinates: [ring(z.points)] },
                })),
        });
    }, [ready, styleTick, zones, selectedId, mode]);

    // Click / hover on polygons (idle only).
    useEffect(() => {
        const map = mapRef.current;
        if (!ready || !map) return;
        const onClick = (e: MapMouseEvent) => {
            if (modeRef.current !== 'idle') return;
            const id = e.features?.[0]?.properties?.id;
            if (typeof id === 'string') selectRef.current(id, false);
        };
        const onEnter = () => { if (modeRef.current === 'idle') map.getCanvas().style.cursor = 'pointer'; };
        const onLeave = () => { if (modeRef.current === 'idle') map.getCanvas().style.cursor = ''; };
        map.on('click', 'geo-zones-fill', onClick);
        map.on('mouseenter', 'geo-zones-fill', onEnter);
        map.on('mouseleave', 'geo-zones-fill', onLeave);
        return () => {
            map.off('click', 'geo-zones-fill', onClick);
            map.off('mouseenter', 'geo-zones-fill', onEnter);
            map.off('mouseleave', 'geo-zones-fill', onLeave);
        };
    }, [ready]);

    // Hospital badge at each zone's centre (like a map pin you can click).
    useEffect(() => {
        const sdk = sdkRef.current;
        const map = mapRef.current;
        badgeMarkers.current.forEach(m => m.remove());
        badgeMarkers.current = [];
        if (!ready || !sdk || !map) return;
        for (const zone of zones) {
            if (mode === 'editing' && zone.id === selectedId) continue;
            const isSel = zone.id === selectedId;
            const el = markerEl(
                `geo-badge${isSel ? ' is-selected' : ''}${mode !== 'idle' ? ' is-muted' : ''}`,
                '<span class="material-icons-round">local_hospital</span><span class="geo-badge__label"></span>',
                isSel ? '' : 'Click to see details',
            );
            // Name stays on the overlay; set as text so user-entered names can't inject markup.
            el.querySelector('.geo-badge__label')!.textContent = zone.name || 'Untitled zone';
            el.addEventListener('click', () => {
                if (modeRef.current === 'idle') selectRef.current(zone.id, true);
            });
            badgeMarkers.current.push(new sdk.Marker({ element: el }).setLngLat(toLngLat(polygonCentroid(zone.points))).addTo(map));
        }
    }, [ready, styleTick, zones, selectedId, mode]);

    /* ── Drawing ──────────────────────────────────────────────── */
    const draftRef = useRef<LatLng[]>([]);
    useEffect(() => { draftRef.current = draft; }, [draft]);

    const startDrawing = useCallback(() => {
        setSelectedId('');
        setEditPoints(null);
        setDraft([]);
        setMode('drawing');
        // Trace on a flat, north-up map so clicks land where they look like they do.
        mapRef.current?.easeTo({ pitch: 0, bearing: 0, duration: 600 });
    }, []);

    const cancelWork = useCallback(() => {
        setMode('idle');
        setDraft([]);
        setEditPoints(null);
    }, []);

    const finishDrawing = useCallback(() => {
        const pts = draftRef.current;
        if (pts.length < 3) {
            notify('Add at least 3 points to close the shape.', 'error');
            return;
        }
        const now = new Date().toISOString();
        const label = facility?.name || 'Facility';
        const zone: GeofenceZone = {
            id: newZoneId(),
            name: zones.length === 0 ? `${label} — main site` : `${label} — zone ${zones.length + 1}`,
            points: pts,
            createdAt: now,
            updatedAt: now,
        };
        setZones(prev => [...prev, zone]);
        setSelectedId(zone.id);
        setDraft([]);
        setMode('idle');
        setPanelOpen(true);
        notify('Zone added. Give it a name in the panel.', 'success');
    }, [facility, zones.length, notify]);

    const finishRef = useRef(finishDrawing);
    useEffect(() => { finishRef.current = finishDrawing; }, [finishDrawing]);

    useEffect(() => {
        const map = mapRef.current;
        if (!ready || !map) return;
        map.getCanvas().style.cursor = mode === 'drawing' ? 'crosshair' : '';
        if (mode !== 'drawing') {
            setData(map, 'geo-guide', EMPTY_FC);
            return;
        }
        map.doubleClickZoom.disable();
        const onClick = (e: MapMouseEvent) => {
            setDraft(prev => [...prev, [e.lngLat.lat, e.lngLat.lng]]);
        };
        const onMove = (e: MapMouseEvent) => {
            const pts = draftRef.current;
            if (!pts.length) return;
            const cursor: LngLat = [e.lngLat.lng, e.lngLat.lat];
            const coords = pts.length >= 2 ? [toLngLat(pts[pts.length - 1]), cursor, toLngLat(pts[0])] : [toLngLat(pts[0]), cursor];
            setData(map, 'geo-guide', { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
        };
        map.on('click', onClick);
        map.on('mousemove', onMove);
        return () => {
            map.off('click', onClick);
            map.off('mousemove', onMove);
            map.doubleClickZoom.enable();
        };
    }, [ready, mode]);

    // Work layer + handles for the shape being drawn or edited.
    useEffect(() => {
        const sdk = sdkRef.current;
        const map = mapRef.current;
        workMarkers.current.forEach(m => m.remove());
        workMarkers.current = [];
        if (!ready || !sdk || !map) return;

        if (mode === 'drawing') {
            setData(map, 'geo-work', workShape(draft));
            draft.forEach((pt, i) => {
                const closer = i === 0 && draft.length >= 3;
                const el = markerEl(`geo-handle${closer ? ' geo-handle--close' : ''}`, '', closer ? 'Click to close the shape' : '');
                if (closer) el.addEventListener('click', () => finishRef.current());
                workMarkers.current.push(new sdk.Marker({ element: el }).setLngLat(toLngLat(pt)).addTo(map));
            });
            return;
        }

        if (mode === 'editing' && editPoints) {
            const live = editPoints.map(p => [...p] as LatLng);
            const redraw = (pts: LatLng[]) => setData(map, 'geo-work', workShape(pts));
            redraw(live);

            live.forEach((pt, i) => {
                const el = markerEl('geo-handle', '', live.length > 3 ? 'Drag to move · right-click to remove' : 'Drag to move');
                el.addEventListener('contextmenu', e => {
                    e.preventDefault();
                    if (live.length > 3) setEditPoints(live.filter((_, j) => j !== i));
                });
                const marker = new sdk.Marker({ element: el, draggable: true }).setLngLat(toLngLat(pt)).addTo(map);
                marker.on('drag', () => {
                    const ll = marker.getLngLat();
                    live[i] = [ll.lat, ll.lng];
                    redraw(live);
                });
                marker.on('dragend', () => setEditPoints([...live]));
                workMarkers.current.push(marker);
            });

            // Midpoint handles: drag (or click) one to add a vertex on that edge.
            live.forEach((a, i) => {
                const b = live[(i + 1) % live.length];
                const mid: LatLng = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
                const insertAt = (p: LatLng) => {
                    const next = [...live];
                    next.splice(i + 1, 0, p);
                    return next;
                };
                const el = markerEl('geo-handle geo-handle--mid', '', 'Drag to add a point');
                const marker = new sdk.Marker({ element: el, draggable: true }).setLngLat(toLngLat(mid)).addTo(map);
                let dragged = false;
                marker.on('drag', () => {
                    dragged = true;
                    const ll = marker.getLngLat();
                    redraw(insertAt([ll.lat, ll.lng]));
                });
                marker.on('dragend', () => {
                    const ll = marker.getLngLat();
                    setEditPoints(insertAt([ll.lat, ll.lng]));
                });
                el.addEventListener('click', () => {
                    if (!dragged) setEditPoints(insertAt(mid));
                });
                workMarkers.current.push(marker);
            });
            return;
        }

        setData(map, 'geo-work', EMPTY_FC);
    }, [ready, styleTick, mode, draft, editPoints]);

    /* ── Editing an existing zone ─────────────────────────────── */
    const startEditing = useCallback((zone: GeofenceZone) => {
        setSelectedId(zone.id);
        setEditPoints(zone.points);
        setMode('editing');
        setConfirmDeleteId('');
        mapRef.current?.fitBounds(boundsOf(zone.points), { padding: 90, maxZoom: 18, pitch: 0, bearing: 0, duration: 1000, essential: true });
    }, []);

    const saveEditing = useCallback(() => {
        if (!editPoints || !selectedId) return;
        setZones(prev => prev.map(z => (z.id === selectedId ? { ...z, points: editPoints, updatedAt: new Date().toISOString() } : z)));
        setEditPoints(null);
        setMode('idle');
        notify('Shape updated', 'success');
    }, [editPoints, selectedId, notify]);

    /* ── Keyboard ─────────────────────────────────────────────── */
    useEffect(() => {
        if (mode === 'idle') return;
        const onKey = (e: KeyboardEvent) => {
            if (isTypingTarget(e.target)) return;
            if (e.key === 'Escape') cancelWork();
            else if (e.key === 'Enter') {
                if (mode === 'drawing') finishDrawing();
                else saveEditing();
            } else if (mode === 'drawing' && (e.key === 'Backspace' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z'))) {
                e.preventDefault();
                setDraft(prev => prev.slice(0, -1));
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [mode, cancelWork, finishDrawing, saveEditing]);

    /* ── Search (Mapbox places + MapTiler suburbs/streets) ─────── */
    const runSearch = useCallback(async (q: string) => {
        const term = q.trim();
        if (term.length < 2 || !MAPBOX_TOKEN) return;
        const seq = ++searchSeq.current;
        setSearching(true);
        setSearchError('');
        const center = mapRef.current?.getCenter();
        const near = center ? `${center.lng},${center.lat}` : `${DEFAULT_CENTER[1]},${DEFAULT_CENTER[0]}`;

        const mapbox = async () => {
            const params = new URLSearchParams({ q: term, limit: '6', language: 'en', country: SEARCH_COUNTRIES, proximity: near, access_token: MAPBOX_TOKEN });
            const res = await fetch(`https://api.mapbox.com/search/searchbox/v1/forward?${params}`);
            if (!res.ok) throw new Error(String(res.status));
            return mapboxToPlaces(((await res.json()) as { features?: SearchFeatureLike[] }).features || []);
        };
        const maptiler = async () => {
            if (!MAPTILER_KEY) return [];
            // POIs are opt-in on MapTiler; they catch partial names ("37 military") that Mapbox misses.
            const params = new URLSearchParams({
                key: MAPTILER_KEY, limit: '10', language: 'en', country: SEARCH_COUNTRIES, proximity: near, autocomplete: 'true',
                types: 'poi,neighbourhood,place,locality,municipality,county,address,road',
            });
            const res = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(term)}.json?${params}`);
            if (!res.ok) throw new Error(String(res.status));
            return maptilerToPlaces(((await res.json()) as { features?: MapTilerFeatureLike[] }).features || []);
        };

        // Show whichever provider answers first, then merge in the other; only fail when both do.
        let fromMapbox: PlaceResult[] = [];
        let fromMaptiler: PlaceResult[] = [];
        const show = () => {
            if (seq !== searchSeq.current) return;
            setResults(mergePlaces(term, fromMapbox, fromMaptiler));
            setSearched(term);
        };
        const [a, b] = await Promise.allSettled([
            mapbox().then(r => { fromMapbox = r; show(); }),
            maptiler().then(r => { fromMaptiler = r; show(); }),
        ]);
        if (seq !== searchSeq.current) return;
        if (a.status === 'rejected' && b.status === 'rejected') {
            setResults([]);
            setSearchError('Search isn’t responding. Try again in a moment.');
        }
        setSearching(false);
    }, []);

    useEffect(() => {
        const term = query.trim();
        if (term.length < 2 || term === searched) return;
        const t = setTimeout(() => void runSearch(term), 450);
        return () => clearTimeout(t);
    }, [query, searched, runSearch]);

    const pickPlace = useCallback((place: PlaceResult) => {
        const sdk = sdkRef.current;
        const map = mapRef.current;
        setPickedPlace(place);
        if (!sdk || !map) return;
        // Areas and streets fit their extent; a single place gets a smooth fly-in. The current
        // tilt is kept, so arrivals stay flat unless the 3D view is on.
        if (place.bounds) {
            map.fitBounds([toLngLat(place.bounds[0]), toLngLat(place.bounds[1])], { padding: 90, maxZoom: 17, duration: 2200, essential: true });
        } else {
            map.flyTo({ center: toLngLat(place.center), zoom: 17.2, duration: 2600, curve: 1.5, essential: true });
        }
        pinMarker.current?.remove();
        pinMarker.current = new sdk.Marker({
            element: markerEl('geo-pin', '<span class="material-icons-round">place</span>'),
            anchor: 'bottom',
        }).setLngLat(toLngLat(place.center)).addTo(map);
    }, []);

    const clearPlace = useCallback(() => {
        setPickedPlace(null);
        pinMarker.current?.remove();
        pinMarker.current = null;
    }, []);

    /* ── Zone actions ─────────────────────────────────────────── */
    const renameZone = (id: string, name: string) => {
        setZones(prev => prev.map(z => (z.id === id ? { ...z, name, updatedAt: new Date().toISOString() } : z)));
    };

    const deleteZone = (id: string) => {
        setZones(prev => prev.filter(z => z.id !== id));
        if (selectedId === id) setSelectedId('');
        setConfirmDeleteId('');
        notify('Zone removed', 'info');
    };

    const exportGeoJson = () => {
        const data = zonesToGeoJson(zones, { id: facility?.id || '', name: facility?.name || '' });
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/geo+json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(facility?.name || 'facility').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-geofence.geojson`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const zoomBy = (delta: number) => {
        const map = mapRef.current;
        if (map) map.easeTo({ zoom: map.getZoom() + delta, duration: 350 });
    };
    const fitAll = () => {
        const all = zones.flatMap(z => z.points);
        if (all.length) mapRef.current?.fitBounds(boundsOf(all), { padding: 80, maxZoom: 17.5, duration: 1200 });
    };

    const totalArea = useMemo(() => zones.reduce((s, z) => s + polygonAreaM2(z.points), 0), [zones]);
    const draftArea = draft.length >= 3 ? polygonAreaM2(draft) : 0;
    const editArea = editPoints ? polygonAreaM2(editPoints) : 0;
    const mapUsable = ready && !mapError;

    return (
        <>
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast.message} variant={toast.variant} leading={macToastLeading(toast.variant)} onDismiss={() => setToast(null)} />
                </MacVibrancyToastPortal>
            )}
            <div className="app-main gx-page">
                <TopBar title="Geofence" subtitle="Map your facility’s boundary" />

                <main className="geo-main">
                    <div className={`geo-layout${panelOpen ? '' : ' is-collapsed'}`}>
                        {/* ── Side panel ── */}
                        <aside className="geo-panel" aria-label="Geofence tools" hidden={!panelOpen}>
                            <section className="geo-card gx-reveal">
                                <span className="material-icons-round gx-mark" aria-hidden>travel_explore</span>
                                <div className="geo-card__title"><span className="gx-ico"><Icon name="travel_explore" /></span>Find your facility</div>
                                <form
                                    className="geo-search"
                                    onSubmit={e => {
                                        e.preventDefault();
                                        void runSearch(query);
                                    }}
                                >
                                    <Icon name="search" size={18} />
                                    <input
                                        value={query}
                                        onChange={e => setQuery(e.target.value)}
                                        placeholder="Search a place or address"
                                        aria-label="Search a place or address"
                                        disabled={!MAPBOX_TOKEN}
                                    />
                                    {searching ? <span className="geo-spin" aria-label="Searching" /> : query ? (
                                        <button type="button" className="geo-search__clear" aria-label="Clear search" onClick={() => { setQuery(''); setResults([]); setSearched(''); setSearchError(''); }}>
                                            <Icon name="close" size={16} />
                                        </button>
                                    ) : null}
                                </form>

                                {searchError ? <p className="geo-note geo-note--bad">{searchError}</p> : null}
                                {!searchError && searched && !searching && results.length === 0 ? (
                                    <p className="geo-note">No places match “{searched}”. Try adding the town.</p>
                                ) : null}
                                {results.length > 0 ? (
                                    <ul className="geo-results">
                                        {results.map(place => (
                                            <li key={place.id}>
                                                <button
                                                    type="button"
                                                    className={`geo-result${pickedPlace?.id === place.id ? ' is-active' : ''}`}
                                                    onClick={() => pickPlace(place)}
                                                >
                                                    <span className="geo-result__icon"><Icon name={placeIcon(place)} size={16} /></span>
                                                    <span className="geo-result__text">
                                                        <span className="geo-result__name">{place.name}</span>
                                                        <span className="geo-result__addr">{[place.kind, place.address].filter(Boolean).join(' · ')}</span>
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}

                                {pickedPlace ? (
                                    <div className="geo-picked">
                                        <div className="geo-picked__name">{pickedPlace.name}</div>
                                        <p className="geo-note" style={{ margin: '2px 0 10px' }}>
                                            {pickedPlace.bounds ? 'Zoom in to your facility, then trace its boundary.' : 'Trace your facility’s boundary around the pin.'}
                                        </p>
                                        <div className="geo-row">
                                            <button
                                                type="button"
                                                className="geo-btn geo-btn--primary"
                                                onClick={startDrawing}
                                                disabled={mode !== 'idle' || !mapUsable}
                                            >
                                                <Icon name="draw" size={16} /> Draw here
                                            </button>
                                            <button type="button" className="geo-btn geo-btn--ghost" onClick={clearPlace} aria-label="Clear pin">
                                                <Icon name="close" size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                            </section>

                            <section className="geo-card geo-card--grow gx-reveal">
                                <span className="material-icons-round gx-mark" aria-hidden>share_location</span>
                                <div className="geo-card__head">
                                    <div className="geo-card__title" style={{ margin: 0 }}>
                                        <span className="gx-ico"><Icon name="share_location" /></span>
                                        Facility zones
                                        {zones.length ? <span className="geo-count">{zones.length}</span> : null}
                                    </div>
                                    {zones.length > 0 ? <span className="geo-note" style={{ margin: 0 }}>{formatArea(totalArea)}</span> : null}
                                </div>

                                {!loaded ? (
                                    <div className="geo-zone geo-zone--bone" />
                                ) : zones.length === 0 ? (
                                    <div className="geo-empty">
                                        <svg className="geo-empty__art" viewBox="0 0 120 84" aria-hidden>
                                            <path d="M14 62 L30 18 L74 10 L106 36 L88 72 L40 76 Z" fill="rgba(47,111,184,0.14)" stroke="#2f6fb8" strokeWidth="2" strokeDasharray="5 5" strokeLinejoin="round" />
                                            {[[14, 62], [30, 18], [74, 10], [106, 36], [88, 72], [40, 76]].map(([x, y]) => (
                                                <circle key={`${x}-${y}`} cx={x} cy={y} r="4.5" fill="#fff" stroke="#1b2a44" strokeWidth="2" />
                                            ))}
                                            <circle cx="60" cy="44" r="13" fill="#1b2a44" />
                                            <path d="M60 37 v14 M53 44 h14" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                                        </svg>
                                        <p className="geo-empty__title">No geofence yet</p>
                                        <p className="geo-note" style={{ textAlign: 'center', margin: '4px auto 14px', maxWidth: '34ch' }}>
                                            Search for your facility, then click around its edge on the map to draw the boundary.
                                        </p>
                                        <button type="button" className="geo-btn geo-btn--primary" onClick={startDrawing} disabled={mode !== 'idle' || !mapUsable}>
                                            <Icon name="draw" size={16} /> Draw a zone
                                        </button>
                                    </div>
                                ) : (
                                    <ul className="geo-zones">
                                        {zones.map(zone => {
                                            const isSel = zone.id === selectedId;
                                            const pts = isSel && mode === 'editing' && editPoints ? editPoints : zone.points;
                                            return (
                                                <li key={zone.id} className={`geo-zone${isSel ? ' is-selected' : ''}`}>
                                                    <button type="button" className="geo-zone__row" onClick={() => (mode === 'idle' ? selectZone(zone.id) : undefined)} disabled={mode !== 'idle' && !isSel}>
                                                        <span className="geo-zone__icon"><Icon name="local_hospital" size={16} /></span>
                                                        <span className="geo-zone__text">
                                                            <span className="geo-zone__name">{zone.name || 'Untitled zone'}</span>
                                                            <span className="geo-zone__meta">{formatArea(polygonAreaM2(pts))} · {pts.length} points</span>
                                                        </span>
                                                        <Icon name={isSel ? 'expand_less' : 'expand_more'} size={18} />
                                                    </button>
                                                    {isSel ? (
                                                        <div className="geo-zone__body">
                                                            <label className="geo-field">
                                                                <span>Zone name</span>
                                                                <input value={zone.name} onChange={e => renameZone(zone.id, e.target.value)} maxLength={80} placeholder="e.g. Main campus" />
                                                            </label>
                                                            <div className="geo-stats">
                                                                <div><span>Area</span><strong>{formatArea(polygonAreaM2(pts))}</strong></div>
                                                                <div><span>Perimeter</span><strong>{formatDistance(polygonPerimeterM(pts))}</strong></div>
                                                                <div><span>Points</span><strong>{pts.length}</strong></div>
                                                            </div>
                                                            {mode === 'editing' ? (
                                                                <div className="geo-row">
                                                                    <button type="button" className="geo-btn" onClick={cancelWork}>Cancel</button>
                                                                    <button type="button" className="geo-btn geo-btn--primary" onClick={saveEditing}><Icon name="check" size={16} /> Save shape</button>
                                                                </div>
                                                            ) : confirmDeleteId === zone.id ? (
                                                                <div className="geo-row">
                                                                    <span className="geo-note" style={{ margin: 0, flex: 1 }}>Delete this zone?</span>
                                                                    <button type="button" className="geo-btn geo-btn--ghost" onClick={() => setConfirmDeleteId('')}>Keep</button>
                                                                    <button type="button" className="geo-btn geo-btn--danger" onClick={() => deleteZone(zone.id)}>Delete</button>
                                                                </div>
                                                            ) : (
                                                                <div className="geo-row">
                                                                    <button type="button" className="geo-btn" onClick={() => startEditing(zone)} disabled={!mapUsable}><Icon name="edit_location_alt" size={16} /> Edit shape</button>
                                                                    <button type="button" className="geo-btn" onClick={() => focusZone(zone)} disabled={!mapUsable}><Icon name="center_focus_strong" size={16} /> Zoom</button>
                                                                    <button type="button" className="geo-btn geo-btn--ghost geo-btn--icon" aria-label="Delete zone" title="Delete zone" onClick={() => setConfirmDeleteId(zone.id)}>
                                                                        <Icon name="delete_outline" size={17} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : null}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}

                                {zones.length > 0 ? (
                                    <button type="button" className="geo-add" onClick={startDrawing} disabled={mode !== 'idle' || !mapUsable}>
                                        <Icon name="add" size={18} /> Add another zone
                                    </button>
                                ) : null}
                            </section>

                            <div className="geo-draft">
                                <Icon name="cloud_off" size={16} />
                                <span>Draft — saved in this browser only. Geofences go live once the server supports them.</span>
                                <button type="button" className="geo-link" onClick={exportGeoJson} disabled={!zones.length}>Export GeoJSON</button>
                            </div>
                        </aside>

                        {/* ── Map ── */}
                        <div className={`geo-stage gx-reveal${fullscreen ? ' is-fullscreen' : ''}`} ref={stageRef}>
                            <div ref={mapEl} className="geo-map" />

                            {mapError ? (
                                <div className="geo-map-error">
                                    <span className="geo-map-error__art"><Icon name="map" size={28} /></span>
                                    <p className="geo-empty__title">
                                        {mapError === 'missing-key' ? 'Map token needed' : mapError === 'bad-key' ? 'Mapbox rejected the token' : 'The map couldn’t load'}
                                    </p>
                                    <p className="geo-note" style={{ margin: 0, maxWidth: '44ch', textAlign: 'center' }}>
                                        {mapError === 'load-failed'
                                            ? 'Check your connection and refresh the page.'
                                            : <>Set <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in <code>.env.local</code> to a Mapbox public token (allowed for this domain), then restart the dev server.</>}
                                    </p>
                                </div>
                            ) : null}

                            <div className="geo-ctl geo-ctl--tl">
                                <button type="button" className="geo-fab" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} title={fullscreen ? 'Exit full screen' : 'Full screen'}>
                                    <Icon name={fullscreen ? 'fullscreen_exit' : 'fullscreen'} size={20} />
                                </button>
                                <div className="geo-seg" role="radiogroup" aria-label="Map style">
                                    {(['map', 'satellite'] as const).map(b => (
                                        <button key={b} type="button" role="radio" aria-checked={base === b} className={base === b ? 'is-on' : ''} onClick={() => setBase(b)} disabled={!mapUsable}>
                                            {b === 'map' ? 'Map' : 'Satellite'}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className={`geo-fab geo-fab--label${pitched ? ' is-on' : ''}`}
                                    onClick={toggleTilt}
                                    disabled={!mapUsable || mode !== 'idle'}
                                    aria-pressed={pitched}
                                    title={pitched ? 'Flat view' : '3D view with buildings'}
                                >
                                    <Icon name="view_in_ar" size={18} /> 3D
                                </button>
                            </div>

                            <div className="geo-ctl geo-ctl--tr">
                                <button type="button" className="geo-fab geo-fab--label" onClick={() => setPanelOpen(o => !o)} aria-expanded={panelOpen}>
                                    <Icon name={panelOpen ? 'chevron_left' : 'chevron_right'} size={18} />
                                    {panelOpen ? 'Hide' : 'Show'}
                                </button>
                            </div>

                            <div className={`geo-ctl ${mode === 'idle' ? 'geo-ctl--top' : 'geo-ctl--bottom'}`}>
                                {mode === 'drawing' ? (
                                    <div className="geo-toolbar">
                                        <span className="geo-toolbar__hint">
                                            <span className="geo-toolbar__dot" />
                                            {draft.length === 0
                                                ? 'Click on the map to place the first point'
                                                : draft.length < 3
                                                    ? `${draft.length} point${draft.length === 1 ? '' : 's'} · keep clicking around the edge`
                                                    : `${draft.length} points · ${formatArea(draftArea)} · click the first point to close`}
                                        </span>
                                        <button type="button" className="geo-btn geo-btn--ghost" onClick={() => setDraft(prev => prev.slice(0, -1))} disabled={!draft.length}>
                                            <Icon name="undo" size={16} /> Undo
                                        </button>
                                        <button type="button" className="geo-btn geo-btn--ghost" onClick={cancelWork}>Cancel</button>
                                        <button type="button" className="geo-btn geo-btn--primary" onClick={finishDrawing} disabled={draft.length < 3}>
                                            <Icon name="check" size={16} /> Finish
                                        </button>
                                    </div>
                                ) : mode === 'editing' ? (
                                    <div className="geo-toolbar">
                                        <span className="geo-toolbar__hint">
                                            <span className="geo-toolbar__dot" />
                                            Drag points to reshape · drag a small dot to add one · {formatArea(editArea)}
                                        </span>
                                        <button type="button" className="geo-btn geo-btn--ghost" onClick={cancelWork}>Cancel</button>
                                        <button type="button" className="geo-btn geo-btn--primary" onClick={saveEditing}>
                                            <Icon name="check" size={16} /> Save shape
                                        </button>
                                    </div>
                                ) : (
                                    <button type="button" className="geo-fab geo-fab--primary" onClick={startDrawing} disabled={!mapUsable}>
                                        <Icon name="draw" size={18} /> Draw zone
                                    </button>
                                )}
                            </div>

                            <div className="geo-ctl geo-ctl--br">
                                {Math.abs(bearing) > 1 || pitched ? (
                                    <button type="button" className="geo-fab" onClick={resetNorth} aria-label="Reset to north, flat" title="Reset to north, flat">
                                        <span className="geo-compass" style={{ transform: `rotate(${-bearing}deg)` }}><Icon name="navigation" size={18} /></span>
                                    </button>
                                ) : null}
                                <div className="geo-zoom">
                                    <button type="button" onClick={() => zoomBy(1)} aria-label="Zoom in" disabled={!mapUsable}><Icon name="add" size={20} /></button>
                                    <button type="button" onClick={() => zoomBy(-1)} aria-label="Zoom out" disabled={!mapUsable}><Icon name="remove" size={20} /></button>
                                </div>
                                {zones.length > 0 ? (
                                    <button type="button" className="geo-fab" onClick={fitAll} aria-label="Show all zones" title="Show all zones" disabled={!mapUsable}>
                                        <Icon name="filter_center_focus" size={20} />
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
