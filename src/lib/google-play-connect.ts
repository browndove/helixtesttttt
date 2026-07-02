import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { importPKCS8, SignJWT } from 'jose';
import type { DownloadAnalyticsData } from '@/lib/download-analytics-mock';

const GCS_SCOPE = 'https://www.googleapis.com/auth/devstorage.read_only';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GCS_API = 'https://storage.googleapis.com/storage/v1';

type GoogleServiceAccount = {
    client_email: string;
    private_key: string;
};

type GooglePlayConfig = {
    credentials: GoogleServiceAccount;
    packageName: string;
    bucket: string;
    installsPrefix: string;
};

let cachedGoogleToken: { token: string; expiresAt: number } | null = null;

function localInstallCsvPaths(): string[] {
    const paths = new Set<string>();
    const raw = process.env.GOOGLE_PLAY_LOCAL_INSTALLS_CSV_PATHS?.trim();
    if (raw) {
        for (const part of raw.split(',').map((p) => p.trim()).filter(Boolean)) {
            paths.add(resolve(part));
        }
    }

    const dir = process.env.GOOGLE_PLAY_LOCAL_INSTALLS_DIR?.trim();
    if (dir && existsSync(dir)) {
        for (const name of readdirSync(dir)) {
            if (!name.endsWith('.csv')) continue;
            if (!name.includes('installs_')) continue;
            paths.add(join(resolve(dir), name));
        }
    }

    return [...paths];
}

function hasLocalPlayReports(): boolean {
    return localInstallCsvPaths().length > 0;
}

function readServiceAccountFromEnv(): GoogleServiceAccount | null {
    const inline = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim();
    if (inline) {
        try {
            return JSON.parse(inline) as GoogleServiceAccount;
        } catch {
            return null;
        }
    }

    const path = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PATH?.trim();
    if (!path) return null;

    try {
        return JSON.parse(readFileSync(path, 'utf8')) as GoogleServiceAccount;
    } catch {
        return null;
    }
}

export function getGooglePlayConfig(): GooglePlayConfig | null {
    const credentials = readServiceAccountFromEnv();
    const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim();
    const bucketRaw = process.env.GOOGLE_PLAY_STORAGE_BUCKET?.trim();
    const prefixRaw = process.env.GOOGLE_PLAY_INSTALLS_PREFIX?.trim();

    if (!credentials?.client_email || !credentials?.private_key || !packageName || !bucketRaw) {
        return null;
    }

    let bucket = bucketRaw;
    let installsPrefix = prefixRaw || 'stats/installs';

    // Allow users to paste either:
    // - bucket only: pubsite_prod_xxx
    // - full URI: gs://pubsite_prod_xxx/stats/installs/
    if (bucketRaw.startsWith('gs://')) {
        const withoutScheme = bucketRaw.slice('gs://'.length);
        const [bucketName, ...rest] = withoutScheme.split('/').filter(Boolean);
        bucket = bucketName || '';
        if (rest.length > 0 && !prefixRaw) {
            installsPrefix = rest.join('/');
        }
    }

    if (!bucket) return null;
    installsPrefix = installsPrefix.replace(/^\/+|\/+$/g, '');

    return { credentials, packageName, bucket, installsPrefix };
}

export function getGooglePlayConfigErrors(): string[] {
    const errors: string[] = [];
    if (hasLocalPlayReports()) {
        return errors;
    }
    if (!readServiceAccountFromEnv()) {
        errors.push('GOOGLE_PLAY_SERVICE_ACCOUNT_PATH or GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is missing');
    }
    if (!process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim()) {
        errors.push('GOOGLE_PLAY_PACKAGE_NAME is missing');
    }
    if (!process.env.GOOGLE_PLAY_STORAGE_BUCKET?.trim()) {
        errors.push('GOOGLE_PLAY_STORAGE_BUCKET is missing (bucket id or gs:// URI from Play Console → Download reports)');
    }
    return errors;
}

