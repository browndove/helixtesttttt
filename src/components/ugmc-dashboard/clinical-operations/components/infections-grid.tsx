"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import Text from "@/components/text";
import dynamic from "next/dynamic";
import { TrendingUp, TrendingDown } from 'lucide-react';
import { FaExpandAlt, FaCompressAlt } from "react-icons/fa";
import { useTheme } from "next-themes";
import FullscreenOverlay from "@/components/fullscreen-overlay";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const InfectionsGrid = () => {
	const [isFullscreen, setIsFullscreen] = useState(false);
	const { resolvedTheme } = useTheme();

	const chartOptions: ApexCharts.ApexOptions = {
		chart: {
			type: "area", height: isFullscreen ? 500 : 280,
			toolbar: { show: false }, sparkline: { enabled: false }, zoom: { enabled: false },
			animations: { enabled: true, speed: 800 },
		},
		colors: ["#2E7DD3"],
		stroke: { curve: "smooth", width: 2.5 },
		fill: { type: "gradient", opacity: 0.5, gradient: { shade: "light", type: "vertical", shadeIntensity: 0.2, opacityFrom: 0.5, opacityTo: 0.15, stops: [0, 100] } },
		markers: { size: 4, colors: ["#FFFFFF"], strokeColors: ["#2E7DD3"], strokeWidth: 2, hover: { size: 6 } },
		dataLabels: { enabled: false },
		xaxis: {
			categories: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN"],
			axisBorder: { show: false }, axisTicks: { show: false },
			labels: { style: { colors: "var(--text-secondary)", fontSize: "10px", fontWeight: 500, fontFamily: "Montserrat" } },
		},
		yaxis: {
			min: 0, max: 600, tickAmount: 4,
			axisBorder: { show: false }, axisTicks: { show: false },
			labels: { style: { colors: "var(--text-secondary)", fontSize: "10px", fontWeight: 500, fontFamily: "Montserrat" }, formatter: (val) => val.toString() },
		},
		grid: { show: true, borderColor: "var(--bg-tertiary)", strokeDashArray: 4, xaxis: { lines: { show: true } }, yaxis: { lines: { show: true } }, padding: { top: 0, right: 10, bottom: 0, left: 10 } },
		legend: { show: false },
		tooltip: { theme: resolvedTheme === "dark" || resolvedTheme === "blue" ? "dark" : "light", shared: true, intersect: false, style: { fontSize: '12px', fontFamily: "Montserrat" }, y: { formatter: (val) => `${val}` } },
	};

	const chartSeries = [{ name: "Infections", data: [30, 470, 150, 260, 560, 320] }];

	useEffect(() => {
		if (isFullscreen) document.body.style.overflow = 'hidden';
		else document.body.style.overflow = 'unset';
		return () => { document.body.style.overflow = 'unset'; };
	}, [isFullscreen]);

	const infections = [
		{ code: 'CLABSI', name: 'Central-line infections', cases: 9, change: -0.2, isIncrease: false },
		{ code: 'CAUTI', name: 'Catheter-associated UTI', cases: 8, change: 0.1, isIncrease: true },
		{ code: 'C. diff', name: 'Clostridioides difficile', cases: 6, change: -0.3, isIncrease: false },
		{ code: 'MRSA', name: 'Methicillin-resistant staph', cases: 4, change: 0.2, isIncrease: true },
	];

	const totalCases = infections.reduce((sum, item) => sum + item.cases, 0);

	const [animatedCases, setAnimatedCases] = useState(infections.map(() => 0));
	const [animatedTotal, setAnimatedTotal] = useState(0);
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => { setIsVisible(true); }, []);

	useEffect(() => {
		if (!isVisible) return;
		const duration = 1500;
		const startTime = Date.now();
		const animate = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const eased = 1 - Math.pow(1 - progress, 3);
			setAnimatedCases(infections.map(item => Math.round(item.cases * eased)));
			setAnimatedTotal(Math.round(totalCases * eased));
			if (progress < 1) requestAnimationFrame(animate);
			else { setAnimatedCases(infections.map(item => item.cases)); setAnimatedTotal(totalCases); }
		};
		requestAnimationFrame(animate);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isVisible]);

	const infectionsChartContent = (
		<>
			<div className="flex items-start justify-between">
				<div className="flex flex-col gap-[5px]">
					<Text variant="body-md-semibold" color="text-primary">Hospital Acquired Infections Over Time</Text>
					<Text variant="body-sm" color="text-secondary">All Departments · Last 6 Months</Text>
				</div>
				<button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 bg-tertiary rounded-[8px] cursor-pointer hover:bg-tertiary/80 transition-colors">
					{isFullscreen ? <FaCompressAlt size={14} className="text-text-secondary" /> : <FaExpandAlt size={14} className="text-text-secondary" />}
				</button>
			</div>
			<div className="flex-1 w-full min-h-0">
				<Chart options={chartOptions} series={chartSeries} type="area" width="100%" height={isFullscreen ? 500 : "100%"} />
			</div>
		</>
	);

	return (
		<>
			{isFullscreen && (
				<FullscreenOverlay onClose={() => setIsFullscreen(false)}>
					<div className="bg-primary rounded-[15px] w-full max-w-6xl max-h-[90vh] overflow-auto p-6 flex flex-col gap-[15px]">{infectionsChartContent}</div>
				</FullscreenOverlay>
			)}
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
				<DashboardCard padding="none" className="rounded-[15px] flex flex-col" style={{ padding: 15, height: 360, gap: 15, gridColumn: 'span 9' }}>
					{infectionsChartContent}
				</DashboardCard>
				<DashboardCard padding="none" className="" style={{ padding: 16, height: 360, gridColumn: 'span 3' }}>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 5, height: '100%' }}>
						<Text variant="body-md-semibold" color="text-primary">Top Hospital Acquired Infections</Text>
						<Text variant="body-sm" color="text-secondary" className="mb-2">All Departments · Last 6 Months</Text>
						<div className="bg-secondary border border-tertiary rounded-[10px]" style={{ display: 'flex', flexDirection: 'column', padding: 12, height: '100%', justifyContent: 'space-between' }}>
							{infections.map((infection, index) => (
								<div key={index}>
									<div className="flex items-start justify-between py-1">
										<div className="flex flex-col gap-[2px] min-w-0 flex-1 mr-2">
											<span className="font-bold text-[12px] leading-[140%] text-text-primary">{infection.code}</span>
											<span className="font-medium text-[11px] leading-[140%] text-text-secondary">{infection.name}</span>
										</div>
										<div className="flex items-center gap-2 shrink-0">
											<div className="flex items-center justify-center bg-accent-primary/10 rounded-[5px] px-2 py-1">
												<span className="font-semibold text-[11px] leading-[100%] text-accent-primary whitespace-nowrap tabular-nums">{animatedCases[index]} Cases</span>
											</div>
											<div className="flex items-center gap-1">
												{infection.isIncrease ? <TrendingUp size={10} className="text-accent-red" strokeWidth={2.5} /> : <TrendingDown size={10} className="text-accent-green" strokeWidth={2.5} />}
												<span className={`font-semibold text-[11px] leading-[100%] whitespace-nowrap ${infection.isIncrease ? 'text-accent-red' : 'text-accent-green'}`}>
													{infection.isIncrease ? '+' : ''}{infection.change}%
												</span>
											</div>
										</div>
									</div>
									{index < infections.length - 1 && <div className="h-px bg-tertiary my-2"></div>}
								</div>
							))}
						</div>
						<div className="flex items-center gap-2 mt-2 ml-2">
							<div className="w-[5px] h-[5px] rounded-full bg-accent-primary"></div>
							<span className="font-medium text-[12px] leading-[100%] text-text-secondary tabular-nums">{animatedTotal} Total Cases</span>
						</div>
					</div>
				</DashboardCard>
			</div>
		</>
	);
};

export default InfectionsGrid;
