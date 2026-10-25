'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ComboboxOption = { label: string; value: string };

type Props = {
    value: string;
    onChange: (value: string) => void;
    options: ComboboxOption[];
    placeholder?: string;
    disabled?: boolean;
    /** Let the user type a value that isn't in the list. */
    creatable?: boolean;
    /** Used in "Search or add a {noun}". */
    noun?: string;
    allowClear?: boolean;
    clearLabel?: string;
    maxListHeight?: number;
    className?: string;
};

/** Marks the portalled panel so dialogs can treat clicks inside it as "inside". */
export const COMBOBOX_PANEL_ATTR = 'data-custom-select-panel';

export function Combobox({
    value,
    onChange,
    options,
    placeholder = 'Choose an option',
    disabled = false,
    creatable = false,
    noun = 'option',
    allowClear = false,
    clearLabel = 'None',
    maxListHeight = 260,
    className,
}: Props) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const [active, setActive] = React.useState(0);
    const [pos, setPos] = React.useState({ top: 0, left: 0, width: 0, flipUp: false });
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const panelRef = React.useRef<HTMLDivElement>(null);
    const listRef = React.useRef<HTMLDivElement>(null);
    const listId = React.useId();

    const selected = options.find(option => option.value === value);
    const trimmed = query.trim();
    const needle = trimmed.toLowerCase();
    const filtered = needle
        ? options.filter(option => option.label.toLowerCase().includes(needle))
        : options;
    const exactMatch = options.some(option => (
        option.label.trim().toLowerCase() === needle || option.value.trim().toLowerCase() === needle
    ));
    const showCreate = creatable && !!trimmed && !exactMatch;
    const showSearch = creatable || options.length > 6;
    const showClear = allowClear && !!value && !trimmed;
    const itemCount = filtered.length + (showCreate ? 1 : 0);

    const close = React.useCallback((refocus = false) => {
        setOpen(false);
        setQuery('');
        if (refocus) triggerRef.current?.focus();
    }, []);

    const place = React.useCallback(() => {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const width = Math.max(rect.width, 220);
        const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
        const estimated = maxListHeight + (showSearch ? 52 : 12);
        const flipUp = rect.bottom + 6 + estimated > window.innerHeight - 8 && rect.top > estimated;
        setPos({ top: flipUp ? rect.top - 6 : rect.bottom + 6, left, width, flipUp });
    }, [maxListHeight, showSearch]);

    React.useEffect(() => {
        if (!open) return;
        place();
        const onPointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
            close();
        };
        document.addEventListener('mousedown', onPointerDown);
        window.addEventListener('scroll', place, true);
        window.addEventListener('resize', place);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            window.removeEventListener('scroll', place, true);
            window.removeEventListener('resize', place);
        };
    }, [open, place, close]);

    React.useEffect(() => {
        if (!open) return;
        const index = filtered.findIndex(option => option.value === value);
        setActive(index >= 0 && !trimmed ? index : 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, trimmed]);

    React.useEffect(() => {
        listRef.current
            ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
            ?.scrollIntoView({ block: 'nearest' });
    }, [active]);

    const pick = (next: string) => {
        onChange(next);
        close(true);
    };

    const commit = (index: number) => {
        if (index < filtered.length) pick(filtered[index].value);
        else if (showCreate) pick(trimmed);
    };

    const onKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive(current => (itemCount ? (current + 1) % itemCount : 0));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive(current => (itemCount ? (current - 1 + itemCount) % itemCount : 0));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (itemCount) commit(Math.min(active, itemCount - 1));
        } else if (event.key === 'Escape') {
            event.preventDefault();
            close(true);
        } else if (event.key === 'Tab') {
            close();
        }
    };

    const panel = open && typeof document !== 'undefined' ? createPortal(
        <div
            ref={panelRef}
            {...{ [COMBOBOX_PANEL_ATTR]: '' }}
            onKeyDown={onKeyDown}
            className="fixed z-[99999] overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.16)]"
            style={{
                top: pos.top,
                left: pos.left,
                width: pos.width,
                transform: pos.flipUp ? 'translateY(-100%)' : undefined,
            }}
        >
            {showSearch && (
                <div className="flex h-11 items-center gap-2 border-b border-[#EEF2F7] px-3">
                    <Search className="h-4 w-4 shrink-0 text-[#94A3B8]" strokeWidth={2} />
                    <input
                        autoFocus
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder={creatable ? `Search or add a ${noun}` : 'Search'}
                        aria-controls={listId}
                        aria-label={creatable ? `Search or add a ${noun}` : 'Search'}
                        className="h-full w-full bg-transparent text-[13px] text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
                    />
                </div>
            )}
            <div
                ref={listRef}
                id={listId}
                role="listbox"
                tabIndex={showSearch ? -1 : 0}
                className="overflow-y-auto p-1 outline-none"
                style={{ maxHeight: maxListHeight }}
            >
                {showClear && (
                    <button
                        type="button"
                        onClick={() => pick('')}
                        className="flex h-9 w-full items-center rounded-md px-2.5 text-left text-[13px] text-[#64748B] hover:bg-[#F1F5F9]"
                    >
                        {clearLabel}
                    </button>
                )}
                {filtered.map((option, index) => {
                    const isSelected = option.value === value;
                    return (
                        <button
                            key={option.value || option.label}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            data-index={index}
                            onMouseEnter={() => setActive(index)}
                            onClick={() => pick(option.value)}
                            className={cn(
                                'flex min-h-9 w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-[13px] text-[#0F172A]',
                                active === index && 'bg-[#F1F5F9]',
                                isSelected && 'font-medium',
                            )}
                        >
                            <span className="min-w-0 truncate">{option.label}</span>
                            {isSelected ? <Check className="h-4 w-4 shrink-0 text-[#1D6FB8]" strokeWidth={2.2} /> : null}
                        </button>
                    );
                })}
                {!filtered.length && !showCreate && (
                    <div className="px-3 py-6 text-center text-[12.5px] text-[#64748B]">
                        {trimmed ? 'No matches.' : 'Nothing to choose yet.'}
                        {creatable ? <div className="mt-0.5 text-[#94A3B8]">Type a name to add one.</div> : null}
                    </div>
                )}
                {showCreate && (
                    <>
                        {filtered.length ? <div className="my-1 h-px bg-[#EEF2F7]" /> : null}
                        <button
                            type="button"
                            data-index={filtered.length}
                            onMouseEnter={() => setActive(filtered.length)}
                            onClick={() => pick(trimmed)}
                            className={cn(
                                'flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-[#1D6FB8]',
                                active === filtered.length && 'bg-[#EEF5FC]',
                            )}
                        >
                            <Plus className="h-4 w-4 shrink-0" strokeWidth={2.2} />
                            <span className="min-w-0 truncate">
                                Add <span className="font-semibold">&ldquo;{trimmed}&rdquo;</span>
                            </span>
                        </button>
                    </>
                )}
            </div>
        </div>,
        document.body,
    ) : null;

    return (
        <div className={cn('relative w-full min-w-0', className)}>
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => (open ? close() : setOpen(true))}
                onKeyDown={event => {
                    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault();
                        setOpen(true);
                    }
                }}
                className={cn(
                    'flex h-10 w-full items-center gap-2 rounded-lg border border-[#E1E7EF] bg-white px-3 text-left text-[13px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors',
                    'hover:border-[#CBD5E1] focus-visible:outline-none focus-visible:border-[#1e3a5f] focus-visible:ring-2 focus-visible:ring-[#1e3a5f]/15',
                    'disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:hover:border-[#E1E7EF]',
                    open && 'border-[#1e3a5f] ring-2 ring-[#1e3a5f]/15',
                )}
            >
                <span className={cn(
                    'min-w-0 flex-1 truncate',
                    selected || value ? 'text-[#0F172A]' : 'text-[#94A3B8]',
                )}>
                    {selected?.label || value || placeholder}
                </span>
                {allowClear && value && !disabled ? (
                    <span
                        role="button"
                        tabIndex={-1}
                        aria-label="Clear"
                        onClick={event => {
                            event.stopPropagation();
                            onChange('');
                        }}
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569]"
                    >
                        <X className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                ) : null}
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-[#94A3B8]" strokeWidth={2} />
            </button>
            {panel}
        </div>
    );
}
