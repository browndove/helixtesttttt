'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import TopBar from '@/components/TopBar';
import { DEPARTMENT_DESCRIPTION_MAX_LENGTH, DEPARTMENT_NAME_MAX_LENGTH } from '@/lib/departmentName';

/** Lock main column to the viewport so only inner panes scroll (not the document). */
const departmentsAppMainStyle = {
    height: '100vh' as const,
    minHeight: 0,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    overflow: 'hidden' as const,
};

type FloorItem = { id: string; name: string };
type WardItem = { id: string; name: string };
type Department = {
    id: string;
    name: string;
    description: string;
    /** Authoritative count from API; floors[] may be synthetic labels (Floor 1…N) when API omits named floors. */
    number_of_floors: number;
    floors: FloorItem[];
    wards: WardItem[];
};

function normalizeDepartment(raw: Partial<Department> & Record<string, unknown>): Department {
    const desc = raw.description;
    const apiFloors = Array.isArray(raw.floors) ? (raw.floors as FloorItem[]) : [];
    let number_of_floors: number;
    if (apiFloors.length > 0) {
        number_of_floors = apiFloors.length;
    } else {
        const n = raw.number_of_floors;
        number_of_floors = typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    }
    const deptId = String(raw.id || 'dept');
    const floors = apiFloors.length > 0
        ? apiFloors
        : Array.from({ length: number_of_floors }, (_, i) => ({
            id: `${deptId}-floor-${i + 1}`,
            name: `Floor ${i + 1}`,
        }));
    return {
        id: deptId,
        name: raw.name || 'Unnamed Department',
        description: typeof desc === 'string' ? desc : '',
        number_of_floors,
        floors,
        wards: Array.isArray(raw.wards) ? raw.wards : [],
    };
}

