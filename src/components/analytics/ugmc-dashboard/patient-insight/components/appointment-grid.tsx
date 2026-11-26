'use client';

import { useState, useEffect } from 'react';
import DashboardCard from "@/components/analytics/ugmc-dashboard/shared/dashboard-card";
import Text from "@/components/analytics/text";
import { FaCalendar, FaExpandAlt, FaCompressAlt } from "react-icons/fa";
import dynamic from "next/dynamic";
import clsx from "clsx";
import FullscreenOverlay from "@/components/analytics/fullscreen-overlay";
import { responseMinutes } from "@/lib/analytics/distribution-metrics";
import { CardTitle } from "@/components/analytics/glass/illustrations";
import { barSheen, barWidth, glassTooltip } from "@/components/analytics/glass/chart-kit";
import { shortRoleName, splitRoleName } from "@/lib/analytics/role-name";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const MiniDonut = ({ percentage, color }: { percentage: number; color: string }) => {
	const radius = 18;
	const strokeWidth = 3.5;
	const circumference = 2 * Math.PI * radius;
	const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;

	return (
		<div className="relative flex items-center justify-center w-[48px] h-[48px]">
			<svg width="48" height="48" viewBox="0 0 48 48">
				<circle cx="24" cy="24" r={radius} fill="none" stroke="#EAEBEC" strokeWidth={strokeWidth} />
				<circle cx="24" cy="24" r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinecap="round" transform="rotate(-90 24 24)" />
			</svg>
			<span className="absolute font-semibold text-[12px] leading-[100%]" style={{ color: color }}>{percentage}%</span>
		</div>
	);
};

const AppointmentCancellationBreakdown = ({ data }: { data: any }) => {
	const deptRate = (d: any) => {
		const esc = Number(d?.escalation_notifications) || 0;
		const crit = Number(d?.critical_messages_sent) || 0;
		const denom = crit + esc;
		return denom > 0 ? (esc / denom) * 100 : 0;
	};
	const depts = (data?.department_metrics || [])
		.filter((d: any) => {
			const esc = Number(d?.escalation_notifications) || 0;
			const crit = Number(d?.critical_messages_sent) || 0;
			return esc + crit > 0;
		})
		.slice()
		.sort((a: any, b: any) => deptRate(b) - deptRate(a))
		.slice(0, 4);

	return (
		<DashboardCard data-watermark="apartment" padding="none" className="flex flex-col" style={{ padding: 18, height: 380, gridColumn: 'span 4' }}>
			<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
					<CardTitle icon="domain" variant="body-md-semibold">Department Escalation Rates</CardTitle>
					<Text variant="body-sm" color="text-secondary">Top Escalated Departments</Text>
				</div>
			</div>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				{depts.map((dept: any, index: number) => (
					<div key={index}>
						<div className="flex items-center justify-between min-h-[48px]">
							<Text variant="body-sm-semibold" color="text-primary" className="truncate pr-4">{dept.department_name}</Text>
							<MiniDonut percentage={Math.round(deptRate(dept))} color="#e0656b" />
						</div>
						{index < depts.length - 1 && <div className="w-full h-px border-b border-tertiary" style={{ marginTop: 12 }} />}
					</div>
				))}
				{depts.length === 0 && <div className="flex-1 flex items-center justify-center text-sm text-text-secondary">No data available</div>}
			</div>
		</DashboardCard>
	);
};

const shortenRole = (name: string) => {
	if (!name) return '';
	if (name.length > 20) return name.substring(0, 18) + '...';
	return name;
};

