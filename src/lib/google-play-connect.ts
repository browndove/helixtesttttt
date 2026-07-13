import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { importPKCS8, SignJWT } from 'jose';
import type { DownloadAnalyticsData } from '@/lib/download-analytics-mock';

const GCS_SCOPE = 'https://www.googleapis.com/auth/devstorage.read_only';
const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GCS_API = 'https://storage.googleapis.com/storage/v1';
const ANDROID_PUBLISHER_API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

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

const cachedGoogleTokens = new Map<string, { token: string; expiresAt: number }>();

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

async function createGoogleAccessToken(
    credentials: GoogleServiceAccount,
    scope: string = GCS_SCOPE,
): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const cached = cachedGoogleTokens.get(scope);
    if (cached && cached.expiresAt - 120 > now) {
        return cached.token;
    }

    const privateKey = await importPKCS8(credentials.private_key, 'RS256');
    const assertion = await new SignJWT({ scope })
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

    cachedGoogleTokens.set(scope, {
        token: payload.access_token,
        expiresAt: now + (payload.expires_in ?? 3600),
    });
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

/**
 * Google Play overview install reports include an "Active Device Installs" column
 * (the current installed base as of each date). Unlike daily installs this is a
 * point-in-time cumulative value, so callers should take the most recent day.
 */
function parseActiveDeviceInstalls(text: string): Map<string, number> {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) return new Map();

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const dateIdx = headers.findIndex((h) => h === 'date');
    const activeIdx = headers.findIndex((h) => h.includes('active device installs'));

    if (dateIdx < 0 || activeIdx < 0) return new Map();

    const byDay = new Map<string, number>();
    for (const line of lines.slice(1)) {
        const cols = parseCsvLine(line);
        const day = cols[dateIdx]?.trim();
        const active = Number.parseInt(cols[activeIdx]?.replace(/,/g, '') || '0', 10);
        if (!day || !Number.isFinite(active) || active < 0) continue;
        byDay.set(day, active);
    }

    return byDay;
}

/**
 * Google Play "app_version" install report: installs grouped by App Version Code.
 * Android reports expose the integer version code (not the semantic name), so we
 * label rows as build numbers.
 */
function parseVersionInstallReportCsv(text: string): Array<{ version: string; day: string; installs: number }> {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const dateIdx = headers.findIndex((h) => h === 'date');
    const versionIdx = headers.findIndex((h) => h.includes('app version'));
    const installsIdx = headers.findIndex((h) => h.includes('daily device installs'));

    if (dateIdx < 0 || versionIdx < 0 || installsIdx < 0) return [];

    const rows: Array<{ version: string; day: string; installs: number }> = [];
    for (const line of lines.slice(1)) {
        const cols = parseCsvLine(line);
        const day = cols[dateIdx]?.trim();
        const rawVersion = cols[versionIdx]?.trim();
        const installs = Number.parseInt(cols[installsIdx]?.replace(/,/g, '') || '0', 10);
        if (!day || !rawVersion || !Number.isFinite(installs) || installs <= 0) continue;
        const version = /^\d+$/.test(rawVersion) ? `Build ${rawVersion}` : rawVersion;
        rows.push({ version, day, installs });
    }

    return rows;
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

/** Most recent "Active Device Installs" value (current Android install base) within the window. */
async function fetchPlayActiveDevices(windowDays: number): Promise<number> {
    const config = getGooglePlayConfig();
    if (!config) return 0;

    const token = await createGoogleAccessToken(config.credentials);
    const cutoff = daysAgoIso(windowDays);
    const byDay = new Map<string, number>();
    const months = monthsForWindow(windowDays);

    for (const month of months) {
        const objectName = `${config.installsPrefix}/installs_${config.packageName}_${month}_overview.csv`;
        let buffer: ArrayBuffer | null = null;
        try {
            buffer = await downloadGcsObject(token, config.bucket, objectName);
        } catch {
            continue;
        }
        if (!buffer) continue;

        const parsed = parseActiveDeviceInstalls(decodePlayReportText(buffer));
        for (const [day, active] of parsed.entries()) {
            byDay.set(day, active);
        }
    }

    const days = [...byDay.keys()].filter((day) => day >= cutoff).sort();
    const latest = days.at(-1);
    return latest ? (byDay.get(latest) ?? 0) : 0;
}

/** Android installs grouped by app version code within the window. */
async function fetchPlayVersionInstalls(windowDays: number): Promise<Map<string, number>> {
    const config = getGooglePlayConfig();
    if (!config) return new Map();

    const token = await createGoogleAccessToken(config.credentials);
    const cutoff = daysAgoIso(windowDays);
    const byVersion = new Map<string, number>();
    const months = monthsForWindow(windowDays);

    for (const month of months) {
        const objectName = `${config.installsPrefix}/installs_${config.packageName}_${month}_app_version.csv`;
        let buffer: ArrayBuffer | null = null;
        try {
            buffer = await downloadGcsObject(token, config.bucket, objectName);
        } catch {
            continue;
        }
        if (!buffer) continue;

        const rows = parseVersionInstallReportCsv(decodePlayReportText(buffer));
        for (const row of rows) {
            if (row.day < cutoff) continue;
            byVersion.set(row.version, (byVersion.get(row.version) || 0) + row.installs);
        }
    }

    return byVersion;
}

/** Recent Google Play reviews via the Play Developer API (reviews with written comments, last ~7 days). */
async function fetchPlayReviews(): Promise<DownloadAnalyticsData['reviews']> {
    const config = getGooglePlayConfig();
    if (!config) return [];

    let token: string;
    try {
        token = await createGoogleAccessToken(config.credentials, ANDROID_PUBLISHER_SCOPE);
    } catch {
        return [];
    }

    const res = await fetch(
        `${ANDROID_PUBLISHER_API}/applications/${config.packageName}/reviews?maxResults=10`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    );
    if (!res.ok) return [];

    const json = await res.json() as {
        reviews?: Array<{
            authorName?: string;
            comments?: Array<{
                userComment?: { text?: string; starRating?: number; lastModified?: { seconds?: string | number } };
            }>;
        }>;
    };

    const reviews: DownloadAnalyticsData['reviews'] = [];
    for (const review of json.reviews ?? []) {
        const userComment = review.comments?.find((c) => c.userComment)?.userComment;
        if (!userComment) continue;
        const text = (userComment.text || '').trim();
        const rating = Number(userComment.starRating || 0);
        if (!text || rating <= 0) continue;
        const seconds = Number(userComment.lastModified?.seconds || 0);
        const date = seconds > 0 ? new Date(seconds * 1000).toISOString().slice(0, 10) : '';
        reviews.push({
            author: (review.authorName || '').trim() || 'Google Play user',
            rating,
            comment: text,
            date,
            source: 'android',
        });
    }

    return reviews;
}

function parseRatingsReportCsv(text: string): Map<string, number> {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) return new Map();

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const dateIdx = headers.findIndex((h) => h === 'date');
    const totalIdx = headers.findIndex((h) => h.includes('total average rating'));
    const dailyIdx = headers.findIndex((h) => h.includes('daily average rating'));
    const ratingIdx = totalIdx >= 0 ? totalIdx : dailyIdx;

    if (dateIdx < 0 || ratingIdx < 0) return new Map();

    const byDay = new Map<string, number>();
    for (const line of lines.slice(1)) {
        const cols = parseCsvLine(line);
        const day = cols[dateIdx]?.trim();
        const rating = Number.parseFloat(cols[ratingIdx]?.replace(/,/g, '') || '');
        if (!day || !Number.isFinite(rating) || rating <= 0) continue;
        byDay.set(day, rating);
    }

    return byDay;
}