export default function DepartmentsManagement() {
    const [hospitalId, setHospitalId] = useState('');
    const [departments, setDepartments] = useState<Department[]>([]);
    const [toast, setToast] = useState<string | null>(null);
    const [editingDept, setEditingDept] = useState<string | null>(null);
    const [newDeptName, setNewDeptName] = useState('');
    const [newDeptDescription, setNewDeptDescription] = useState('');
    const [newDeptFloorsInput, setNewDeptFloorsInput] = useState('');
    const [newDeptWardLines, setNewDeptWardLines] = useState('');
    const [showAddDept, setShowAddDept] = useState(false);
    const [newWard, setNewWard] = useState('');
    const [loading, setLoading] = useState(true);
    const [deptSearch, setDeptSearch] = useState('');
    const [detailName, setDetailName] = useState('');
    const [detailDescription, setDetailDescription] = useState('');
    const [savingDeptDetails, setSavingDeptDetails] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const departmentsRef = useRef(departments);
    departmentsRef.current = departments;

    const showToast = useCallback((msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    }, []);

    const filteredDepartments = useMemo(() => {
        const query = deptSearch.toLowerCase().trim();
        if (!query) return departments;
        return departments.filter(d =>
            d.name.toLowerCase().includes(query)
            || d.floors?.some(f => f.name.toLowerCase().includes(query))
            || d.wards?.some(w => w.name.toLowerCase().includes(query)),
        );
    }, [departments, deptSearch]);

    const fetchData = useCallback(async () => {
        try {
            const hRes = await fetch('/api/proxy/hospital');
            let facilityId = '';
            if (hRes.ok) {
                const h = await hRes.json();
                facilityId = h.id || '';
                setHospitalId(facilityId);
            }
            const deptUrl = facilityId
                ? `/api/proxy/departments?facility_id=${facilityId}`
                : '/api/proxy/departments';
            const dRes = await fetch(deptUrl);
            if (dRes.ok) {
                const d = await dRes.json();
                setDepartments(Array.isArray(d) ? d.map(normalizeDepartment) : []);
            }
        } catch { showToast('Failed to load departments'); }
        setLoading(false);
    }, [showToast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Keep a valid selection: first visible row, or none when list / filter is empty.
    useEffect(() => {
        if (loading) return;
        if (departments.length === 0) {
            setEditingDept(null);
            return;
        }
        if (filteredDepartments.length === 0) {
            setEditingDept(null);
            return;
        }
        if (!editingDept || !filteredDepartments.some(d => d.id === editingDept)) {
            setEditingDept(filteredDepartments[0].id);
        }
    }, [loading, departments.length, filteredDepartments, editingDept]);

    // Show list row immediately, then load full details from GET /departments/{id} (authoritative name/description).
    useEffect(() => {
        if (!editingDept) {
            setDetailName('');
            setDetailDescription('');
            setDetailLoading(false);
            return;
        }
        const local = departmentsRef.current.find(d => d.id === editingDept);
        if (local) {
            setDetailName(local.name);
            setDetailDescription(local.description || '');
        }
        const ac = new AbortController();
        let cancelled = false;
        setDetailLoading(true);
        (async () => {
            try {
                const res = await fetch(`/api/proxy/departments/${editingDept}`, { signal: ac.signal });
                if (!res.ok) throw new Error('bad status');
                const raw = (await res.json()) as Record<string, unknown>;
                if (cancelled) return;
                const normalized = normalizeDepartment(raw as Partial<Department>);
                setDetailName(normalized.name);
                setDetailDescription(normalized.description || '');
                setDepartments(prev => prev.map(d => {
                    if (d.id !== editingDept) return d;
                    return {
                        ...d,
                        name: normalized.name,
                        description: normalized.description,
                        floors: Array.isArray(raw.floors) ? normalized.floors : d.floors,
                        wards: Array.isArray(raw.wards) ? normalized.wards : d.wards,
                    };
                }));
            } catch (e) {
                const aborted = cancelled || (e instanceof Error && e.name === 'AbortError');
                if (aborted) return;
                const fallback = departmentsRef.current.find(d => d.id === editingDept);
                if (fallback) {
                    setDetailName(fallback.name);
                    setDetailDescription(fallback.description || '');
                } else {
                    setDetailName('');
                    setDetailDescription('');
                    showToast('Could not load department details');
                }
            } finally {
                if (!cancelled) setDetailLoading(false);
            }
        })();
        return () => {
            cancelled = true;
            ac.abort();
        };
    }, [editingDept, showToast]);

    const resetNewDepartmentForm = () => {
        setNewDeptName('');
        setNewDeptDescription('');
        setNewDeptFloorsInput('');
        setNewDeptWardLines('');
    };

    const addDepartment = async () => {
        const trimmed = newDeptName.trim();
        if (!trimmed) return;
        if (trimmed.length > DEPARTMENT_NAME_MAX_LENGTH) {
            showToast(`Department name must be ${DEPARTMENT_NAME_MAX_LENGTH} characters or fewer`);
            return;
        }
        if (newDeptDescription.length > DEPARTMENT_DESCRIPTION_MAX_LENGTH) {
            showToast(`Description must be ${DEPARTMENT_DESCRIPTION_MAX_LENGTH} characters or fewer`);
            return;
        }
        let number_of_floors: number | undefined;
        const floorsRaw = newDeptFloorsInput.trim();
        if (floorsRaw !== '') {
            const n = Number.parseInt(floorsRaw, 10);
            if (!Number.isFinite(n) || n < 0) {
                showToast('Number of floors must be zero or a positive whole number');
                return;
            }
            number_of_floors = n;
        }
        const wardNames = newDeptWardLines
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);
        for (const w of wardNames) {
            if (w.length > DEPARTMENT_NAME_MAX_LENGTH) {
                showToast(`Each ward name must be ${DEPARTMENT_NAME_MAX_LENGTH} characters or fewer`);
                return;
            }
        }
        const wards = wardNames.map(name => ({ name, description: '' }));
        try {
            const body: Record<string, unknown> = {
                name: trimmed,
                description: newDeptDescription.trim(),
                facility_id: hospitalId || '',
            };
            if (number_of_floors !== undefined) body.number_of_floors = number_of_floors;
            if (wards.length > 0) body.wards = wards;

            const res = await fetch('/api/proxy/departments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                const dept = await res.json();
                setDepartments(prev => [...prev, normalizeDepartment(dept)]);
                showToast(`${trimmed} added`);
                resetNewDepartmentForm();
                setShowAddDept(false);
            } else {
                const err = await res.json().catch(() => ({} as { error?: string; detail?: string }));
                showToast(String(err.error || err.detail || 'Failed to add department'));
            }
        } catch { showToast('Failed to add department'); }
    };

    const updateDepartmentDetails = async () => {
        const d = departments.find(x => x.id === editingDept);
        if (!d) return;
        const trimmedName = detailName.trim();
        if (!trimmedName) {
            showToast('Department name is required');
            return;
        }
        if (trimmedName.length > DEPARTMENT_NAME_MAX_LENGTH) {
            showToast(`Department name must be ${DEPARTMENT_NAME_MAX_LENGTH} characters or fewer`);
            return;
        }
        if (detailDescription.length > DEPARTMENT_DESCRIPTION_MAX_LENGTH) {
            showToast(`Description must be ${DEPARTMENT_DESCRIPTION_MAX_LENGTH} characters or fewer`);
            return;
        }
        const descTrimmed = detailDescription.trim();
        setSavingDeptDetails(true);
        try {
            const res = await fetch(`/api/proxy/departments/${d.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: trimmedName,
                    description: descTrimmed,
                    number_of_floors: d.number_of_floors,
                    number_of_wards: d.wards.length,
                }),
            });
            const rawText = await res.text();
            let payload: Record<string, unknown> = {};
            if (rawText) {
                try {
                    payload = JSON.parse(rawText) as Record<string, unknown>;
                } catch {
                    if (!res.ok) {
                        showToast('Failed to update department');
                        return;
                    }
                }
            }
            if (!res.ok) {
                const msg = typeof payload.error === 'string' ? payload.error : typeof payload.detail === 'string' ? payload.detail : 'Failed to update department';
                showToast(msg);
                return;
            }
            const body = Object.keys(payload).length > 0 ? payload : { name: trimmedName, description: descTrimmed };
            const merged = {
                ...d,
                ...body,
                wards: Array.isArray(body.wards) ? body.wards as WardItem[] : d.wards,
            };
            const updated = normalizeDepartment(merged);
            setDepartments(prev => prev.map(x => (x.id === d.id ? updated : x)));
            setDetailName(updated.name);
            setDetailDescription(updated.description || '');
            showToast('Department updated');
        } catch {
            showToast('Failed to update department');
        } finally {
            setSavingDeptDetails(false);
        }
    };

    const removeDepartment = async (id: string) => {
        const dept = departments.find(d => d.id === id);
        try {
            const res = await fetch(`/api/proxy/departments/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setDepartments(prev => prev.filter(d => d.id !== id));
                showToast(`${dept?.name} removed`);
                if (editingDept === id) setEditingDept(null);
            }
        } catch { showToast('Failed to remove department'); }
    };

    const addWard = async (deptId: string) => {
        if (!newWard.trim()) return;
        try {
            const res = await fetch(`/api/proxy/departments/${deptId}/wards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newWard.trim() }),
            });
            if (res.ok) {
                const ward = await res.json();
                setDepartments(prev => prev.map(d => d.id === deptId ? { ...d, wards: [...(d.wards || []), ward] } : d));
                showToast(`Ward "${newWard}" added`);
                setNewWard('');
            }
        } catch { showToast('Failed to add ward'); }
    };

    const removeWard = async (deptId: string, wardId: string) => {
        try {
            const res = await fetch(`/api/proxy/departments/${deptId}/wards/${wardId}`, { method: 'DELETE' });
            if (res.ok) {
                setDepartments(prev => prev.map(d => d.id === deptId ? { ...d, wards: (d.wards || []).filter(w => w.id !== wardId) } : d));
            }
        } catch { showToast('Failed to remove ward'); }
    };

    /** Helix API has no POST /departments/{id}/floors — floor count is updated incrementally on the department (PUT). */
    const putDepartmentFloorCount = async (deptId: string, nextCount: number): Promise<boolean> => {
        const d = departments.find(x => x.id === deptId);
        if (!d) return false;
        const n = Math.max(0, Math.floor(nextCount));
        try {
            const res = await fetch(`/api/proxy/departments/${deptId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: d.name,
                    description: d.description || '',
                    number_of_floors: n,
                    number_of_wards: d.wards.length,
                }),
            });
            const rawText = await res.text();
            let payload: Record<string, unknown> = {};
            if (rawText) {
                try {
                    payload = JSON.parse(rawText) as Record<string, unknown>;
                } catch {
                    if (!res.ok) {
                        showToast('Failed to update floors');
                        return false;
                    }
                }
            }
            if (!res.ok) {
                const msg = typeof payload.error === 'string' ? payload.error : typeof payload.detail === 'string' ? payload.detail : 'Failed to update floors';
                showToast(msg);
                return false;
            }

            // Keep the local floor chips in sync with the updated count so
            // repeated "Add floor" clicks actually show additional floors.
            const currentFloors = Array.isArray(d.floors) ? d.floors as FloorItem[] : [];
            let nextFloors: FloorItem[] = currentFloors;
            if (currentFloors.length !== n) {
                if (currentFloors.length > n) {
                    nextFloors = currentFloors.slice(0, n);
                } else {
                    const baseId = String(d.id || 'dept');
                    const extra: FloorItem[] = [];
                    for (let i = currentFloors.length; i < n; i += 1) {
                        const labelIndex = i + 1;
                        extra.push({
                            id: `${baseId}-floor-${labelIndex}`,
                            name: `Floor ${labelIndex}`,
                        });
                    }
                    nextFloors = [...currentFloors, ...extra];
                }
            }

            const merged = {
                ...d,
                ...payload,
                number_of_floors: n,
                floors: nextFloors,
                wards: Array.isArray(payload.wards) ? (payload.wards as WardItem[]) : d.wards,
            };
            const updated = normalizeDepartment(merged as Partial<Department> & Record<string, unknown>);
            setDepartments(prev => prev.map(x => (x.id === deptId ? updated : x)));
            return true;
        } catch {
            showToast('Failed to update floors');
            return false;
        }
    };

    const addFloor = async (deptId: string) => {
        const d = departments.find(x => x.id === deptId);
        if (!d) return;
        const ok = await putDepartmentFloorCount(deptId, d.number_of_floors + 1);
        if (ok) showToast('Floor added');
    };

    const removeFloor = async (deptId: string) => {
        const d = departments.find(x => x.id === deptId);
        if (!d || d.number_of_floors <= 0) return;
        const ok = await putDepartmentFloorCount(deptId, d.number_of_floors - 1);
        if (ok) showToast('Floor removed');
    };

    const editDept = departments.find(d => d.id === editingDept);
    const deptDetailsDirty = Boolean(
        editDept
        && (detailName.trim() !== editDept.name
            || detailDescription.trim() !== (editDept.description || '').trim()),
    );

    if (loading) {
        const shimmer = {
            background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border-subtle) 50%, var(--surface-2) 75%)',
            backgroundSize: '400% 100%',
            animation: 'shimmer 1.4s ease infinite',
            borderRadius: 'var(--radius-md)',
        };
        const line = (w: string, h = 12) => <div style={{ ...shimmer, width: w, height: h, marginBottom: 8 }} />;
        return (
                <div className="app-main" style={departmentsAppMainStyle}>
                    <TopBar title="Departments" subtitle="Floors and wards by department" />
                    <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '20px 24px 24px', background: 'var(--bg-900)' }}>
                        <div className="fade-in card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                                {line('45%', 14)}
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 320px) 1fr', gap: 16, marginTop: 14 }}>
                                    <div style={{ ...shimmer, height: 40 }} />
                                    <div style={{ ...shimmer, height: 40 }} />
                                </div>
                            </div>
                            <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', overflow: 'hidden' }}>
                                <div style={{ borderRight: '1px solid var(--border-subtle)', padding: 12, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0, overflowY: 'auto' }}>
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} style={{ ...shimmer, height: 48, borderRadius: 8 }} />)}
                                </div>
                                <div style={{ padding: 20, minHeight: 0, overflow: 'hidden' }}>
                                    <div style={{ ...shimmer, height: '100%', minHeight: 280, borderRadius: 'var(--radius-md)' }} />
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
        );
    }

    return (
        <>
            {toast && (
                <div className="toast-enter" style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '10px 18px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--success)' }}>check_circle</span>
                    {toast}
                </div>
            )}

            <div className="app-main" style={departmentsAppMainStyle}>
                <TopBar title="Departments" subtitle="Manage departments, floors, and wards for this facility" />

                <main style={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    padding: '20px 24px 24px',
                    background: 'var(--bg-900)',
                }}
                >
                    <div
                        className="fade-in card"
                        style={{
                            flex: 1,
                            minHeight: 0,
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            padding: 0,
                        }}
                    >
                        {/* Toolbar — column + gap avoids wrapped controls overlapping the search row */}
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)', minWidth: 0 }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{departments.length}</span>
                                        {' '}department{departments.length !== 1 ? 's' : ''}
                                        {deptSearch.trim() ? (
                                            <span style={{ marginLeft: 8 }}>
                                                · <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{filteredDepartments.length}</span> shown
                                            </span>
                                        ) : null}
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={() => {
                                            if (showAddDept) resetNewDepartmentForm();
                                            setShowAddDept(!showAddDept);
                                        }}
                                        style={{ flexShrink: 0 }}
                                    >
                                        <span className="material-icons-round" style={{ fontSize: 14 }}>{showAddDept ? 'close' : 'add'}</span>
                                        {showAddDept ? 'Cancel' : 'Add Department'}
                                    </button>
                                </div>

                                {showAddDept && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'stretch', maxWidth: 640 }}>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                            <input
                                                className="input"
                                                placeholder="Department name"
                                                value={newDeptName}
                                                maxLength={DEPARTMENT_NAME_MAX_LENGTH}
                                                onChange={e => setNewDeptName(e.target.value.slice(0, DEPARTMENT_NAME_MAX_LENGTH))}
                                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addDepartment()}
                                                style={{ fontSize: 13, flex: '1 1 220px', minWidth: 160, maxWidth: '100%', boxSizing: 'border-box' }}
                                                aria-describedby="dept-name-limit-hint"
                                            />
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }} id="dept-name-limit-hint">
                                                {newDeptName.length}/{DEPARTMENT_NAME_MAX_LENGTH}
                                            </span>
                                            <button type="button" className="btn btn-primary btn-sm" onClick={addDepartment} disabled={!newDeptName.trim()} style={{ flexShrink: 0 }}>Add</button>
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                                                <span className="label" style={{ marginBottom: 0 }}>Description</span>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                                    {newDeptDescription.length}/{DEPARTMENT_DESCRIPTION_MAX_LENGTH}
                                                </span>
                                            </div>
                                            <textarea
                                                className="input"
                                                value={newDeptDescription}
                                                maxLength={DEPARTMENT_DESCRIPTION_MAX_LENGTH}
                                                onChange={e => setNewDeptDescription(e.target.value.slice(0, DEPARTMENT_DESCRIPTION_MAX_LENGTH))}
                                                rows={2}
                                                style={{ fontSize: 13, minHeight: 52, resize: 'vertical', boxSizing: 'border-box', width: '100%' }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                                            <div style={{ flex: '1 1 140px', minWidth: 120 }}>
                                                <label className="label" htmlFor="new-dept-floors" style={{ marginBottom: 6 }}>Number of floors</label>
                                                <input
                                                    id="new-dept-floors"
                                                    className="input"
                                                    type="number"
                                                    min={0}
                                                    step={1}
                                                    placeholder="Optional"
                                                    value={newDeptFloorsInput}
                                                    onChange={e => {
                                                        const v = e.target.value;
                                                        if (v === '' || /^\d+$/.test(v)) setNewDeptFloorsInput(v);
                                                    }}
                                                    style={{ fontSize: 13, boxSizing: 'border-box', width: '100%' }}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Wards (optional)</div>
                                            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 6px', lineHeight: 1.4 }}>
                                                One ward name per line. Sent with the create request; the API can create wards and maintain ward count.
                                            </p>
                                            <textarea
                                                className="input"
                                                value={newDeptWardLines}
                                                onChange={e => setNewDeptWardLines(e.target.value)}
                                                placeholder={'e.g.\nICU A\nICU B'}
                                                rows={4}
                                                style={{ fontSize: 13, minHeight: 88, resize: 'vertical', boxSizing: 'border-box', width: '100%' }}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div style={{ position: 'relative', width: '100%' }}>
                                    <span className="material-icons-round" style={{
                                        position: 'absolute',
                                        left: 10,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        fontSize: 18,
                                        color: 'var(--text-muted)',
                                        pointerEvents: 'none',
                                        zIndex: 1,
                                    }}>search</span>
                                    <input
                                        className="input"
                                        type="text"
                                        placeholder="Search by department, floor, or ward…"
                                        value={deptSearch}
                                        onChange={e => setDeptSearch(e.target.value)}
                                        style={{ fontSize: 13, paddingLeft: 38, height: 40, width: '100%', boxSizing: 'border-box' }}
                                    />
                                    {deptSearch ? (
                                        <button
                                            type="button"
                                            onClick={() => setDeptSearch('')}
                                            style={{
                                                position: 'absolute',
                                                right: 8,
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: 4,
                                                display: 'flex',
                                                alignItems: 'center',
                                                color: 'var(--text-muted)',
                                                zIndex: 1,
                                            }}
                                        >
                                            <span className="material-icons-round" style={{ fontSize: 18 }}>close</span>
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        {/* Master–detail: fills remaining viewport */}
                        <div
                            style={{
                                flex: 1,
                                minHeight: 0,
                                display: 'grid',
                                gridTemplateColumns: 'minmax(280px, min(32vw, 380px)) 1fr',
                                overflow: 'hidden',
                            }}
                        >
                            <aside
                                style={{
                                    borderRight: '1px solid var(--border-subtle)',
                                    background: 'var(--surface-2)',
                                    minHeight: 0,
                                    overflowY: 'auto',
                                    padding: '10px 12px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 4,
                                }}
                            >
                                {filteredDepartments.map(d => (
                                    <button
                                        key={d.id}
                                        type="button"
                                        onClick={() => { setEditingDept(d.id); setNewWard(''); }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: '10px 12px',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            width: '100%',
                                            border: `1px solid ${editingDept === d.id ? 'var(--helix-primary)' : 'transparent'}`,
                                            background: editingDept === d.id ? 'var(--surface-card)' : 'transparent',
                                            boxShadow: editingDept === d.id ? '0 1px 3px rgba(30,58,95,0.08)' : 'none',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        <span className="material-icons-round" style={{ fontSize: 18, color: editingDept === d.id ? 'var(--helix-primary)' : 'var(--text-muted)', flexShrink: 0 }}>domain</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{(d.floors || []).length} floors · {(d.wards || []).length} wards</div>
                                        </div>
                                    </button>
                                ))}
                                {departments.length === 0 && (
                                    <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No departments yet. Use Add Department above.</div>
                                )}
                                {departments.length > 0 && filteredDepartments.length === 0 && (
                                    <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                                        <span className="material-icons-round" style={{ fontSize: 28, display: 'block', marginBottom: 8, color: 'var(--text-disabled)' }}>search_off</span>
                                        No matches — try another search
                                    </div>
                                )}
                            </aside>

                            <section style={{ minHeight: 0, overflowY: 'auto', padding: '20px 24px 28px', minWidth: 0, background: 'var(--surface-card)' }}>
                                {editDept ? (
                                    <div className="fade-in" key={editDept.id}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{editDept.name}</h2>
                                                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>Edit details, floors, and wards</p>
                                            </div>
                                            <button type="button" className="btn btn-danger btn-sm" onClick={() => removeDepartment(editDept.id)}>
                                                <span className="material-icons-round" style={{ fontSize: 14 }}>delete</span>
                                                Remove department
                                            </button>
                                        </div>

                                        <div className="card" style={{ padding: '16px 18px', margin: '0 0 24px', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', opacity: detailLoading ? 0.88 : 1, transition: 'opacity 0.15s' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Department details</div>
                                                {detailLoading ? (
                                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span className="material-icons-round" style={{ fontSize: 14 }}>hourglass_empty</span>
                                                        Loading…
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                                                <label className="label" htmlFor="dept-detail-name" style={{ marginBottom: 0 }}>Name</label>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                                                    {detailName.length}/{DEPARTMENT_NAME_MAX_LENGTH}
                                                </span>
                                            </div>
                                            <input
                                                id="dept-detail-name"
                                                className="input"
                                                value={detailName}
                                                maxLength={DEPARTMENT_NAME_MAX_LENGTH}
                                                disabled={detailLoading || savingDeptDetails}
                                                onChange={e => setDetailName(e.target.value.slice(0, DEPARTMENT_NAME_MAX_LENGTH))}
                                                style={{ fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }}
                                            />
                                            <label className="label" htmlFor="dept-detail-desc" style={{ marginBottom: 6 }}>Description</label>
                                            <textarea
                                                id="dept-detail-desc"
                                                className="input"
                                                value={detailDescription}
                                                maxLength={DEPARTMENT_DESCRIPTION_MAX_LENGTH}
                                                disabled={detailLoading || savingDeptDetails}
                                                onChange={e => setDetailDescription(e.target.value.slice(0, DEPARTMENT_DESCRIPTION_MAX_LENGTH))}
                                                rows={3}
                                                style={{ fontSize: 13, marginBottom: 8, minHeight: 72, resize: 'vertical', boxSizing: 'border-box' }}
                                            />
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                                    {detailDescription.length}/{DEPARTMENT_DESCRIPTION_MAX_LENGTH}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="btn btn-primary btn-sm"
                                                    onClick={updateDepartmentDetails}
                                                    disabled={!deptDetailsDirty || savingDeptDetails || detailLoading}
                                                >
                                                    {savingDeptDetails ? 'Saving…' : 'Save details'}
                                                </button>
                                            </div>
                                        </div>

                                        <div
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
                                                gap: 24,
                                                alignItems: 'start',
                                            }}
                                        >
                                            <div className="card" style={{ padding: '16px 18px', margin: 0, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Floors</div>
                                                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.45 }}>
                                                    The API stores a floor count on the department, not separate floor records. Add or remove one floor at a time.
                                                </p>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, minHeight: 28 }}>
                                                    {editDept.floors.map(f => (
                                                        <span key={f.id} className="badge badge-info" style={{ cursor: 'pointer', padding: '6px 10px', fontSize: 12 }} onClick={() => removeFloor(editDept.id)}>
                                                            {f.name}
                                                            <span className="material-icons-round" style={{ fontSize: 12, marginLeft: 4, verticalAlign: 'middle' }}>close</span>
                                                        </span>
                                                    ))}
                                                    {editDept.floors.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No floors yet</span>}
                                                </div>
                                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => addFloor(editDept.id)}>Add floor</button>
                                            </div>

                                            <div className="card" style={{ padding: '16px 18px', margin: 0, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Wards</div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, minHeight: 28 }}>
                                                    {editDept.wards.map(w => (
                                                        <span key={w.id} className="badge badge-neutral" style={{ cursor: 'pointer', padding: '6px 10px', fontSize: 12 }} onClick={() => removeWard(editDept.id, w.id)}>
                                                            {w.name}
                                                            <span className="material-icons-round" style={{ fontSize: 12, marginLeft: 4, verticalAlign: 'middle' }}>close</span>
                                                        </span>
                                                    ))}
                                                    {editDept.wards.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No wards yet</span>}
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <input className="input" placeholder="New ward name" value={newWard} onChange={e => setNewWard(e.target.value)} onKeyDown={e => e.key === 'Enter' && addWard(editDept.id)} style={{ fontSize: 13, flex: 1 }} />
                                                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => addWard(editDept.id)} disabled={!newWard.trim()}>Add</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            minHeight: 280,
                                            padding: 32,
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px dashed var(--border-default)',
                                            background: 'var(--surface-2)',
                                        }}
                                    >
                                        <div style={{ textAlign: 'center', maxWidth: 360, color: 'var(--text-muted)' }}>
                                            <span className="material-icons-round" style={{ fontSize: 40, color: 'var(--text-disabled)', marginBottom: 12, display: 'block' }}>touch_app</span>
                                            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Choose a department</div>
                                            <div style={{ fontSize: 13, lineHeight: 1.5 }}>Select a department on the left to add or remove floors and wards, or adjust your search.</div>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
