/**
 * House style for every ApexChart in the analytics section. ApexCharts merges `window.Apex`
 * under each chart's own options, so this sets the defaults (type, grid, bar shape, motion)
 * without overriding choices a chart makes explicitly.
 */
const INK_MUTED = '#7b879b';

const theme = {
    chart: {
        fontFamily: 'inherit',
        foreColor: INK_MUTED,
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: {
            enabled: true,
            easing: 'easeinout',
            speed: 800,
            animateGradually: { enabled: true, delay: 80 },
            dynamicAnimation: { enabled: true, speed: 450 },
        },
    },
    grid: {
        borderColor: 'rgba(27, 42, 68, 0.06)',
        strokeDashArray: 0,
        padding: { left: 6, right: 10 },
        xaxis: { lines: { show: false } },
    },
    xaxis: {
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { fontSize: '11px', fontWeight: 500, colors: INK_MUTED } },
        crosshairs: { stroke: { color: 'rgba(27, 42, 68, 0.22)', width: 1, dashArray: 3 } },
        tooltip: { enabled: false },
    },
    yaxis: {
        labels: { style: { fontSize: '11px', fontWeight: 500, colors: INK_MUTED } },
    },
    plotOptions: {
        bar: { borderRadius: 6, borderRadiusApplication: 'end' as const, columnWidth: '48%' },
        pie: { expandOnClick: false, donut: { size: '74%' } },
    },
    stroke: { lineCap: 'round' as const },
    markers: { size: 0, strokeWidth: 2, strokeColors: '#fff', hover: { size: 6 } },
    legend: {
        fontSize: '12px',
        fontWeight: 600,
        labels: { colors: '#4a5872' },
        markers: { size: 5, shape: 'circle' as const, strokeWidth: 0 },
        itemMargin: { horizontal: 10, vertical: 4 },
    },
    dataLabels: { style: { fontWeight: 600 } },
    tooltip: { theme: 'light', style: { fontFamily: 'inherit' } },
    states: {
        hover: { filter: { type: 'none' } },
        active: { filter: { type: 'none' } },
    },
};

type ApexWindow = Window & { Apex?: object };

/** Install the analytics chart defaults (call before any chart in the section mounts). */
export function applyAnalyticsChartTheme(): void {
    if (typeof window !== 'undefined') (window as ApexWindow).Apex = theme;
}

/** Remove them again so charts elsewhere in Helix keep their own look. */
export function clearAnalyticsChartTheme(): void {
    if (typeof window !== 'undefined') delete (window as ApexWindow).Apex;
}
