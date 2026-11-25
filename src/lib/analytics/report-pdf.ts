import jsPDF from "jspdf";
import { collectReportData, humanizeReportHeader } from "@/lib/analytics/report-metrics";
import type { ReportScalarRow, ReportTableSection } from "@/lib/analytics/report-metrics";
import type { ReportLogo } from "@/lib/analytics/report-logo";
import {
    chartDailyVolume,
    chartDepartmentHeatmap,
    chartMessageMix,
    chartPerformanceRadar,
    chartRankedMetric,
    chartStackedByColumns,
    type ChartFrame,
    type ChartImage,
} from "@/lib/analytics/report-charts";

type AnalyticsRow = Record<string, unknown>;

/* ═══════════════════════════════════════════════════════════════════════════
   Palette — restrained, print-first
   ═══════════════════════════════════════════════════════════════════════════ */
type RGB = [number, number, number];

const NAVY: RGB = [12, 24, 38];
const TEAL: RGB = [13, 148, 136];
const TEAL_SOFT: RGB = [45, 168, 158];
const INK: RGB = [22, 30, 42];
const MUTED: RGB = [100, 112, 128];
const FAINT: RGB = [148, 158, 170];
const RULE: RGB = [226, 232, 238];
const WASH: RGB = [248, 250, 252];
const WHITE: RGB = [255, 255, 255];

function formatGenerated(iso: string): string {
    try {
        return new Date(iso).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
        });
    } catch {
        return iso;
    }
}

function formatPeriod(from: string, to: string): string {
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
    try {
        const a = new Date(`${from}T12:00:00`);
        const b = new Date(`${to}T12:00:00`);
        if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return `${from} – ${to}`;
        return `${a.toLocaleDateString(undefined, opts)} – ${b.toLocaleDateString(undefined, opts)}`;
    } catch {
        return `${from} – ${to}`;
    }
}

function logoWidthFor(logo: ReportLogo, height: number): number {
    return (logo.width / logo.height) * height;
}

function drawGradientRect(
    doc: jsPDF,
    x: number,
    y: number,
    w: number,
    h: number,
    from: RGB,
    to: RGB,
    stepH = 1.5
) {
    const steps = Math.max(1, Math.ceil(h / stepH));
    for (let i = 0; i < steps; i++) {
        const t = i / Math.max(1, steps - 1);
        const r = Math.round(from[0] + (to[0] - from[0]) * t);
        const g = Math.round(from[1] + (to[1] - from[1]) * t);
        const b = Math.round(from[2] + (to[2] - from[2]) * t);
        const sy = y + i * stepH;
        const sh = Math.min(stepH, y + h - sy);
        if (sh <= 0) break;
        doc.setFillColor(r, g, b);
        doc.rect(x, sy, w, sh, "F");
    }
}

function truncateToWidth(doc: jsPDF, text: string, maxW: number): string {
    if (doc.getTextWidth(text) <= maxW) return text;
    let t = text;
    while (t.length > 1 && doc.getTextWidth(t + "…") > maxW) t = t.slice(0, -1);
    return t + "…";
}

/* ═══════════════════════════════════════════════════════════════════════════
   Content page header — quiet, not a dashboard bar
   ═══════════════════════════════════════════════════════════════════════════ */
function drawPageChrome(
    doc: jsPDF,
    pageW: number,
    margin: number,
    facilityName?: string,
    logo?: ReportLogo | null
) {
    drawGradientRect(doc, 0, 0, pageW, 2.5, TEAL, TEAL_SOFT, 0.5);

    let textX = margin;
    if (logo) {
        const h = 11;
        const w = logoWidthFor(logo, h);
        doc.addImage(logo.dataUrl, "PNG", margin, 14, w, h);
        textX = margin + w + 10;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...FAINT);
    doc.text("Helix Analytics", textX, 22);

    if (facilityName) {
        doc.setTextColor(...MUTED);
        doc.text(truncateToWidth(doc, facilityName, 220), pageW - margin, 22, { align: "right" });
    }

    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.4);
    doc.line(margin, 34, pageW - margin, 34);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Cover — white, same language as the key metrics page
   ═══════════════════════════════════════════════════════════════════════════ */
