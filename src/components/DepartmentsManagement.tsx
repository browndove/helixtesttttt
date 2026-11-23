'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import './departments-page.css';
import '@/components/glass/glass-kit.css';
import { BedStack, DotGrid, KpiTile, LadderBars, MiniBars, Ring } from '@/components/glass/kpi';
import { deptIcon, unitIcon } from '@/lib/department-icons';
import { DEPARTMENT_DESCRIPTION_MAX_LENGTH, DEPARTMENT_NAME_MAX_LENGTH, UNIT_DESCRIPTION_MAX_LENGTH } from '@/lib/departmentName';
import {
    parseCareUnit,
    parseCareUnits,
    unitCapacityLabel,
    unitIsUnmapped,
    type CareUnit,
} from '@/lib/care-units';
import CustomSelect from '@/components/CustomSelect';
import { MacVibrancyToast, MacVibrancyToastPortal } from '@/components/MacVibrancyToast';
import { readCachedJson, writeCachedJson } from '@/lib/getJsonCache';
import { API_ENDPOINTS } from '@/lib/config';
import { appendFacilityIdForProxy } from '@/lib/facility-client';
import {
    GENDER_RESTRICTIONS,
    WARD_TYPES,
    genderLabel,
    hierarchyApiMessage,
    optionalForApi,
    optionalFromApi,
    parseBlock,
    parseBlocks,
    parseFloor,
    wardTypeLabel,
    type Block,
} from '@/lib/bed-hierarchy';

const DEPTS_PAGE_CACHE_TTL_MS = 120_000;
const DEPTS_CACHE_HOSPITAL = '/api/proxy/hospital';

type FloorItem = { id: string; name: string };
type WardItem = { id: string; name: string };
type UnitItem = CareUnit;

/** Building / floor from bed management (block → floor → unit), not the old unit floors[] list. */
function unitBedLocationLabel(
    unit: Pick<UnitItem, 'block_id' | 'block_name' | 'floor_id' | 'floor_name'>,
    blocks: Block[],
): string {
    if (unit.floor_id) {
        for (const block of blocks) {
            const floor = block.floors.find(item => item.id === unit.floor_id);
            if (!floor) continue;
            if (isHiddenFloor(floor.name)) return block.name;
            return `${block.name} · Floor ${floor.name}`;
        }
    }
    const blockName = (unit.block_name || '').trim();
    const floorName = (unit.floor_name || '').trim();
    if (blockName && floorName && !isHiddenFloor(floorName)) return `${blockName} · Floor ${floorName}`;
    if (blockName) return blockName;
    if (unit.block_id) {
        const block = blocks.find(item => item.id === unit.block_id);
        if (block) return block.name;
    }
    return 'No location';
}

function withTypedOption(options: { label: string; value: string }[], current: string) {
    const typed = current.trim();
    if (!typed || options.some(option => option.value === typed || option.label.trim().toLowerCase() === typed.toLowerCase())) {
        return options;
    }
    return [{ label: typed, value: typed }, ...options];
}

function matchedOption(value: string, options: { label: string; value: string }[]) {
    const typed = value.trim().toLowerCase();
    return options.find(option => option.value === value || option.value.toLowerCase() === typed || option.label.trim().toLowerCase() === typed);
}

function unitTypeOptions(current: string) {
    const listed = WARD_TYPES.map(type => ({ label: wardTypeLabel(type), value: type }));
    const typed = current.trim();
    if (typed && !(WARD_TYPES as readonly string[]).includes(typed)) {
        return [{ label: typed, value: typed }, ...listed];
    }
    return listed;
}

type PendingDelete =
    | { kind: 'department'; id: string; label: string }
    | { kind: 'unit'; id: string; label: string };
type Department = {
    id: string;
    name: string;
    description: string;
    /** Authoritative count from API; floors[] may be synthetic labels (Floor 1…N) when API omits named floors. */
    number_of_floors: number;
    floors: FloorItem[];
    wards: WardItem[];
};

function isHiddenFloor(name: string): boolean {
    const key = name.trim().toLowerCase();
    return key === 'unassigned' || key === 'attached units';
}

function apiError(raw: unknown, fallback: string): string {
    if (!raw || typeof raw !== 'object') return fallback;
    const rec = raw as Record<string, unknown>;
    const message = rec.message || rec.error || rec.detail;
    return typeof message === 'string' && message.trim() ? message : fallback;
}

function createdId(raw: unknown, kind: 'block' | 'floor'): string {
    if (!raw || typeof raw !== 'object') return '';
    const rec = raw as Record<string, unknown>;
    const parse = kind === 'block' ? parseBlock : parseFloor;
    return parse(raw)?.id || parse(rec[kind])?.id || parse(rec.data)?.id || '';
}

function locationFromUnit(
    unit: Pick<UnitItem, 'block_id' | 'block_name' | 'floor_id' | 'floor_name'>,
    blocks: Block[],
): { building: string; floor: string } {
    if (unit.floor_id) {
        for (const block of blocks) {
            const floor = block.floors.find(item => item.id === unit.floor_id);
            if (!floor) continue;
            return {
                building: block.id,
                floor: isHiddenFloor(floor.name) ? (unit.floor_name || '') : floor.name,
            };
        }
    }
    if (unit.block_id) {
        const block = blocks.find(item => item.id === unit.block_id);
        return { building: block?.id || unit.block_id, floor: unit.floor_name || '' };
    }
    const blockName = (unit.block_name || '').trim().toLowerCase();
    if (blockName) {
        const block = blocks.find(item => item.name.trim().toLowerCase() === blockName);
        if (block) return { building: block.id, floor: unit.floor_name || '' };
    }
    return { building: unit.block_name || '', floor: unit.floor_name || '' };
}

