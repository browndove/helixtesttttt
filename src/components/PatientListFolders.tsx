'use client';

import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

const folderItems = [
    { icon: 'folder', title: 'By Department', desc: 'Organize patients under Cardiology, Surgery, ICU, and more.' },
    { icon: 'folder', title: 'By Status', desc: 'Separate admitted, discharged, and outpatient patient groups.' },
    { icon: 'folder', title: 'By Unit / Ward', desc: 'Group patient lists by unit, ward, and room allocation.' },
    { icon: 'folder', title: 'Priority Follow-up', desc: 'Create focus folders for high-priority or at-risk patients.' },
];

export default function PatientListFolders() {
    return (
        <div className="app-shell">
            <Sidebar sections={navSections} />
            <div className="app-main">
                <TopBar title="Patient List" subtitle="Patient Categories" />
                <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>
                    <div className="card fade-in" style={{ padding: 20, marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 16 }}>Patient List Folders</h3>
                        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                            Use this area to categorize patient records into meaningful folders for quick access.
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
                        {folderItems.map(item => (
                            <div key={item.title} className="card fade-in" style={{ padding: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--helix-primary)' }}>{item.icon}</span>
                                    <h4 style={{ margin: 0, fontSize: 13.5 }}>{item.title}</h4>
                                </div>
                                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </main>
            </div>
        </div>
    );
}

