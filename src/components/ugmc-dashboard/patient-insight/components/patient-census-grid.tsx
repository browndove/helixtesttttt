'use client';

import { useState, useEffect } from 'react';
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import Text from "@/components/text";
import dynamic from "next/dynamic";
import { FaExpandAlt, FaCompressAlt } from "react-icons/fa";
import { FaTriangleExclamation } from "react-icons/fa6";
import { IoChevronDown } from "react-icons/io5";
import { useTheme } from "next-themes";
import FullscreenOverlay from "@/components/fullscreen-overlay";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type TabType = 'all' | 'critical' | 'standard';

const AlertIcon = () => (
	<div className="w-[32px] h-[32px] flex items-center justify-center rounded-full bg-accent-red/10">
		<FaTriangleExclamation className="text-accent-red w-[18px] h-[18px]" />
	</div>
);

const PatientSatisfactionScore = ({ data }: { data: any }) => {
	const satisfactionData = [
		{ label: 'Critical Msgs', percentage: data?.critical_messages_rate_percent || 0, color: '#FF5F57', scoreRange: 'Of total messages' },
		{ label: 'Role Coverage', percentage: data?.role_fill_rate_percent || 0, color: '#00C8B3', scoreRange: 'Of required roles' },
		{ label: 'Active Users', percentage: data?.active_users_rate_percent || 0, color: '#2980D3', scoreRange: 'Of total staff' },
	];

	const radius = 90;
	const strokeWidth = 45;
	const circumference = Math.PI * radius;

	const [animatedScore, setAnimatedScore] = useState(0);
	const [animatedArc, setAnimatedArc] = useState(0);
	const [animatedBars, setAnimatedBars] = useState(satisfactionData.map(() => 0));
	const [isVisible, setIsVisible] = useState(false);

	const targetScore = data?.escalation_rate_percent || 0;
	const targetArcPercent = targetScore / 100;

	useEffect(() => { setIsVisible(true); }, []);

	useEffect(() => {
		if (!isVisible) return;
		const duration = 2500;
		const startTime = Date.now();
		const animate = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const eased = 1 - Math.pow(1 - progress, 3);
			setAnimatedScore(targetScore * eased);
			setAnimatedArc(targetArcPercent * eased);
			setAnimatedBars(satisfactionData.map(item => item.percentage * eased));
			if (progress < 1) requestAnimationFrame(animate);
			else { setAnimatedScore(targetScore); setAnimatedArc(targetArcPercent); setAnimatedBars(satisfactionData.map(item => item.percentage)); }
		};
		requestAnimationFrame(animate);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isVisible]);

	return (
		<DashboardCard padding="none" className="flex flex-col" style={{ padding: 18, height: 440, gridColumn: 'span 4' }}>
			<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginBottom: 16 }}>
				<Text variant="body-md-semibold" color="text-primary">Escalation Overview</Text>
				<Text variant="body-sm" color="text-secondary">Summary Profile</Text>
			</div>
			<div className="flex justify-center items-center relative h-[180px]">
				<svg width="240" height="140" viewBox="0 0 240 140">
					<defs>
						<linearGradient id="donutGradient" x1="0%" y1="0%" x2="100%" y2="0%">
							<stop offset="0%" stopColor="#00C8B3" />
							<stop offset="100%" stopColor="#2980D3" />
						</linearGradient>
					</defs>
					<path d="M 30 120 A 90 90 0 0 1 210 120" fill="none" stroke="#2980D31A" strokeWidth={strokeWidth} strokeLinecap="butt" />
					<path d="M 30 120 A 90 90 0 0 1 210 120" fill="none" stroke="url(#donutGradient)" strokeWidth={strokeWidth} strokeLinecap="butt" strokeDasharray={`${circumference * animatedArc} ${circumference}`} className="transition-all duration-100" />
				</svg>
				<div className="absolute top-[85px] flex flex-col items-center">
					<AlertIcon />
					<span className="font-bold text-[24px] leading-[100%] text-accent-red tabular-nums" style={{ marginTop: 8 }}>{animatedScore.toFixed(1)}%</span>
					<span className="font-semibold text-[12px] leading-[100%] text-text-secondary" style={{ marginTop: 4 }}>Escalation Rate</span>
				</div>
			</div>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
				{satisfactionData.map((item, index) => (
					<div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
						<div className="flex items-center justify-between">
							<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
								<div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
								<span className="font-medium text-[12px] leading-[100%] text-text-secondary">{item.label}</span>
							</div>
							<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
								<div className="rounded-[6px]" style={{ backgroundColor: `${item.color}1A`, padding: '4px 8px' }}>
									<span className="font-medium text-[12px] leading-[100%] tabular-nums" style={{ color: item.color }}>{Math.round(animatedBars[index])}%</span>
								</div>
								<span className="font-medium text-[12px] leading-[100%] text-text-tertiary">{item.scoreRange}</span>
							</div>
						</div>
						<div className="w-full h-[7px] rounded-full" style={{ backgroundColor: `${item.color}1A` }}>
							<div className="h-full rounded-full transition-all duration-100" style={{ width: `${animatedBars[index]}%`, backgroundColor: item.color }} />
						</div>
					</div>
				))}
			</div>
		</DashboardCard>
	);
};

