'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_ENDPOINTS } from '@/lib/config';
import { fetchAllStaffPayload } from '@/lib/fetch-all-staff';
import { isClientInternalSupportMode, resolveClientFacilityId } from '@/lib/facility-client';
import { fetchFacilityPresenceOnline, presenceListFromPayload } from '@/lib/presence-online';
import {
    applyPresenceEventToRoster,
    buildRecentTeamPresence,
    parsePresenceRosterToTeamPresence,
    type TeamPresenceMember,
} from '@/lib/team-presence';

const RECONNECT_MS = 5_000;

type WsEnvelope = { type?: string; data?: unknown };

function getList(raw: unknown, keys: string[]): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== 'object') return [];
    const rec = raw as Record<string, unknown>;
    for (const k of keys) {
        const v = rec[k];
        if (Array.isArray(v)) return v;
    }
    return [];
}

function publishRoster(
    staffItems: unknown[],
    rosterRecords: Record<string, unknown>[],
    max: number,
): TeamPresenceMember[] {
    const rosterUsers = presenceListFromPayload({ users: rosterRecords });
    if (rosterUsers.length > 0) {
        const fromRoster = parsePresenceRosterToTeamPresence({ users: rosterRecords }, max);
        if (fromRoster.length > 0) return fromRoster;
    }
    return buildRecentTeamPresence(staffItems, rosterRecords, max);
}

/**
 * Recent team presence for home overview: REST bootstrap + WebSocket roster updates.
 * Always returns up to `max` members sorted by last activity (online or offline).
 */
export function useTeamPresenceRoster(options?: { max?: number; enabled?: boolean }) {
    const max = options?.max ?? 10;
    const enabled = options?.enabled !== false;
    const [members, setMembers] = useState<TeamPresenceMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [wsConnected, setWsConnected] = useState(false);

    const staffRef = useRef<unknown[]>([]);
    const rosterRef = useRef<Record<string, unknown>[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cancelledRef = useRef(false);

    const publish = useCallback(() => {
        setMembers(publishRoster(staffRef.current, rosterRef.current, max));
    }, [max]);

    const clearReconnect = useCallback(() => {
        if (reconnectRef.current) {
            clearTimeout(reconnectRef.current);
            reconnectRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!enabled) {
            setLoading(false);
            setWsConnected(false);
            return;
        }

        cancelledRef.current = false;
        setLoading(true);

        const scheduleReconnect = (connect: () => Promise<void>) => {
            if (cancelledRef.current) return;
            clearReconnect();
            reconnectRef.current = setTimeout(() => {
                void connect();
            }, RECONNECT_MS);
        };

        const connect = async () => {
            if (cancelledRef.current) return;

            try {
                const staffBundle = await fetchAllStaffPayload({ credentials: 'include' });
                if (staffBundle.ok && staffBundle.data) {
                    staffRef.current = getList(staffBundle.data, ['items', 'data', 'staff']);
                }

                const rest = await fetchFacilityPresenceOnline();
                if (rest.ok) {
                    rosterRef.current = rest.items.map((u) => ({ ...u } as Record<string, unknown>));
                }

                if (!cancelledRef.current) {
                    publish();
                    setLoading(false);
                }

                const wsParams = new URLSearchParams({ client: 'admin' });
                if (await isClientInternalSupportMode()) {
                    const fid = await resolveClientFacilityId();
                    if (fid) wsParams.set('facility_id', fid);
                }

                const wsUrlRes = await fetch(
                    `${API_ENDPOINTS.PRESENCE_WS_URL}?${wsParams.toString()}`,
                    { credentials: 'include' },
                );
                if (!wsUrlRes.ok || cancelledRef.current) {
                    scheduleReconnect(connect);
                    return;
                }

                const body = (await wsUrlRes.json()) as { url?: string };
                const url = String(body.url || '').trim();
                if (!url || cancelledRef.current) {
                    scheduleReconnect(connect);
                    return;
                }

                wsRef.current?.close();
                const ws = new WebSocket(url);
                wsRef.current = ws;

                ws.onopen = () => {
                    if (!cancelledRef.current) setWsConnected(true);
                };

                ws.onmessage = (ev) => {
                    try {
                        const parsed = JSON.parse(String(ev.data)) as WsEnvelope;
                        const type = String(parsed.type || '').trim();
                        const data = parsed.data;

                        if (type === 'presence_online_users' && data) {
                            rosterRef.current = presenceListFromPayload(data).filter(
                                (item): item is Record<string, unknown> =>
                                    Boolean(item) && typeof item === 'object' && !Array.isArray(item),
                            );
                            publish();
                            return;
                        }

                        if (type === 'presence' && data && typeof data === 'object' && !Array.isArray(data)) {
                            rosterRef.current = applyPresenceEventToRoster(
                                rosterRef.current,
                                data as Record<string, unknown>,
                            );
                            publish();
                        }
                    } catch {
                        /* ignore */
                    }
                };

                ws.onerror = () => ws.close();

                ws.onclose = () => {
                    if (!cancelledRef.current) {
                        setWsConnected(false);
                        scheduleReconnect(connect);
                    }
                };
            } catch {
                if (!cancelledRef.current) {
                    setLoading(false);
                    scheduleReconnect(connect);
                }
            }
        };

        void connect();

        return () => {
            cancelledRef.current = true;
            clearReconnect();
            setWsConnected(false);
            wsRef.current?.close();
            wsRef.current = null;
        };
    }, [enabled, max, publish, clearReconnect]);

    const onlineCount = members.filter((m) => m.status === 'online').length;

    return { members, onlineCount, loading, wsConnected };
}
