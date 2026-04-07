'use client';

import { useState, useEffect } from 'react';
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import Text from "@/components/text";
import dynamic from "next/dynamic";
import { FaExpandAlt, FaCompressAlt } from "react-icons/fa";
import { useTheme } from "next-themes";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type TabType = 'inpatient' | 'outpatient' | 'emergency';

const StarIcon = () => (
	<svg width="32" height="31" viewBox="0 0 24 23" fill="none" xmlns="http://www.w3.org/2000/svg">
		<defs>
			<linearGradient id="starGradient" x1="12" y1="0" x2="12" y2="23" gradientUnits="userSpaceOnUse">
				<stop offset="0%" stopColor="#FFB050" />
				<stop offset="100%" stopColor="rgba(255, 176, 80, 0.3)" />
			</linearGradient>
		</defs>
		<path d="M12 0L14.6942 8.2918H23.4127L16.3593 13.4164L19.0534 21.7082L12 16.5836L4.94658 21.7082L7.64074 13.4164L0.587322 8.2918H9.30583L12 0Z" fill="url(#starGradient)" />
	</svg>
);

const PatientSatisfactionScore = () => {
	const satisfactionData = [
		{ label: 'Excellent', percentage: 86, color: '#00C8B3', scoreRange: 'Score 4 - 5' },
		{ label: 'Good', percentage: 8, color: '#2980D3', scoreRange: 'Score 3' },
		{ label: 'Bad', percentage: 6, color: '#FF5F57', scoreRange: 'Score 1 - 2' },
	];

	const radius = 90;
	const strokeWidth = 45;
	const circumference = Math.PI * radius;

	const [animatedScore, setAnimatedScore] = useState(0);
	const [animatedArc, setAnimatedArc] = useState(0);
	const [animatedBars, setAnimatedBars] = useState(satisfactionData.map(() => 0));
	const [isVisible, setIsVisible] = useState(false);

	const targetScore = 4.5;
	const targetArcPercent = 0.9;

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
				<Text variant="body-md-semibold" color="text-primary">Patient Satisfaction Score</Text>
				<Text variant="body-sm" color="text-secondary">Last 30 Days</Text>
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
					<StarIcon />
					<span className="font-bold text-[24px] leading-[100%] text-accent-primary tabular-nums" style={{ marginTop: 8 }}>{animatedScore.toFixed(1)}</span>
					<span className="font-semibold text-[12px] leading-[100%] text-text-secondary" style={{ marginTop: 4 }}>Out of 5</span>
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

const PatientCensusChart = ({ isFullscreen = false, onToggleFullscreen }: { isFullscreen?: boolean; onToggleFullscreen?: () => void }) => {
	const [activeTab, setActiveTab] = useState<TabType>('inpatient');
	const { resolvedTheme } = useTheme();

	const tabs: { id: TabType; label: string }[] = [
		{ id: 'inpatient', label: 'Inpatient' },
		{ id: 'outpatient', label: 'Outpatient' },
		{ id: 'emergency', label: 'Emergency' },
	];

	const chartData: Record<TabType, number[]> = {
		inpatient: [50, 300, 180, 250, 400, 300],
		outpatient: [80, 350, 200, 300, 450, 320],
		emergency: [20, 150, 100, 140, 200, 150],
	};

	const chartOptions: ApexCharts.ApexOptions = {
		chart: { type: 'area', height: isFullscreen ? 500 : 340, toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: true, speed: 800 } },
		colors: ['#2980D3'],
		fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.2, stops: [0, 100] } },
		stroke: { curve: 'smooth', width: 2 },
		markers: { size: 5, colors: ['#FFFFFF'], strokeColors: '#2980D3', strokeWidth: 2, hover: { size: 7 } },
		dataLabels: { enabled: false },
		grid: { borderColor: 'var(--bg-tertiary)', strokeDashArray: 4, xaxis: { lines: { show: true } }, yaxis: { lines: { show: true } }, padding: { left: 10, right: 10 } },
		xaxis: { categories: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN'], axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { fontFamily: 'Montserrat', fontWeight: 500, fontSize: '10px', colors: 'var(--text-secondary)' }, offsetX: 0 } },
		yaxis: { min: 0, max: 600, tickAmount: 4, labels: { style: { fontFamily: 'Montserrat', fontWeight: 500, fontSize: '10px', colors: 'var(--text-secondary)' }, formatter: (val) => val.toString() } },
		tooltip: { enabled: true, theme: resolvedTheme === "dark" || resolvedTheme === "blue" ? "dark" : "light", style: { fontSize: '12px', fontFamily: "Montserrat" } },
	};

	const chartSeries = [{ name: tabs.find(t => t.id === activeTab)?.label || '', data: chartData[activeTab] }];

	useEffect(() => {
		if (isFullscreen) document.body.style.overflow = 'hidden';
		else document.body.style.overflow = 'unset';
		return () => { document.body.style.overflow = 'unset'; };
	}, [isFullscreen]);

	const chartContent = (
		<>
			<div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
					<Text variant="body-md-semibold" color="text-primary">Patient Census</Text>
					<Text variant="body-sm" color="text-secondary">All Departments · Last 6 Months</Text>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
					{tabs.map((tab) => (
						<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`rounded-full cursor-pointer transition-all text-[12px] leading-[100%] border-none ${activeTab === tab.id ? 'bg-gradient-to-r from-accent-primary to-accent-primary/50 font-semibold text-white' : 'bg-tertiary font-medium text-text-secondary'}`} style={{ padding: '8px 15px' }}>
							{tab.label}
						</button>
					))}
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
			<div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center" style={{ padding: 16 }} onClick={(e) => { if (e.target === e.currentTarget && onToggleFullscreen) onToggleFullscreen(); }}>
				<div className="bg-primary rounded-[15px] w-full max-w-6xl max-h-[90vh] overflow-auto" style={{ padding: 24 }}>{chartContent}</div>
			</div>
		);
	}

	return (
		<DashboardCard padding="none" className="flex flex-col" style={{ padding: 18, height: 440, gridColumn: 'span 8' }}>{chartContent}</DashboardCard>
	);
};

const PatientCensusGrid = () => {
	const [isFullscreen, setIsFullscreen] = useState(false);

	return (
		<>
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
				<PatientCensusChart isFullscreen={isFullscreen} onToggleFullscreen={() => setIsFullscreen(!isFullscreen)} />
				<PatientSatisfactionScore />
			</div>
			{isFullscreen && <PatientCensusChart isFullscreen={isFullscreen} onToggleFullscreen={() => setIsFullscreen(!isFullscreen)} />}
		</>
	);
};

export default PatientCensusGrid;
