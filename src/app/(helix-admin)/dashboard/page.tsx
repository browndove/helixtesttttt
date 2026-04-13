'use client';

import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/TopBar';
import { MacVibrancyToast, MacVibrancyToastPortal } from '@/components/MacVibrancyToast';

type Hospital = { id: string; name: string; address: string; phone: string; email: string; license_type: string; license_expires_at: string; max_users: number };

export default function DashboardPage() {
    const [hospital, setHospital] = useState<Hospital | null>(null);
    const [hospitalName, setHospitalName] = useState('');
    const [hospitalAddress, setHospitalAddress] = useState('');
    const [hospitalPhone, setHospitalPhone] = useState('');
    const [hospitalEmail, setHospitalEmail] = useState('');
    const [toast, setToast] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Hospital-wide settings
    const [screenshotsAllowed, setScreenshotsAllowed] = useState(false);
    const [ipMode, setIpMode] = useState<'whitelist' | 'blacklist'>('whitelist');
    const [ipList, setIpList] = useState<string[]>([]);
    const [newIp, setNewIp] = useState('');
    const [retentionPeriod, setRetentionPeriod] = useState('90');
    const [settingsChanged, setSettingsChanged] = useState(false);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const fetchData = useCallback(async () => {
        try {
            const hRes = await fetch('/api/proxy/hospital');
            if (hRes.ok) {
                const h = await hRes.json();
                setHospital(h);
                setHospitalName(h.name || '');
                setHospitalAddress(h.address || '');
                setHospitalPhone(h.phone || '');
                setHospitalEmail(h.email || '');
            }
        } catch { showToast('Failed to load data'); }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const licenseExpiry = hospital?.license_expires_at ? new Date(hospital.license_expires_at) : new Date();
    const now = new Date();
    const daysLeft = Math.ceil((licenseExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const licenseActive = daysLeft > 0;
    const licenseWarning = daysLeft > 0 && daysLeft <= 90;

    // Settings helpers
    const addIp = () => {
        const ip = newIp.trim();
        if (!ip || ipList.includes(ip)) return;
        setIpList(prev => [...prev, ip]);
        setNewIp('');
        setSettingsChanged(true);
    };
    const removeIp = (ip: string) => { setIpList(prev => prev.filter(i => i !== ip)); setSettingsChanged(true); };
    const saveSettings = () => { setSettingsChanged(false); showToast('Settings saved successfully'); };

    if (loading) {
        const shimmer = {
            background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border-subtle) 50%, var(--surface-2) 75%)',
            backgroundSize: '400% 100%',
            animation: 'shimmer 1.4s ease infinite',
            borderRadius: 'var(--radius-md)',
        };
        const line = (w: string, h = 12) => <div style={{ ...shimmer, width: w, height: h, marginBottom: 8 }} />;
        return (
                <div className="app-main">
                    <TopBar title="Home" subtitle="Hospital Setup" />
                    <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 640 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                {/* Hospital Profile skeleton */}
                                <div className="fade-in delay-1 card">
                                    {line('160px', 16)}
                                    <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                                        <div style={{ ...shimmer, width: 80, height: 80, borderRadius: 12, flexShrink: 0 }} />
                                        <div style={{ flex: 1 }}>
                                            {line('100%', 32)}
                                            {line('100%', 32)}
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                                        <div style={{ ...shimmer, height: 32 }} />
                                        <div style={{ ...shimmer, height: 32 }} />
                                    </div>
                                </div>
                                {/* License skeleton */}
                                <div className="fade-in delay-2 card">
                                    {line('140px', 16)}
                                    <div style={{ ...shimmer, height: 70, marginTop: 10 }} />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                                        <div style={{ ...shimmer, height: 48 }} />
                                        <div style={{ ...shimmer, height: 48 }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
        );
    }

    return (
        <>
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast} variant="success" dismissible={false} />
                </MacVibrancyToastPortal>
            )}

            <div className="app-main">
                <TopBar title="Home" subtitle="Hospital Setup" />

                <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 640 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                            {/* Hospital Profile */}
                            <div className="fade-in delay-1 card">
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                    <span className="material-icons-round" style={{ fontSize: 20, color: 'var(--helix-primary)' }}>business</span>
                                    Hospital Profile
                                </h3>

                                <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
                                    {/* Logo Placeholder */}
                                    <div style={{ width: 80, height: 80, borderRadius: 12, border: '2px dashed var(--border-default)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'default', background: 'var(--surface-2)', flexShrink: 0, transition: 'all 0.2s' }}>
                                        <span className="material-icons-round" style={{ fontSize: 24, color: 'var(--text-disabled)' }}>add_photo_alternate</span>
                                        <span style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>Logo</span>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ marginBottom: 10 }}>
                                            <label className="label">Hospital Name</label>
                                            <input className="input" value={hospitalName} readOnly disabled style={{ fontSize: 13 }} />
                                        </div>
                                        <div>
                                            <label className="label">Address</label>
                                            <input className="input" value={hospitalAddress} readOnly disabled style={{ fontSize: 13 }} />
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <label className="label">Phone</label>
                                        <input className="input" value={hospitalPhone} readOnly disabled style={{ fontSize: 13 }} />
                                    </div>
                                    <div>
                                        <label className="label">Email</label>
                                        <input className="input" value={hospitalEmail} readOnly disabled style={{ fontSize: 13 }} />
                                    </div>
                                </div>
                            </div>

                            {/* License Status */}
                            <div className="fade-in delay-2 card">
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                    <span className="material-icons-round" style={{ fontSize: 20, color: licenseWarning ? 'var(--warning)' : licenseActive ? 'var(--success)' : 'var(--critical)' }}>
                                        {licenseActive ? 'verified' : 'gpp_bad'}
                                    </span>
                                    License Status
                                </h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 'var(--radius-md)', background: licenseWarning ? 'var(--warning-bg)' : licenseActive ? 'var(--success-bg)' : 'var(--critical-bg)', border: `1px solid ${licenseWarning ? 'rgba(154,123,46,0.2)' : licenseActive ? '#d5e8dd' : 'rgba(140,90,94,0.2)'}` }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: 14, color: licenseActive ? 'var(--text-primary)' : 'var(--critical)' }}>
                                            {licenseActive ? 'Active License' : 'License Expired'}
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                                            Expires: {licenseExpiry.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                        </div>
                                        {licenseActive && (
                                            <div style={{ fontSize: 12, color: licenseWarning ? 'var(--warning)' : 'var(--success)', marginTop: 2, fontWeight: 600 }}>
                                                {daysLeft} days remaining {licenseWarning ? '— Renewal recommended' : ''}
                                            </div>
                                        )}
                                    </div>
                                    <button className="btn btn-secondary btn-sm" onClick={() => showToast('Renewal request sent')}>
                                        <span className="material-icons-round" style={{ fontSize: 14 }}>autorenew</span>
                                        {licenseWarning || !licenseActive ? 'Renew Now' : 'Manage'}
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                                    <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>License Type</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{hospital?.license_type || 'Enterprise'}</div>
                                    </div>
                                    <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Max Users</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{hospital?.max_users || 500}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Hospital-Wide Settings */}
                    <div className="fade-in delay-2" style={{ marginTop: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                    <span className="material-icons-round" style={{ fontSize: 22, color: 'var(--helix-primary)' }}>admin_panel_settings</span>
                                    Hospital-Wide Settings
                                </h3>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Security, compliance, and messaging policies that apply across all departments</p>
                            </div>
                            {settingsChanged && (
                                <button className="btn btn-primary btn-sm" onClick={saveSettings}>
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>save</span> Save Settings
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                            {/* Left Settings Column */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                                {/* Screenshot Control */}
                                <div className="card">
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 36, height: 36, borderRadius: 10, background: screenshotsAllowed ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span className="material-icons-round" style={{ fontSize: 20, color: screenshotsAllowed ? 'var(--success)' : 'var(--danger)' }}>
                                                    {screenshotsAllowed ? 'screenshot_monitor' : 'no_photography'}
                                                </span>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 14, fontWeight: 700 }}>Screenshot Control</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Allow or block screen captures within the app</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 'var(--radius-md)', background: screenshotsAllowed ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.04)', border: `1px solid ${screenshotsAllowed ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)'}` }}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>
                                                Screenshots {screenshotsAllowed ? 'Allowed' : 'Blocked'}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                                {screenshotsAllowed ? 'Users can capture screen content' : 'Screen capture is disabled for all users'}
                                            </div>
                                        </div>
                                        <div
                                            onClick={() => { setScreenshotsAllowed(!screenshotsAllowed); setSettingsChanged(true); }}
                                            style={{ width: 44, height: 24, borderRadius: 12, background: screenshotsAllowed ? 'var(--success)' : 'var(--border-default)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                                        >
                                            <div style={{ width: 18, height: 18, borderRadius: 9, background: '#fff', position: 'absolute', top: 3, left: screenshotsAllowed ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                        </div>
                                    </div>
                                    <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span className="material-icons-round" style={{ fontSize: 14, color: 'var(--info)' }}>info</span>
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>This policy applies to all mobile and desktop clients connected to Helix</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Message Retention Period */}
                                <div className="card">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span className="material-icons-round" style={{ fontSize: 20, color: '#6366f1' }}>schedule</span>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 700 }}>Message Retention</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>How long messages are stored before auto-deletion</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {[
                                            { value: '30', label: '30 Days', desc: 'Minimum retention — aggressive cleanup' },
                                            { value: '90', label: '90 Days', desc: 'Recommended for most facilities' },
                                            { value: '180', label: '180 Days', desc: 'Extended retention for compliance' },
                                            { value: '365', label: '1 Year', desc: 'Full annual retention' },
                                            { value: 'forever', label: 'Indefinite', desc: 'Messages are never auto-deleted' },
                                        ].map(opt => (
                                            <div
                                                key={opt.value}
                                                onClick={() => { setRetentionPeriod(opt.value); setSettingsChanged(true); }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                                    background: retentionPeriod === opt.value ? 'rgba(99,102,241,0.06)' : 'transparent',
                                                    border: `1px solid ${retentionPeriod === opt.value ? 'rgba(99,102,241,0.3)' : 'var(--border-subtle)'}`,
                                                    transition: 'all 0.15s',
                                                }}
                                            >
                                                <div style={{
                                                    width: 16, height: 16, borderRadius: 8, border: `2px solid ${retentionPeriod === opt.value ? '#6366f1' : 'var(--border-default)'}`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                }}>
                                                    {retentionPeriod === opt.value && <div style={{ width: 8, height: 8, borderRadius: 4, background: '#6366f1' }} />}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opt.desc}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right Settings Column */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                                {/* IP Whitelist / Blacklist */}
                                <div className="card">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span className="material-icons-round" style={{ fontSize: 20, color: '#f59e0b' }}>vpn_lock</span>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 14, fontWeight: 700 }}>Network Access Control</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Restrict access by IP address</div>
                                        </div>
                                    </div>

                                    {/* Mode selector */}
                                    <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
                                        {(['whitelist', 'blacklist'] as const).map(mode => (
                                            <button
                                                key={mode}
                                                onClick={() => { setIpMode(mode); setSettingsChanged(true); }}
                                                style={{
                                                    flex: 1, padding: '8px 12px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                                                    background: ipMode === mode ? (mode === 'whitelist' ? 'var(--success)' : 'var(--danger)') : 'var(--surface-2)',
                                                    color: ipMode === mode ? '#fff' : 'var(--text-secondary)',
                                                    transition: 'all 0.15s',
                                                }}
                                            >
                                                <span className="material-icons-round" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>
                                                    {mode === 'whitelist' ? 'check_circle' : 'block'}
                                                </span>
                                                {mode === 'whitelist' ? 'Whitelist' : 'Blacklist'}
                                            </button>
                                        ))}
                                    </div>

                                    <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: ipMode === 'whitelist' ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.04)', border: `1px solid ${ipMode === 'whitelist' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)'}`, marginBottom: 12 }}>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            {ipMode === 'whitelist' ? 'Only listed IPs will be allowed to access the system' : 'Listed IPs will be blocked from accessing the system'}
                                        </span>
                                    </div>

                                    {/* IP input */}
                                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                                        <input className="input" placeholder="e.g. 192.168.1.0/24" value={newIp} onChange={e => setNewIp(e.target.value)} onKeyDown={e => e.key === 'Enter' && addIp()} style={{ fontSize: 12, flex: 1 }} />
                                        <button className="btn btn-secondary btn-sm" onClick={addIp} disabled={!newIp.trim()}>
                                            <span className="material-icons-round" style={{ fontSize: 14 }}>add</span> Add
                                        </button>
                                    </div>

                                    {/* IP list */}
                                    <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {ipList.map(ip => (
                                            <div key={ip} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span className="material-icons-round" style={{ fontSize: 14, color: ipMode === 'whitelist' ? 'var(--success)' : 'var(--danger)' }}>
                                                        {ipMode === 'whitelist' ? 'check_circle' : 'block'}
                                                    </span>
                                                    <code style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-primary)' }}>{ip}</code>
                                                </div>
                                                <button onClick={() => removeIp(ip)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                                    <span className="material-icons-round" style={{ fontSize: 14, color: 'var(--text-muted)' }}>close</span>
                                                </button>
                                            </div>
                                        ))}
                                        {ipList.length === 0 && (
                                            <div style={{ padding: '14px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                                                No IP addresses configured — all traffic is {ipMode === 'whitelist' ? 'blocked' : 'allowed'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
