'use client';

import { FormEvent, useMemo, useState } from 'react';
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
    return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
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
                        || `Unread failed (${unreadRes.status})`,
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
                        || `Diagnostics failed (${diagRes.status})`,
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

    const copyLoadedId = () => {
        if (!loadedId) return;
        void navigator.clipboard.writeText(loadedId).then(
            () => showToast('User ID copied', 'success'),
            () => showToast('Could not copy User ID', 'error'),
        );
    };

    const topDevices = useMemo(
        () => (diagnostics?.push_devices || []).slice(0, 4),
        [diagnostics],
    );
    const topInstalls = useMemo(
        () => (diagnostics?.app_installs || []).slice(0, 3),
        [diagnostics],
    );
    const topThreads = useMemo(
        () => (unread?.threads || []).slice(0, 4),
        [unread],
    );

    return (
        <>
            {toast && (
                <MacVibrancyToastPortal>
                    <MacVibrancyToast message={toast.message} variant={toast.type} dismissible={false} />
                </MacVibrancyToastPortal>
            )}

            <InternalAdminShell>
                <div className="ius-shell">
                    <header className="ius-top">
                        <div>
                            <h1 className="ius-top__title">User support</h1>
                            <p className="ius-top__sub">Push + unread for one person</p>
                        </div>
                        <form className="ius-search" onSubmit={onSubmit}>
                            <input
                                value={userId}
                                onChange={e => setUserId(e.target.value)}
                                placeholder="Paste User ID…"
                                autoComplete="off"
                                spellCheck={false}
                            />
                            <button type="submit" disabled={loading}>
                                {loading ? '…' : 'Look up'}
                            </button>
                        </form>
                    </header>

                    {!loadedId && !loading && (
                        <div className="ius-glass ius-glass--empty">
                            Staff → Copy User ID → paste here
                        </div>
                    )}

                    {loading && (
                        <div className="ius-glass ius-glass--empty">Loading…</div>
                    )}

                    {!loading && loadedId && (
                        <div className="ius-bento">
                            <article className="ius-glass ius-tile ius-tile--person">
                                <div className="ius-avatar" aria-hidden>
                                    {initials(diagnostics?.name || 'U')}
                                </div>
                                <div className="ius-person">
                                    <h2>{diagnostics?.name || 'User'}</h2>
                                    <button type="button" className="ius-id" onClick={copyLoadedId} title={loadedId}>
                                        <span>{loadedId.slice(0, 8)}…</span>
                                        <span className="material-icons-round" aria-hidden>content_copy</span>
                                    </button>
                                    <div className="ius-chips">
                                        {diagnostics ? (
                                            <>
                                                <span className={diagnostics.online_now ? 'on' : ''}>
                                                    {diagnostics.online_now ? 'Online' : 'Offline'}
                                                </span>
                                                <span className={diagnostics.do_not_disturb ? 'warn' : ''}>
                                                    {diagnostics.do_not_disturb ? 'DND' : 'DND off'}
                                                </span>
                                                <span>{diagnostics.status}</span>
                                                <span>{diagnostics.api_environment}</span>
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                            </article>

                            <article className="ius-glass ius-tile ius-tile--metric">
                                <div className="ius-metric__n">{unread?.total_unread_messages ?? '—'}</div>
                                <div className="ius-metric__l">Unread</div>
                            </article>

                            <article className="ius-glass ius-tile ius-tile--metric">
                                <div className="ius-metric__n">{unread?.total_unread_messages_as_role ?? '—'}</div>
                                <div className="ius-metric__l">As role</div>
                            </article>

                            <article className="ius-glass ius-tile ius-tile--metric">
                                <div className="ius-metric__n">{diagnostics?.push_devices.length ?? '—'}</div>
                                <div className="ius-metric__l">Devices</div>
                            </article>

                            <article className={`ius-glass ius-tile ius-tile--health${diagnostics?.problems.length ? ' ius-tile--warn' : ''}`}>
                                {diagError || unreadError ? (
                                    <p className="ius-err">{diagError || unreadError}</p>
                                ) : diagnostics?.problems.length ? (
                                    <>
                                        <h3>Problems</h3>
                                        <ul>
                                            {diagnostics.problems.slice(0, 3).map(p => <li key={p}>{p}</li>)}
                                        </ul>
                                    </>
                                ) : (
                                    <>
                                        <h3>Healthy</h3>
                                        <p>No notification problems</p>
                                        <p className="ius-quiet">
                                            Seen {formatWhen(diagnostics?.last_seen || '')}
                                            {diagnostics?.critical_alert_sound?.key
                                                ? ` · ${diagnostics.critical_alert_sound.key}`
                                                : ''}
                                        </p>
                                    </>
                                )}
                            </article>

                            <article className="ius-glass ius-tile ius-tile--list">
                                <h3>Devices <em>{diagnostics?.push_devices.length || 0}</em></h3>
                                {topDevices.length === 0 ? (
                                    <p className="ius-quiet">None</p>
                                ) : (
                                    <ul>
                                        {topDevices.map((d, i) => (
                                            <li key={`${d.token_prefix}-${i}`}>
                                                <strong>{(d.kind || 'device').toUpperCase()}</strong>
                                                <span>{d.platform || '—'} · {formatWhen(d.updated_at)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </article>

                            <article className="ius-glass ius-tile ius-tile--list">
                                <h3>Installs <em>{diagnostics?.app_installs.length || 0}</em></h3>
                                {topInstalls.length === 0 ? (
                                    <p className="ius-quiet">None</p>
                                ) : (
                                    <ul>
                                        {topInstalls.map((inst, i) => (
                                            <li key={`${inst.platform}-${inst.build}-${i}`}>
                                                <strong>{inst.platform || 'App'}{inst.app_version ? ` v${inst.app_version}` : ''}</strong>
                                                <span>{inst.os || '—'} · {formatWhen(inst.last_seen_at)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </article>

                            <article className="ius-glass ius-tile ius-tile--threads">
                                <h3>Unread threads <em>{unread?.threads.length || 0}</em></h3>
                                {topThreads.length === 0 ? (
                                    <p className="ius-quiet">None</p>
                                ) : (
                                    <ul>
                                        {topThreads.map(t => (
                                            <li key={t.conversation_id}>
                                                <div>
                                                    <strong>{t.subject || 'Untitled'}</strong>
                                                    <span>{t.kind}</span>
                                                </div>
                                                <b>{t.unread_count}</b>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </article>
                        </div>
                    )}
                </div>
            </InternalAdminShell>
        </>
    );
}
