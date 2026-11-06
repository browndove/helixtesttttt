import { NextResponse } from 'next/server';

/**
 * Android App Links — only /setup-account is claimed (pathPrefix in the app).
 *
 * Prod Play App Signing SHA-256 is baked in below. Extra fingerprints
 * (upload key, debug, staging) can be appended via Amplify env:
 *   ANDROID_SHA256_CERT_FINGERPRINTS=AA:BB:...,CC:DD:...
 */
const PROD_SHA256_CERT_FINGERPRINT =
    '8E:E7:DB:F1:17:97:76:5A:53:B8:A6:6B:F9:37:A9:95:BC:B1:38:61:8D:2F:C8:41:8F:C7:7C:67:5A:5A:96:D9';

function fingerprints(): string[] {
    const fromEnv = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS || '')
        .split(/[,;\s]+/)
        .map(s => s.trim())
        .filter(Boolean);
    return [...new Set([PROD_SHA256_CERT_FINGERPRINT, ...fromEnv])];
}

export function GET() {
    const sha256_cert_fingerprints = fingerprints();
    const body = [
        {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
                namespace: 'android_app',
                package_name: 'com.helixhealth.app',
                sha256_cert_fingerprints,
            },
        },
    ];
    return NextResponse.json(body, {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
        },
    });
}
