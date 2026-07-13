import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import { importPKCS8, SignJWT } from 'jose';
import type { DownloadAnalyticsData } from '@/lib/download-analytics-mock';
import { mergeGooglePlayInstalls } from '@/lib/google-play-connect';

const APP_STORE_CONNECT_API = 'https://api.appstoreconnect.apple.com/v1';
const HELIX_APP_BUNDLE_ID = process.env.DOWNLOAD_APP_BUNDLE_ID?.trim() || 'com.helixhealth.app';

type AppStoreConnectConfig = {
    privateKey: string;
    keyId: string;
    issuerId: string;
    vendorNumber?: string;
    appAppleId?: string;
};

type SalesRow = Record<string, string>;
type PublicStoreReview = { author: string; rating: number; comment: string; date: string };
type CrashMetrics = { crashFreeRatePercent?: number; crashReports: { type: string; count: number }[] };

let cachedToken: { token: string; expiresAt: number } | null = null;

function daysAgoIso(n: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
}

function normalizeAppleDay(day: string): string {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(day)) {
        const [month, date, year] = day.split('/');
        return `${year}-${month}-${date}`;
    }
    return day;
}

function normalizePrivateKey(raw: string): string {
    let trimmed = raw.trim();
    if (trimmed.includes('\\n')) {
        trimmed = trimmed.replace(/\\n/g, '\n');
    }
    if (trimmed.startsWith('-----BEGIN')) {
        return trimmed;
    }
    // Support pasting only the base64 body into .env (no PEM headers).
    const body = trimmed.replace(/\s+/g, '');
    const wrapped = body.match(/.{1,64}/g)?.join('\n') ?? body;
    return `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----`;
}

function readPrivateKeyFromEnv(): string | null {
    const inline = process.env.DOWNLOAD_PRIVATE_KEY?.trim();
    if (inline) return normalizePrivateKey(inline);

    const path = process.env.DOWNLOAD_PRIVATE_KEY_PATH?.trim();
    if (!path) return null;

    return readFileSync(path, 'utf8');
}

export function getAppStoreConnectConfig(): AppStoreConnectConfig | null {
    const privateKey = readPrivateKeyFromEnv();
    const keyId = process.env.DOWNLOAD_KEY_ID?.trim();
    const issuerId = process.env.DOWNLOAD_ISSUER_ID?.trim();
    const vendorNumber = process.env.DOWNLOAD_VENDOR_NUMBER?.trim();
    const appAppleId = process.env.DOWNLOAD_APP_APPLE_ID?.trim();

    if (!privateKey || !keyId || !issuerId) {
        return null;
    }

    return { privateKey, keyId, issuerId, vendorNumber, appAppleId };
}

export function getAppStoreConnectConfigErrors(): string[] {
    const errors: string[] = [];
    if (!readPrivateKeyFromEnv()) {
        errors.push('DOWNLOAD_PRIVATE_KEY or DOWNLOAD_PRIVATE_KEY_PATH is missing');
    }
    if (!process.env.DOWNLOAD_KEY_ID?.trim()) {
        errors.push('DOWNLOAD_KEY_ID is missing');
    }
    if (!process.env.DOWNLOAD_ISSUER_ID?.trim()) {
        errors.push('DOWNLOAD_ISSUER_ID is missing');
    }
    if (!process.env.DOWNLOAD_VENDOR_NUMBER?.trim()) {
        errors.push('DOWNLOAD_VENDOR_NUMBER is missing (needed for download reports)');
    }
    return errors;
}

async function createAppStoreConnectToken(config: AppStoreConnectConfig): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (cachedToken && cachedToken.expiresAt - 120 > now) {
        return cachedToken.token;
    }

    const privateKey = await importPKCS8(config.privateKey, 'ES256');
    const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'ES256', kid: config.keyId, typ: 'JWT' })
        .setIssuer(config.issuerId)
        .setAudience('appstoreconnect-v1')
        .setIssuedAt(now)
        .setExpirationTime(now + 20 * 60)
        .sign(privateKey);

    cachedToken = { token, expiresAt: now + 20 * 60 };
    return token;
}