async function createGoogleAccessToken(credentials: GoogleServiceAccount): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (cachedGoogleToken && cachedGoogleToken.expiresAt - 120 > now) {
        return cachedGoogleToken.token;
    }

    const privateKey = await importPKCS8(credentials.private_key, 'RS256');
    const assertion = await new SignJWT({ scope: GCS_SCOPE })
        .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
        .setIssuer(credentials.client_email)
        .setSubject(credentials.client_email)
        .setAudience(TOKEN_URL)
        .setIssuedAt(now)
        .setExpirationTime(now + 3600)
        .sign(privateKey);

    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion,
        }),
        cache: 'no-store',
    });

    if (!res.ok) {
        const details = await res.text();
        throw new Error(`Google OAuth token failed (${res.status}): ${details.slice(0, 300)}`);
    }

    const payload = await res.json() as { access_token?: string; expires_in?: number };
    if (!payload.access_token) {
        throw new Error('Google OAuth token response missing access_token');
    }

    cachedGoogleToken = {
        token: payload.access_token,
        expiresAt: now + (payload.expires_in ?? 3600),
    };
    return payload.access_token;
}

function monthsForWindow(windowDays: number): string[] {
    const months = new Set<string>();
    for (let offset = 0; offset <= windowDays + 10; offset += 1) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - offset);
        months.add(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    }
    return [...months].sort();
}

function decodePlayReportText(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
        return new TextDecoder('utf-16le').decode(buffer);
    }
    return new TextDecoder('utf-8').decode(buffer);
}

function parseCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (ch === ',' && !inQuotes) {
            cells.push(current.trim());
            current = '';
            continue;
        }
        current += ch;
    }
    cells.push(current.trim());
    return cells;
}

function parseInstallReportCsv(text: string): Map<string, number> {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) return new Map();

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const dateIdx = headers.findIndex((h) => h === 'date');
    const installsIdx = headers.findIndex((h) =>
        h.includes('daily device installs') || h === 'daily device installs',
    );

    if (dateIdx < 0 || installsIdx < 0) return new Map();

    const byDay = new Map<string, number>();
    for (const line of lines.slice(1)) {
        const cols = parseCsvLine(line);
        const day = cols[dateIdx]?.trim();
        const installs = Number.parseInt(cols[installsIdx]?.replace(/,/g, '') || '0', 10);
        if (!day || !Number.isFinite(installs) || installs <= 0) continue;
        byDay.set(day, (byDay.get(day) || 0) + installs);
    }

    return byDay;
}

const PLAY_COUNTRY_TO_CODE: Record<string, string> = {
    'united states': 'US',
    'ghana': 'GH',
    'canada': 'CA',
    'united kingdom': 'GB',
    'nigeria': 'NG',
    'germany': 'DE',
    'france': 'FR',
    'india': 'IN',
    'australia': 'AU',
};

function normalizePlayCountry(country: string): string {
    const trimmed = country.trim();
    if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
    const mapped = PLAY_COUNTRY_TO_CODE[trimmed.toLowerCase()];
    return mapped || trimmed;
}

function parseCountryInstallReportCsv(text: string): Array<{ country: string; day: string; installs: number }> {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const dateIdx = headers.findIndex((h) => h === 'date');
    const countryIdx = headers.findIndex((h) => h === 'country');
    const installsIdx = headers.findIndex((h) =>
        h.includes('daily device installs') || h === 'daily device installs',
    );

    if (dateIdx < 0 || countryIdx < 0 || installsIdx < 0) return [];

    const rows: Array<{ country: string; day: string; installs: number }> = [];
    for (const line of lines.slice(1)) {
        const cols = parseCsvLine(line);
        const day = cols[dateIdx]?.trim();
        const country = normalizePlayCountry(cols[countryIdx] || '');
        const installs = Number.parseInt(cols[installsIdx]?.replace(/,/g, '') || '0', 10);
        if (!day || !country || !Number.isFinite(installs) || installs <= 0) continue;
        rows.push({ country, day, installs });
    }

    return rows;
}

