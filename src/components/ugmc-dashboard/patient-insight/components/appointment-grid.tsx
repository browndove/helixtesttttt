'use client';

import { useState, useEffect } from 'react';
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import Text from "@/components/text";
import { FaCalendar, FaExpandAlt, FaCompressAlt } from "react-icons/fa";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import clsx from "clsx";
import FullscreenOverlay from "@/components/fullscreen-overlay";

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
	const depts = (data?.department_metrics || []).slice().sort((a: any, b: any) => b.escalation_rate_vs_dept_critical_messages_percent - a.escalation_rate_vs_dept_critical_messages_percent).slice(0, 4);

	return (
		<DashboardCard padding="none" className="flex flex-col" style={{ padding: 18, height: 380, gridColumn: 'span 4' }}>
			<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
					<Text variant="body-md-semibold" color="text-primary">Department Escalation Rates</Text>
					<Text variant="body-sm" color="text-secondary">Top Escalated Departments</Text>
				</div>
			</div>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				{depts.map((dept: any, index: number) => (
					<div key={index}>
						<div className="flex items-center justify-between min-h-[48px]">
							<Text variant="body-sm-semibold" color="text-primary" className="truncate pr-4">{dept.department_name}</Text>
							<MiniDonut percentage={Math.round(dept.escalation_rate_vs_dept_critical_messages_percent || 0)} color="#FF5F57" />
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
	const rolesList = (data?.role_metrics || data?.top_escalated_roles || []).slice(0, 6);
	const chartData = rolesList.map((d: any) => {
		const val = d.avg_critical_ack_minutes || 0;
		return val === 0 ? 0.05 : val;
	});
	const categories = rolesList.map((d: any) => shortenRole(d.role_name));

	const { resolvedTheme } = useTheme();

	const chartOptions: ApexCharts.ApexOptions = {
		chart: { type: 'bar', height: isFullscreen ? 450 : 280, toolbar: { show: false }, zoom: { enabled: false } },
		colors: ['#ef4444'],
		fill: { opacity: 0.7 },
		stroke: { show: false, width: 0 },
		plotOptions: { bar: { borderRadius: 4, columnWidth: '50%', barHeight: '100%', colors: { backgroundBarColors: [] } } },
		dataLabels: { enabled: false },
		grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
		xaxis: { categories, axisBorder: { show: false }, axisTicks: { show: false }, labels: { rotate: 0, rotateAlways: false, style: { fontFamily: 'Montserrat', fontWeight: 500, fontSize: '12px', colors: '#9ca3af' } } },
		yaxis: { min: 0, tickAmount: 5, labels: { style: { fontFamily: 'Montserrat', fontWeight: 500, fontSize: '12px', colors: '#9ca3af' }, formatter: (val) => val <= 0.05 ? "0" : `${val.toFixed(1)}m` } },
		tooltip: { enabled: true, theme: resolvedTheme === "dark" || resolvedTheme === "blue" ? "dark" : "light", style: { fontSize: '12px', fontFamily: "Montserrat" },
            y: { formatter: (val) => val <= 0.05 ? "0 mins" : `${val.toFixed(1)} mins` }
        },
	};

	const chartSeries = [{ name: 'Average Acknowledgment Time', data: chartData }];

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
				<Chart options={chartOptions} series={chartSeries} type="bar" height={isFullscreen ? 450 : 280} width="100%" />
			</div>
		</>
	);

	if (isFullscreen) {
		return (
			<FullscreenOverlay onClose={() => onToggleFullscreen?.()}>
				<div className="bg-primary rounded-[15px] w-full max-w-6xl max-h-[90vh] overflow-auto" style={{ padding: 24 }}>{chartContent}</div>
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
