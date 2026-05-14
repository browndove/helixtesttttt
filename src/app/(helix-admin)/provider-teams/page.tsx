'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import TopBar from '@/components/TopBar';
import CustomSelect from '@/components/CustomSelect';
import { MacVibrancyToast, MacVibrancyToastPortal, type MacVibrancyToastVariant } from '@/components/MacVibrancyToast';

type Member = {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    status: string;
};

type TeamLinkedRole = {
    id: string;
    name: string;
    /** Display name of the staff currently signed-in to (covering) this role, when known. */
    coveredByName?: string;
    /** Backend user id of the current coverer. */
    coveredById?: string;
};

/** Pull a coverer's display name out of a role payload's signed_in_user / signed_in_by fields. */
function extractRoleCoverer(o: Record<string, unknown>): { coveredByName?: string; coveredById?: string } {
    const su = o.signed_in_user;
    if (su && typeof su === 'object' && !Array.isArray(su)) {
        const r = su as Record<string, unknown>;
        const first = typeof r.first_name === 'string' ? r.first_name.trim() : '';
        const last = typeof r.last_name === 'string' ? r.last_name.trim() : '';
        const name = typeof r.name === 'string' ? r.name.trim() : '';
        const email = typeof r.email === 'string' ? r.email.trim() : '';
        const id = typeof r.id === 'string' ? r.id.trim() : '';
        const display = name || `${first} ${last}`.trim() || email;
        if (display) return { coveredByName: display, coveredById: id || undefined };
    }
    const sb = o.signed_in_by;
    if (typeof sb === 'string' && sb.trim()) {
        return { coveredById: sb.trim() };
    }
    return {};
}

type Team = {
    id: string;
    name: string;
    departmentId?: string;
    department: string;
    description: string;
    lead: string;
    leadId?: string;
    /** From API `lead.username` — shown under lead name in detail */
    leadUsername?: string;
    memberCount: number;
    members: Member[];
    createdAt: string;
    isResuscitationTeam: boolean;
    linkedRoles: TeamLinkedRole[];
    /** From API `code_blue_message_template` when present */
    codeBlueMessageTemplate?: string;
};
type PendingRemoval =
    | { type: 'member'; id: string; label: string }
    | { type: 'role'; id: string; label: string };

const roleOptions = ['Team Lead', 'Charge Nurse', 'Nurse', 'Resident', 'Surgeon', 'Intensivist', 'ICU Nurse', 'Anesthesiologist', 'Scrub Nurse', 'Pediatrician', 'Physician'];

type StaffEntry = { id: string; first_name: string; last_name: string; job_title: string; dept: string; employee_id: string };

type DepartmentEntry = { id: string; name: string };

const statusColor: Record<string, string> = {
    Active: 'var(--success)',
    'On Leave': 'var(--warning)',
    'Off Duty': 'var(--text-muted)',
};

function toStatusLabel(status?: string): 'Active' | 'On Leave' | 'Off Duty' {
    const s = (status || '').toLowerCase();
    if (s.includes('leave')) return 'On Leave';
    if (s.includes('off')) return 'Off Duty';
    return 'Active';
}

function parseDepartments(raw: unknown): DepartmentEntry[] {
    const list = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === 'object'
            ? ((raw as { items?: unknown; data?: unknown; departments?: unknown }).items
                || (raw as { items?: unknown; data?: unknown; departments?: unknown }).data
                || (raw as { items?: unknown; data?: unknown; departments?: unknown }).departments)
            : []);
    if (!Array.isArray(list)) return [];

    return list
        .map((d: unknown) => {
            if (!d || typeof d !== 'object') return null;
            const rec = d as { id?: string; department_id?: string; name?: string; department_name?: string };
            const id = rec.id || rec.department_id || '';
            const name = rec.name || rec.department_name || '';
            return id && name ? { id, name } : null;
        })
        .filter((d): d is DepartmentEntry => Boolean(d));
}

function parseStaff(raw: unknown): StaffEntry[] {
    const list = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === 'object'
            ? ((raw as { items?: unknown; data?: unknown; staff?: unknown }).items
                || (raw as { items?: unknown; data?: unknown; staff?: unknown }).data
                || (raw as { items?: unknown; data?: unknown; staff?: unknown }).staff)
            : []);
    if (!Array.isArray(list)) return [];

    return list
        .map((s: unknown, idx) => {
            if (!s || typeof s !== 'object') return null;
            const rec = s as Record<string, unknown>;
            return {
                id: String(rec.id || rec.staff_id || `s-${idx}`),
                first_name: String(rec.first_name || '').trim(),
                last_name: String(rec.last_name || '').trim(),
                job_title: String(rec.job_title || rec.role || 'Staff'),
                dept: String(rec.department_name || rec.department || rec.dept || 'Unassigned'),
                employee_id: String(rec.employee_id || rec.username || rec.id || `EMP-${idx}`),
            };
        })
        .filter((s): s is StaffEntry => Boolean(s));
}

function parseEmbeddedTeamRoles(rec: Record<string, unknown>): TeamLinkedRole[] {
    // GET /teams/{id} returns roles under `assigned_roles` where each entry's top-level `id`
    // is the assignment id and `role_id` is the actual facility-role id we need.
    const raw = rec.assigned_roles ?? rec.roles ?? rec.linked_roles ?? rec.team_roles;
    if (!Array.isArray(raw)) return [];
    return raw
        .map((r: unknown, i: number) => {
            if (!r || typeof r !== 'object') return null;
            const o = r as Record<string, unknown>;
            const id = String(o.role_id ?? o.id ?? `role-${i}`);
            const name = String(o.name ?? o.role_name ?? 'Role');
            return id ? { id, name, ...extractRoleCoverer(o) } : null;
        })
        .filter((x): x is TeamLinkedRole => Boolean(x));
}

/** Strip OpenAPI-style placeholders like literal `"string"` */
function cleanApiString(v: unknown): string {
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s || s === 'string') return '';
    return s;
}

function formatTeamCreatedAt(raw: unknown): string {
    const s = cleanApiString(raw);
    if (!s) return '';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s.length >= 10 ? s.slice(0, 10) : s;
    return d.toISOString().slice(0, 10);
}

function formatLeadFromLeadObject(leadObj: Record<string, unknown>): {
    leadDisplay: string;
    leadId: string;
    leadUsername: string;
} {
    const first = cleanApiString(leadObj.first_name);
    const last = cleanApiString(leadObj.last_name);
    const name = `${first} ${last}`.trim();
    const job = cleanApiString(leadObj.job_title);
    let leadDisplay = name;
    if (name && job) leadDisplay = `${name} · ${job}`;
    else if (!name && job) leadDisplay = job;
    else if (!name) leadDisplay = 'Unassigned';
    const leadUsername = cleanApiString(leadObj.username);
    const idRaw = leadObj.id != null ? String(leadObj.id).trim() : '';
    return {
        leadDisplay,
        leadId: idRaw,
        leadUsername,
    };
}

