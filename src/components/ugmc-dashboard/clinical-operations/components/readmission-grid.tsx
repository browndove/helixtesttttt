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

const ReadmissionGrid = () => {
	const [isFullscreen, setIsFullscreen] = useState(false);
	const { resolvedTheme } = useTheme();

	const barChartOptions: ApexCharts.ApexOptions = {
		chart: { type: "bar", height: isFullscreen ? 450 : 240, toolbar: { show: false }, zoom: { enabled: false } },
		plotOptions: { bar: { columnWidth: "45%", borderRadius: 4, borderRadiusApplication: "end" } },
		dataLabels: { enabled: false },
		colors: ["#2980D3"],
		xaxis: {
			categories: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN"],
			labels: { style: { fontFamily: "Montserrat", fontWeight: 500, fontSize: "10px", colors: "var(--text-secondary)" } },
			axisBorder: { show: false }, axisTicks: { show: false },
		},
		yaxis: {
			min: 0, max: 80, tickAmount: 4,
			labels: { style: { fontFamily: "Montserrat", fontWeight: 500, fontSize: "10px", colors: "var(--text-secondary)" }, formatter: (val: number) => String(Math.round(val)) },
		},
		grid: { borderColor: "var(--bg-tertiary)", strokeDashArray: 4, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
		legend: { show: true, position: "bottom", horizontalAlign: "center", fontFamily: "Montserrat", fontWeight: 500, fontSize: "12px", labels: { colors: "var(--text-secondary)" }, markers: { size: 6, offsetX: -4 }, itemMargin: { horizontal: 8 } },
		tooltip: { enabled: true, theme: resolvedTheme === "dark" || resolvedTheme === "blue" ? "dark" : "light", style: { fontSize: '12px', fontFamily: "Montserrat" }, y: { formatter: (val: number) => `${val}` } },
	};

	const barChartSeries = [{ name: "Readmission Rate", data: [65, 70, 38, 54, 20, 38] }];

	useEffect(() => {
		if (isFullscreen) document.body.style.overflow = 'hidden';
		else document.body.style.overflow = 'unset';
		return () => { document.body.style.overflow = 'unset'; };
	}, [isFullscreen]);

	const readmissionChartContent = (
		<>
			<div className="flex items-start justify-between">
				<div className="flex flex-col gap-[2px]">
					<Text variant="body-md-semibold" color="text-primary">All Cause Readmission Rate</Text>
					<Text variant="body-sm" color="text-secondary">All Departments · Last 6 Months</Text>
				</div>
				<button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 bg-tertiary rounded-[8px] cursor-pointer hover:bg-tertiary/80 transition-colors">
					{isFullscreen ? <FaCompressAlt size={14} className="text-text-secondary" /> : <FaExpandAlt size={14} className="text-text-secondary" />}
				</button>
			</div>
			<div className="flex-1 w-full min-h-0 mt-2">
				<Chart options={barChartOptions} series={barChartSeries} type="bar" width="100%" height={isFullscreen ? 450 : "100%"} />
			</div>
		</>
	);

	const causeSpecificData = [
		{ name: "Cardiac", percent: 4.3, cases: 19, color: "#FF5F57" },
		{ name: "Respiratory", percent: 2.1, cases: 9, color: "#00C8B3" },
		{ name: "Surgical", percent: 3.8, cases: 13, color: "#F5A623" },
		{ name: "Neurological", percent: 4.3, cases: 19, color: "#2980D3" },
		{ name: "Oncology", percent: 4.0, cases: 17, color: "#8F97F9" },
	];

	return (
		<>
			{isFullscreen && (
				<FullscreenOverlay onClose={() => setIsFullscreen(false)}>
					<div className="bg-primary rounded-[15px] w-full max-w-6xl max-h-[90vh] overflow-auto p-6 flex flex-col gap-[2px]">{readmissionChartContent}</div>
				</FullscreenOverlay>
			)}
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
				<DashboardCard padding="none" className="flex flex-col" style={{ padding: 20, height: 320, gap: 2, gridColumn: 'span 6' }}>
					{readmissionChartContent}
				</DashboardCard>

				{/* Current Readmission Rate Card with Gradient Border */}
				<div
					className="flex flex-col justify-between w-full rounded-[15px] bg-primary shadow-soft"
					style={{
						gridColumn: 'span 3',
						height: 320,
						padding: 15,
						border: "1px solid transparent",
						backgroundImage: "linear-gradient(var(--color-primary), var(--color-primary)), linear-gradient(155.87deg, #2980D3 6.04%, rgba(41, 128, 211, 0) 50%, rgba(21, 66, 109, 0.3) 93.96%)",
						backgroundOrigin: "border-box",
						backgroundClip: "padding-box, border-box",
					}}
				>
					<div className="flex flex-col items-center gap-[2px]">
						<Text variant="body-md-semibold" color="text-primary" className="text-center">Current Readmission Rate</Text>
						<Text variant="body-sm" color="text-secondary" className="text-center">Last 30 Days</Text>
					</div>
					<div className="flex flex-col items-center justify-center relative h-[140px] mt-[55px]">
						<Chart
							options={{
								chart: { type: 'donut' },
								plotOptions: { pie: { startAngle: -90, endAngle: 90, donut: { size: '70%' } } },
								dataLabels: { enabled: false },
								fill: { colors: ['#2980D3', '#2980D31A'] },
								legend: { show: false },
								labels: ['Readmission', 'No Readmission'],
								tooltip: { enabled: false },
								states: { hover: { filter: { type: 'none' } }, active: { filter: { type: 'none' } } },
								stroke: { width: 0 },
							}}
							series={[9.5, 90.5]}
							type="donut"
							width={200}
							height={200}
						/>
						<div className="absolute top-[25px] flex flex-col items-center">
							<span className="font-medium text-[12px] leading-[100%] text-text-tertiary">Rate</span>
							<span className="font-bold text-[28px] leading-[100%] text-accent-primary mt-1">9.5%</span>
							<span className="font-semibold text-[12px] leading-[100%] text-text-secondary text-center mt-1">30 Day Readmission</span>
						</div>
					</div>
					<div className="flex flex-col gap-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<div className="w-2.5 h-2.5 rounded-sm bg-accent-primary" />
								<span className="font-medium text-[12px] leading-[100%] text-text-primary">Readmission</span>
							</div>
							<span className="font-semibold text-[12px] leading-[100%] text-accent-red px-[7px] py-1 rounded-[5px] bg-accent-red/10">9.5%</span>
						</div>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<div className="w-2.5 h-2.5 rounded-sm bg-accent-primary/10" />
								<span className="font-medium text-[12px] leading-[100%] text-text-primary">No Readmission</span>
							</div>
							<span className="font-semibold text-[12px] leading-[100%] text-accent-green px-[7px] py-1 rounded-[5px] bg-accent-green/10">90.5%</span>
						</div>
					</div>
				</div>

				<DashboardCard padding="none" className="flex flex-col" style={{ padding: 20, height: 320, gap: 2, gridColumn: 'span 3' }}>
					<Text variant="body-md-semibold" color="text-primary">Cause Specific Readmission Rate</Text>
					<Text variant="body-sm" color="text-secondary">All Departments · Last 6 Months</Text>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16, flex: 1 }}>
						{causeSpecificData.map((item, index) => (
							<div key={index} className="flex flex-col gap-1">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
										<span className="font-medium text-[12px] leading-[100%] text-text-secondary">{item.name}</span>
									</div>
									<div className="flex items-center gap-2">
										<div className="w-10 h-[19px] rounded-full px-1.5 py-0.5 flex items-center justify-center" style={{ backgroundColor: `${item.color}20` }}>
											<span className="font-semibold text-[11px] leading-[100%]" style={{ color: item.color }}>{item.percent}%</span>
										</div>
										<span className="font-medium text-[12px] leading-[100%] text-text-tertiary">{item.cases} Cases</span>
									</div>
								</div>
								<div className="w-full h-[7px] rounded-full bg-secondary overflow-hidden">
									<div className="h-full rounded-full" style={{ width: `${(item.percent / 5) * 100}%`, backgroundColor: item.color }} />
								</div>
							</div>
						))}
					</div>
				</DashboardCard>
			</div>
		</>
	);
};

export default ReadmissionGrid;
