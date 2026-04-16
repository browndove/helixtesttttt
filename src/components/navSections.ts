const navSections = [
    {
        title: 'Setup',
        items: [
            { icon: 'home', label: 'Home', href: '/home' },
            { icon: 'domain', label: 'Departments', href: '/departments' },
            { icon: 'badge', label: 'Roles', href: '/roles' },
            { icon: 'notifications_active', label: 'Escalation Config', href: '/escalation' },
            { icon: 'groups', label: 'Staff Management', href: '/staff' },
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
        ],
    },
];

export default navSections;