async function fetchPlayRegionalInstalls(
    windowDays: number,
): Promise<Map<string, number>> {
    const local = readLocalPlayRegionalInstalls(windowDays);
    if (local.size > 0) return local;

    const config = getGooglePlayConfig();
    if (!config) return new Map();

    const token = await createGoogleAccessToken(config.credentials);
    const cutoff = daysAgoIso(windowDays);
    const byCountry = new Map<string, number>();
    const months = monthsForWindow(windowDays);

    for (const month of months) {
        const objectName = `${config.installsPrefix}/installs_${config.packageName}_${month}_country.csv`;
        let buffer: ArrayBuffer | null = null;
        try {
            buffer = await downloadGcsObject(token, config.bucket, objectName);
        } catch {
            continue;
        }
        if (!buffer) continue;

        const rows = parseCountryInstallReportCsv(decodePlayReportText(buffer));
        for (const row of rows) {
            if (row.day < cutoff) continue;
            byCountry.set(row.country, (byCountry.get(row.country) || 0) + row.installs);
        }
    }

    return byCountry;
}

function mergeRegionalAndroidInstalls(
    analytics: DownloadAnalyticsData,
    androidByRegion: Map<string, number>,
): DownloadAnalyticsData {
    if (androidByRegion.size === 0) return analytics;

    const regions = analytics.regions.map((region) => ({
        ...region,
        ios_installs: region.ios_installs ?? region.installs,
        android_installs: androidByRegion.get(region.region) ?? 0,
    }));

    for (const [country, androidInstalls] of androidByRegion.entries()) {
        if (regions.some((region) => region.region === country)) continue;
        regions.push({
            region: country,
            downloads: 0,
            installs: androidInstalls,
            ios_installs: 0,
            android_installs: androidInstalls,
            share_percent: 0,
        });
    }

    const totalCombined = regions.reduce(
        (sum, region) => sum + (region.ios_installs ?? 0) + (region.android_installs ?? 0),
        0,
    );
    for (const region of regions) {
        const combined = (region.ios_installs ?? 0) + (region.android_installs ?? 0);
        region.share_percent = totalCombined > 0 ? Math.round((combined / totalCombined) * 1000) / 10 : region.share_percent;
    }

    regions.sort(
        (a, b) => ((b.ios_installs ?? 0) + (b.android_installs ?? 0)) - ((a.ios_installs ?? 0) + (a.android_installs ?? 0)),
    );

    return { ...analytics, regions };
}

function readLocalPlayDailyInstalls(): Map<string, number> {
    const paths = localInstallCsvPaths();
    if (paths.length === 0) return new Map();

    const byDay = new Map<string, number>();
    for (const path of paths) {
        try {
            const buffer = readFileSync(path);
            const parsed = parseInstallReportCsv(decodePlayReportText(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)));
            for (const [day, installs] of parsed.entries()) {
                byDay.set(day, (byDay.get(day) || 0) + installs);
            }
        } catch (err) {
            console.error('[google-play-connect] local CSV read failed:', path, err instanceof Error ? err.message : err);
        }
    }
    return byDay;
}

function readLocalPlayRegionalInstalls(windowDays: number): Map<string, number> {
    const paths = localInstallCsvPaths().filter((path) => path.includes('_country'));
    if (paths.length === 0) return new Map();

    const cutoff = daysAgoIso(windowDays);
    const byCountry = new Map<string, number>();
    for (const path of paths) {
        try {
            const buffer = readFileSync(path);
            const rows = parseCountryInstallReportCsv(
                decodePlayReportText(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)),
            );
            for (const row of rows) {
                if (row.day < cutoff) continue;
                byCountry.set(row.country, (byCountry.get(row.country) || 0) + row.installs);
            }
        } catch (err) {
            console.error('[google-play-connect] local country CSV read failed:', path, err instanceof Error ? err.message : err);
        }
    }
    return byCountry;
}

