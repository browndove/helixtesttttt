'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export type Notify = (message: string, variant?: 'success' | 'error' | 'info') => void;

export function Icon({ name, size, className }: { name: string; size?: number; className?: string }) {
    return (
        <span className={`material-icons-round${className ? ` ${className}` : ''}`} aria-hidden style={size ? { fontSize: size } : undefined}>
            {name}
        </span>
    );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
    return (
        <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className="st-switch" />
    );
}

export function Card({ icon, title, sub, actions, children, className }: {
    icon: string;
    title: ReactNode;
    sub?: ReactNode;
    actions?: ReactNode;
    children?: ReactNode;
    className?: string;
}) {
    return (
        <section className={`st-card sc-card gx-reveal${className ? ` ${className}` : ''}`}>
            <div className="st-card__head">
                <div className="st-card__id">
                    <span className="gx-ico"><Icon name={icon} /></span>
                    <div className="min-w-0">
                        <h3 className="st-card__title">{title}</h3>
                        {sub ? <p className="st-card__sub">{sub}</p> : null}
                    </div>
                </div>
                {actions ? <div className="sc-card__actions">{actions}</div> : null}
            </div>
            {children}
        </section>
    );
}

/** A labelled setting row: text on the left, control on the right. */
export function Row({ label, desc, children, stack }: { label: ReactNode; desc?: ReactNode; children: ReactNode; stack?: boolean }) {
    return (
        <div className={`sc-row${stack ? ' sc-row--stack' : ''}`}>
            <div className="sc-row__text">
                <div className="sc-row__label">{label}</div>
                {desc ? <div className="sc-row__desc">{desc}</div> : null}
            </div>
            <div className="sc-row__control">{children}</div>
        </div>
    );
}

export function NumberInput({ value, onChange, min = 0, max, step = 1, suffix, width = 96, label, disabled }: {
    value: number | null | undefined;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
    width?: number;
    label: string;
    disabled?: boolean;
}) {
    return (
        <span className="sc-num" style={{ width }}>
            <input
                type="number"
                className="st-input"
                aria-label={label}
                value={value ?? ''}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
                onChange={e => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
            />
            {suffix ? <span className="sc-num__suffix">{suffix}</span> : null}
        </span>
    );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
    value: T;
    options: Array<{ value: T; label: string }>;
    onChange: (v: T) => void;
    label: string;
}) {
    return (
        <div className="sc-seg" role="radiogroup" aria-label={label}>
            {options.map(o => (
                <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? 'is-on' : ''} onClick={() => onChange(o.value)}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export function Bones({ rows = 3 }: { rows?: number }) {
    return (
        <div className="sc-bones" aria-hidden>
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="sc-bones__row">
                    <span className="st-bone" style={{ width: 36, height: 36, borderRadius: 12 }} />
                    <span className="st-bone" style={{ height: 12, width: `${55 - i * 8}%` }} />
                </div>
            ))}
        </div>
    );
}

export function Empty({ icon, title, text, children, bad }: { icon: string; title: string; text?: ReactNode; children?: ReactNode; bad?: boolean }) {
    return (
        <div className="st-empty sc-empty">
            <div className={`st-empty__art${bad ? ' st-empty__art--bad' : ''}`}><Icon name={icon} /></div>
            <p className="st-empty__title">{title}</p>
            {text ? <p className="st-empty__text">{text}</p> : null}
            {children}
        </div>
    );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <section className="st-card">
            <Empty icon="cloud_off" title="Couldn’t load this" text={message} bad>
                <button type="button" className="st-btn" onClick={onRetry}><Icon name="refresh" /> Try again</button>
            </Empty>
        </section>
    );
}

/** Floating bar shown while a settings form has unsaved edits. */
export function SaveBar({ dirty, saving, onSave, onDiscard, note }: { dirty: boolean; saving: boolean; onSave: () => void; onDiscard: () => void; note?: string }) {
    if (!dirty && !saving) return null;
    return (
        <div className="sc-savebar" role="status">
            <span className="sc-savebar__dot" />
            <span className="sc-savebar__text">{note || 'You have unsaved changes'}</span>
            <button type="button" className="st-btn st-btn--ghost st-btn--sm" onClick={onDiscard} disabled={saving}>Discard</button>
            <button type="button" className="st-btn st-btn--primary st-btn--sm" onClick={onSave} disabled={saving}>
                <Icon name="check" /> {saving ? 'Saving…' : 'Save changes'}
            </button>
        </div>
    );
}

