'use client';

import * as React from "react";
import Text from "@/components/text";
import { TrendingUp, TrendingDown } from "lucide-react";
import { FaUserDoctor, FaClock, FaFire, FaBolt, FaArrowTrendUp } from "react-icons/fa6";
import clsx from "clsx";

function fmtMin(minutes?: number): string {
	if (!minutes || minutes <= 0) return '0m';
	if (minutes < 1) return `${Math.round(minutes * 60)}s`;
	if (minutes < 60) return `${minutes.toFixed(1)}m`;
	const h = Math.floor(minutes / 60);
	const m = Math.round(minutes % 60);
	return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

type KPICardProps = {
	title: string;
	value: string;
	change: string;
	changeType: "positive" | "negative";
	icon: React.ReactNode;
	iconBgColor: string;
	infoText?: string;
	animationDelay?: number;
};

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
	if (decimals > 0) return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const InfoIcon = () => (
	<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
		<path d="M7.0005 0C8.85715 0 10.6378 0.737551 11.9506 2.0504C13.2634 3.36325 14.001 5.14385 14.001 7.0005C14.001 8.85715 13.2634 10.6378 11.9506 11.9506C10.6378 13.2634 8.85715 14.001 7.0005 14.001C5.14385 14.001 3.36325 13.2634 2.0504 11.9506C0.73755 10.6378 0 8.85715 0 7.0005C0 5.14385 0.73755 3.36325 2.0504 2.0504C3.36325 0.737551 5.14385 0 7.0005 0ZM8.0505 4.298C8.5705 4.298 8.9925 3.937 8.9925 3.402C8.9925 2.867 8.5695 2.506 8.0505 2.506C7.5305 2.506 7.1105 2.867 7.1105 3.402C7.1105 3.937 7.5305 4.298 8.0505 4.298ZM8.2335 9.925C8.2335 9.818 8.2705 9.54 8.2495 9.382L7.4275 10.328C7.2575 10.507 7.0445 10.631 6.9445 10.598C6.89913 10.5813 6.86121 10.549 6.83756 10.5068C6.81391 10.4646 6.80609 10.4154 6.8155 10.368L8.1855 6.04C8.2975 5.491 7.9895 4.99 7.3365 4.926C6.6475 4.926 5.6335 5.625 5.0165 6.512C5.0165 6.618 4.9965 6.882 5.0175 7.04L5.8385 6.093C6.0085 5.916 6.2065 5.791 6.3065 5.825C6.35577 5.84268 6.39614 5.87898 6.41895 5.92609C6.44176 5.97321 6.44519 6.02739 6.4285 6.077L5.0705 10.384C4.9135 10.888 5.2105 11.382 5.9305 11.494C6.9905 11.494 7.6165 10.812 8.2345 9.925H8.2335Z" fill="#A3B2BE" />
	</svg>
);

const KPICard = ({ title, value, change, changeType, icon, iconBgColor, infoText, animationDelay = 0 }: KPICardProps) => {
	const [isHovered, setIsHovered] = React.useState(false);
	const [showTooltip, setShowTooltip] = React.useState(false);
	const [animatedNumber, setAnimatedNumber] = React.useState(0);
	const [isVisible, setIsVisible] = React.useState(false);
	const tooltipContent = infoText || change;
	const parsedValue = React.useMemo(() => parseValue(value), [value]);

	React.useEffect(() => {
		const timer = setTimeout(() => setIsVisible(true), animationDelay);
		return () => clearTimeout(timer);
	}, [animationDelay]);

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
		<div
			className={clsx(
				"relative bg-primary rounded-[15px] shadow-soft w-full flex justify-between",
				"transition-all duration-500 ease-out",
				"hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:-translate-y-0.5",
				isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
			)}
			style={{ transitionDelay: `${animationDelay}ms`, padding: 18, height: 135 }}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => { setIsHovered(false); setShowTooltip(false); }}
		>
			{infoText && isHovered && (
				<div className="absolute top-2 right-2">
					<button onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)} className="rounded-[6px] hover:bg-tertiary transition-colors" style={{ padding: 4 }} title="Info">
						<InfoIcon />
					</button>
					{showTooltip && (
						<div className="absolute right-0 top-full w-[220px] bg-text-primary text-white text-xs rounded-[8px] z-50 shadow-lg" style={{ padding: 12, marginTop: 8 }}>
							{tooltipContent}
							<div className="absolute right-4 -top-1 w-2 h-2 bg-text-primary rotate-45" />
						</div>
					)}
				</div>
			)}
			<div className="flex flex-col justify-between h-full">
				<div className={clsx("w-[37px] h-[37px] rounded-[10px] flex items-center justify-center", "transition-transform duration-300", isHovered && "scale-110")} style={{ backgroundColor: iconBgColor, padding: 8 }}>
					{icon}
				</div>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
					<Text variant="body-sm-semibold" color="text-primary">{title}</Text>
					<span className={clsx("font-bold text-[32px] leading-[100%] text-text-primary tabular-nums", "transition-transform duration-300", isHovered && "scale-[1.02] origin-left")}>
						{parsedValue.prefix}{formatNumber(animatedNumber, parsedValue.decimals)}{parsedValue.suffix}
					</span>
				</div>
			</div>
			<div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
				{changeType === "negative" ? <TrendingDown size={11} className="text-accent-red" strokeWidth={3} /> : <TrendingUp size={11} className="text-accent-green" strokeWidth={3} />}
				<span className={`font-semibold text-[12px] leading-[100%] ${changeType === "negative" ? 'text-accent-red' : 'text-accent-green'}`} style={{ paddingRight: 24 }}>{change}</span>
			</div>
		</div>
	);
};

const KPIGrid = ({ data }: { data: any }) => {
	return (
		<div className="w-full">
			<div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<KPICard title="Average Response Time" value={data ? fmtMin(data.avg_reply_response_minutes_all) : "—"} change="Overall" changeType="positive" icon={<FaClock size={16} className="text-accent-primary" />} iconBgColor="#2484C71A" infoText="Average reply time for all messages sent." animationDelay={0} />
				<KPICard title="Critical Response" value={data ? fmtMin(data.avg_reply_response_minutes_critical) : "—"} change="Critical msg" changeType="positive" icon={<FaFire size={16} className="text-accent-red" />} iconBgColor="#FF5F571A" infoText="Average reply time for critical messages." animationDelay={100} />
				<KPICard title="Critical Acknowledgment" value={data ? fmtMin(data.avg_critical_ack_minutes) : "—"} change="Acknowledged" changeType="positive" icon={<FaBolt size={16} className="text-accent-violet" />} iconBgColor="#6974F71A" infoText="Average confirmation time for critical messages." animationDelay={200} />
				<KPICard title="Escalation Rate" value={data ? `${data.escalation_rate_percent?.toFixed(1) ?? 0}%` : "—"} change={`${data?.escalated_critical_messages ?? 0} escalated`} changeType="negative" icon={<FaArrowTrendUp size={16} className="text-accent-green" />} iconBgColor="#00C8B31A" infoText="Percentage of critical messages that escalated." animationDelay={300} />
			</div>
		</div>
	);
};

export default KPIGrid;
