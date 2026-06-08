'use client';

import type { CSSProperties, ReactNode } from 'react';

const C_LEFT_BG = '#0B1E3B';
const C_ACCENT = '#7FB2F0';
const C_RIGHT_BG = '#E8EDF4';
const C_MUTED_LABEL = '#7A8A9E';
const C_BODY_MUTED = '#5C6B7E';

export type AdminAuthShellProps = {
    leftAccentTitle: string;
    leftDescription: string;
    leftFooter?: string;
    eyebrow: string;
    headerTitle?: string;
    children: ReactNode;
};

export function AdminAuthShell({
    leftAccentTitle,
    leftDescription,
    leftFooter = 'This is not the patient app or ward staff mobile sign-in.',
    eyebrow,
    headerTitle = 'Helix Facility Administration',
    children,
}: AdminAuthShellProps) {
    const shellRootStyle: CSSProperties = {
        position: 'relative',
        height: '100dvh',
        maxHeight: '100dvh',
        width: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#F0F2F5',
    };

    const asideStyle: CSSProperties = {
        position: 'relative',
        minWidth: 0,
        background: C_LEFT_BG,
        overflow: 'hidden',
        display: 'flex',
        minHeight: 160,
        width: '100%',
        maxHeight: '30vh',
        flex: '0 0 auto',
        flexDirection: 'column',
        justifyContent: 'space-between',
    };

    const leftContentStyle: CSSProperties = {
        position: 'relative',
        zIndex: 1,
        minHeight: 0,
        maxHeight: '100%',
        flex: 1,
        overflow: 'hidden',
        paddingTop: 32,
        paddingLeft: 24,
        paddingRight: 24,
        paddingBottom: 0,
    };

    const leftFooterStyle: CSSProperties = {
        position: 'relative',
        zIndex: 1,
        flexShrink: 0,
        padding: '20px 24px 40px',
        fontSize: 12,
        lineHeight: 1.55,
        color: 'rgba(255,255,255,0.72)',
        margin: 0,
        textShadow: '0 1px 1px rgba(0,0,0,0.25)',
    };

    const ghostBtnXs: CSSProperties = {
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
    };

    return (
        <>
            <style>
                {`
@media (min-width: 768px) {
  .admin-login-shell { flex-direction: row !important; }
  .admin-login-aside {
    max-height: none !important;
    height: 100% !important;
    min-height: 0 !important;
    width: 40% !important;
    max-width: 28rem !important;
    flex: 0 0 40% !important;
  }
  .admin-login-left-content { padding-top: 48px !important; padding-left: 40px !important; padding-right: 40px !important; }
  .admin-login-left-footer { padding-left: 40px !important; padding-right: 40px !important; padding-bottom: 40px !important; }
}
@media (min-width: 1024px) {
  .admin-login-aside { max-width: none !important; }
}
`}
            </style>
            <div className="fade-in admin-login-shell" style={shellRootStyle}>
                <aside className="admin-login-aside" style={asideStyle}>
                    <div
                        aria-hidden
                        style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundImage: `
              repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(255,255,255,0.035) 21px),
              repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(255,255,255,0.035) 21px)
            `,
                            pointerEvents: 'none',
                        }}
                    />
                    <div className="admin-login-aurora-mesh" aria-hidden />
                    <div className="admin-login-aurora-1" aria-hidden />
                    <div className="admin-login-aurora-2" aria-hidden />
                    <div className="admin-login-left-content" style={leftContentStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
                            <div
                                style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 10,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'rgba(0,0,0,0.2)',
                                    boxShadow: '0 1px 0 rgba(255,255,255,0.15) inset',
                                    overflow: 'hidden',
                                }}
                            >
                                <img
                                    src="/brand-logo.svg"
                                    alt=""
                                    width={32}
                                    height={32}
                                    style={{ width: 28, height: 28, objectFit: 'contain' }}
                                />
                            </div>
                            <span
                                style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    letterSpacing: '0.16em',
                                    color: 'rgba(255,255,255,0.78)',
                                    textShadow: '0 1px 1px rgba(0,0,0,0.2)',
                                }}
                            >
                                HOSPITAL ADMIN
                            </span>
                        </div>
                        <h1
                            style={{
                                fontSize: 'clamp(1.35rem, 2.8vw, 1.75rem)',
                                fontWeight: 800,
                                lineHeight: 1.12,
                                color: '#fff',
                                margin: 0,
                                letterSpacing: '-0.02em',
                                textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                            }}
                        >
                            Helix
                        </h1>
                        <p
                            style={{
                                margin: '10px 0 0',
                                fontSize: 'clamp(1.2rem, 2.4vw, 1.55rem)',
                                fontWeight: 800,
                                lineHeight: 1.15,
                                letterSpacing: '-0.02em',
                                color: C_ACCENT,
                                textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                            }}
                        >
                            {leftAccentTitle}
                        </p>
                        <p
                            style={{
                                marginTop: 28,
                                fontSize: 13,
                                lineHeight: 1.65,
                                color: '#c5d0e3',
                                maxWidth: 400,
                                textShadow: '0 1px 1px rgba(0,0,0,0.2)',
                            }}
                        >
                            {leftDescription}
                        </p>
                    </div>
                    <p className="admin-login-left-footer" style={leftFooterStyle}>
                        {leftFooter}
                    </p>
                </aside>

                <div
                    style={{
                        display: 'flex',
                        height: '100%',
                        minHeight: 0,
                        width: '100%',
                        minWidth: 0,
                        flex: 1,
                        flexDirection: 'column',
                        overflow: 'hidden',
                        background: C_RIGHT_BG,
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            minHeight: 0,
                            width: '100%',
                            minWidth: 0,
                            flex: 1,
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflowX: 'hidden',
                            overflowY: 'hidden',
                            overscrollBehavior: 'none',
                            padding: '24px 40px',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                width: '100%',
                                minWidth: 0,
                                maxWidth: 'min(100%, 26rem)',
                                flexShrink: 0,
                                flexDirection: 'column',
                                alignItems: 'stretch',
                                paddingLeft: 16,
                                paddingRight: 16,
                                paddingBottom: 4,
                            }}
                        >
                            <header style={{ textAlign: 'center', marginBottom: 22 }}>
                                <p
                                    style={{
                                        fontSize: 9,
                                        fontWeight: 600,
                                        letterSpacing: '0.14em',
                                        color: C_MUTED_LABEL,
                                        margin: '0 0 4px',
                                    }}
                                >
                                    {eyebrow}
                                </p>
                                <h2
                                    style={{
                                        fontSize: 'clamp(1.1rem, 2.8vw + 0.5rem, 1.5rem)',
                                        fontWeight: 800,
                                        color: C_LEFT_BG,
                                        margin: 0,
                                        letterSpacing: '-0.03em',
                                        lineHeight: 1.2,
                                    }}
                                >
                                    {headerTitle}
                                </h2>
                            </header>

                            <div
                                style={{
                                    background: '#fff',
                                    border: '1px solid rgba(11, 30, 59, 0.06)',
                                    borderRadius: 12,
                                    padding: '22px 20px 20px',
                                    boxShadow: '0 8px 28px rgba(11, 30, 59, 0.06), 0 1px 4px rgba(11, 30, 59, 0.04)',
                                }}
                            >
                                {children}
                            </div>

                            <footer style={{ marginTop: 22, textAlign: 'center' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 20, marginBottom: 8 }}>
                                    {[
                                        { icon: 'help', label: 'Help & support' },
                                        { icon: 'policy', label: 'Privacy' },
                                    ].map(item => (
                                        <button
                                            key={item.label}
                                            type="button"
                                            style={{ ...ghostBtnXs, color: C_BODY_MUTED, fontWeight: 500, fontSize: 12 }}
                                        >
                                            <span className="material-icons-round" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 3 }}>{item.icon}</span>
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </footer>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export const adminAuthLabelStyle: CSSProperties = {
    display: 'block',
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: C_MUTED_LABEL,
    marginBottom: 4,
};

export const adminAuthInputBase: CSSProperties = {
    width: '100%',
    height: 40,
    paddingLeft: 38,
    paddingRight: 12,
    borderRadius: 8,
    border: '1px solid #D4DCE8',
    fontSize: 14,
    background: '#fff',
    color: C_LEFT_BG,
    outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
};

export const adminAuthInputWithToggle: CSSProperties = {
    ...adminAuthInputBase,
    paddingRight: 40,
};

export const adminAuthInputFocusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.style.boxShadow = '0 0 0 3px rgba(11,30,59,0.14)';
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.style.boxShadow = 'none';
    },
} as const;

export const adminAuthPrimaryBtn = (disabled: boolean): CSSProperties => ({
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
    padding: '10px 14px',
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    background: C_LEFT_BG,
    border: 'none',
    borderRadius: 8,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    boxShadow: '0 2px 10px rgba(11, 30, 59, 0.22)',
});

export const adminAuthPillStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    padding: '5px 10px',
    borderRadius: 999,
    background: '#E4ECF6',
    border: '1px solid #C8D4E4',
};

export const adminAuthErrorBox: CSSProperties = {
    padding: '8px 10px',
    borderRadius: 8,
    background: 'var(--critical-bg)',
    border: '1px solid rgba(140,90,94,0.2)',
    marginBottom: 10,
    fontSize: 12,
    color: 'var(--critical)',
    fontWeight: 500,
    lineHeight: 1.4,
};

export { C_BODY_MUTED, C_LEFT_BG, C_MUTED_LABEL };
