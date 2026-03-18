'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';
import CalendarRangePicker from '@/components/CalendarRangePicker';
import CustomSelect from '@/components/CustomSelect';

type LogEntry = {
    id: string;
    action: string;
    category: string;
    firstName: string;
    lastName: string;
    target: string;
    details: string;
    timestamp: string;
    ip: string;
    actionRaw: string;
    entityTypeRaw: string;
    userId: string;
    targetId: string;
};

const entityTypes = ['All', 'staff', 'patient', 'role', 'department', 'facility'];
const actionTypes = ['All', 'create', 'update', 'delete', 'sign_in', 'sign_out'];

function prettify(value: string): string {
    return value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (m) => m.toUpperCase());
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    if (typeof value !== 'string') return null;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed as Record<string, unknown>
            : null;
    } catch {
        return null;
    }
}

function looksLikeIdentifier(value: string): boolean {
    const v = value.trim();
    if (!v) return false;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)) return true;
    if (/^[0-9a-f]{24}$/i.test(v)) return true;
    if (/^\d{6,}$/.test(v)) return true;
    if (/^(staff|user|role|dept|department|facility|patient|team|policy|session|log)[-_][A-Za-z0-9]+$/i.test(v)) return true;
    return !/\s/.test(v) && /^[A-Za-z0-9_-]{18,}$/.test(v) && /\d/.test(v);
}

function asCleanString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function getHumanLabel(value: unknown): string {
    const s = asCleanString(value);
    return s && !looksLikeIdentifier(s) ? s : '';
}

function extractNameFromObject(raw: unknown): string {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '';
    const rec = raw as Record<string, unknown>;

    const direct = [
        rec.target_name,
        rec.entity_name,
        rec.resource_name,
        rec.object_name,
        rec.display_name,
        rec.full_name,
        rec.name,
        rec.title,
        rec.role_name,
        rec.department_name,
        rec.patient_name,
        rec.staff_name,
    ]
        .map(getHumanLabel)
        .find(Boolean);
    if (direct) return direct;

    const first = asCleanString(rec.first_name);
    const last = asCleanString(rec.last_name);
    const combined = [first, last].filter(Boolean).join(' ').trim();
    if (combined) return combined;

    return '';
}

function extractTargetIdFromRecord(rec: Record<string, unknown>, detailsObj: Record<string, unknown> | null): string {
    const targetObj = rec.target && typeof rec.target === 'object' && !Array.isArray(rec.target)
        ? rec.target as Record<string, unknown>
        : null;
    const entityObj = rec.entity && typeof rec.entity === 'object' && !Array.isArray(rec.entity)
        ? rec.entity as Record<string, unknown>
        : null;
    const resourceObj = rec.resource && typeof rec.resource === 'object' && !Array.isArray(rec.resource)
        ? rec.resource as Record<string, unknown>
        : null;
    const objectObj = rec.object && typeof rec.object === 'object' && !Array.isArray(rec.object)
        ? rec.object as Record<string, unknown>
        : null;

    const candidates = [
        rec.entity_id,
        rec.target_id,
        rec.resource_id,
        rec.object_id,
        rec.subject_id,
        targetObj?.id,
        entityObj?.id,
        resourceObj?.id,
        objectObj?.id,
        detailsObj?.entity_id,
        detailsObj?.target_id,
        detailsObj?.resource_id,
        detailsObj?.object_id,
        detailsObj?.subject_id,
    ]
        .map(asCleanString)
        .find(Boolean);

    return candidates || '';
}

function resolveTargetLabel(rec: Record<string, unknown>, entityRaw: string): { label: string; targetId: string } {
    const detailsObj = parseJsonObject(rec.details)
        || parseJsonObject(rec.description)
        || parseJsonObject(rec.message)
        || parseJsonObject(rec.metadata)
        || parseJsonObject(rec.meta);

    const targetObj = rec.target && typeof rec.target === 'object' && !Array.isArray(rec.target)
        ? rec.target as Record<string, unknown>
        : null;
    const entityObj = rec.entity && typeof rec.entity === 'object' && !Array.isArray(rec.entity)
        ? rec.entity as Record<string, unknown>
        : null;
    const resourceObj = rec.resource && typeof rec.resource === 'object' && !Array.isArray(rec.resource)
        ? rec.resource as Record<string, unknown>
        : null;
    const objectObj = rec.object && typeof rec.object === 'object' && !Array.isArray(rec.object)
        ? rec.object as Record<string, unknown>
        : null;

    const label = [
        getHumanLabel(rec.target_name),
        getHumanLabel(rec.entity_name),
        getHumanLabel(rec.resource_name),
        getHumanLabel(rec.object_name),
        getHumanLabel(rec.target),
        getHumanLabel(rec.entity),
        getHumanLabel(rec.resource),
        getHumanLabel(rec.object),
        extractNameFromObject(targetObj),
        extractNameFromObject(entityObj),
        extractNameFromObject(resourceObj),
        extractNameFromObject(objectObj),
        extractNameFromObject(detailsObj),
    ].find(Boolean) || '';

    const targetId = extractTargetIdFromRecord(rec, detailsObj);

    if (label) return { label, targetId };
    if (targetId) return { label: targetId, targetId };
    return { label: prettify(entityRaw), targetId: '' };
}

