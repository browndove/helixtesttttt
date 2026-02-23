'use client';

import React from 'react';

interface TopBarProps {
    title: string;
    subtitle?: string;
    breadcrumbs?: string[];
    actions?: React.ReactNode;
    search?: {
        placeholder?: string;
        value?: string;
        onChange?: (val: string) => void;
    };
}

export default function TopBar({ title, subtitle, breadcrumbs, actions, search }: TopBarProps) {
    return (
        <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            background: '#ffffff',
            borderBottom: '1px solid var(--border-default)',
            padding: '0 24px',
            height: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexShrink: 0,
        }}>
            {/* Left: Title + Breadcrumbs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', margin: 0, letterSpacing: '-0.01em' }}>
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
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{subtitle}</span>
                    </>
                )}
            </div>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Right: Search + Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {search && (
                    <div style={{ position: 'relative' }}>
                        <span className="material-icons-round" style={{
                            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                            fontSize: 15, color: 'var(--text-disabled)', pointerEvents: 'none',
                        }}>search</span>
                        <input
                            className="input"
                            placeholder={search.placeholder || 'Search...'}
                            value={search.value || ''}
                            onChange={e => search.onChange?.(e.target.value)}
                            style={{
                                paddingLeft: 32,
                                fontSize: 12.5,
                                height: 34,
                                width: 220,
                                background: 'var(--surface-2)',
                                border: '1px solid var(--border-default)',
                                borderRadius: 'var(--radius-md)',
                            }}
                        />
                    </div>
                )}
                {actions}
            </div>
        </div>
    );
}
