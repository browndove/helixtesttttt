'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as MapTiler from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import '@/components/glass/glass-page.css';
import './geofence.css';
import TopBar from '@/components/TopBar';
import { MacVibrancyToast, MacVibrancyToastPortal, macToastLeading } from '@/components/MacVibrancyToast';
import { API_ENDPOINTS } from '@/lib/config';
import { appendFacilityIdForProxy, resolveClientFacilityId } from '@/lib/facility-client';
import {
    featuresToPlaces,
    formatArea,
    formatDistance,
    loadDraftZones,
    newZoneId,
    polygonAreaM2,
    polygonCentroid,
    polygonPerimeterM,
    saveDraftZones,
    zonesToGeoJson,
    type GeocodingFeatureLike,
    type GeofenceZone,
    type LatLng,
    type PlaceResult,
} from '@/lib/geofence';

type Mode = 'idle' | 'drawing' | 'editing';
type BaseLayer = 'map' | 'satellite';
type Toast = { message: string; variant: 'success' | 'error' | 'info' };
type Facility = { id: string; name: string };
type SDK = typeof MapTiler;
type LngLat = [number, number];

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || '';

/** Ghana — most Helix facilities; replaced by the saved zones' bounds once there are any. */
const DEFAULT_CENTER: LatLng = [7.95, -1.03];
const DEFAULT_ZOOM = 6.2;

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
function ensureLayers(map: MapTiler.Map): boolean {
    if (map.getSource('geo-zones')) return false;
    map.addSource('geo-zones', { type: 'geojson', data: EMPTY_FC });
    map.addSource('geo-work', { type: 'geojson', data: EMPTY_FC });
    map.addSource('geo-guide', { type: 'geojson', data: EMPTY_FC });
    map.addSource('geo-place', { type: 'geojson', data: EMPTY_FC });
    map.addLayer({
        id: 'geo-zones-fill',
        type: 'fill',
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
        source: 'geo-zones',
        layout: { 'line-join': 'round' },
        paint: {
            'line-color': ['case', ['get', 'selected'], NAVY, BLUE],
            'line-width': ['case', ['get', 'selected'], 3.5, 2.5],
        },
    });
    map.addLayer({
        id: 'geo-place-line',
        type: 'line',
        source: 'geo-place',
        paint: { 'line-color': NAVY, 'line-width': 2, 'line-dasharray': [2, 2] },
    });
    map.addLayer({
        id: 'geo-work-fill',
        type: 'fill',
        source: 'geo-work',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': BLUE, 'fill-opacity': 0.24 },
    });
    map.addLayer({
        id: 'geo-work-line',
        type: 'line',
        source: 'geo-work',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': NAVY, 'line-width': 3 },
    });
    map.addLayer({
        id: 'geo-guide-line',
        type: 'line',
        source: 'geo-guide',
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': NAVY, 'line-width': 2, 'line-opacity': 0.7, 'line-dasharray': [2, 2] },
    });
    return true;
}

