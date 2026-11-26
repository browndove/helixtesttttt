'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MacVibrancyToast, MacVibrancyToastPortal, macToastLeading } from '@/components/MacVibrancyToast';
import { API_ENDPOINTS } from '@/lib/config';
import { appendFacilityIdForProxy, getCachedClientFacilityId } from '@/lib/facility-client';
import FacilityGeofence from '@/components/geofence/FacilityGeofence';
import '@/components/glass/glass-page.css';
import '@/components/glass/staff-glass.css';
import '@/components/glass/staff-tabs-glass.css';
import './scheduling.css';
import ActivityPanel from './ActivityPanel';
import AttendancePanel from './AttendancePanel';
import ClockPanel from './ClockPanel';
import DepartmentRulesPanel from './DepartmentRulesPanel';
import RosterSettingsPanel from './RosterSettingsPanel';
import ShiftCodesPanel from './ShiftCodesPanel';
import StaffPanel from './StaffPanel';
import TargetsPanel from './TargetsPanel';
import { DeptPicker, Empty, Icon, type Notify } from './ui';

type Tab = 'geofence' | 'staff' | 'attendance' | 'setup' | 'activity';
type SetupTab = 'rules' | 'roster-settings' | 'shift-codes' | 'targets' | 'clock';
type Department = { id: string; name: string };
type Toast = { message: string; variant: 'success' | 'error' | 'info' };

const TABS: Array<[Tab, string, string]> = [
    ['geofence', 'travel_explore', 'Geofencing'],
    ['staff', 'groups', 'Staff'],
    ['attendance', 'how_to_reg', 'Attendance'],
    ['setup', 'tune', 'Setup'],
    ['activity', 'history', 'Activity'],
];

const SETUP: Array<{ id: SetupTab; icon: string; label: string; sub: string; facility?: boolean }> = [
    { id: 'rules', icon: 'rule', label: 'Department rules', sub: 'Hours, overtime, wards, swaps, publishing' },
    { id: 'roster-settings', icon: 'event_note', label: 'Roster settings', sub: 'Ranks, pairing, rest, approvals, windows' },
    { id: 'shift-codes', icon: 'badge', label: 'Shift codes', sub: 'Codes and their hours', facility: true },
    { id: 'targets', icon: 'groups_3', label: 'Staffing targets', sub: 'People needed per shift' },
    { id: 'clock', icon: 'fingerprint', label: 'Clock-in', sub: 'Rules and the facility boundary', facility: true },
];

const DEPT_KEY = () => `helix-scheduling-dept:${getCachedClientFacilityId() || 'default'}`;

function parseHash(): { tab: Tab; setup: SetupTab } {
    const [t, s] = window.location.hash.slice(1).split('/');
    const tab = (TABS.some(([id]) => id === t) ? t : 'geofence') as Tab;
    const setup = (SETUP.some(x => x.id === s) ? s : 'rules') as SetupTab;
    return { tab, setup };
}

async function fetchJson(url: string): Promise<unknown> {
    const res = await fetch(await appendFacilityIdForProxy(url), { credentials: 'include' });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
}

function listOf(raw: unknown, keys: string[]): Record<string, unknown>[] {
    if (Array.isArray(raw)) return raw as Record<string, unknown>[];
    const rec = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    for (const k of keys) if (Array.isArray(rec[k])) return rec[k] as Record<string, unknown>[];
    return [];
}

