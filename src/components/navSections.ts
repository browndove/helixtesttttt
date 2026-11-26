const navSections = [
    {
        title: 'Setup',
        items: [
            { icon: 'home', label: 'Home', href: '/home' },
            { icon: 'domain', label: 'Departments', href: '/departments' },
            { icon: 'bed', label: 'Beds', href: '/beds' },
            { icon: 'badge', label: 'Roles', href: '/roles' },
            { icon: 'notifications_active', label: 'Escalation Config', href: '/escalation' },
            { icon: 'groups', label: 'Staff Management', href: '/staff' },
            { icon: 'event_note', label: 'Scheduling', href: '/scheduling' },
            { icon: 'personal_injury', label: 'Patients', href: '/patients' },
            { icon: 'folder_shared', label: 'Patient List Folders', href: '/patient-list' },
            { icon: 'diversity_3', label: 'Provider Teams', href: '/provider-teams' },
            { icon: 'forum', label: 'External communication', href: '/external-communication' },
        ],
    },
    {
        title: 'Monitoring',
        items: [
            { icon: 'history', label: 'Audit Log', href: '/audit-log' },
            { icon: 'insights', label: 'Analytics', href: '/analytics' },
        ],
    },
];

/** Sidebar inside the Analytics section (its own pages, separate from the admin portal nav). */
export const analyticsNavSections = [
    {
        title: 'Analytics',
        items: [
            { icon: 'dashboard', label: 'Usage Summary', href: '/analytics' },
            { icon: 'speed', label: 'Response Performance', href: '/analytics/response-performance' },
            { icon: 'badge', label: 'Staffing & Coverage', href: '/analytics/staffing-coverage' },
            { icon: 'swap_horiz', label: 'Transfer Insight', href: '/analytics/transfers' },
            { icon: 'call', label: 'Call Insight', href: '/analytics/calls' },
        ],
    },
];

export default navSections;
