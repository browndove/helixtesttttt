"use client";

import * as React from "react";
import { useMemo } from "react";
import { CallKpis } from "@/components/analytics/glass/AnalyticsKpis";
import { normalizeCallMetricsFromUsage } from "@/lib/analytics/call-metrics";
import {
	LabTestsVolume,
	ImagingRadiology,
	InboundCallsByDepartment,
	InboundCallsByRole,
	OperatingRoomsUtilization,
	PatientToBedRatio,
	ICUVacantBeds,
	PharmacyPrescription,
	NurseToPatientRatio,
} from "./components";

const ClinicalOperationsPage = ({ data }: { data?: any }) => {
	const cm = useMemo(() => normalizeCallMetricsFromUsage(data), [data]);

	return (
		<div className="w-full flex flex-col gap-[15px]">
			<CallKpis data={data} />

			{/* Outbound & inbound outcome charts */}
			<div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
				<div className="animate-slide-in-up h-full" style={{ animationDelay: '200ms', opacity: 0, animationFillMode: 'forwards' }}>
					<LabTestsVolume callMetrics={cm} />
				</div>
				<div className="animate-slide-in-up h-full" style={{ animationDelay: '300ms', opacity: 0, animationFillMode: 'forwards' }}>
					<ImagingRadiology callMetrics={cm} />
				</div>
				<div className="animate-slide-in-up h-full" style={{ animationDelay: '350ms', opacity: 0, animationFillMode: 'forwards' }}>
					<InboundCallsByDepartment callMetrics={cm} />
				</div>
				<div className="animate-slide-in-up h-full" style={{ animationDelay: '400ms', opacity: 0, animationFillMode: 'forwards' }}>
					<InboundCallsByRole callMetrics={cm} />
				</div>
			</div>

			{/* Summary cards */}
			<div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
				<div className="animate-slide-in-up h-full" style={{ animationDelay: '450ms', opacity: 0, animationFillMode: 'forwards' }}>
					<OperatingRoomsUtilization callMetrics={cm} />
				</div>
				<div className="animate-slide-in-up h-full" style={{ animationDelay: '500ms', opacity: 0, animationFillMode: 'forwards' }}>
					<PatientToBedRatio callMetrics={cm} />
				</div>
			</div>

			{/* Volume distribution */}
			<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
				<div className="animate-slide-in-up" style={{ animationDelay: '600ms', opacity: 0, animationFillMode: 'forwards' }}>
					<ICUVacantBeds callMetrics={cm} />
				</div>
				<div className="animate-slide-in-up" style={{ animationDelay: '700ms', opacity: 0, animationFillMode: 'forwards' }}>
					<PharmacyPrescription callMetrics={cm} />
				</div>
				<div className="animate-slide-in-up" style={{ animationDelay: '800ms', opacity: 0, animationFillMode: 'forwards' }}>
					<NurseToPatientRatio callMetrics={cm} />
				</div>
			</div>

		</div>
	);
};

export default ClinicalOperationsPage;
