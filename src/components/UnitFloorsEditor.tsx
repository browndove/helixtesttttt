'use client';

import { useEffect, useRef, useState } from 'react';
import { API_ENDPOINTS } from '@/lib/config';
import {
    careUnitApiMessage,
    parseCareUnitFloor,
    type CareUnitFloor,
} from '@/lib/care-units';

type UnitFloorsEditorProps = {
    unitId: string;
    floors: CareUnitFloor[];
    canEdit: boolean;
    onChange: (floors: CareUnitFloor[]) => void;
    selectedFloorId?: string | null;
    onSelectFloor?: (floorId: string | null) => void;
    showAllTab?: boolean;
    floorCounts?: Record<string, number>;
    allCount?: number;
    /** Beds stay locked until this unit has a floor. */
    showBedGate?: boolean;
};

function sortFloors(floors: CareUnitFloor[]): CareUnitFloor[] {
    return [...floors].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

export default function UnitFloorsEditor({
    unitId,
    floors,
    canEdit,
    onChange,
    selectedFloorId,
    onSelectFloor,
    showAllTab = false,
    floorCounts,
    allCount = 0,
    showBedGate = false,
}: UnitFloorsEditorProps) {
    const [name, setName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftName, setDraftName] = useState('');
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const addFloorInputRef = useRef<HTMLInputElement>(null);
    const ordered = sortFloors(floors);
    const selectedId = selectedFloorId !== undefined ? selectedFloorId : localSelectedId;
    const selectedFloor = ordered.find(floor => floor.id === selectedId) || null;

    const [isAddingFloor, setIsAddingFloor] = useState(false);

    const selectFloor = (floorId: string | null) => {
        if (floorId && selectedFloorId === undefined) setLocalSelectedId(floorId);
        onSelectFloor?.(floorId);
    };

    useEffect(() => {
        if (showAllTab || ordered.length === 0) return;
        if (selectedId && ordered.some(floor => floor.id === selectedId)) return;
        selectFloor(ordered[0].id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showAllTab, ordered.map(floor => floor.id).join('|')]);

    const addFloor = async () => {
        const trimmed = name.trim();
        if (!trimmed || busy) return;
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(API_ENDPOINTS.UNIT_FLOORS(unitId), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: trimmed }),
            });
            const raw = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(careUnitApiMessage(raw, 'Failed to add floor'));
                return;
            }
            const floor = parseCareUnitFloor(raw);
            if (!floor) {
                setError('Unexpected floor response');
                return;
            }
            onChange(sortFloors([...floors, floor]));
            setName('');
            setIsAddingFloor(false);
            selectFloor(floor.id);
        } catch {
            setError('Failed to add floor');
        } finally {
            setBusy(false);
        }
    };

    const renameFloor = async (floor: CareUnitFloor) => {
        const trimmed = draftName.trim();
        if (!trimmed || busy) return;
        if (trimmed === floor.name) {
            setEditingId(null);
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(API_ENDPOINTS.UNIT_FLOOR(unitId, floor.id), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: trimmed, sort_order: floor.sort_order }),
            });
            const raw = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(careUnitApiMessage(raw, 'Failed to rename floor'));
                return;
            }
            const updated = parseCareUnitFloor(raw) || { ...floor, name: trimmed };
            onChange(sortFloors(floors.map(item => (item.id === floor.id ? updated : item))));
            setEditingId(null);
        } catch {
            setError('Failed to rename floor');
        } finally {
            setBusy(false);
        }
    };

    const removeFloor = async (floor: CareUnitFloor) => {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(API_ENDPOINTS.UNIT_FLOOR(unitId, floor.id), {
                method: 'DELETE',
                credentials: 'include',
            });
            const raw = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(careUnitApiMessage(raw, 'Failed to remove floor'));
                return;
            }
            onChange(floors.filter(item => item.id !== floor.id));
            setPendingDeleteId(null);
            const remaining = ordered.filter(item => item.id !== floor.id);
            if (selectedId === floor.id && remaining[0]) selectFloor(remaining[0].id);
        } catch {
            setError('Failed to remove floor');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ minWidth: 0, maxWidth: '100%' }}>
            <style>{`
                .floor-tab-scroll {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    overflow-x: auto;
                    overflow-y: hidden;
                    flex: 1 1 auto;
                    min-width: 0;
                    max-width: 100%;
                    flex-wrap: nowrap;
                    padding: 3px;
                    background: #F1F5F9;
                    border-radius: 10px;
                    scrollbar-width: none;
                }
                .floor-tab-scroll::-webkit-scrollbar { display: none; }
                .floor-tab-item {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    height: 32px;
                    padding: 0 12px;
                    border-radius: 7px;
                    border: none;
                    font-size: 12.5px;
                    font-weight: 600;
                    white-space: nowrap;
                    cursor: pointer;
                    transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .floor-tab-item.active {
                    background: #FFFFFF;
                    color: #0F172A;
                    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04);
                }
                .floor-tab-item.inactive {
                    background: transparent;
                    color: #64748B;
                }
                .floor-tab-item.inactive:hover {
                    color: #0F172A;
                    background: rgba(255, 255, 255, 0.5);
                }
            `}</style>

            {showBedGate && ordered.length === 0 && (
                <div style={{
                    padding: '10px 14px', borderRadius: 8, background: '#FFFBEB',
                    border: '1px solid #FDE68A', color: '#92400E', fontSize: 12.5,
                    marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8
                }}>
                    <span>{canEdit ? 'Add at least one floor before beds can be mapped.' : 'An admin must add floors before beds can be mapped.'}</span>
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, maxWidth: '100%', flexWrap: 'wrap' }}>
                <div className="floor-tab-scroll">
                    {showAllTab && (
                        <button
                            type="button"
                            onClick={() => selectFloor(null)}
                            className={`floor-tab-item ${selectedId === null ? 'active' : 'inactive'}`}
                        >
                            All floors
                            <span style={{
                                fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                                background: selectedId === null ? '#0F172A' : '#E2E8F0',
                                color: selectedId === null ? '#FFFFFF' : '#475569',
                                transition: 'all 0.15s ease'
                            }}>
                                {allCount}
                            </span>
                        </button>
                    )}

                    {ordered.map(floor => {
                        const selected = floor.id === selectedId;
                        const count = floorCounts?.[floor.id] ?? 0;
                        return (
                            <button
                                key={floor.id}
                                type="button"
                                onClick={() => selectFloor(floor.id)}
                                className={`floor-tab-item ${selected ? 'active' : 'inactive'}`}
                            >
                                {floor.name}
                                <span style={{
                                    fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                                    background: selected ? '#2563EB' : '#E2E8F0',
                                    color: selected ? '#FFFFFF' : '#475569',
                                    transition: 'all 0.15s ease'
                                }}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {canEdit && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {!isAddingFloor ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsAddingFloor(true);
                                    setTimeout(() => addFloorInputRef.current?.focus(), 50);
                                }}
                                style={{
                                    height: 38, padding: '0 12px', borderRadius: 8,
                                    border: '1px dashed #CBD5E1', background: '#FFFFFF',
                                    color: '#2563EB', fontSize: 12.5, fontWeight: 600,
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                    cursor: 'pointer', transition: 'all 0.15s ease',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                + Add floor
                            </button>
                        ) : (
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: 3, background: '#FFFFFF', border: '1px solid #2563EB',
                                borderRadius: 8, boxShadow: '0 2px 8px rgba(37, 99, 235, 0.12)'
                            }}>
                                <input
                                    ref={addFloorInputRef}
                                    type="text"
                                    value={name}
                                    disabled={busy}
                                    placeholder="e.g. Floor 1, PACU"
                                    onChange={e => setName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            void addFloor();
                                        } else if (e.key === 'Escape') {
                                            setIsAddingFloor(false);
                                            setName('');
                                        }
                                    }}
                                    style={{
                                        height: 28, padding: '0 8px', border: 'none', outline: 'none',
                                        fontSize: 12.5, color: '#0F172A', background: 'transparent',
                                        width: 140
                                    }}
                                />
                                <button
                                    type="button"
                                    disabled={busy || !name.trim()}
                                    onClick={() => void addFloor()}
                                    style={{
                                        height: 28, padding: '0 10px', borderRadius: 6, border: 'none',
                                        background: '#2563EB', color: '#FFFFFF', fontSize: 12, fontWeight: 600,
                                        cursor: busy || !name.trim() ? 'default' : 'pointer',
                                        opacity: busy || !name.trim() ? 0.5 : 1
                                    }}
                                >
                                    {busy ? 'Saving…' : 'Add'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setIsAddingFloor(false); setName(''); }}
                                    style={{
                                        height: 28, padding: '0 6px', border: 'none', background: 'transparent',
                                        color: '#64748B', fontSize: 12, cursor: 'pointer'
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Floor settings action bar (Rename / Delete) when floor is active */}
            {canEdit && selectedFloor && editingId !== selectedFloor.id && pendingDeleteId !== selectedFloor.id && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, paddingLeft: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Selected: <strong style={{ color: '#334155' }}>{selectedFloor.name}</strong>
                    </span>
                    <span style={{ color: '#E2E8F0' }}>|</span>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                            setEditingId(selectedFloor.id);
                            setDraftName(selectedFloor.name);
                            setPendingDeleteId(null);
                        }}
                        style={{ border: 'none', background: 'none', padding: 0, color: '#2563EB', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
                    >
                        Rename floor
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => setPendingDeleteId(selectedFloor.id)}
                        style={{ border: 'none', background: 'none', padding: 0, color: '#EF4444', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
                    >
                        Delete floor
                    </button>
                </div>
            )}

            {canEdit && selectedFloor && editingId === selectedFloor.id && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                    <input
                        className="input"
                        value={draftName}
                        autoFocus
                        disabled={busy}
                        onChange={e => setDraftName(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                void renameFloor(selectedFloor);
                            }
                            if (e.key === 'Escape') setEditingId(null);
                        }}
                        style={{ flex: 1, minWidth: 0, fontSize: 12.5, height: 30, padding: '0 8px', borderRadius: 6, border: '1px solid #CBD5E1' }}
                    />
                    <button
                        type="button"
                        disabled={busy || !draftName.trim()}
                        onClick={() => void renameFloor(selectedFloor)}
                        style={{ height: 30, padding: '0 10px', borderRadius: 6, border: 'none', background: '#2563EB', color: '#FFFFFF', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                        Save
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => setEditingId(null)}
                        style={{ height: 30, padding: '0 8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                    >
                        Cancel
                    </button>
                </div>
            )}

            {canEdit && selectedFloor && pendingDeleteId === selectedFloor.id && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, padding: '6px 10px', background: '#FEF2F2', borderRadius: 6, border: '1px solid #FCA5A5' }}>
                    <span style={{ fontSize: 12, color: '#991B1B', fontWeight: 500 }}>Delete "{selectedFloor.name}" and unassign its beds?</span>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void removeFloor(selectedFloor)}
                        style={{ height: 26, padding: '0 10px', borderRadius: 5, border: 'none', background: '#EF4444', color: '#FFFFFF', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
                    >
                        Confirm Delete
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => setPendingDeleteId(null)}
                        style={{ height: 26, padding: '0 8px', border: 'none', background: 'transparent', color: '#475569', fontSize: 11.5, cursor: 'pointer' }}
                    >
                        Cancel
                    </button>
                </div>
            )}

            {error && (
                <p style={{ fontSize: 12, color: '#DC2626', margin: '6px 0 0', fontWeight: 500 }}>{error}</p>
            )}
        </div>
    );
}