function drawCoverPage(
    doc: jsPDF,
    pageW: number,
    pageH: number,
    margin: number,
    meta: {
        dateFrom: string;
        dateTo: string;
        generatedAtIso: string;
        facilityName: string;
        logo: ReportLogo | null;
    }
) {
    doc.setFillColor(...WHITE);
    doc.rect(0, 0, pageW, pageH, "F");
    drawGradientRect(doc, 0, 0, pageW, 4, TEAL, TEAL_SOFT, 0.5);

    const left = margin;
    const right = pageW - margin;
    let y = 48;

    if (meta.logo) {
        const h = 26;
        const w = logoWidthFor(meta.logo, h);
        doc.addImage(meta.logo.dataUrl, "PNG", left, y, w, h);
    } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(...TEAL);
        doc.text("HELIX", left, y + 16);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...FAINT);
    doc.text("Helix Analytics", right, y + 16, { align: "right" });

    const facilityTitle = meta.facilityName?.trim() || "Facility overview";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(34);
    const titleLines = doc.splitTextToSize(facilityTitle, right - left) as string[];
    const titleTop = 188;

    doc.setFillColor(...TEAL);
    doc.circle(left + 3, titleTop - 2, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...TEAL);
    doc.text("ANALYTICS REPORT", left + 14, titleTop);

    y = titleTop + 36;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(34);
    doc.setTextColor(...INK);
    doc.text(titleLines, left, y);
    y += titleLines.length * 40 + 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.setTextColor(...MUTED);
    doc.text("Usage, response, and operational performance", left, y);

    y += 22;
    drawGradientRect(doc, left, y, 48, 2, TEAL, TEAL_SOFT, 0.5);

    const period = formatPeriod(meta.dateFrom, meta.dateTo);
    const generated = formatGenerated(meta.generatedAtIso);
    const fields: { label: string; value: string }[] = [
        { label: "Facility", value: facilityTitle },
        { label: "Period", value: period },
        { label: "Generated", value: generated },
    ];

    const panelTop = y + 36;
    const panelBottom = pageH - 72;
    const panelH = Math.max(180, panelBottom - panelTop);
    doc.setFillColor(...WASH);
    doc.roundedRect(left, panelTop, right - left, panelH, 12, 12, "F");
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.8);
    doc.roundedRect(left, panelTop, right - left, panelH, 12, 12, "S");

    const rowH = panelH / fields.length;
    fields.forEach((field, i) => {
        const rowY = panelTop + i * rowH;
        if (i > 0) {
            doc.setDrawColor(...RULE);
            doc.setLineWidth(0.6);
            doc.line(left + 20, rowY, right - 20, rowY);
        }
        const textY = rowY + rowH / 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...TEAL);
        doc.text(field.label.toUpperCase(), left + 24, textY - 8);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(...INK);
        const lines = doc.splitTextToSize(field.value, right - left - 48) as string[];
        doc.text(lines[0] ?? "—", left + 24, textY + 14);
    });

    doc.setFillColor(...TEAL);
    doc.circle(left + 3, pageH - 28, 2.4, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Confidential & Proprietary  —  For Internal Executive Use Only", left + 14, pageH - 26);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Section title — editorial, not a banner
   ═══════════════════════════════════════════════════════════════════════════ */
function drawSectionTitle(
    doc: jsPDF,
    title: string,
    y: number,
    margin: number,
    contentW: number,
    index?: number
): number {
    const label = index != null ? String(index).padStart(2, "0") : null;

    if (label) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...TEAL);
        doc.text(label, margin, y + 2);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(...INK);
        doc.text(title, margin + 28, y + 2);
    } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(...INK);
        doc.text(title, margin, y + 2);
    }

    const ruleY = y + 12;
    drawGradientRect(doc, margin, ruleY, 36, 1.5, TEAL, TEAL_SOFT, 0.5);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.4);
    doc.line(margin + 42, ruleY + 0.5, margin + contentW, ruleY + 0.5);

    return y + 32;
}

const GOOD: RGB = [15, 143, 104];
const AMBER: RGB = [217, 119, 6];

