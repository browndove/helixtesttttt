import { NextResponse } from 'next/server';

/**
 * Android App Links — only /setup-account is claimed (pathPrefix in the app).
 * SHA-256 fingerprints come from the mobile / Play signing keys via env:
 *   ANDROID_SHA256_CERT_FINGERPRINTS=AA:BB:...,CC:DD:...
 * Leave unset until the mobile developer provides them; empty fingerprints
 * will not verify on Android.
 */
function fingerprints(): string[] {
    const raw = process.env.ANDROID_SHA256_CERT_FINGERPRINTS || '';
    return raw
        .split(/[,;\s]+/)
        .map(s => s.trim())
        .filter(Boolean);
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