function parseFacilityRolesList(raw: unknown): TeamLinkedRole[] {
    const list = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === 'object'
            ? ((raw as { items?: unknown; data?: unknown; roles?: unknown }).items
                || (raw as { items?: unknown; data?: unknown; roles?: unknown }).data
                || (raw as { items?: unknown; data?: unknown; roles?: unknown }).roles)
            : []);
    if (!Array.isArray(list)) return [];

    return list
        .map((r: unknown, i: number) => {
            if (!r || typeof r !== 'object') return null;
            const o = r as Record<string, unknown>;
            const id = String(o.id ?? `r-${i}`);
            const name = String(o.name ?? 'Unnamed role');
            return id ? { id, name, ...extractRoleCoverer(o) } : null;
        })
        .filter((x): x is TeamLinkedRole => Boolean(x))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function parseTeamRolesPayload(data: unknown): TeamLinkedRole[] {
    const list = Array.isArray(data)
        ? data
        : (data && typeof data === 'object'
            ? ((data as Record<string, unknown>).items
                || (data as Record<string, unknown>).data
                || (data as Record<string, unknown>).roles)
            : []);
    if (!Array.isArray(list)) return [];

    return list
        .map((r: unknown, i: number) => {
            if (!r || typeof r !== 'object') return null;
            const o = r as Record<string, unknown>;
            const id = String(o.id ?? o.role_id ?? `tr-${i}`);
            const name = String(o.name ?? o.role_name ?? 'Role');
            return id ? { id, name, ...extractRoleCoverer(o) } : null;
        })
        .filter((x): x is TeamLinkedRole => Boolean(x));
}

function parseTeams(raw: unknown, departments: DepartmentEntry[]): Team[] {
    const list = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === 'object'
            ? ((raw as { items?: unknown; data?: unknown; teams?: unknown }).items
                || (raw as { items?: unknown; data?: unknown; teams?: unknown }).data
                || (raw as { items?: unknown; data?: unknown; teams?: unknown }).teams)
            : []);
    if (!Array.isArray(list)) return [];

    const deptNameById = new Map(departments.map(d => [d.id, d.name]));

    return list
        .map((t: unknown, idx): Team | null => {
            if (!t || typeof t !== 'object') return null;
            const rec = t as Record<string, unknown>;
            const depId = String(rec.department_id ?? '').trim();
            const leadObj = (rec.lead && typeof rec.lead === 'object' && !Array.isArray(rec.lead))
                ? rec.lead as Record<string, unknown>
                : {};
            const { leadDisplay, leadId: parsedLeadId, leadUsername } = formatLeadFromLeadObject(leadObj);

            // /teams/{id} returns members as { kind: 'user', user: {...} }; older shapes are flat
            // {first_name, last_name, ...}. Normalize to the inner user record either way.
            const membersRawSource = Array.isArray(rec.members)
                ? (rec.members as unknown[])
                : Array.isArray(rec.team_members)
                    ? (rec.team_members as unknown[])
                    : Array.isArray(rec.staff_members)
                        ? (rec.staff_members as unknown[])
                        : [];
            const membersRaw = membersRawSource
                .map((m): Record<string, unknown> | null => {
                    if (!m || typeof m !== 'object') return null;
                    const o = m as Record<string, unknown>;
                    if (o.user && typeof o.user === 'object' && !Array.isArray(o.user)) {
                        return o.user as Record<string, unknown>;
                    }
                    return o;
                })
                .filter((m): m is Record<string, unknown> => Boolean(m));

            const desc = cleanApiString(rec.description);
            const codeBlueTpl = cleanApiString(rec.code_blue_message_template);

            return {
                id: String(rec.id || `t-${idx}`),
                name: cleanApiString(rec.name) || 'Unnamed Team',
                departmentId: depId || undefined,
                department: cleanApiString(rec.department_name) || String(deptNameById.get(depId) || '') || 'Unassigned',
                description: desc,
                lead: leadDisplay,
                leadId: parsedLeadId || cleanApiString(rec.lead_id),
                leadUsername: leadUsername || undefined,
                memberCount: Number(rec.member_count ?? membersRaw.length ?? 0),
                createdAt: formatTeamCreatedAt(rec.created_at),
                isResuscitationTeam: Boolean(rec.is_resuscitation_team),
                codeBlueMessageTemplate: codeBlueTpl || undefined,
                linkedRoles: parseEmbeddedTeamRoles(rec),
                members: membersRaw.map((m, mIdx) => ({
                    id: String(m.id || `m-${mIdx}`),
                    firstName: String(m.first_name || ''),
                    lastName: String(m.last_name || ''),
                    jobTitle: String(m.job_title || m.title || '').trim(),
                    status: toStatusLabel(String(m.status || 'active')),
                })),
            };
        })
        .filter((t): t is Team => Boolean(t));
}