function parseSalesTsv(text: string): SalesRow[] {
    const lines = text.trim().split('\n').filter(Boolean);
    if (lines.length < 2) return [];

    const headers = lines[0].split('\t').map((h) => h.trim());
    return lines.slice(1).map((line) => {
        const values = line.split('\t');
        const row: SalesRow = {};
        headers.forEach((header, index) => {
            row[header] = (values[index] || '').trim();
        });
        return row;
    });
}

function parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') {
            const next = line[i + 1];
            if (inQuotes && next === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (ch === ',' && !inQuotes) {
            out.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    out.push(current);
    return out.map((s) => s.trim());
}

function parseCsv(text: string): Array<Record<string, string>> {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = parseCsvLine(lines[0]);
    return lines.slice(1).map((line) => {
        const values = parseCsvLine(line);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx] || '';
        });
        return row;
    });
}

function firstHeaderMatch(headers: string[], patterns: RegExp[]): string | undefined {
    for (const re of patterns) {
        const found = headers.find((h) => re.test(h.toLowerCase()));
        if (found) return found;
    }
    return undefined;
}

function parseMetricNumber(v: string): number {
    const parsed = Number(String(v || '').replace(/[%,$\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

function unitsForRow(row: SalesRow): number {
    const units = Number.parseInt(row.Units || '0', 10);
    return Number.isFinite(units) ? units : 0;
}

function isDownloadUnit(productType: string): boolean {
    return productType === '1' || productType === '3' || productType.toUpperCase() === 'F1';
}

function isUpdateUnit(productType: string): boolean {
    return productType === '7';
}

function matchesAppFilter(row: SalesRow, appAppleId?: string): boolean {
    if (!appAppleId) return true;
    return row['Apple Identifier'] === appAppleId || row['Parent Identifier'] === appAppleId;
}

function primaryAppleIdFromRows(rows: SalesRow[]): string | undefined {
    const counts = new Map<string, number>();
    for (const row of rows) {
        const id = String(row['Apple Identifier'] || row['Parent Identifier'] || '').trim();
        if (!id) continue;
        counts.set(id, (counts.get(id) || 0) + unitsForRow(row));
    }
    if (counts.size === 0) return undefined;
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

async function fetchPublicStoreMeta(appAppleId: string): Promise<{ avgRating: number; reviewCount: number }> {
    const url = new URL('https://itunes.apple.com/lookup');
    url.searchParams.set('id', appAppleId);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`iTunes lookup failed (${res.status})`);
    const data = await res.json() as { results?: Array<Record<string, unknown>> };
    const app = Array.isArray(data.results) ? data.results[0] : undefined;
    const avg = Number(app?.averageUserRating ?? app?.averageUserRatingForCurrentVersion ?? 0);
    const count = Number(app?.userRatingCount ?? app?.userRatingCountForCurrentVersion ?? 0);
    return {
        avgRating: Number.isFinite(avg) ? avg : 0,
        reviewCount: Number.isFinite(count) ? count : 0,
    };
}

async function lookupAppAppleIdByBundle(bundleId: string): Promise<string | undefined> {
    const url = new URL('https://itunes.apple.com/lookup');
    url.searchParams.set('bundleId', bundleId);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return undefined;
    const data = await res.json() as { results?: Array<Record<string, unknown>> };
    const app = Array.isArray(data.results) ? data.results[0] : undefined;
    const trackId = String(app?.trackId || '').trim();
    return trackId || undefined;
}

function parseRssReviewEntries(entryRaw: unknown): PublicStoreReview[] {
    const entries = Array.isArray(entryRaw) ? entryRaw : (entryRaw ? [entryRaw] : []);

    return entries
        .map((entry) => {
            const rec = entry as Record<string, unknown>;
            const authorObj = rec.author as Record<string, unknown> | undefined;
            const authorNameObj = authorObj?.name as Record<string, unknown> | undefined;
            const ratingObj = rec['im:rating'] as Record<string, unknown> | undefined;
            const contentObj = rec.content as Record<string, unknown> | undefined;
            const updatedObj = rec.updated as Record<string, unknown> | undefined;

            const author = String(authorNameObj?.label || '').trim();
            const rating = Number(String(ratingObj?.label || '0'));
            const comment = String(contentObj?.label || '').trim();
            const date = String(updatedObj?.label || '').trim();

            if (!Number.isFinite(rating) || rating <= 0) return null;
            if (!author || !comment) return null;
            return {
                author,
                rating,
                comment,
                date: date || new Date().toISOString(),
            };
        })
        .filter((review): review is PublicStoreReview => Boolean(review));
}

const ITUNES_RSS_USER_AGENT = 'Mozilla/5.0 (compatible; HelixInternalAnalytics/1.0)';

async function fetchPublicRecentReviews(appAppleId: string): Promise<PublicStoreReview[]> {
    const storefronts = ['us', 'gb', 'ca', 'au', 'gh'];
    const urls = storefronts.flatMap((storefront) => [
        `https://itunes.apple.com/${storefront}/rss/customerreviews/page=1/id=${encodeURIComponent(appAppleId)}/sortby=mostrecent/json`,
        `https://itunes.apple.com/rss/customerreviews/page=1/id=${encodeURIComponent(appAppleId)}/sortby=mostrecent/json?cc=${storefront}`,
    ]);

    for (const url of urls) {
        const res = await fetch(url, {
            cache: 'no-store',
            headers: {
                Accept: 'application/json',
                'User-Agent': ITUNES_RSS_USER_AGENT,
            },
        });
        if (!res.ok) continue;
        const data = await res.json() as {
            feed?: {
                entry?: Array<Record<string, unknown>> | Record<string, unknown>;
            };
        };
        const reviews = parseRssReviewEntries(data.feed?.entry).slice(0, 5);
        if (reviews.length > 0) return reviews;
    }

    return [];
}

async function fetchDailySalesReport(
    config: AppStoreConnectConfig,
    token: string,
    reportDate: string,
): Promise<SalesRow[]> {
    const url = new URL(`${APP_STORE_CONNECT_API}/salesReports`);
    url.searchParams.set('filter[frequency]', 'DAILY');
    url.searchParams.set('filter[reportType]', 'SALES');
    url.searchParams.set('filter[reportSubType]', 'SUMMARY');
    url.searchParams.set('filter[vendorNumber]', config.vendorNumber!);
    url.searchParams.set('filter[reportDate]', reportDate);

    const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
    });

    if (res.status === 404) return [];
    if (!res.ok) {
        const details = await res.text();
        throw new Error(`App Store Connect salesReports ${reportDate} failed (${res.status}): ${details.slice(0, 300)}`);
    }

    const compressed = Buffer.from(await res.arrayBuffer());
    const text = gunzipSync(compressed).toString('utf8');
    return parseSalesTsv(text).filter((row) => matchesAppFilter(row, config.appAppleId));
}

async function fetchCrashMetricsFromAnalyticsReports(
    token: string,
    appAppleId: string,
): Promise<CrashMetrics> {
    const reqRes = await fetch(`${APP_STORE_CONNECT_API}/apps/${appAppleId}/analyticsReportRequests`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
    });
    if (!reqRes.ok) return { crashReports: [] };
    const reqJson = await reqRes.json() as { data?: Array<{ id: string }> };
    const requests = Array.isArray(reqJson.data) ? reqJson.data : [];
    if (requests.length === 0) return { crashReports: [] };

    for (const request of requests) {
        const reportsRes = await fetch(`${APP_STORE_CONNECT_API}/analyticsReportRequests/${request.id}/reports?limit=200`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
        });
        if (!reportsRes.ok) continue;
        const reportsJson = await reportsRes.json() as {
            data?: Array<{
                id: string;
                attributes?: { name?: string; category?: string };
            }>;
        };
        const reports = (reportsJson.data || []).filter((r) => {
            const name = String(r.attributes?.name || '').toUpperCase();
            return name.includes('APP_CRASHES');
        });

        for (const report of reports) {
            const instRes = await fetch(`${APP_STORE_CONNECT_API}/analyticsReports/${report.id}/instances?limit=50`, {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store',
            });
            if (!instRes.ok) continue;
            const instJson = await instRes.json() as { data?: Array<{ id: string }> };
            const instance = Array.isArray(instJson.data) ? instJson.data[0] : undefined;
            if (!instance?.id) continue;

            const segRes = await fetch(`${APP_STORE_CONNECT_API}/analyticsReportInstances/${instance.id}/segments?limit=10`, {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store',
            });
            if (!segRes.ok) continue;
            const segJson = await segRes.json() as {
                data?: Array<{ attributes?: { url?: string } }>;
            };
            const segmentUrl = segJson.data?.[0]?.attributes?.url;
            if (!segmentUrl) continue;

            const rawRes = await fetch(segmentUrl, { cache: 'no-store' });
            if (!rawRes.ok) continue;
            const compressed = Buffer.from(await rawRes.arrayBuffer());
            const csvText = gunzipSync(compressed).toString('utf8');
            const rows = parseCsv(csvText);
            if (rows.length === 0) continue;

            const headers = Object.keys(rows[0]);
            const crashHeader = firstHeaderMatch(headers, [/^crashes?$/, /crash_count/, /total.*crash/]);
            const sessionsHeader = firstHeaderMatch(headers, [/^sessions?$/, /total.*session/]);
            const crashRateHeader = firstHeaderMatch(headers, [/crash.*rate/, /rate.*crash/]);
            const labelHeader = firstHeaderMatch(headers, [/device/, /app.?version/, /platform/, /^dimension$/]);

            let totalCrashes = 0;
            let totalSessions = 0;
            const crashByLabel = new Map<string, number>();
            for (const row of rows) {
                const crashes = crashHeader ? parseMetricNumber(row[crashHeader]) : 0;
                const sessions = sessionsHeader ? parseMetricNumber(row[sessionsHeader]) : 0;
                totalCrashes += crashes;
                totalSessions += sessions;
                if (crashes > 0) {
                    const label = (labelHeader ? String(row[labelHeader] || '') : '').trim() || 'App crashes';
                    crashByLabel.set(label, (crashByLabel.get(label) || 0) + crashes);
                }
            }

            let crashFreeRatePercent: number | undefined;
            if (totalSessions > 0) {
                crashFreeRatePercent = Math.max(0, Math.min(100, (1 - (totalCrashes / totalSessions)) * 100));
            } else if (crashRateHeader) {
                const values = rows.map((row) => parseMetricNumber(row[crashRateHeader])).filter((n) => Number.isFinite(n));
                if (values.length > 0) {
                    // Some reports provide percent (0-100), others fractional (0-1).
                    const avg = values.reduce((s, v) => s + v, 0) / values.length;
                    const normalized = avg > 1 ? avg : avg * 100;
                    crashFreeRatePercent = Math.max(0, Math.min(100, 100 - normalized));
                }
            }

            const crashReports = [...crashByLabel.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([type, count]) => ({ type, count: Math.round(count) }));

            return { crashFreeRatePercent, crashReports };
        }
    }

    return { crashReports: [] };
}

