import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { importPKCS8, SignJWT } from 'jose';
import type { DownloadAnalyticsData, NamedCount, StoreAnalytics } from '@/lib/download-analytics-mock';
import { emptyDailyPoint, emptyStoreAnalytics } from '@/lib/download-analytics-mock';

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
    // UTF-16LE without BOM: ASCII letters with a null between each character.
    if (bytes.length >= 4 && bytes[0] !== 0 && bytes[1] === 0 && bytes[3] === 0) {
        return new TextDecoder('utf-16le').decode(buffer);
    }
    return new TextDecoder('utf-8').decode(buffer);
}

function normalizePlayHeader(header: string): string {
    return header
        .replace(/^\ufeff/, '')
        .replace(/[\u00a0\t]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function normalizePlayDay(raw: string): string {
    const trimmed = raw.replace(/^\ufeff/, '').trim();
    const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const compact = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
    return trimmed.slice(0, 10);
}

function findPlayHeader(headers: string[], match: (header: string) => boolean): number {
    return headers.findIndex(match);
}

function findPlayUpgradeHeader(headers: string[]): number {
    const ranked = [
        (h: string) => /daily device upgrades/.test(h),
        (h: string) => /daily device updates/.test(h),
        (h: string) => /update events/.test(h),
        (h: string) => /upgrade events/.test(h),
        (h: string) => /device upgrades/.test(h),
        (h: string) => /device updates/.test(h),
        (h: string) => /\bupgrades\b/.test(h) && !/uninstall/.test(h),
        (h: string) => /\bupdates\b/.test(h) && !/uninstall/.test(h) && !/active/.test(h),
    ];
    for (const match of ranked) {
        const index = findPlayHeader(headers, match);
        if (index >= 0) return index;
    }
    return -1;
}

function detectPlayDelimiter(headerLine: string): ',' | '\t' {
    const tabs = (headerLine.match(/\t/g) || []).length;
    const commas = (headerLine.match(/,/g) || []).length;
    return tabs > commas ? '\t' : ',';
}

function parseCsvLine(line: string, delimiter: ',' | '\t' = ','): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (ch === delimiter && !inQuotes) {
            cells.push(current.trim());
            current = '';
            continue;
        }
        current += ch;
    }
    cells.push(current.trim());
    return cells;
}

function parsePlayGrid(text: string): { headers: string[]; rows: string[][] } {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    let headerIdx = 0;
    let delimiter: ',' | '\t' = detectPlayDelimiter(lines[0]);
    let headers = parseCsvLine(lines[0], delimiter).map(normalizePlayHeader);

    for (let i = 0; i < Math.min(lines.length, 8); i += 1) {
        const lineDelim = detectPlayDelimiter(lines[i]);
        const candidate = parseCsvLine(lines[i], lineDelim).map(normalizePlayHeader);
        if (findDateHeader(candidate) >= 0 && candidate.length >= 2) {
            headerIdx = i;
            delimiter = lineDelim;
            headers = candidate;
            break;
        }
    }

    return {
        headers,
        rows: lines.slice(headerIdx + 1).map((line) => parseCsvLine(line, delimiter)),
    };
}

function findDateHeader(headers: string[]): number {
    const exact = findPlayHeader(headers, (h) => h === 'date');
    if (exact >= 0) return exact;
    return findPlayHeader(headers, (h) => /^date\b/.test(h));
}

function findDeviceInstallsHeader(headers: string[]): number {
    for (const match of [
        (h: string) => /daily device installs/.test(h) && !/uninstall/.test(h),
        (h: string) => /install events/.test(h) && !/uninstall/.test(h),
        (h: string) => h === 'device installs',
    ]) { const i = findPlayHeader(headers, match); if (i >= 0) return i; }
    return -1;
}

function findDeviceUninstallsHeader(headers: string[]): number {
    for (const match of [
        (h: string) => /daily device uninstall/.test(h),
        (h: string) => /uninstall events/.test(h),
        (h: string) => /daily uninstalls/.test(h),
        (h: string) => h === 'device uninstalls',
    ]) { const i = findPlayHeader(headers, match); if (i >= 0) return i; }
    return -1;
}

