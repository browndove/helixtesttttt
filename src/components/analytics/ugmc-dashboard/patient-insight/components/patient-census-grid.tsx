'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardCard from "@/components/analytics/ugmc-dashboard/shared/dashboard-card";
import Text from "@/components/analytics/text";
import dynamic from "next/dynamic";
import { FaTriangleExclamation } from "react-icons/fa6";
import { RiExpandDiagonalLine } from "react-icons/ri";
import { GrContract } from "react-icons/gr";
import { useTheme } from "next-themes";
import FullscreenOverlay from "@/components/analytics/fullscreen-overlay";
import clsx from "clsx";
import { buildNiceYAxisScale } from "@/lib/analytics/nice-chart-axis";
import { fillDailyMessageVolumePeriod, fillDailyMessageVolumeRange } from "@/lib/analytics/daily-volume";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type MessageVolumeTab = 'all' | 'critical' | 'standard';

const MESSAGE_TABS: { id: MessageVolumeTab; label: string }[] = [
	{ id: 'all', label: 'All' },
	{ id: 'critical', label: 'Critical' },
	{ id: 'standard', label: 'Standard' },
];

const AlertIcon = () => (
	<div className="w-[32px] h-[32px] flex items-center justify-center rounded-full bg-accent-red/10">
		<FaTriangleExclamation className="text-accent-red w-[18px] h-[18px]" />
	</div>
);