function metricNumber(value: string): number | null {
    const n = Number(value.replace(/,/g, "").replace(/%/g, "").trim());
    return Number.isFinite(n) ? n : null;
}

function metricDisplay(label: string, value: string): string {
    if (!value.trim()) return "—";
    const n = metricNumber(value);
    if (n == null) return value;
    const oneDecimal = /minute|sign-in|sign-out/i.test(label);
    const formatted = oneDecimal || !Number.isInteger(n)
        ? n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        : n.toLocaleString("en-US");
    if (/%|percent/i.test(label) && !value.includes("%")) return `${formatted} %`;
    return formatted;
}

function metricColor(label: string, value: string): RGB {
    const n = metricNumber(value);
    if (n == null) return INK;
    if (/\(%\)|percent/i.test(label) && n >= 90) return GOOD;
    if (/minute/i.test(label) && !/sign-in|sign-out/i.test(label) && n >= 60) return GOOD;
    return INK;
}

function metricHint(label: string, value: string): string {
    const n = metricNumber(value);
    if (/active users \(count\)/i.test(label)) return "Personnel";
    if (/active users \(%/i.test(label)) return "Engagement";
    if (/registered staff/i.test(label)) return "Total Roster";
    if (/sign-in|sign-out/i.test(label) && n != null && n > 0) {
        const total = Math.round(n);
        const h24 = Math.floor(total / 60) % 24;
        const min = total % 60;
        return `~${h24}:${String(min).padStart(2, "0")} UTC`;
    }
    if (/minute/i.test(label) && n != null && n > 0) {
        if (n >= 60) {
            const hours = n / 60;
            return `min   (~${hours >= 10 ? hours.toFixed(0) : hours.toFixed(1)}h)`;
        }
        return "min";
    }
    return "";
}

function drawKeyMetrics(
    doc: jsPDF,
    rows: ReportScalarRow[],
    opts: {
        margin: number;
        contentW: number;
        pageH: number;
        footerReserve: number;
        contentTop: number;
        period: string;
        generated: string;
        sectionIndex: number;
        onPage: () => void;
    }
): void {
    const { margin, contentW, pageH, footerReserve, contentTop } = opts;
    let y = contentTop;

    const paintHeader = (continued: boolean) => {
        doc.setFillColor(...TEAL);
        doc.circle(margin + 3, y - 2, 3, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...TEAL);
        doc.text("MONTHLY OPERATIONS REVIEW", margin + 12, y);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...MUTED);
        const periodText = `PERIOD:  ${opts.period.toUpperCase()}`;
        const generatedText = `GENERATED:  ${opts.generated.toUpperCase()}`;
        const right = margin + contentW;
        doc.text(generatedText, right, y, { align: "right" });
        doc.text(periodText, right - doc.getTextWidth(generatedText) - 18, y, { align: "right" });

        y += 22;
        const indexLabel = String(opts.sectionIndex).padStart(2, "0");
        doc.setDrawColor(...RULE);
        doc.setLineWidth(0.8);
        doc.roundedRect(margin, y - 11, 22, 16, 4, 4, "S");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...TEAL);
        doc.text(indexLabel, margin + 11, y, { align: "center" });
        doc.setFontSize(18);
        doc.setTextColor(...INK);
        doc.text("Key metrics", margin + 30, y + 1);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...MUTED);
        const subtitle = continued ? "Continued" : "Executive Performance & Activity Summary";
        doc.text(subtitle, margin + 142, y);
        y += 10;
        doc.setDrawColor(...RULE);
        doc.setLineWidth(0.6);
        doc.line(margin, y, margin + contentW, y);
        y += 16;
    };

    paintHeader(false);
    opts.onPage();

    const groups = new Map<string, ReportScalarRow[]>();
    for (const row of rows) {
        if (!groups.has(row.group)) groups.set(row.group, []);
        groups.get(row.group)!.push(row);
    }

    const joinedGroup = (name: string) => /messaging|roles|response/i.test(name);

    for (const [groupName, items] of groups) {
        const cols = items.length === 1 ? 1 : items.length === 2 ? 2 : 3;
        const rowsN = Math.ceil(items.length / cols);
        const cellH = 62;
        const gap = joinedGroup(groupName) ? 0 : 8;
        const panelH = rowsN * cellH + Math.max(0, rowsN - 1) * gap;
        if (y + 16 + panelH > pageH - footerReserve) {
            doc.addPage("a4", "portrait");
            y = contentTop;
            paintHeader(true);
            opts.onPage();
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...TEAL);
        doc.text(groupName.toUpperCase(), margin, y);
        y += 12;

        const cellW = (contentW - gap * (cols - 1)) / cols;
        if (joinedGroup(groupName)) {
            doc.setDrawColor(...RULE);
            doc.setLineWidth(0.8);
            doc.roundedRect(margin, y, contentW, panelH, 8, 8, "S");
            doc.setDrawColor(241, 245, 249);
            for (let c = 1; c < cols; c++) {
                doc.line(margin + c * cellW, y + 8, margin + c * cellW, y + panelH - 8);
            }
            for (let r = 1; r < rowsN; r++) {
                doc.line(margin + 10, y + r * cellH, margin + contentW - 10, y + r * cellH);
            }
        }

        items.forEach((item, i) => {
            const c = i % cols;
            const r = Math.floor(i / cols);
            const x = margin + c * (cellW + gap);
            const cy = y + r * (cellH + gap);
            if (!joinedGroup(groupName)) {
                doc.setDrawColor(...RULE);
                doc.setLineWidth(0.8);
                doc.roundedRect(x, cy, cellW, cellH, 8, 8, "S");
            }

            const shown = metricDisplay(item.label, item.value);
            const hint = metricHint(item.label, item.value);
            const n = metricNumber(item.value);
            const minuteStat = /minute/i.test(item.label) && !/sign-in|sign-out/i.test(item.label);
            const clockStat = /sign-in|sign-out/i.test(item.label);
            const showTarget = /critical role fill/i.test(item.label) && n === 100;
            const criticalDot = item.label === "Critical messages";

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(71, 85, 105);
            const labelMax = cellW - 20 - (criticalDot ? 10 : 0);
            const labelLines = (doc.splitTextToSize(item.label, labelMax) as string[]).slice(0, 2);
            labelLines.forEach((line, lineIndex) => {
                doc.text(line, x + 10, cy + 14 + lineIndex * 11);
            });
            if (criticalDot) {
                doc.setFillColor(...AMBER);
                doc.circle(x + 14 + doc.getTextWidth(labelLines[0] ?? ""), cy + 11, 2.2, "F");
            }
            const valueY = cy + (labelLines.length > 1 ? 48 : 40);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.setTextColor(...metricColor(item.label, item.value));
            doc.text(shown, x + 10, valueY);
            const valueW = doc.getTextWidth(shown);
            if (showTarget && x + 18 + valueW + 58 < x + cellW) {
                const badgeX = x + 16 + valueW;
                doc.setFillColor(220, 252, 231);
                doc.roundedRect(badgeX, valueY - 10, 54, 13, 6, 6, "F");
                doc.setFont("helvetica", "bold");
                doc.setFontSize(7);
                doc.setTextColor(...GOOD);
                doc.text("100% Target", badgeX + 27, valueY - 1, { align: "center" });
            }

            if (/active users \(%/i.test(item.label) && n != null) {
                doc.setDrawColor(...GOOD);
                doc.setLineWidth(2);
                doc.line(x + 10, valueY + 4, x + 10 + Math.min(valueW, 34), valueY + 4);
            }

            if (minuteStat && n != null && n > 0) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(...FAINT);
                let unitX = x + 14 + valueW;
                doc.text("min", unitX, valueY);
                if (n >= 60) {
                    unitX += doc.getTextWidth("min") + 4;
                    const hours = n / 60;
                    doc.text(`(~${hours >= 10 ? hours.toFixed(0) : hours.toFixed(1)}h)`, unitX, valueY);
                }
            } else if (clockStat && hint) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(...FAINT);
                doc.text(hint, x + 10, Math.min(valueY + 12, cy + cellH - 8));
                const iconX = x + cellW - 22;
                const iconY = cy + 30;
                doc.setDrawColor(...RULE);
                doc.setLineWidth(0.8);
                doc.circle(iconX, iconY, 8, "S");
                doc.setDrawColor(...TEAL);
                doc.setLineWidth(1);
                const dir = /sign-out/i.test(item.label) ? 1 : -1;
                doc.line(iconX - 3 * dir, iconY, iconX + 3 * dir, iconY);
                doc.line(iconX + 3 * dir, iconY, iconX + dir, iconY - 2.2);
                doc.line(iconX + 3 * dir, iconY, iconX + dir, iconY + 2.2);
            } else if (hint) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(7);
                doc.setTextColor(...FAINT);
                doc.text(hint, x + cellW - 10, valueY, { align: "right" });
            }
        });

        y += panelH + 12;
    }
}

