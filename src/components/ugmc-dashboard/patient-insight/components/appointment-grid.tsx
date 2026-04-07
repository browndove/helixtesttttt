'use client';

import { useState, useEffect } from 'react';
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import Text from "@/components/text";
import { FaCalendar, FaExpandAlt, FaCompressAlt } from "react-icons/fa";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

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

const AppointmentCancellationBreakdown = () => {
	const breakdownData = [
		{ label: 'No-show / missed check-in', percentage: 40 },
		{ label: 'Patient rescheduled', percentage: 24 },
		{ label: 'Insurance / authorization', percentage: 12 },
		{ label: 'Transportation / weather', percentage: 15 },
	];

	return (
		<DashboardCard padding="none" className="flex flex-col" style={{ padding: 18, height: 380, gridColumn: 'span 4' }}>
			<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
					<Text variant="body-md-semibold" color="text-primary">Appointment Cancellation Breakdown</Text>
					<Text variant="body-sm" color="text-secondary">All Departments · Last 6 Months</Text>
				</div>
				<div className="w-[37px] h-[37px] rounded-[10px] bg-accent-red/10 flex items-center justify-center" style={{ padding: 8 }}>
					<FaCalendar size={18} className="text-accent-red" />
				</div>
			</div>
			<span className="font-bold text-[24px] leading-[100%] text-accent-red" style={{ marginBottom: 16 }}>6.4%</span>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				{breakdownData.map((item, index) => (
					<div key={index}>
						<div className="flex items-center justify-between min-h-[48px]">
							<Text variant="body-sm-semibold" color="text-primary">{item.label}</Text>
							<MiniDonut percentage={item.percentage} color="#FF5F57" />
						</div>
						{index < breakdownData.length - 1 && <div className="w-full h-px border-b border-tertiary" style={{ marginTop: 12 }} />}
					</div>
				))}
			</div>
		</DashboardCard>
	);
};

const AppointmentCancellationChart = ({ isFullscreen = false, onToggleFullscreen }: { isFullscreen?: boolean; onToggleFullscreen?: () => void }) => {
	const chartData = [60, 62, 35, 48, 20, 35];
	const categories = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN'];
	const { resolvedTheme } = useTheme();

	const chartOptions: ApexCharts.ApexOptions = {
		chart: { type: 'bar', height: isFullscreen ? 450 : 280, toolbar: { show: false }, zoom: { enabled: false } },
		colors: ['#FF5F57'],
		plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
		dataLabels: { enabled: false },
		grid: { borderColor: 'var(--bg-tertiary)', strokeDashArray: 4, xaxis: { lines: { show: true } }, yaxis: { lines: { show: true } } },
		xaxis: { categories, axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { fontFamily: 'Montserrat', fontWeight: 500, fontSize: '10px', colors: 'var(--text-secondary)' } } },
		yaxis: { min: 0, max: 80, tickAmount: 4, labels: { style: { fontFamily: 'Montserrat', fontWeight: 500, fontSize: '10px', colors: 'var(--text-secondary)' } } },
		tooltip: { enabled: true, theme: resolvedTheme === "dark" || resolvedTheme === "blue" ? "dark" : "light", style: { fontSize: '12px', fontFamily: "Montserrat" } },
	};

	const chartSeries = [{ name: 'Cancellations', data: chartData }];

	useEffect(() => {
		if (isFullscreen) document.body.style.overflow = 'hidden';
		else document.body.style.overflow = 'unset';
		return () => { document.body.style.overflow = 'unset'; };
	}, [isFullscreen]);

	const chartContent = (
		<>
			<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
					<Text variant="body-md-semibold" color="text-primary">Appointment Cancellation</Text>
					<Text variant="body-sm" color="text-secondary">All Departments · Last 6 Months</Text>
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
			<div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center" style={{ padding: 16 }} onClick={(e) => { if (e.target === e.currentTarget && onToggleFullscreen) onToggleFullscreen(); }}>
				<div className="bg-primary rounded-[15px] w-full max-w-6xl max-h-[90vh] overflow-auto" style={{ padding: 24 }}>{chartContent}</div>
			</div>
		);
	}

	return (
		<DashboardCard padding="none" className="flex flex-col" style={{ padding: 18, height: 380, gridColumn: 'span 8' }}>{chartContent}</DashboardCard>
	);
};

const AppointmentGrid = () => {
	const [isFullscreen, setIsFullscreen] = useState(false);

	return (
		<>
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
				<AppointmentCancellationBreakdown />
				<AppointmentCancellationChart isFullscreen={isFullscreen} onToggleFullscreen={() => setIsFullscreen(!isFullscreen)} />
			</div>
			{isFullscreen && <AppointmentCancellationChart isFullscreen={isFullscreen} onToggleFullscreen={() => setIsFullscreen(!isFullscreen)} />}
		</>
	);
};

export default AppointmentGrid;
