const navSections = [
    {
        items: [
            { icon: 'dashboard', label: 'Dashboard', href: '/dashboard' },
        ],
    },
    {
        title: 'Monitoring',
        items: [
            { icon: 'monitor_heart', label: 'Duty Monitor', href: '/live-coverage' },
        ],
    },
    {
        title: 'Management',
        items: [
            { icon: 'domain', label: 'Hospital Profile', href: '/hospital-profile' },
            { icon: 'groups', label: 'Staff Directory', href: '/staff' },
            { icon: 'personal_injury', label: 'Patient Census', href: '/patients' },
            { icon: 'upload_file', label: 'Bulk Import', href: '/bulk-import' },
        ],
    },
    {
        title: 'Configuration',
        items: [
            { icon: 'admin_panel_settings', label: 'Roles & Access', href: '/roles' },
            { icon: 'notifications_active', label: 'Escalation Alerts', href: '/escalation' },
            { icon: 'security', label: 'Access Rules', href: '/access-rules' },
            { icon: 'campaign', label: 'Groups & Broadcast', href: '/groups' },
            { icon: 'history', label: 'Audit Log', href: '/audit' },
        ],
    },
];

export default navSections;