function floorSelectOptions(building: Block | null | undefined, currentFloor: string) {
    const existing = (building?.floors || [])
        .filter(floor => !isHiddenFloor(floor.name))
        .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }));
    const used = new Set(existing.map(floor => floor.name.trim().toLowerCase()));
    const numbers = Array.from({ length: 10 }, (_, i) => String(i + 1))
        .filter(value => !used.has(value));
    const options = [
        ...existing.map(floor => ({ label: floor.name, value: floor.name })),
        ...numbers.map(value => ({ label: value, value })),
    ];
    const typed = currentFloor.trim();
    if (typed && !options.some(option => option.value.toLowerCase() === typed.toLowerCase())) {
        return [{ label: typed, value: typed }, ...options];
    }
    return options;
}

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
    const [showAddDept, setShowAddDept] = useState(false);
    const [activeTab, setActiveTab] = useState<'departments' | 'units'>('departments');
    const [newUnitName, setNewUnitName] = useState('');
    const [newUnitDescription, setNewUnitDescription] = useState('');
    const [newUnitCode, setNewUnitCode] = useState('');
    const [newUnitType, setNewUnitType] = useState('');
    const [newUnitGender, setNewUnitGender] = useState('');
    const [newUnitBuilding, setNewUnitBuilding] = useState('');
    const [newUnitFloor, setNewUnitFloor] = useState('');
    const [newUnitHasInpatientBeds, setNewUnitHasInpatientBeds] = useState(true);
    const [layoutBlocks, setLayoutBlocks] = useState<Block[]>([]);
    const [showAddUnit, setShowAddUnit] = useState(false);
    const [units, setUnits] = useState<UnitItem[]>([]);
    const [unitsLoading, setUnitsLoading] = useState(false);
    const [addingUnit, setAddingUnit] = useState(false);
    const [unitsSearch, setUnitsSearch] = useState('');
    const [editingUnit, setEditingUnit] = useState<string | null>(null);
    const [unitDetailName, setUnitDetailName] = useState('');
    const [unitDetailDescription, setUnitDetailDescription] = useState('');
    const [unitDetailCode, setUnitDetailCode] = useState('');
    const [unitDetailType, setUnitDetailType] = useState('');
    const [unitDetailGender, setUnitDetailGender] = useState('');
    const [unitDetailBuilding, setUnitDetailBuilding] = useState('');
    const [unitDetailFloor, setUnitDetailFloor] = useState('');
    const [unitDetailHasInpatientBeds, setUnitDetailHasInpatientBeds] = useState(true);
    const [unitDetailLoading, setUnitDetailLoading] = useState(false);
    const [savingUnitDetails, setSavingUnitDetails] = useState(false);
    const [deleteInProgress, setDeleteInProgress] = useState(false);
    const [loading, setLoading] = useState(true);
    const [deptSearch, setDeptSearch] = useState('');
    const [detailName, setDetailName] = useState('');
    const [detailDescription, setDetailDescription] = useState('');
    const [savingDeptDetails, setSavingDeptDetails] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
    const departmentsRef = useRef(departments);
    departmentsRef.current = departments;
    const unitsRef = useRef(units);
    unitsRef.current = units;

    const showToast = useCallback((msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    }, []);

    const filteredDepartments = useMemo(() => {
        const query = deptSearch.toLowerCase().trim();
        if (!query) return departments;
        return departments.filter(d =>
            d.name.toLowerCase().includes(query),
        );
    }, [departments, deptSearch]);

    const filteredUnits = useMemo(() => {
        const q = unitsSearch.toLowerCase().trim();
        if (!q) return units;
        return units.filter(u =>
            u.name.toLowerCase().includes(q),
        );
    }, [units, unitsSearch]);
    const loadLayoutBlocks = useCallback(async (): Promise<Block[]> => {
        try {
            const url = await appendFacilityIdForProxy(`${API_ENDPOINTS.BLOCKS}?depth=full`);
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) return [];
            const next = parseBlocks(await res.json()).filter(block => block.name.trim().toLowerCase() !== 'unassigned');
            setLayoutBlocks(next);
            return next;
        } catch {
            return [];
        }
    }, []);

    useEffect(() => {
        if (activeTab !== 'units') return;
        void loadLayoutBlocks();
    }, [activeTab, loadLayoutBlocks]);

    const fetchUnits = useCallback(async () => {
        setUnitsLoading(true);
        try {
            const res = await fetch('/api/proxy/units');
            if (res.ok) {
                const data = await res.json();
                setUnits(parseCareUnits(data));
            }
        } catch { /* ignore */ }
        setUnitsLoading(false);
    }, []);

    const fetchData = useCallback(async () => {
        try {
            const hRes = await fetch(DEPTS_CACHE_HOSPITAL);
            let facilityId = '';
            let hospitalJson: unknown = null;
            if (hRes.ok) {
                hospitalJson = await hRes.json();
                const h = hospitalJson as { id?: string };
                facilityId = h.id || '';
                setHospitalId(facilityId);
                writeCachedJson(DEPTS_CACHE_HOSPITAL, hospitalJson);
            }
            const deptUrl = facilityId
                ? `/api/proxy/departments?facility_id=${facilityId}`
                : '/api/proxy/departments';
            const dRes = await fetch(deptUrl);
            if (dRes.ok) {
                const d = await dRes.json();
                writeCachedJson(deptUrl, d);
                setDepartments(Array.isArray(d) ? d.map(normalizeDepartment) : []);
            }
            await fetchUnits();
        } catch { showToast('Failed to load departments'); }
        setLoading(false);
    }, [showToast, fetchUnits]);

    useLayoutEffect(() => {
        const hospitalJ = readCachedJson(DEPTS_CACHE_HOSPITAL, DEPTS_PAGE_CACHE_TTL_MS);
        if (!hospitalJ || typeof hospitalJ !== 'object') return;
        const fid = String((hospitalJ as Record<string, unknown>).id || '');
        const deptUrl = fid ? `/api/proxy/departments?facility_id=${fid}` : '/api/proxy/departments';
        const deptsJ = readCachedJson(deptUrl, DEPTS_PAGE_CACHE_TTL_MS);
        if (deptsJ == null) return;
        setHospitalId(fid);
        setDepartments(Array.isArray(deptsJ) ? deptsJ.map(normalizeDepartment) : []);
        setLoading(false);
    }, []);

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

    useEffect(() => {
        if (loading || activeTab !== 'units') return;
        if (units.length === 0) {
            setEditingUnit(null);
            return;
        }
        if (filteredUnits.length === 0) {
            setEditingUnit(null);
            return;
        }
        if (!editingUnit || !filteredUnits.some(u => u.id === editingUnit)) {
            setEditingUnit(filteredUnits[0].id);
        }
    }, [loading, activeTab, units.length, filteredUnits, editingUnit]);

    // Show list row immediately, then load full details from GET /departments/{id} (authoritative name/description).
    useEffect(() => {
        if (!editingDept) {
            setDetailName('');
            setDetailDescription('');
            setDetailLoading(false);
            return;
        }
        setNewUnitName('');
        setNewUnitDescription('');
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
    }, [editingDept, showToast, fetchUnits]);

    const applyUnitDetail = (
        unit: Partial<UnitItem>,
        blocks: Block[] = layoutBlocks,
    ) => {
        setUnitDetailName(unit.name || '');
        setUnitDetailDescription(unit.description || '');
        setUnitDetailCode(optionalFromApi(unit.code));
        setUnitDetailType(optionalFromApi(unit.type));
        setUnitDetailGender(unit.gender_restriction || '');
        setUnitDetailHasInpatientBeds(unit.has_inpatient_beds !== false);
        const loc = locationFromUnit({
            block_id: unit.block_id,
            block_name: unit.block_name,
            floor_id: unit.floor_id,
            floor_name: unit.floor_name,
        }, blocks);
        setUnitDetailBuilding(loc.building);
        setUnitDetailFloor(loc.floor);
    };

    useEffect(() => {
        if (!editingUnit) {
            applyUnitDetail({});
            setUnitDetailLoading(false);
            return;
        }
        const local = unitsRef.current.find(u => u.id === editingUnit);
        if (local) applyUnitDetail(local);
        const ac = new AbortController();
        let cancelled = false;
        setUnitDetailLoading(true);
        (async () => {
            try {
                const res = await fetch(`/api/proxy/units/${editingUnit}`, { signal: ac.signal });
                if (!res.ok) throw new Error('bad status');
                const parsed = parseCareUnit(await res.json());
                if (cancelled || !parsed) return;
                applyUnitDetail(parsed);
                setUnits(prev => prev.map(u => (u.id === editingUnit ? { ...u, ...parsed, name: parsed.name || u.name } : u)));
            } catch (e) {
                const aborted = cancelled || (e instanceof Error && e.name === 'AbortError');
                if (aborted) return;
                const fallback = unitsRef.current.find(u => u.id === editingUnit);
                if (fallback) applyUnitDetail(fallback);
                else {
                    applyUnitDetail({});
                    showToast('Could not load unit details');
                }
            } finally {
                if (!cancelled) setUnitDetailLoading(false);
            }
        })();
        return () => {
            cancelled = true;
            ac.abort();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate fields when the selected unit changes
    }, [editingUnit, showToast]);

    useEffect(() => {
        if (!editingUnit || layoutBlocks.length === 0) return;
        const unit = unitsRef.current.find(u => u.id === editingUnit);
        if (!unit) return;
        const loc = locationFromUnit(unit, layoutBlocks);
        if (loc.building) setUnitDetailBuilding(prev => prev || loc.building);
        if (loc.floor) setUnitDetailFloor(prev => prev || loc.floor);
    }, [editingUnit, layoutBlocks]);

    const resetNewDepartmentForm = () => {
        setNewDeptName('');
        setNewDeptDescription('');
    };

    const resetNewUnitForm = () => {
        setNewUnitName('');
        setNewUnitDescription('');
        setNewUnitCode('');
        setNewUnitType('');
        setNewUnitGender('');
        setNewUnitBuilding('');
        setNewUnitFloor('');
        setNewUnitHasInpatientBeds(true);
    };

    const savedBuildings = useMemo(
        () => layoutBlocks.filter(block => block.name.trim().toLowerCase() !== 'unassigned'),
        [layoutBlocks],
    );
    const selectedBuilding = savedBuildings.find(block => (
        block.id === newUnitBuilding
        || block.name.trim().toLowerCase() === newUnitBuilding.trim().toLowerCase()
    )) || null;
    const selectedEditBuilding = savedBuildings.find(block => (
        block.id === unitDetailBuilding
        || block.name.trim().toLowerCase() === unitDetailBuilding.trim().toLowerCase()
    )) || null;
    const editBuildingFloorOptions = useMemo(
        () => floorSelectOptions(selectedEditBuilding, unitDetailFloor),
        [selectedEditBuilding, unitDetailFloor],
    );
    const buildingFloorOptions = useMemo(() => {
        const options = floorSelectOptions(selectedBuilding, newUnitFloor);
        const typed = newUnitFloor.trim();
        if (typed && !options.some(option => option.value.toLowerCase() === typed.toLowerCase())) {
            return [{ label: typed, value: typed }, ...options];
        }
        return options;
    }, [selectedBuilding, newUnitFloor]);

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
        try {
            const body: Record<string, unknown> = {
                name: trimmed,
                description: newDeptDescription.trim(),
                facility_id: hospitalId || '',
            };

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

    const addUnit = async () => {
        const name = newUnitName.trim();
        if (!name) return;
        if (name.length > DEPARTMENT_NAME_MAX_LENGTH) {
            showToast(`Unit name must be ${DEPARTMENT_NAME_MAX_LENGTH} characters or fewer`);
            return;
        }
        if (newUnitDescription.length > UNIT_DESCRIPTION_MAX_LENGTH) {
            showToast(`Description must be ${UNIT_DESCRIPTION_MAX_LENGTH} characters or fewer`);
            return;
        }
        if (!newUnitBuilding.trim()) {
            showToast('Building / block is required');
            return;
        }
        if (!newUnitFloor.trim()) {
            showToast('Floor is required');
            return;
        }
        setAddingUnit(true);
        try {
            const postJson = async (path: string, body: Record<string, unknown>) => {
                const url = await appendFacilityIdForProxy(path);
                const res = await fetch(url, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const raw = await res.json().catch(() => ({}));
                return { res, raw };
            };

            let blockId = savedBuildings.find(block => block.id === newUnitBuilding)?.id || '';
            if (!blockId) {
                const named = savedBuildings.find(block => block.name.trim().toLowerCase() === newUnitBuilding.trim().toLowerCase());
                blockId = named?.id || '';
            }
            if (!blockId) {
                const { res, raw } = await postJson(API_ENDPOINTS.BLOCKS, { name: newUnitBuilding.trim() });
                blockId = createdId(raw, 'block');
                if (!blockId && (res.status === 409 || /already exists/i.test(apiError(raw, '')))) {
                    const refreshed = await loadLayoutBlocks();
                    blockId = refreshed.find(block => block.name.trim().toLowerCase() === newUnitBuilding.trim().toLowerCase())?.id || '';
                }
                if (!res.ok && !blockId) throw new Error(apiError(raw, 'Failed to add building'));
                if (!blockId) throw new Error('Building was created, but its id could not be read');
            }

            const knownBlocks = layoutBlocks.some(block => block.id === blockId) ? layoutBlocks : await loadLayoutBlocks();
            const parent = knownBlocks.find(block => block.id === blockId);
            let floorId = (parent?.floors || []).find(floor => (
                !isHiddenFloor(floor.name) && floor.name.trim().toLowerCase() === newUnitFloor.trim().toLowerCase()
            ))?.id || '';
            if (!floorId) {
                const { res, raw } = await postJson(API_ENDPOINTS.BLOCK_FLOORS(blockId), { name: newUnitFloor.trim() });
                floorId = createdId(raw, 'floor');
                if (!floorId && (res.status === 409 || /already exists/i.test(apiError(raw, '')))) {
                    const refreshed = await loadLayoutBlocks();
                    floorId = refreshed
                        .find(block => block.id === blockId)?.floors
                        .find(floor => floor.name.trim().toLowerCase() === newUnitFloor.trim().toLowerCase())?.id || '';
                }
                if (!res.ok && !floorId) throw new Error(apiError(raw, 'Failed to add floor'));
                if (!floorId) throw new Error('Floor was created, but its id could not be read');
            }

            const unitType = newUnitType.trim();
            const { res, raw } = await postJson(API_ENDPOINTS.FLOOR_WARDS(floorId), {
                name,
                description: newUnitDescription.trim(),
                floor_id: floorId,
                facility_id: hospitalId || '',
                has_inpatient_beds: newUnitHasInpatientBeds,
                ...(newUnitCode.trim() ? { code: newUnitCode.trim() } : {}),
                ...(unitType ? { type: unitType } : {}),
                ...(newUnitGender ? { gender_restriction: newUnitGender } : {}),
            });
            if (!res.ok) throw new Error(apiError(raw, 'Failed to add unit/workstation'));
            const rec = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
            const created = parseCareUnit(raw) || parseCareUnit(rec.unit) || parseCareUnit(rec.ward) || parseCareUnit(rec.data);
            await fetchUnits();
            if (created) setEditingUnit(created.id);
            showToast(`Unit/workstation "${name}" added`);
            resetNewUnitForm();
            setShowAddUnit(false);
            void loadLayoutBlocks();
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to add unit/workstation');
        }
        setAddingUnit(false);
    };

    const removeUnit = useCallback(async (unitId: string): Promise<boolean> => {
        const unit = unitsRef.current.find(u => u.id === unitId);
        try {
            // Cascade rooms/beds; plain DELETE /units/{id} rejects when rooms remain.
            const res = await fetch(API_ENDPOINTS.UNIT_CONTENTS(unitId), { method: 'DELETE' });
            if (res.ok || res.status === 204) {
                setUnits(prev => prev.filter(u => u.id !== unitId));
                showToast(`${unit?.name || 'Unit'} deleted`);
                setEditingUnit(prev => (prev === unitId ? null : prev));
                return true;
            }
            const err = await res.json().catch(() => ({}));
            showToast(hierarchyApiMessage(err, 'Failed to delete unit'));
        } catch {
            showToast('Failed to delete unit');
        }
        return false;
    }, [showToast]);

    const updateUnitDetails = async () => {
        const u = units.find(x => x.id === editingUnit);
        if (!u) return;
        const trimmedName = unitDetailName.trim();
        if (!trimmedName) {
            showToast('Unit name is required');
            return;
        }
        if (trimmedName.length > DEPARTMENT_NAME_MAX_LENGTH) {
            showToast(`Unit name must be ${DEPARTMENT_NAME_MAX_LENGTH} characters or fewer`);
            return;
        }
        if (unitDetailDescription.length > UNIT_DESCRIPTION_MAX_LENGTH) {
            showToast(`Description must be ${UNIT_DESCRIPTION_MAX_LENGTH} characters or fewer`);
            return;
        }
        if (!unitDetailBuilding.trim()) {
            showToast('Building is required');
            return;
        }
        if (!unitDetailFloor.trim()) {
            showToast('Floor is required');
            return;
        }
        const descTrimmed = unitDetailDescription.trim();
        setSavingUnitDetails(true);
        try {
            const postJson = async (path: string, body: Record<string, unknown>) => {
                const url = await appendFacilityIdForProxy(path);
                const res = await fetch(url, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const raw = await res.json().catch(() => ({}));
                return { res, raw };
            };

            let blockId = savedBuildings.find(block => block.id === unitDetailBuilding)?.id || '';
            if (!blockId) {
                const named = savedBuildings.find(block => block.name.trim().toLowerCase() === unitDetailBuilding.trim().toLowerCase());
                blockId = named?.id || '';
            }
            if (!blockId) {
                const { res, raw } = await postJson(API_ENDPOINTS.BLOCKS, { name: unitDetailBuilding.trim() });
                blockId = createdId(raw, 'block');
                if (!blockId && (res.status === 409 || /already exists/i.test(apiError(raw, '')))) {
                    const refreshed = await loadLayoutBlocks();
                    blockId = refreshed.find(block => block.name.trim().toLowerCase() === unitDetailBuilding.trim().toLowerCase())?.id || '';
                }
                if (!res.ok && !blockId) throw new Error(apiError(raw, 'Failed to add building'));
                if (!blockId) throw new Error('Building was created, but its id could not be read');
            }

            const knownBlocks = layoutBlocks.some(block => block.id === blockId) ? layoutBlocks : await loadLayoutBlocks();
            const parent = knownBlocks.find(block => block.id === blockId);
            let floorId = (parent?.floors || []).find(floor => (
                !isHiddenFloor(floor.name) && floor.name.trim().toLowerCase() === unitDetailFloor.trim().toLowerCase()
            ))?.id || '';
            if (!floorId) {
                const { res, raw } = await postJson(API_ENDPOINTS.BLOCK_FLOORS(blockId), { name: unitDetailFloor.trim() });
                floorId = createdId(raw, 'floor');
                if (!floorId && (res.status === 409 || /already exists/i.test(apiError(raw, '')))) {
                    const refreshed = await loadLayoutBlocks();
                    floorId = refreshed
                        .find(block => block.id === blockId)?.floors
                        .find(floor => floor.name.trim().toLowerCase() === unitDetailFloor.trim().toLowerCase())?.id || '';
                }
                if (!res.ok && !floorId) throw new Error(apiError(raw, 'Failed to add floor'));
                if (!floorId) throw new Error('Floor was created, but its id could not be read');
            }

            const res = await fetch(`/api/proxy/units/${u.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: trimmedName,
                    description: descTrimmed,
                    code: optionalForApi(unitDetailCode),
                    type: optionalForApi(unitDetailType),
                    gender_restriction: unitDetailGender,
                    floor_id: floorId,
                    has_inpatient_beds: unitDetailHasInpatientBeds,
                    ...(u.department_id ? { department_id: u.department_id } : {}),
                }),
            });
            const rawText = await res.text();
            let payload: Record<string, unknown> = {};
            if (rawText) {
                try {
                    payload = JSON.parse(rawText) as Record<string, unknown>;
                } catch {
                    if (!res.ok) {
                        showToast('Failed to update unit');
                        return;
                    }
                }
            }
            if (!res.ok) {
                const msg = typeof payload.error === 'string' ? payload.error : typeof payload.detail === 'string' ? payload.detail : 'Failed to update unit';
                showToast(msg);
                return;
            }
            const body = Object.keys(payload).length > 0 ? payload : { name: trimmedName, description: descTrimmed };
            const parsed = parseCareUnit(body);
            const updatedName = (parsed?.name || String(body.name || trimmedName)).trim();
            const updatedDesc = parsed?.description ?? (typeof body.description === 'string' ? body.description : descTrimmed);
            const updatedCode = optionalFromApi(parsed?.code ?? (typeof body.code === 'string' ? body.code : unitDetailCode));
            const updatedType = optionalFromApi(parsed?.type ?? (typeof body.type === 'string' ? body.type : unitDetailType));
            const updatedGender = parsed?.gender_restriction
                ?? (typeof body.gender_restriction === 'string' ? body.gender_restriction : unitDetailGender);
            const blockName = parent?.name
                || knownBlocks.find(block => block.id === blockId)?.name
                || unitDetailBuilding.trim();
            const floorName = unitDetailFloor.trim();
            setUnits(prev => prev.map(x => {
                if (x.id !== u.id) return x;
                if (parsed) {
                    const responseHasRooms = Array.isArray(body.rooms);
                    return {
                        ...x,
                        ...parsed,
                        name: updatedName || x.name,
                        description: updatedDesc,
                        code: updatedCode,
                        type: updatedType,
                        gender_restriction: updatedGender,
                        has_inpatient_beds: parsed.has_inpatient_beds,
                        block_id: parsed.block_id || blockId,
                        block_name: parsed.block_name || blockName,
                        floor_id: parsed.floor_id || floorId,
                        floor_name: parsed.floor_name || floorName,
                        department_name: parsed.department_name
                            || departments.find(dept => dept.id === (parsed.department_id || x.department_id))?.name
                            || x.department_name,
                        rooms: responseHasRooms ? parsed.rooms : x.rooms,
                        room_count: responseHasRooms ? parsed.room_count : x.room_count,
                        bed_count: responseHasRooms || 'total' in body || 'bed_count' in body ? parsed.bed_count : x.bed_count,
                        available_count: responseHasRooms || 'available' in body || 'available_count' in body ? parsed.available_count : x.available_count,
                        occupied_count: responseHasRooms || 'occupied' in body || 'occupied_count' in body ? parsed.occupied_count : x.occupied_count,
                        blocked_count: responseHasRooms || 'blocked' in body || 'blocked_count' in body ? parsed.blocked_count : x.blocked_count,
                    };
                }
                return {
                    ...x,
                    name: updatedName,
                    description: updatedDesc,
                    code: updatedCode,
                    type: updatedType,
                    gender_restriction: updatedGender,
                    has_inpatient_beds: unitDetailHasInpatientBeds,
                    block_id: blockId,
                    block_name: blockName,
                    floor_id: floorId,
                    floor_name: floorName,
                };
            }));
            setUnitDetailName(updatedName);
            setUnitDetailDescription(updatedDesc);
            setUnitDetailCode(updatedCode);
            setUnitDetailType(updatedType);
            setUnitDetailGender(updatedGender);
            setUnitDetailHasInpatientBeds(
                parsed?.has_inpatient_beds
                ?? (typeof body.has_inpatient_beds === 'boolean' ? body.has_inpatient_beds : unitDetailHasInpatientBeds),
            );
            setUnitDetailBuilding(blockId);
            setUnitDetailFloor(floorName);
            showToast('Unit/workstation updated');
            void loadLayoutBlocks();
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to update unit');
        } finally {
            setSavingUnitDetails(false);
        }
    };

    const confirmPendingDelete = useCallback(async () => {
        const pending = pendingDelete;
        if (!pending || deleteInProgress) return;
        setDeleteInProgress(true);
        try {
            if (pending.kind === 'department') {
                await removeDepartment(pending.id);
            } else {
                const ok = await removeUnit(pending.id);
                if (!ok) return;
            }
            setPendingDelete(null);
        } finally {
            setDeleteInProgress(false);
        }
    }, [pendingDelete, deleteInProgress, removeUnit]);

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
    const editUnit = units.find(u => u.id === editingUnit);
    const deptDetailsDirty = Boolean(
        editDept
        && (detailName.trim() !== editDept.name
            || detailDescription.trim() !== (editDept.description || '').trim()),
    );
    const editUnitLocation = editUnit ? locationFromUnit(editUnit, layoutBlocks) : { building: '', floor: '' };
    const buildingKey = (value: string) => {
        const match = savedBuildings.find(block => (
            block.id === value || block.name.trim().toLowerCase() === value.trim().toLowerCase()
        ));
        return match ? match.id : value.trim().toLowerCase();
    };
    const unitDetailsDirty = Boolean(
        editUnit
        && (unitDetailName.trim() !== editUnit.name
            || unitDetailDescription.trim() !== (editUnit.description || '').trim()
            || unitDetailCode.trim() !== optionalFromApi(editUnit.code)
            || unitDetailType.trim() !== optionalFromApi(editUnit.type)
            || unitDetailGender !== (editUnit.gender_restriction || '')
            || unitDetailHasInpatientBeds !== (editUnit.has_inpatient_beds !== false)
            || buildingKey(unitDetailBuilding) !== buildingKey(editUnitLocation.building)
            || unitDetailFloor.trim().toLowerCase() !== editUnitLocation.floor.trim().toLowerCase()),
    );

    const unitsByDept = useMemo(() => {
        const map = new Map<string, UnitItem[]>();
        for (const u of units) {
            const key = String(u.department_id || '');
            if (!key) continue;
            map.set(key, [...(map.get(key) || []), u]);
        }
        return map;
    }, [units]);

    const facilityStats = useMemo(() => {
        const inpatient = units.filter(u => u.has_inpatient_beds !== false);
        const beds = inpatient.reduce(
            (acc, u) => ({
                total: acc.total + (u.bed_count || 0),
                available: acc.available + (u.available_count || 0),
                occupied: acc.occupied + (u.occupied_count || 0),
                blocked: acc.blocked + (u.blocked_count || 0),
            }),
            { total: 0, available: 0, occupied: 0, blocked: 0 },
        );
        return {
            inpatient: inpatient.length,
            workstations: units.length - inpatient.length,
            unmapped: inpatient.filter(u => unitIsUnmapped(u)).length,
            beds,
            occupancyPct: beds.total > 0 ? Math.round((beds.occupied / beds.total) * 100) : 0,
            deptsWithUnits: departments.filter(d => (unitsByDept.get(d.id)?.length || 0) > 0).length,
            topDepts: [...departments]
                .map(d => ({ name: d.name, count: unitsByDept.get(d.id)?.length || 0 }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 7),
        };
    }, [units, departments, unitsByDept]);

    const deptBedTotals = (list: UnitItem[]) => list
        .filter(u => u.has_inpatient_beds !== false)
        .reduce(
            (acc, u) => ({
                total: acc.total + (u.bed_count || 0),
                available: acc.available + (u.available_count || 0),
                occupied: acc.occupied + (u.occupied_count || 0),
                blocked: acc.blocked + (u.blocked_count || 0),
            }),
            { total: 0, available: 0, occupied: 0, blocked: 0 },
        );

    const openAddDepartment = () => {
        setActiveTab('departments');
        resetNewDepartmentForm();
        setShowAddDept(true);
    };
    const openAddUnit = () => {
        setActiveTab('units');
        resetNewUnitForm();
        setShowAddUnit(true);
    };
    const buildingOptions = (typedValue: string) => {
        const listed = savedBuildings.map(block => ({ label: block.name, value: block.id }));
        const typed = typedValue.trim();
        if (typed && !savedBuildings.some(block => block.id === typed || block.name.trim().toLowerCase() === typed.toLowerCase())) {
            return [{ label: typed, value: typed }, ...listed];
        }
        return listed;
    };
    const genderOptions = (current: string) => withTypedOption(
        GENDER_RESTRICTIONS.map(value => ({ label: genderLabel(value), value })),
        current,
    );
    const pickGender = (value: string) => {
        const choices = GENDER_RESTRICTIONS.map(item => ({ label: genderLabel(item), value: item }));
        const match = matchedOption(value, choices);
        return match ? match.value : value;
    };
    const selectStyle = { width: '100%', height: 42, fontSize: 13 };

    if (loading) {
        return (
            <div className="app-main dp-page">
                <main className="dp-main">
                    <div className="dp-skel dp-skel--hero" />
                    <div className="hx-kpis">
                        {[1, 2, 3, 4].map(i => <div key={i} className="dp-skel dp-skel--kpi" />)}
                    </div>
                    <div className="dp-work">
                        <div className="dp-skel dp-skel--list" />
                        <div className="dp-skel dp-skel--detail" />
                    </div>
                </main>
            </div>
        );
    }

    const isDeptTab = activeTab === 'departments';
    const editDeptUnits = editDept ? (unitsByDept.get(editDept.id) || []) : [];
    const editDeptBeds = deptBedTotals(editDeptUnits);
    const editDeptOcc = editDeptBeds.total > 0 ? Math.round((editDeptBeds.occupied / editDeptBeds.total) * 100) : 0;
    const editUnitOcc = editUnit && (editUnit.bed_count || 0) > 0
        ? Math.round(typeof editUnit.occupancy_percent === 'number'
            ? editUnit.occupancy_percent
            : ((editUnit.occupied_count || 0) / (editUnit.bed_count || 1)) * 100)
        : 0;

    return (
        <>
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast} variant="success" dismissible={false} />
                </MacVibrancyToastPortal>
            )}

            <div className="app-main dp-page">
                <main className="dp-main">
                    {/* ── Hero ───────────────────────────────────────────── */}
                    <header className="dp-hero dp-reveal">
                        <div className="dp-hero__id">
                            <HospitalArt />
                            <div className="dp-hero__text">
                                <span className="dp-kicker">Facility structure</span>
                                <h1 className="dp-title">Departments &amp; units</h1>
                                <p className="dp-sub">Organise clinical departments, wards and workstations, and see bed capacity at a glance.</p>
                            </div>
                        </div>
                        <div className="dp-hero__actions">
                            <div className="dp-seg" role="tablist" aria-label="View">
                                <button type="button" role="tab" aria-selected={isDeptTab} className={isDeptTab ? 'is-on' : ''} onClick={() => setActiveTab('departments')}>
                                    <span className="material-icons-round">domain</span>
                                    Departments
                                    <span className="dp-seg__count">{departments.length}</span>
                                </button>
                                <button type="button" role="tab" aria-selected={!isDeptTab} className={!isDeptTab ? 'is-on' : ''} onClick={() => setActiveTab('units')}>
                                    <span className="material-icons-round">meeting_room</span>
                                    Units &amp; workstations
                                    <span className="dp-seg__count">{units.length}</span>
                                </button>
                            </div>
                            <button type="button" className="btn btn-primary dp-add" onClick={isDeptTab ? openAddDepartment : openAddUnit}>
                                <span className="material-icons-round" style={{ fontSize: 18 }}>add</span>
                                {isDeptTab ? 'New department' : 'New unit'}
                            </button>
                        </div>
                    </header>

                    {/* ── KPIs ───────────────────────────────────────────── */}
                    <section className="hx-kpis dp-reveal" aria-label="Structure overview">
                        <KpiTile
                            tone="indigo"
                            icon="domain"
                            watermark="apartment"
                            label="Departments"
                            value={departments.length.toLocaleString()}
                            foot={`${facilityStats.deptsWithUnits} with linked units`}
                            chart={<MiniBars values={facilityStats.topDepts.map(d => d.count)} labels={facilityStats.topDepts.map(d => d.name)} />}
                            onClick={() => setActiveTab('departments')}
                        />
                        <KpiTile
                            tone="sky"
                            icon="meeting_room"
                            watermark="hub"
                            label="Units & workstations"
                            value={units.length.toLocaleString()}
                            foot={`${facilityStats.inpatient} inpatient · ${facilityStats.workstations} workstation${facilityStats.workstations === 1 ? '' : 's'}`}
                            chart={<DotGrid pct={units.length > 0 ? Math.round((facilityStats.inpatient / units.length) * 100) : 0} />}
                            onClick={() => setActiveTab('units')}
                        />
                        <KpiTile
                            tone="mint"
                            icon="bed"
                            watermark="king_bed"
                            label="Mapped beds"
                            value={facilityStats.beds.total.toLocaleString()}
                            foot={`${facilityStats.beds.available} available · ${facilityStats.beds.blocked} out of service`}
                            chart={(
                                <Ring pct={facilityStats.occupancyPct} size={72}>
                                    <span className="dp-ring-label">{facilityStats.occupancyPct}%<small>occupied</small></span>
                                </Ring>
                            )}
                            onClick={() => setActiveTab('units')}
                        />
                        <KpiTile
                            tone={facilityStats.unmapped > 0 ? 'amber' : 'mint'}
                            icon={facilityStats.unmapped > 0 ? 'link_off' : 'verified'}
                            watermark="map"
                            label="Unmapped units"
                            value={facilityStats.unmapped > 0 ? facilityStats.unmapped.toLocaleString() : 'All mapped'}
                            foot={facilityStats.unmapped > 0 ? 'Inpatient units with no rooms or beds' : `${facilityStats.inpatient} inpatient units have beds`}
                            chart={<LadderBars total={facilityStats.inpatient} missing={facilityStats.unmapped} />}
                            onClick={() => setActiveTab('units')}
                        />
                    </section>

                    {/* ── Workspace ─────────────────────────────────────── */}
                    <section className="dp-work dp-reveal">
                        <aside className="dp-list">
                            <div className="dp-list__hd">
                                <div className="dp-search">
                                    <span className="material-icons-round">search</span>
                                    <input
                                        type="text"
                                        placeholder={isDeptTab ? 'Search departments' : 'Search units & workstations'}
                                        value={isDeptTab ? deptSearch : unitsSearch}
                                        onChange={e => (isDeptTab ? setDeptSearch : setUnitsSearch)(e.target.value)}
                                        aria-label="Search"
                                    />
                                    {(isDeptTab ? deptSearch : unitsSearch) ? (
                                        <button type="button" onClick={() => (isDeptTab ? setDeptSearch : setUnitsSearch)('')} aria-label="Clear search">
                                            <span className="material-icons-round">close</span>
                                        </button>
                                    ) : null}
                                </div>
                                <div className="dp-list__meta">
                                    {isDeptTab
                                        ? `${filteredDepartments.length} of ${departments.length} departments`
                                        : `${filteredUnits.length} of ${units.length} units`}
                                </div>
                            </div>

                            <div className="dp-list__scroll">
                                {isDeptTab ? (
                                    <>
                                        {filteredDepartments.map(d => {
                                            const linked = unitsByDept.get(d.id) || [];
                                            const beds = deptBedTotals(linked);
                                            const active = editingDept === d.id && !showAddDept;
                                            return (
                                                <button
                                                    key={d.id}
                                                    type="button"
                                                    className={`dp-item${active ? ' is-on' : ''}`}
                                                    onClick={() => { setShowAddDept(false); setEditingDept(d.id); }}
                                                >
                                                    <span className="dp-item__icon"><span className="material-icons-round">{deptIcon(d.name)}</span></span>
                                                    <span className="dp-item__main">
                                                        <span className="dp-item__name">{d.name}</span>
                                                        <span className="dp-item__sub">{d.description || 'No description'}</span>
                                                    </span>
                                                    <span className="dp-item__aside">
                                                        <span className="dp-pill">{linked.length} unit{linked.length === 1 ? '' : 's'}</span>
                                                        {beds.total > 0 && <span className="dp-item__beds">{beds.total} beds</span>}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                        {departments.length === 0 && (
                                            <EmptyState icon="domain_add" title="No departments yet" body="Create your first department to start organising units." action={{ label: 'New department', onClick: openAddDepartment }} />
                                        )}
                                        {departments.length > 0 && filteredDepartments.length === 0 && (
                                            <EmptyState icon="search_off" title="No matches" body="Try another search term." />
                                        )}
                                    </>
                                ) : unitsLoading ? (
                                    <div className="dp-list__loading">{[1, 2, 3, 4, 5].map(i => <div key={i} className="dp-skel dp-skel--row" />)}</div>
                                ) : (
                                    <>
                                        {filteredUnits.map(u => {
                                            const unmapped = unitIsUnmapped(u);
                                            const active = editingUnit === u.id && !showAddUnit;
                                            return (
                                                <button
                                                    key={u.id}
                                                    type="button"
                                                    className={`dp-item${active ? ' is-on' : ''}`}
                                                    onClick={() => { setShowAddUnit(false); setEditingUnit(u.id); }}
                                                >
                                                    <span className="dp-item__icon"><span className="material-icons-round">{unitIcon(u.type, u.name, u.has_inpatient_beds !== false)}</span></span>
                                                    <span className="dp-item__main">
                                                        <span className="dp-item__name">{u.name}</span>
                                                        <span className="dp-item__sub">
                                                            {unitBedLocationLabel(u, layoutBlocks)}
                                                            {u.type ? ` · ${wardTypeLabel(u.type)}` : ''}
                                                        </span>
                                                        {u.has_inpatient_beds === false ? (
                                                            <span className="dp-item__tag">Workstation only</span>
                                                        ) : unmapped ? (
                                                            <span className="dp-item__tag dp-item__tag--warn">Unmapped · no beds yet</span>
                                                        ) : (
                                                            <span className="dp-item__cap">
                                                                <BedStack compact available={u.available_count || 0} occupied={u.occupied_count || 0} blocked={u.blocked_count || 0} />
                                                                <span>{u.available_count || 0}/{u.bed_count || 0} free</span>
                                                            </span>
                                                        )}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                        {units.length === 0 && (
                                            <EmptyState icon="add_home_work" title="No units yet" body="Add wards, units or workstations to map beds and staffing." action={{ label: 'New unit', onClick: openAddUnit }} />
                                        )}
                                        {units.length > 0 && filteredUnits.length === 0 && (
                                            <EmptyState icon="search_off" title="No matches" body="Try another search term." />
                                        )}
                                    </>
                                )}
                            </div>
                        </aside>

                        <section className="dp-detail">
                            {isDeptTab ? (
                                showAddDept ? (
                                    <div className="dp-card dp-form-card fade-in">
                                        <FormHeader icon="domain_add" title="New department" sub="Departments group your units and workstations." />
                                        <div className="dp-field">
                                            <div className="dp-field__lab">
                                                <label htmlFor="new-dept-name">Department name *</label>
                                                <span>{newDeptName.length}/{DEPARTMENT_NAME_MAX_LENGTH}</span>
                                            </div>
                                            <input
                                                id="new-dept-name"
                                                className="input"
                                                placeholder="e.g. Accident & Emergency"
                                                value={newDeptName}
                                                maxLength={DEPARTMENT_NAME_MAX_LENGTH}
                                                autoFocus
                                                onChange={e => setNewDeptName(e.target.value.slice(0, DEPARTMENT_NAME_MAX_LENGTH))}
                                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addDepartment()}
                                            />
                                        </div>
                                        <div className="dp-field">
                                            <div className="dp-field__lab">
                                                <label htmlFor="new-dept-desc">Description</label>
                                                <span>{newDeptDescription.length}/{DEPARTMENT_DESCRIPTION_MAX_LENGTH}</span>
                                            </div>
                                            <textarea
                                                id="new-dept-desc"
                                                className="input"
                                                rows={4}
                                                placeholder="What does this department cover?"
                                                value={newDeptDescription}
                                                maxLength={DEPARTMENT_DESCRIPTION_MAX_LENGTH}
                                                onChange={e => setNewDeptDescription(e.target.value.slice(0, DEPARTMENT_DESCRIPTION_MAX_LENGTH))}
                                            />
                                        </div>
                                        <div className="dp-actions">
                                            <button type="button" className="btn btn-ghost" onClick={() => { resetNewDepartmentForm(); setShowAddDept(false); }}>Cancel</button>
                                            <button type="button" className="btn btn-primary" onClick={addDepartment} disabled={!newDeptName.trim()}>
                                                <span className="material-icons-round" style={{ fontSize: 17 }}>check</span>
                                                Create department
                                            </button>
                                        </div>
                                    </div>
                                ) : editDept ? (
                                    <div className="dp-stack fade-in" key={editDept.id}>
                                        <div className="dp-feature">
                                            <span className="material-icons-round dp-feature__mark" aria-hidden>{deptIcon(editDept.name)}</span>
                                            <div className="dp-feature__top">
                                                <span className="dp-feature__icon"><span className="material-icons-round">{deptIcon(editDept.name)}</span></span>
                                                <button
                                                    type="button"
                                                    className="dp-icon-btn dp-icon-btn--danger"
                                                    onClick={() => setPendingDelete({ kind: 'department', id: editDept.id, label: editDept.name })}
                                                    title="Remove department"
                                                    aria-label="Remove department"
                                                >
                                                    <span className="material-icons-round">delete_outline</span>
                                                </button>
                                            </div>
                                            <span className="dp-kicker">Department</span>
                                            <h2 className="dp-feature__title">{editDept.name}</h2>
                                            <p className="dp-feature__desc">{editDept.description || 'No description yet — add one below.'}</p>
                                            <div className="dp-chips">
                                                <span className="dp-chip"><span className="material-icons-round">meeting_room</span>{editDeptUnits.length} unit{editDeptUnits.length === 1 ? '' : 's'}</span>
                                                <span className="dp-chip"><span className="material-icons-round">bed</span>{editDeptBeds.total} beds</span>
                                                <span className="dp-chip dp-chip--ok"><span className="material-icons-round">check_circle</span>{editDeptBeds.available} available</span>
                                            </div>
                                        </div>

                                        <div className="dp-split">
                                            <div className={`dp-card${detailLoading ? ' is-loading' : ''}`}>
                                                <CardTitle icon="edit_note" title="Details" right={detailLoading ? <span className="dp-muted">Loading…</span> : null} />
                                                <div className="dp-field">
                                                    <div className="dp-field__lab">
                                                        <label htmlFor="dept-detail-name">Name</label>
                                                        <span>{detailName.length}/{DEPARTMENT_NAME_MAX_LENGTH}</span>
                                                    </div>
                                                    <input
                                                        id="dept-detail-name"
                                                        className="input"
                                                        value={detailName}
                                                        maxLength={DEPARTMENT_NAME_MAX_LENGTH}
                                                        disabled={detailLoading || savingDeptDetails}
                                                        onChange={e => setDetailName(e.target.value.slice(0, DEPARTMENT_NAME_MAX_LENGTH))}
                                                    />
                                                </div>
                                                <div className="dp-field">
                                                    <div className="dp-field__lab">
                                                        <label htmlFor="dept-detail-desc">Description</label>
                                                        <span>{detailDescription.length}/{DEPARTMENT_DESCRIPTION_MAX_LENGTH}</span>
                                                    </div>
                                                    <textarea
                                                        id="dept-detail-desc"
                                                        className="input"
                                                        rows={4}
                                                        value={detailDescription}
                                                        maxLength={DEPARTMENT_DESCRIPTION_MAX_LENGTH}
                                                        disabled={detailLoading || savingDeptDetails}
                                                        onChange={e => setDetailDescription(e.target.value.slice(0, DEPARTMENT_DESCRIPTION_MAX_LENGTH))}
                                                    />
                                                </div>
                                                <div className="dp-actions">
                                                    {deptDetailsDirty && <span className="dp-dirty">Unsaved changes</span>}
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary"
                                                        onClick={updateDepartmentDetails}
                                                        disabled={!deptDetailsDirty || savingDeptDetails || detailLoading}
                                                    >
                                                        {savingDeptDetails ? 'Saving…' : 'Save changes'}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="dp-card dp-snap">
                                                <CardTitle icon="donut_large" title="Bed snapshot" />
                                                {editDeptBeds.total > 0 ? (
                                                    <>
                                                        <div className="dp-snap__ring">
                                                            <Ring pct={editDeptOcc} size={124}>
                                                                <span className="dp-ring-label dp-ring-label--lg">{editDeptOcc}%<small>occupied</small></span>
                                                            </Ring>
                                                        </div>
                                                        <BedStack available={editDeptBeds.available} occupied={editDeptBeds.occupied} blocked={editDeptBeds.blocked} />
                                                        <BedLegend {...editDeptBeds} />
                                                    </>
                                                ) : (
                                                    <EmptyState icon="bed" title="No mapped beds" body="Beds appear here once this department's units have rooms." compact />
                                                )}
                                            </div>
                                        </div>

                                        <div className="dp-card">
                                            <CardTitle
                                                icon="meeting_room"
                                                title="Units & workstations"
                                                right={<span className="dp-pill">{editDeptUnits.length}</span>}
                                            />
                                            <div className="dp-unit-grid">
                                                {editDeptUnits.map(u => (
                                                    <div key={u.id} className="dp-unit-tile">
                                                        <button
                                                            type="button"
                                                            className="dp-unit-tile__main"
                                                            onClick={() => { setActiveTab('units'); setShowAddUnit(false); setEditingUnit(u.id); }}
                                                        >
                                                            <span className="dp-unit-tile__icon"><span className="material-icons-round">{unitIcon(u.type, u.name, u.has_inpatient_beds !== false)}</span></span>
                                                            <span className="dp-unit-tile__name">{u.name}</span>
                                                            <span className="dp-unit-tile__sub">{unitBedLocationLabel(u, layoutBlocks)}</span>
                                                            {u.has_inpatient_beds === false ? (
                                                                <span className="dp-item__tag">Workstation only</span>
                                                            ) : unitIsUnmapped(u) ? (
                                                                <span className="dp-item__tag dp-item__tag--warn">Unmapped</span>
                                                            ) : (
                                                                <span className="dp-item__cap">
                                                                    <BedStack compact available={u.available_count || 0} occupied={u.occupied_count || 0} blocked={u.blocked_count || 0} />
                                                                    <span>{u.available_count || 0}/{u.bed_count || 0}</span>
                                                                </span>
                                                            )}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="dp-icon-btn dp-icon-btn--danger dp-unit-tile__del"
                                                            onClick={() => setPendingDelete({ kind: 'unit', id: u.id, label: u.name })}
                                                            title="Delete unit"
                                                            aria-label={`Delete ${u.name}`}
                                                        >
                                                            <span className="material-icons-round">delete_outline</span>
                                                        </button>
                                                    </div>
                                                ))}
                                                <button type="button" className="dp-unit-tile dp-unit-tile--add" onClick={openAddUnit}>
                                                    <span className="material-icons-round">add</span>
                                                    New unit
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="dp-card"><EmptyState icon="touch_app" title="Choose a department" body="Select a department on the left to see its units and details." /></div>
                                )
                            ) : showAddUnit ? (
                                <div className="dp-card dp-form-card fade-in">
                                    <FormHeader icon="add_home_work" title="New unit or workstation" sub="Place it in a building and floor. New buildings and floors are created automatically." />
                                    <div className="dp-grid2">
                                        <div className="dp-field">
                                            <div className="dp-field__lab"><span>Building / block *</span></div>
                                            <CustomSelect
                                                value={newUnitBuilding}
                                                onChange={next => {
                                                    const match = savedBuildings.find(block => block.id === next || block.name.trim().toLowerCase() === next.trim().toLowerCase());
                                                    setNewUnitBuilding(match ? match.id : next);
                                                    setNewUnitFloor('');
                                                }}
                                                options={buildingOptions(newUnitBuilding)}
                                                placeholder="Select a building"
                                                allowCustom
                                                customEntryTitle="Custom building"
                                                customEntryHint="Not listed? Type here, then Enter."
                                                customPlaceholder="Type building — Enter"
                                                style={selectStyle}
                                                maxH={280}
                                            />
                                        </div>
                                        <div className="dp-field">
                                            <div className="dp-field__lab"><span>Floor *</span></div>
                                            <CustomSelect
                                                value={newUnitFloor}
                                                onChange={setNewUnitFloor}
                                                options={buildingFloorOptions}
                                                placeholder={newUnitBuilding.trim() ? 'Select a floor' : 'Select a building first'}
                                                disabled={!newUnitBuilding.trim()}
                                                allowCustom
                                                customEntryTitle="Custom floor"
                                                customEntryHint="Not listed? Type here, then Enter."
                                                customPlaceholder="Type floor — Enter"
                                                style={selectStyle}
                                                maxH={280}
                                            />
                                        </div>
                                        <div className="dp-field dp-span2">
                                            <div className="dp-field__lab">
                                                <label htmlFor="new-unit-name">Name *</label>
                                                <span>{newUnitName.length}/{DEPARTMENT_NAME_MAX_LENGTH}</span>
                                            </div>
                                            <input
                                                id="new-unit-name"
                                                className="input"
                                                placeholder="e.g. Labour & Delivery Unit"
                                                value={newUnitName}
                                                maxLength={DEPARTMENT_NAME_MAX_LENGTH}
                                                onChange={e => setNewUnitName(e.target.value.slice(0, DEPARTMENT_NAME_MAX_LENGTH))}
                                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addUnit()}
                                            />
                                        </div>
                                        <div className="dp-field">
                                            <div className="dp-field__lab"><span>Unit code</span></div>
                                            <input className="input" placeholder="Optional" value={newUnitCode} onChange={e => setNewUnitCode(e.target.value)} />
                                        </div>
                                        <div className="dp-field">
                                            <div className="dp-field__lab"><span>Unit type</span></div>
                                            <CustomSelect
                                                value={newUnitType}
                                                onChange={setNewUnitType}
                                                options={unitTypeOptions(newUnitType)}
                                                placeholder="Select a type"
                                                allowCustom
                                                customEntryTitle="Custom type"
                                                customEntryHint="Not listed? Type here, then Enter."
                                                customPlaceholder="Type a type — Enter"
                                                style={selectStyle}
                                                maxH={280}
                                            />
                                        </div>
                                        <div className="dp-field">
                                            <div className="dp-field__lab"><span>Gender restriction</span></div>
                                            <CustomSelect
                                                value={newUnitGender}
                                                onChange={value => setNewUnitGender(pickGender(value))}
                                                options={genderOptions(newUnitGender)}
                                                placeholder="Select"
                                                allowCustom
                                                customEntryTitle="Custom gender"
                                                customEntryHint="Not listed? Type here, then Enter."
                                                customPlaceholder="Type gender — Enter"
                                                style={selectStyle}
                                                maxH={240}
                                            />
                                        </div>
                                        <InpatientSwitch id="new-unit-inpatient" checked={newUnitHasInpatientBeds} onChange={setNewUnitHasInpatientBeds} />
                                        <div className="dp-field dp-span2">
                                            <div className="dp-field__lab">
                                                <label htmlFor="new-unit-desc">Description</label>
                                                <span>{newUnitDescription.length}/{UNIT_DESCRIPTION_MAX_LENGTH}</span>
                                            </div>
                                            <textarea
                                                id="new-unit-desc"
                                                className="input"
                                                rows={4}
                                                value={newUnitDescription}
                                                maxLength={UNIT_DESCRIPTION_MAX_LENGTH}
                                                onChange={e => setNewUnitDescription(e.target.value.slice(0, UNIT_DESCRIPTION_MAX_LENGTH))}
                                            />
                                        </div>
                                    </div>
                                    <div className="dp-actions">
                                        <button type="button" className="btn btn-ghost" onClick={() => { resetNewUnitForm(); setShowAddUnit(false); }} disabled={addingUnit}>Cancel</button>
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={addUnit}
                                            disabled={!newUnitName.trim() || !newUnitBuilding.trim() || !newUnitFloor.trim() || addingUnit}
                                        >
                                            <span className="material-icons-round" style={{ fontSize: 17 }}>check</span>
                                            {addingUnit ? 'Adding…' : 'Create unit'}
                                        </button>
                                    </div>
                                </div>
                            ) : editUnit ? (
                                <div className="dp-stack fade-in" key={editUnit.id}>
                                    <div className="dp-feature">
                                        <span className="material-icons-round dp-feature__mark" aria-hidden>{unitIcon(editUnit.type, editUnit.name, editUnit.has_inpatient_beds !== false)}</span>
                                        <div className="dp-feature__top">
                                            <span className="dp-feature__icon"><span className="material-icons-round">{unitIcon(editUnit.type, editUnit.name, editUnit.has_inpatient_beds !== false)}</span></span>
                                            <button
                                                type="button"
                                                className="dp-icon-btn dp-icon-btn--danger"
                                                onClick={() => setPendingDelete({ kind: 'unit', id: editUnit.id, label: editUnit.name })}
                                                title="Delete unit"
                                                aria-label="Delete unit"
                                            >
                                                <span className="material-icons-round">delete_outline</span>
                                            </button>
                                        </div>
                                        <div className="dp-feature__row">
                                            <div className="dp-feature__body">
                                                <span className="dp-kicker">{editUnit.department_name || departments.find(d => d.id === editUnit.department_id)?.name || 'Unit / workstation'}</span>
                                                <h2 className="dp-feature__title">{editUnit.name}</h2>
                                                <p className="dp-feature__desc">
                                                    <span className="material-icons-round">place</span>
                                                    {unitBedLocationLabel(editUnit, layoutBlocks)}
                                                </p>
                                                <div className="dp-chips">
                                                    {editUnit.has_inpatient_beds === false
                                                        ? <span className="dp-chip"><span className="material-icons-round">desktop_windows</span>Workstation only</span>
                                                        : <span className="dp-chip"><span className="material-icons-round">bed</span>Inpatient</span>}
                                                    {editUnit.type ? <span className="dp-chip"><span className="material-icons-round">category</span>{wardTypeLabel(editUnit.type)}</span> : null}
                                                    {editUnit.gender_restriction ? <span className="dp-chip"><span className="material-icons-round">wc</span>{genderLabel(editUnit.gender_restriction)}</span> : null}
                                                    {editUnit.code ? <span className="dp-chip"><span className="material-icons-round">tag</span>{editUnit.code}</span> : null}
                                                </div>
                                            </div>
                                            {editUnit.has_inpatient_beds !== false && !unitIsUnmapped(editUnit) && (
                                                <div className="dp-feature__ring">
                                                    <Ring pct={editUnitOcc} size={112}>
                                                        <span className="dp-ring-label dp-ring-label--lg">{editUnitOcc}%<small>{unitCapacityLabel(editUnit) || 'occupied'}</small></span>
                                                    </Ring>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {editUnit.has_inpatient_beds !== false && (
                                        unitIsUnmapped(editUnit) ? (
                                            <div className="dp-card dp-callout">
                                                <span className="dp-callout__icon"><span className="material-icons-round">link_off</span></span>
                                                <div>
                                                    <strong>No rooms or beds mapped yet</strong>
                                                    <p>Add rooms and beds for this unit in Bed management to track capacity here.</p>
                                                </div>
                                                <a className="btn btn-secondary" href="/beds">Open Beds</a>
                                            </div>
                                        ) : (
                                            <div className="dp-statgrid">
                                                {[
                                                    { label: 'Total beds', value: editUnit.bed_count || 0, icon: 'bed', tone: 'slate' },
                                                    { label: 'Available', value: editUnit.available_count || 0, icon: 'check_circle', tone: 'ok' },
                                                    { label: 'Occupied', value: editUnit.occupied_count || 0, icon: 'person', tone: 'occ' },
                                                    { label: 'Out of service', value: editUnit.blocked_count || 0, icon: 'block', tone: 'oos' },
                                                    ...(typeof editUnit.patient_count === 'number'
                                                        ? [{ label: 'Patients', value: editUnit.patient_count, icon: 'personal_injury', tone: 'slate' }]
                                                        : []),
                                                ].map(stat => (
                                                    <div key={stat.label} className={`dp-stat dp-stat--${stat.tone}`}>
                                                        <span className="material-icons-round dp-stat__mark" aria-hidden>{stat.icon}</span>
                                                        <span className="dp-stat__icon"><span className="material-icons-round">{stat.icon}</span></span>
                                                        <span className="dp-stat__value">{stat.value}</span>
                                                        <span className="dp-stat__label">{stat.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    )}

                                    <div className="dp-split dp-split--wide">
                                        <div className={`dp-card${unitDetailLoading ? ' is-loading' : ''}`}>
                                            <CardTitle icon="edit_note" title="Details" right={unitDetailLoading ? <span className="dp-muted">Loading…</span> : null} />
                                            <div className="dp-grid2">
                                                <div className="dp-field dp-span2">
                                                    <div className="dp-field__lab">
                                                        <label htmlFor="unit-detail-name">Name</label>
                                                        <span>{unitDetailName.length}/{DEPARTMENT_NAME_MAX_LENGTH}</span>
                                                    </div>
                                                    <input
                                                        id="unit-detail-name"
                                                        className="input"
                                                        value={unitDetailName}
                                                        maxLength={DEPARTMENT_NAME_MAX_LENGTH}
                                                        disabled={unitDetailLoading || savingUnitDetails}
                                                        onChange={e => setUnitDetailName(e.target.value.slice(0, DEPARTMENT_NAME_MAX_LENGTH))}
                                                    />
                                                </div>
                                                <div className="dp-field">
                                                    <div className="dp-field__lab"><span>Building / block</span></div>
                                                    <CustomSelect
                                                        value={unitDetailBuilding}
                                                        onChange={next => {
                                                            const match = savedBuildings.find(block => block.id === next || block.name.trim().toLowerCase() === next.trim().toLowerCase());
                                                            setUnitDetailBuilding(match ? match.id : next);
                                                            setUnitDetailFloor('');
                                                        }}
                                                        disabled={unitDetailLoading || savingUnitDetails}
                                                        options={buildingOptions(unitDetailBuilding)}
                                                        placeholder="Select a building"
                                                        allowCustom
                                                        customEntryTitle="Custom building"
                                                        customEntryHint="Not listed? Type here, then Enter."
                                                        customPlaceholder="Type building — Enter"
                                                        style={selectStyle}
                                                        maxH={280}
                                                    />
                                                </div>
                                                <div className="dp-field">
                                                    <div className="dp-field__lab"><span>Floor</span></div>
                                                    <CustomSelect
                                                        value={unitDetailFloor}
                                                        onChange={setUnitDetailFloor}
                                                        disabled={unitDetailLoading || savingUnitDetails || !unitDetailBuilding.trim()}
                                                        options={editBuildingFloorOptions}
                                                        placeholder={unitDetailBuilding.trim() ? 'Select a floor' : 'Select a building first'}
                                                        allowCustom
                                                        customEntryTitle="Custom floor"
                                                        customEntryHint="Not listed? Type here, then Enter."
                                                        customPlaceholder="Type floor — Enter"
                                                        style={selectStyle}
                                                        maxH={280}
                                                    />
                                                </div>
                                                <div className="dp-field">
                                                    <div className="dp-field__lab"><span>Unit code</span></div>
                                                    <input
                                                        className="input"
                                                        placeholder="Optional"
                                                        value={unitDetailCode}
                                                        disabled={unitDetailLoading || savingUnitDetails}
                                                        onChange={e => setUnitDetailCode(e.target.value)}
                                                    />
                                                </div>
                                                <div className="dp-field">
                                                    <div className="dp-field__lab"><span>Unit type</span></div>
                                                    <CustomSelect
                                                        value={unitDetailType}
                                                        onChange={setUnitDetailType}
                                                        disabled={unitDetailLoading || savingUnitDetails}
                                                        options={unitTypeOptions(unitDetailType)}
                                                        placeholder="Optional"
                                                        allowCustom
                                                        allowClear
                                                        clearLabel="No type"
                                                        customEntryTitle="Custom type"
                                                        customEntryHint="Not listed? Type here, then Enter."
                                                        customPlaceholder="Type a type — Enter"
                                                        style={selectStyle}
                                                        maxH={280}
                                                    />
                                                </div>
                                                <div className="dp-field dp-span2">
                                                    <div className="dp-field__lab"><span>Gender restriction</span></div>
                                                    <CustomSelect
                                                        value={unitDetailGender}
                                                        onChange={value => setUnitDetailGender(pickGender(value))}
                                                        disabled={unitDetailLoading || savingUnitDetails}
                                                        options={genderOptions(unitDetailGender)}
                                                        placeholder="Select"
                                                        allowCustom
                                                        customEntryTitle="Custom gender"
                                                        customEntryHint="Not listed? Type here, then Enter."
                                                        customPlaceholder="Type gender — Enter"
                                                        style={selectStyle}
                                                        maxH={240}
                                                    />
                                                </div>
                                                <InpatientSwitch
                                                    id="unit-detail-inpatient"
                                                    checked={unitDetailHasInpatientBeds}
                                                    disabled={unitDetailLoading || savingUnitDetails}
                                                    onChange={setUnitDetailHasInpatientBeds}
                                                />
                                                <div className="dp-field dp-span2">
                                                    <div className="dp-field__lab">
                                                        <label htmlFor="unit-detail-desc">Description</label>
                                                        <span>{unitDetailDescription.length}/{UNIT_DESCRIPTION_MAX_LENGTH}</span>
                                                    </div>
                                                    <textarea
                                                        id="unit-detail-desc"
                                                        className="input"
                                                        rows={3}
                                                        value={unitDetailDescription}
                                                        maxLength={UNIT_DESCRIPTION_MAX_LENGTH}
                                                        disabled={unitDetailLoading || savingUnitDetails}
                                                        onChange={e => setUnitDetailDescription(e.target.value.slice(0, UNIT_DESCRIPTION_MAX_LENGTH))}
                                                    />
                                                </div>
                                            </div>
                                            <div className="dp-actions">
                                                {unitDetailsDirty && <span className="dp-dirty">Unsaved changes</span>}
                                                <button
                                                    type="button"
                                                    className="btn btn-primary"
                                                    onClick={updateUnitDetails}
                                                    disabled={!unitDetailsDirty || savingUnitDetails || unitDetailLoading}
                                                >
                                                    {savingUnitDetails ? 'Saving…' : 'Save changes'}
                                                </button>
                                            </div>
                                        </div>

                                        {editUnit.has_inpatient_beds !== false && !unitIsUnmapped(editUnit) && (
                                            <div className="dp-card">
                                                <CardTitle icon="door_front" title="Rooms" right={<span className="dp-pill">{editUnit.rooms?.length || 0}</span>} />
                                                <BedLegend
                                                    total={editUnit.bed_count || 0}
                                                    available={editUnit.available_count || 0}
                                                    occupied={editUnit.occupied_count || 0}
                                                    blocked={editUnit.blocked_count || 0}
                                                />
                                                <div className="dp-rooms">
                                                    {(editUnit.rooms || []).map(room => (
                                                        <div key={room.id} className="dp-room">
                                                            <span className="dp-room__no">{room.number}</span>
                                                            <span className="dp-room__main">
                                                                <span className="dp-room__name">{room.name || `Room ${room.number}`}</span>
                                                                <BedStack compact available={room.available_count} occupied={room.occupied_count} blocked={room.blocked_count} />
                                                            </span>
                                                            <span className="dp-room__beds">
                                                                <span><strong>{room.available_count}</strong>/{room.bed_count}</span>
                                                                <small>free</small>
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {(editUnit.rooms?.length || 0) === 0 && (
                                                        <p className="dp-muted">Room breakdown not returned for this unit.</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="dp-card"><EmptyState icon="touch_app" title="Choose a unit" body="Select a unit or workstation on the left to see beds and details." /></div>
                            )}
                        </section>
                    </section>
                </main>
            </div>

            {pendingDelete ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="departments-delete-confirm-title"
                    className="dp-modal"
                    onClick={() => setPendingDelete(null)}
                >
                    <div className="dp-modal__card" onClick={e => e.stopPropagation()}>
                        <span className="dp-modal__icon"><span className="material-icons-round">delete_forever</span></span>
                        <div id="departments-delete-confirm-title" className="dp-modal__title">
                            Delete {pendingDelete.kind === 'department' ? 'department' : 'unit'}?
                        </div>
                        <p className="dp-modal__body">
                            {pendingDelete.kind === 'department' ? (
                                <><strong>{pendingDelete.label}</strong> will be removed. This cannot be undone.</>
                            ) : (() => {
                                const unit = units.find(u => u.id === pendingDelete.id);
                                const rooms = unit?.room_count || unit?.rooms?.length || 0;
                                const beds = unit?.bed_count || 0;
                                const occupied = unit?.occupied_count || 0;
                                const parts = [
                                    rooms > 0 ? `${rooms} room${rooms === 1 ? '' : 's'}` : '',
                                    beds > 0 ? `${beds} bed${beds === 1 ? '' : 's'}` : '',
                                ].filter(Boolean);
                                return (
                                    <>
                                        <strong>{pendingDelete.label}</strong> will be removed.
                                        {parts.length > 0 ? <> This also deletes {parts.join(' and ')}.</> : null}
                                        {occupied > 0
                                            ? <> Free {occupied} occupied bed{occupied === 1 ? '' : 's'} first or delete will fail.</>
                                            : <> This cannot be undone.</>}
                                    </>
                                );
                            })()}
                        </p>
                        <div className="dp-actions dp-actions--center">
                            <button type="button" className="btn btn-secondary" onClick={() => setPendingDelete(null)}>Cancel</button>
                            <button type="button" className="btn btn-danger" onClick={confirmPendingDelete} disabled={deleteInProgress}>
                                {deleteInProgress ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}

/* ── Presentational helpers ─────────────────────────────────── */

function HospitalArt() {
    return (
        <svg className="dp-art" viewBox="0 0 120 96" aria-hidden>
            <defs>
                <linearGradient id="dpArtA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#dfe7f1" />
                </linearGradient>
                <linearGradient id="dpArtB" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#2c4266" />
                    <stop offset="100%" stopColor="#1b2a44" />
                </linearGradient>
            </defs>
            <ellipse cx="60" cy="88" rx="52" ry="6" fill="rgba(27,42,68,0.08)" />
            <rect x="14" y="40" width="30" height="46" rx="6" fill="url(#dpArtA)" stroke="rgba(27,42,68,0.12)" />
            <rect x="76" y="34" width="32" height="52" rx="6" fill="url(#dpArtA)" stroke="rgba(27,42,68,0.12)" />
            <rect x="36" y="18" width="48" height="68" rx="8" fill="url(#dpArtB)" />
            <rect x="52" y="26" width="16" height="16" rx="4" fill="#ffffff" />
            <path d="M60 29 V39 M55 34 H65" stroke="#c2414b" strokeWidth="3" strokeLinecap="round" />
            {[50, 60, 70].map(y => [44, 56, 68].map(x => (
                <rect key={`${x}-${y}`} x={x} y={y} width="8" height="6" rx="1.5" fill="rgba(255,255,255,0.35)" />
            )))}
            <rect x="54" y="74" width="12" height="12" rx="2" fill="rgba(255,255,255,0.55)" />
            {[48, 58, 68].map(y => <rect key={`l${y}`} x="20" y={y} width="18" height="5" rx="1.5" fill="rgba(27,42,68,0.12)" />)}
            {[44, 54, 64, 74].map(y => <rect key={`r${y}`} x="82" y={y} width="20" height="5" rx="1.5" fill="rgba(27,42,68,0.12)" />)}
        </svg>
    );
}

function EmptyState({ icon, title, body, action, compact }: {
    icon: string;
    title: string;
    body: string;
    action?: { label: string; onClick: () => void };
    compact?: boolean;
}) {
    return (
        <div className={`dp-empty${compact ? ' dp-empty--compact' : ''}`}>
            <span className="dp-empty__art"><span className="material-icons-round">{icon}</span></span>
            <strong>{title}</strong>
            <p>{body}</p>
            {action && (
                <button type="button" className="btn btn-primary btn-sm" onClick={action.onClick}>
                    <span className="material-icons-round" style={{ fontSize: 16 }}>add</span>
                    {action.label}
                </button>
            )}
        </div>
    );
}

function CardTitle({ icon, title, right }: { icon: string; title: string; right?: React.ReactNode }) {
    return (
        <div className="dp-card__hd">
            <h3><span className="material-icons-round">{icon}</span>{title}</h3>
            {right}
        </div>
    );
}

function FormHeader({ icon, title, sub }: { icon: string; title: string; sub: string }) {
    return (
        <div className="dp-form-hd">
            <span className="dp-form-hd__icon"><span className="material-icons-round">{icon}</span></span>
            <div>
                <h2>{title}</h2>
                <p>{sub}</p>
            </div>
        </div>
    );
}

function InpatientSwitch({ id, checked, onChange, disabled }: { id: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <label htmlFor={id} className={`dp-switch dp-span2${disabled ? ' is-disabled' : ''}`}>
            <span className="dp-switch__icon"><span className="material-icons-round">{checked ? 'bed' : 'desktop_windows'}</span></span>
            <span className="dp-switch__text">
                <strong>Has inpatient beds</strong>
                <span>When off, this unit is a workstation: hidden from bed management but still available for staffing and join requests.</span>
            </span>
            <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
            <span className="dp-switch__track" aria-hidden><span /></span>
        </label>
    );
}

function BedLegend({ total, available, occupied, blocked }: { total: number; available: number; occupied: number; blocked: number }) {
    return (
        <div className="dp-legend">
            <span><i className="is-occ" />{occupied} occupied</span>
            <span><i className="is-free" />{available} available</span>
            <span><i className="is-oos" />{blocked} out of service</span>
            <span className="dp-legend__total">{total} total</span>
        </div>
    );
}