/**
 * Best-effort real iOS active-devices count from App Store Connect Analytics reports.
 * Apple only exposes this when an analytics report request has been provisioned and a
 * report with an "active devices" metric exists; otherwise we return undefined and the
 * caller falls back to install counts.
 */
async function fetchActiveDevicesFromAnalyticsReports(
    token: string,
    appAppleId: string,
): Promise<number | undefined> {
    const reqRes = await fetch(`${APP_STORE_CONNECT_API}/apps/${appAppleId}/analyticsReportRequests`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
    });
    if (!reqRes.ok) return undefined;
    const reqJson = await reqRes.json() as { data?: Array<{ id: string }> };
    const requests = Array.isArray(reqJson.data) ? reqJson.data : [];
    if (requests.length === 0) return undefined;

    for (const request of requests) {
        const reportsRes = await fetch(`${APP_STORE_CONNECT_API}/analyticsReportRequests/${request.id}/reports?limit=200`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
        });
        if (!reportsRes.ok) continue;
        const reportsJson = await reportsRes.json() as {
            data?: Array<{ id: string; attributes?: { name?: string } }>;
        };
        const reports = (reportsJson.data || []).filter((r) => {
            const name = String(r.attributes?.name || '').toUpperCase();
            return name.includes('INSTALL') || name.includes('SESSION') || name.includes('ACTIVE');
        });

        for (const report of reports) {
            const instRes = await fetch(`${APP_STORE_CONNECT_API}/analyticsReports/${report.id}/instances?limit=50`, {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store',
            });
            if (!instRes.ok) continue;
            const instJson = await instRes.json() as { data?: Array<{ id: string }> };
            const instance = Array.isArray(instJson.data) ? instJson.data[0] : undefined;
            if (!instance?.id) continue;

            const segRes = await fetch(`${APP_STORE_CONNECT_API}/analyticsReportInstances/${instance.id}/segments?limit=10`, {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store',
            });
            if (!segRes.ok) continue;
            const segJson = await segRes.json() as { data?: Array<{ attributes?: { url?: string } }> };
            const segmentUrl = segJson.data?.[0]?.attributes?.url;
            if (!segmentUrl) continue;

            const rawRes = await fetch(segmentUrl, { cache: 'no-store' });
            if (!rawRes.ok) continue;
            const compressed = Buffer.from(await rawRes.arrayBuffer());
            const csvText = gunzipSync(compressed).toString('utf8');
            const csvRows = parseCsv(csvText);
            if (csvRows.length === 0) continue;

            const headers = Object.keys(csvRows[0]);
            const activeHeader = firstHeaderMatch(headers, [/active.*devices?/, /devices?.*active/]);
            const dateHeader = firstHeaderMatch(headers, [/^date$/, /day/]);
            if (!activeHeader) continue;

            // Active devices is a point-in-time value: take the most recent date's total.
            if (dateHeader) {
                const byDay = new Map<string, number>();
                for (const row of csvRows) {
                    const day = String(row[dateHeader] || '').trim();
                    if (!day) continue;
                    byDay.set(day, (byDay.get(day) || 0) + parseMetricNumber(row[activeHeader]));
                }
                const latest = [...byDay.keys()].sort().at(-1);
                if (latest) return Math.round(byDay.get(latest) ?? 0);
            }
            const total = csvRows.reduce((sum, row) => sum + parseMetricNumber(row[activeHeader]), 0);
            if (total > 0) return Math.round(total);
        }
    }

    return undefined;
}

