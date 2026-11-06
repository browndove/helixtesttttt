'use client';

import { FormEvent, useState } from 'react';
import { API_ENDPOINTS } from '@/lib/config';
import { MacVibrancyToast, MacVibrancyToastPortal } from '@/components/MacVibrancyToast';
import InternalAdminShell from '@/components/InternalAdminShell';
import './internal-admin-dashboard.css';

type UnreadThread = {
    conversation_id: string;
    kind: string;
    unread_count: number;
    subject: string;
};

type UnreadBreakdown = {
    total_unread_messages: number;
    total_unread_messages_as_role: number;
    threads: UnreadThread[];
};

type PushDevice = {
    kind: string;
    api_environment: string;
    platform: string;
    token_prefix: string;
    updated_at: string;
};

type AppInstall = {
    platform: string;
    os: string;
    app_version: string;
    build: string;
    last_seen_at: string;
};

type CriticalAlertSound = {
    key: string;
    file: string;
    android_channel_id: string;
};

type NotificationDiagnostics = {
    name: string;
    status: string;
    api_environment: string;
    do_not_disturb: boolean;
    online_now: boolean;
    last_seen: string;
    critical_alert_sound: CriticalAlertSound | null;
    push_devices: PushDevice[];
    app_installs: AppInstall[];
    problems: string[];
};

function asRecord(raw: unknown): Record<string, unknown> {
    return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

function asString(v: unknown): string {
    return v == null ? '' : String(v);
}

function asNumber(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
}

function asBool(v: unknown): boolean {
    return Boolean(v);
}

function parseUnread(raw: unknown): UnreadBreakdown {
    const rec = asRecord(raw);
    const threadsRaw = Array.isArray(rec.threads) ? rec.threads : [];
    return {
        total_unread_messages: asNumber(rec.total_unread_messages),
        total_unread_messages_as_role: asNumber(rec.total_unread_messages_as_role),
        threads: threadsRaw
            .map((t) => {
                const row = asRecord(t);
                return {
                    conversation_id: asString(row.conversation_id),
                    kind: asString(row.kind) || '—',
                    unread_count: asNumber(row.unread_count),
                    subject: asString(row.subject),
                };
            })
            .filter((t) => t.conversation_id),
    };
}

function parseDiagnostics(raw: unknown): NotificationDiagnostics {
    const rec = asRecord(raw);
    const soundRaw = rec.critical_alert_sound;
    const soundRec = soundRaw && typeof soundRaw === 'object' ? asRecord(soundRaw) : null;
    const problems = Array.isArray(rec.problems)
        ? rec.problems.map((p) => asString(p).trim()).filter(Boolean)
        : [];
    const devices = Array.isArray(rec.push_devices) ? rec.push_devices : [];
    const installs = Array.isArray(rec.app_installs) ? rec.app_installs : [];
    return {
        name: asString(rec.name) || 'Unknown',
        status: asString(rec.status) || '—',
        api_environment: asString(rec.api_environment) || '—',
        do_not_disturb: asBool(rec.do_not_disturb),
        online_now: asBool(rec.online_now),
        last_seen: asString(rec.last_seen),
        critical_alert_sound: soundRec
            ? {
                key: asString(soundRec.key),
                file: asString(soundRec.file),
                android_channel_id: asString(soundRec.android_channel_id),
            }
            : null,
        push_devices: devices.map((d) => {
            const row = asRecord(d);
            return {
                kind: asString(row.kind),
                api_environment: asString(row.api_environment),
                platform: asString(row.platform),
                token_prefix: asString(row.token_prefix),
                updated_at: asString(row.updated_at),
            };
        }),
        app_installs: installs.map((d) => {
            const row = asRecord(d);
            return {
                platform: asString(row.platform),
                os: asString(row.os),
                app_version: asString(row.app_version),
                build: asString(row.build),
                last_seen_at: asString(row.last_seen_at),
            };
        }),
        problems,
    };
}

function formatWhen(value: string): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
}