function findUserInstallsHeader(headers: string[]): number {
    for (const match of [
        (h: string) => /daily user installs/.test(h) && !/uninstall/.test(h),
        (h: string) => /user install events/.test(h) && !/uninstall/.test(h),
    ]) { const i = findPlayHeader(headers, match); if (i >= 0) return i; }
    return -1;
}

function parseInstallReportCsv(text: string): Map<string, number> {
    const { headers, rows } = parsePlayGrid(text);
    const dateIdx = findDateHeader(headers);
    const installsIdx = findDeviceInstallsHeader(headers);
    if (dateIdx < 0 || installsIdx < 0) return new Map();

    const byDay = new Map<string, number>();
    for (const cols of rows) {
        const day = normalizePlayDay(cols[dateIdx] || '');
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
    const { headers, rows } = parsePlayGrid(text);
    const dateIdx = findDateHeader(headers);
    const activeIdx = findPlayHeader(headers, (h) => /active device installs|installs on active devices/.test(h));
    if (dateIdx < 0 || activeIdx < 0) return new Map();

    const byDay = new Map<string, number>();
    for (const cols of rows) {
        const day = normalizePlayDay(cols[dateIdx] || '');
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
    const { headers, rows: gridRows } = parsePlayGrid(text);
    const dateIdx = findDateHeader(headers);
    const versionIdx = findPlayHeader(headers, (h) => /app version/.test(h));
    const installsIdx = findDeviceInstallsHeader(headers);
    if (dateIdx < 0 || versionIdx < 0 || installsIdx < 0) return [];

    const out: Array<{ version: string; day: string; installs: number }> = [];
    for (const cols of gridRows) {
        const day = normalizePlayDay(cols[dateIdx] || '');
        const rawVersion = cols[versionIdx]?.trim();
        const installs = Number.parseInt(cols[installsIdx]?.replace(/,/g, '') || '0', 10);
        if (!day || !rawVersion || !Number.isFinite(installs) || installs <= 0) continue;
        const version = /^\d+$/.test(rawVersion) ? `Build ${rawVersion}` : rawVersion;
        out.push({ version, day, installs });
    }
    return out;
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
    const { headers, rows: gridRows } = parsePlayGrid(text);
    const dateIdx = findDateHeader(headers);
    const countryIdx = findPlayHeader(headers, (h) => h === 'country');
    const installsIdx = findDeviceInstallsHeader(headers);
    if (dateIdx < 0 || countryIdx < 0 || installsIdx < 0) return [];

    const out: Array<{ country: string; day: string; installs: number }> = [];
    for (const cols of gridRows) {
        const day = normalizePlayDay(cols[dateIdx] || '');
        const country = normalizePlayCountry(cols[countryIdx] || '');
        const installs = Number.parseInt(cols[installsIdx]?.replace(/,/g, '') || '0', 10);
        if (!day || !country || !Number.isFinite(installs) || installs <= 0) continue;
        out.push({ country, day, installs });
    }
    return out;
}

function colNum(cols: string[], idx: number): number {
    if (idx < 0) return 0;
    const parsed = Number.parseFloat((cols[idx] || '').replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

function toNamedMap(entries: Array<{ name: string; count: number }>, limit = 12): NamedCount[] {
    const map = new Map<string, number>();
    for (const row of entries) {
        if (!row.name || row.count <= 0) continue;
        map.set(row.name, (map.get(row.name) || 0) + row.count);
    }
    return [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name, count]) => ({ name, count: Math.round(count) }));
}

type PlayOverviewDay = {
    day: string;
    device_installs: number;
    device_uninstalls: number;
    upgrades: number;
    user_installs: number;
    user_uninstalls: number;
    active_devices: number;
    current_device_installs: number;
    current_user_installs: number;
    total_user_installs: number;
    install_events: number;
    update_events: number;
    uninstall_events: number;
};

function parsePlayOverviewCsv(text: string): PlayOverviewDay[] {
    const { headers, rows: gridRows } = parsePlayGrid(text);
    const dateIdx = findDateHeader(headers);
    if (dateIdx < 0) return [];
    const deviceInstallsIdx = findDeviceInstallsHeader(headers);
    const deviceUninstallsIdx = findDeviceUninstallsHeader(headers);
    const upgradesIdx = findPlayUpgradeHeader(headers);
    const userInstallsIdx = findUserInstallsHeader(headers);
    const userUninstallsIdx = findPlayHeader(headers, (h) => /daily user uninstall/.test(h));
    const activeIdx = findPlayHeader(headers, (h) => /active device installs|installs on active devices/.test(h));
    const currentDeviceIdx = findPlayHeader(headers, (h) => /current device installs/.test(h));
    const currentUserIdx = findPlayHeader(headers, (h) => /current user installs/.test(h));
    const totalUserIdx = findPlayHeader(headers, (h) => /total user installs/.test(h));
    const installEventsIdx = findPlayHeader(headers, (h) => h === 'install events');
    const updateEventsIdx = findPlayHeader(headers, (h) => h === 'update events');
    const uninstallEventsIdx = findPlayHeader(headers, (h) => h === 'uninstall events');
    return gridRows.map((cols) => ({
        day: normalizePlayDay(cols[dateIdx]?.trim() || ''),
        device_installs: colNum(cols, deviceInstallsIdx),
        device_uninstalls: colNum(cols, deviceUninstallsIdx),
        upgrades: colNum(cols, upgradesIdx),
        user_installs: colNum(cols, userInstallsIdx),
        user_uninstalls: colNum(cols, userUninstallsIdx),
        active_devices: colNum(cols, activeIdx),
        current_device_installs: colNum(cols, currentDeviceIdx),
        current_user_installs: colNum(cols, currentUserIdx),
        total_user_installs: colNum(cols, totalUserIdx),
        install_events: colNum(cols, installEventsIdx),
        update_events: colNum(cols, updateEventsIdx),
        uninstall_events: colNum(cols, uninstallEventsIdx),
    })).filter((row) => row.day);
}

function parsePlayDailyUpgrades(text: string): Map<string, number> {
    const { headers, rows } = parsePlayGrid(text);
    const dateIdx = findDateHeader(headers);
    const upgradesIdx = findPlayUpgradeHeader(headers);
    if (dateIdx < 0 || upgradesIdx < 0) return new Map();
    const byDay = new Map<string, number>();
    for (const cols of rows) {
        const day = normalizePlayDay(cols[dateIdx] || '');
        const value = colNum(cols, upgradesIdx);
        if (!day || value <= 0) continue;
        byDay.set(day, (byDay.get(day) || 0) + value);
    }
    return byDay;
}

function parseDimensionCountCsv(
    text: string,
    dimensionHeader: RegExp,
    countHeader: RegExp,
    cutoff: string,
): Array<{ name: string; count: number }> {
    const { headers, rows } = parsePlayGrid(text);
    const dateIdx = findDateHeader(headers);
    const dimIdx = headers.findIndex((h) => dimensionHeader.test(h));
    const countIdx = headers.findIndex((h) => countHeader.test(h));
    if (dimIdx < 0 || countIdx < 0) return [];
    const out: Array<{ name: string; count: number }> = [];
    for (const cols of rows) {
        const day = dateIdx >= 0 ? normalizePlayDay(cols[dateIdx] || '') : cutoff;
        if (day && day < cutoff) continue;
        const name = cols[dimIdx]?.trim() || '';
        const count = colNum(cols, countIdx);
        if (name && count) out.push({ name, count });
    }
    return out;
}

function parseStorePerformanceCsv(text: string, cutoff: string): {
    byDay: Map<string, { visitors: number; acquisitions: number }>;
    byCountry: Array<{ name: string; count: number }>;
    bySource: Array<{ name: string; count: number }>;
    searchTerms: Array<{ name: string; count: number }>;
    utmSources: Array<{ name: string; count: number }>;
    utmCampaigns: Array<{ name: string; count: number }>;
} {
    const byDay = new Map<string, { visitors: number; acquisitions: number }>();
    const byCountry: Array<{ name: string; count: number }> = [];
    const bySource: Array<{ name: string; count: number }> = [];
    const searchTerms: Array<{ name: string; count: number }> = [];
    const utmSources: Array<{ name: string; count: number }> = [];
    const utmCampaigns: Array<{ name: string; count: number }> = [];
    const { headers, rows } = parsePlayGrid(text);
    if (headers.length === 0) {
        return { byDay, byCountry, bySource, searchTerms, utmSources, utmCampaigns };
    }
    const dateIdx = findDateHeader(headers);
    const visitorsIdx = headers.findIndex((h) => h.includes('store listing visitors'));
    const acqIdx = headers.findIndex((h) => h.includes('store listing acquisitions'));
    const countryIdx = headers.findIndex((h) => h === 'country' || h.includes('country/region'));
    const sourceIdx = headers.findIndex((h) => h.includes('traffic source'));
    const termIdx = headers.findIndex((h) => h.includes('search term'));
    const utmSourceIdx = headers.findIndex((h) => h.includes('utm source'));
    const utmCampaignIdx = headers.findIndex((h) => h.includes('utm campaign'));
    for (const cols of rows) {
        const day = dateIdx >= 0 ? normalizePlayDay(cols[dateIdx] || '') : '';
        if (day && day < cutoff) continue;
        const visitors = colNum(cols, visitorsIdx);
        const acquisitions = colNum(cols, acqIdx);
        if (day) {
            const existing = byDay.get(day) || { visitors: 0, acquisitions: 0 };
            existing.visitors += visitors;
            existing.acquisitions += acquisitions;
            byDay.set(day, existing);
        }
        if (countryIdx >= 0) byCountry.push({ name: normalizePlayCountry(cols[countryIdx] || ''), count: acquisitions || visitors });
        if (sourceIdx >= 0) bySource.push({ name: cols[sourceIdx]?.trim() || '', count: visitors || acquisitions });
        if (termIdx >= 0) searchTerms.push({ name: cols[termIdx]?.trim() || '', count: visitors || acquisitions });
        if (utmSourceIdx >= 0) utmSources.push({ name: cols[utmSourceIdx]?.trim() || '', count: visitors || acquisitions });
        if (utmCampaignIdx >= 0) utmCampaigns.push({ name: cols[utmCampaignIdx]?.trim() || '', count: visitors || acquisitions });
    }
    return { byDay, byCountry, bySource, searchTerms, utmSources, utmCampaigns };
}

async function downloadPlayCsv(
    token: string,
    bucket: string,
    objectName: string,
): Promise<string | null> {
    try {
        const buffer = await downloadGcsObject(token, bucket, objectName);
        if (!buffer) return null;
        return decodePlayReportText(buffer);
    } catch {
        return null;
    }
}

async function fetchPlayStoreAnalytics(windowDays: number): Promise<StoreAnalytics | null> {
    const config = getGooglePlayConfig();
    if (!config) return null;
    const token = await createGoogleAccessToken(config.credentials);
    const cutoff = daysAgoIso(windowDays);
    const months = monthsForWindow(windowDays);
    const store = emptyStoreAnalytics();
    store.reports_pending = false;
    const daily = new Map<string, ReturnType<typeof emptyDailyPoint>>();
    const crashesByVersion: Array<{ name: string; count: number }> = [];
    const crashesByDevice: Array<{ name: string; count: number }> = [];
    const crashesByOs: Array<{ name: string; count: number }> = [];
    const anrsByVersion: Array<{ name: string; count: number }> = [];
    const anrsByDevice: Array<{ name: string; count: number }> = [];
    const anrsByOs: Array<{ name: string; count: number }> = [];
    const devices: Array<{ name: string; count: number }> = [];
    const versions: Array<{ name: string; count: number }> = [];
    const osVersions: Array<{ name: string; count: number }> = [];
    const languages: Array<{ name: string; count: number }> = [];
    const carriers: Array<{ name: string; count: number }> = [];
    const crashPrefix = config.installsPrefix.replace(/installs(\/)?$/i, 'crashes$1') || 'stats/crashes';
    const perfPrefix = config.installsPrefix.replace(/stats\/installs/i, 'stats/store_performance')
        .replace(/installs(\/)?$/i, 'store_performance$1') || 'stats/store_performance';

    for (const month of months) {
        const overviewText = await downloadPlayCsv(
            token,
            config.bucket,
            `${config.installsPrefix}/installs_${config.packageName}_${month}_overview.csv`,
        );
        if (overviewText) {
            for (const row of parsePlayOverviewCsv(overviewText)) {
                if (row.day < cutoff) continue;
                const installs = (row.install_events > 0 ? row.install_events : row.device_installs);
                const uninstalls = (row.uninstall_events > 0 ? row.uninstall_events : row.device_uninstalls);
                const upgrades = (row.update_events > 0 ? row.update_events : row.upgrades);
                const userInstalls = row.user_installs || installs;

                const point = daily.get(row.day) || emptyDailyPoint(row.day);
                point.device_installs += installs;
                point.device_uninstalls += uninstalls;
                point.upgrades += upgrades;
                point.updates += upgrades;
                point.user_installs += userInstalls;
                point.user_uninstalls += row.user_uninstalls;
                point.deletions += uninstalls || row.user_uninstalls;
                point.active_devices = row.active_devices || point.active_devices;
                point.installations += installs;
                point.first_time_downloads += userInstalls || installs;
                point.total_downloads += userInstalls || installs;
                daily.set(row.day, point);
                store.device_installs += installs;
                store.device_uninstalls += uninstalls;
                store.upgrades += upgrades;
                store.user_installs += userInstalls;
                store.user_uninstalls += row.user_uninstalls;
                store.current_device_installs = row.current_device_installs || store.current_device_installs;
                store.current_user_installs = row.current_user_installs || store.current_user_installs;
                store.total_user_installs = Math.max(store.total_user_installs, row.total_user_installs);
                store.active_devices = row.active_devices || store.active_devices;
            }
        }

        if (overviewText) {
            const monthHasUpgrades = parsePlayOverviewCsv(overviewText).some(
                (row) => row.day >= cutoff && (row.update_events > 0 || row.upgrades > 0),
            );
            if (!monthHasUpgrades) {
                const versionText = await downloadPlayCsv(
                    token,
                    config.bucket,
                    `${config.installsPrefix}/installs_${config.packageName}_${month}_app_version.csv`,
                );
                if (versionText) {
                    const upgradeDays = parsePlayDailyUpgrades(versionText);
                    for (const [day, upgrades] of upgradeDays.entries()) {
                        if (day < cutoff || upgrades <= 0) continue;
                        const point = daily.get(day) || emptyDailyPoint(day);
                        point.upgrades += upgrades;
                        point.updates += upgrades;
                        daily.set(day, point);
                        store.upgrades += upgrades;
                    }
                }
            }
        }

        const dimFiles: Array<[string, Array<{ name: string; count: number }>, RegExp]> = [
            [`${config.installsPrefix}/installs_${config.packageName}_${month}_device.csv`, devices, /^device$/],
            [`${config.installsPrefix}/installs_${config.packageName}_${month}_app_version.csv`, versions, /app version/],
            [`${config.installsPrefix}/installs_${config.packageName}_${month}_os_version.csv`, osVersions, /os version|android/],
            [`${config.installsPrefix}/installs_${config.packageName}_${month}_language.csv`, languages, /language/],
            [`${config.installsPrefix}/installs_${config.packageName}_${month}_carrier.csv`, carriers, /carrier/],
        ];
        for (const [objectName, bucketArr, dimRe] of dimFiles) {
            const text = await downloadPlayCsv(token, config.bucket, objectName);
            if (!text) continue;
            bucketArr.push(...parseDimensionCountCsv(text, dimRe, /daily device installs|install events/, cutoff));
        }

        const crashFiles: Array<[string, Array<{ name: string; count: number }>, Array<{ name: string; count: number }>, RegExp]> = [
            [`${crashPrefix}/crashes_${config.packageName}_${month}_app_version.csv`, crashesByVersion, anrsByVersion, /app version/],
            [`${crashPrefix}/crashes_${config.packageName}_${month}_device.csv`, crashesByDevice, anrsByDevice, /^device$/],
            [`${crashPrefix}/crashes_${config.packageName}_${month}_os_version.csv`, crashesByOs, anrsByOs, /os version|android/],
        ];
        for (const [objectName, crashArr, anrArr, dimRe] of crashFiles) {
            const text = await downloadPlayCsv(token, config.bucket, objectName);
            if (!text) continue;
            crashArr.push(...parseDimensionCountCsv(text, dimRe, /daily crashes|crash events/, cutoff));
            anrArr.push(...parseDimensionCountCsv(text, dimRe, /daily anrs|anr events/, cutoff));
        }
        const crashOverview = await downloadPlayCsv(
            token,
            config.bucket,
            `${crashPrefix}/crashes_${config.packageName}_${month}_overview.csv`,
        );
        if (crashOverview) {
            const { headers: cHeaders, rows: cRows } = parsePlayGrid(crashOverview);
            const cDateIdx = findDateHeader(cHeaders);
            const crashIdx = cHeaders.findIndex((h) => /daily crashes|crash events|crashes/.test(h));
            const anrIdx = cHeaders.findIndex((h) => /daily anrs|anr events|anrs/.test(h));
            for (const cols of cRows) {
                const day = cDateIdx >= 0 ? normalizePlayDay(cols[cDateIdx] || '') : '';
                if (day && day < cutoff) continue;
                const crashes = colNum(cols, crashIdx);
                const anrs = colNum(cols, anrIdx);
                store.crashes += crashes;
                store.anrs += anrs;
                if (day) {
                    const point = daily.get(day) || emptyDailyPoint(day);
                    point.crashes += crashes;
                    point.anrs += anrs;
                    daily.set(day, point);
                }
            }
        }

        const countryPerf = await downloadPlayCsv(
            token,
            config.bucket,
            `${perfPrefix}/store_performance_${config.packageName}_${month}_country.csv`,
        );
        if (countryPerf) {
            const parsed = parseStorePerformanceCsv(countryPerf, cutoff);
            for (const [day, vals] of parsed.byDay.entries()) {
                const point = daily.get(day) || emptyDailyPoint(day);
                point.listing_visitors += vals.visitors;
                point.listing_acquisitions += vals.acquisitions;
                daily.set(day, point);
                store.listing_visitors += vals.visitors;
                store.listing_acquisitions += vals.acquisitions;
            }
            store.breakdowns.territories = toNamedMap([
                ...store.breakdowns.territories.map((r) => ({ name: r.name, count: r.count })),
                ...parsed.byCountry,
            ]);
        }

        const sourcePerf = await downloadPlayCsv(
            token,
            config.bucket,
            `${perfPrefix}/store_performance_${config.packageName}_${month}_traffic_source.csv`,
        );
        if (sourcePerf) {
            const parsed = parseStorePerformanceCsv(sourcePerf, cutoff);
            store.breakdowns.sources = toNamedMap([
                ...store.breakdowns.sources.map((r) => ({ name: r.name, count: r.count })),
                ...parsed.bySource,
            ]);
            store.breakdowns.search_terms = toNamedMap([
                ...store.breakdowns.search_terms.map((r) => ({ name: r.name, count: r.count })),
                ...parsed.searchTerms,
            ]);
            store.breakdowns.utm_sources = toNamedMap([
                ...store.breakdowns.utm_sources.map((r) => ({ name: r.name, count: r.count })),
                ...parsed.utmSources,
            ]);
            store.breakdowns.utm_campaigns = toNamedMap([
                ...store.breakdowns.utm_campaigns.map((r) => ({ name: r.name, count: r.count })),
                ...parsed.utmCampaigns,
            ]);
        }
    }

    store.daily = [...daily.values()].sort((a, b) => a.day.localeCompare(b.day));
    const latestActive = [...store.daily].reverse().find((row) => row.active_devices > 0);
    if (latestActive) store.active_devices = latestActive.active_devices;
    store.active_last_30_days = store.active_devices;
    store.data_through = store.daily.at(-1)?.day;
    store.total_downloads = store.user_installs || store.device_installs;
    store.first_time_downloads = store.user_installs;
    store.installations = store.device_installs;
    store.deletions = store.device_uninstalls || store.user_uninstalls;
    store.updates = store.upgrades;
    if (store.listing_visitors > 0) {
        store.listing_conversion_percent = Math.round((store.listing_acquisitions / store.listing_visitors) * 1000) / 10;
        store.conversion_percent = store.listing_conversion_percent;
    }
    store.breakdowns.devices = toNamedMap(devices);
    store.breakdowns.versions = toNamedMap(versions.map((row) => ({
        name: /^\d+$/.test(row.name) ? `Build ${row.name}` : row.name,
        count: row.count,
    })));
    store.breakdowns.platform_versions = toNamedMap(osVersions);
    store.breakdowns.languages = toNamedMap(languages);
    store.breakdowns.carriers = toNamedMap(carriers);
    store.breakdowns.crashes_by_version = toNamedMap(crashesByVersion);
    store.breakdowns.crashes_by_device = toNamedMap(crashesByDevice);
    store.breakdowns.crashes_by_os = toNamedMap(crashesByOs);
    store.breakdowns.anrs_by_version = toNamedMap(anrsByVersion);
    store.breakdowns.anrs_by_device = toNamedMap(anrsByDevice);
    store.breakdowns.anrs_by_os = toNamedMap(anrsByOs);
    store.reports_pending = store.device_installs === 0 && store.listing_visitors === 0 && store.crashes === 0;
    return store;
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

    for (const month of months) {
        const objectName = `${config.installsPrefix}/installs_${config.packageName}_${month}_overview.csv`;
        let buffer: ArrayBuffer | null = null;
        try {
            buffer = await downloadGcsObject(token, config.bucket, objectName);
        } catch {
            continue;
        }
        if (!buffer) continue;

        const parsed = parseInstallReportCsv(decodePlayReportText(buffer));
        for (const [day, installs] of parsed.entries()) {
            byDay.set(day, installs);
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
    const { headers, rows } = parsePlayGrid(text);
    const dateIdx = findDateHeader(headers);
    const totalIdx = headers.findIndex((h) => h.includes('total average rating'));
    const dailyIdx = headers.findIndex((h) => h.includes('daily average rating'));
    const ratingIdx = totalIdx >= 0 ? totalIdx : dailyIdx;
    if (dateIdx < 0 || ratingIdx < 0) return new Map();

    const byDay = new Map<string, number>();
    for (const cols of rows) {
        const day = normalizePlayDay(cols[dateIdx] || '');
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
        const [playByDay, androidByRegion, androidActive, androidByVersion, androidReviews, androidRating, androidStore] = await Promise.all([
            fetchPlayDailyInstalls(windowDays),
            fetchPlayRegionalInstalls(windowDays),
            fetchPlayActiveDevices(windowDays).catch(() => 0),
            fetchPlayVersionInstalls(windowDays).catch(() => new Map<string, number>()),
            fetchPlayReviews().catch(() => [] as DownloadAnalyticsData['reviews']),
            fetchPlayAverageRating(windowDays).catch(() => 0),
            fetchPlayStoreAnalytics(windowDays).catch(() => null),
        ]);

        let merged = analytics;
        if (
            playByDay.size === 0 && androidByRegion.size === 0 && androidActive === 0 &&
            androidByVersion.size === 0 && androidReviews.length === 0 && androidRating === 0 &&
            !androidStore
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

        if (androidStore) {
            androidStore.avg_rating = androidRating || androidStore.avg_rating;
            androidStore.rating_count = androidReviews.length || androidStore.rating_count;
            if (androidStore.active_devices === 0 && androidActive > 0) {
                androidStore.active_devices = androidActive;
            }
            if (androidStore.device_installs === 0 && playByDay.size > 0) {
                androidStore.device_installs = [...playByDay.values()].reduce((sum, n) => sum + n, 0);
                androidStore.installations = androidStore.device_installs;
                androidStore.total_downloads = androidStore.device_installs;
            }
            merged = { ...merged, android_store: androidStore };
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
