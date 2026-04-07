'use client';

import { useState } from 'react';
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import Text from "@/components/text";
import { HiMiniInformationCircle } from "react-icons/hi2";
import { IoChevronDown } from "react-icons/io5";

const TopDiagnosisTable = () => {
	const [selectedDomain, setSelectedDomain] = useState('All Domains');
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);

	const domainOptions = ['All Domains', 'Cardiology', 'Pulmonology', 'Endocrine', 'Infectious'];
	const diagnosisData = [
		{ rank: 1, diagnosis: 'Congestive heart failure', domain: 'Cardiology', icd10: 'I50', volume: 120, percentage: 12.6 },
		{ rank: 2, diagnosis: 'COPD exacerbation', domain: 'Pulmonology', icd10: 'J44', volume: 110, percentage: 11.9 },
		{ rank: 3, diagnosis: 'Diabetic complications', domain: 'Endocrine', icd10: 'E11', volume: 104, percentage: 11.0 },
		{ rank: 4, diagnosis: 'Chest pain, unspecified', domain: 'Cardiology', icd10: 'R07', volume: 96, percentage: 10.8 },
		{ rank: 5, diagnosis: 'Sepsis, unspecified', domain: 'Infectious', icd10: 'A41', volume: 94, percentage: 9.4 },
	];

	return (
		<DashboardCard padding="none" className="w-full flex flex-col" style={{ padding: 18, height: 440 }}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
					<Text variant="body-md-semibold" color="text-primary">Top Diagnosis</Text>
					<Text variant="body-sm" color="text-secondary">All Departments · Last 6 Months</Text>
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
							<th className="text-left font-semibold text-[12px] leading-[100%] text-text-primary" style={{ padding: '12px 20px' }}>Diagnosis</th>
							<th className="text-left font-semibold text-[12px] leading-[100%] text-text-primary" style={{ padding: '12px 20px' }}>Domain</th>
							<th className="text-left font-semibold text-[12px] leading-[100%] text-text-primary" style={{ padding: '12px 20px' }}>ICD-10</th>
							<th className="text-left font-semibold text-[12px] leading-[100%] text-text-primary" style={{ padding: '12px 20px' }}>Volume</th>
							<th className="text-left font-semibold text-[12px] leading-[100%] text-text-primary" style={{ padding: '12px 20px' }}>% of Visits</th>
						</tr>
					</thead>
					<tbody>
						{diagnosisData.map((item, index) => (
							<tr key={index} className={`${index % 2 === 0 ? 'bg-primary' : 'bg-tertiary'} ${index < diagnosisData.length - 1 ? 'border-b border-tertiary' : ''}`}>
								<td className="align-middle" style={{ padding: '10px 20px' }}>
									<div className="w-8 h-8 rounded-[8px] bg-tertiary flex items-center justify-center font-semibold text-[12px] text-text-secondary">{item.rank}</div>
								</td>
								<td className="align-middle font-medium text-[12px] leading-[100%] text-text-primary" style={{ padding: '10px 20px' }}>{item.diagnosis}</td>
								<td className="align-middle" style={{ padding: '10px 20px' }}>
									<div className="inline-flex items-center rounded-[7px] bg-tertiary font-medium text-[12px] leading-[100%] text-text-primary" style={{ padding: '5px 10px' }}>{item.domain}</div>
								</td>
								<td className="align-middle font-medium text-[12px] leading-[100%] text-text-secondary" style={{ padding: '10px 20px' }}>{item.icd10}</td>
								<td className="align-middle font-medium text-[12px] leading-[100%] text-text-primary" style={{ padding: '10px 20px' }}>{item.volume}</td>
								<td className="align-middle font-semibold text-[12px] leading-[100%] text-text-primary" style={{ padding: '10px 20px' }}>{item.percentage}%</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</DashboardCard>
	);
};

const DiagnosisGrid = () => {
	return (
		<div className="w-full">
			<TopDiagnosisTable />
		</div>
	);
};

export default DiagnosisGrid;
