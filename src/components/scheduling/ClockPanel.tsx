'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { resolveClientFacilityId } from '@/lib/facility-client';
import { loadDraftZones, polygonCentroid, type GeofenceZone, type LatLng } from '@/lib/geofence';
import { errorText, type ClockSettings } from '@/lib/scheduling-api';
import { Bones, Card, Icon, LoadError, NumberInput, Row, SaveBar, Segmented, Switch, sameJson, type Notify } from './ui';
import { useSchedDoc } from './useSchedDoc';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
const MIN_RADIUS = 50;
const MAX_RADIUS = 2000;

const MODES: Record<string, { label: string; desc: string }> = {
    confirm: { label: 'Staff confirm', desc: 'Staff tap to clock in and out on their phone; Helix checks they are on site.' },
    automatic: { label: 'Automatic', desc: 'Phones clock staff in and out when they cross the facility boundary.' },
};

function normalize(raw: unknown): ClockSettings {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ClockSettings>;
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const b = r.boundary;
    return {
        mode: r.mode || 'confirm',
        time_zone: r.time_zone || 'Africa/Accra',
        early_arrival_minutes: n(r.early_arrival_minutes),
        short_tolerance_minutes: n(r.short_tolerance_minutes),
        auto_close_minutes: n(r.auto_close_minutes),
        clock_out_reminder_minutes: n(r.clock_out_reminder_minutes),
        boundary_enabled: !!r.boundary_enabled,
        boundary: b && Number.isFinite(b.center_lat) && Number.isFinite(b.center_lng) && b.radius_m
            ? { center_lat: b.center_lat, center_lng: b.center_lng, radius_m: b.radius_m }
            : null,
        updated_at: r.updated_at,
        updated_by: r.updated_by,
    };
}

function distanceM([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
    const rad = (d: number) => (d * Math.PI) / 180;
    const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
    return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Smallest circle around the zone's centroid that covers every corner, clamped to what phones allow. */
function circleForZone(zone: GeofenceZone) {
    const [lat, lng] = polygonCentroid(zone.points);
    const far = Math.max(...zone.points.map(p => distanceM([lat, lng], p)));
    const radius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Math.ceil((far + 10) / 5) * 5));
    return { center_lat: Number(lat.toFixed(6)), center_lng: Number(lng.toFixed(6)), radius_m: radius };
}