async function downloadGcsObject(
    token: string,
    bucket: string,
    objectName: string,
): Promise<ArrayBuffer | null> {
    const encoded = encodeURIComponent(objectName);
    const res = await fetch(`${GCS_API}/b/${bucket}/o/${encoded}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
    });

    if (res.status === 404) return null;
    if (!res.ok) {
        const details = await res.text();
        throw new Error(`GCS download failed (${res.status}) for ${objectName}: ${details.slice(0, 200)}`);
    }

    return res.arrayBuffer();
}

async function fetchPlayDailyInstalls(windowDays: number): Promise<Map<string, number>> {
    const local = readLocalPlayDailyInstalls();
    if (local.size > 0) return local;

    const config = getGooglePlayConfig();
    if (!config) return new Map();

    const token = await createGoogleAccessToken(config.credentials);
    const byDay = new Map<string, number>();
    const months = monthsForWindow(windowDays);

    const dimensions = ['overview', 'country', 'device'];
    for (const month of months) {
        for (const dimension of dimensions) {
            const objectName = `${config.installsPrefix}/installs_${config.packageName}_${month}_${dimension}.csv`;
            let buffer: ArrayBuffer | null = null;
            try {
                buffer = await downloadGcsObject(token, config.bucket, objectName);
            } catch {
                continue;
            }
            if (!buffer) continue;

            const parsed = parseInstallReportCsv(decodePlayReportText(buffer));
            for (const [day, installs] of parsed.entries()) {
                byDay.set(day, (byDay.get(day) || 0) + installs);
            }
            if (dimension === 'overview') break;
        }
    }

    return byDay;
}

export async function verifyGooglePlayAuth(): Promise<{ ok: true } | { ok: false; error: string }> {
    const config = getGooglePlayConfig();
    if (!config) {
        return { ok: false, error: getGooglePlayConfigErrors().join('; ') };
    }

    try {
        const token = await createGoogleAccessToken(config.credentials);
        const res = await fetch(`${GCS_API}/b/${config.bucket}?maxResults=1`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
        });
        if (!res.ok) {
            const details = await res.text();
            return { ok: false, error: `Google Play GCS access failed (${res.status}): ${details.slice(0, 300)}` };
        }
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Unknown Google Play auth error' };
    }
}

export async function mergeGooglePlayInstalls(
    analytics: DownloadAnalyticsData,
    windowDays: number,
): Promise<DownloadAnalyticsData> {
    if (!getGooglePlayConfig() && !hasLocalPlayReports()) {
        return analytics;
    }

    try {
        const [playByDay, androidByRegion] = await Promise.all([
            fetchPlayDailyInstalls(windowDays),
            fetchPlayRegionalInstalls(windowDays),
        ]);

        let merged = analytics;
        if (playByDay.size === 0 && androidByRegion.size === 0) {
            return analytics;
        }

        if (playByDay.size > 0) {
            const cutoff = daysAgoIso(windowDays);
            const dailyMap = new Map(
                merged.daily_downloads.map((row) => [row.day, { ...row, play_installs: row.play_installs ?? 0 }]),
            );

            for (const [day, installs] of playByDay.entries()) {
                if (day < cutoff) continue;
                const existing = dailyMap.get(day) || {
                    day,
                    downloads: 0,
                    installs: 0,
                    updates: 0,
                    play_installs: 0,
                };
                existing.play_installs = installs;
                dailyMap.set(day, existing);
            }

            const daily_downloads = [...dailyMap.values()].sort((a, b) => a.day.localeCompare(b.day));
            const total_play_installs = daily_downloads.reduce((sum, row) => sum + (row.play_installs ?? 0), 0);
            const iosCount = analytics.total_installs;
            const androidCount = total_play_installs;
            const platformTotal = iosCount + androidCount;

            merged = {
                ...merged,
                daily_downloads,
                total_play_installs,
                os_split: platformTotal > 0
                    ? [
                        { os: 'iOS', count: iosCount, share_percent: Math.round((iosCount / platformTotal) * 1000) / 10 },
                        { os: 'Android', count: androidCount, share_percent: Math.round((androidCount / platformTotal) * 1000) / 10 },
                    ]
                    : merged.os_split,
            };
        }

        if (androidByRegion.size > 0) {
            merged = mergeRegionalAndroidInstalls(merged, androidByRegion);
        }

        return merged;
    } catch (err) {
        console.error('[google-play-connect]', err instanceof Error ? err.message : err);
        return analytics;
    }
}

function daysAgoIso(n: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
}
