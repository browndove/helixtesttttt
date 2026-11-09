'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Pause, Play, Search, Volume2 } from 'lucide-react';
import { API_ENDPOINTS } from '@/lib/config';
import {
    isDefaultCriticalAlertSound,
    parseCriticalAlertSoundOptions,
    type CriticalAlertSoundOption,
} from '@/lib/critical-alert-sound';
import { appendFacilityIdForProxy } from '@/lib/facility-client';
import { cn } from '@/lib/utils';

type Props = {
    facilityId: string;
    value: string;
    disabled?: boolean;
    onChange: (next: string) => void;
    onNotify?: (message: string, variant?: 'success' | 'error' | 'info') => void;
};

const ROW =
    'flex items-center gap-3 rounded-xl bg-white px-3.5 py-3 ring-1 transition outline-none';

export default function CriticalAlertSoundPicker({
    facilityId,
    value,
    disabled,
    onChange,
    onNotify,
}: Props) {
    const [options, setOptions] = useState<CriticalAlertSoundOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [query, setQuery] = useState('');
    const [savingKey, setSavingKey] = useState('');
    const [playingKey, setPlayingKey] = useState('');
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const stopPreview = useCallback(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
        audioRef.current = null;
        setPlayingKey('');
    }, []);

    useEffect(() => () => stopPreview(), [stopPreview]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setLoadError('');
        void (async () => {
            try {
                const res = await fetch(API_ENDPOINTS.FACILITY_CRITICAL_ALERT_SOUNDS, {
                    credentials: 'include',
                    cache: 'no-store',
                });
                const raw = res.ok ? await res.json().catch(() => null) : null;
                if (cancelled) return;
                if (!res.ok) {
                    setOptions([]);
                    setLoadError('Could not load alert sounds.');
                    return;
                }
                setOptions(parseCriticalAlertSoundOptions(raw));
            } catch {
                if (!cancelled) {
                    setOptions([]);
                    setLoadError('Could not load alert sounds.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter(option => (
            option.label.toLowerCase().includes(q)
            || option.key.toLowerCase().includes(q)
            || (option.blurb || '').toLowerCase().includes(q)
        ));
    }, [options, query]);

    const usingDefault = isDefaultCriticalAlertSound(value, options);
    const selectedOption = usingDefault ? null : (options.find(option => option.key === value) || null);
    const showSearch = options.length > 6;

    const playPreview = async (option: CriticalAlertSoundOption) => {
        if (!option.previewUrl) {
            onNotify?.('No web preview for this tone — it plays in the mobile app.', 'info');
            return;
        }
        if (playingKey === option.key) {
            stopPreview();
            return;
        }
        stopPreview();
        try {
            const audio = new Audio(option.previewUrl);
            audioRef.current = audio;
            setPlayingKey(option.key);
            audio.onended = () => {
                if (audioRef.current === audio) {
                    audioRef.current = null;
                    setPlayingKey('');
                }
            };
            audio.onerror = () => {
                stopPreview();
                onNotify?.('Could not play that preview.', 'error');
            };
            await audio.play();
        } catch {
            stopPreview();
            onNotify?.('Could not play that preview.', 'error');
        }
    };

    const selectSound = async (key: string) => {
        if (!facilityId || disabled || savingKey || key === value) return;
        setSavingKey(key);
        stopPreview();
        try {
            const res = await fetch(
                await appendFacilityIdForProxy(API_ENDPOINTS.FACILITY_CRITICAL_ALERT_SOUND(facilityId)),
                {
                    method: 'PUT',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ critical_alert_sound: key }),
                },
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = String((data as { message?: string; error?: string; detail?: string }).message
                    || (data as { error?: string }).error
                    || (data as { detail?: string }).detail
                    || 'Failed to update alert sound');
                onNotify?.(
                    res.status === 403
                        ? (msg.toLowerCase().includes('access') ? msg : 'You do not have access to this facility')
                        : msg,
                    'error',
                );
                return;
            }
            onChange(key);
            const label = options.find(item => item.key === key)?.label || key;
            onNotify?.(`Critical alert sound set to ${label}`, 'success');
        } catch {
            onNotify?.('Failed to update alert sound', 'error');
        } finally {
            setSavingKey('');
        }
    };

    if (loading) {
        return (
            <div className="grid gap-2">
                {[0, 1, 2, 3].map(key => (
                    <div key={key} className="h-16 animate-pulse rounded-xl bg-slate-100/80" />
                ))}
            </div>
        );
    }

    return (
        <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#EFF4FA] px-3.5 py-2.5 ring-1 ring-[#D7E0EC]">
                <div className="min-w-0 text-[12.5px] text-[#1E3A5F]">
                    <span className="font-semibold">Active:</span>{' '}
                    <span className="font-medium">
                        {selectedOption ? selectedOption.label : 'Default alarm'}
                    </span>
                    {usingDefault ? (
                        <span className="ml-2 text-[11.5px] font-normal text-[#1E3A5F]/70">
                            (no custom sound chosen)
                        </span>
                    ) : null}
                </div>
                <span className="text-[11.5px] text-[#1E3A5F]/80">Code blue keeps its own sound</span>
            </div>

            {loadError ? (
                <p className="text-[12.5px] text-rose-700">{loadError}</p>
            ) : null}

            {showSearch ? (
                <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search sounds…"
                        aria-label="Search alert sounds"
                        className="h-9 w-full rounded-lg bg-white pl-9 pr-3 text-[13px] text-slate-800 ring-1 ring-slate-200 outline-none placeholder:text-slate-400 focus:ring-[#1E3A5F]/40"
                    />
                </label>
            ) : null}

            <div
                role="radiogroup"
                aria-label="Critical alert sound"
                className="max-h-96 overflow-y-auto rounded-2xl ring-1 ring-slate-200/90"
            >
                <ul className="divide-y divide-slate-100">
                    {filtered.length === 0 ? (
                        <li className="px-4 py-8 text-center text-[13px] text-slate-500">
                            {query.trim()
                                ? `No sounds match “${query.trim()}”.`
                                : 'No alert sounds available from the server.'}
                        </li>
                    ) : filtered.map(option => {
                        const selected = !usingDefault && value === option.key;
                        const playing = playingKey === option.key;
                        const saving = savingKey === option.key;
                        return (
                            <li key={option.key}>
                                <div
                                    role="radio"
                                    aria-checked={selected}
                                    tabIndex={disabled ? -1 : 0}
                                    onClick={() => void selectSound(option.key)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            void selectSound(option.key);
                                        }
                                    }}
                                    className={cn(
                                        ROW,
                                        selected
                                            ? 'bg-[#F4F7FB] ring-[#1E3A5F]/20'
                                            : 'ring-transparent hover:bg-slate-50/80',
                                        (disabled || Boolean(savingKey)) && 'pointer-events-none opacity-70',
                                    )}
                                >
                                    <span
                                        aria-hidden
                                        className={cn(
                                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1',
                                            selected
                                                ? 'bg-[#EAF0F7] text-[#1E3A5F] ring-[#1E3A5F]/15'
                                                : 'bg-slate-50 text-slate-500 ring-slate-900/5',
                                        )}
                                    >
                                        <Volume2 className="h-4 w-4" strokeWidth={2} />
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="truncate text-[13.5px] font-semibold text-slate-900">
                                                {option.label}
                                            </div>
                                            {selected ? (
                                                <span className="rounded-full bg-[#1E3A5F] px-2 py-0.5 text-[10.5px] font-semibold text-white">
                                                    Active
                                                </span>
                                            ) : null}
                                            {saving ? (
                                                <span className="text-[11px] font-medium text-slate-500">Saving…</span>
                                            ) : null}
                                        </div>
                                        {option.blurb ? (
                                            <p className="mt-0.5 line-clamp-1 text-[12px] text-slate-500">
                                                {option.blurb}
                                            </p>
                                        ) : null}
                                    </div>

                                    <button
                                        type="button"
                                        disabled={disabled || !option.previewUrl}
                                        onClick={e => {
                                            e.stopPropagation();
                                            void playPreview(option);
                                        }}
                                        className={cn(
                                            'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold transition',
                                            playing
                                                ? 'bg-[#1E3A5F] text-white'
                                                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:text-slate-900',
                                            !option.previewUrl && 'opacity-50',
                                        )}
                                        aria-label={playing ? `Stop ${option.label} preview` : `Preview ${option.label}`}
                                        title={option.previewUrl ? undefined : 'No web preview'}
                                    >
                                        {playing
                                            ? <Pause className="h-3.5 w-3.5" strokeWidth={2.25} />
                                            : <Play className="h-3.5 w-3.5" strokeWidth={2.25} />}
                                        {playing ? 'Stop' : 'Preview'}
                                    </button>

                                    <span
                                        aria-hidden
                                        className={cn(
                                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                                            selected
                                                ? 'bg-[#1E3A5F] text-white'
                                                : 'ring-1 ring-slate-300 text-transparent',
                                        )}
                                    >
                                        <Check className="h-3 w-3" strokeWidth={2.5} />
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <p className="text-[12px] leading-5 text-slate-500">
                Phones play the new alarm after the Helix app is updated.
            </p>
        </div>
    );
}
