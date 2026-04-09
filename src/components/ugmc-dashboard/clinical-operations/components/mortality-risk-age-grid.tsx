"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import Text from "@/components/text";
import dynamic from "next/dynamic";
import { FaExpandAlt, FaCompressAlt } from "react-icons/fa";
import { useTheme } from "next-themes";
import FullscreenOverlay from "@/components/fullscreen-overlay";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const MortalityIndexChart = ({ isFullscreen = false, onToggleFullscreen }: { isFullscreen?: boolean; onToggleFullscreen?: () => void }) => {
	const { resolvedTheme } = useTheme();
	const chartOptions: ApexCharts.ApexOptions = {
		chart: {
			type: "area",
			height: isFullscreen ? 500 : 240,
			toolbar: { show: false },
			sparkline: { enabled: false },
			zoom: { enabled: false },
			animations: { enabled: true, speed: 800 },
		},
		colors: ["#00C8B3", "#FF5F57"],
		fill: {
			type: "gradient",
			opacity: [0.35, 0.35],
			gradient: {
				shade: "light",
				type: "vertical",
				shadeIntensity: 0.2,
				gradientToColors: undefined,
				inverseColors: false,
				opacityFrom: [0.4, 0.4],
				opacityTo: [0.1, 0.1],
				stops: [0, 100],
			},
		},
		stroke: { curve: "smooth", width: [2.5, 2.5], colors: ["#00C8B3", "#FF5F57"] },
		markers: {
			size: [4, 4],
			colors: ["#FFFFFF", "#FFFFFF"],
			strokeColors: ["#00C8B3", "#FF5F57"],
			strokeWidth: 2,
			hover: { size: 6 },
		},
		dataLabels: { enabled: false },
		xaxis: {
			categories: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN"],
			axisBorder: { show: false },
			axisTicks: { show: false },
			labels: { style: { colors: "var(--text-secondary)", fontSize: "10px", fontWeight: 500, fontFamily: "Montserrat" } },
		},
		yaxis: {
			min: 0, max: 600, tickAmount: 4,
			axisBorder: { show: false },
			axisTicks: { show: false },
			labels: { style: { colors: "var(--text-secondary)", fontSize: "10px", fontWeight: 500, fontFamily: "Montserrat" }, formatter: (val) => val.toString() },
		},
		grid: {
			show: true, borderColor: "var(--bg-tertiary)", strokeDashArray: 4,
			xaxis: { lines: { show: true } },
			yaxis: { lines: { show: true } },
			padding: { top: 0, right: 10, bottom: 0, left: 10 },
		},
		legend: {
			show: true, position: "bottom", horizontalAlign: "center",
			fontFamily: "Montserrat", fontSize: "12px", fontWeight: 500,
			labels: { colors: "var(--text-secondary)" },
			markers: { size: 8, shape: "square" as const, offsetX: -4 },
			itemMargin: { horizontal: 16 },
		},
		tooltip: {
			theme: resolvedTheme === "dark" || resolvedTheme === "blue" ? "dark" : "light",
			shared: true, intersect: false,
			style: { fontSize: '12px', fontFamily: "Montserrat" },
			y: { formatter: (val) => `${val}` },
		},
	};

	const chartSeries = [
		{ name: "Expected", data: [280, 480, 420, 300, 280, 380] },
		{ name: "Observed", data: [320, 450, 380, 350, 420, 580] },
	];

	useEffect(() => {
		if (isFullscreen) document.body.style.overflow = 'hidden';
		else document.body.style.overflow = 'unset';
		return () => { document.body.style.overflow = 'unset'; };
	}, [isFullscreen]);

	const chartContent = (
		<>
			<div className="flex items-start justify-between">
				<div className="flex flex-col gap-[2px]">
					<Text variant="body-md-semibold" color="text-primary">Mortality Index (excl. hospice)</Text>
					<Text variant="body-sm" color="text-tertiary">All Departments · Last 6 Months</Text>
				</div>
				{onToggleFullscreen && (
					<button onClick={onToggleFullscreen} className="p-2 bg-tertiary rounded-[8px] cursor-pointer hover:bg-tertiary/80 transition-colors">
						{isFullscreen ? <FaCompressAlt size={14} className="text-text-secondary" /> : <FaExpandAlt size={14} className="text-text-secondary" />}
					</button>
				)}
			</div>
			<div className="flex-1 w-full min-h-0">
				<Chart options={chartOptions} series={chartSeries} type="area" width="100%" height={isFullscreen ? 500 : "100%"} />
			</div>
		</>
	);

	if (isFullscreen) {
		return (
			<FullscreenOverlay onClose={() => onToggleFullscreen?.()}>
				<div className="bg-primary rounded-[15px] w-full max-w-6xl max-h-[90vh] overflow-auto p-6 flex flex-col gap-[15px]">{chartContent}</div>
			</FullscreenOverlay>
		);
	}

	return (
		<DashboardCard padding="none" className="w-full flex-[2] rounded-[15px] flex flex-col" style={{ padding: 18, height: 320, gap: 15 }}>{chartContent}</DashboardCard>
	);
};