/* ═══════════════════════════════════════════════════════════════════════════
   Footer
   ═══════════════════════════════════════════════════════════════════════════ */
function drawFooter(
    doc: jsPDF,
    pageW: number,
    pageH: number,
    margin: number,
    pageNum: number,
    totalPages: number,
    facilityName: string
) {
    if (pageNum === 1) return; // cover stays clean

    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.4);
    doc.line(margin, pageH - 40, pageW - margin, pageH - 40);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...FAINT);
    const left = facilityName ? `Helix  ·  ${facilityName}` : "Helix Analytics";
    doc.text(truncateToWidth(doc, left, pageW * 0.55), margin, pageH - 24);

    doc.setTextColor(...MUTED);
    doc.text(`${pageNum - 1} / ${totalPages - 1}`, pageW - margin, pageH - 24, { align: "right" });
}

function drawKeyMetricsFooter(
    doc: jsPDF,
    pageW: number,
    pageH: number,
    margin: number,
    pageNum: number,
    totalPages: number
) {
    const printed = pageNum - 1;
    const totalPrinted = Math.max(1, totalPages - 1);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.4);
    doc.line(margin, pageH - 40, pageW - margin, pageH - 40);

    doc.setFillColor(...TEAL);
    doc.circle(margin + 3, pageH - 26, 2.4, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text("Confidential & Proprietary  —  For Internal Executive Use Only", margin + 12, pageH - 24);

    const pageLabel = `Page ${printed} of ${totalPrinted}`;
    doc.setTextColor(...FAINT);
    doc.text(pageLabel, pageW - margin, pageH - 24, { align: "right" });
    const ref = "Document Ref: OPS-METRICS-01";
    doc.text(ref, pageW - margin - doc.getTextWidth(pageLabel) - 14, pageH - 24, { align: "right" });
}