function parseAuditPayload(raw: unknown): { logs: LogEntry[]; total: number } {
    const container = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
    const list = Array.isArray(raw)
        ? raw
        : (container?.items || container?.data || container?.logs);

    const entries = Array.isArray(list) ? list : [];
    const logs = entries.map((entry: unknown, idx): LogEntry => {
        const rec = (entry && typeof entry === 'object') ? entry as Record<string, unknown> : {};
        const actor = (rec.actor && typeof rec.actor === 'object')
            ? rec.actor as Record<string, unknown>
            : ((rec.user && typeof rec.user === 'object') ? rec.user as Record<string, unknown> : {});
        const actionRaw = String(rec.action || 'update');
        const entityRaw = String(rec.entity_type || 'system');
        const firstName = String(rec.first_name || actor.first_name || 'System');
        const lastName = String(rec.last_name || actor.last_name || '');
        const ts = String(rec.timestamp || rec.created_at || new Date().toISOString());
        const details = String(rec.details || rec.description || rec.message || '');
        const ip = String(rec.ip || rec.ip_address || '-');
        const userId = String(rec.user_id || actor.id || '');
        const targetInfo = resolveTargetLabel(rec, entityRaw);

        return {
            id: String(rec.id || `log-${idx}-${ts}`),
            action: prettify(actionRaw),
            category: prettify(entityRaw),
            firstName,
            lastName,
            target: targetInfo.label,
            details,
            timestamp: ts,
            ip,
            actionRaw,
            entityTypeRaw: entityRaw,
            userId,
            targetId: targetInfo.targetId,
        };
    });

    const total = Number(container?.total ?? container?.count ?? logs.length);
    return { logs, total };
}


