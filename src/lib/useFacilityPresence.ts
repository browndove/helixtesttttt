'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_ENDPOINTS } from '@/lib/config';
import { isClientInternalSupportMode, resolveClientFacilityId } from '@/lib/facility-client';
import { fetchFacilityPresenceOnline } from '@/lib/presence-online';
import { applyPresenceUserToggle, onlineSetFromPresenceSnapshot } from '@/lib/presence-store';

const RECONNECT_MS = 5_000;

type WsEnvelope = {
    type?: string;
    data?: unknown;
};

function handlePresenceWebSocketMessage(
    msg: WsEnvelope,
    setOnlineIdSet: React.Dispatch<React.SetStateAction<Set<string>>>,
): void {
    const type = String(msg.type || '').trim();
    const data = msg.data;

    switch (type) {
        case 'presence_online_users':
            setOnlineIdSet(onlineSetFromPresenceSnapshot(data));
            return;
        case 'presence':
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                setOnlineIdSet(prev => applyPresenceUserToggle(prev, data as Record<string, unknown>));
            }
            return;
        default:
            return;
    }
}

/**
 * REST bootstrap + WebSocket realtime updates for facility user presence.
 * Uses GET /presence/online then /api/v1/ws with presence_online_users / presence events.
 */
export function useFacilityPresence(options?: { enabled?: boolean }) {
    const enabled = options?.enabled !== false;
    const [onlineIdSet, setOnlineIdSet] = useState<Set<string>>(() => new Set());
    const [wsConnected, setWsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cancelledRef = useRef(false);

    const clearReconnect = useCallback(() => {
        if (reconnectRef.current) {
            clearTimeout(reconnectRef.current);
            reconnectRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!enabled) {
            setWsConnected(false);
            return;
        }

        cancelledRef.current = false;

        const scheduleReconnect = () => {
            if (cancelledRef.current) return;
            clearReconnect();
            reconnectRef.current = setTimeout(() => {
                void connect();
            }, RECONNECT_MS);
        };

        const connect = async () => {
            if (cancelledRef.current) return;

            const rest = await fetchFacilityPresenceOnline();
            if (!cancelledRef.current && rest.ok) {
                setOnlineIdSet(onlineSetFromPresenceSnapshot({ users: rest.items }));
            }

            try {
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
                    scheduleReconnect();
                    return;
                }

                const body = (await wsUrlRes.json()) as { url?: string };
                const url = String(body.url || '').trim();
                if (!url || cancelledRef.current) {
                    scheduleReconnect();
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
                        handlePresenceWebSocketMessage(parsed, setOnlineIdSet);
                    } catch {
                        /* ignore malformed frames */
                    }
                };

                ws.onerror = () => {
                    ws.close();
                };

                ws.onclose = () => {
                    if (!cancelledRef.current) {
                        setWsConnected(false);
                        scheduleReconnect();
                    }
                };
            } catch {
                scheduleReconnect();
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
    }, [enabled, clearReconnect]);

    return { onlineIdSet, wsConnected };
}