const PatientCensusChart = ({ isFullscreen = false, onToggleFullscreen, data }: { isFullscreen?: boolean; onToggleFullscreen?: () => void; data?: any }) => {
	const { resolvedTheme } = useTheme();

	const chartData = {
		all: data?.daily_message_volume?.map((d: any) => d.total_messages) || [],
	};
    const categories = data?.daily_message_volume?.map((d: any) => new Date(d.day + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short' })) || [];

	const chartOptions: ApexCharts.ApexOptions = {
		chart: { type: 'area', height: isFullscreen ? 500 : 340, toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: true, speed: 800 } },
		colors: ['#3b82f6'],
		fill: { type: 'gradient', gradient: { shadeIntensity: 1, type: 'vertical', colorStops: [[{ offset: 0, color: '#3b82f6', opacity: 0.15 }, { offset: 100, color: '#3b82f6', opacity: 0.01 }]] } },
		stroke: { curve: 'smooth', width: 2 },
		markers: { size: 0, colors: ['#ffffff'], strokeColors: '#3b82f6', strokeWidth: 2, hover: { size: 4 } },
		dataLabels: { enabled: false },
		grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } }, padding: { left: 10, right: 10 } },
		xaxis: { categories, tickAmount: 8, axisBorder: { show: false }, axisTicks: { show: false }, labels: { rotate: 0, rotateAlways: false, style: { fontFamily: 'Montserrat', fontWeight: 500, fontSize: '12px', colors: '#9ca3af' }, offsetX: 0 } },
		yaxis: { min: 0, tickAmount: 4, labels: { style: { fontFamily: 'Montserrat', fontWeight: 500, fontSize: '12px', colors: '#9ca3af' }, formatter: (val) => val.toFixed(0) } },
		tooltip: { enabled: true, theme: resolvedTheme === "dark" || resolvedTheme === "blue" ? "dark" : "light", style: { fontSize: '12px', fontFamily: "Montserrat" } },
	};

	const chartSeries = [{ name: 'Messages', data: chartData.all }];

	useEffect(() => {
		if (isFullscreen) document.body.style.overflow = 'hidden';
		else document.body.style.overflow = 'unset';
		return () => { document.body.style.overflow = 'unset'; };
	}, [isFullscreen]);

	const chartContent = (
		<>
			<div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
					<Text variant="body-md-semibold" color="text-primary">Message Volume</Text>
					<Text variant="body-sm" color="text-secondary">All Departments · Daily Breakdown</Text>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
					<button className="rounded-[8px] bg-tertiary flex items-center border-none cursor-pointer" style={{ padding: '8px 12px', gap: 8 }}>
						<span className="font-medium text-[12px] leading-[100%] text-text-secondary">30 Days</span>
						<IoChevronDown size={14} className="text-text-secondary" />
					</button>
					{onToggleFullscreen && (
						<button onClick={onToggleFullscreen} className="bg-tertiary rounded-[8px] cursor-pointer hover:bg-tertiary/80 transition-colors" style={{ padding: 8, marginLeft: 8 }}>
							{isFullscreen ? <FaCompressAlt size={14} className="text-text-secondary" /> : <FaExpandAlt size={14} className="text-text-secondary" />}
						</button>
					)}
				</div>
			</div>
			<div className="flex-1 w-full min-h-0">
				<Chart options={chartOptions} series={chartSeries} type="area" height={isFullscreen ? 500 : 340} width="100%" />
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
		<DashboardCard padding="none" className="flex flex-col" style={{ padding: 18, height: 440, gridColumn: 'span 8' }}>{chartContent}</DashboardCard>
	);
};

const PatientCensusGrid = ({ data }: { data: any }) => {
	const [isFullscreen, setIsFullscreen] = useState(false);

	return (
		<>
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
				<PatientCensusChart isFullscreen={isFullscreen} onToggleFullscreen={() => setIsFullscreen(!isFullscreen)} data={data} />
				<PatientSatisfactionScore data={data} />
			</div>
			{isFullscreen && <PatientCensusChart isFullscreen={isFullscreen} onToggleFullscreen={() => setIsFullscreen(!isFullscreen)} data={data} />}
		</>
	);
};

export default PatientCensusGrid;