function formatTime(ts: string): string {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFullTime(ts: string): string {
    const d = new Date(ts);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

type SortField = 'time' | 'actor' | 'action';
type SortDir = 'asc' | 'desc';

export default function AuditLogPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [pageId, setPageId] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [search, setSearch] = useState('');
    const [entityTypeFilter, setEntityTypeFilter] = useState('All');
    const [actionFilter, setActionFilter] = useState('All');
    const [userIdFilter, setUserIdFilter] = useState('');
    const [sortField, setSortField] = useState<SortField>('time');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page_size: String(pageSize),
                page_id: String(pageId),
            });
            if (userIdFilter.trim()) params.set('user_id', userIdFilter.trim());
            if (entityTypeFilter !== 'All') params.set('entity_type', entityTypeFilter);
            if (actionFilter !== 'All') params.set('action', actionFilter);

            const res = await fetch(`/api/proxy/audit-logs?${params.toString()}`);
            if (!res.ok) {
                setLogs([]);
                setTotalCount(0);
                return;
            }
            const data = await res.json();
            const parsed = parseAuditPayload(data);
            setLogs(parsed.logs);
            setTotalCount(parsed.total);
        } catch {
            setLogs([]);
            setTotalCount(0);
        }
        setLoading(false);
    }, [pageSize, pageId, userIdFilter, entityTypeFilter, actionFilter]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    useEffect(() => { setPageId(1); }, [userIdFilter, entityTypeFilter, actionFilter, pageSize]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir(field === 'time' ? 'desc' : 'asc');
        }
    };

    const filtered = useMemo(() => {
        let localLogs = [...logs];

        if (dateFrom) {
            const from = new Date(dateFrom);
            localLogs = localLogs.filter(l => new Date(l.timestamp) >= from);
        }
        if (dateTo) {
            const to = new Date(dateTo);
            to.setHours(23, 59, 59, 999);
            localLogs = localLogs.filter(l => new Date(l.timestamp) <= to);
        }

        if (search.trim()) {
            const q = search.toLowerCase();
            localLogs = localLogs.filter(l =>
                l.firstName.toLowerCase().includes(q) ||
                l.lastName.toLowerCase().includes(q) ||
                `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
                l.target.toLowerCase().includes(q) ||
                l.targetId.toLowerCase().includes(q) ||
                l.action.toLowerCase().includes(q) ||
                l.details.toLowerCase().includes(q)
            );
        }

        localLogs.sort((a, b) => {
            let cmp = 0;
            if (sortField === 'time') {
                cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
            } else if (sortField === 'actor') {
                cmp = a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName);
            } else if (sortField === 'action') {
                cmp = a.action.localeCompare(b.action);
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return localLogs;
    }, [logs, search, sortField, sortDir, dateFrom, dateTo]);

    const SortIcon = ({ field }: { field: SortField }) => (
        <span className="material-icons-round" style={{
            fontSize: 14, color: sortField === field ? 'var(--helix-primary)' : 'var(--text-disabled)',
            transition: 'transform 0.15s',
            transform: sortField === field && sortDir === 'asc' ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
            arrow_downward
        </span>
    );

    return (
        <div className="app-shell">
            <Sidebar sections={navSections} />
            <div className="app-main">
                <TopBar title="Audit Log" subtitle="Activity History" />

                <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>
                    {/* Filters Row */}
                    <div className="fade-in" style={{ display: 'flex', gap: 12, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 10 }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 320 }}>
                            <span className="material-icons-round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--text-disabled)', pointerEvents: 'none' }}>search</span>
                            <input
                                className="input"
                                placeholder="Search by name, action, or target..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ paddingLeft: 34, fontSize: 12.5, height: 36, width: '100%' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: 3 }}>
                            {entityTypes.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setEntityTypeFilter(cat)}
                                    style={{
                                        padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                                        fontSize: 11, fontWeight: entityTypeFilter === cat ? 600 : 500,
                                        color: entityTypeFilter === cat ? 'var(--helix-primary)' : 'var(--text-secondary)',
                                        background: entityTypeFilter === cat ? '#fff' : 'transparent',
                                        border: entityTypeFilter === cat ? '1px solid var(--border-default)' : '1px solid transparent',
                                        boxShadow: entityTypeFilter === cat ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                                        cursor: 'pointer', transition: 'all 0.15s',
                                    }}
                                >
                                    {cat === 'All' ? 'All' : prettify(cat)}
                                </button>
                            ))}
                        </div>

                        <CustomSelect
                            value={actionFilter}
                            onChange={v => setActionFilter(v)}
                            options={actionTypes.map(a => ({ label: a === 'All' ? 'All Actions' : prettify(a), value: a }))}
                            placeholder="All Actions"
                            style={{ minWidth: 150 }}
                        />

                        <input
                            className="input"
                            placeholder="User ID"
                            value={userIdFilter}
                            onChange={e => setUserIdFilter(e.target.value)}
                            style={{ fontSize: 12, height: 36, width: 160 }}
                        />

                        <CustomSelect
                            value={String(pageSize)}
                            onChange={v => setPageSize(Number(v))}
                            options={[{ label: '20 / page', value: '20' }, { label: '50 / page', value: '50' }, { label: '100 / page', value: '100' }]}
                            style={{ width: 120 }}
                        />

                        <CalendarRangePicker
                            from={dateFrom}
                            to={dateTo}
                            onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
                        />

                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {loading ? 'Loading...' : `${filtered.length} visible · ${totalCount} total`}
                        </div>
                    </div>

                    {/* Log Table */}
                    <div className="fade-in card" style={{ padding: 0, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                                    <th
                                        onClick={() => handleSort('action')}
                                        style={{ padding: '10px 12px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            Action <SortIcon field="action" />
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('actor')}
                                        style={{ padding: '10px 12px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            Performed By <SortIcon field="actor" />
                                        </div>
                                    </th>
                                    <th style={{ padding: '10px 12px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }}>Target</th>
                                    <th
                                        onClick={() => handleSort('time')}
                                        style={{ padding: '10px 12px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            Time <SortIcon field="time" />
                                        </div>
                                    </th>
                                    <th style={{ padding: '10px 12px', width: 40 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ padding: '40px 16px', textAlign: 'center' }}>
                                            <span className="material-icons-round" style={{ fontSize: 32, color: 'var(--text-disabled)', display: 'block', marginBottom: 8 }}>search_off</span>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>No log entries found</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Try adjusting your search or filters</div>
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map(log => {
                                        const isExpanded = expandedId === log.id;
                                        return (
                                            <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', background: isExpanded ? 'var(--surface-2)' : 'transparent', transition: 'background 0.1s' }}
                                                onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                                onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#fafbfc'; }}
                                                onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                <td style={{ padding: '10px 16px' }}>
                                                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{log.action}</div>
                                                    {isExpanded && (
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                                                            {log.details}
                                                            <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-disabled)' }}>IP: {log.ip}</div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '10px 12px' }}>
                                                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{log.firstName} {log.lastName}</div>
                                                </td>
                                                <td style={{ padding: '10px 12px' }}>
                                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{log.target}</div>
                                                    {isExpanded && log.targetId && log.targetId !== log.target && (
                                                        <div style={{ fontSize: 10, color: 'var(--text-disabled)', marginTop: 2 }}>ID: {log.targetId}</div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '10px 12px' }}>
                                                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }} title={formatFullTime(log.timestamp)}>{formatTime(log.timestamp)}</div>
                                                    {isExpanded && (
                                                        <div style={{ fontSize: 10, color: 'var(--text-disabled)', marginTop: 2 }}>{formatFullTime(log.timestamp)}</div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                    <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--text-disabled)', transition: 'transform 0.15s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                        <button className="btn btn-secondary btn-xs" onClick={() => setPageId(p => Math.max(p - 1, 1))} disabled={pageId <= 1}>
                            Previous
                        </button>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>Page {pageId}</div>
                        <button className="btn btn-secondary btn-xs" onClick={() => setPageId(p => p + 1)} disabled={totalCount > 0 && pageId * pageSize >= totalCount}>
                            Next
                        </button>
                    </div>
                </main>
            </div>
        </div>
    );
}