const PatientSatisfactionScore = ({ data }: { data: any }) => {
	const satisfactionData = useMemo(
		() => [
			{ label: 'Critical Msgs', percentage: data?.critical_messages_rate_percent || 0, color: '#FF5F57', scoreRange: 'Of total messages' },
			{ label: 'Role Coverage', percentage: data?.role_fill_rate_percent || 0, color: '#00C8B3', scoreRange: 'Of required roles' },
			{ label: 'Active Users', percentage: data?.active_users_rate_percent || 0, color: '#2980D3', scoreRange: 'Of total staff' },
		],
		[
			data?.critical_messages_rate_percent,
			data?.role_fill_rate_percent,
			data?.active_users_rate_percent,
		]
	);

	const radius = 90;
	const strokeWidth = 45;
	const circumference = Math.PI * radius;

	const [animatedScore, setAnimatedScore] = useState(0);
	const [animatedArc, setAnimatedArc] = useState(0);
	const [animatedBars, setAnimatedBars] = useState(() => satisfactionData.map(() => 0));
	const [isVisible, setIsVisible] = useState(false);

	const targetScore = data?.escalation_rate_percent || 0;
	const targetArcPercent = targetScore / 100;

	useEffect(() => { setIsVisible(true); }, []);

	useEffect(() => {
		if (!isVisible) return;
		let cancelled = false;
		const duration = 2500;
		const startTime = Date.now();
		let frame = 0;
		const animate = () => {
			if (cancelled) return;
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const eased = 1 - Math.pow(1 - progress, 3);
			setAnimatedScore(targetScore * eased);
			setAnimatedArc(targetArcPercent * eased);
			setAnimatedBars(satisfactionData.map(item => item.percentage * eased));
			if (progress < 1) {
				frame = requestAnimationFrame(animate);
			} else {
				setAnimatedScore(targetScore);
				setAnimatedArc(targetArcPercent);
				setAnimatedBars(satisfactionData.map(item => item.percentage));
			}
		};
		frame = requestAnimationFrame(animate);
		return () => {
			cancelled = true;
			cancelAnimationFrame(frame);
		};
	}, [isVisible, targetScore, targetArcPercent, satisfactionData]);

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
	const [activeTab, setActiveTab] = useState<MessageVolumeTab>('all');

	const dailyVolume = useMemo(() => {
		const raw = Array.isArray(data?.daily_message_volume) ? data.daily_message_volume : [];
		const from =
			typeof data?.daily_message_volume_from === "string" ? data.daily_message_volume_from : null;
		const to = typeof data?.daily_message_volume_to === "string" ? data.daily_message_volume_to : null;
		if (from && to) return fillDailyMessageVolumeRange(raw, from, to);
		const windowDays = Number(data?.daily_message_volume_window_days);
		return fillDailyMessageVolumePeriod(
			raw,
			Number.isFinite(windowDays) && windowDays > 0 ? windowDays : 7
		);
	}, [
		data?.daily_message_volume,
		data?.daily_message_volume_from,
		data?.daily_message_volume_to,
		data?.daily_message_volume_window_days,
	]);

	const categories = useMemo(
		() =>
			dailyVolume.map((d: { day: string }) =>
				new Date(`${d.day}T00:00:00`).toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
				})
			),
		[dailyVolume]
	);

	const seriesData = useMemo(() => {
		if (activeTab === 'critical') {
			return dailyVolume.map((d: { critical_messages: number }) => Number(d.critical_messages) || 0);
		}
		if (activeTab === 'standard') {
			return dailyVolume.map((d: { standard_messages: number }) => Number(d.standard_messages) || 0);
		}
		return dailyVolume.map((d: { total_messages: number }) => Number(d.total_messages) || 0);
	}, [dailyVolume, activeTab]);

	const yAxisScale = useMemo(() => {
		const maxVal = Math.max(...seriesData, 0);
		return buildNiceYAxisScale(maxVal, 5);
	}, [seriesData]);

	const showMarkers = seriesData.length > 0 && seriesData.length <= 31;

	const chartOptions: ApexCharts.ApexOptions = useMemo(
		() => ({
			chart: {
				type: 'area',
				toolbar: { show: false },
				zoom: { enabled: false },
				animations: {
					enabled: true,
					speed: 1200,
					animateGradually: { enabled: true, delay: 150 },
				},
			},
			colors: ['var(--accent-primary)'],
			fill: {
				type: 'gradient',
				gradient: {
					shade: 'light',
					type: 'vertical',
					shadeIntensity: 0.35,
					gradientToColors: ['var(--accent-primary)'],
					inverseColors: false,
					opacityFrom: 0.45,
					opacityTo: 0.05,
					stops: [0, 100],
				},
			},
			stroke: {
				curve: 'smooth',
				width: 3,
				colors: ['var(--accent-primary)'],
			},
			markers: {
				size: showMarkers ? 5 : 0,
				colors: ['var(--bg-primary)'],
				strokeColors: 'var(--accent-primary)',
				strokeWidth: 2,
				hover: { size: 7 },
			},
			dataLabels: { enabled: false },
			grid: {
				show: true,
				borderColor: 'var(--bg-tertiary)',
				strokeDashArray: 4,
				xaxis: { lines: { show: true } },
				yaxis: { lines: { show: true } },
				padding: { left: 8, right: 12, top: 4, bottom: 0 },
			},
			xaxis: {
				categories,
				tickAmount: Math.min(6, Math.max(categories.length - 1, 1)),
				axisBorder: { show: false },
				axisTicks: { show: false },
				labels: {
					rotate: 0,
					rotateAlways: false,
					hideOverlappingLabels: true,
					style: {
						fontFamily: 'system-ui, -apple-system, sans-serif',
						fontWeight: 500,
						fontSize: '11px',
						colors: 'var(--text-secondary)',
					},
				},
			},
			yaxis: {
				min: 0,
				max: yAxisScale.max,
				tickAmount: yAxisScale.tickAmount,
				forceNiceScale: false,
				decimalsInFloat: 0,
				labels: {
					style: {
						fontFamily: 'system-ui, -apple-system, sans-serif',
						fontWeight: 500,
						fontSize: '11px',
						colors: 'var(--text-secondary)',
					},
					formatter: (val) => {
						const step = yAxisScale.step;
						const snapped = Math.round(val / step) * step;
						if (snapped > yAxisScale.max || Math.abs(val - snapped) > step * 0.01) {
							return '';
						}
						return snapped.toLocaleString();
					},
				},
			},
			tooltip: {
				enabled: true,
				theme: resolvedTheme === 'dark' || resolvedTheme === 'blue' ? 'dark' : 'light',
				style: { fontSize: '12px', fontFamily: 'system-ui, -apple-system, sans-serif' },
				x: {
					formatter: (_val, opts) => {
						const row = dailyVolume[opts?.dataPointIndex ?? 0];
						if (!row?.day) return String(_val ?? '');
						return new Date(`${row.day}T00:00:00`).toLocaleDateString('en-US', {
							month: 'short',
							day: 'numeric',
							year: 'numeric',
						});
					},
				},
				y: { formatter: (val) => `${Math.round(val).toLocaleString()} messages` },
			},
		}),
		[categories, yAxisScale, dailyVolume, resolvedTheme, showMarkers]
	);

	const chartSeries = [{ name: 'Messages', data: seriesData }];
	const chartHeight = isFullscreen ? 500 : 340;

	useEffect(() => {
		if (isFullscreen) document.body.style.overflow = 'hidden';
		else document.body.style.overflow = 'unset';
		return () => { document.body.style.overflow = 'unset'; };
	}, [isFullscreen]);

	const chartContent = (
		<>
			<div className="flex flex-row items-start justify-between gap-3 mb-4">
				<div className="flex flex-col gap-1 min-w-0">
					<Text variant="body-md-semibold" color="text-primary">Message Volume</Text>
					<Text variant="body-sm" color="text-secondary">
						All Departments ·{' '}
						{data?.window_days ? `Last ${data.window_days} Days` : 'Daily Breakdown'}
					</Text>
				</div>
				<div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
					<div className="flex items-center gap-1 rounded-[10px] bg-tertiary p-1">
						{MESSAGE_TABS.map((tab) => (
							<button
								key={tab.id}
								type="button"
								onClick={() => setActiveTab(tab.id)}
								className={clsx(
									'rounded-[8px] border-none cursor-pointer px-3 py-1.5 text-[12px] font-semibold leading-none transition-colors',
									activeTab === tab.id
										? 'bg-accent-primary text-white shadow-sm'
										: 'bg-transparent text-text-secondary hover:text-text-primary'
								)}
							>
								{tab.label}
							</button>
						))}
					</div>
					{onToggleFullscreen && (
						<button
							type="button"
							onClick={onToggleFullscreen}
							className="flex size-[30px] items-center justify-center rounded-[10px] bg-secondary cursor-pointer hover:bg-tertiary transition-colors"
							aria-label={isFullscreen ? 'Exit fullscreen' : 'Expand chart'}
						>
							{isFullscreen ? (
								<GrContract className="size-4 text-text-primary" />
							) : (
								<RiExpandDiagonalLine className="size-4 text-text-primary" />
							)}
						</button>
					)}
				</div>
			</div>
			<div className="flex-1 w-full min-h-0">
				{dailyVolume.length > 0 ? (
					<Chart options={chartOptions} series={chartSeries} type="area" height={chartHeight} width="100%" />
				) : (
					<div className="flex h-full min-h-[280px] items-center justify-center rounded-[12px] bg-tertiary/40">
						<Text variant="body-sm" color="text-secondary">
							No message volume data for this period.
						</Text>
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