function setData(map: MapTiler.Map | null, id: string, data: GeoJSON.GeoJSON) {
    const src = map?.getSource(id) as MapTiler.GeoJSONSource | undefined;
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
    const mapRef = useRef<MapTiler.Map | null>(null);
    const badgeMarkers = useRef<MapTiler.Marker[]>([]);
    const workMarkers = useRef<MapTiler.Marker[]>([]);
    const pinMarker = useRef<MapTiler.Marker | null>(null);

    const [ready, setReady] = useState(false);
    /** Bumped on every style load so the data effects re-push into the fresh sources. */
    const [styleTick, setStyleTick] = useState(0);
    const [mapError, setMapError] = useState(MAPTILER_KEY ? '' : 'missing-key');
    const [base, setBase] = useState<BaseLayer>('map');
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

    /* ── Map bootstrap (the SDK touches window, so it loads client-side only) ── */
    useEffect(() => {
        if (!MAPTILER_KEY) return;
        let cancelled = false;
        let map: MapTiler.Map | null = null;
        void import('@maptiler/sdk').then(sdk => {
            if (cancelled || !mapEl.current) return;
            sdkRef.current = sdk;
            sdk.config.apiKey = MAPTILER_KEY;
            map = new sdk.Map({
                container: mapEl.current,
                style: sdk.MapStyle.STREETS.LIGHT,
                center: toLngLat(DEFAULT_CENTER),
                zoom: DEFAULT_ZOOM,
                navigationControl: false,
                geolocateControl: false,
                terrainControl: false,
                scaleControl: false,
                fullscreenControl: false,
                projectionControl: false,
                doubleClickZoom: true,
            });
            // A style swap (Map ↔ Satellite) can replace the style without a full 'style.load',
            // so re-add our layers whenever style data arrives and they're missing.
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

    // Fit to the saved zones once both the map and the draft are ready.
    const didInitialFit = useRef(false);
    useEffect(() => {
        const map = mapRef.current;
        if (!ready || !loaded || !map || didInitialFit.current) return;
        didInitialFit.current = true;
        const all = zones.flatMap(z => z.points);
        if (all.length) map.fitBounds(boundsOf(all), { padding: 80, maxZoom: 17.5, duration: 1400 });
    }, [ready, loaded, zones]);

    const firstStyle = useRef(true);
    useEffect(() => {
        const map = mapRef.current;
        const sdk = sdkRef.current;
        if (!ready || !map || !sdk) return;
        if (firstStyle.current && base === 'map') { firstStyle.current = false; return; }
        firstStyle.current = false;
        map.setStyle(base === 'satellite' ? sdk.MapStyle.HYBRID : sdk.MapStyle.STREETS.LIGHT);
    }, [base, ready]);

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
        const onClick = (e: MapTiler.MapLayerMouseEvent) => {
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
        const onClick = (e: MapTiler.MapMouseEvent) => {
            setDraft(prev => [...prev, [e.lngLat.lat, e.lngLat.lng]]);
        };
        const onMove = (e: MapTiler.MapMouseEvent) => {
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
        focusZone(zone);
    }, [focusZone]);

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

    /* ── Search (MapTiler geocoding) ──────────────────────────── */
    const runSearch = useCallback(async (q: string) => {
        const term = q.trim();
        if (term.length < 3 || !MAPTILER_KEY) return;
        const seq = ++searchSeq.current;
        setSearching(true);
        setSearchError('');
        try {
            const sdk = sdkRef.current ?? await import('@maptiler/sdk');
            sdk.config.apiKey = MAPTILER_KEY;
            const center = mapRef.current?.getCenter();
            const res = await sdk.geocoding.forward(term, {
                limit: 6,
                ...(center ? { proximity: [center.lng, center.lat] as [number, number] } : {}),
            });
            if (seq !== searchSeq.current) return;
            setResults(featuresToPlaces((res?.features || []) as unknown as GeocodingFeatureLike[]));
            setSearched(term);
        } catch {
            if (seq !== searchSeq.current) return;
            setResults([]);
            setSearchError('Search isn’t responding. Try again in a moment.');
        } finally {
            if (seq === searchSeq.current) setSearching(false);
        }
    }, []);

    useEffect(() => {
        const term = query.trim();
        if (term.length < 3 || term === searched) return;
        const t = setTimeout(() => void runSearch(term), 450);
        return () => clearTimeout(t);
    }, [query, searched, runSearch]);

    const pickPlace = useCallback((place: PlaceResult) => {
        const sdk = sdkRef.current;
        const map = mapRef.current;
        setPickedPlace(place);
        if (!sdk || !map) return;
        const target = place.outline ? boundsOf(place.outline) : place.bounds ? [toLngLat(place.bounds[0]), toLngLat(place.bounds[1])] as [LngLat, LngLat] : null;
        if (target) map.fitBounds(target, { padding: 90, maxZoom: 17.5, duration: 1800, essential: true });
        else map.flyTo({ center: toLngLat(place.center), zoom: 16.5, duration: 1800, essential: true });
        setData(map, 'geo-place', place.outline
            ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ring(place.outline) } }
            : EMPTY_FC);
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
        setData(mapRef.current, 'geo-place', EMPTY_FC);
    }, []);

    const applyOutline = useCallback((place: PlaceResult) => {
        if (!place.outline) return;
        const now = new Date().toISOString();
        const zone: GeofenceZone = { id: newZoneId(), name: place.name, points: place.outline, createdAt: now, updatedAt: now };
        setZones(prev => [...prev, zone]);
        setSelectedId(zone.id);
        clearPlace();
        setMode('idle');
        notify('Outline added as a zone. Adjust it with Edit shape if needed.', 'success');
    }, [clearPlace, notify]);

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
                                        disabled={!MAPTILER_KEY}
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
                                                    <span className="geo-result__icon"><Icon name={place.outline ? 'pentagon' : 'place'} size={16} /></span>
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
                                            {pickedPlace.outline
                                                ? `This place has a mapped outline (${formatArea(polygonAreaM2(pickedPlace.outline))}). Use it, or draw your own.`
                                                : 'Zoom in and trace your facility’s boundary.'}
                                        </p>
                                        <div className="geo-row">
                                            {pickedPlace.outline ? (
                                                <button type="button" className="geo-btn geo-btn--primary" onClick={() => applyOutline(pickedPlace)} disabled={mode !== 'idle'}>
                                                    <Icon name="pentagon" size={16} /> Use outline
                                                </button>
                                            ) : null}
                                            <button
                                                type="button"
                                                className={`geo-btn${pickedPlace.outline ? '' : ' geo-btn--primary'}`}
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
                                        {mapError === 'missing-key' ? 'Map key needed' : mapError === 'bad-key' ? 'MapTiler rejected the key' : 'The map couldn’t load'}
                                    </p>
                                    <p className="geo-note" style={{ margin: 0, maxWidth: '44ch', textAlign: 'center' }}>
                                        {mapError === 'load-failed'
                                            ? 'Check your connection and refresh the page.'
                                            : <>Set <code>NEXT_PUBLIC_MAPTILER_KEY</code> in <code>.env.local</code> to a MapTiler Cloud key (allowed for this domain), then restart the dev server.</>}
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