/** Mapbox Static Images preview of the boundary circle. */
function previewUrl(b: { center_lat: number; center_lng: number; radius_m: number }): string {
    const ring: number[][] = [];
    for (let i = 0; i <= 40; i++) {
        const t = (i / 40) * 2 * Math.PI;
        const dLat = (b.radius_m / 111320) * Math.sin(t);
        const dLng = (b.radius_m / (111320 * Math.cos((b.center_lat * Math.PI) / 180))) * Math.cos(t);
        ring.push([Number((b.center_lng + dLng).toFixed(6)), Number((b.center_lat + dLat).toFixed(6))]);
    }
    const shape = {
        type: 'Feature',
        properties: { stroke: '#1b2a44', 'stroke-width': 2.5, fill: '#2f6fb8', 'fill-opacity': 0.25 },
        geometry: { type: 'Polygon', coordinates: [ring] },
    };
    const overlay = `geojson(${encodeURIComponent(JSON.stringify(shape))})`;
    return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${overlay}/auto/720x300@2x?padding=40&access_token=${MAPBOX_TOKEN}`;
}

export default function ClockPanel({ onNotify }: { onNotify: Notify }) {
    const doc = useSchedDoc({ path: 'clock-settings', key: 'facility', normalize });
    const d = doc.draft;
    const [zones, setZones] = useState<GeofenceZone[]>([]);

    useEffect(() => {
        let alive = true;
        void resolveClientFacilityId().then(id => {
            if (alive) setZones(loadDraftZones(id || ''));
        }).catch(() => {});
        return () => { alive = false; };
    }, []);

    const modeOptions = useMemo(() => {
        const opts = Object.entries(MODES).map(([value, m]) => ({ value, label: m.label }));
        if (d && !MODES[d.mode]) opts.push({ value: d.mode, label: d.mode });
        return opts;
    }, [d]);

    if (doc.loading && !d) return <section className="st-card"><Bones rows={5} /></section>;
    if (doc.error && !d) return <LoadError message={doc.error} onRetry={() => void doc.reload()} />;
    if (!d) return null;

    const set = <K extends keyof ClockSettings>(k: K, v: ClockSettings[K]) => doc.setDraft(prev => (prev ? { ...prev, [k]: v } : prev));
    const setBoundary = (b: ClockSettings['boundary']) => doc.setDraft(prev => (prev ? { ...prev, boundary: b, boundary_enabled: b ? prev.boundary_enabled : false } : prev));
    const radiusOk = !d.boundary || (d.boundary.radius_m >= MIN_RADIUS && d.boundary.radius_m <= MAX_RADIUS);

    const save = async () => {
        if (!radiusOk) {
            onNotify(`The radius must be between ${MIN_RADIUS} and ${MAX_RADIUS} m.`, 'error');
            return;
        }
        const s = doc.saved;
        const body: Record<string, unknown> = {
            mode: d.mode,
            time_zone: d.time_zone,
            early_arrival_minutes: d.early_arrival_minutes,
            short_tolerance_minutes: d.short_tolerance_minutes,
            auto_close_minutes: d.auto_close_minutes,
            clock_out_reminder_minutes: d.clock_out_reminder_minutes,
            boundary_enabled: d.boundary_enabled && !!d.boundary,
        };
        if (d.boundary) body.boundary = d.boundary;
        else if (s?.boundary) body.clear_boundary = true;
        try {
            await doc.save(body);
            onNotify('Clock-in settings saved', 'success');
        } catch (err) {
            onNotify(errorText(err), 'error');
        }
    };

    return (
        <div className="st-stack">
            <Card icon="fingerprint" title="How staff clock in">
                <Row label="Clock-in mode" desc={MODES[d.mode]?.desc} stack>
                    <Segmented label="Clock-in mode" value={d.mode} options={modeOptions} onChange={v => set('mode', v)} />
                </Row>
                <Row label="Time zone">
                    <input className="st-input" style={{ width: 200 }} value={d.time_zone} onChange={e => set('time_zone', e.target.value)} aria-label="Time zone" placeholder="Africa/Accra" />
                </Row>
            </Card>

            <Card icon="timer" title="Timing" sub="Minutes, relative to each shift.">
                <Row label="Earliest clock-in" desc="How long before the shift starts staff can clock in.">
                    <NumberInput label="Early arrival minutes" value={d.early_arrival_minutes} onChange={v => set('early_arrival_minutes', v)} suffix="min" width={112} />
                </Row>
                <Row label="Short-shift tolerance" desc="Leaving this much early isn’t flagged as short.">
                    <NumberInput label="Short tolerance minutes" value={d.short_tolerance_minutes} onChange={v => set('short_tolerance_minutes', v)} suffix="min" width={112} />
                </Row>
                <Row label="Clock-out reminder" desc="Remind staff this long after the shift ends.">
                    <NumberInput label="Clock-out reminder minutes" value={d.clock_out_reminder_minutes} onChange={v => set('clock_out_reminder_minutes', v)} suffix="min" width={112} />
                </Row>
                <Row label="Auto clock-out" desc="Close an open record this long after the shift ends.">
                    <NumberInput label="Auto close minutes" value={d.auto_close_minutes} onChange={v => set('auto_close_minutes', v)} suffix="min" width={112} />
                </Row>
            </Card>

            <Card
                icon="share_location"
                title="Facility boundary"
                sub="Staff must be inside this circle to clock in. Phones can only watch circles, 50–2000 m across."
                actions={<Link href="/geofence" className="st-btn st-btn--sm st-btn--ghost"><Icon name="draw" /> Draw zones</Link>}
            >
                <Row label="Check location on clock-in" desc={d.boundary ? undefined : 'Set a boundary first.'}>
                    <Switch label="Check location" checked={d.boundary_enabled && !!d.boundary} disabled={!d.boundary} onChange={v => set('boundary_enabled', v)} />
                </Row>
                {zones.length > 0 && (
                    <Row label="Use a drawn zone" desc="Fits a circle around a zone from the geofence page." stack>
                        <div className="sc-zonepick">
                            {zones.map(z => (
                                <button key={z.id} type="button" className="st-btn st-btn--sm" onClick={() => setBoundary(circleForZone(z))}>
                                    <Icon name="pentagon" /> {z.name || 'Untitled zone'}
                                </button>
                            ))}
                        </div>
                    </Row>
                )}
                <div className="sc-boundary">
                    <div className="sc-grid3">
                        <label className="st-field">
                            <span className="st-field__label">Latitude</span>
                            <input className="st-input st-input--mono" type="number" step="0.000001" value={d.boundary?.center_lat ?? ''} placeholder="5.6037"
                                onChange={e => setBoundary({ center_lat: Number(e.target.value), center_lng: d.boundary?.center_lng ?? 0, radius_m: d.boundary?.radius_m ?? 150 })} />
                        </label>
                        <label className="st-field">
                            <span className="st-field__label">Longitude</span>
                            <input className="st-input st-input--mono" type="number" step="0.000001" value={d.boundary?.center_lng ?? ''} placeholder="-0.1870"
                                onChange={e => setBoundary({ center_lat: d.boundary?.center_lat ?? 0, center_lng: Number(e.target.value), radius_m: d.boundary?.radius_m ?? 150 })} />
                        </label>
                        <label className={`st-field${radiusOk ? '' : ' is-invalid'}`}>
                            <span className="st-field__label">Radius (m)</span>
                            <input className="st-input" type="number" min={MIN_RADIUS} max={MAX_RADIUS} step={5} value={d.boundary?.radius_m ?? ''} placeholder="150"
                                onChange={e => setBoundary({ center_lat: d.boundary?.center_lat ?? 0, center_lng: d.boundary?.center_lng ?? 0, radius_m: Number(e.target.value) })} />
                        </label>
                    </div>
                    {d.boundary && d.boundary.center_lat && d.boundary.center_lng && radiusOk && MAPBOX_TOKEN ? (
                        // eslint-disable-next-line @next/next/no-img-element -- remote static map, sized by the API
                        <img className="sc-boundary__map" src={previewUrl(d.boundary)} alt={`Boundary: ${d.boundary.radius_m} m around ${d.boundary.center_lat}, ${d.boundary.center_lng}`} />
                    ) : (
                        <div className="sc-boundary__empty"><Icon name="map" /> {d.boundary ? (radiusOk ? 'Enter a location to preview' : `Radius must be ${MIN_RADIUS}–${MAX_RADIUS} m`) : 'No boundary set'}</div>
                    )}
                    {d.boundary && (
                        <button type="button" className="st-btn st-btn--ghost st-btn--sm sc-boundary__clear" onClick={() => setBoundary(null)}>
                            <Icon name="delete_outline" /> Remove boundary
                        </button>
                    )}
                </div>
            </Card>

            <SaveBar dirty={!sameJson(d, doc.saved)} saving={doc.saving} onSave={() => void save()} onDiscard={doc.discard} />
        </div>
    );
}
