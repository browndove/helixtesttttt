import { NextResponse } from 'next/server';

/**
 * iOS Universal Links — only /setup-account opens in the Helix mobile app.
 * Served as application/json with no redirect / no auth (see src/proxy.ts).
 */
const BODY = {
    applinks: {
        details: [
            {
                appIDs: ['VC57X7SC77.com.helixhealth.app'],
                components: [{ '/': '/setup-account*' }],
            },
        ],
    },
};

export function GET() {
    return NextResponse.json(BODY, {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
        },
    });
}
