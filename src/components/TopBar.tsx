'use client';

import React from 'react';

interface TopBarProps {
    title: string;
    subtitle?: string;
    breadcrumbs?: string[];
    actions?: React.ReactNode;
    /** Controls rendered immediately after the title, before the flexible spacer. */
    accessory?: React.ReactNode;
    search?: {
        placeholder?: string;
        value?: string;
        onChange?: (val: string) => void;
    };
}

export default function TopBar({ title, subtitle, breadcrumbs, actions, accessory, search }: TopBarProps) {
    return (
        <div className="glass" style={{
            position: 'sticky',
            top: 12,
            zIndex: 40,
            margin: '12px 24px 0',
            borderRadius: 20,
            padding: '0 12px 0 20px',
            height: 58,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexShrink: 0,
        }}>
            {/* Left: Title + Breadcrumbs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', margin: 0, letterSpacing: '-0.01em' }}>
                    {title}
                </h1>
                {breadcrumbs && breadcrumbs.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {breadcrumbs.map((crumb, i) => (
                            <React.Fragment key={i}>
                                <span style={{ fontSize: 12, color: 'var(--text-disabled)' }}>/</span>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{crumb}</span>
                            </React.Fragment>
                        ))}
                    </div>
                )}
                {subtitle && (
                    <>
                        <span style={{ fontSize: 12, color: 'var(--text-disabled)' }}>·</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>{subtitle}</span>
                    </>
                )}
            </div>

            {accessory}

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Right: Search + Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {search && (
                    <div style={{ position: 'relative' }}>
                        <span className="material-icons-round" style={{
                            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                            fontSize: 15, color: 'var(--text-disabled)', pointerEvents: 'none',
                        }}>search</span>
                        <input
                            className="input"
                            placeholder={search.placeholder || 'Search...'}
                            value={search.value || ''}
                            onChange={e => search.onChange?.(e.target.value)}
                            style={{
                                paddingLeft: 36,
                                fontSize: 12.5,
                                height: 38,
                                width: 240,
                                background: 'rgba(255,255,255,0.85)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 13,
                            }}
                        />
                    </div>
                )}
                {actions}
            </div>
        </div>
    );
}
