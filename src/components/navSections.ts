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
            { icon: 'personal_injury', label: 'Patients', href: '/patients' },
            { icon: 'notifications_active', label: 'Escalation Config', href: '/escalation' },
        ],
    },
    {
        title: 'System',
        items: [
            { icon: 'history', label: 'Audit Log', href: '/audit' },
        ],
    },
];

export default navSections;