/** Comma/Enter separated chips editor (work areas, approvers, shift codes). */
export function ChipsInput({ values, onChange, placeholder, label, upper }: {
    values: string[];
    onChange: (v: string[]) => void;
    placeholder: string;
    label: string;
    upper?: boolean;
}) {
    const add = (raw: string) => {
        const parts = raw.split(',').map(s => (upper ? s.trim().toUpperCase() : s.trim())).filter(Boolean);
        const next = [...values];
        for (const p of parts) if (!next.includes(p)) next.push(p);
        onChange(next);
    };
    return (
        <div className="sc-chips" aria-label={label}>
            {values.map(v => (
                <span key={v} className="sc-chip">
                    {v}
                    <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter(x => x !== v))}><Icon name="close" size={13} /></button>
                </span>
            ))}
            <input
                className="sc-chips__input"
                placeholder={values.length ? '' : placeholder}
                aria-label={label}
                onKeyDown={e => {
                    const el = e.currentTarget;
                    if ((e.key === 'Enter' || e.key === ',') && el.value.trim()) {
                        e.preventDefault();
                        add(el.value);
                        el.value = '';
                    } else if (e.key === 'Backspace' && !el.value && values.length) {
                        onChange(values.slice(0, -1));
                    }
                }}
                onBlur={e => {
                    if (e.currentTarget.value.trim()) {
                        add(e.currentTarget.value);
                        e.currentTarget.value = '';
                    }
                }}
            />
        </div>
    );
}

/** Shallow-ish dirty check for settings documents. */
export const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export type ListOption = { value: string; label: string; sub?: string; icon?: string; initials?: string };

/**
 * Open/close, search, keyboard and outside-click handling shared by the glass pickers.
 * The menu flips upward when there isn't room below the trigger.
 */
function useListbox(options: ListOption[], value: string, onPick: (value: string) => void, searchFrom = 7) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [cursor, setCursor] = useState(0);
    const [up, setUp] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const listId = useId();

    const searchable = options.length >= searchFrom;
    const needle = query.trim().toLowerCase();
    const matches = needle ? options.filter(o => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(needle)) : options;

    useEffect(() => {
        if (!open) return;
        const close = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, [open]);

    useEffect(() => {
        listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [cursor]);

    const show = () => {
        const rect = rootRef.current?.getBoundingClientRect();
        setUp(!!rect && window.innerHeight - rect.bottom < 320 && rect.top > 320);
        setQuery('');
        setCursor(Math.max(0, options.findIndex(o => o.value === value)));
        setOpen(true);
        if (searchable) requestAnimationFrame(() => searchRef.current?.focus());
    };
    const pick = (v: string | undefined) => {
        if (v !== undefined) onPick(v);
        setOpen(false);
    };
    const onKeyDown = (e: React.KeyboardEvent) => {
        if (!open) {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(); }
            return;
        }
        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, matches.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); pick(matches[cursor]?.value); }
        else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    };
    const toggle = () => (open ? setOpen(false) : show());

    return {
        refs: { rootRef, searchRef, listRef },
        state: { open, up, query, setQuery, cursor, setCursor, matches, searchable, listId, pick, onKeyDown, toggle },
    };
}

type ListboxState = ReturnType<typeof useListbox>['state'];

