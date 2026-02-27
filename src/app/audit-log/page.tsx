'use client';

import { useState, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';
import CalendarRangePicker from '@/components/CalendarRangePicker';

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
};

const mockLogs: LogEntry[] = [
    { id: '1', action: 'Staff Added', category: 'Staff', firstName: 'Kwame', lastName: 'Asante', target: 'Ama Serwaa', details: 'Added new staff member to Emergency Department', timestamp: '2026-02-27T08:20:00Z', ip: '192.168.1.10' },
    { id: '2', action: 'Role Created', category: 'Roles', firstName: 'Kwame', lastName: 'Asante', target: 'ICU Charge Nurse', details: 'Created role from ICU Critical template', timestamp: '2026-02-26T10:45:00Z', ip: '192.168.1.10' },
    { id: '3', action: 'Staff Removed', category: 'Staff', firstName: 'Ama', lastName: 'Mensah', target: 'Kofi Darko', details: 'Removed staff member from Radiology', timestamp: '2026-02-25T09:30:00Z', ip: '192.168.1.22' },
    { id: '4', action: 'Escalation Updated', category: 'Escalation', firstName: 'Kwame', lastName: 'Asante', target: 'Emergency Critical Chain', details: 'Changed escalation delay from 5 min to 3 min', timestamp: '2026-02-24T16:10:00Z', ip: '192.168.1.10' },
    { id: '5', action: 'Role Edited', category: 'Roles', firstName: 'Ama', lastName: 'Mensah', target: 'Charge Nurse', details: 'Changed priority from Standard to Critical', timestamp: '2026-02-22T14:22:00Z', ip: '192.168.1.22' },
    { id: '6', action: 'Department Added', category: 'Hospital', firstName: 'Kwame', lastName: 'Asante', target: 'Oncology', details: 'Added new department Oncology', timestamp: '2026-02-20T11:05:00Z', ip: '192.168.1.10' },
    { id: '7', action: 'Staff Added', category: 'Staff', firstName: 'Kofi', lastName: 'Boateng', target: 'Yaa Amponsah', details: 'Added new staff member to ICU', timestamp: '2026-02-18T09:48:00Z', ip: '192.168.1.35' },
    { id: '8', action: 'Admin Invited', category: 'Admin', firstName: 'Kwame', lastName: 'Asante', target: 'Efua Darko', details: 'Invited as Viewer role', timestamp: '2026-02-15T15:30:00Z', ip: '192.168.1.10' },
    { id: '9', action: 'Role Created', category: 'Roles', firstName: 'Ama', lastName: 'Mensah', target: 'Safety Officer', details: 'Created role from Safety Threat template', timestamp: '2026-02-10T13:15:00Z', ip: '192.168.1.22' },
    { id: '10', action: 'Hospital Profile Updated', category: 'Hospital', firstName: 'Kwame', lastName: 'Asante', target: 'Accra Medical Center', details: 'Updated hospital phone number and email', timestamp: '2026-02-05T10:00:00Z', ip: '192.168.1.10' },
    { id: '11', action: 'Staff Role Changed', category: 'Staff', firstName: 'Kwame', lastName: 'Asante', target: 'Ama Serwaa', details: 'Changed role from Ward Nurse to Charge Nurse', timestamp: '2026-02-01T16:45:00Z', ip: '192.168.1.10' },
    { id: '12', action: 'Escalation Created', category: 'Escalation', firstName: 'Ama', lastName: 'Mensah', target: 'ICU Critical Chain', details: 'Created new escalation chain with 4 levels', timestamp: '2026-01-28T14:20:00Z', ip: '192.168.1.22' },
    { id: '13', action: 'Ward Added', category: 'Hospital', firstName: 'Kofi', lastName: 'Boateng', target: 'Ward C - Oncology', details: 'Added ward to Oncology department', timestamp: '2026-01-22T11:10:00Z', ip: '192.168.1.35' },
    { id: '14', action: 'Login', category: 'Auth', firstName: 'Kwame', lastName: 'Asante', target: 'System', details: 'Successful login from Chrome on macOS', timestamp: '2026-01-15T08:00:00Z', ip: '192.168.1.10' },
    { id: '15', action: 'Staff Added', category: 'Staff', firstName: 'Ama', lastName: 'Mensah', target: 'Kofi Mensah', details: 'Added new staff member to Surgery', timestamp: '2026-01-08T15:30:00Z', ip: '192.168.1.22' },
    { id: '16', action: 'Login Failed', category: 'Auth', firstName: 'Unknown', lastName: '', target: 'System', details: 'Failed login attempt with email admin@accra.com', timestamp: '2025-12-28T03:15:00Z', ip: '41.215.88.12' },
    { id: '17', action: 'Role Deleted', category: 'Roles', firstName: 'Kwame', lastName: 'Asante', target: 'Temp Nurse', details: 'Deleted unused temporary role', timestamp: '2025-12-15T17:00:00Z', ip: '192.168.1.10' },
    { id: '18', action: 'Staff Deactivated', category: 'Staff', firstName: 'Ama', lastName: 'Mensah', target: 'James Owusu', details: 'Deactivated staff account', timestamp: '2025-12-01T14:30:00Z', ip: '192.168.1.22' },
];

const categories = ['All', 'Staff', 'Roles', 'Escalation', 'Hospital', 'Admin', 'Auth'];


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
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [sortField, setSortField] = useState<SortField>('time');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir(field === 'time' ? 'desc' : 'asc');
        }
    };

    const filtered = useMemo(() => {
        let logs = [...mockLogs];

        if (categoryFilter !== 'All') {
            logs = logs.filter(l => l.category === categoryFilter);
        }

        if (dateFrom) {
            const from = new Date(dateFrom);
            logs = logs.filter(l => new Date(l.timestamp) >= from);
        }
        if (dateTo) {
            const to = new Date(dateTo);
            to.setHours(23, 59, 59, 999);
            logs = logs.filter(l => new Date(l.timestamp) <= to);
        }

        if (search.trim()) {
            const q = search.toLowerCase();
            logs = logs.filter(l =>
                l.firstName.toLowerCase().includes(q) ||
                l.lastName.toLowerCase().includes(q) ||
                `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
                l.target.toLowerCase().includes(q) ||
                l.action.toLowerCase().includes(q) ||
                l.details.toLowerCase().includes(q)
            );
        }

        logs.sort((a, b) => {
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

        return logs;
    }, [search, categoryFilter, sortField, sortDir, dateFrom, dateTo]);

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
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setCategoryFilter(cat)}
                                    style={{
                                        padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                                        fontSize: 11, fontWeight: categoryFilter === cat ? 600 : 500,
                                        color: categoryFilter === cat ? 'var(--helix-primary)' : 'var(--text-secondary)',
                                        background: categoryFilter === cat ? '#fff' : 'transparent',
                                        border: categoryFilter === cat ? '1px solid var(--border-default)' : '1px solid transparent',
                                        boxShadow: categoryFilter === cat ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                                        cursor: 'pointer', transition: 'all 0.15s',
                                    }}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        <CalendarRangePicker
                            from={dateFrom}
                            to={dateTo}
                            onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
                        />

                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
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
                </main>
            </div>
        </div>
    );
}
