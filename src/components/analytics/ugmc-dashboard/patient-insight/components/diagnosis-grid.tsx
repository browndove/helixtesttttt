'use client';

import { useMemo, useState } from 'react';
import DashboardCard from "@/components/analytics/ugmc-dashboard/shared/dashboard-card";
import Text from "@/components/analytics/text";
import { HiMiniInformationCircle } from "react-icons/hi2";
import { IoChevronDown } from "react-icons/io5";
import { CardTitle } from "@/components/analytics/glass/illustrations";

type EscalationRoleRow = {
    role_name?: string;
    role_id?: string;
    department_name?: string;
    escalation_count?: number;
    total_messages_for_role?: number;
    escalation_rate_percent?: number;
};

type RoleMetricRow = {
    role_id?: string;
    department_name?: string;
    total_messages?: number;
    escalation_rate_percent?: number;
};

function num(v: unknown): number {
    if (v === null || v === undefined || v === "") return 0;
    const n = typeof v === "string" ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
}

function fmtEscalationRate(rate: unknown): string {
    if (rate === null || rate === undefined || rate === "") return "—";
    const n = num(rate);
    if (!Number.isFinite(n)) return "—";
    return `${n.toFixed(1)}%`;
}

const RoleEscalationsTable = ({ data }: { data?: { top_escalated_roles?: EscalationRoleRow[]; least_escalated_roles?: EscalationRoleRow[]; role_metrics?: RoleMetricRow[] } }) => {
	const [selectedDomain, setSelectedDomain] = useState('Top Escalated');
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);

	const domainOptions = ['Top Escalated', 'Least Escalated'];

	const roleMetricsById = useMemo(() => {
		const map = new Map<string, RoleMetricRow>();
		for (const row of data?.role_metrics ?? []) {
			const id = String(row?.role_id ?? "").trim();
			if (id) map.set(id, row);
		}
		return map;
	}, [data?.role_metrics]);

	const itemsList = useMemo(() => {
		const top = Array.isArray(data?.top_escalated_roles) ? [...data.top_escalated_roles] : [];
		const least = Array.isArray(data?.least_escalated_roles) ? [...data.least_escalated_roles] : [];

		const sortByEscalationsDesc = (a: EscalationRoleRow, b: EscalationRoleRow) => {
			const diff = num(b?.escalation_count) - num(a?.escalation_count);
			if (diff !== 0) return diff;
			return String(a?.role_name ?? "").localeCompare(String(b?.role_name ?? ""));
		};
		const sortByEscalationsAsc = (a: EscalationRoleRow, b: EscalationRoleRow) => {
			const diff = num(a?.escalation_count) - num(b?.escalation_count);
			if (diff !== 0) return diff;
			return String(a?.role_name ?? "").localeCompare(String(b?.role_name ?? ""));
		};

		const top10 = top.sort(sortByEscalationsDesc).slice(0, 10);
		const least10 = least.sort(sortByEscalationsAsc).slice(0, 10);

		return selectedDomain === 'Top Escalated' ? top10 : least10;
	}, [data, selectedDomain]);

	return (
		<DashboardCard data-watermark="badge" padding="none" className="w-full flex flex-col" style={{ padding: 18, height: 440 }}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
					<CardTitle icon="notification_important" variant="body-md-semibold">Role Escalations</CardTitle>
					<Text variant="body-sm" color="text-secondary">Tracking policy non-responders</Text>
				</div>
				<div className="relative">
					<button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="rounded-[8px] bg-tertiary flex items-center border-none cursor-pointer" style={{ padding: '8px 12px', gap: 8 }}>
						<HiMiniInformationCircle size={16} className="text-text-tertiary" />
						<span className="font-medium text-[12px] leading-[100%] text-text-secondary">{selectedDomain}</span>
						<IoChevronDown size={14} className="text-text-secondary" />
					</button>
					{isDropdownOpen && (
						<div className="absolute top-full right-0 bg-secondary border border-tertiary rounded-[8px] z-10 min-w-[150px]" style={{ marginTop: 4 }}>
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
							<th className="text-left font-semibold text-[12px] leading-[100%] text-text-primary" style={{ padding: '12px 20px' }}>Department</th>
							<th className="text-left font-semibold text-[12px] leading-[100%] text-text-primary" style={{ padding: '12px 20px' }}>Escalations</th>
							<th className="text-left font-semibold text-[12px] leading-[100%] text-text-primary" style={{ padding: '12px 20px' }}>Total Msgs</th>
							<th className="text-left font-semibold text-[12px] leading-[100%] text-text-primary" style={{ padding: '12px 20px' }}>Escalation Rate</th>
						</tr>
					</thead>
					<tbody>
						{itemsList.map((item, index) => {
							const roleId = String(item.role_id ?? "").trim();
							const metrics = roleId ? roleMetricsById.get(roleId) : undefined;
							const department = String(item.department_name ?? metrics?.department_name ?? "").trim();
							const escalations = num(item.escalation_count);
							const messages =
								item.total_messages_for_role != null
									? num(item.total_messages_for_role)
								 : metrics?.total_messages != null
									? num(metrics.total_messages)
									: null;
							const backendRate =
								item.escalation_rate_percent != null
									? item.escalation_rate_percent
									: metrics?.escalation_rate_percent;
							const rate = num(backendRate);
							const hasRate = backendRate != null;
							let rateClass = 'text-text-secondary bg-tertiary';
							if (hasRate) {
								if (rate > 15) rateClass = 'text-accent-red bg-accent-red/10';
								else if (rate > 5) rateClass = 'text-accent-primary bg-accent-primary/10';
								else if (selectedDomain === 'Least Escalated' && rate === 0) rateClass = 'text-accent-green bg-accent-green/10';
							}

							return (
							<tr key={roleId || `${item.role_name}-${index}`} className={`${index % 2 === 0 ? 'bg-primary' : 'bg-tertiary'} ${index < itemsList.length - 1 ? 'border-b border-tertiary' : ''}`}>
								<td className="align-middle" style={{ padding: '10px 20px' }}>
									<div className="w-8 h-8 rounded-[8px] bg-tertiary flex items-center justify-center font-semibold text-[12px] text-text-secondary">{index + 1}</div>
								</td>
								<td className="align-middle font-medium text-[12px] leading-[100%] text-text-primary" style={{ padding: '10px 20px' }}>{item.role_name}</td>
								<td className="align-middle font-medium text-[12px] leading-[100%] text-text-secondary" style={{ padding: '10px 20px' }}>{department || "—"}</td>
								<td className="align-middle font-semibold text-[12px] leading-[100%] text-text-primary" style={{ padding: '10px 20px' }}>{escalations}</td>
								<td className="align-middle font-medium text-[12px] leading-[100%] text-text-primary" style={{ padding: '10px 20px' }}>
									{messages !== null ? messages : "—"}
								</td>
								<td className="align-middle" style={{ padding: '10px 20px' }}>
									<div className={`inline-flex items-center rounded-[7px] font-bold text-[12px] ${rateClass}`} style={{ padding: '4px 8px' }}>
										{fmtEscalationRate(backendRate)}
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

const DiagnosisGrid = ({ data }: { data?: { top_escalated_roles?: EscalationRoleRow[]; least_escalated_roles?: EscalationRoleRow[]; role_metrics?: RoleMetricRow[] } }) => {
	return (
		<div className="w-full">
			<RoleEscalationsTable data={data} />
		</div>
	);
};

export default DiagnosisGrid;
