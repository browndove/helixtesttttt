'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
export type CustomSelectOption = {
    label: string;
    value: string;
    /** Shown on the closed trigger when set; dropdown still uses `label`. */
    triggerLabel?: string;
};
interface Props {
    value: string;
    onChange: (v: string) => void;
    options: CustomSelectOption[];
    placeholder?: string;
    style?: React.CSSProperties;
    maxH?: number;
    allowCustom?: boolean;
    /** Shown inside the dropdown input (keep short). */
    customPlaceholder?: string;
    /** Optional heading above the custom/search field when `allowCustom` is true. */
    customEntryTitle?: string;
    /** Optional helper line under the title (defaults to clear Enter instruction). */
    customEntryHint?: string;
    /** Min width of the open panel (defaults to 248 when `allowCustom`). */
    dropdownMinWidth?: number;
    /** Placeholder for the dropdown search field (when the list is searchable). */
    searchPlaceholder?: string;
}
export default function CustomSelect({
    value,
    onChange,
    options,
    placeholder = '-- Select --',
    style,
    maxH = 200,
    allowCustom = false,
    customPlaceholder = 'Type qualification, then press Enter',
    customEntryTitle = 'Add your own',
    customEntryHint = 'Not in the list? Type below, then Enter.',
    dropdownMinWidth,
    searchPlaceholder = 'Search...',
}: Props) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
    const btnRef = useRef<HTMLButtonElement>(null);
    const ddRef = useRef<HTMLDivElement>(null);
    const close = useCallback(() => { setOpen(false); setQ(''); }, []);

    const updatePos = useCallback(() => {
        if (!btnRef.current) return;
        const r = btnRef.current.getBoundingClientRect();
        setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }, []);

    useEffect(() => {
        if (!open) return;
        updatePos();
        const onClickOutside = (e: MouseEvent) => {
            if (btnRef.current?.contains(e.target as Node)) return;
            if (ddRef.current?.contains(e.target as Node)) return;
            close();
        };
        const onScroll = () => updatePos();
        document.addEventListener('mousedown', onClickOutside);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', updatePos);
        return () => {
            document.removeEventListener('mousedown', onClickOutside);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', updatePos);
        };
    }, [open, close, updatePos]);

    const sel = options.find(o => o.value === value);
    const optionMatchesQuery = (o: CustomSelectOption, query: string) => {
        const qLower = query.toLowerCase();
        if (o.label.toLowerCase().includes(qLower)) return true;
        if (o.triggerLabel?.toLowerCase().includes(qLower)) return true;
        if (o.value.toLowerCase().includes(qLower)) return true;
        return false;
    };
    const list = q ? options.filter(o => optionMatchesQuery(o, q)) : options;
    const triggerText = sel ? (sel.triggerLabel ?? sel.label) : (value || placeholder);
    const commitCustom = () => {
        const next = q.trim();
        if (!allowCustom || !next) return;
        onChange(next);
        close();
    };
    const btnStyle: React.CSSProperties = {
        width: '100%', height: 36, padding: '0 10px', fontSize: 13, textAlign: 'left',
        background: 'var(--surface-card,#fff)', border: '1px solid var(--border-default,#d1d5db)',
        borderRadius: 'var(--radius-md,6px)', cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        color: sel ? 'var(--text-primary,#111)' : 'var(--text-muted,#888)', outline: 'none',
    };

    const panelWidth = Math.max(
        pos.width,
        dropdownMinWidth ?? (allowCustom ? 248 : options.length > 6 ? 360 : 0),
    );

    const dropdown = open && typeof document !== 'undefined' ? createPortal(
        <div ref={ddRef} style={{
            position: 'fixed', top: pos.top, left: pos.left, width: panelWidth,
            background: 'var(--surface-card,#fff)', border: '1px solid var(--border-default,#d1d5db)',
            borderRadius: 'var(--radius-md,6px)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 99999, overflow: 'hidden',
        }}>
            {(options.length > 6 || allowCustom) && (
                <div
                    style={{
                        padding: allowCustom ? '10px 10px 10px' : '6px 8px',
                        borderBottom: '1px solid var(--border-subtle,#e5e7eb)',
                        background: allowCustom ? 'linear-gradient(180deg, rgba(11,74,163,0.06) 0%, rgba(11,74,163,0.03) 100%)' : undefined,
                    }}
                >
                    {allowCustom && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                            <span className="material-icons-round" style={{ fontSize: 20, color: 'var(--helix-primary,#1e3a5f)', flexShrink: 0, marginTop: 1 }}>
                                edit_note
                            </span>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary,#1a2332)', letterSpacing: '0.02em' }}>
                                    {customEntryTitle}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary,#475569)', marginTop: 3, lineHeight: 1.45 }}>
                                    {customEntryHint}
                                </div>
                            </div>
                        </div>
                    )}
                    <input
                        type="text"
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (allowCustom && q.trim()) commitCustom();
                            }
                        }}
                        placeholder={allowCustom ? customPlaceholder : searchPlaceholder}
                        aria-label={allowCustom ? `${customEntryTitle}. ${customPlaceholder}` : 'Search options'}
                        autoFocus
                        style={{
                            width: '100%',
                            height: allowCustom ? 34 : 28,
                            padding: '0 10px',
                            fontSize: 13,
                            fontWeight: allowCustom ? 500 : 400,
                            border: allowCustom ? '1px solid rgba(30, 58, 95, 0.22)' : '1px solid var(--border-subtle,#e5e7eb)',
                            borderRadius: 8,
                            background: '#fff',
                            outline: 'none',
                            color: 'var(--text-primary,#111)',
                            boxShadow: allowCustom ? 'inset 0 1px 2px rgba(15,23,42,0.06)' : undefined,
                        }}
                    />
                </div>
            )}
            <div style={{ maxHeight: maxH, overflowY: 'auto' }}>
                {list.length === 0 && <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>No results</div>}
                {list.map(o => (
                    <button key={o.value} type="button" onClick={() => { onChange(o.value); close(); }}
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, lineHeight: 1.35, textAlign: 'left', whiteSpace: 'normal', background: o.value === value ? 'rgba(99,102,241,0.08)' : 'transparent', border: 'none', cursor: 'pointer', color: o.value === value ? 'var(--helix-primary,#6366f1)' : 'var(--text-primary,#111)', fontWeight: o.value === value ? 600 : 400 }}
                        onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background = 'var(--surface-2,#f3f4f6)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = o.value === value ? 'rgba(99,102,241,0.08)' : 'transparent'; }}>
                        {o.value === value && <span style={{ marginRight: 6, fontSize: 12 }}>✓</span>}{o.label}
                    </button>
                ))}
                {allowCustom && q.trim() && !options.some(o => o.value.toLowerCase() === q.trim().toLowerCase()) && (
                    <button
                        type="button"
                        onClick={commitCustom}
                        style={{
                            width: '100%',
                            padding: '7px 12px',
                            fontSize: 13,
                            textAlign: 'left',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--helix-primary,#6366f1)',
                            fontWeight: 600,
                            borderTop: '1px solid var(--border-subtle,#e5e7eb)',
                        }}
                    >
                        Use "{q.trim()}"
                    </button>
                )}
            </div>
        </div>,
        document.body
    ) : null;

    const wrapperStyle: React.CSSProperties = {
        position: 'relative',
        minWidth: 0,
        ...(style && style.width !== undefined ? { width: style.width } : {}),
    };
    const triggerStyle: React.CSSProperties = {
        ...btnStyle,
        ...(style || {}),
        width: '100%',
    };
    if (triggerStyle.minHeight !== undefined && triggerStyle.minHeight !== null) {
        triggerStyle.height = 'auto';
    }

    return (
        <div style={wrapperStyle}>
            <button
                ref={btnRef}
                type="button"
                title={allowCustom ? 'Open to pick from the list or type your own value' : undefined}
                onClick={() => { if (!open) updatePos(); setOpen(p => !p); }}
                style={triggerStyle}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {triggerText}
                </span>
                <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--text-muted)', marginLeft: 4, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>expand_more</span>
            </button>
            {dropdown}
        </div>
    );
}
