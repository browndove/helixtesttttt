const navSections = [
    {
        items: [
            { icon: 'home', label: 'Home', href: '/dashboard' },
        ],
    },
    {
        title: 'Setup',
        items: [
            { icon: 'badge', label: 'Roles', href: '/roles' },
            { icon: 'groups', label: 'Staff Management', href: '/staff' },
            { icon: 'diversity_3', label: 'Provider Teams', href: '/provider-teams' },
            { icon: 'notifications_active', label: 'Escalation Config', href: '/escalation' },
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