/** Most recent Google Play cumulative average rating within the window. */
async function fetchPlayAverageRating(windowDays: number): Promise<number> {
    const config = getGooglePlayConfig();
    if (!config) return 0;

    const ratingsPrefix = config.installsPrefix.replace(/installs(\/)?$/i, 'ratings$1') || 'stats/ratings';
    const token = await createGoogleAccessToken(config.credentials);
    const byDay = new Map<string, number>();
    const months = monthsForWindow(windowDays);

    for (const month of months) {
        const objectName = `${ratingsPrefix}/ratings_${config.packageName}_${month}_overview.csv`;
        let buffer: ArrayBuffer | null = null;
        try {
            buffer = await downloadGcsObject(token, config.bucket, objectName);
        } catch {
            continue;
        }
        if (!buffer) continue;

        const parsed = parseRatingsReportCsv(decodePlayReportText(buffer));
        for (const [day, rating] of parsed.entries()) {
            byDay.set(day, rating);
        }
    }

    const latest = [...byDay.keys()].sort().at(-1);
    return latest ? (byDay.get(latest) ?? 0) : 0;
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
        const [playByDay, androidByRegion, androidActive, androidByVersion, androidReviews, androidRating] = await Promise.all([
            fetchPlayDailyInstalls(windowDays),
            fetchPlayRegionalInstalls(windowDays),
            fetchPlayActiveDevices(windowDays).catch(() => 0),
            fetchPlayVersionInstalls(windowDays).catch(() => new Map<string, number>()),
            fetchPlayReviews().catch(() => [] as DownloadAnalyticsData['reviews']),
            fetchPlayAverageRating(windowDays).catch(() => 0),
        ]);

        let merged = analytics;
        if (
            playByDay.size === 0 && androidByRegion.size === 0 && androidActive === 0 &&
            androidByVersion.size === 0 && androidReviews.length === 0 && androidRating === 0
        ) {
            return analytics;
        }

        if (androidReviews.length > 0 || androidRating > 0) {
            const iosReviews = (merged.reviews ?? []).map((r) => ({
                ...r,
                source: r.source ?? ('ios' as const),
            }));
            const combined = [...iosReviews, ...androidReviews].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            merged = {
                ...merged,
                reviews: combined,
                android_avg_rating: androidRating > 0 ? Math.round(androidRating * 10) / 10 : merged.android_avg_rating,
                android_rating_count: androidReviews.length > 0 ? androidReviews.length : merged.android_rating_count,
            };
        }

        if (androidByVersion.size > 0) {
            const versionTotal = [...androidByVersion.values()].reduce((sum, n) => sum + n, 0);
            const android_version_breakdown = [...androidByVersion.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([version, installs]) => ({
                    version,
                    installs,
                    share_percent: versionTotal > 0 ? Math.round((installs / versionTotal) * 1000) / 10 : 0,
                }));
            merged = { ...merged, android_version_breakdown };
        }

        if (androidActive > 0) {
            const iosActive = analytics.ios_active_devices ?? analytics.active_devices ?? 0;
            merged = {
                ...merged,
                android_active_devices: androidActive,
                active_devices: iosActive + androidActive,
            };
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