export default function SchedulingWorkspace() {
    const [tab, setTab] = useState<Tab>('geofence');
    const [setup, setSetup] = useState<SetupTab>('rules');
    const [departments, setDepartments] = useState<Department[]>([]);
    const [deptId, setDeptId] = useState('');
    const [deptError, setDeptError] = useState('');
    const [deptLoading, setDeptLoading] = useState(true);
    const [staffNames, setStaffNames] = useState<Map<string, string>>(new Map());

    const [toast, setToast] = useState<Toast | null>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const notify = useCallback<Notify>((message, variant = 'info') => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ message, variant });
        toastTimer.current = setTimeout(() => setToast(null), 3600);
    }, []);

    // The open tab lives in the URL hash (#setup/targets) so links and reloads keep it.
    useEffect(() => {
        const sync = () => {
            const h = parseHash();
            setTab(h.tab);
            setSetup(h.setup);
        };
        sync();
        window.addEventListener('hashchange', sync);
        return () => window.removeEventListener('hashchange', sync);
    }, []);
    const go = (t: Tab, s: SetupTab = setup) => {
        setTab(t);
        setSetup(s);
        window.history.replaceState(null, '', `#${t === 'setup' ? `setup/${s}` : t}`);
    };

    useEffect(() => {
        let alive = true;
        void (async () => {
            try {
                const list = listOf(await fetchJson(API_ENDPOINTS.DEPARTMENTS), ['departments', 'items', 'data'])
                    .filter(d => typeof d.id === 'string')
                    .map(d => ({ id: d.id as string, name: String(d.name || 'Department') }))
                    .sort((a, b) => a.name.localeCompare(b.name));
                if (!alive) return;
                setDepartments(list);
                let saved = '';
                try { saved = window.localStorage.getItem(DEPT_KEY()) || ''; } catch { /* storage blocked */ }
                setDeptId(list.some(d => d.id === saved) ? saved : list[0]?.id || '');
            } catch {
                if (alive) setDeptError('Couldn’t load departments.');
            } finally {
                if (alive) setDeptLoading(false);
            }
        })();
        // Names for the activity log (audit rows only carry user ids).
        void fetchJson('/api/proxy/staff?limit=1000')
            .then(raw => {
                if (!alive) return;
                const m = new Map<string, string>();
                for (const s of listOf(raw, ['items', 'staff', 'data'])) {
                    if (typeof s.id === 'string') m.set(s.id, [s.first_name, s.last_name].filter(Boolean).join(' ') || String(s.email || ''));
                }
                setStaffNames(m);
            })
            .catch(() => {});
        return () => { alive = false; };
    }, []);

    const pickDept = (id: string) => {
        setDeptId(id);
        try { window.localStorage.setItem(DEPT_KEY(), id); } catch { /* storage blocked */ }
    };

    const dept = departments.find(d => d.id === deptId);
    const setupItem = SETUP.find(s => s.id === setup)!;
    const needsDept = tab !== 'activity' && tab !== 'geofence' && !(tab === 'setup' && setupItem.facility);

    const deptPicker = departments.length > 0 ? <DeptPicker departments={departments} value={deptId} onChange={pickDept} /> : null;

    const body = () => {
        if (needsDept) {
            if (deptLoading) return <section className="st-card"><Empty icon="hourglass_empty" title="Loading departments…" /></section>;
            if (deptError) return <section className="st-card"><Empty icon="cloud_off" title={deptError} bad /></section>;
            if (!dept) return <section className="st-card"><Empty icon="domain_add" title="No departments yet" text="Create a department first; rosters are made per department." /></section>;
        }
        const p = { departmentId: deptId, departmentName: dept?.name || '', onNotify: notify };
        switch (tab) {
            case 'geofence': return <FacilityGeofence embedded />;
            case 'staff': return <StaffPanel key={deptId} {...p} />;
            case 'attendance': return <AttendancePanel key={deptId} departmentId={deptId} onNotify={notify} />;
            case 'activity': return <ActivityPanel staffNames={staffNames} />;
            case 'setup':
                switch (setup) {
                    case 'rules': return <DepartmentRulesPanel key={deptId} {...p} />;
                    case 'roster-settings': return <RosterSettingsPanel key={deptId} {...p} />;
                    case 'shift-codes': return <ShiftCodesPanel onNotify={notify} />;
                    case 'targets': return <TargetsPanel key={deptId} {...p} />;
                    case 'clock': return <ClockPanel onNotify={notify} />;
                }
        }
    };

    return (
        <>
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast.message} variant={toast.variant} leading={macToastLeading(toast.variant)} onDismiss={() => setToast(null)} />
                </MacVibrancyToastPortal>
            )}
            <div className="app-main gx-page sc-page">
                {/* Own header (not TopBar) so the tabs and department picker can sit inside the card and wrap on smaller screens. */}
                <header className="glass sc-header">
                    <div className="sc-header__inner">
                        <div className="sc-header__id">
                            <h1 className="sc-header__title">Scheduling</h1>
                            <span className="sc-header__dot" aria-hidden>·</span>
                            <span className="sc-header__sub" title="Rosters, shifts and attendance">Rosters, shifts and attendance</span>
                        </div>
                        <div className="sx-tabs sc-header__tabs" role="tablist" aria-label="Scheduling sections">
                            {TABS.map(([id, icon, label]) => (
                                <button key={id} type="button" role="tab" aria-selected={tab === id} className={`sx-tab${tab === id ? ' is-active' : ''}`} onClick={() => go(id)}>
                                    <span className="sx-tab__icon"><span className="material-icons-round">{icon}</span></span>
                                    {label}
                                </button>
                            ))}
                        </div>
                        {needsDept && deptPicker && <div className="sc-header__dept">{deptPicker}</div>}
                    </div>
                </header>

                <main className={`sc-main${tab === 'geofence' ? ' sc-main--fill' : ''}`}>
                    {tab === 'setup' ? (
                        <div className="sc-setup">
                            <nav className="sc-setup__nav" aria-label="Setup sections">
                                {SETUP.map(s => (
                                    <button key={s.id} type="button" className={`sc-setup__item${setup === s.id ? ' is-on' : ''}`} onClick={() => go('setup', s.id)} aria-current={setup === s.id ? 'page' : undefined}>
                                        <span className="sc-setup__icon"><Icon name={s.icon} /></span>
                                        <span className="sc-setup__text">
                                            <span className="sc-setup__label">{s.label}</span>
                                            <span className="sc-setup__sub">{s.facility ? 'Whole facility' : s.sub}</span>
                                        </span>
                                    </button>
                                ))}
                            </nav>
                            <div className="sc-setup__body">{body()}</div>
                        </div>
                    ) : body()}
                </main>
            </div>
        </>
    );
}
