const navSections = [
    {
        items: [
            { icon: 'analytics', label: 'Usage', href: '/usage' },
        ],
    },
    {
        title: 'Setup',
        items: [
            { icon: 'badge', label: 'Roles', href: '/roles' },
            { icon: 'domain', label: 'Departments', href: '/departments' },
            { icon: 'groups', label: 'Staff Management', href: '/staff' },
            { icon: 'personal_injury', label: 'Patients', href: '/patients' },
            { icon: 'folder_shared', label: 'Patient List', href: '/patient-list' },
            { icon: 'diversity_3', label: 'Provider Teams', href: '/provider-teams' },
            { icon: 'notifications_active', label: 'Escalation Config', href: '/escalation' },
            { icon: 'forum', label: 'External communication', href: '/external-communication' },
        ],
    },
    {
        title: 'Monitoring',
        items: [
            { icon: 'history', label: 'Audit Log', href: '/audit-log' },
        ],
    },
];

export default navSections;