const MortalityRiskAgeGrid = () => {
	const [isFullscreen, setIsFullscreen] = useState(false);
	const { resolvedTheme } = useTheme();

	const ageMixOptions: ApexCharts.ApexOptions = {
		chart: {
			type: "bar", toolbar: { show: false }, sparkline: { enabled: false }, zoom: { enabled: false },
			animations: { enabled: true, speed: 1800, animateGradually: { enabled: true, delay: 200 }, dynamicAnimation: { enabled: true, speed: 500 } },
		},
		colors: ["#2980D3"],
		plotOptions: { bar: { horizontal: true, barHeight: "50%", borderRadius: 10, borderRadiusApplication: "end", borderRadiusWhenStacked: "last" } },
		dataLabels: { enabled: false },
		xaxis: {
			min: 0, max: 2.5, tickAmount: 5, categories: ["55-64", "64-74", "74-84", "85+"],
			labels: { style: { colors: "var(--text-secondary)", fontSize: "10px", fontWeight: 500, fontFamily: "Montserrat" }, formatter: (val) => { const num = Number(val); return Number.isInteger(num) ? `${num}` : num.toFixed(1); } },
			axisBorder: { show: false }, axisTicks: { show: false },
		},
		yaxis: { labels: { style: { colors: "var(--text-secondary)", fontSize: "10px", fontWeight: 500, fontFamily: "Montserrat" } } },
		grid: { show: true, borderColor: "var(--bg-tertiary)", strokeDashArray: 4, xaxis: { lines: { show: true } }, yaxis: { lines: { show: true } }, padding: { top: 0, right: 10, bottom: 0, left: 0 } },
		legend: { show: false },
		tooltip: { enabled: true, theme: resolvedTheme === "dark" || resolvedTheme === "blue" ? "dark" : "light", style: { fontSize: '12px', fontFamily: "Montserrat" } },
	};

	const ageMixSeries = [{ name: "Mortality ratio", data: [0.9, 1.7, 2.2, 0.4] }];

	const highRiskCohorts = [
		{ label: "Cardio-thoracic cases", percent: 34, cases: 19, color: "#2980D3" },
		{ label: "Sepsis & shock", percent: 22, cases: 9, color: "#8F97F9" },
		{ label: "High-risk seniors", percent: 44, cases: 13, color: "#FF5F57" },
		{ label: "Renal failure & dialysis", percent: 19, cases: 19, color: "#F5A623" },
		{ label: "Immunocompromised oncology", percent: 17, cases: 17, color: "#00C8B3" },
	];

	const [animatedCohorts, setAnimatedCohorts] = useState(highRiskCohorts.map(() => ({ percent: 0, cases: 0 })));
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => { setIsVisible(true); }, []);

	useEffect(() => {
		if (!isVisible) return;
		const duration = 2500;
		const startTime = Date.now();
		const animate = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const eased = 1 - Math.pow(1 - progress, 3);
			setAnimatedCohorts(highRiskCohorts.map(item => ({ percent: item.percent * eased, cases: Math.round(item.cases * eased) })));
			if (progress < 1) requestAnimationFrame(animate);
			else setAnimatedCohorts(highRiskCohorts.map(item => ({ percent: item.percent, cases: item.cases })));
		};
		requestAnimationFrame(animate);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isVisible]);

	return (
		<>
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
				<div style={{ gridColumn: 'span 4' }}>
					<MortalityIndexChart isFullscreen={isFullscreen} onToggleFullscreen={() => setIsFullscreen(!isFullscreen)} />
				</div>
				<DashboardCard padding="none" className="w-full rounded-[10px] shadow-soft flex flex-col justify-between" style={{ padding: 16, height: 320, gridColumn: 'span 4' }}>
					<Text variant="body-md-semibold" color="text-primary">High-risk cohorts</Text>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
						{highRiskCohorts.map((item, index) => (
							<div key={item.label} className="flex flex-col gap-[7px]">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2.5">
										<div className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: item.color }} />
										<span className="font-medium text-[12px] leading-[100%] text-text-secondary whitespace-nowrap">{item.label}</span>
									</div>
									<div className="flex items-center justify-end gap-2.5">
										<div className="px-1.5 py-0.5 rounded-full flex items-center justify-center" style={{ backgroundColor: `${item.color}33` }}>
											<span className="font-medium text-[12px] leading-[100%] tabular-nums" style={{ color: item.color }}>{Math.round(animatedCohorts[index]?.percent || 0)}%</span>
										</div>
										<span className="font-medium text-[12px] leading-[100%] text-text-tertiary tabular-nums">{animatedCohorts[index]?.cases || 0} Cases</span>
									</div>
								</div>
								<div className="w-full h-[7px] rounded-full bg-secondary overflow-hidden">
									<div className="h-full rounded-full transition-all duration-100" style={{ width: `${animatedCohorts[index]?.percent || 0}%`, backgroundColor: item.color }} />
								</div>
							</div>
						))}
					</div>
				</DashboardCard>
				<DashboardCard padding="none" className="w-full rounded-[15px] shadow-soft flex flex-col" style={{ padding: 18, height: 320, gap: 15, gridColumn: 'span 4' }}>
					<div className="flex flex-col gap-[5px]">
						<Text variant="body-md-semibold" color="text-primary">Age mix index</Text>
						<Text variant="body-sm" color="text-tertiary">Mortality ratio</Text>
					</div>
					<div className="flex-1 w-full min-h-0">
						<Chart options={ageMixOptions} series={ageMixSeries} type="bar" width="100%" height="100%" />
					</div>
				</DashboardCard>
			</div>
			{isFullscreen && <MortalityIndexChart isFullscreen={isFullscreen} onToggleFullscreen={() => setIsFullscreen(!isFullscreen)} />}
		</>
	);
};

export default MortalityRiskAgeGrid;