type TocEntry = { index: number; title: string; page: number };

function drawTocRow(
    doc: jsPDF,
    entry: TocEntry,
    y: number,
    margin: number,
    contentW: number,
    printedPage: number,
    targetPage: number
) {
    const indexLabel = String(entry.index).padStart(2, "0");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEAL);
    doc.text(indexLabel, margin, y);

    const pageLabel = String(printedPage);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const pageWidth = doc.getTextWidth(pageLabel);
    const titleX = margin + 32;
    const titleMax = contentW - 32 - pageWidth - 36;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    const title = truncateToWidth(doc, entry.title, titleMax);
    doc.text(title, titleX, y);

    const dotsFrom = titleX + doc.getTextWidth(title) + 10;
    const dotsTo = margin + contentW - pageWidth - 12;
    doc.setFontSize(9);
    doc.setTextColor(...FAINT);
    const step = doc.getTextWidth("·") + 3.5;
    for (let x = dotsFrom; x < dotsTo; x += step) {
        doc.text("·", x, y);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(pageLabel, margin + contentW, y, { align: "right" });

    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.4);
    doc.line(margin, y + 10, margin + contentW, y + 10);
    doc.link(margin, y - 14, contentW, 28, { pageNumber: targetPage });
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main export
   ═══════════════════════════════════════════════════════════════════════════ */

