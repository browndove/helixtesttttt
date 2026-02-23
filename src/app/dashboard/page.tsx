'use client';

import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

const screens = [
  { href: '/live-coverage', title: 'Duty Monitor', icon: 'ssid_chart', desc: 'Real-time unit coverage and vacancy tracking' },
  { href: '/hospital-profile', title: 'Hospital Setup', icon: 'domain', desc: 'Configure hospital structure and ward hierarchy' },
  { href: '/staff', title: 'Staff Directory', icon: 'groups', desc: 'Browse staff, assign roles, and manage access' },
  { href: '/bulk-import', title: 'Bulk Upload', icon: 'upload_file', desc: 'CSV/Excel batch imports with validation preview' },
  { href: '/roles', title: 'Roles Builder', icon: 'admin_panel_settings', desc: 'Define clinical roles and alert escalation rules' },
  { href: '/escalation', title: 'Escalation Settings', icon: 'notifications_active', desc: 'Configure protocol chains and delivery channels' },
  { href: '/patients', title: 'Patient Census', icon: 'personal_injury', desc: 'Track active patients across wards with acuity scores' },
  { href: '/access-rules', title: 'Access Rules', icon: 'security', desc: 'Role-based access control with break-glass override' },
  { href: '/groups', title: 'Group Management', icon: 'campaign', desc: 'Manage broadcast groups and messaging permissions' },
];

export default function DashboardPage() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar sections={navSections} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar
          title="Helix Admin"
          breadcrumbs={['Dashboard']}
          subtitle="Clinical Workflow OS"
        />

        <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>
          {/* Stats Row */}
          <div className="fade-in" style={{ display: 'flex', gap: 14, marginBottom: 32 }}>
            {[
              { label: 'Active Staff', value: '142', icon: 'groups', sub: '+12% this week' },
              { label: 'Patient Census', value: '88', icon: 'personal_injury', sub: '18 beds open' },
              { label: 'Coverage Ratio', value: '94%', icon: 'verified', sub: 'Facility-wide' },
              { label: 'Open Alerts', value: '3', icon: 'notifications_active', sub: '1 critical' },
            ].map(s => (
              <div key={s.label} className="card" style={{ flex: 1, padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
                    {s.sub && <div style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 2 }}>{s.sub}</div>}
                  </div>
                  <span className="material-icons-round" style={{ fontSize: 22, color: 'var(--helix-accent)', opacity: 0.5 }}>{s.icon}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Screen Grid */}
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Modules</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {screens.map((screen, i) => (
              <Link
                key={screen.href}
                href={screen.href}
                className={`card fade-in delay-${Math.min(i + 1, 4)}`}
                style={{
                  textDecoration: 'none',
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  padding: '18px 20px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--helix-accent)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)';
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: '#edf1f7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span className="material-icons-round" style={{ fontSize: 20, color: 'var(--helix-primary)' }}>{screen.icon}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.4 }}>{screen.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{screen.desc}</div>
                </div>
                <span className="material-icons-round" style={{ fontSize: 15, color: 'var(--text-disabled)', flexShrink: 0, marginTop: 2 }}>arrow_forward</span>
              </Link>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
