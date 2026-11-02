'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Pause, Play, Volume2 } from 'lucide-react';
import { API_ENDPOINTS } from '@/lib/config';
import {
    parseCriticalAlertSoundOptions,
    type CriticalAlertSoundOption,
} from '@/lib/critical-alert-sound';
import { cn } from '@/lib/utils';

type Props = {
    facilityId: string;
    value: string;
    disabled?: boolean;
    onChange: (next: string) => void;
    onNotify?: (message: string, variant?: 'success' | 'error' | 'info') => void;
};

const CARD_SHADOW = 'inset 0 1px 0 rgba(255,255,255,0.95), 0 1px 2px rgba(15,23,42,0.05), 0 12px 28px -14px rgba(15,23,42,0.16)';
const CARD_SHADOW_SELECTED = 'inset 0 1px 0 #fff, 0 2px 4px rgba(15,23,42,0.05), 0 18px 36px -14px rgba(30,58,95,0.28), 0 32px 56px -28px rgba(30,58,95,0.22)';
const PLAY_SHADOW = 'inset 0 1px 0 rgba(255,255,255,0.85), 0 1px 2px rgba(15,23,42,0.08), 0 8px 16px -8px rgba(15,23,42,0.2)';

function WaveBars({ active }: { active: boolean }) {
    return (
        <span aria-hidden className="inline-flex h-4 items-end gap-[3px]">
            {[0, 1, 2, 3, 4].map(i => (
                <span
                    key={i}
                    className={cn(
                        'w-[3px] rounded-full bg-current origin-bottom',
                        active ? 'animate-pulse' : 'opacity-45',
                    )}
                    style={{
                        height: active ? `${10 + ((i * 7) % 10)}px` : `${6 + (i % 3) * 3}px`,
                        animationDelay: active ? `${i * 90}ms` : undefined,
                        animationDuration: active ? `${700 + i * 80}ms` : undefined,
                    }}
                />
            ))}
        </span>
    );
}

export default function CriticalAlertSoundPicker({
    facilityId,
    value,
    disabled,
    onChange,
    onNotify,
}: Props) {
    const [options, setOptions] = useState<CriticalAlertSoundOption[]>([]);
    const [loading, setLoading] = useState(true);
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
        void (async () => {
            try {
                const res = await fetch(API_ENDPOINTS.FACILITY_CRITICAL_ALERT_SOUNDS, {
                    credentials: 'include',
                    cache: 'no-store',
                });
                const raw = res.ok ? await res.json().catch(() => null) : null;
                if (!cancelled) setOptions(parseCriticalAlertSoundOptions(raw));
            } catch {
                if (!cancelled) setOptions(parseCriticalAlertSoundOptions(null));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const playPreview = async (option: CriticalAlertSoundOption) => {
        if (!option.previewUrl) {
            onNotify?.('Classic uses the tone already bundled in the mobile app — no web preview.', 'info');
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
            const res = await fetch(API_ENDPOINTS.FACILITY_CRITICAL_ALERT_SOUND(facilityId), {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ critical_alert_sound: key }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                onNotify?.(String((data as { message?: string; error?: string; detail?: string }).message
                    || (data as { error?: string }).error
                    || (data as { detail?: string }).detail
                    || 'Failed to update alert sound'), 'error');
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
            <div className="grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map(key => (
                    <div
                        key={key}
                        className="h-[148px] animate-pulse rounded-2xl bg-slate-100/80"
                        style={{ boxShadow: CARD_SHADOW }}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Critical alert sound">
            {options.map(option => {
                const selected = value === option.key;
                const playing = playingKey === option.key;
                const saving = savingKey === option.key;
                return (
                    <div
                        key={option.key}
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
                            'relative flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl bg-white transition-all duration-300 ease-out outline-none',
                            selected ? '-translate-y-1 ring-2 ring-[#1E3A5F]/35' : 'ring-1 ring-slate-900/6 hover:-translate-y-0.5',
                            (disabled || savingKey) && 'pointer-events-none opacity-70',
                        )}
                        style={{ boxShadow: selected ? CARD_SHADOW_SELECTED : CARD_SHADOW }}
                    >
                        <div className="flex flex-1 flex-col px-4 pb-3.5 pt-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span
                                            aria-hidden
                                            className={cn(
                                                'flex h-8 w-8 items-center justify-center rounded-xl ring-1',
                                                selected
                                                    ? 'bg-[#EAF0F7] text-[#1E3A5F] ring-[#1E3A5F]/15'
                                                    : 'bg-slate-50 text-slate-500 ring-slate-900/5',
                                            )}
                                            style={{ boxShadow: PLAY_SHADOW }}
                                        >
                                            <Volume2 className="h-4 w-4" strokeWidth={2} />
                                        </span>
                                        <div className="min-w-0">
                                            <div className="truncate text-[14px] font-semibold tracking-tight text-slate-900">
                                                {option.label}
                                            </div>
                                            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                                                {option.key}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {selected ? (
                                    <span
                                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1E3A5F] text-white"
                                        style={{ boxShadow: '0 1px 2px rgba(30,58,95,0.35), 0 6px 14px -6px rgba(30,58,95,0.45)' }}
                                    >
                                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                                    </span>
                                ) : null}
                            </div>

                            <p className="mt-3 text-[12.5px] leading-5 text-slate-500">
                                {option.blurb}
                            </p>

                            <div className="mt-4 flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    disabled={disabled || (!option.previewUrl && option.key === 'classic')}
                                    onClick={e => {
                                        e.stopPropagation();
                                        void playPreview(option);
                                    }}
                                    className={cn(
                                        'inline-flex h-9 items-center gap-2 rounded-xl px-3 text-[12.5px] font-semibold transition',
                                        playing
                                            ? 'bg-[#1E3A5F] text-white'
                                            : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:text-slate-900',
                                        !option.previewUrl && 'opacity-60',
                                    )}
                                    style={{ boxShadow: playing ? '0 1px 2px rgba(30,58,95,0.3), 0 10px 20px -10px rgba(30,58,95,0.55)' : PLAY_SHADOW }}
                                    aria-label={playing ? `Stop ${option.label} preview` : `Preview ${option.label}`}
                                >
                                    {playing ? <Pause className="h-3.5 w-3.5" strokeWidth={2.25} /> : <Play className="h-3.5 w-3.5" strokeWidth={2.25} />}
                                    {playing ? 'Stop' : 'Preview'}
                                </button>
                                <span className={cn('text-slate-400', playing && 'text-[#1E3A5F]')}>
                                    <WaveBars active={playing} />
                                </span>
                            </div>

                            {saving ? (
                                <div className="mt-3 text-[11.5px] font-medium text-slate-500">Saving…</div>
                            ) : selected ? (
                                <div className="mt-3 text-[11.5px] font-semibold text-[#1E3A5F]">Active for this facility</div>
                            ) : (
                                <div className="mt-3 text-[11.5px] font-medium text-slate-400">Tap card to select</div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
