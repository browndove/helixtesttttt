import { NextRequest, NextResponse } from 'next/server';
import { getInternalTokenFromCookie } from '@/lib/proxy-auth';
import {
    fetchAppleDownloadAnalytics,
    getAppStoreConnectConfig,
    getAppStoreConnectConfigErrors,
    getAppStoreConnectEnvPresence,
    verifyAppStoreConnectAuth,
} from '@/lib/app-store-connect';
import {
    getGooglePlayConfig,
    getGooglePlayConfigErrors,
    verifyGooglePlayAuth,
} from '@/lib/google-play-connect';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
    try {
        const token = getInternalTokenFromCookie(req);
        if (!token) {
            return NextResponse.json({ error: 'Not authenticated as internal admin' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const days = Math.min(400, Math.max(1, Number.parseInt(searchParams.get('days') || '400', 10) || 400));

        if (!getAppStoreConnectConfig()) {
            const auth = await verifyAppStoreConnectAuth().catch(() => null);
            return NextResponse.json({
                configured: false,
                missing: getAppStoreConnectConfigErrors(),
                env: getAppStoreConnectEnvPresence(),
                auth,
                error: 'App Store Connect is not configured',
            }, { status: 503 });
        }

        try {
            let lastError: unknown;
            for (let attempt = 0; attempt < 2; attempt += 1) {
                try {
                    const [auth, analytics, play] = await Promise.all([
                        verifyAppStoreConnectAuth(),
                        fetchAppleDownloadAnalytics(days),
                        getGooglePlayConfig()
                            ? verifyGooglePlayAuth().then((authResult) => ({
                                configured: true as const,
                                missing: [] as string[],
                                auth: authResult,
                            }))
                            : Promise.resolve({
                                configured: false as const,
                                missing: getGooglePlayConfigErrors(),
                                auth: null as null,
                            }),
                    ]);
                    return NextResponse.json({
                        source: analytics.total_downloads > 0 ? 'apple' : 'apple-empty',
                        configured: true,
                        auth,
                        play,
                        analytics,
                    });
                } catch (err) {
                    lastError = err;
                    const message = err instanceof Error ? err.message : '';
                    if (attempt === 0 && /unexpected end of json input/i.test(message)) continue;
                    throw err;
                }
            }
            throw lastError instanceof Error ? lastError : new Error('Failed to load download analytics');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown App Store Connect error';
            const auth = await verifyAppStoreConnectAuth().catch(() => null);
            console.error('[download-analytics] App Store Connect error:', message);
            return NextResponse.json({
                configured: true,
                auth,
                error: message,
            }, { status: 502 });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Failed to load download analytics', details: message }, { status: 500 });
    }
}
