'use client';

import { Fragment, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const O = '#e07856';
const O_LIGHT = '#f0a68a';
const O_DARK = '#c75a3a';
const O_PEACH = '#fde4d8';
const GREY = '#e2ddd8';
const AMBER = '#e5a54b';
const CARD = 'rounded-2xl border border-[var(--border-default)] bg-white shadow-sm';
const CARD_PALE = 'rounded-2xl border border-slate-100 shadow-sm';

const KPI = [
    { initials: 'TM', bg: '#e07856', title: 'Total Messages', subtitle: 'System Volume', value: '128,542', trend: 12.4, up: true, sub1: 'Last 30 Days', sub2: 'Mar 2026' },
    { initials: 'OH', bg: '#e5a54b', title: 'Total Calls Made', subtitle: 'Cumulative', value: '84', trend: 5.2, up: true, sub1: 'Audit Score', sub2: 'Top 15%', sub2Color: '#e5a54b' },
    { initials: 'AR', bg: '#64748b', title: 'Avg Response', subtitle: 'Critical Alerts', value: '4.2 min', trend: 0.8, up: false, sub1: 'SLA Target: <5m', sub2: 'On Track', sub2Color: '#16a34a' },
    { initials: 'ER', bg: '#c75a3a', title: 'Escalation Rate', subtitle: '% Escalated', value: '15%', trend: 1.5, up: true, sub1: 'Active Users', sub2: 'High', sub2Color: '#16a34a' },
];

const BAR_DATES = ['01 MAR', '05 MAR', '08 MAR', '12 MAR', '15 MAR', '22 MAR', '29 MAR'];
const BAR_VALUES = [280, 320, 480, 350, 410, 520, 380];
const DONUT_DATA = [{ label: 'Critical', value: 40, color: '#d06840' }, { label: 'Standard', value: 60, color: GREY }];

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
function makeHeatmap(): number[][] {
    return DAYS.map(() => Array.from({ length: 24 }, () => Math.floor(Math.random() * 100)));
}

const ESC_ROLES = [
    { name: 'Emergency Doctor On Call', total: 240, esc: 140, ack: 100 },
    { name: 'Charge Nurse', total: 210, esc: 95, ack: 115 },
];

export default function UsagePage() {
    const heatmap = useMemo(makeHeatmap, []);
    const maxH = useMemo(() => Math.max(...heatmap.flat(), 1), [heatmap]);

    const barOpts = useMemo(() => ({
        chart: { type: 'bar' as const, toolbar: { show: false }, animations: { enabled: true, speed: 600 } },
        plotOptions: { bar: { columnWidth: '75%', borderRadius: 6 } },
        dataLabels: { enabled: false },
        xaxis: { categories: BAR_DATES, labels: { style: { fontSize: '10px', fontWeight: 600 } } },
        yaxis: { labels: { style: { fontSize: '10px', colors: ['#cbd5e1'] } } },
        colors: ['#e07856'],
        grid: { borderColor: '#e2e8f0', strokeDashArray: 3, xaxis: { lines: { show: true } }, yaxis: { lines: { show: true } } },
    }), []);

    const donutOpts = useMemo(() => ({
        chart: { type: 'donut' as const, animations: { enabled: true, speed: 600 } },
        labels: DONUT_DATA.map(d => d.label),
        colors: ['#d06840', GREY],
        legend: { show: false },
        stroke: { show: false },
        plotOptions: { pie: { donut: { size: '72%', labels: { show: true, name: { show: true, fontSize: '12px', fontWeight: 600, color: '#d06840', offsetY: 8, formatter: () => 'CRITICAL' }, value: { show: true, fontSize: '32px', fontWeight: 800, color: '#1a202c', offsetY: -4, formatter: () => '40%' }, total: { show: true, label: 'CRITICAL', fontSize: '12px', fontWeight: 600, color: '#d06840', formatter: () => '40%' } } } } },
        dataLabels: { enabled: false },
    }), []);

    const activeOpts = useMemo(() => ({
        chart: { type: 'bar' as const, toolbar: { show: false }, animations: { enabled: true, speed: 600 } },
        plotOptions: { bar: { columnWidth: '50%', borderRadius: 4 } },
        dataLabels: { enabled: false },
        xaxis: { categories: ['THIS WEEK', 'LAST 2 WK', 'LAST MONTH'], labels: { style: { fontSize: '9px', fontWeight: 600 } } },
        yaxis: { labels: { style: { fontSize: '10px', colors: ['#cbd5e1'] } } },
        colors: ['#e07856', AMBER],
        legend: { show: false },
        grid: { borderColor: '#e2e8f0', strokeDashArray: 3, xaxis: { lines: { show: true } }, yaxis: { lines: { show: true } } },
    }), []);

    const heatStops = ['#fef7f2', '#fde4d8', '#f0a68a', '#e07856', '#c75a3a'];

    return (
        <div className="app-shell">
            <Sidebar sections={navSections} />
            <div className="app-main">
                <TopBar title="Usage" subtitle="Messaging & communication analytics" />
                <main style={{ background: '#f7f8fa', padding: '32px 32px 48px 32px' }}>
                    <div className="grid w-full gap-x-6 gap-y-8">

                    {/* ── Row 1: KPI Cards ── */}
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {KPI.map(k => (
                            <div key={k.initials} className={`${CARD}`} style={{ padding: '24px 28px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                        <div style={{ width: 44, height: 44, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '0.04em' }}>{k.initials}</span>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>{k.title}</div>
                                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{k.subtitle}</div>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: k.up ? '#16a34a' : '#dc2626', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
                                        <span style={{ fontSize: 14 }}>{k.up ? '↗' : '↘'}</span>{k.trend}%
                                    </span>
                                </div>
                                <div style={{ fontSize: 38, fontWeight: 800, color: '#111827', lineHeight: 1, letterSpacing: '-0.02em' }}>{k.value}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontSize: 11, color: '#94a3b8' }}>
                                    <span>{k.sub1}</span>
                                    <span style={{ fontWeight: 600, color: k.sub2Color || '#94a3b8' }}>{k.sub2}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Row 2: Messaging Activity + Type Distribution ── */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                        <div className={`${CARD_PALE} col-span-1 lg:col-span-8`} style={{ background: '#ffffff', padding: '28px 32px' }}>
                            <div className="mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-[18px] w-1 rounded-sm" style={{ background: O }} />
                                    <span className="text-[13px] font-extrabold uppercase tracking-wider text-gray-900">Messaging Activity</span>
                                </div>
                                <span className="rounded-md border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-500">LAST 30 DAYS</span>
                            </div>
                            <div className="mb-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Daily Volume Trend</div>
                            <div className="mt-4 -mx-1">
                                {typeof window !== 'undefined' && <ReactApexChart options={barOpts} series={[{ name: 'Volume', data: BAR_VALUES }]} type="bar" width="100%" height={280} />}
                            </div>
                        </div>
                        <div className={`${CARD_PALE} col-span-1 lg:col-span-4`} style={{ background: '#ffffff', padding: '28px 32px' }}>
                            <div className="mb-4 flex items-center gap-2">
                                <div className="h-[18px] w-1 rounded-sm" style={{ background: O }} />
                                <span className="text-[13px] font-extrabold uppercase tracking-wider text-gray-900">Type Distribution</span>
                            </div>
                            <div className="mt-4 -mx-1">
                                {typeof window !== 'undefined' && <ReactApexChart options={donutOpts} series={DONUT_DATA.map(d => d.value)} type="donut" width="100%" height={240} />}
                            </div>
                            <div className="mt-3 flex items-center justify-center gap-5 text-[11px] font-semibold">
                                <span className="flex items-center gap-1.5">
                                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: '#d06840' }} /> 40% CRITICAL
                                </span>
                                <span className="flex items-center gap-1.5 text-slate-400">
                                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: GREY }} /> 60% STANDARD
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ── Row 3: Peak Hours Heatmap ── */}
                    <div className={`${CARD_PALE} col-span-full w-full`} style={{ background: '#ffffff', padding: '32px 32px' }}>
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="h-[18px] w-1 rounded-sm" style={{ background: O }} />
                                <span className="text-[13px] font-extrabold uppercase tracking-wider text-gray-900">Peak Hours Heatmap</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                                <span>LOW</span>
                                <div className="flex gap-0.5">
                                    {heatStops.map(c => <div key={c} className="h-3 w-5 rounded-sm" style={{ background: c }} />)}
                                </div>
                                <span>PEAK</span>
                            </div>
                        </div>
                        <div className="w-full overflow-x-auto">
                            <div className="grid w-full gap-1" style={{ gridTemplateColumns: '50px repeat(24, minmax(0,1fr))' }}>
                                <div className="flex items-center justify-end pr-1.5 text-[10px] font-semibold text-slate-400">DAY</div>
                                {HOURS.map(h => <div key={h} className="text-center text-[9px] font-semibold text-slate-400" style={{ padding: '2px 0' }}>{String(h).padStart(2, '0')}</div>)}
                                {DAYS.map((day, ri) => (
                                    <Fragment key={day}>
                                        <div className="flex items-center justify-end pr-1.5 text-[10px] font-bold" style={{ color: O }}>{day}</div>
                                        {HOURS.map(ci => {
                                            const v = heatmap[ri]?.[ci] ?? 0;
                                            const t = Math.min(1, v / maxH);
                                            const idx = Math.min(heatStops.length - 1, Math.floor(t * heatStops.length));
                                            return <div key={ci} className="rounded-sm" style={{ height: 32, background: heatStops[t <= 0 ? 0 : idx] }} title={`${day} ${String(ci).padStart(2, '0')}:00`} />;
                                        })}
                                    </Fragment>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── Row 4: Most Escalated Role + Engagement & Health ── */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                        <div className={`${CARD_PALE} col-span-1 lg:col-span-6`} style={{ background: '#ffffff', padding: '28px 32px' }}>
                            <div className="mb-4 flex flex-wrap items-center gap-2">
                                <div className="h-[18px] w-1 rounded-sm" style={{ background: O }} />
                                <span className="text-[13px] font-extrabold uppercase tracking-wider text-gray-900">Most Escalated Role</span>
                                <span className="ml-auto rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: O, border: `1.5px solid ${O}` }}>Top: Emergency Doctor On Call</span>
                            </div>
                            <div className="mb-6 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Roles receiving highest escalations</div>
                            <div className="flex flex-col gap-8">
                                {ESC_ROLES.map(r => {
                                    const escW = (r.esc / r.total) * 100;
                                    const ackW = (r.ack / r.total) * 100;
                                    return (
                                        <div key={r.name}>
                                            <div className="mb-3 flex justify-between text-[12px] font-bold">
                                                <span className="uppercase tracking-wide text-gray-900">{r.name}</span>
                                                <span className="text-slate-400">{r.total} TOTAL</span>
                                            </div>
                                            <div className="flex h-7 w-full overflow-hidden rounded-md">
                                                <div style={{ width: `${escW}%`, background: O_DARK }} />
                                                <div style={{ width: `${ackW}%`, background: O_PEACH }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-6 flex gap-6 text-[11px] font-semibold">
                                <span className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: O_DARK }} /> ESCALATIONS</span>
                                <span className="flex items-center gap-2 text-slate-400"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: O_PEACH }} /> ACKNOWLEDGMENT</span>
                            </div>
                        </div>
                        <div className={`${CARD_PALE} col-span-1 lg:col-span-6`} style={{ background: '#ffffff', padding: '28px 32px' }}>
                            <div className="mb-4 flex items-center gap-2">
                                <div className="h-[18px] w-1 rounded-sm" style={{ background: O }} />
                                <span className="text-[13px] font-extrabold uppercase tracking-wider text-gray-900">Engagement & Health</span>
                            </div>
                            <div className="mb-4 text-[11px] font-extrabold uppercase tracking-wider text-gray-900">Active Users Rate</div>
                            <div className="mt-4 -mx-1">
                                {typeof window !== 'undefined' && <ReactApexChart options={activeOpts} series={[{ name: 'Active', data: [88, 85, 82] }, { name: 'Target', data: [92, 89, 86] }]} type="bar" width="100%" height={280} />}
                            </div>
                        </div>
                    </div>

                    </div>
                </main>
            </div>
        </div>
    );
}