function aggregateSalesRows(rows: SalesRow[]): DownloadAnalyticsData {
    const dailyMap = new Map<string, { downloads: number; installs: number; updates: number }>();
    const versionMap = new Map<string, number>();
    const regionMap = new Map<string, { downloads: number; installs: number }>();

    for (const row of rows) {
        const productType = row['Product Type Identifier'] || '';
        const units = unitsForRow(row);
        if (units <= 0) continue;

        const day = normalizeAppleDay(row['Begin Date'] || row['End Date'] || '');
        if (!day) continue;

        const daily = dailyMap.get(day) || { downloads: 0, installs: 0, updates: 0 };
        if (isDownloadUnit(productType)) {
            daily.downloads += units;
            daily.installs += units;
        } else if (isUpdateUnit(productType)) {
            daily.updates += units;
        }
        dailyMap.set(day, daily);

        const version = row.Version || 'Unknown';
        if (isDownloadUnit(productType)) {
            versionMap.set(version, (versionMap.get(version) || 0) + units);
        }

        const region = row['Country Code'] || 'Unknown';
        const regionTotals = regionMap.get(region) || { downloads: 0, installs: 0 };
        if (isDownloadUnit(productType)) {
            regionTotals.downloads += units;
            regionTotals.installs += units;
        }
        regionMap.set(region, regionTotals);
    }

    const daily_downloads = [...dailyMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, totals]) => ({ day, ...totals, play_installs: 0 }));

    const total_downloads = daily_downloads.reduce((sum, row) => sum + row.downloads, 0);
    const total_installs = daily_downloads.reduce((sum, row) => sum + row.installs, 0);
    const total_updates = daily_downloads.reduce((sum, row) => sum + row.updates, 0);

    const versionEntries = [...versionMap.entries()].sort((a, b) => b[1] - a[1]);
    const version_breakdown = versionEntries.map(([version, installs]) => ({
        version,
        installs,
        share_percent: total_installs > 0 ? Math.round((installs / total_installs) * 1000) / 10 : 0,
    }));

    const regionEntries = [...regionMap.entries()].sort((a, b) => b[1].downloads - a[1].downloads);
    const regions = regionEntries.map(([region, totals]) => ({
        region,
        downloads: totals.downloads,
        installs: totals.installs,
        ios_installs: totals.installs,
        android_installs: 0,
        share_percent: total_downloads > 0 ? Math.round((totals.downloads / total_downloads) * 1000) / 10 : 0,
    }));

    return {
        window_days: daily_downloads.length,
        total_downloads,
        total_installs,
        // Baseline fallback; overridden with a real active-devices figure when the
        // App Store Connect Analytics report exposes one (see fetchAppleDownloadAnalytics).
        active_devices: total_installs,
        avg_rating: 0,
        rating_count: 0,
        review_count: 0,
        crash_free_rate_percent: 0,
        install_conversion_percent: total_downloads > 0
            ? Math.round((total_installs / total_downloads) * 1000) / 10
            : 0,
        total_play_installs: 0,
        daily_downloads,
        version_breakdown,
        crash_reports: [],
        diagnostics: [],
        reviews: [],
        regions,
        devices: [],
        os_split: [{ os: 'iOS', count: total_installs, share_percent: 100 }],
    };
}

