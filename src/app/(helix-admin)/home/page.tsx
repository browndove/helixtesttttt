'use client';

import TopBar from '@/components/TopBar';

export default function HomePage() {
    return (
        <div className="app-main">
            <TopBar title="Home" subtitle="Overview" />
            <main
                style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'auto',
                    padding: '24px 28px',
                    background: 'var(--bg-900)',
                }}
            >
                <div className="card" style={{ padding: 28 }}>
                    <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-primary)' }}>Home</h2>
                    <p style={{ marginTop: 10, fontSize: 14, color: 'var(--text-muted)' }}>
                        Coming soon.
                    </p>
                </div>
            </main>
        </div>
    );
}
