"use client";

import * as React from "react";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import Text from "@/components/text";
import { BsClockFill } from "react-icons/bs";
import { ImScissors } from "react-icons/im";
import { IoCallSharp } from "react-icons/io5";
import clsx from "clsx";

const parseValue = (value: string): { prefix: string; number: number; suffix: string; decimals: number } => {
	const match = value.match(/^([^\d]*)([\d,]+\.?\d*)(.*)$/);
	if (!match) return { prefix: '', number: 0, suffix: '', decimals: 0 };
	const prefix = match[1] || '';
	const numStr = match[2].replace(/,/g, '');
	const suffix = match[3] || '';
	const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0;
	return { prefix, number: parseFloat(numStr), suffix, decimals };
};

const formatNumber = (num: number, decimals: number): string => {
	if (decimals > 0) {
		return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	}
	return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const AnimatedValue = ({ value, className }: { value: string; className?: string }) => {
	const [animatedNumber, setAnimatedNumber] = React.useState(0);
	const [isVisible, setIsVisible] = React.useState(false);
	const parsedValue = React.useMemo(() => parseValue(value), [value]);

	React.useEffect(() => { setIsVisible(true); }, []);

	React.useEffect(() => {
		if (!isVisible) return;
		const duration = 1200;
		const startTime = Date.now();
		const animate = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const eased = 1 - Math.pow(1 - progress, 3);
			setAnimatedNumber(parsedValue.number * eased);
			if (progress < 1) requestAnimationFrame(animate);
			else setAnimatedNumber(parsedValue.number);
		};
		requestAnimationFrame(animate);
	}, [isVisible, parsedValue.number]);

	return (
		<span className={clsx("tabular-nums", className)}>
			{parsedValue.prefix}{formatNumber(animatedNumber, parsedValue.decimals)}{parsedValue.suffix}
		</span>
	);
};

