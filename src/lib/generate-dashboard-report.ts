import jsPDF from 'jspdf';

/* ── colour palette ─────────────────────────────────────────────── */
const C = {
    black: '#0f172a',
    heading: '#1e293b',
    body: '#334155',
    muted: '#64748b',
    faint: '#94a3b8',
    border: '#e2e8f0',
    green: '#16a34a',
    amber: '#d97706',
    red: '#dc2626',
    bgLight: '#f8fafc',
    white: '#ffffff',
    accent: '#2563eb',
} as const;

/* ── types ───────────────────────────────────────────────────────── */
export interface DashboardReportData {
    facilityName: string;
    generatedBy: string;
    /* top-line metrics */
    patientCount: number;
    staffActive: number;
    staffTotal: number;
    staffActivePercent: number;
    criticalFilled: number;
    criticalTotal: number;
    criticalPercent: number;
    criticalRolesWithoutEscalation: number;
    criticalRolesTotal: number;
    /* system checks */
    ackLabel: string;
    twoFactorPct: number;
    twoFactorEnabled: number;
    twoFactorTotal: number;
    failedImports24h: number;
    activeSessions: number;
    /* department messages */
    departmentMix: { label: string; count: number; pct: number }[];
    departmentMessagesTotal: number;
    analyticsWindowDays: number;
    /* setup issues */
    teamsWithoutLead: number;
    teamsWithoutMembers: number;
    deptsWithoutName: number;
    incompleteEscalations: number;
}

