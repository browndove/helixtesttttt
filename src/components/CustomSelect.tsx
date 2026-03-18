'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
type Option = { label: string; value: string };
interface Props {
    value: string;
    onChange: (v: string) => void;
    options: Option[];
    placeholder?: string;
    style?: React.CSSProperties;
    maxH?: number;
}
export default function CustomSelect({ value, onChange, options, placeholder = '-- Select --', style, maxH = 200 }: Props) {
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
    const list = q ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase())) : options;
    const btnStyle: React.CSSProperties = {
        width: '100%', height: 36, padding: '0 10px', fontSize: 13, textAlign: 'left',
        background: 'var(--surface-card,#fff)', border: '1px solid var(--border-default,#d1d5db)',
        borderRadius: 'var(--radius-md,6px)', cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        color: sel ? 'var(--text-primary,#111)' : 'var(--text-muted,#888)', outline: 'none',
    };

    const dropdown = open && typeof document !== 'undefined' ? createPortal(
        <div ref={ddRef} style={{
            position: 'fixed', top: pos.top, left: pos.left, width: pos.width,
            background: 'var(--surface-card,#fff)', border: '1px solid var(--border-default,#d1d5db)',
            borderRadius: 'var(--radius-md,6px)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 99999, overflow: 'hidden',
        }}>
            {options.length > 6 && (
                <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-subtle,#e5e7eb)' }}>
                    <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search..." autoFocus
                        style={{ width: '100%', height: 28, padding: '0 8px', fontSize: 12, border: '1px solid var(--border-subtle,#e5e7eb)', borderRadius: 4, background: 'var(--surface-2,#f9fafb)', outline: 'none', color: 'var(--text-primary,#111)' }} />
                </div>
            )}
            <div style={{ maxHeight: maxH, overflowY: 'auto' }}>
                {list.length === 0 && <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>No results</div>}
                {list.map(o => (
                    <button key={o.value} type="button" onClick={() => { onChange(o.value); close(); }}
                        style={{ width: '100%', padding: '7px 12px', fontSize: 13, textAlign: 'left', background: o.value === value ? 'rgba(99,102,241,0.08)' : 'transparent', border: 'none', cursor: 'pointer', color: o.value === value ? 'var(--helix-primary,#6366f1)' : 'var(--text-primary,#111)', fontWeight: o.value === value ? 600 : 400 }}
                        onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background = 'var(--surface-2,#f3f4f6)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = o.value === value ? 'rgba(99,102,241,0.08)' : 'transparent'; }}>
                        {o.value === value && <span style={{ marginRight: 6, fontSize: 12 }}>✓</span>}{o.label}
                    </button>
                ))}
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <div style={{ position: 'relative', ...style }}>
            <button ref={btnRef} type="button" onClick={() => { if (!open) updatePos(); setOpen(p => !p); }} style={btnStyle}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{sel ? sel.label : placeholder}</span>
                <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--text-muted)', marginLeft: 4, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>expand_more</span>
            </button>
            {dropdown}
        </div>
    );
}
