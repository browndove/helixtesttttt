'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

type StaffMember = {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    job_title: string;
    dept: string;
    status: string;
    access: string;
    employee_id: string;
    patient_access: boolean;
};

type SortKey = 'first_name' | 'last_name' | 'employee_id' | 'dept' | 'job_title' | 'status';
type ImportStatus = 'success' | 'error';

type ImportHistoryEntry = {
    id: string;
    file: string;
    records: number;
    status: ImportStatus;
    warnings: number;
    date: string;
    user: string;
};

type BulkUploadSummary = {
    records: number;
    warnings: number;
    message: string;
};


function looksLikeStaffRecord(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const rec = value as Record<string, unknown>;
    const keys = ['id', 'staff_id', 'first_name', 'last_name', 'name', 'email', 'job_title', 'role', 'department', 'department_name'];
    return keys.some(k => rec[k] !== undefined && rec[k] !== null && String(rec[k]).trim() !== '');
}

function extractStaffArray(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== 'object') return [];

    const obj = raw as Record<string, unknown>;
    const preferredKeys = ['items', 'data', 'staff', 'results', 'rows', 'records', 'users', 'members'];
    for (const key of preferredKeys) {
        const value = obj[key];
        if (Array.isArray(value)) return value;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const nested = value as Record<string, unknown>;
            for (const nestedKey of preferredKeys) {
                const nestedValue = nested[nestedKey];
                if (Array.isArray(nestedValue)) return nestedValue;
            }
        }
    }

    // Final fallback: first array that looks like staff records.
    for (const value of Object.values(obj)) {
        if (!Array.isArray(value) || value.length === 0) continue;
        if (value.some(looksLikeStaffRecord)) return value;
    }

    return [];
}

function parseStaffList(raw: unknown): StaffMember[] {
    const list = extractStaffArray(raw);
    if (!Array.isArray(list)) return [];

    return list
        .map((row: unknown, idx): StaffMember | null => {
            if (!row || typeof row !== 'object') return null;
            const r = row as Record<string, unknown>;
            const first = String(r.first_name || '').trim();
            const last = String(r.last_name || '').trim();
            const full = String(r.name || '').trim();
            const [fullFirst = '', ...rest] = full.split(' ');
            const fullLast = rest.join(' ');
            const firstName = first || fullFirst || 'Unknown';
            const lastName = last || fullLast || 'Staff';
            const id = String(r.id || r.staff_id || `staff-${idx}`);
            const statusRaw = String(r.status || r.account_status || 'active').toLowerCase();
            const normalizedStatus = statusRaw.includes('disable') || statusRaw.includes('inactive') || statusRaw.includes('suspend')
                ? 'disabled'
                : 'active';
            return {
                id,
                first_name: firstName,
                last_name: lastName,
                email: String(r.email || ''),
                job_title: String(r.job_title || r.role || 'Staff'),
                dept: String(r.department_name || r.department || r.dept || 'Unassigned'),
                status: normalizedStatus,
                access: String(r.system_role || r.access || 'Staff'),
                employee_id: String(r.employee_id || r.username || id),
                patient_access: Boolean(r.patient_access ?? r.can_access_patients ?? false),
            };
        })
        .filter((s): s is StaffMember => Boolean(s));
}

const statusColors: Record<string, { color: string; bg: string; label: string }> = {
    active: { color: 'var(--success)', bg: 'var(--success-bg)', label: 'Active' },
    disabled: { color: 'var(--critical)', bg: 'var(--critical-bg)', label: 'Disabled' },
};


const importHistory: ImportHistoryEntry[] = [
    { id: 'IMP-001', file: 'staff_q4_import.csv', records: 142, status: 'success', warnings: 2, date: 'Nov 12, 2024', user: 'Dr. Kwame Asante' },
    { id: 'IMP-002', file: 'nurses_batch_oct.xlsx', records: 34, status: 'success', warnings: 0, date: 'Oct 28, 2024', user: 'Admin' },
    { id: 'IMP-003', file: 'staff_roles_v2.csv', records: 18, status: 'error', warnings: 0, date: 'Oct 14, 2024', user: 'Admin' },
];

function readNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function parseBulkUploadSummary(raw: unknown): BulkUploadSummary {
    const rec = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const records = [
        rec.records_processed,
        rec.processed,
        rec.created,
        rec.created_count,
        rec.success_count,
        rec.total_records,
        rec.total,
        rec.count,
    ].map(readNumber).find(v => v > 0) || 0;
    const warnings = [
        rec.warnings_count,
        rec.warning_count,
        rec.warnings,
    ].map(readNumber).find(v => v >= 0) || 0;
    const message = String(rec.message || rec.detail || rec.status || '').trim();
    return { records, warnings, message };
}

function getFacilityIdFromAuthMe(raw: unknown): string {
    const rec = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const user = rec.user && typeof rec.user === 'object' ? rec.user as Record<string, unknown> : null;
    const rootCandidates = [rec.facility_id, rec.facilityId, rec.current_facility_id, rec.currentFacilityId];
    const userCandidates = user ? [user.facility_id, user.facilityId, user.current_facility_id, user.currentFacilityId] : [];
    const resolved = [...rootCandidates, ...userCandidates].find(v => typeof v === 'string' && v.trim());
    return typeof resolved === 'string' ? resolved.trim() : '';
}

function getFacilityIdFromFacilityPayload(raw: unknown): string {
    if (Array.isArray(raw)) {
        const first = raw[0];
        return getFacilityIdFromFacilityPayload(first);
    }
    const rec = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const id = [rec.id, rec.facility_id, rec.facilityId]
        .find(v => typeof v === 'string' && v.trim());
    return typeof id === 'string' ? id.trim() : '';
}

function getUserNameFromAuthMe(raw: unknown): string {
    const rec = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const user = rec.user && typeof rec.user === 'object' ? rec.user as Record<string, unknown> : rec;
    const first = String((user as Record<string, unknown>).first_name || '').trim();
    const last = String((user as Record<string, unknown>).last_name || '').trim();
    const full = `${first} ${last}`.trim();
    return String((user as Record<string, unknown>).name || full || 'Admin').trim();
}

