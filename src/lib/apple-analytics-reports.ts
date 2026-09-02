import { gunzipSync } from 'zlib';
import {
    emptyDailyPoint,
    emptyStoreAnalytics,
    type NamedCount,
    type StoreAnalytics,
    type StoreDailyPoint,
} from '@/lib/download-analytics-mock';

const API = 'https://api.appstoreconnect.apple.com/v1';
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_INSTANCES_PER_REPORT = 90;

type ReportRow = Record<string, string>;
type ReportKind = 'discovery' | 'downloads' | 'sessions' | 'crashes' | 'installs' | 'installs_detailed' | 'optin' | 'retention' | 'other';

let storeCache: { key: string; at: number; data: StoreAnalytics } | null = null;

function authHeaders(token: string): HeadersInit {
    return { Authorization: `Bearer ${token}` };
}

function parseMetricNumber(v: string): number {
    const parsed = Number(String(v || '').replace(/[%,$\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
    if (delimiter === '\t') return line.split('\t').map((s) => s.trim());
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
        if (ch === delimiter && !inQuotes) {
            out.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    out.push(current);
    return out.map((s) => s.trim());
}

function parseDelimited(text: string): ReportRow[] {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headerLine = lines[0];
    const tabs = (headerLine.match(/\t/g) || []).length;
    const commas = (headerLine.match(/,/g) || []).length;
    const delimiter = tabs >= commas ? '\t' : ',';
    const headers = parseDelimitedLine(headerLine, delimiter);
    return lines.slice(1).map((line) => {
        const values = parseDelimitedLine(line, delimiter);
        const row: ReportRow = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx] || '';
        });
        return row;
    });
}

function firstHeader(headers: string[], patterns: RegExp[]): string | undefined {
    for (const re of patterns) {
        const found = headers.find((h) => re.test(h.toLowerCase()));
        if (found) return found;
    }
    return undefined;
}

function normalizeDay(day: string): string {
    const trimmed = String(day || '').trim().replace(/^['"]|['"]$/g, '');
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
        const [month, date, year] = trimmed.split('/');
        return `${year}-${month}-${date}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    const compact = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
    return trimmed;
}

function classifyReport(name: string): ReportKind {
    const n = name.toUpperCase().trim();
    if (n.startsWith('APP STORE DISCOVERY AND ENGAGEMENT')) return 'discovery';
    if (n.startsWith('APP DOWNLOADS')) return 'downloads';
    if (n.startsWith('APP SESSIONS')) return 'sessions';
    if (n === 'APP CRASHES' || n.startsWith('APP CRASHES ')) return 'crashes';
    if (n.includes('INSTALLATION AND DELETION') || (n.includes('INSTALLATION') && n.includes('DELETION'))) {
        return n.includes('DETAILED') ? 'installs_detailed' : 'installs';
    }
    if (n === 'APP OPT IN' || n.startsWith('APP OPT-IN') || n.startsWith('APP OPT IN ')) return 'optin';
    return 'other';
}

function toNamed(map: Map<string, number>, limit = 12): NamedCount[] {
    return [...map.entries()]
        .filter(([name, count]) => name && count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name, count]) => ({ name, count: Math.round(count) }));
}

function addCount(map: Map<string, number>, name: string, n: number) {
    const key = name.trim();
    if (!key || n === 0) return;
    map.set(key, (map.get(key) || 0) + n);
}

function dayBucket(daily: Map<string, StoreDailyPoint>, day: string): StoreDailyPoint {
    const existing = daily.get(day);
    if (existing) return existing;
    const created = emptyDailyPoint(day);
    daily.set(day, created);
    return created;
}

async function jsonGet<T>(url: string, token: string): Promise<T | null> {
    const res = await fetch(url, { headers: authHeaders(token), cache: 'no-store' });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
}

type AnalyticsAccessType = 'ONGOING' | 'ONE_TIME_SNAPSHOT';

async function ensureReportRequest(
    token: string,
    appAppleId: string,
    accessType: AnalyticsAccessType,
): Promise<string | null> {
    const existing = await jsonGet<{ data?: Array<{ id: string }> }>(
        `${API}/apps/${appAppleId}/analyticsReportRequests?filter[accessType]=${accessType}&limit=10`,
        token,
    );
    const id = existing?.data?.[0]?.id;
    if (id) return id;

    const res = await fetch(`${API}/analyticsReportRequests`, {
        method: 'POST',
        headers: {
            ...authHeaders(token),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            data: {
                type: 'analyticsReportRequests',
                attributes: { accessType },
                relationships: {
                    app: { data: { type: 'apps', id: appAppleId } },
                },
            },
        }),
        cache: 'no-store',
    });
    if (!res.ok) {
        const details = await res.text().catch(() => '');
        console.warn(`[apple-analytics-reports] could not create ${accessType} request:`, res.status, details.slice(0, 200));
        return existing?.data?.[0]?.id || null;
    }
    const created = await res.json() as { data?: { id?: string } };
    return created.data?.id || null;
}

async function downloadSegmentRows(url: string): Promise<ReportRow[]> {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const compressed = Buffer.from(await res.arrayBuffer());
    let text: string;
    try {
        text = gunzipSync(compressed).toString('utf8');
    } catch {
        text = compressed.toString('utf8');
    }
    return parseDelimited(text);
}

async function rowsForReport(
    token: string,
    reportId: string,
    cutoff: string,
    options?: { ignoreProcessingCutoff?: boolean },
): Promise<ReportRow[]> {
    const instJson = await jsonGet<{
        data?: Array<{ id: string; attributes?: { granularity?: string; processingDate?: string } }>;
    }>(`${API}/analyticsReports/${reportId}/instances?limit=200`, token);
    const instances = (instJson?.data || [])
        .filter((i) => !i.attributes?.granularity || i.attributes.granularity === 'DAILY')
        .sort((a, b) => String(b.attributes?.processingDate || '').localeCompare(String(a.attributes?.processingDate || '')))
        .slice(0, MAX_INSTANCES_PER_REPORT);

    const collected: ReportRow[] = [];
    for (const instance of instances) {
        const proc = String(instance.attributes?.processingDate || '');
        if (!options?.ignoreProcessingCutoff && proc && proc < cutoff) continue;
        const segJson = await jsonGet<{ data?: Array<{ attributes?: { url?: string } }> }>(
            `${API}/analyticsReportInstances/${instance.id}/segments?limit=10`,
            token,
        );
        const url = segJson?.data?.[0]?.attributes?.url;
        if (!url) continue;
        const rows = await downloadSegmentRows(url);
        collected.push(...rows);
        const headers = rows[0] ? Object.keys(rows[0]) : [];
        const dateHeader = firstHeader(headers, [/^date$/, /begin.?date/, /processing.?date/]);
        if (dateHeader && !options?.ignoreProcessingCutoff) {
            const dates = rows.map((r) => normalizeDay(r[dateHeader])).filter(Boolean).sort();
            if (dates[0] && dates[0] <= cutoff && dates.at(-1)) {
                break;
            }
        }
    }
    return collected;
}

function rowDay(row: ReportRow): string {
    const headers = Object.keys(row);
    const dateH = firstHeader(headers, [/^date$/, /begin.?date/]);
    return dateH ? normalizeDay(row[dateH] || '') : '';
}

function mergeSnapshotAndOngoing(snapshot: ReportRow[], ongoing: ReportRow[]): ReportRow[] {
    if (snapshot.length === 0) return ongoing;
    if (ongoing.length === 0) return snapshot;
    const snapshotDays = new Set(snapshot.map(rowDay).filter(Boolean));
    return [...snapshot, ...ongoing.filter((row) => {
        const day = rowDay(row);
        return !day || !snapshotDays.has(day);
    })];
}

async function downloadWantedReports(
    token: string,
    requestId: string,
    cutoff: string,
    ignoreProcessingCutoff: boolean,
): Promise<Array<{ kind: ReportKind; rows: ReportRow[] }>> {
    const reportsJson = await jsonGet<{
        data?: Array<{ id: string; attributes?: { name?: string } }>;
    }>(`${API}/analyticsReportRequests/${requestId}/reports?limit=200`, token);
    const wanted = (reportsJson?.data || []).filter((r) => classifyReport(String(r.attributes?.name || '')) !== 'other');
    return Promise.all(wanted.map(async (report) => {
        const kind = classifyReport(String(report.attributes?.name || ''));
        try {
            const rows = await rowsForReport(token, report.id, cutoff, { ignoreProcessingCutoff });
            return { kind, rows };
        } catch (err) {
            console.warn('[apple-analytics-reports]', kind, err instanceof Error ? err.message : err);
            return { kind, rows: [] as ReportRow[] };
        }
    }));
}

function applyDiscovery(store: StoreAnalytics, rows: ReportRow[], cutoff: string, daily: Map<string, StoreDailyPoint>) {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const dateH = firstHeader(headers, [/^date$/]);
    const eventH = firstHeader(headers, [/^event$/, /engagement.?type/, /page.?type/]);
    const countsH = firstHeader(headers, [/^counts?$/, /^count$/, /total.?count/]);
    const uniqueH = firstHeader(headers, [/unique.?counts?/, /unique.?devices?/]);
    const sourceH = firstHeader(headers, [/source.?type/]);
    const sourceInfoH = firstHeader(headers, [/source.?info/, /referrer/]);
    const deviceH = firstHeader(headers, [/^device$/]);
    const territoryH = firstHeader(headers, [/territory/, /country/]);
    const pageTypeH = firstHeader(headers, [/page.?type/]);
    const campaignH = firstHeader(headers, [/campaign/]);
    const pageH = firstHeader(headers, [/product.?page/, /page.?title/, /page.?name/]);

    const sources = new Map<string, number>();
    const appRefs = new Map<string, number>();
    const webRefs = new Map<string, number>();
    const campaigns = new Map<string, number>();
    const territories = new Map<string, number>();
    const devices = new Map<string, number>();
    const pageTypes = new Map<string, number>();
    const productPages = new Map<string, number>();

    for (const row of rows) {
        const day = dateH ? normalizeDay(row[dateH]) : '';
        if (day && day < cutoff) continue;
        const event = String(eventH ? row[eventH] : '').toLowerCase();
        const counts = countsH ? parseMetricNumber(row[countsH]) : 0;
        const unique = uniqueH ? parseMetricNumber(row[uniqueH]) : 0;
        const isImpression = event.includes('impression');
        const isPage = event.includes('page') && event.includes('view');
        if (day) {
            const bucket = dayBucket(daily, day);
            if (isImpression) {
                bucket.impressions += counts;
                bucket.unique_impressions += unique;
            }
            if (isPage) {
                bucket.page_views += counts;
                bucket.unique_page_views += unique;
            }
        }
        if (isImpression) {
            store.impressions += counts;
            store.unique_impressions += unique;
        }
        if (isPage) {
            store.page_views += counts;
            store.unique_page_views += unique;
        }
        const source = sourceH ? row[sourceH] : '';
        addCount(sources, source, counts);
        const info = sourceInfoH ? row[sourceInfoH] : '';
        if (/app/i.test(source)) addCount(appRefs, info || source, counts);
        if (/web/i.test(source)) addCount(webRefs, info || source, counts);
        addCount(campaigns, campaignH ? row[campaignH] : '', counts);
        addCount(territories, territoryH ? row[territoryH] : '', counts);
        addCount(devices, deviceH ? row[deviceH] : '', counts);
        // Page type and product page only describe engagement rows. Impression rows
        // report "No page", which would otherwise swamp both breakdowns.
        if (isPage) {
            addCount(pageTypes, pageTypeH ? row[pageTypeH] : '', counts);
            addCount(productPages, pageH ? row[pageH] : '', counts);
        }
    }

    store.breakdowns.sources = toNamed(sources);
    store.breakdowns.app_referrers = toNamed(appRefs);
    store.breakdowns.web_referrers = toNamed(webRefs);
    store.breakdowns.campaigns = toNamed(campaigns);
    store.breakdowns.territories = mergeNamed(store.breakdowns.territories, toNamed(territories));
    store.breakdowns.devices = mergeNamed(store.breakdowns.devices, toNamed(devices));
    store.breakdowns.page_types = toNamed(pageTypes);
    store.breakdowns.product_pages = toNamed(productPages);
}

function mergeNamed(existing: NamedCount[], extra: NamedCount[]): NamedCount[] {
    const map = new Map(existing.map((n) => [n.name, n.count]));
    for (const row of extra) addCount(map, row.name, row.count);
    return toNamed(map);
}

function applyDownloads(store: StoreAnalytics, rows: ReportRow[], cutoff: string, daily: Map<string, StoreDailyPoint>) {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const dateH = firstHeader(headers, [/^date$/, /begin.?date/]);
    const typeH = firstHeader(headers, [/download.?type/, /event/, /product.?type/]);
    const countsH = firstHeader(headers, [/^counts?$/, /^units?$/, /^count$/]);
    const sourceH = firstHeader(headers, [/source.?type/]);
    const territoryH = firstHeader(headers, [/territory/, /country/]);
    const deviceH = firstHeader(headers, [/^device$/]);
    const versionH = firstHeader(headers, [/app.?version/, /^version$/]);

    const sources = new Map<string, number>();
    const territories = new Map<string, number>();
    const devices = new Map<string, number>();
    const versions = new Map<string, number>();

    for (const row of rows) {
        const day = dateH ? normalizeDay(row[dateH]) : '';
        if (day && day < cutoff) continue;
        const type = String(typeH ? row[typeH] : '').toLowerCase();
        const counts = countsH ? parseMetricNumber(row[countsH]) : 0;
        const isFirst = type.includes('first');
        const isRe = type.includes('re-download') || type.includes('redownload') || type.includes('re download');
        const isUpdate = type.includes('update');
        const isPreorder = type.includes('pre-order') || type.includes('preorder');
        if (isFirst) store.first_time_downloads += counts;
        else if (isRe) store.redownloads += counts;
        else if (isUpdate) store.updates += counts;
        else if (isPreorder) store.preorders += counts;
        else store.first_time_downloads += counts;

        if (day) {
            const bucket = dayBucket(daily, day);
            if (isFirst) bucket.first_time_downloads += counts;
            else if (isRe) bucket.redownloads += counts;
            else if (isUpdate) bucket.updates += counts;
            else bucket.first_time_downloads += counts;
            bucket.total_downloads = bucket.first_time_downloads + bucket.redownloads;
        }

        addCount(sources, sourceH ? row[sourceH] : '', counts);
        addCount(territories, territoryH ? row[territoryH] : '', counts);
        addCount(devices, deviceH ? row[deviceH] : '', counts);
        addCount(versions, versionH ? row[versionH] : '', counts);
    }

    store.total_downloads = store.first_time_downloads + store.redownloads;
    store.breakdowns.sources = mergeNamed(store.breakdowns.sources, toNamed(sources));
    store.breakdowns.territories = mergeNamed(store.breakdowns.territories, toNamed(territories));
    store.breakdowns.devices = mergeNamed(store.breakdowns.devices, toNamed(devices));
    store.breakdowns.versions = mergeNamed(store.breakdowns.versions, toNamed(versions));
}

function applySessions(store: StoreAnalytics, rows: ReportRow[], cutoff: string, daily: Map<string, StoreDailyPoint>) {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const dateH = firstHeader(headers, [/^date$/]);
    const sessionsH = firstHeader(headers, [/^sessions?$/, /session.?count/]);
    const devicesH = firstHeader(headers, [/active.?devices?/, /unique.?devices?/, /^devices?$/]);
    const durationH = firstHeader(headers, [/duration/, /session.?length/, /average.?session/]);
    const versionH = firstHeader(headers, [/app.?version/, /^version$/]);
    const platformH = firstHeader(headers, [/platform.?version/, /os.?version/]);
    const deviceH = firstHeader(headers, [/^device$/]);
    const territoryH = firstHeader(headers, [/territory/, /country/]);
    const d1H = firstHeader(headers, [/day.?1/, /d1.?retention/, /retention.?1/]);
    const d7H = firstHeader(headers, [/day.?7/, /d7.?retention/, /retention.?7/]);
    const d14H = firstHeader(headers, [/day.?14/, /d14.?retention/, /retention.?14/]);
    const d28H = firstHeader(headers, [/day.?28/, /d28.?retention/, /retention.?28/]);

    const versions = new Map<string, number>();
    const platforms = new Map<string, number>();
    const devices = new Map<string, number>();
    const territories = new Map<string, number>();
    let durationSum = 0;
    let durationN = 0;
    const d1: number[] = [];
    const d7: number[] = [];
    const d14: number[] = [];
    const d28: number[] = [];

    for (const row of rows) {
        const day = dateH ? normalizeDay(row[dateH]) : '';
        if (day && day < cutoff) continue;
        const sessions = sessionsH ? parseMetricNumber(row[sessionsH]) : 0;
        const active = devicesH ? parseMetricNumber(row[devicesH]) : 0;
        store.sessions += sessions;
        if (day) {
            const bucket = dayBucket(daily, day);
            bucket.sessions += sessions;
            bucket.active_devices += active;
        }
        if (durationH) {
            const dur = parseMetricNumber(row[durationH]);
            if (dur > 0) {
                durationSum += dur;
                durationN += 1;
            }
        }
        addCount(versions, versionH ? row[versionH] : '', sessions || active);
        addCount(platforms, platformH ? row[platformH] : '', sessions || active);
        addCount(devices, deviceH ? row[deviceH] : '', sessions || active);
        addCount(territories, territoryH ? row[territoryH] : '', sessions || active);
        if (d1H) d1.push(parseMetricNumber(row[d1H]));
        if (d7H) d7.push(parseMetricNumber(row[d7H]));
        if (d14H) d14.push(parseMetricNumber(row[d14H]));
        if (d28H) d28.push(parseMetricNumber(row[d28H]));
    }

    // Each report row is one dimension slice of a day, so the day total is the sum of
    // its rows — but a device active on several days is still one device, so the period
    // figure cannot be summed across days either. The busiest single day is the closest
    // lower bound the daily reports support.
    for (const bucket of daily.values()) {
        store.active_devices = Math.max(store.active_devices, bucket.active_devices);
    }

    if (durationN > 0) store.avg_session_duration_seconds = Math.round(durationSum / durationN);
    const avgPct = (vals: number[]) => {
        const usable = vals.filter((n) => n > 0);
        if (usable.length === 0) return 0;
        const avg = usable.reduce((s, n) => s + n, 0) / usable.length;
        return Math.round((avg > 1 ? avg : avg * 100) * 10) / 10;
    };
    if (d1.length) store.retention.d1 = avgPct(d1);
    if (d7.length) store.retention.d7 = avgPct(d7);
    if (d14.length) store.retention.d14 = avgPct(d14);
    if (d28.length) store.retention.d28 = avgPct(d28);

    store.breakdowns.versions = mergeNamed(store.breakdowns.versions, toNamed(versions));
    store.breakdowns.platform_versions = toNamed(platforms);
    store.breakdowns.devices = mergeNamed(store.breakdowns.devices, toNamed(devices));
    store.breakdowns.territories = mergeNamed(store.breakdowns.territories, toNamed(territories));
}

function applyCrashes(store: StoreAnalytics, rows: ReportRow[], cutoff: string, daily: Map<string, StoreDailyPoint>) {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const dateH = firstHeader(headers, [/^date$/]);
    const crashH = firstHeader(headers, [/^crashes?$/, /crash.?count/, /total.?crash/]);
    const versionH = firstHeader(headers, [/app.?version/, /^version$/]);
    const deviceH = firstHeader(headers, [/^device$/]);
    const osH = firstHeader(headers, [/platform.?version/, /os.?version/]);
    const byVersion = new Map<string, number>();
    const byDevice = new Map<string, number>();
    const byOs = new Map<string, number>();

    for (const row of rows) {
        const day = dateH ? normalizeDay(row[dateH]) : '';
        if (day && day < cutoff) continue;
        const crashes = crashH ? parseMetricNumber(row[crashH]) : 0;
        store.crashes += crashes;
        if (day) dayBucket(daily, day).crashes += crashes;
        addCount(byVersion, versionH ? row[versionH] : '', crashes);
        addCount(byDevice, deviceH ? row[deviceH] : '', crashes);
        addCount(byOs, osH ? row[osH] : '', crashes);
    }
    store.breakdowns.crashes_by_version = toNamed(byVersion);
    store.breakdowns.crashes_by_device = toNamed(byDevice);
    store.breakdowns.crashes_by_os = toNamed(byOs);
}

function applyInstalls(
    store: StoreAnalytics,
    rows: ReportRow[],
    cutoff: string,
    daily: Map<string, StoreDailyPoint>,
    addTotals: boolean,
) {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const dateH = firstHeader(headers, [/^date$/]);
    const eventH = firstHeader(headers, [/^event$/, /event.?type/, /install.?type/]);
    const countsH = firstHeader(headers, [/^counts?$/, /^count$/, /^values?$/]);
    const uniqueH = firstHeader(headers, [/unique.?counts?/, /unique.?devices?/]);
    const installsCol = firstHeader(headers, [/^installs?$/, /^installations?$/]);
    const deletesCol = firstHeader(headers, [/^deletions?$/, /^deletes?$/, /^uninstalls?$/]);

    const addDeletion = (day: string, n: number) => {
        if (n <= 0) return;
        if (addTotals) {
            store.deletions += n;
            if (day) dayBucket(daily, day).deletions += n;
        }
    };
    const addInstall = (day: string, n: number) => {
        if (n <= 0) return;
        if (addTotals) {
            store.installations += n;
            if (day) dayBucket(daily, day).installations += n;
        }
    };

    for (const row of rows) {
        const day = dateH ? normalizeDay(row[dateH]) : '';
        if (day && day < cutoff) continue;

        if (deletesCol || installsCol) {
            addDeletion(day, deletesCol ? parseMetricNumber(row[deletesCol]) : 0);
            addInstall(day, installsCol ? parseMetricNumber(row[installsCol]) : 0);
            continue;
        }

        const event = String(eventH ? row[eventH] : '').toLowerCase();
        if (!event) continue;
        const counts = (countsH ? parseMetricNumber(row[countsH]) : 0)
            || (uniqueH ? parseMetricNumber(row[uniqueH]) : 0);
        if (/delet|uninstall|remove/.test(event)) addDeletion(day, counts);
        else if (/install/.test(event)) addInstall(day, counts);
    }
}

function applyOptIn(store: StoreAnalytics, rows: ReportRow[]) {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const rateH = firstHeader(headers, [/opt.?in/, /rate/, /percent/]);
    if (!rateH) return;
    const values = rows.map((row) => parseMetricNumber(row[rateH])).filter((n) => n > 0);
    if (values.length === 0) return;
    const avg = values.reduce((s, n) => s + n, 0) / values.length;
    store.opt_in_percent = Math.round((avg > 1 ? avg : avg * 100) * 10) / 10;
}

function applyRetention(store: StoreAnalytics, rows: ReportRow[]) {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const dayH = firstHeader(headers, [/^day$/, /retention.?day/, /period/]);
    const rateH = firstHeader(headers, [/retention/, /rate/, /percent/]);
    if (!rateH) return;
    const byDay = new Map<number, number[]>();
    for (const row of rows) {
        const dayLabel = String(dayH ? row[dayH] : '').toLowerCase();
        const rate = parseMetricNumber(row[rateH]);
        const dayNum = Number.parseInt(dayLabel.replace(/\D/g, ''), 10);
        if (!Number.isFinite(dayNum) || rate <= 0) continue;
        const list = byDay.get(dayNum) || [];
        list.push(rate > 1 ? rate : rate * 100);
        byDay.set(dayNum, list);
    }
    const avg = (day: number) => {
        const list = byDay.get(day);
        if (!list?.length) return 0;
        return Math.round((list.reduce((s, n) => s + n, 0) / list.length) * 10) / 10;
    };
    store.retention.d1 = store.retention.d1 || avg(1);
    store.retention.d7 = store.retention.d7 || avg(7);
    store.retention.d14 = store.retention.d14 || avg(14);
    store.retention.d28 = store.retention.d28 || avg(28);
}

export async function fetchIosStoreAnalytics(
    token: string,
    appAppleId: string,
    windowDays: number,
): Promise<StoreAnalytics> {
    const key = `${appAppleId}:${windowDays}:snapshot+ongoing`;
    if (storeCache && storeCache.key === key && Date.now() - storeCache.at < CACHE_TTL_MS) {
        return storeCache.data;
    }

    const store = emptyStoreAnalytics();
    const [ongoingId, snapshotId] = await Promise.all([
        ensureReportRequest(token, appAppleId, 'ONGOING'),
        ensureReportRequest(token, appAppleId, 'ONE_TIME_SNAPSHOT'),
    ]);
    if (!ongoingId && !snapshotId) {
        storeCache = { key, at: Date.now(), data: store };
        return store;
    }

    const cutoffDate = new Date();
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - windowDays);
    const cutoff = cutoffDate.toISOString().slice(0, 10);
    const daily = new Map<string, StoreDailyPoint>();
    let foundAny = false;

    const [snapshotReports, ongoingReports] = await Promise.all([
        snapshotId ? downloadWantedReports(token, snapshotId, cutoff, true) : Promise.resolve([]),
        ongoingId ? downloadWantedReports(token, ongoingId, cutoff, false) : Promise.resolve([]),
    ]);

    const kinds = new Set([...snapshotReports, ...ongoingReports].map((item) => item.kind));
    const downloaded: Array<{ kind: ReportKind; rows: ReportRow[] }> = [];
    for (const kind of kinds) {
        if (kind === 'other') continue;
        const snapshotRows = snapshotReports.filter((item) => item.kind === kind).flatMap((item) => item.rows);
        const ongoingRows = ongoingReports.filter((item) => item.kind === kind).flatMap((item) => item.rows);
        downloaded.push({ kind, rows: mergeSnapshotAndOngoing(snapshotRows, ongoingRows) });
    }
    const hasStandardInstalls = downloaded.some((item) => item.kind === 'installs' && item.rows.length > 0);
    for (const { kind, rows } of downloaded) {
        if (rows.length === 0) continue;
        foundAny = true;
        if (kind === 'discovery') applyDiscovery(store, rows, cutoff, daily);
        if (kind === 'downloads') applyDownloads(store, rows, cutoff, daily);
        if (kind === 'sessions') applySessions(store, rows, cutoff, daily);
        if (kind === 'crashes') applyCrashes(store, rows, cutoff, daily);
        if (kind === 'installs') applyInstalls(store, rows, cutoff, daily, true);
        if (kind === 'installs_detailed') applyInstalls(store, rows, cutoff, daily, !hasStandardInstalls);
        if (kind === 'optin') applyOptIn(store, rows);
        if (kind === 'retention') applyRetention(store, rows);
    }

    store.daily = [...daily.values()].sort((a, b) => a.day.localeCompare(b.day));
    store.data_through = store.daily.at(-1)?.day;
    store.total_downloads = store.first_time_downloads + store.redownloads;
    if (store.unique_impressions > 0) {
        store.conversion_percent = Math.round((store.total_downloads / store.unique_impressions) * 1000) / 10;
    }
    if (store.sessions > 0) {
        store.crash_free_rate_percent = Math.round(Math.max(0, Math.min(100, (1 - store.crashes / store.sessions) * 100)) * 10) / 10;
    }
    store.reports_pending = !foundAny;
    store.active_last_30_days = store.active_devices;

    storeCache = { key, at: Date.now(), data: store };
    return store;
}
