'use client';

import { useMemo, useState } from 'react';
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import Text from "@/components/text";
import { HiMiniInformationCircle } from "react-icons/hi2";
import { IoChevronDown } from "react-icons/io5";

const RoleEscalationsTable = ({ data }: { data: any }) => {
	const [selectedDomain, setSelectedDomain] = useState('Top Escalated');
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);

	const domainOptions = ['Top Escalated', 'Least Escalated'];
	const itemsList = useMemo(() => {
		const top = Array.isArray(data?.top_escalated_roles) ? [...data.top_escalated_roles] : [];
		const least = Array.isArray(data?.least_escalated_roles) ? [...data.least_escalated_roles] : [];

		const sortByEscalationsDesc = (a: any, b: any) => {
			const diff = (b?.escalation_count ?? 0) - (a?.escalation_count ?? 0);
			if (diff !== 0) return diff;
			return String(a?.role_name ?? "").localeCompare(String(b?.role_name ?? ""));
		};
		const sortByEscalationsAsc = (a: any, b: any) => {
			const diff = (a?.escalation_count ?? 0) - (b?.escalation_count ?? 0);
			if (diff !== 0) return diff;
			return String(a?.role_name ?? "").localeCompare(String(b?.role_name ?? ""));
		};

		const top10 = top.sort(sortByEscalationsDesc).slice(0, 10);
		const least10 = least.sort(sortByEscalationsAsc).slice(0, 10);

		return selectedDomain === 'Top Escalated' ? top10 : least10;
	}, [data, selectedDomain]);

	return (
		<DashboardCard padding="none" className="w-full flex flex-col" style={{ padding: 18, height: 440 }}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
					<Text variant="body-md-semibold" color="text-primary">Role Escalations</Text>
					<Text variant="body-sm" color="text-secondary">Tracking policy non-responders</Text>
				</div>
				<div className="relative">
					<button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="rounded-[8px] bg-tertiary flex items-center border-none cursor-pointer" style={{ padding: '8px 12px', gap: 8 }}>
						<HiMiniInformationCircle size={16} className="text-text-tertiary" />
						<span className="font-medium text-[12px] leading-[100%] text-text-secondary">{selectedDomain}</span>
						<IoChevronDown size={14} className="text-text-secondary" />
					</button>
					{isDropdownOpen && (
						<div className="absolute top-full right-0 bg-secondary border border-tertiary rounded-[8px] shadow-soft z-10 min-w-[150px]" style={{ marginTop: 4 }}>
							{domainOptions.map((option) => (
								<button
									key={option}
									onClick={() => { setSelectedDomain(option); setIsDropdownOpen(false); }}
									className={`w-full text-left border-none cursor-pointer font-medium text-[12px] text-text-primary transition-colors ${selectedDomain === option ? 'bg-tertiary' : 'bg-transparent hover:bg-tertiary/50'}`}
											style={{ padding: '10px 12px' }}
								>
									{option}
								</button>
							))}
						</div>
					)}
				</div>
			</div>
			<div className="flex-1 overflow-auto border border-tertiary rounded-[10px]">
				<table className="w-full">
					<thead>
						<tr className="bg-tertiary border border-tertiary">
							<th className="text-left font-semibold text-[12px] leading-[100%] text-text-primary" style={{ padding: '12px 20px' }}>Rank</th>
							<th className="text-left font-semibold text-[12px] leading-[100%] text-text-primary" style={{ padding: '12px 20px' }}>Role</th>
							<th className="text-left font-semibold text-[12px] leading-[100%] text-text-primary" style={{ padding: '12px 20px' }}>Role ID</th>
							<th className="text-left font-semibold text-[12px] leading-[100%] text-text-primary" style={{ padding: '12px 20px' }}>Escalations</th>
							<th className="text-left font-semibold text-[12px] leading-[100%] text-text-primary" style={{ padding: '12px 20px' }}>Total Msgs</th>
							<th className="text-left font-semibold text-[12px] leading-[100%] text-text-primary" style={{ padding: '12px 20px' }}>Escalation Rate</th>
						</tr>
					</thead>
					<tbody>
						{itemsList.map((item: any, index: number) => {
							const rate = item.total_messages_for_role > 0 ? (item.escalation_count / item.total_messages_for_role) * 100 : 0;
							let rateClass = 'text-text-secondary bg-tertiary';
							if (rate > 15) rateClass = 'text-accent-red bg-accent-red/10';
							else if (rate > 5) rateClass = 'text-accent-primary bg-accent-primary/10';
							else if (selectedDomain === 'Least Escalated' && rate === 0) rateClass = 'text-accent-green bg-accent-green/10';

							return (
							<tr key={index} className={`${index % 2 === 0 ? 'bg-primary' : 'bg-tertiary'} ${index < itemsList.length - 1 ? 'border-b border-tertiary' : ''}`}>
								<td className="align-middle" style={{ padding: '10px 20px' }}>
									<div className="w-8 h-8 rounded-[8px] bg-tertiary flex items-center justify-center font-semibold text-[12px] text-text-secondary">{index + 1}</div>
								</td>
								<td className="align-middle font-medium text-[12px] leading-[100%] text-text-primary" style={{ padding: '10px 20px' }}>{item.role_name}</td>
								<td className="align-middle font-medium text-[12px] leading-[100%] text-text-secondary" style={{ padding: '10px 20px' }}>{item.role_id}</td>
								<td className="align-middle font-semibold text-[12px] leading-[100%] text-text-primary" style={{ padding: '10px 20px' }}>{item.escalation_count}</td>
								<td className="align-middle font-medium text-[12px] leading-[100%] text-text-primary" style={{ padding: '10px 20px' }}>{item.total_messages_for_role}</td>
								<td className="align-middle" style={{ padding: '10px 20px' }}>
									<div className={`inline-flex items-center rounded-[7px] font-bold text-[12px] ${rateClass}`} style={{ padding: '4px 8px' }}>
										{rate.toFixed(1)}%
									</div>
								</td>
							</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</DashboardCard>
	);
};

const DiagnosisGrid = ({ data }: { data: any }) => {
	return (
		<div className="w-full">
			<RoleEscalationsTable data={data} />
		</div>
	);
};

export default DiagnosisGrid;