export default function StaffDirectoryManagement() {
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(false);
    const [search, setSearch] = useState('');
    const [toast, setToast] = useState<string | null>(null);
    const [deptFilter, setDeptFilter] = useState('all');
    const [selected, setSelected] = useState<StaffMember | null>(null);
    const [activeTab, setActiveTab] = useState<'directory' | 'import'>('directory');
    const [showAddForm, setShowAddForm] = useState(false);
    const [newFirstName, setNewFirstName] = useState('');
    const [newLastName, setNewLastName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newRole, setNewRole] = useState('');
    const [newDept, setNewDept] = useState('Cardiology');
    const [newPatientAccess, setNewPatientAccess] = useState(true);
    const [sortKey, setSortKey] = useState<SortKey>('last_name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dragOver, setDragOver] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [bulkHistory, setBulkHistory] = useState(importHistory);
    const [processing, setProcessing] = useState(false);
    const [adding, setAdding] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const departments = useMemo(() => ['all', ...Array.from(new Set(staff.map(s => s.dept)))], [staff]);

    const fetchStaff = useCallback(async () => {
        setFetchError(false);
        try {
            const res = await fetch('/api/proxy/staff?page_size=100&page_id=1');
            if (res.ok) {
                const data = await res.json();
                const parsed = parseStaffList(data);
                setStaff(parsed);
            } else {
                setFetchError(true);
            }
        } catch {
            setFetchError(true);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchStaff(); }, [fetchStaff]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const clearUploadedFile = () => {
        setUploadedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleBulkImport = async () => {
        if (!uploadedFile) return;
        setProcessing(true);
        try {
            let facilityId = '';
            let importedBy = 'Admin';

            // Priority 0: Read from helix-facility cookie (set by facility selector)
            const cookieMatch = document.cookie.match(/helix-facility=([^;]+)/);
            if (cookieMatch) facilityId = cookieMatch[1];

            const meRes = await fetch('/api/proxy/auth/me');
            if (meRes.ok) {
                const meData = await meRes.json().catch(() => ({}));
                if (!facilityId) facilityId = getFacilityIdFromAuthMe(meData);
                importedBy = getUserNameFromAuthMe(meData);
            }
            if (!facilityId) {
                const hospitalRes = await fetch('/api/proxy/hospital');
                if (hospitalRes.ok) {
                    const hospitalData = await hospitalRes.json().catch(() => ({}));
                    facilityId = getFacilityIdFromFacilityPayload(hospitalData);
                }
            }
            if (!facilityId) {
                const facilitiesRes = await fetch('/api/proxy/facilities');
                if (facilitiesRes.ok) {
                    const facilitiesData = await facilitiesRes.json().catch(() => ([]));
                    facilityId = getFacilityIdFromFacilityPayload(facilitiesData);
                }
            }
            if (!facilityId) {
                showToast('Unable to determine facility for bulk upload');
                return;
            }

            const formData = new FormData();
            formData.append('file', uploadedFile);
            formData.append('facility_id', facilityId);
            formData.append('facilityId', facilityId);

            const res = await fetch('/api/proxy/staff/bulk', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json().catch(() => ({}));
            const parsed = parseBulkUploadSummary(data);

            if (!res.ok) {
                const msg = String((data as { message?: string; detail?: string; error?: string }).message || (data as { message?: string; detail?: string; error?: string }).detail || (data as { message?: string; detail?: string; error?: string }).error || 'Bulk import failed');
                setBulkHistory(prev => [{
                    id: `IMP-${String(prev.length + 1).padStart(3, '0')}`,
                    file: uploadedFile.name,
                    records: parsed.records,
                    status: 'error',
                    warnings: parsed.warnings,
                    date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
                    user: importedBy,
                }, ...prev]);
                showToast(msg);
                return;
            }

            setBulkHistory(prev => [{
                id: `IMP-${String(prev.length + 1).padStart(3, '0')}`,
                file: uploadedFile.name,
                records: parsed.records,
                status: 'success',
                warnings: parsed.warnings,
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
                user: importedBy,
            }, ...prev]);
            showToast(parsed.message || `Import completed: ${parsed.records} records processed`);
            clearUploadedFile();
            setLoading(true);
            fetchStaff();
        } catch {
            showToast('Bulk import failed');
        } finally {
            setProcessing(false);
        }
    };

    const filtered = staff.filter(s => {
        const q = search.toLowerCase();
        const matchSearch = search === '' || s.first_name.toLowerCase().includes(q) || s.last_name.toLowerCase().includes(q) || s.dept.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.employee_id.toLowerCase().includes(q) || s.job_title.toLowerCase().includes(q);
        const matchDept = deptFilter === 'all' || s.dept === deptFilter;
        const matchStatus = statusFilter === 'all' || s.status === statusFilter;
        return matchSearch && matchDept && matchStatus;
    }).sort((a, b) => {
        const av = a[sortKey].toLowerCase();
        const bv = b[sortKey].toLowerCase();
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    const handleAdd = async () => {
        if (!newFirstName.trim() || !newLastName.trim() || !newEmail.trim()) return;
        setAdding(true);
        try {
            const res = await fetch('/api/proxy/staff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: newFirstName.trim(),
                    last_name: newLastName.trim(),
                    email: newEmail.trim(),
                    phone: newPhone.trim(),
                    job_title: (newRole || 'Staff').trim(),
                    role: 'staff',
                    department: newDept,
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({} as { message?: string; detail?: string; error?: string }));
                showToast(String(err.message || err.detail || err.error || 'Failed to add staff'));
                return;
            }

            const data = await res.json();
            const created = parseStaffList([data])[0];
            const fallbackMember: StaffMember = {
                id: String(Date.now()),
                first_name: newFirstName.trim(),
                last_name: newLastName.trim(),
                email: newEmail.trim(),
                job_title: (newRole || 'Staff').trim(),
                dept: newDept,
                status: 'active',
                access: 'Staff',
                employee_id: '',
                patient_access: newPatientAccess,
            };

            setStaff(prev => [created || fallbackMember, ...prev]);
            setShowAddForm(false);
            setNewFirstName('');
            setNewLastName('');
            setNewEmail('');
            setNewPhone('');
            setNewRole('');
            setNewPatientAccess(true);
            showToast(`${newFirstName} ${newLastName} added to staff`);
        } catch {
            showToast('Failed to add staff');
        } finally {
            setAdding(false);
        }
    };

    const handleRemove = async (id: string) => {
        const member = staff.find(s => s.id === id);
        setStaff(prev => prev.filter(s => s.id !== id));
        if (selected?.id === id) setSelected(null);
        showToast(`${member?.first_name} ${member?.last_name} removed`);
        try {
            await fetch(`/api/proxy/staff/${id}`, { method: 'DELETE' });
        } catch { /* optimistic — already removed locally */ }
    };

    const toggleStatus = async (id: string) => {
        const member = staff.find(s => s.id === id);
        const newStatus = member?.status === 'active' ? 'disabled' : 'active';
        setStaff(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
        showToast(newStatus === 'disabled' ? `${member?.first_name} ${member?.last_name} disabled` : `${member?.first_name} ${member?.last_name} enabled`);
        try {
            await fetch(`/api/proxy/staff/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
        } catch { /* optimistic — already updated locally */ }
    };

    const togglePatientAccess = async (id: string, currentAccess: boolean) => {
        const newVal = !currentAccess;
        const member = staff.find(s => s.id === id);
        setStaff(prev => prev.map(s => s.id === id ? { ...s, patient_access: newVal } : s));
        setSelected(prev => prev && prev.id === id ? { ...prev, patient_access: newVal } : prev);
        showToast(`Patient access ${newVal ? 'granted' : 'revoked'} for ${member?.first_name} ${member?.last_name}`);
        try {
            await fetch(`/api/proxy/staff/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patient_access: newVal }),
            });
        } catch {
            // Rollback on failure
            setStaff(prev => prev.map(s => s.id === id ? { ...s, patient_access: currentAccess } : s));
            setSelected(prev => prev && prev.id === id ? { ...prev, patient_access: currentAccess } : prev);
            showToast('Failed to update patient access');
        }
    };

    return (
        <div className="app-shell">
            <Sidebar sections={navSections} />

            {toast && (
                <div className="toast-enter" style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '10px 18px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--success)' }}>check_circle</span>
                    {toast}
                </div>
            )}

            <div className="app-main">
                <TopBar
                    title="Staff Management"
                    subtitle="Directory & Import"
                    search={activeTab === 'directory' ? { placeholder: 'Search by name, dept, or email...', value: search, onChange: setSearch } : undefined}
                    actions={
                        <div style={{ display: 'flex', gap: 8 }}>
                            {activeTab === 'directory' && (
                                <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>{showAddForm ? 'close' : 'add'}</span>
                                    {showAddForm ? 'Cancel' : 'Add Staff'}
                                </button>
                            )}
                        </div>
                    }
                />

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-default)', padding: '0 24px', background: '#fff' }}>
                    {([['directory', 'groups', 'Staff Directory'], ['import', 'upload_file', 'Bulk Import']] as const).map(([id, icon, label]) => (
                        <button key={id} onClick={() => setActiveTab(id as 'directory' | 'import')}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', fontSize: 13, fontWeight: activeTab === id ? 600 : 500, color: activeTab === id ? 'var(--helix-primary)' : 'var(--text-muted)', background: 'transparent', border: 'none', borderBottom: activeTab === id ? '2px solid var(--helix-primary)' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
                            <span className="material-icons-round" style={{ fontSize: 16 }}>{icon}</span>{label}
                        </button>
                    ))}
                </div>

                {activeTab === 'directory' ? (
                <main style={{ flex: 1, overflow: 'auto', padding: '20px 24px', background: 'var(--bg-900)' }}>

                    {/* Add Staff Form */}
                    {showAddForm && (
                        <div className="fade-in card" style={{ marginBottom: 18, padding: '18px 20px' }}>
                            <h3 style={{ fontSize: 14, marginBottom: 12 }}>New Staff Member</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr 1fr 1fr 1fr 0.8fr', gap: 12, marginBottom: 14 }}>
                                <div><label className="label">First Name *</label><input className="input" value={newFirstName} onChange={e => setNewFirstName(e.target.value)} placeholder="First name" style={{ fontSize: 12 }} /></div>
                                <div><label className="label">Last Name *</label><input className="input" value={newLastName} onChange={e => setNewLastName(e.target.value)} placeholder="Last name" style={{ fontSize: 12 }} /></div>
                                <div><label className="label">Email *</label><input className="input" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email address" style={{ fontSize: 12 }} /></div>
                                <div><label className="label">Phone</label><input className="input" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+233241234567" style={{ fontSize: 12 }} /></div>
                                <div><label className="label">Job Title</label><input className="input" value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="e.g. Nurse" style={{ fontSize: 12 }} /></div>
                                <div><label className="label">Department</label><select className="input" value={newDept} onChange={e => setNewDept(e.target.value)} style={{ fontSize: 12 }}>{['Cardiology', 'ICU', 'Emergency', 'Pediatrics', 'Internal Med', 'Radiology', 'Surgery'].map(d => <option key={d}>{d}</option>)}</select></div>
                                <div><label className="label">Patient Access</label><select className="input" value={newPatientAccess ? 'yes' : 'no'} onChange={e => setNewPatientAccess(e.target.value === 'yes')} style={{ fontSize: 12 }}><option value="yes">Yes</option><option value="no">No</option></select></div>
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={adding || !newFirstName.trim() || !newLastName.trim() || !newEmail.trim()}>
                                <span className="material-icons-round" style={{ fontSize: 14 }}>{adding ? 'hourglass_empty' : 'person_add'}</span>{adding ? 'Adding...' : 'Add Staff'}
                            </button>
                        </div>
                    )}

                    {/* Filters & Sort */}
                    <div className="fade-in delay-1" style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                            {departments.map(d => (
                                <button key={d} className="btn btn-secondary btn-xs" onClick={() => setDeptFilter(d)}
                                    style={{ background: deptFilter === d ? '#edf1f7' : undefined, borderColor: deptFilter === d ? 'var(--helix-primary)' : undefined, color: deptFilter === d ? 'var(--helix-primary)' : undefined, fontWeight: deptFilter === d ? 600 : 400 }}>
                                    {d === 'all' ? 'All Depts' : d}
                                </button>
                            ))}
                        </div>
                        <div style={{ width: 1, height: 20, background: 'var(--border-subtle)' }} />
                        <div style={{ display: 'flex', gap: 5 }}>
                            {['all', 'active', 'disabled'].map(s => (
                                <button key={s} className="btn btn-secondary btn-xs" onClick={() => setStatusFilter(s)}
                                    style={{ background: statusFilter === s ? '#edf1f7' : undefined, borderColor: statusFilter === s ? 'var(--helix-primary)' : undefined, color: statusFilter === s ? 'var(--helix-primary)' : undefined, fontWeight: statusFilter === s ? 600 : 400 }}>
                                    {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                            ))}
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                            <span className="material-icons-round" style={{ fontSize: 14 }}>sort</span>
                            <select className="input" value={`${sortKey}-${sortDir}`} onChange={e => { const [k, d] = e.target.value.split('-'); setSortKey(k as SortKey); setSortDir(d as 'asc' | 'desc'); }} style={{ fontSize: 11, padding: '4px 8px', height: 28, minWidth: 140 }}>
                                <option value="last_name-asc">Last Name A-Z</option>
                                <option value="last_name-desc">Last Name Z-A</option>
                                <option value="first_name-asc">First Name A-Z</option>
                                <option value="first_name-desc">First Name Z-A</option>
                                <option value="dept-asc">Department A-Z</option>
                                <option value="dept-desc">Department Z-A</option>
                                <option value="job_title-asc">Job Title A-Z</option>
                                <option value="employee_id-asc">Employee ID A-Z</option>
                                <option value="status-asc">Status A-Z</option>
                            </select>
                        </div>
                    </div>

                    {/* Table + Detail */}
                    <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 340px' : '1fr', gap: 20 }}>
                        <div className="fade-in delay-2 card" style={{ padding: 0, overflow: 'hidden' }}>
                            <div className="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('employee_id')}>Employee ID {sortKey === 'employee_id' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                                            <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('first_name')}>First Name {sortKey === 'first_name' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                                            <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('last_name')}>Last Name {sortKey === 'last_name' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                                            <th>Email</th>
                                            <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('job_title')}>Job Title {sortKey === 'job_title' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                                            <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('dept')}>Department {sortKey === 'dept' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                                            <th>Patient Access</th>
                                            <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('status')}>Status {sortKey === 'status' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                                            <th style={{ width: 40 }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading && filtered.length === 0 && (
                                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                                                <span className="material-icons-round" style={{ fontSize: 24, display: 'block', marginBottom: 8, opacity: 0.4 }}>hourglass_empty</span>
                                                Loading staff from server...
                                            </td></tr>
                                        )}
                                        {!loading && fetchError && filtered.length === 0 && (
                                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                                                <span className="material-icons-round" style={{ fontSize: 24, display: 'block', marginBottom: 8, color: 'var(--critical)' }}>cloud_off</span>
                                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Could not load staff</div>
                                                <div style={{ marginBottom: 12 }}>The server is unreachable. Check your connection and try again.</div>
                                                <button className="btn btn-primary btn-sm" onClick={() => { setLoading(true); fetchStaff(); }}>
                                                    <span className="material-icons-round" style={{ fontSize: 14 }}>refresh</span> Retry
                                                </button>
                                            </td></tr>
                                        )}
                                        {!loading && !fetchError && filtered.length === 0 && (
                                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                                                <span className="material-icons-round" style={{ fontSize: 24, display: 'block', marginBottom: 8, opacity: 0.4 }}>person_off</span>
                                                {search || deptFilter !== 'all' || statusFilter !== 'all' ? 'No staff match your filters.' : 'No staff members yet. Add staff above to get started.'}
                                            </td></tr>
                                        )}
                                        {filtered.map(s => {
                                            const st = statusColors[s.status] || statusColors.active;
                                            return (
                                                <tr key={s.id} onClick={() => setSelected(selected?.id === s.id ? null : s)} style={{ cursor: 'pointer', background: selected?.id === s.id ? 'rgba(30,58,95,0.05)' : undefined }}>
                                                    <td style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: "'Montserrat', sans-serif" }}>{s.employee_id}</td>
                                                    <td style={{ fontWeight: 500 }}>{s.first_name}</td>
                                                    <td style={{ fontWeight: 600 }}>{s.last_name}</td>
                                                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.email}</td>
                                                    <td style={{ color: 'var(--text-secondary)' }}>{s.job_title}</td>
                                                    <td style={{ color: 'var(--text-secondary)' }}>{s.dept}</td>
                                                    <td>
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px 3px 6px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.patient_access ? 'rgba(34,139,34,0.08)' : 'rgba(120,120,120,0.08)', color: s.patient_access ? '#2d8a4e' : '#888', border: `1px solid ${s.patient_access ? 'rgba(34,139,34,0.18)' : 'rgba(120,120,120,0.15)'}` }}>
                                                            <span className="material-icons-round" style={{ fontSize: 13 }}>{s.patient_access ? 'verified_user' : 'shield'}</span>
                                                            {s.patient_access ? 'Granted' : 'None'}
                                                        </div>
                                                    </td>
                                                    <td><span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                                                    <td>
                                                        <button className="btn btn-ghost btn-xs" onClick={e => { e.stopPropagation(); handleRemove(s.id); }}>
                                                            <span className="material-icons-round" style={{ fontSize: 14, color: 'var(--text-muted)' }}>delete</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)' }}>
                                {loading ? 'Loading staff...' : `Showing ${filtered.length} of ${staff.length} staff`}
                            </div>
                        </div>

                        {/* Detail Panel */}
                        {selected && (
                            <div className="slide-in-right" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div className="card" style={{ padding: '18px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                                        <div>
                                            <h3 style={{ fontSize: 15 }}>{selected.first_name} {selected.last_name}</h3>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{selected.job_title} · {selected.dept}</div>
                                        </div>
                                        <button className="btn btn-ghost btn-xs" onClick={() => setSelected(null)}>
                                            <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {[
                                            { label: 'Email', value: selected.email, icon: 'mail' },
                                            { label: 'Department', value: selected.dept, icon: 'domain' },
                                            { label: 'Job Title', value: selected.job_title, icon: 'badge' },
                                            { label: 'Employee ID', value: selected.employee_id, icon: 'fingerprint' },
                                        ].map(row => (
                                            <div key={row.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                                <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--text-disabled)', marginTop: 1 }}>{row.icon}</span>
                                                <div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{row.label}</div>
                                                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, marginTop: 1 }}>{row.value}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Patient Access - toggleable */}
                                    <div style={{ marginTop: 6, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: selected.patient_access ? 'rgba(34,139,34,0.05)' : 'rgba(120,120,120,0.04)', border: `1px solid ${selected.patient_access ? 'rgba(34,139,34,0.15)' : 'rgba(120,120,120,0.12)'}`, transition: 'all 0.2s' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span className="material-icons-round" style={{ fontSize: 18, color: selected.patient_access ? '#2d8a4e' : '#999' }}>{selected.patient_access ? 'verified_user' : 'shield'}</span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: selected.patient_access ? '#2d8a4e' : '#888' }}>Patient Records Access</div>
                                                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>{selected.patient_access ? 'Can view and manage patient records.' : 'No access to patient records.'}</div>
                                            </div>
                                            <button type="button" onClick={() => togglePatientAccess(selected.id, selected.patient_access)}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 14, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em', cursor: 'pointer', transition: 'all 0.15s', border: `1px solid ${selected.patient_access ? 'rgba(34,139,34,0.25)' : 'rgba(120,120,120,0.2)'}`, background: selected.patient_access ? 'rgba(34,139,34,0.12)' : 'rgba(120,120,120,0.1)', color: selected.patient_access ? '#2d8a4e' : '#888' }}
                                                onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
                                                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                                            >
                                                <span className="material-icons-round" style={{ fontSize: 12 }}>{selected.patient_access ? 'toggle_on' : 'toggle_off'}</span>
                                                {selected.patient_access ? 'GRANTED' : 'NONE'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="card" style={{ padding: '18px' }}>
                                    <h3 style={{ fontSize: 14, marginBottom: 10 }}>Actions</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => showToast('Password reset email sent')}>
                                            <span className="material-icons-round" style={{ fontSize: 15 }}>lock_reset</span>Reset Password
                                        </button>
                                        <button className={`btn ${selected.status === 'active' ? 'btn-danger' : 'btn-secondary'} btn-sm`} style={{ justifyContent: 'flex-start' }} onClick={() => { toggleStatus(selected.id); setSelected(prev => prev ? { ...prev, status: prev.status === 'active' ? 'disabled' : 'active' } : null); }}>
                                            <span className="material-icons-round" style={{ fontSize: 15 }}>{selected.status === 'active' ? 'block' : 'check_circle'}</span>
                                            {selected.status === 'active' ? 'Disable Account' : 'Enable Account'}
                                        </button>
                                        <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => { handleRemove(selected.id); }}>
                                            <span className="material-icons-round" style={{ fontSize: 15 }}>delete</span>Remove Staff
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
                ) : (
                /* Bulk Import Tab */
                <main style={{ flex: 1, overflow: 'auto', padding: '20px 24px', background: 'var(--bg-900)' }}>
                    <div className="fade-in" style={{ marginBottom: 20 }}>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 540 }}>Upload a CSV or Excel file to bulk-add staff members. Download a template first to ensure proper formatting.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: 20, marginBottom: 24 }}>
                        <div className="fade-in delay-1 card">
                            <h3 style={{ marginBottom: 14 }}>Upload Staff File</h3>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                style={{ display: 'none' }}
                                onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) setUploadedFile(file);
                                }}
                            />
                            <div
                                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={e => {
                                    e.preventDefault();
                                    setDragOver(false);
                                    const file = e.dataTransfer.files?.[0];
                                    if (file) setUploadedFile(file);
                                }}
                                onClick={() => fileInputRef.current?.click()}
                                style={{ border: `2px dashed ${dragOver ? 'var(--helix-primary)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-lg)', padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(30,58,95,0.05)' : 'var(--surface-2)', transition: 'all 0.2s' }}>
                                <div style={{ width: 52, height: 52, background: uploadedFile ? 'var(--success-bg)' : 'rgba(30,58,95,0.1)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                                    <span className="material-icons-round" style={{ fontSize: 26, color: uploadedFile ? 'var(--success)' : 'var(--helix-primary-light)' }}>{uploadedFile ? 'check_circle' : 'cloud_upload'}</span>
                                </div>
                                {uploadedFile ? (
                                    <><div style={{ fontWeight: 600, color: 'var(--success)' }}>{uploadedFile.name}</div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>File ready for import</div></>
                                ) : (
                                    <><div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Click to upload or drag and drop</div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>CSV, XLSX or XLS (max. 50MB)</div></>
                                )}
                            </div>
                            {uploadedFile && (
                                <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                                    <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={processing} onClick={handleBulkImport}>
                                        <span className="material-icons-round" style={{ fontSize: 16 }}>{processing ? 'hourglass_empty' : 'upload'}</span>{processing ? 'Processing...' : 'Process Import'}
                                    </button>
                                    <button className="btn btn-secondary btn-sm" onClick={clearUploadedFile}><span className="material-icons-round" style={{ fontSize: 16 }}>close</span></button>
                                </div>
                            )}
                        </div>

                        <div className="fade-in delay-2 card">
                            <h3 style={{ marginBottom: 14 }}>Download Template</h3>
                            {[
                                { icon: 'badge', label: 'Staff Template', desc: 'Email, names, phone, title, department, patient access', color: '#4a6fa5', href: '/templates/staff_bulk_upload.csv' },
                            ].map(t => (
                                <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: 8, cursor: 'pointer', background: 'var(--surface-2)' }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 9, background: `${t.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span className="material-icons-round" style={{ fontSize: 18, color: t.color }}>{t.icon}</span>
                                    </div>
                                    <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{t.label}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.desc}</div></div>
                                    <a
                                        className="btn btn-ghost btn-xs"
                                        href={t.href}
                                        download
                                        onClick={() => showToast(`${t.label} downloaded`)}
                                    >
                                        <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--text-muted)' }}>download</span>
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="fade-in delay-3 card">
                        <h3 style={{ marginBottom: 14 }}>Import History</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {bulkHistory.map(h => (
                                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: h.status === 'success' ? 'var(--success-bg)' : 'var(--error-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span className="material-icons-round" style={{ fontSize: 18, color: h.status === 'success' ? 'var(--success)' : 'var(--error)' }}>{h.status === 'success' ? 'check_circle' : 'error'}</span>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{h.file}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{h.records} records · {h.date} · {h.user}</div>
                                    </div>
                                    {h.warnings > 0 && <span className="badge badge-warning">{h.warnings} warnings</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </main>
                )}
            </div>
        </div>
    );
}
