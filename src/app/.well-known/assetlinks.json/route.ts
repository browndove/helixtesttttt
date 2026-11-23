import { NextResponse } from 'next/server';

/**
 * Android App Links — only /setup-account is claimed (pathPrefix in the app).
 *
 * Prod SHA-256 fingerprints are baked in below: the Play App Signing key that
 * signs the app installed from Play (9E:59…), and the earlier key (8E:E7…).
 * Extra fingerprints (upload key, debug, staging) can be appended via Amplify env:
 *   ANDROID_SHA256_CERT_FINGERPRINTS=AA:BB:...,CC:DD:...
 */
const PROD_SHA256_CERT_FINGERPRINTS = [
    '9E:59:10:E7:A6:6A:A9:40:21:E4:84:F5:B8:79:4F:67:18:31:E8:5B:BB:14:12:BC:C3:A6:30:E5:EF:67:29:0F',
    '8E:E7:DB:F1:17:97:76:5A:53:B8:A6:6B:F9:37:A9:95:BC:B1:38:61:8D:2F:C8:41:8F:C7:7C:67:5A:5A:96:D9',
];

function fingerprints(): string[] {
    const fromEnv = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS || '')
        .split(/[,;\s]+/)
        .map(s => s.trim())
        .filter(Boolean);
    return [...new Set([...PROD_SHA256_CERT_FINGERPRINTS, ...fromEnv])];
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
