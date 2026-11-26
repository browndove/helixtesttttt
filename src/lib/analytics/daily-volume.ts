/**
 * Fill gaps in daily_message_volume so charts always show a continuous calendar window.
 * Facilities with sparse activity otherwise only render days that had messages.
 */

export type DailyMessageVolumePoint = {
    day: string;
    total_messages: number;
    critical_messages: number;
    standard_messages: number;
};

function dayKeyLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function parseDay(isoDay: string): Date {
    return new Date(`${isoDay.slice(0, 10)}T12:00:00`);
}

function num(v: unknown): number {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Build `periodDays` consecutive calendar days ending on `endDay`, or today
 * when omitted. Missing days are filled with zeros so sparse facilities still
 * show a full recent window (e.g. past 7 days from today).
 */
export function fillDailyMessageVolumePeriod(
    dailyVolume: Array<Partial<DailyMessageVolumePoint> & { day?: string }> | null | undefined,
    periodDays: number,
    endDay?: string | null
): DailyMessageVolumePoint[] {
    const days = Math.max(1, Math.floor(periodDays) || 1);
    const byDay = indexByDay(dailyVolume);
    const end = resolveEndDay(endDay);

    const out: DailyMessageVolumePoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(end);
        d.setDate(d.getDate() - i);
        const key = dayKeyLocal(d);
        out.push(byDay.get(key) ?? emptyPoint(key));
    }
    return out;
}

/**
 * Fill every calendar day from `fromDay` through `toDay` (inclusive).
 * When from/to are omitted, uses min/max day present in the payload so internal
 * gaps (e.g. Sep 5 between Sep 4 and Sep 6) still render as zero.
 */
export function fillDailyMessageVolumeRange(
    dailyVolume: Array<Partial<DailyMessageVolumePoint> & { day?: string }> | null | undefined,
    fromDay?: string | null,
    toDay?: string | null
): DailyMessageVolumePoint[] {
    const byDay = indexByDay(dailyVolume);

    let fromKey = fromDay?.slice(0, 10) || "";
    let toKey = toDay?.slice(0, 10) || "";

    if (!fromKey || !toKey) {
        if (byDay.size === 0) return [];
        let min = "";
        let max = "";
        for (const key of byDay.keys()) {
            if (!min || key < min) min = key;
            if (!max || key > max) max = key;
        }
        fromKey = fromKey || min;
        toKey = toKey || max;
    }

    if (!fromKey || !toKey || fromKey > toKey) return [];

    const out: DailyMessageVolumePoint[] = [];
    const cursor = parseDay(fromKey);
    const end = parseDay(toKey);
    while (cursor.getTime() <= end.getTime()) {
        const key = dayKeyLocal(cursor);
        out.push(byDay.get(key) ?? emptyPoint(key));
        cursor.setDate(cursor.getDate() + 1);
    }
    return out;
}

function indexByDay(
    dailyVolume: Array<Partial<DailyMessageVolumePoint> & { day?: string }> | null | undefined
): Map<string, DailyMessageVolumePoint> {
    const byDay = new Map<string, DailyMessageVolumePoint>();
    for (const row of Array.isArray(dailyVolume) ? dailyVolume : []) {
        if (!row?.day) continue;
        const key = String(row.day).slice(0, 10);
        byDay.set(key, {
            day: key,
            total_messages: num(row.total_messages),
            critical_messages: num(row.critical_messages),
            standard_messages: num(row.standard_messages),
        });
    }
    return byDay;
}

function resolveEndDay(endDay?: string | null): Date {
    if (endDay) return parseDay(endDay);
    // Period charts (7/14/30) always end on the local calendar "today".
    return parseDay(dayKeyLocal(new Date()));
}

function emptyPoint(day: string): DailyMessageVolumePoint {
    return { day, total_messages: 0, critical_messages: 0, standard_messages: 0 };
}