const PulseWaveIcon = ({ color = "#2484C71A" }: { color?: string }) => (
	<svg className="block" width="16.666666" height="16.666666" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
		<path d="M2 10H5.3L6.9 6.4L9.2 13.6L10.9 10H14.2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		<path d="M16.8 10H18" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

const InfoIcon = () => (
	<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
		<path d="M7.0005 0C8.85715 0 10.6378 0.737551 11.9506 2.0504C13.2634 3.36325 14.001 5.14385 14.001 7.0005C14.001 8.85715 13.2634 10.6378 11.9506 11.9506C10.6378 13.2634 8.85715 14.001 7.0005 14.001C5.14385 14.001 3.36325 13.2634 2.0504 11.9506C0.73755 10.6378 0 8.85715 0 7.0005C0 5.14385 0.73755 3.36325 2.0504 2.0504C3.36325 0.737551 5.14385 0 7.0005 0ZM8.0505 4.298C8.5705 4.298 8.9925 3.937 8.9925 3.402C8.9925 2.867 8.5695 2.506 8.0505 2.506C7.5305 2.506 7.1105 2.867 7.1105 3.402C7.1105 3.937 7.5305 4.298 8.0505 4.298ZM8.2335 9.925C8.2335 9.818 8.2705 9.54 8.2495 9.382L7.4275 10.328C7.2575 10.507 7.0445 10.631 6.9445 10.598C6.89913 10.5813 6.86121 10.549 6.83756 10.5068C6.81391 10.4646 6.80609 10.4154 6.8155 10.368L8.1855 6.04C8.2975 5.491 7.9895 4.99 7.3365 4.926C6.6475 4.926 5.6335 5.625 5.0165 6.512C5.0165 6.618 4.9965 6.882 5.0175 7.04L5.8385 6.093C6.0085 5.916 6.2065 5.791 6.3065 5.825C6.35577 5.84268 6.39614 5.87898 6.41895 5.92609C6.44176 5.97321 6.44519 6.02739 6.4285 6.077L5.0705 10.384C4.9135 10.888 5.2105 11.382 5.9305 11.494C6.9905 11.494 7.6165 10.812 8.2345 9.925H8.2335Z" fill="#A3B2BE" />
	</svg>
);

const KPIGrid = () => {
	const renderInfo = (text: string) => (
		<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
			<div className="relative group/icon">
				<button className="p-1 rounded-[6px] hover:bg-tertiary transition-colors" title="Info">
					<InfoIcon />
				</button>
				<div className="absolute right-0 top-full mt-2 w-[200px] bg-text-primary text-white text-xs rounded-[8px] p-3 z-10 shadow-lg opacity-0 pointer-events-none group-hover/icon:opacity-100 group-hover/icon:pointer-events-auto transition-opacity">
					{text}
					<div className="absolute right-4 -top-1 w-2 h-2 bg-text-primary rotate-45" />
				</div>
			</div>
		</div>
	);

	return (
		<div className="w-full">
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
				{/* Readmissions Card */}
				<DashboardCard padding="none" className="group relative w-full rounded-[15px] flex justify-between" style={{ padding: 18, height: 135 }}>
					{renderInfo("51 readmissions out of 540 discharges.")}
					<div style={{ flex: 1, height: 88, display: 'flex', flexDirection: 'column', gap: 12 }}>
						<div className="w-full h-[49px] flex flex-col gap-[5px]">
							<Text variant="body-sm-semibold" color="text-primary">Readmissions</Text>
							<AnimatedValue value="51" className="font-bold text-[32px] leading-[100%] text-text-primary" />
						</div>
						<div className="w-full border-t border-dashed border-tertiary" />
						<Text variant="body-sm" color="text-tertiary">of 540 discharges</Text>
					</div>
					<div className="w-[37px] h-[37px] rounded-[10px] bg-accent-primary/10 flex items-center justify-center self-start mr-2 p-2 transition-transform duration-300 group-hover:scale-110">
						<div className="w-5 h-5 rounded-[6px] bg-accent-primary flex items-center justify-center">
							<PulseWaveIcon color="#FFFFFF" />
						</div>
					</div>
				</DashboardCard>

				{/* Average Days To Readmit Card */}
				<DashboardCard padding="none" className="group relative w-full rounded-[15px] flex justify-between" style={{ padding: 18, height: 135 }}>
					{renderInfo("Average days to readmit within a 30-day window.")}
					<div style={{ width: '100%', height: 88, display: 'flex', flexDirection: 'column', gap: 12 }}>
						<div className="w-full h-[49px] flex items-start justify-between">
							<div className="min-w-0 h-[49px] flex flex-col gap-[5px]">
								<Text variant="body-sm-semibold" color="text-primary" className="truncate">Average Days To Readmit</Text>
								<AnimatedValue value="6.5 Days" className="font-bold text-[32px] leading-[100%] text-text-primary" />
							</div>
							<div className="w-[37px] h-[37px] rounded-[10px] bg-accent-green/10 flex items-center justify-center mr-2 p-2 transition-transform duration-300 group-hover:scale-110">
								<BsClockFill size={20} className="text-accent-green" />
							</div>
						</div>
						<div className="w-full border-t border-dashed border-tertiary" />
						<Text variant="body-sm" color="text-tertiary">Median 30-day window</Text>
					</div>
				</DashboardCard>

				{/* Post-op Complications Card */}
				<DashboardCard padding="none" className="group relative w-full rounded-[15px] flex justify-between" style={{ padding: 18, height: 135 }}>
					{renderInfo("Post-operative complications recorded this period.")}
					<div style={{ width: '100%', height: 88, display: 'flex', flexDirection: 'column', gap: 12 }}>
						<div className="w-full h-[49px] flex items-start justify-between">
							<div className="min-w-0 h-[49px] flex flex-col gap-[5px]">
								<Text variant="body-sm-semibold" color="text-primary" className="truncate">Post-op Complications</Text>
								<AnimatedValue value="11" className="font-bold text-[32px] leading-[100%] text-text-primary" />
							</div>
							<div className="w-[37px] h-[37px] rounded-[10px] bg-accent-red/10 flex items-center justify-center mr-2 p-2 transition-transform duration-300 group-hover:scale-110">
								<ImScissors size={18} className="text-accent-red" />
							</div>
						</div>
						<div className="w-full border-t border-dashed border-tertiary" />
						<Text variant="body-sm" color="text-tertiary">Contribution to returns</Text>
					</div>
				</DashboardCard>

				{/* Incoming Transfer Request Card */}
				<DashboardCard padding="none" className="group relative w-full rounded-[15px] flex justify-between" style={{ padding: 18, height: 135 }}>
					{renderInfo("Transition calls completed within 48 hours.")}
					<div style={{ width: '100%', height: 88, display: 'flex', flexDirection: 'column', gap: 12 }}>
						<div className="w-full h-[49px] flex items-start justify-between">
							<div className="min-w-0 h-[49px] flex flex-col gap-[5px]">
								<Text variant="body-sm-semibold" color="text-primary" className="truncate">Incoming Transfer Request</Text>
								<AnimatedValue value="128" className="font-bold text-[32px] leading-[100%] text-text-primary" />
							</div>
							<div className="w-[37px] h-[37px] rounded-[10px] bg-accent-violet/10 flex items-center justify-center mr-2 p-2 transition-transform duration-300 group-hover:scale-110">
								<IoCallSharp size={18} className="text-accent-violet" />
							</div>
						</div>
						<div className="w-full border-t border-dashed border-tertiary" />
						<Text variant="body-sm" color="text-tertiary">Completed within 48h</Text>
					</div>
				</DashboardCard>
			</div>
		</div>
	);
};

export default KPIGrid;
