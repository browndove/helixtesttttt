import Image from 'next/image';

const APP_STORE_URL = 'https://apps.apple.com/us/app/helix-health/id6761296684';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.helixhealth.app';

/**
 * Fallback when Universal / App Links do not open the Helix mobile app
 * (desktop, or phone without the app installed). Setup itself runs in-app.
 */
export default function SetupAccountOpenInApp() {
    return (
        <main
            style={{
                minHeight: '100dvh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '32px 20px',
                background:
                    'radial-gradient(1200px 600px at 10% -10%, #E8EEF6 0%, transparent 55%), radial-gradient(900px 500px at 100% 0%, #F3F6FA 0%, transparent 50%), #F7F8FA',
                fontFamily:
                    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: 420,
                    background: '#fff',
                    borderRadius: 20,
                    border: '1px solid #E6EAF0',
                    boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 18px 40px -24px rgba(15,23,42,0.28)',
                    padding: '36px 28px 28px',
                    textAlign: 'center',
                }}
            >
                <Image
                    src="/helix-logo.png"
                    alt="Helix"
                    width={44}
                    height={44}
                    style={{ margin: '0 auto 18px', borderRadius: 10 }}
                    priority
                />
                <h1
                    style={{
                        margin: 0,
                        fontSize: 22,
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        color: '#0F172A',
                        lineHeight: 1.25,
                    }}
                >
                    Finish in the Helix app
                </h1>
                <p
                    style={{
                        margin: '12px 0 0',
                        fontSize: 15,
                        lineHeight: 1.5,
                        color: '#475569',
                    }}
                >
                    Finish setting up your Helix account in the Helix mobile app.
                </p>

                <div
                    style={{
                        marginTop: 28,
                        display: 'grid',
                        gap: 10,
                    }}
                >
                    <a
                        href={APP_STORE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: 44,
                            borderRadius: 12,
                            background: '#1E3A5F',
                            color: '#fff',
                            fontSize: 14,
                            fontWeight: 600,
                            textDecoration: 'none',
                        }}
                    >
                        Download on the App Store
                    </a>
                    <a
                        href={PLAY_STORE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: 44,
                            borderRadius: 12,
                            background: '#fff',
                            color: '#1E3A5F',
                            fontSize: 14,
                            fontWeight: 600,
                            textDecoration: 'none',
                            border: '1px solid #D7E0EC',
                        }}
                    >
                        Get it on Google Play
                    </a>
                </div>

                <p
                    style={{
                        margin: '22px 0 0',
                        fontSize: 13,
                        lineHeight: 1.45,
                        color: '#64748B',
                    }}
                >
                    Already installed? Tap the link in your email again on your phone.
                </p>
            </div>
        </main>
    );
}