/** The glass menu both pickers open: optional search, then the options with a check on the current one. */
function ListPanel({ lb, searchRef, listRef, value, label, searchLabel, fallbackIcon, className }: {
    lb: ListboxState;
    searchRef: React.RefObject<HTMLInputElement | null>;
    listRef: React.RefObject<HTMLUListElement | null>;
    value: string;
    label: string;
    searchLabel: string;
    fallbackIcon: string;
    className?: string;
}) {
    return (
        <div className={`sc-dept__panel${lb.up ? ' is-up' : ''}${className ? ` ${className}` : ''}`}>
            {lb.searchable && (
                <label className="sc-dept__search">
                    <Icon name="search" />
                    <input
                        ref={searchRef}
                        value={lb.query}
                        placeholder={searchLabel}
                        aria-label={searchLabel}
                        onChange={e => { lb.setQuery(e.target.value); lb.setCursor(0); }}
                    />
                </label>
            )}
            <ul className="sc-dept__list" role="listbox" id={lb.listId} aria-label={label} ref={listRef}>
                {lb.matches.map((o, i) => (
                    <li
                        key={o.value || '__none'}
                        role="option"
                        aria-selected={o.value === value}
                        data-index={i}
                        className={`sc-dept__option${i === lb.cursor ? ' is-active' : ''}${o.value === value ? ' is-on' : ''}`}
                        onMouseEnter={() => lb.setCursor(i)}
                        onClick={() => lb.pick(o.value)}
                    >
                        <span className={`sc-dept__opticon${o.initials ? ' sc-dept__opticon--person' : ''}`}>
                            {o.initials ? o.initials : <Icon name={o.icon || fallbackIcon} />}
                        </span>
                        <span className="sc-dept__opttext">
                            <span className="sc-dept__optname">{o.label}</span>
                            {o.sub && <span className="sc-dept__optsub">{o.sub}</span>}
                        </span>
                        {o.value === value && <Icon name="check" className="sc-dept__check" />}
                    </li>
                ))}
                {lb.matches.length === 0 && <li className="sc-dept__none">Nothing matches “{lb.query.trim()}”</li>}
            </ul>
        </div>
    );
}

/** Glass department picker: shows the current department, opens a searchable list. */
export function DeptPicker({ departments, value, onChange }: {
    departments: Array<{ id: string; name: string }>;
    value: string;
    onChange: (id: string) => void;
}) {
    const options = departments.map(d => ({ value: d.id, label: d.name, icon: 'domain' }));
    const { refs: { rootRef, searchRef, listRef }, state: lb } = useListbox(options, value, onChange);
    const current = departments.find(d => d.id === value);

    return (
        <div className={`sc-dept${lb.open ? ' is-open' : ''}`} ref={rootRef} onKeyDown={lb.onKeyDown}>
            <button
                type="button"
                className="sc-dept__trigger"
                aria-haspopup="listbox"
                aria-expanded={lb.open}
                aria-controls={lb.listId}
                onClick={lb.toggle}
            >
                <span className="sc-dept__chip"><Icon name="domain" /></span>
                <span className="sc-dept__text">
                    <span className="sc-dept__caption">Department</span>
                    <span className="sc-dept__name">{current?.name || 'Choose'}</span>
                </span>
                <Icon name="expand_more" className="sc-dept__chev" />
            </button>
            {lb.open && <ListPanel lb={lb} searchRef={searchRef} listRef={listRef} value={value} label="Departments" searchLabel="Find a department" fallbackIcon="domain" />}
        </div>
    );
}

/**
 * Compact property chip that opens a glass menu (rank, area, partner on a roster row).
 * An unset value shows as a dashed "add" chip so gaps are easy to spot.
 */
export function ChipSelect({ icon, value, options, onChange, label, placeholder, display, disabled }: {
    icon: string;
    value: string;
    options: ListOption[];
    onChange: (value: string) => void;
    /** Accessible name, e.g. "Rank for Ama Mensah". */
    label: string;
    placeholder: string;
    /** Custom content for the chip when a value is set (e.g. partner initials). */
    display?: ReactNode;
    disabled?: boolean;
}) {
    const { refs: { rootRef, searchRef, listRef }, state: lb } = useListbox(options, value, v => { if (v !== value) onChange(v); });
    const current = options.find(o => o.value === value && o.value !== '');

    return (
        <div className={`sc-chipsel${lb.open ? ' is-open' : ''}`} ref={rootRef} onKeyDown={lb.onKeyDown}>
            <button
                type="button"
                className={`sc-chipsel__trigger${current ? '' : ' is-empty'}`}
                aria-haspopup="listbox"
                aria-expanded={lb.open}
                aria-controls={lb.listId}
                aria-label={`${label}: ${current?.label || placeholder}`}
                title={current?.label || placeholder}
                disabled={disabled}
                onClick={lb.toggle}
            >
                {current && display ? display : <Icon name={current ? icon : 'add'} className="sc-chipsel__icon" />}
                <span className="sc-chipsel__label">{current?.label || placeholder}</span>
                <Icon name="expand_more" className="sc-chipsel__chev" />
            </button>
            {lb.open && <ListPanel lb={lb} searchRef={searchRef} listRef={listRef} value={value} label={label} searchLabel="Search" fallbackIcon={icon} className="sc-chipsel__panel" />}
        </div>
    );
}