const AppointmentCancellationChart = ({ isFullscreen = false, onToggleFullscreen, data, onViewMore }: { isFullscreen?: boolean; onToggleFullscreen?: () => void; data?: any; onViewMore?: () => void }) => {
	const ackMinutes = (role: Record<string, unknown>) =>
		responseMinutes(role, "critical_ack", ["avg_critical_ack_minutes"]) ?? 0;
	const rolesList = [...(data?.role_metrics || [])]
		.filter((d: any) => ackMinutes(d) > 0)
		.sort((a: any, b: any) => ackMinutes(b) - ackMinutes(a))
		.slice(0, 6);
	const chartData = rolesList.map((d: any) => ackMinutes(d));
	// Two-line labels: role, then its unit, so names stay readable instead of truncating mid-word.
	const categories = rolesList.map((d: any) => {
		const { role, unit } = splitRoleName(String(d.role_name ?? ''));
		return unit ? [shortenRole(role), shortenRole(unit)] : shortenRole(role);
	});
	const hasChartData = rolesList.length > 0;


	const chartOptions: ApexCharts.ApexOptions = {
		chart: { type: 'bar', height: isFullscreen ? 450 : 280, toolbar: { show: false }, zoom: { enabled: false } },
		colors: ['#e0656b'],
		fill: barSheen(),
		plotOptions: { bar: { borderRadius: 6, borderRadiusApplication: 'end', columnWidth: barWidth(categories.length), dataLabels: { position: 'top' } } },
		dataLabels: {
			enabled: true,
			offsetY: -20,
			formatter: (val: number) => `${val.toFixed(1)}m`,
			style: { fontSize: '11px', fontWeight: 700, colors: ['#4a5872'] },
		},
		xaxis: { categories, labels: { rotate: 0, rotateAlways: false, trim: false, style: { fontSize: '11px' } } },
		yaxis: { min: 0, tickAmount: 5, labels: { formatter: (val) => `${val.toFixed(1)}m` } },
		tooltip: {
			custom: ({ dataPointIndex }: { dataPointIndex: number }) =>
				glassTooltip({
					title: shortRoleName(String(rolesList[dataPointIndex]?.role_name ?? '')),
					rows: [{ color: '#e0656b', label: 'Median acknowledgment', value: `${(chartData[dataPointIndex] ?? 0).toFixed(1)} min` }],
				}),
		},
	};

	const chartSeries = [{ name: 'Median acknowledgment time', data: chartData }];

	useEffect(() => {
		if (isFullscreen) document.body.style.overflow = 'hidden';
		else document.body.style.overflow = 'unset';
		return () => { document.body.style.overflow = 'unset'; };
	}, [isFullscreen]);

	const chartContent = (
		<>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
						<Text variant="body-md-semibold" color="text-primary">Average Response Time per Role</Text>
						{onViewMore && (
							<button
								onClick={onViewMore}
								className={clsx(
									"px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200",
									"bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary",
									"cursor-pointer whitespace-nowrap"
								)}
								title="View detailed role metrics"
							>
								View More
							</button>
						)}
					</div>
					<Text variant="body-sm" color="text-secondary">Roles with longest acknowledgment times for critical messages</Text>
				</div>
				{onToggleFullscreen && (
					<button onClick={onToggleFullscreen} className="bg-tertiary rounded-[8px] cursor-pointer hover:bg-tertiary/80 transition-colors" style={{ padding: 8 }}>
						{isFullscreen ? <FaCompressAlt size={14} className="text-text-secondary" /> : <FaExpandAlt size={14} className="text-text-secondary" />}
					</button>
				)}
			</div>
			<div className="flex-1 w-full min-h-0">
				{hasChartData ? (
					<Chart options={chartOptions} series={chartSeries} type="bar" height={isFullscreen ? 450 : 280} width="100%" />
				) : (
					<div className="flex h-full min-h-[200px] items-center justify-center text-sm text-text-secondary">
						No per-role acknowledgment data for this period.
					</div>
				)}
			</div>
		</>
	);

	if (isFullscreen) {
		return (
			<FullscreenOverlay onClose={() => onToggleFullscreen?.()}>
				<div className="bg-primary rounded-[18px] w-full max-w-6xl max-h-[90vh] overflow-auto" style={{ padding: 24 }}>{chartContent}</div>
			</FullscreenOverlay>
		);
	}

	return (
		<DashboardCard padding="none" className="flex flex-col" style={{ padding: 18, height: 380, gridColumn: 'span 8' }}>{chartContent}</DashboardCard>
	);
};

const AppointmentGrid = ({ data, onViewMoreRoles }: { data: any; onViewMoreRoles?: () => void }) => {
	const [isFullscreen, setIsFullscreen] = useState(false);

	return (
		<>
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
				<AppointmentCancellationBreakdown data={data} />
				<AppointmentCancellationChart isFullscreen={isFullscreen} onToggleFullscreen={() => setIsFullscreen(!isFullscreen)} data={data} onViewMore={onViewMoreRoles} />
			</div>
			{isFullscreen && <AppointmentCancellationChart isFullscreen={isFullscreen} onToggleFullscreen={() => setIsFullscreen(!isFullscreen)} data={data} onViewMore={onViewMoreRoles} />}
		</>
	);
};

export default AppointmentGrid;