export async function verifyAppStoreConnectAuth(): Promise<{ ok: true; appCount: number } | { ok: false; error: string }> {
    const config = getAppStoreConnectConfig();
    if (!config) {
        return { ok: false, error: getAppStoreConnectConfigErrors().join('; ') };
    }

    try {
        const token = await createAppStoreConnectToken(config);
        const res = await fetch(`${APP_STORE_CONNECT_API}/apps?limit=5`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
        });
        if (!res.ok) {
            const details = await res.text();
            return { ok: false, error: `App Store Connect auth failed (${res.status}): ${details.slice(0, 300)}` };
        }
        const payload = await res.json() as { data?: unknown[] };
        return { ok: true, appCount: Array.isArray(payload.data) ? payload.data.length : 0 };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Unknown auth error' };
    }
}

export async function fetchAppleDownloadAnalytics(windowDays = 30): Promise<DownloadAnalyticsData> {
    const config = getAppStoreConnectConfig();
    if (!config) {
        throw new Error(getAppStoreConnectConfigErrors().join('; '));
    }

    if (!config.vendorNumber) {
        const auth = await verifyAppStoreConnectAuth();
        if (!auth.ok) {
            throw new Error(auth.error);
        }
        throw new Error(
            'DOWNLOAD_VENDOR_NUMBER is missing. In App Store Connect go to Agreements, Tax, and Banking → Payments and Financial Reports and copy your Vendor Number (free apps still have one after accepting the standard agreement).',
        );
    }

    const token = await createAppStoreConnectToken(config);
    const rows: SalesRow[] = [];

    // Apple daily sales reports are usually delayed by 1–2 days.
    for (let offset = 2; offset < windowDays + 2; offset += 1) {
        const reportDate = daysAgoIso(offset);
        const dayRows = await fetchDailySalesReport(config, token, reportDate);
        rows.push(...dayRows);
    }

    const analytics = aggregateSalesRows(rows);
    let appAppleId = config.appAppleId || primaryAppleIdFromRows(rows);
    if (!appAppleId) {
        appAppleId = await lookupAppAppleIdByBundle(HELIX_APP_BUNDLE_ID);
    }
    if (appAppleId) {
        try {
            const [meta, reviews, crashMetrics, iosActiveDevices] = await Promise.all([
                fetchPublicStoreMeta(appAppleId),
                fetchPublicRecentReviews(appAppleId),
                fetchCrashMetricsFromAnalyticsReports(token, appAppleId),
                fetchActiveDevicesFromAnalyticsReports(token, appAppleId).catch(() => undefined),
            ]);
            analytics.avg_rating = meta.avgRating;
            analytics.rating_count = meta.reviewCount;
            analytics.reviews = reviews;
            analytics.review_count = reviews.length;
            if (typeof crashMetrics.crashFreeRatePercent === 'number' && Number.isFinite(crashMetrics.crashFreeRatePercent)) {
                analytics.crash_free_rate_percent = Math.round(crashMetrics.crashFreeRatePercent * 10) / 10;
            }
            analytics.crash_reports = crashMetrics.crashReports;
            if (typeof iosActiveDevices === 'number' && Number.isFinite(iosActiveDevices) && iosActiveDevices > 0) {
                analytics.ios_active_devices = iosActiveDevices;
                analytics.active_devices = iosActiveDevices;
            }
        } catch {
            // Keep sales analytics even when metadata/reviews are unavailable.
        }
    }
    // Ensure a per-platform iOS figure exists for the dashboard even without an analytics report.
    if (typeof analytics.ios_active_devices !== 'number') {
        analytics.ios_active_devices = analytics.total_installs;
    }
    analytics.window_days = windowDays;
    return mergeGooglePlayInstalls(analytics, windowDays);
}