/** Build a premium styled PDF report (browser / client only). */
export function buildAnalyticsReportPdfBlob(
    data: AnalyticsRow,
    selected: Record<string, boolean>,
    meta: {
        dateFrom: string;
        dateTo: string;
        generatedAtIso: string;
        facilityName?: string;
        logo?: ReportLogo | null;
    }
): Blob {
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const pageH = doc.internal.pageSize.getHeight();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 48;
    const contentW = pageW - margin * 2;
    const footerReserve = 56;
    const facilityName = meta.facilityName?.trim() || "";
    const logo = meta.logo ?? null;

    drawCoverPage(doc, pageW, pageH, margin, {
        dateFrom: meta.dateFrom,
        dateTo: meta.dateTo,
        generatedAtIso: meta.generatedAtIso,
        facilityName,
        logo,
    });

    let y = margin + 42;
    let sectionIndex = 1;
    const contentTop = margin + 42;
    const toc: TocEntry[] = [];
    const rememberSection = (title: string) => {
        toc.push({ index: sectionIndex, title, page: doc.getNumberOfPages() });
    };

    const collected = collectReportData(data, selected);

    const chartAvailH = pageH - footerReserve - contentTop - 62;
    const chartFrame: ChartFrame = {
        width: 1400,
        height: Math.max(980, Math.round(1400 * (chartAvailH / contentW))),
    };
    const landW = 841.89;
    const landH = 595.28;
    const landContentW = landW - margin * 2;
    const landAvailH = landH - footerReserve - contentTop - 62;
    const landscapeFrame: ChartFrame = {
        width: 1680,
        height: Math.max(780, Math.round(1680 * (landAvailH / landContentW))),
    };
    const keyMetricPages = new Set<number>();

    const addChart = (title: string, chart: ChartImage | null, layout: "portrait" | "landscape" = "portrait") => {
        if (!chart) return;

        doc.addPage("a4", layout);
        const w = doc.internal.pageSize.getWidth();
        const h = doc.internal.pageSize.getHeight();
        const boxContentW = w - margin * 2;
        rememberSection(title);
        y = contentTop;
        y = drawSectionTitle(doc, title, y, margin, boxContentW, sectionIndex++);
        y += 8;
        const boxTop = y;
        const boxH = h - footerReserve - boxTop - 8;
        const boxW = boxContentW;

        const scale = Math.min(boxW / chart.width, boxH / chart.height);
        const imgW = chart.width * scale;
        const imgH = chart.height * scale;
        const x = margin + (boxW - imgW) / 2;
        const iy = boxTop + Math.max(0, (boxH - imgH) / 2);
        doc.addImage(chart.dataUrl, "PNG", x, iy, imgW, imgH);
    };

    const columnsForPdf = (section: ReportTableSection) => {
        const preferred = (section.pdfColumns?.length ? section.pdfColumns : section.head).filter(
            (key) => section.head.includes(key) && !/_id$/i.test(key)
        );
        const keys = preferred.length > 0 ? preferred : section.head;
        const indexes = keys.map((key) => section.head.indexOf(key));
        return {
            labels: keys.map((key) => humanizeReportHeader(key)),
            rows: section.body.map((row) => indexes.map((index) => row[index] ?? "")),
        };
    };

    const addTable = (section: ReportTableSection) => {
        const { labels, rows } = columnsForPdf(section);
        if (labels.length === 0 || rows.length === 0) return;

        doc.addPage("a4", "portrait");
        rememberSection(section.title);
        y = contentTop;
        y = drawSectionTitle(doc, section.title, y, margin, contentW, sectionIndex++);
        y += 4;

        const fontSize = labels.length > 8 ? 6.5 : labels.length > 6 ? 7.5 : 8.5;
        const padX = 4;
        const rowH = 18;
        const colW = contentW / labels.length;

        const drawHeader = () => {
            doc.setFillColor(...NAVY);
            doc.rect(margin, y, contentW, rowH, "F");
            doc.setDrawColor(...NAVY);
            doc.setLineWidth(0.4);
            doc.rect(margin, y, contentW, rowH);
            for (let i = 1; i < labels.length; i++) {
                doc.line(margin + i * colW, y, margin + i * colW, y + rowH);
            }
            doc.setFont("helvetica", "bold");
            doc.setFontSize(fontSize);
            doc.setTextColor(...WHITE);
            labels.forEach((label, i) => {
                doc.text(truncateToWidth(doc, label, colW - padX * 2), margin + i * colW + padX, y + 12);
            });
            y += rowH;
        };

        drawHeader();
        rows.forEach((row, rowIndex) => {
            if (y + rowH > pageH - footerReserve) {
                doc.addPage("a4", "portrait");
                y = contentTop;
                drawHeader();
            }
            if (rowIndex % 2 === 0) {
                doc.setFillColor(...WASH);
                doc.rect(margin, y, contentW, rowH, "F");
            }
            doc.setDrawColor(...RULE);
            doc.setLineWidth(0.35);
            doc.rect(margin, y, contentW, rowH);
            for (let i = 1; i < labels.length; i++) {
                doc.line(margin + i * colW, y, margin + i * colW, y + rowH);
            }
            doc.setFont("helvetica", "normal");
            doc.setFontSize(fontSize);
            doc.setTextColor(...INK);
            row.forEach((value, i) => {
                doc.text(truncateToWidth(doc, value || "—", colW - padX * 2), margin + i * colW + padX, y + 12);
            });
            y += rowH;
        });
    };

    const sectionOrNull = (s: ReportTableSection | null) => (s && s.body.length > 0 ? s : null);

    if (collected.scalarRows.length > 0) {
        doc.addPage("a4", "portrait");
        rememberSection("Key metrics");
        drawKeyMetrics(doc, collected.scalarRows, {
            margin,
            contentW,
            pageH,
            footerReserve,
            contentTop: 52,
            period: formatPeriod(meta.dateFrom, meta.dateTo),
            generated: formatGenerated(meta.generatedAtIso),
            sectionIndex: sectionIndex++,
            onPage: () => keyMetricPages.add(doc.getNumberOfPages()),
        });
    }

    const hasMessagingScalars = collected.scalarRows.some(
        (r) => r.group === "Messaging" || r.group === "Escalation"
    );
    const hasStaffScalars = collected.scalarRows.some(
        (r) => r.group === "Staff & activity" || r.group === "Roles" || r.group === "Response times"
    );
    if (hasMessagingScalars) addChart("Message mix", chartMessageMix(data, chartFrame));
    if (hasMessagingScalars || hasStaffScalars) addChart("Performance profile", chartPerformanceRadar(data, chartFrame));

    if (collected.daily) {
        const s = sectionOrNull(collected.daily);
        addChart("Daily message volume", s ? chartDailyVolume(s.head, s.body, chartFrame) : null);
        if (s) addTable(collected.daily!);
    }

    if (collected.departments) {
        const s = sectionOrNull(collected.departments);
        addChart("Department metric heatmap", s ? chartDepartmentHeatmap(s.head, s.body, chartFrame) : null);
        addChart(
            "Department escalation rate",
            s
                ? chartRankedMetric(
                      s.head,
                      s.body,
                      "department_name",
                      "escalation_rate_vs_dept_critical_messages_percent",
                      { valueSuffix: "%", maxItems: 10, style: "lollipop", color: "#EF4444", frame: landscapeFrame }
                  )
                : null,
            "landscape"
        );
        addChart(
            "Department role fill rate",
            s
                ? chartRankedMetric(s.head, s.body, "department_name", "role_fill_rate_percent", {
                      valueSuffix: "%",
                      maxItems: 10,
                      style: "bars",
                      colorFrom: "#5EEAD4",
                      colorTo: "#0F766E",
                      frame: landscapeFrame,
                  })
                : null,
            "landscape"
        );
        if (s) addTable(collected.departments!);
    }

    if (collected.topEscalated) {
        const s = sectionOrNull(collected.topEscalated);
        addChart(
            "Top escalated roles",
            s
                ? chartRankedMetric(s.head, s.body, "role_name", "escalation_count", {
                      maxItems: 10,
                      style: "lollipop",
                      color: "#EF4444",
                      frame: landscapeFrame,
                  })
                : null,
            "landscape"
        );
        if (s) addTable(collected.topEscalated!);
    }
    if (collected.leastEscalated) {
        const s = sectionOrNull(collected.leastEscalated);
        addChart(
            "Least escalated roles",
            s
                ? chartRankedMetric(s.head, s.body, "role_name", "escalation_count", {
                      maxItems: 10,
                      sortDesc: false,
                      style: "lollipop",
                      color: "#3B82F6",
                      frame: landscapeFrame,
                  })
                : null,
            "landscape"
        );
        if (s) addTable(collected.leastEscalated!);
    }

    if (collected.roleMetrics) {
        const s = sectionOrNull(collected.roleMetrics);
        addChart(
            "Top roles by message volume",
            s
                ? chartRankedMetric(s.head, s.body, "role_name", "total_messages", {
                      maxItems: 12,
                      style: "bars",
                      colorFrom: "#99F6E4",
                      colorTo: "#0D9488",
                      frame: landscapeFrame,
                  })
                : null,
            "landscape"
        );
        if (s) addTable(collected.roleMetrics!);
    }

    const callStack = [
        { key: "answered_calls", name: "Answered", color: "#0D9488" },
        { key: "unanswered_calls", name: "Unanswered", color: "#EF4444" },
    ];
    if (collected.callByRole) {
        const s = sectionOrNull(collected.callByRole);
        addChart(
            "Outbound calls by role",
            s ? chartStackedByColumns(s.head, s.body, "role_name", callStack, 8, "grouped", landscapeFrame) : null,
            "landscape"
        );
        if (s) addTable(collected.callByRole!);
    }
    if (collected.callByDept) {
        const s = sectionOrNull(collected.callByDept);
        addChart(
            "Outbound calls by department",
            s ? chartStackedByColumns(s.head, s.body, "department_name", callStack, 8, "grouped", landscapeFrame) : null,
            "landscape"
        );
        if (s) addTable(collected.callByDept!);
    }

    const transferStack = [
        { key: "outbound_transfer_requests", name: "Outbound", color: "#0D9488" },
        { key: "inbound_transfer_requests", name: "Inbound", color: "#3B82F6" },
    ];
    if (collected.transferByCounterparty) {
        const s = sectionOrNull(collected.transferByCounterparty);
        addChart(
            "Transfers by counterparty facility",
            s ? chartStackedByColumns(s.head, s.body, "counterparty_facility_name", transferStack, 10, "horizontal", landscapeFrame) : null,
            "landscape"
        );
        if (s) addTable(collected.transferByCounterparty!);
    }
    if (collected.transferByRole) {
        const s = sectionOrNull(collected.transferByRole);
        addChart(
            "Transfers by role",
            s ? chartStackedByColumns(s.head, s.body, "role_name", transferStack, 10, "horizontal", landscapeFrame) : null,
            "landscape"
        );
        if (s) addTable(collected.transferByRole!);
    }

    let tocPages = 0;
    if (toc.length > 0) {
        const rowH = 32;
        const listTop = contentTop + 44;
        const perPage = Math.max(1, Math.floor((pageH - footerReserve - listTop) / rowH));
        tocPages = Math.ceil(toc.length / perPage);
        doc.setPage(1);
        for (let i = 0; i < tocPages; i++) doc.insertPage(2 + i);

        for (let p = 0; p < tocPages; p++) {
            doc.setPage(2 + p);
            let ty = drawSectionTitle(doc, "Contents", contentTop, margin, contentW);
            ty += 12;
            const slice = toc.slice(p * perPage, (p + 1) * perPage);
            for (const entry of slice) {
                drawTocRow(
                    doc,
                    entry,
                    ty,
                    margin,
                    contentW,
                    entry.page + tocPages - 1,
                    entry.page + tocPages
                );
                ty += rowH;
            }
        }
    }

    const keyPages = new Set([...keyMetricPages].map((p) => p + tocPages));
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        const w = doc.internal.pageSize.getWidth();
        const h = doc.internal.pageSize.getHeight();
        if (keyPages.has(i)) {
            drawKeyMetricsFooter(doc, w, h, margin, i, total);
            continue;
        }
        if (i > 1) {
            drawPageChrome(doc, w, margin, facilityName || undefined, logo);
        }
        drawFooter(doc, w, h, margin, i, total, facilityName);
    }

    return doc.output("blob");
}