export default function InternalUserSupportTools() {
    const [userId, setUserId] = useState('');
    const [loadedId, setLoadedId] = useState('');
    const [loading, setLoading] = useState(false);
    const [unread, setUnread] = useState<UnreadBreakdown | null>(null);
    const [diagnostics, setDiagnostics] = useState<NotificationDiagnostics | null>(null);
    const [unreadError, setUnreadError] = useState<string | null>(null);
    const [diagError, setDiagError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const lookup = async (id: string) => {
        const trimmed = id.trim();
        if (!trimmed) {
            showToast('Enter a user ID.', 'error');
            return;
        }
        setLoading(true);
        setUnread(null);
        setDiagnostics(null);
        setUnreadError(null);
        setDiagError(null);
        setLoadedId(trimmed);

        try {
            const [unreadRes, diagRes] = await Promise.all([
                fetch(API_ENDPOINTS.INTERNAL_USER_UNREAD_BREAKDOWN(trimmed), {
                    credentials: 'include',
                    cache: 'no-store',
                }),
                fetch(API_ENDPOINTS.INTERNAL_USER_NOTIFICATION_DIAGNOSTICS(trimmed), {
                    credentials: 'include',
                    cache: 'no-store',
                }),
            ]);

            const unreadJson = await unreadRes.json().catch(() => ({}));
            const diagJson = await diagRes.json().catch(() => ({}));

            if (unreadRes.ok) {
                setUnread(parseUnread(unreadJson));
            } else {
                setUnreadError(
                    String(
                        (unreadJson as { error?: string; message?: string }).error
                        || (unreadJson as { message?: string }).message
                        || `Unread breakdown failed (${unreadRes.status})`,
                    ),
                );
            }

            if (diagRes.ok) {
                setDiagnostics(parseDiagnostics(diagJson));
            } else {
                setDiagError(
                    String(
                        (diagJson as { error?: string; message?: string }).error
                        || (diagJson as { message?: string }).message
                        || `Notification diagnostics failed (${diagRes.status})`,
                    ),
                );
            }

            if (!unreadRes.ok && !diagRes.ok) {
                showToast('Could not load support data for that user.', 'error');
            }
        } catch {
            showToast('Could not load support data for that user.', 'error');
            setUnreadError('Request failed');
            setDiagError('Request failed');
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        void lookup(userId);
    };

    return (
        <>
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast.message} variant={toast.type} dismissible={false} />
                </MacVibrancyToastPortal>
            )}

            <InternalAdminShell>
                <div className="internal-dash__page-header">
                    <div className="internal-dash__page-header-row">
                        <div>
                            <h1 className="internal-dash__title">User support</h1>
                            <p className="internal-dash__subtitle">
                                Unread badge breakdown and notification diagnostics for a staff user ID.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="internal-dash__toolbar">
                    <form className="internal-dash__toolbar-row" onSubmit={onSubmit}>
                        <div className="internal-dash__search-wrap" style={{ flex: 1, maxWidth: 420 }}>
                            <span className="material-icons-round internal-dash__search-icon" aria-hidden>
                                badge
                            </span>
                            <input
                                className="internal-dash__input"
                                placeholder="Paste user ID…"
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                                autoComplete="off"
                                spellCheck={false}
                            />
                        </div>
                        <button
                            type="submit"
                            className="internal-dash__btn internal-dash__btn--primary"
                            disabled={loading}
                        >
                            {loading ? 'Looking up…' : 'Look up'}
                        </button>
                    </form>
                </div>

                <main className="internal-dash__main">
                    {!loadedId && !loading && (
                        <div className="internal-dash__empty">
                            <span className="material-icons-round" style={{ fontSize: 24, color: '#ccc', marginBottom: 8 }}>
                                support_agent
                            </span>
                            Enter a user ID to inspect unread counts and push delivery.
                        </div>
                    )}

                    {loading && (
                        <div className="internal-dash__empty">
                            <span className="material-icons-round" style={{ fontSize: 24, color: '#ccc', marginBottom: 8 }}>
                                hourglass_empty
                            </span>
                            Loading support data…
                        </div>
                    )}

                    {!loading && loadedId && (
                        <div className="internal-support__stack">
                            <section className="internal-support__panel">
                                <h2 className="internal-support__panel-title">Notification diagnostics</h2>
                                {diagError && <p className="internal-support__error">{diagError}</p>}
                                {diagnostics && (
                                    <>
                                        {diagnostics.problems.length > 0 ? (
                                            <div className="internal-support__problems" role="alert">
                                                <div className="internal-support__problems-label">Problems</div>
                                                <ul>
                                                    {diagnostics.problems.map((problem) => (
                                                        <li key={problem}>{problem}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : (
                                            <p className="internal-support__ok">No problems reported for this user.</p>
                                        )}

                                        <dl className="internal-support__facts">
                                            <div>
                                                <dt>Name</dt>
                                                <dd>{diagnostics.name}</dd>
                                            </div>
                                            <div>
                                                <dt>Status</dt>
                                                <dd>{diagnostics.status}</dd>
                                            </div>
                                            <div>
                                                <dt>API environment</dt>
                                                <dd>{diagnostics.api_environment}</dd>
                                            </div>
                                            <div>
                                                <dt>Do not disturb</dt>
                                                <dd>{diagnostics.do_not_disturb ? 'On' : 'Off'}</dd>
                                            </div>
                                            <div>
                                                <dt>Online now</dt>
                                                <dd>{diagnostics.online_now ? 'Yes' : 'No'}</dd>
                                            </div>
                                            <div>
                                                <dt>Last seen</dt>
                                                <dd>{formatWhen(diagnostics.last_seen)}</dd>
                                            </div>
                                            <div>
                                                <dt>Critical alert sound</dt>
                                                <dd>
                                                    {diagnostics.critical_alert_sound
                                                        ? `${diagnostics.critical_alert_sound.key} (${diagnostics.critical_alert_sound.file})`
                                                        : '—'}
                                                </dd>
                                            </div>
                                        </dl>

                                        <h3 className="internal-support__section-title">Push devices</h3>
                                        {diagnostics.push_devices.length === 0 ? (
                                            <p className="internal-support__muted">No push devices registered.</p>
                                        ) : (
                                            <div className="internal-support__table-wrap">
                                                <table className="internal-support__table">
                                                    <thead>
                                                        <tr>
                                                            <th>Kind</th>
                                                            <th>Platform</th>
                                                            <th>Environment</th>
                                                            <th>Token</th>
                                                            <th>Updated</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {diagnostics.push_devices.map((device, i) => (
                                                            <tr key={`${device.token_prefix}-${i}`}>
                                                                <td>{device.kind || '—'}</td>
                                                                <td>{device.platform || '—'}</td>
                                                                <td>{device.api_environment || '—'}</td>
                                                                <td className="internal-support__mono">{device.token_prefix || '—'}</td>
                                                                <td>{formatWhen(device.updated_at)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        <h3 className="internal-support__section-title">App installs</h3>
                                        {diagnostics.app_installs.length === 0 ? (
                                            <p className="internal-support__muted">No app installs recorded.</p>
                                        ) : (
                                            <div className="internal-support__table-wrap">
                                                <table className="internal-support__table">
                                                    <thead>
                                                        <tr>
                                                            <th>Platform</th>
                                                            <th>OS</th>
                                                            <th>App</th>
                                                            <th>Build</th>
                                                            <th>Last seen</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {diagnostics.app_installs.map((install, i) => (
                                                            <tr key={`${install.platform}-${install.build}-${i}`}>
                                                                <td>{install.platform || '—'}</td>
                                                                <td>{install.os || '—'}</td>
                                                                <td>{install.app_version || '—'}</td>
                                                                <td>{install.build || '—'}</td>
                                                                <td>{formatWhen(install.last_seen_at)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </>
                                )}
                            </section>

                            <section className="internal-support__panel">
                                <h2 className="internal-support__panel-title">Unread breakdown</h2>
                                {unreadError && <p className="internal-support__error">{unreadError}</p>}
                                {unread && (
                                    <>
                                        <dl className="internal-support__facts">
                                            <div>
                                                <dt>Total unread</dt>
                                                <dd>{unread.total_unread_messages}</dd>
                                            </div>
                                            <div>
                                                <dt>Unread as role</dt>
                                                <dd>{unread.total_unread_messages_as_role}</dd>
                                            </div>
                                        </dl>

                                        <h3 className="internal-support__section-title">Threads</h3>
                                        {unread.threads.length === 0 ? (
                                            <p className="internal-support__muted">No unread threads.</p>
                                        ) : (
                                            <div className="internal-support__table-wrap">
                                                <table className="internal-support__table">
                                                    <thead>
                                                        <tr>
                                                            <th>Kind</th>
                                                            <th>Subject</th>
                                                            <th>Unread</th>
                                                            <th>Conversation</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {unread.threads.map((thread) => (
                                                            <tr key={thread.conversation_id}>
                                                                <td>{thread.kind}</td>
                                                                <td>{thread.subject || '—'}</td>
                                                                <td>{thread.unread_count}</td>
                                                                <td className="internal-support__mono">{thread.conversation_id}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </>
                                )}
                            </section>
                        </div>
                    )}
                </main>
            </InternalAdminShell>
        </>
    );
}