/* ── helpers ─────────────────────────────────────────────────────── */
function todayFormatted(): string {
    return new Date().toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function drawHr(doc: jsPDF, y: number, lx: number, rx: number): void {
    doc.setDrawColor(C.border);
    doc.setLineWidth(0.3);
    doc.line(lx, y, rx, y);
}

function semColor(value: number, good: number, warn: number): string {
    if (value >= good) return C.green;
    if (value >= warn) return C.amber;
    return C.red;
}

/* ── main ────────────────────────────────────────────────────────── */
export function generateDashboardPdf(data: DashboardReportData): void {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const mx = 18; // horizontal margin
    const cw = pw - mx * 2; // content width
    let y = 0;

    /* ── page background ─────────────────────────────────────────── */
    doc.setFillColor(C.white);
    doc.rect(0, 0, pw, ph, 'F');

    /* ── header bar ──────────────────────────────────────────────── */
    doc.setFillColor('#0f172a');
    doc.rect(0, 0, pw, 36, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(C.white);
    doc.text(data.facilityName || 'Facility Report', mx, 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor('#94a3b8');
    doc.text(`Dashboard Report  ·  ${todayFormatted()}`, mx, 24);
    doc.text(`Prepared for ${data.generatedBy || 'Administrator'}`, mx, 30);

    y = 46;

    /* ── section: key metrics ────────────────────────────────────── */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(C.heading);
    doc.text('Key Metrics', mx, y);
    y += 2;
    drawHr(doc, y, mx, pw - mx);
    y += 7;

    const metricCols = [
        { label: 'Active Patients', value: data.patientCount.toLocaleString() },
        { label: 'Staff Active Rate', value: `${data.staffActivePercent}%` },
        { label: 'Critical Coverage', value: `${data.criticalPercent}%` },
        { label: 'Escalation Gaps', value: `${data.criticalRolesWithoutEscalation}` },
    ];

    const colW = cw / metricCols.length;
    for (let i = 0; i < metricCols.length; i++) {
        const cx = mx + i * colW;
        // card bg
        doc.setFillColor(C.bgLight);
        doc.roundedRect(cx + 1, y - 2, colW - 3, 20, 2, 2, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(C.muted);
        doc.text(metricCols[i].label, cx + 5, y + 4);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(C.black);
        doc.text(metricCols[i].value, cx + 5, y + 14);
    }
    y += 28;

    /* ── section: staff overview ─────────────────────────────────── */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(C.heading);
    doc.text('Staff Overview', mx, y);
    y += 2;
    drawHr(doc, y, mx, pw - mx);
    y += 7;

    const staffRows = [
        ['Total staff in directory', data.staffTotal.toLocaleString()],
        ['Active accounts', `${data.staffActive.toLocaleString()} (${data.staffActivePercent}%)`],
        ['Pending activation', (data.staffTotal - data.staffActive).toLocaleString()],
        ['Critical roles filled', `${data.criticalFilled} / ${data.criticalTotal}`],
        ['Roles without escalation ladder', `${data.criticalRolesWithoutEscalation}`],
    ];

    for (const [label, val] of staffRows) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(C.body);
        doc.text(label, mx + 2, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(C.black);
        doc.text(val, pw - mx - 2, y, { align: 'right' });
        y += 6;
    }
    y += 4;

    /* ── section: system checks ──────────────────────────────────── */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(C.heading);
    doc.text('System Checks', mx, y);
    y += 2;
    drawHr(doc, y, mx, pw - mx);
    y += 7;

    const checks: { label: string; value: string; color: string }[] = [
        {
            label: 'Critical acknowledgement time (30d avg)',
            value: data.ackLabel,
            color: data.ackLabel === '—' ? C.muted : C.green,
        },
        {
            label: '2FA adoption',
            value: `${data.twoFactorPct}%  (${data.twoFactorEnabled} / ${data.twoFactorTotal})`,
            color: semColor(data.twoFactorPct, 80, 50),
        },
        {
            label: 'Data sync (last 24h)',
            value: data.failedImports24h > 0 ? `${data.failedImports24h} failed` : 'Clean',
            color: data.failedImports24h > 0 ? C.red : C.green,
        },
        {
            label: 'Active sessions',
            value: data.activeSessions.toLocaleString(),
            color: C.body,
        },
    ];

    for (const chk of checks) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(C.body);
        doc.text(chk.label, mx + 2, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(chk.color);
        doc.text(chk.value, pw - mx - 2, y, { align: 'right' });
        y += 6;
    }
    y += 4;

    /* ── section: messages by department ──────────────────────────── */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(C.heading);
    doc.text('Messages by Department', mx, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(C.muted);
    doc.text(`${data.analyticsWindowDays}-day window  ·  ${data.departmentMessagesTotal.toLocaleString()} total`, pw - mx - 2, y, { align: 'right' });
    y += 2;
    drawHr(doc, y, mx, pw - mx);
    y += 7;

    if (data.departmentMix.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(C.faint);
        doc.text('No department message data available for this period.', mx + 2, y);
        y += 8;
    } else {
        // table header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(C.muted);
        doc.text('Department', mx + 2, y);
        doc.text('Messages', pw - mx - 30, y, { align: 'right' });
        doc.text('Share', pw - mx - 2, y, { align: 'right' });
        y += 2;
        drawHr(doc, y, mx, pw - mx);
        y += 5;

        const barColors = ['#22c55e', '#f59e0b', '#3b82f6', '#a1a1aa'];
        for (let i = 0; i < data.departmentMix.length; i++) {
            const d = data.departmentMix[i];
            // mini bar
            const barMaxW = 50;
            const barW = Math.max((d.pct / 100) * barMaxW, 2);
            doc.setFillColor(barColors[i % barColors.length]);
            doc.roundedRect(mx + 2, y - 3, barW, 3.5, 1, 1, 'F');

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(C.body);
            doc.text(d.label, mx + 2 + barMaxW + 4, y);

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(C.black);
            doc.text(d.count.toLocaleString(), pw - mx - 30, y, { align: 'right' });

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(C.muted);
            doc.text(`${d.pct}%`, pw - mx - 2, y, { align: 'right' });

            y += 7;
        }
    }
    y += 4;

    /* ── section: setup issues ───────────────────────────────────── */
    const issues: string[] = [];
    if (data.incompleteEscalations > 0) issues.push(`${data.incompleteEscalations} escalation${data.incompleteEscalations === 1 ? '' : 's'} need steps`);
    if (data.teamsWithoutLead > 0) issues.push(`${data.teamsWithoutLead} team${data.teamsWithoutLead === 1 ? '' : 's'} without a lead`);
    if (data.teamsWithoutMembers > 0) issues.push(`${data.teamsWithoutMembers} empty team${data.teamsWithoutMembers === 1 ? '' : 's'}`);
    if (data.deptsWithoutName > 0) issues.push(`${data.deptsWithoutName} department${data.deptsWithoutName === 1 ? '' : 's'} unnamed`);

    if (issues.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(C.heading);
        doc.text('Setup Issues', mx, y);
        y += 2;
        drawHr(doc, y, mx, pw - mx);
        y += 7;

        for (const issue of issues) {
            doc.setFillColor('#fef3c7');
            doc.roundedRect(mx + 1, y - 3.5, cw - 2, 6, 1.5, 1.5, 'F');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor('#92400e');
            doc.text(`  ⚠  ${issue}`, mx + 4, y);
            y += 8;
        }
    }

    /* ── footer ──────────────────────────────────────────────────── */
    const fy = ph - 12;
    drawHr(doc, fy - 4, mx, pw - mx);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(C.faint);
    doc.text(`Generated ${new Date().toLocaleString('en-GB')}  ·  ${data.facilityName}  ·  Helix Admin`, mx, fy);
    doc.text('Confidential', pw - mx, fy, { align: 'right' });

    /* ── download ────────────────────────────────────────────────── */
    const datePart = new Date().toISOString().slice(0, 10);
    doc.save(`${(data.facilityName || 'Helix').replace(/\s+/g, '-')}-Report-${datePart}.pdf`);
}