export default function ProviderTeamsPage() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [allStaff, setAllStaff] = useState<StaffEntry[]>([]);
    const [allRoles, setAllRoles] = useState<TeamLinkedRole[]>([]);
    const [departments, setDepartments] = useState<DepartmentEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [deptFilter, setDeptFilter] = useState('All');
    /** Selected-team panel: whether GET /teams/:id/members succeeded (detail vs list can disagree until this loads). */
    const [membersListLoadStatus, setMembersListLoadStatus] = useState<'idle' | 'ok' | 'error'>('idle');
    const [toast, setToast] = useState<{ message: string; variant: MacVibrancyToastVariant } | null>(null);

    // Create team
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDeptId, setNewDeptId] = useState('');
    const [newLeadId, setNewLeadId] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newMembers, setNewMembers] = useState<{ id: string; name: string; jobTitle: string }[]>([]);
    const [newTeamRoleIds, setNewTeamRoleIds] = useState<string[]>([]);
    const [newIsResuscitation, setNewIsResuscitation] = useState(false);

    // Add member / role
    const [showAddMember, setShowAddMember] = useState(false);
    const [showAddRole, setShowAddRole] = useState(false);
    const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null);
    const [staffSearch, setStaffSearch] = useState('');
    const [staffDeptFilter, setStaffDeptFilter] = useState('All');
    const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
    const [memberRole, setMemberRole] = useState(roleOptions[0]);

    // Edit team
    const [editingTeam, setEditingTeam] = useState(false);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editDept, setEditDept] = useState('');
    const [editIsResuscitation, setEditIsResuscitation] = useState(false);

    const showToast = (msg: string, variant: MacVibrancyToastVariant = 'success') => {
        setToast({ message: msg, variant });
        setTimeout(() => setToast(null), 2500);
    };

    const fetchData = useCallback(async () => {
        try {
            const [teamRes, deptRes, staffRes, rolesRes] = await Promise.all([
                fetch('/api/proxy/teams'),
                fetch('/api/proxy/departments'),
                fetch('/api/proxy/staff?page_size=100&page_id=1'),
                fetch('/api/proxy/roles'),
            ]);
            const deptData = deptRes.ok ? parseDepartments(await deptRes.json()) : [];
            setDepartments(deptData);
            if (staffRes.ok) {
                const staffData = parseStaff(await staffRes.json());
                setAllStaff(staffData);
            }
            if (rolesRes.ok) {
                setAllRoles(parseFacilityRolesList(await rolesRes.json()));
            }
            if (teamRes.ok) {
                const teamData = parseTeams(await teamRes.json(), deptData);
                setTeams(teamData);
            }
            if (deptData.length > 0 && !newDeptId) setNewDeptId(deptData[0].id);
        } catch {
            showToast('Failed to load provider teams', 'error');
        }
        setLoading(false);
    }, [newDeptId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const departmentFilters = useMemo(() => ['All', ...departments.map(d => d.name)], [departments]);
    const staffDepartments = useMemo(() => ['All', ...Array.from(new Set(allStaff.map(s => s.dept)))], [allStaff]);

    const selectedTeam = teams.find(t => t.id === selectedTeamId) || null;
    const existingResuscitationTeam = useMemo(
        () => teams.find(t => t.isResuscitationTeam) || null,
        [teams],
    );

    /** Member count in detail: after members GET succeeds, length is authoritative; if members GET fails, use count from GET /teams/:id when merged. */
    const selectedMemberDisplayCount = useMemo(() => {
        if (!selectedTeam) return 0;
        if (membersListLoadStatus === 'ok') {
            return selectedTeam.members.length > 0 ? selectedTeam.members.length : selectedTeam.memberCount;
        }
        if (membersListLoadStatus === 'error') {
            return selectedTeam.memberCount;
        }
        return selectedTeam.memberCount || selectedTeam.members.length;
    }, [selectedTeam, membersListLoadStatus]);

    const parseMembersPayload = useCallback((data: unknown): Member[] => {
        const membersList = Array.isArray(data) ? data : (data && typeof data === 'object'
            ? ((data as Record<string, unknown>).items
                || (data as Record<string, unknown>).data
                || (data as Record<string, unknown>).members
                || (data as Record<string, unknown>).team_members
                || (data as Record<string, unknown>).staff_members
                || (data as Record<string, unknown>).staff)
            : []);
        if (!Array.isArray(membersList)) return [];
        return membersList.reduce<Member[]>((acc, m: unknown, i: number) => {
            const rec = m && typeof m === 'object' ? (m as Record<string, unknown>) : {};
            const staffObj = rec.staff && typeof rec.staff === 'object' && !Array.isArray(rec.staff)
                ? rec.staff as Record<string, unknown>
                : {};
            const userObj = rec.user && typeof rec.user === 'object' && !Array.isArray(rec.user)
                ? rec.user as Record<string, unknown>
                : {};
            const source = Object.keys(staffObj).length > 0 ? staffObj : userObj;

            const firstName = String(
                rec.first_name
                || source.first_name
                || rec.firstName
                || source.firstName
                || ''
            ).trim();
            const lastName = String(
                rec.last_name
                || source.last_name
                || rec.lastName
                || source.lastName
                || ''
            ).trim();
            const fullName = String(
                rec.full_name
                || source.full_name
                || rec.name
                || source.name
                || ''
            ).trim();
            const jobTitle = String(
                rec.job_title
                || source.job_title
                || ''
            ).trim();
            const resolvedFirst = firstName || (fullName ? fullName.split(/\s+/)[0] : '');
            const resolvedLast = lastName || (fullName ? fullName.split(/\s+/).slice(1).join(' ') : '');
            if (!resolvedFirst && !resolvedLast) return acc;

            acc.push({
                id: String(rec.id || rec.member_id || rec.staff_id || source.id || source.staff_id || `m-${i}`),
                firstName: resolvedFirst,
                lastName: resolvedLast,
                jobTitle,
                status: toStatusLabel(String(rec.status || 'active')),
            });
            return acc;
        }, []);
    }, []);

    const syncMembersFromServer = useCallback(async (teamId: string) => {
        try {
            const res = await fetch(`/api/proxy/teams/${teamId}/members`);
            if (!res.ok) return;
            const data = await res.json();
            const parsed = parseMembersPayload(data);
            setTeams(prev => prev.map(t =>
                t.id === teamId ? { ...t, members: parsed, memberCount: parsed.length } : t
            ));
            if (teamId === selectedTeamId) setMembersListLoadStatus('ok');
        } catch { /* silent */ }
    }, [parseMembersPayload, selectedTeamId]);

    const syncTeamRolesFromServer = useCallback(async (teamId: string) => {
        try {
            const res = await fetch(`/api/proxy/teams/${teamId}/roles`);
            if (!res.ok) return;
            const data = await res.json();
            const parsed = parseTeamRolesPayload(data);
            setTeams(prev => prev.map(t => {
                if (t.id !== teamId) return t;
                // Defensive: if the server returns an empty list but we already have local roles
                // (just added optimistically, or previously synced), don't wipe them out.
                // Some backend deployments return [] from GET /teams/{id}/roles even when roles
                // are linked — keeping local state avoids the role "disappearing" after a save.
                if (parsed.length === 0 && t.linkedRoles.length > 0) return t;
                return { ...t, linkedRoles: parsed };
            }));
        } catch { /* silent */ }
    }, []);

    // Refresh single team + members + roles when a team is selected (GET /teams/:id is source of truth for lead, name, counts vs list row)
    useEffect(() => {
        if (!selectedTeamId) {
            setMembersListLoadStatus('idle');
            return;
        }
        let cancelled = false;
        setMembersListLoadStatus('idle');
        (async () => {
            try {
                const [teamRes, memRes, roleRes] = await Promise.all([
                    fetch(`/api/proxy/teams/${selectedTeamId}`),
                    fetch(`/api/proxy/teams/${selectedTeamId}/members`),
                    fetch(`/api/proxy/teams/${selectedTeamId}/roles`),
                ]);
                if (cancelled) return;

                const teamData = teamRes.ok ? await teamRes.json() : null;
                const membersData = memRes.ok ? await memRes.json() : null;
                const rolesData = roleRes.ok ? await roleRes.json() : null;
                if (cancelled) return;

                const parsedTeam = teamData ? parseTeams([teamData], departments)[0] : null;
                const parsedMembers = membersData != null ? parseMembersPayload(membersData) : undefined;
                const parsedRoles = rolesData != null ? parseTeamRolesPayload(rolesData) : undefined;

                // Prefer dedicated endpoints; fall back to data embedded in GET /teams/{id} when those
                // endpoints fail or return empty. This works around a backend bug where /teams/{id}/members
                // returns 500 ("can't scan NULL into *bool" on is_lead) — the single-team response often
                // still includes embedded members/roles we can use.
                const embeddedMembers = parsedTeam?.members ?? [];
                const embeddedRoles = parsedTeam?.linkedRoles ?? [];
                const finalMembers: Member[] | null =
                    memRes.ok && parsedMembers !== undefined && parsedMembers.length > 0
                        ? parsedMembers
                        : embeddedMembers.length > 0
                            ? embeddedMembers
                            : memRes.ok && parsedMembers !== undefined
                                ? parsedMembers
                                : null;
                const finalRoles: TeamLinkedRole[] | null =
                    roleRes.ok && parsedRoles !== undefined && parsedRoles.length > 0
                        ? parsedRoles
                        : embeddedRoles.length > 0
                            ? embeddedRoles
                            : roleRes.ok && parsedRoles !== undefined
                                ? parsedRoles
                                : null;

                // Treat as "ok" when we have members from any source — even if dedicated endpoint failed,
                // the embedded list is good enough to render and avoid the warning UI.
                if (!cancelled) {
                    const haveMembers = (finalMembers && finalMembers.length > 0) || memRes.ok;
                    setMembersListLoadStatus(haveMembers ? 'ok' : 'error');
                }

                setTeams(prev => prev.map(t => {
                    if (t.id !== selectedTeamId) return t;
                    let next: Team = { ...t };
                    if (parsedTeam) {
                        next = {
                            ...parsedTeam,
                            members: t.members,
                            linkedRoles: t.linkedRoles,
                        };
                    }
                    if (finalMembers !== null) {
                        next.members = finalMembers;
                        next.memberCount = finalMembers.length || next.memberCount;
                    }
                    // Defensive: if the server returns no roles but we already have local roles
                    // (e.g. user just linked one optimistically), keep the local list rather than
                    // wiping it. Some backend deployments return [] for GET /teams/{id}/roles even
                    // when roles are linked.
                    if (finalRoles !== null && !(finalRoles.length === 0 && t.linkedRoles.length > 0)) {
                        next.linkedRoles = finalRoles;
                    }
                    return next;
                }));
            } catch {
                if (!cancelled) setMembersListLoadStatus('error');
            }
        })();
        return () => { cancelled = true; };
    }, [selectedTeamId, parseMembersPayload, departments]);

    const filtered = teams.filter(t => {
        if (deptFilter !== 'All' && t.department !== deptFilter) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            return t.name.toLowerCase().includes(q) ||
                t.department.toLowerCase().includes(q) ||
                t.lead.toLowerCase().includes(q) ||
                (t.leadUsername && t.leadUsername.toLowerCase().includes(q)) ||
                t.members.some(m => `${m.firstName} ${m.lastName}`.toLowerCase().includes(q)) ||
                t.linkedRoles.some(r => r.name.toLowerCase().includes(q));
        }
        return true;
    });

    const handleCreateTeam = async () => {
        if (!newName.trim()) {
            showToast('Enter a team name first.', 'error');
            return;
        }
        if (newIsResuscitation && existingResuscitationTeam) {
            showToast(`Only one resuscitation team is allowed per facility. Current: "${existingResuscitationTeam.name}".`, 'error');
            return;
        }
        const existing = teams.find(t =>
            t.name.trim().toLowerCase() === newName.trim().toLowerCase() &&
            (newDeptId ? t.departmentId === newDeptId : true)
        );
        if (existing) {
            showToast(`Team "${newName.trim()}" already exists in this department`, 'error');
            return;
        }
        try {
            const res = await fetch('/api/proxy/teams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName.trim(),
                    description: newDesc.trim(),
                    department_id: newDeptId || undefined,
                    lead_id: newLeadId || undefined,
                    is_resuscitation_team: newIsResuscitation,
                }),
            });
            if (!res.ok) {
                let errorMsg = 'Failed to create team';
                try {
                    const err = await res.json();
                    const details = err?.detail || err?.details || err?.error || err?.message;
                    if (res.status === 409) {
                        errorMsg = typeof details === 'string' && details.trim()
                            ? `Team already exists: ${details}`
                            : 'Team already exists';
                    } else if (typeof details === 'string' && details.trim()) {
                        errorMsg = details;
                    }
                } catch {}
                showToast(errorMsg, 'error');
                return;
            }

            const created = await res.json();
            const teamId = String(created.id || created.team_id || '');

            // POST all selected members to /teams/{id}/members
            if (newMembers.length > 0) {
                try {
                    const mRes = await fetch(`/api/proxy/teams/${teamId}/members`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ staff_ids: newMembers.map(m => m.id) }),
                    });
                    if (!mRes.ok) {
                        const errBody = await mRes.json().catch(() => ({}));
                        console.error('Failed to add members:', mRes.status, JSON.stringify(errBody));
                    }
                } catch (e) { console.error('Error adding members:', e); }
            }

            if (newTeamRoleIds.length > 0 && teamId) {
                try {
                    const rRes = await fetch(`/api/proxy/teams/${teamId}/roles`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ role_ids: newTeamRoleIds }),
                    });
                    if (!rRes.ok) {
                        const errBody = await rRes.json().catch(() => ({}));
                        console.error('Failed to link roles:', rRes.status, JSON.stringify(errBody));
                        showToast('Team created, but linking roles failed. Try adding roles from the team panel, or try again in a moment.', 'error');
                    }
                } catch (e) { console.error('Error linking roles:', e); }
            }

            // Re-fetch team + members + roles (GET /teams/{id} may not embed members or roles)
            let finalTeam: Team | null = null;
            try {
                const [refetchRes, membersRes, rolesRes] = await Promise.all([
                    fetch(`/api/proxy/teams/${teamId}`),
                    fetch(`/api/proxy/teams/${teamId}/members`),
                    fetch(`/api/proxy/teams/${teamId}/roles`),
                ]);
                if (refetchRes.ok) {
                    const refetched = await refetchRes.json();
                    finalTeam = parseTeams([refetched], departments)[0] || null;
                }
                if (finalTeam && membersRes.ok) {
                    const membersData = await membersRes.json();
                    const membersList = Array.isArray(membersData) ? membersData : (membersData?.items || membersData?.data || membersData?.members || []);
                    if (Array.isArray(membersList) && membersList.length > 0) {
                        finalTeam = {
                            ...finalTeam,
                            members: membersList.map((m: Record<string, unknown>, i: number) => ({
                                id: String(m.id || m.staff_id || `m-${i}`),
                                firstName: String(m.first_name || ''),
                                lastName: String(m.last_name || ''),
                                jobTitle: String(m.job_title || m.title || '').trim(),
                                status: toStatusLabel(String(m.status || 'active')),
                            })),
                            memberCount: membersList.length,
                        };
                    }
                }
                if (finalTeam && rolesRes.ok) {
                    const rolesData = await rolesRes.json();
                    finalTeam = {
                        ...finalTeam,
                        linkedRoles: parseTeamRolesPayload(rolesData),
                    };
                }
            } catch { /* fall back to local data */ }

            // Fallback: build from local data if re-fetch failed
            if (!finalTeam) {
                const parsed = parseTeams([created], departments)[0];
                if (parsed) {
                    const leadStaff = allStaff.find(s => s.id === newLeadId);
                    finalTeam = {
                        ...parsed,
                        isResuscitationTeam: newIsResuscitation,
                        linkedRoles: newTeamRoleIds.map(id => {
                            const r = allRoles.find(x => x.id === id);
                            return r ?? { id, name: 'Role' };
                        }),
                        lead: leadStaff ? `${leadStaff.first_name} ${leadStaff.last_name}` : parsed.lead,
                        members: newMembers.map(m => ({
                            id: m.id,
                            firstName: m.name.split(' ')[0] || '',
                            lastName: m.name.split(' ').slice(1).join(' ') || '',
                            jobTitle: m.jobTitle,
                            status: 'Active' as const,
                        })),
                        memberCount: newMembers.length,
                    };
                }
            }

            if (finalTeam) {
                setTeams(prev => [...prev, finalTeam!]);
                setSelectedTeamId(finalTeam.id);
            }
            setShowCreate(false);
            setNewName('');
            setNewDesc('');
            setNewLeadId('');
            setNewMembers([]);
            setNewTeamRoleIds([]);
            setNewIsResuscitation(false);
            showToast(`Team "${finalTeam?.name || newName.trim()}" created${newMembers.length > 0 ? ` with ${newMembers.length} member${newMembers.length > 1 ? 's' : ''}` : ''}`);
        } catch {
            showToast('Failed to create team', 'error');
        }
    };

    const handleDeleteTeam = async (id: string) => {
        const team = teams.find(t => t.id === id);
        try {
            const res = await fetch(`/api/proxy/teams/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                showToast('Failed to delete team', 'error');
                return;
            }
            setTeams(prev => prev.filter(t => t.id !== id));
            if (selectedTeamId === id) setSelectedTeamId(null);
            showToast(`Team "${team?.name}" deleted`);
        } catch {
            showToast('Failed to delete team', 'error');
        }
    };

    const existingMemberIds = selectedTeam ? selectedTeam.members.map(m => m.id) : [];
    const filteredStaff = allStaff.filter(s => {
        if (existingMemberIds.includes(s.id.toString())) return false;
        if (staffDeptFilter !== 'All' && s.dept !== staffDeptFilter) return false;
        if (staffSearch.trim()) {
            const q = staffSearch.toLowerCase();
            return `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
                s.job_title.toLowerCase().includes(q) ||
                s.employee_id.toLowerCase().includes(q);
        }
        return true;
    });

    const selectedStaff = allStaff.find(s => s.id === selectedStaffId) || null;

    const handleAddMember = async () => {
        if (!selectedStaff || !selectedTeam) return;
        const teamId = selectedTeam.id;
        const optimisticMember: Member = {
            id: selectedStaff.id,
            firstName: selectedStaff.first_name,
            lastName: selectedStaff.last_name,
            jobTitle: selectedStaff.job_title,
            status: 'Active',
        };
        setTeams(prev => prev.map(t =>
            t.id === teamId
                ? { ...t, members: [...t.members, optimisticMember], memberCount: t.members.length + 1 }
                : t
        ));
        try {
            const res = await fetch(`/api/proxy/teams/${teamId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staff_ids: [selectedStaff.id] }),
            });
            if (!res.ok) {
                await syncMembersFromServer(teamId);
                let msg = 'Failed to add member';
                try {
                    const err = await res.json() as { message?: string; detail?: string; error?: string };
                    msg = String(err.detail || err.message || err.error || msg);
                } catch { /* ignore */ }
                showToast(msg, 'error');
                return;
            }
            await syncMembersFromServer(teamId);
            setShowAddMember(false);
            setStaffSearch('');
            setStaffDeptFilter('All');
            setSelectedStaffId(null);
            setMemberRole(roleOptions[0]);
            showToast(`${selectedStaff.first_name} ${selectedStaff.last_name} added`);
        } catch {
            await syncMembersFromServer(teamId);
            showToast('Failed to add member', 'error');
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!selectedTeam) return;
        const member = selectedTeam.members.find(m => m.id === memberId);
        const memberLabel = `${member?.firstName || ''} ${member?.lastName || ''}`.trim() || 'this member';
        setPendingRemoval({ type: 'member', id: memberId, label: memberLabel });
    };

    const performRemoveMember = async (memberId: string) => {
        if (!selectedTeam) return;
        const teamId = selectedTeam.id;
        const member = selectedTeam.members.find(m => m.id === memberId);
        setTeams(prev => prev.map(t => {
            if (t.id !== teamId) return t;
            const nextMembers = t.members.filter(m => m.id !== memberId);
            return { ...t, members: nextMembers, memberCount: nextMembers.length };
        }));
        try {
            const res = await fetch(
                `/api/proxy/teams/${teamId}/members/${encodeURIComponent(memberId)}`,
                { method: 'DELETE' },
            );
            if (!res.ok) {
                await syncMembersFromServer(teamId);
                showToast('Failed to remove member', 'error');
                return;
            }
            await syncMembersFromServer(teamId);
            showToast(`${member?.firstName || ''} ${member?.lastName || ''} removed`.trim() || 'Member removed');
        } catch {
            await syncMembersFromServer(teamId);
            showToast('Failed to remove member', 'error');
        }
    };

    const handleSaveEdit = async () => {
        if (!selectedTeam || !editName.trim()) return;
        if (editIsResuscitation) {
            const otherResuscitation = teams.find(
                t => t.id !== selectedTeam.id && t.isResuscitationTeam,
            );
            if (otherResuscitation) {
                showToast(`Only one resuscitation team is allowed per facility. Current: "${otherResuscitation.name}".`, 'error');
                return;
            }
        }
        try {
            const dep = departments.find(d => d.name === editDept);
            const res = await fetch(`/api/proxy/teams/${selectedTeam.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editName.trim(),
                    description: editDesc.trim(),
                    department_id: dep?.id || selectedTeam.departmentId,
                    lead_id: selectedTeam.leadId || undefined,
                    is_resuscitation_team: editIsResuscitation,
                }),
            });
            if (!res.ok) {
                showToast('Failed to update team', 'error');
                return;
            }
            const updated = await res.json();
            const parsed = parseTeams([updated], departments)[0];
            setTeams(prev => prev.map(t => (t.id === selectedTeam.id ? (parsed || t) : t)));
            setEditingTeam(false);
            showToast('Team updated');
        } catch {
            showToast('Failed to update team', 'error');
        }
    };

    const openEdit = () => {
        if (!selectedTeam) return;
        setEditName(selectedTeam.name);
        setEditDesc(selectedTeam.description);
        setEditDept(selectedTeam.department);
        setEditIsResuscitation(selectedTeam.isResuscitationTeam);
        setEditingTeam(true);
    };

    const handleAddTeamRole = async (roleId: string) => {
        if (!selectedTeam || !roleId) return;
        const teamId = selectedTeam.id;
        if (selectedTeam.linkedRoles.some(r => r.id === roleId)) {
            showToast('This role is already linked to the team', 'info');
            return;
        }
        const roleMeta = allRoles.find(r => r.id === roleId) ?? { id: roleId, name: 'Role' };
        setTeams(prev => prev.map(t =>
            t.id === teamId ? { ...t, linkedRoles: [...t.linkedRoles, roleMeta] } : t
        ));
        try {
            const res = await fetch(`/api/proxy/teams/${teamId}/roles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role_ids: [roleId] }),
            });
            if (!res.ok) {
                // Roll back the optimistic add only on actual failure.
                await syncTeamRolesFromServer(teamId);
                let msg = 'Failed to add role';
                try {
                    const err = await res.json() as { detail?: string; message?: string; error?: string };
                    const d = err.detail;
                    msg = typeof d === 'string' ? d : String(err.message || err.error || msg);
                } catch { /* ignore */ }
                showToast(msg, 'error');
                return;
            }
            // POST succeeded — keep the optimistic state. Do NOT re-sync from GET /teams/{id}/roles
            // because if that endpoint is unhealthy or returns a stale/empty list it will wipe out
            // the role the user just added. The role is already persisted on the server.
            setShowAddRole(false);
            showToast('Role linked to team');
        } catch {
            await syncTeamRolesFromServer(teamId);
            showToast('Failed to add role', 'error');
        }
    };

    const handleRemoveTeamRole = async (roleId: string) => {
        if (!selectedTeam) return;
        const role = selectedTeam.linkedRoles.find(r => r.id === roleId);
        const roleLabel = role?.name || 'this role';
        setPendingRemoval({ type: 'role', id: roleId, label: roleLabel });
    };

    const performRemoveTeamRole = async (roleId: string) => {
        if (!selectedTeam) return;
        const teamId = selectedTeam.id;
        setTeams(prev => prev.map(t =>
            t.id === teamId ? { ...t, linkedRoles: t.linkedRoles.filter(r => r.id !== roleId) } : t
        ));
        try {
            const res = await fetch(
                `/api/proxy/teams/${teamId}/roles/${encodeURIComponent(roleId)}`,
                { method: 'DELETE' },
            );
            if (!res.ok) {
                await syncTeamRolesFromServer(teamId);
                showToast('Failed to remove role from team', 'error');
                return;
            }
            await syncTeamRolesFromServer(teamId);
            showToast('Role removed from team');
        } catch {
            await syncTeamRolesFromServer(teamId);
            showToast('Failed to remove role from team', 'error');
        }
    };

    const detailOpen = selectedTeam || showCreate;

    return (
        <>
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast.message} variant={toast.variant} dismissible={false} />
                </MacVibrancyToastPortal>
            )}
            {pendingRemoval && selectedTeam && (
                <div
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setPendingRemoval(null)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(8, 12, 20, 0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1200,
                        padding: 16,
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: 440,
                            background: 'var(--surface-card)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
                            padding: '18px 18px 14px',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 10,
                                    background: 'rgba(198, 40, 40, 0.12)',
                                    color: '#c62828',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                <span className="material-icons-round" style={{ fontSize: 18 }}>warning</span>
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Confirm remove action
                                </div>
                                <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    Are you sure you want to remove{' '}
                                    <strong>{pendingRemoval.label}</strong>{' '}
                                    from <strong>{selectedTeam.name}</strong>?
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setPendingRemoval(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => {
                                    const pending = pendingRemoval;
                                    setPendingRemoval(null);
                                    if (pending.type === 'member') {
                                        void performRemoveMember(pending.id);
                                    } else {
                                        void performRemoveTeamRole(pending.id);
                                    }
                                }}
                            >
                                Confirm Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="app-main">
                <TopBar title="Provider Teams" subtitle="Manage clinical teams and their members" />

                <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>
                    {/* Filters */}
                    <div className="fade-in" style={{ display: 'flex', gap: 12, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 300 }}>
                            <span className="material-icons-round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--text-disabled)', pointerEvents: 'none' }}>search</span>
                            <input
                                className="input"
                                placeholder="Search teams or members..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ paddingLeft: 34, fontSize: 12.5, height: 36, width: '100%' }}
                            />
                        </div>

                        <CustomSelect
                            value={deptFilter}
                            onChange={v => setDeptFilter(v)}
                            options={departmentFilters.map(d => ({ label: d === 'All' ? 'All Departments' : d, value: d }))}
                            placeholder="All Departments"
                            style={{ width: 190 }}
                        />

                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} team{filtered.length !== 1 ? 's' : ''}</span>
                            <button className="btn btn-primary btn-sm" onClick={() => {
                                setShowCreate(!showCreate);
                                setSelectedTeamId(null);
                                setEditingTeam(false);
                                setShowAddMember(false);
                                setShowAddRole(false);
                            }}>
                                <span className="material-icons-round" style={{ fontSize: 14 }}>{showCreate ? 'close' : 'add'}</span>
                                {showCreate ? 'Cancel' : 'New Team'}
                            </button>
                        </div>
                    </div>

                    {/* Table + Detail Panel */}
                    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: detailOpen ? '1fr 380px' : '1fr', gap: 20, alignItems: 'start' }}>
                        {/* Teams Table */}
                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            <div className="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ width: '30%' }}>Team Name</th>
                                            <th>Department</th>
                                            <th>Lead</th>
                                            <th style={{ textAlign: 'center' }}>Members</th>
                                            <th>Created</th>
                                            <th style={{ width: 60, textAlign: 'center' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Loading teams...</td></tr>
                                        ) : filtered.length === 0 ? (
                                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>No teams found</td></tr>
                                        ) : filtered.map(team => {
                                            const isSelected = selectedTeamId === team.id;
                                            const totalMembers = team.memberCount || team.members.length;
                                            return (
                                                <tr
                                                    key={team.id}
                                                    onClick={() => { setSelectedTeamId(isSelected ? null : team.id); setShowCreate(false); setEditingTeam(false); setShowAddMember(false); setShowAddRole(false); }}
                                                    style={{
                                                        cursor: 'pointer', transition: 'background 0.12s',
                                                        background: isSelected ? 'rgba(59,130,246,0.04)' : undefined,
                                                    }}
                                                >
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <div style={{
                                                                width: 30, height: 30, borderRadius: 'var(--radius-sm)',
                                                                background: isSelected ? 'var(--helix-primary)' : 'var(--surface-2)',
                                                                color: isSelected ? '#fff' : 'var(--text-secondary)',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: 12, flexShrink: 0,
                                                            }}>
                                                                <span className="material-icons-round" style={{ fontSize: 16 }}>groups</span>
                                                            </div>
                                                            <div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{team.name}</span>
                                                                    {team.isResuscitationTeam && (
                                                                        <span title="Resuscitation (Code Blue) team" style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 6px', borderRadius: 4, background: 'rgba(37,99,235,0.12)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.28)' }}>Code blue</span>
                                                                    )}
                                                                </div>
                                                                {team.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{team.description}</div>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td><span className="badge badge-neutral" style={{ fontSize: 10 }}>{team.department}</span></td>
                                                    <td style={{ fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 200, whiteSpace: 'normal', lineHeight: 1.35 }}>{team.lead}</td>
                                                    <td style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 600 }}>{totalMembers}</td>
                                                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{team.createdAt || '—'}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <button
                                                            className="btn btn-danger btn-xs"
                                                            onClick={e => { e.stopPropagation(); handleDeleteTeam(team.id); }}
                                                            title="Delete team"
                                                            style={{ padding: '3px 6px' }}
                                                        >
                                                            <span className="material-icons-round" style={{ fontSize: 13 }}>delete</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Detail / Create Panel */}
                        {showCreate && (
                            <div className="fade-in card" style={{ position: 'sticky', top: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>Create Team</h3>
                                    <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                                        <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div>
                                        <label className="label">Team Name</label>
                                        <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Cardiology Team B" style={{ fontSize: 13 }} />
                                    </div>
                                    <div>
                                        <label className="label">Department</label>
                                        <CustomSelect
                                            value={newDeptId}
                                            onChange={v => setNewDeptId(v)}
                                            options={departments.map(d => ({ label: d.name, value: d.id }))}
                                            placeholder="-- Select Department --"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Lead</label>
                                        <CustomSelect
                                            value={newLeadId}
                                            onChange={v => setNewLeadId(v)}
                                            options={[{ label: 'Unassigned', value: '' }, ...allStaff.map(s => ({ label: `${s.first_name} ${s.last_name} (${s.job_title})`, value: s.id }))]}
                                            placeholder="Unassigned"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Description</label>
                                        <textarea className="input" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Brief description of the team" style={{ fontSize: 13, minHeight: 60, resize: 'vertical' }} />
                                    </div>

                                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                        <input
                                            type="checkbox"
                                            checked={newIsResuscitation}
                                            onChange={e => setNewIsResuscitation(e.target.checked)}
                                            style={{ marginTop: 2 }}
                                        />
                                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Resuscitation team (Code Blue).</span>
                                    </label>
                                    {existingResuscitationTeam && !newIsResuscitation ? (
                                        <div style={{ fontSize: 11.5, color: 'var(--warning, #ca8a04)', marginTop: -6 }}>
                                            A resuscitation team already exists for this facility: {existingResuscitationTeam.name}.
                                        </div>
                                    ) : null}

                                    {/* Roles linked to this team */}
                                    <div>
                                        <label className="label">Roles{newTeamRoleIds.length > 0 && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> ({newTeamRoleIds.length})</span>}</label>
                                        <CustomSelect
                                            value=""
                                            onChange={v => {
                                                if (!v) return;
                                                if (!newName.trim()) {
                                                    showToast('Enter a team name first.', 'error');
                                                    return;
                                                }
                                                if (!newTeamRoleIds.includes(v)) setNewTeamRoleIds(prev => [...prev, v]);
                                            }}
                                            options={allRoles
                                                .filter(r => !newTeamRoleIds.includes(r.id))
                                                .map(r => ({ label: r.name, value: r.id }))}
                                            placeholder={allRoles.length ? 'Add facility role…' : 'No roles loaded'}
                                        />
                                        {newTeamRoleIds.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                                {newTeamRoleIds.map(id => {
                                                    const r = allRoles.find(x => x.id === id);
                                                    return (
                                                        <span key={id} style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 6px 3px 8px',
                                                            borderRadius: 14, fontSize: 11, fontWeight: 600,
                                                            background: 'rgba(34,197,94,0.08)', color: 'var(--success, #16a34a)',
                                                            border: '1px solid rgba(34,197,94,0.2)',
                                                        }}>
                                                            {r?.name || id}
                                                            <button type="button" onClick={() => setNewTeamRoleIds(prev => prev.filter(x => x !== id))}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'inline-flex', marginLeft: 2 }}>
                                                                <span className="material-icons-round" style={{ fontSize: 13 }}>close</span>
                                                            </button>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Members picker */}
                                    <div>
                                        <label className="label">Members{newMembers.length > 0 && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> ({newMembers.length})</span>}</label>
                                        <CustomSelect
                                            value=""
                                            onChange={v => {
                                                if (!v) return;
                                                if (!newName.trim()) {
                                                    showToast('Enter a team name first.', 'error');
                                                    return;
                                                }
                                                const s = allStaff.find(x => x.id === v);
                                                if (s && !newMembers.some(m => m.id === v)) {
                                                    setNewMembers(prev => [...prev, { id: s.id, name: `${s.first_name} ${s.last_name}`, jobTitle: s.job_title }]);
                                                }
                                            }}
                                            options={allStaff
                                                .filter(s => !newMembers.some(m => m.id === s.id))
                                                .map(s => ({ label: `${s.first_name} ${s.last_name} — ${s.job_title}`, value: s.id }))}
                                            placeholder="Select staff to add..."
                                        />
                                        {newMembers.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                                {newMembers.map(m => (
                                                    <span key={m.id} style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 6px 3px 8px',
                                                        borderRadius: 14, fontSize: 11, fontWeight: 600,
                                                        background: 'rgba(99,102,241,0.08)', color: 'var(--helix-primary)',
                                                        border: '1px solid rgba(99,102,241,0.18)',
                                                    }}>
                                                        {m.name}
                                                        <button type="button" onClick={() => setNewMembers(prev => prev.filter(x => x.id !== m.id))}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--helix-primary)', padding: 0, display: 'inline-flex', marginLeft: 2 }}>
                                                            <span className="material-icons-round" style={{ fontSize: 13 }}>close</span>
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={() => void handleCreateTeam()}>
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>add</span>
                                    Create Team{newMembers.length > 0 ? ` with ${newMembers.length} member${newMembers.length > 1 ? 's' : ''}` : ''}
                                </button>
                            </div>
                        )}

                        {selectedTeam && !showCreate && (
                            <div className="fade-in card" style={{ position: 'sticky', top: 24 }}>
                                {editingTeam ? (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Edit Team</h3>
                                            <button onClick={() => setEditingTeam(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                                                <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            <div>
                                                <label className="label">Team Name</label>
                                                <input className="input" value={editName} onChange={e => setEditName(e.target.value)} style={{ fontSize: 13 }} />
                                            </div>
                                            <div>
                                                <label className="label">Department</label>
                                                <CustomSelect
                                                    value={editDept}
                                                    onChange={v => setEditDept(v)}
                                                    options={departments.map(d => ({ label: d.name, value: d.name }))}
                                                    placeholder="-- Select Department --"
                                                />
                                            </div>
                                            <div>
                                                <label className="label">Description</label>
                                                <textarea className="input" value={editDesc} onChange={e => setEditDesc(e.target.value)} style={{ fontSize: 13, minHeight: 60, resize: 'vertical' }} />
                                            </div>
                                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={editIsResuscitation}
                                                    onChange={e => setEditIsResuscitation(e.target.checked)}
                                                    style={{ marginTop: 2 }}
                                                />
                                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Resuscitation team (Code Blue).</span>
                                            </label>
                                            {editIsResuscitation && teams.some(t => t.id !== selectedTeam.id && t.isResuscitationTeam) ? (
                                                <div style={{ fontSize: 11.5, color: 'var(--warning, #ca8a04)', marginTop: -6 }}>
                                                    Another team is already marked as resuscitation in this facility.
                                                </div>
                                            ) : null}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                                            <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSaveEdit} disabled={!editName.trim()}>Save Changes</button>
                                            <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setEditingTeam(false)}>Cancel</button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* Header */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 3 }}>{selectedTeam.name}</h3>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'rgba(99,102,241,0.08)', color: 'var(--helix-primary)', letterSpacing: '0.02em' }}>{selectedTeam.department}</span>
                                                    {selectedTeam.isResuscitationTeam && (
                                                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 8px', borderRadius: 10, background: 'rgba(37,99,235,0.1)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.25)' }}>Code blue</span>
                                                    )}
                                                    {selectedTeam.createdAt ? <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>{selectedTeam.createdAt}</span> : null}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 2 }}>
                                                <button onClick={openEdit} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', transition: 'all 0.12s' }}
                                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--helix-primary)'; e.currentTarget.style.color = 'var(--helix-primary)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                                                    <span className="material-icons-round" style={{ fontSize: 14 }}>edit</span>
                                                </button>
                                                <button onClick={() => setSelectedTeamId(null)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-disabled)', transition: 'color 0.12s' }}
                                                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-disabled)'; }}>
                                                    <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
                                                </button>
                                            </div>
                                        </div>

                                        {selectedTeam.description ? (
                                            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>{selectedTeam.description}</p>
                                        ) : null}

                                        {/* Info row */}
                                        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                                            <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Lead</div>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                                                    <span className="material-icons-round" style={{ fontSize: 13, color: '#eab308', flexShrink: 0, marginTop: 2 }}>star</span>
                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', lineHeight: 1.35 }}>{selectedTeam.lead}</span>
                                                        {selectedTeam.leadUsername ? (
                                                            <span style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'block', marginTop: 3 }}>@{selectedTeam.leadUsername}</span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ flexShrink: 0, width: 64, padding: '10px 8px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--helix-primary)', lineHeight: 1 }}>{selectedMemberDisplayCount}</div>
                                                <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3 }}>Members</div>
                                            </div>
                                        </div>

                                        {/* Linked roles */}
                                        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, marginBottom: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Linked roles</span>
                                                <button type="button" onClick={() => setShowAddRole(!showAddRole)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: showAddRole ? 'var(--surface-2)' : 'rgba(34,197,94,0.12)', color: showAddRole ? 'var(--text-secondary)' : 'var(--success, #15803d)', transition: 'all 0.15s' }}>
                                                    <span className="material-icons-round" style={{ fontSize: 13 }}>{showAddRole ? 'close' : 'badge'}</span>
                                                    {showAddRole ? 'Cancel' : 'Add role'}
                                                </button>
                                            </div>
                                            {showAddRole && (
                                                <div style={{ marginTop: 10, padding: 10, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                                                    <CustomSelect
                                                        value=""
                                                        onChange={v => { if (v) void handleAddTeamRole(v); }}
                                                        options={allRoles
                                                            .filter(r => !selectedTeam.linkedRoles.some(l => l.id === r.id))
                                                            .map(r => ({
                                                                label: r.coveredByName
                                                                    ? `${r.name} — covered by ${r.coveredByName}`
                                                                    : `${r.name} — uncovered`,
                                                                value: r.id,
                                                            }))}
                                                        placeholder={allRoles.length ? 'Choose a facility role…' : 'No roles loaded'}
                                                    />
                                                    <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                                        Each option shows who is currently signed in to (covering) the role.
                                                    </div>
                                                </div>
                                            )}
                                            {selectedTeam.linkedRoles.length === 0 && !showAddRole ? (
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>No roles linked. Roles grant access by assignment; add staff separately below.</div>
                                            ) : selectedTeam.linkedRoles.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                                                    {selectedTeam.linkedRoles.map(r => {
                                                        // Prefer freshest coverage from allRoles (kept in sync with /roles GET).
                                                        const live = allRoles.find(x => x.id === r.id);
                                                        const coveredByName = live?.coveredByName ?? r.coveredByName;
                                                        return (
                                                            <div key={r.id} style={{
                                                                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px 6px 10px',
                                                                borderRadius: 8,
                                                                background: 'var(--surface-2)',
                                                                border: '1px solid var(--border-subtle)',
                                                            }}>
                                                                <span className="material-icons-round" style={{ fontSize: 14, color: coveredByName ? 'var(--success, #16a34a)' : 'var(--text-disabled)', flexShrink: 0 }}>
                                                                    {coveredByName ? 'badge' : 'badge_outline'}
                                                                </span>
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                                                                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                        {coveredByName ? (
                                                                            <>Covered by <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{coveredByName}</span></>
                                                                        ) : (
                                                                            <span style={{ fontStyle: 'italic' }}>No one signed in</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <button type="button" title="Remove role from team" onClick={() => void handleRemoveTeamRole(r.id)}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-disabled)', padding: 2, display: 'inline-flex', flexShrink: 0 }}>
                                                                    <span className="material-icons-round" style={{ fontSize: 14 }}>close</span>
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : null}
                                        </div>

                                        {/* Divider + Members header */}
                                        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, marginBottom: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Team Members</span>
                                                <button onClick={() => setShowAddMember(!showAddMember)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: showAddMember ? 'var(--surface-2)' : 'var(--helix-primary)', color: showAddMember ? 'var(--text-secondary)' : '#fff', transition: 'all 0.15s' }}>
                                                    <span className="material-icons-round" style={{ fontSize: 13 }}>{showAddMember ? 'close' : 'person_add'}</span>
                                                    {showAddMember ? 'Cancel' : 'Add'}
                                                </button>
                                            </div>
                                        </div>

                                        {showAddMember && (
                                            <div style={{
                                                display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, padding: 10,
                                                background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border-subtle)',
                                            }}>
                                                <CustomSelect
                                                    value=""
                                                    onChange={v => {
                                                        if (!v) return;
                                                        const s = allStaff.find(x => x.id === v);
                                                        if (s) { setSelectedStaffId(s.id); setMemberRole(s.job_title); }
                                                    }}
                                                    options={allStaff
                                                        .filter(s => !selectedTeam.members.some(m => m.id === s.id))
                                                        .map(s => ({ label: `${s.first_name} ${s.last_name} — ${s.job_title}`, value: s.id }))}
                                                    placeholder="Select staff member..."
                                                />

                                                {selectedStaff && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, background: 'var(--surface-card)', border: '1px solid var(--helix-primary)' }}>
                                                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--helix-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                                                            {selectedStaff.first_name[0]}{selectedStaff.last_name[0]}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: 12, fontWeight: 600 }}>{selectedStaff.first_name} {selectedStaff.last_name}</div>
                                                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{selectedStaff.job_title}</div>
                                                        </div>
                                                        <button className="btn btn-primary btn-xs" onClick={handleAddMember} style={{ padding: '4px 10px' }}>
                                                            <span className="material-icons-round" style={{ fontSize: 12 }}>add</span>Add
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {membersListLoadStatus === 'error' ? (
                                            <div style={{ padding: '24px 0', textAlign: 'center' }}>
                                                <span className="material-icons-round" style={{ fontSize: 28, color: 'var(--warning, #ca8a04)', marginBottom: 6, display: 'block' }}>warning</span>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 280, margin: '0 auto', lineHeight: 1.5 }}>
                                                    Could not load team members — the server returned an error. Lead, member count, and other fields above are refreshed from the single-team request when that succeeds.
                                                </div>
                                            </div>
                                        ) : selectedTeam.members.length === 0 ? (
                                            <div style={{ padding: '24px 0', textAlign: 'center' }}>
                                                <span className="material-icons-round" style={{ fontSize: 28, color: 'var(--border-default)', marginBottom: 6, display: 'block' }}>group_off</span>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                    {membersListLoadStatus === 'idle' ? 'Loading members…' : 'No members yet'}
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                {selectedTeam.members.map((member, idx) => (
                                                    <div key={member.id} style={{
                                                        display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px',
                                                        borderRadius: 6, transition: 'background 0.1s',
                                                        background: idx % 2 === 0 ? 'transparent' : 'var(--surface-2)',
                                                    }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'var(--surface-2)'; }}
                                                    >
                                                        <div style={{
                                                            width: 28, height: 28, borderRadius: '50%',
                                                            background: 'var(--helix-primary)',
                                                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: 10, fontWeight: 700, flexShrink: 0,
                                                        }}>
                                                            {(member.firstName[0] || member.jobTitle[0] || 'M').toUpperCase()}
                                                            {(member.lastName[0] || '').toUpperCase()}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{member.firstName} {member.lastName}</div>
                                                            {member.jobTitle ? (
                                                                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                    <span>{member.jobTitle}</span>
                                                                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: statusColor[member.status] || 'var(--text-muted)', flexShrink: 0 }} />
                                                                    <span style={{ color: statusColor[member.status], fontWeight: 600, fontSize: 10 }}>{member.status}</span>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveMember(member.id)}
                                                            title="Remove"
                                                            style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-disabled)', transition: 'all 0.12s' }}
                                                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--critical)'; e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-disabled)'; e.currentTarget.style.background = 'transparent'; }}
                                                        >
                                                            <span className="material-icons-round" style={{ fontSize: 14 }}>remove_circle_outline</span>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </>
    );
}
