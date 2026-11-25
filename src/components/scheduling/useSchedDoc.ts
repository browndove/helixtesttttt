'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText, schedFetch } from '@/lib/scheduling-api';

/**
 * Load a scheduling settings document, keep an editable draft, and save it back.
 * `key` (e.g. the department id) reloads the document when it changes.
 */
export function useSchedDoc<T>({ path, query, key, normalize, enabled = true }: {
    path: string;
    query?: Record<string, string>;
    key: string;
    normalize: (raw: unknown) => T;
    enabled?: boolean;
}) {
    const [saved, setSaved] = useState<T | null>(null);
    const [draft, setDraft] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const normalizeRef = useRef(normalize);
    useEffect(() => { normalizeRef.current = normalize; }, [normalize]);
    const queryRef = useRef(query);
    useEffect(() => { queryRef.current = query; }, [query]);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const doc = normalizeRef.current(await schedFetch<unknown>(path, { query: queryRef.current }));
            setSaved(doc);
            setDraft(doc);
        } catch (err) {
            setError(errorText(err));
        } finally {
            setLoading(false);
        }
    }, [path]);

    useEffect(() => {
        if (!enabled) return;
        let alive = true;
        void (async () => {
            if (alive) await load();
        })();
        return () => { alive = false; };
    }, [load, key, enabled]);

    /** PUTs `body` (defaults to the draft) and adopts the server's reply. Throws on failure. */
    const save = useCallback(async (body?: unknown, opts?: { query?: Record<string, string> }) => {
        setSaving(true);
        try {
            const reply = await schedFetch<unknown>(path, { method: 'PUT', query: opts?.query, body: body ?? draft });
            const doc = reply ? normalizeRef.current(reply) : (draft as T);
            setSaved(doc);
            setDraft(doc);
            return doc;
        } finally {
            setSaving(false);
        }
    }, [path, draft]);

    return { saved, draft, setDraft, loading, error, saving, reload: load, save, discard: () => setDraft(saved) };
}
