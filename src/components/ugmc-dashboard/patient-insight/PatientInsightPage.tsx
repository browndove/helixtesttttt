"use client";

import React from "react";
import { KPIGrid, PatientCensusGrid, AppointmentGrid, DiagnosisGrid } from "./components";

const PatientInsightPage = ({ data, onViewMoreRoles }: { data: any; onViewMoreRoles?: () => void }) => {
	return (
		<div className="w-full flex flex-col" style={{ gap: 15 }}>
			<div className="animate-slide-in-up" style={{ animationDelay: '100ms', opacity: 0, animationFillMode: 'forwards' }}>
				<KPIGrid data={data} />
			</div>
			<div className="animate-slide-in-up" style={{ animationDelay: '200ms', opacity: 0, animationFillMode: 'forwards' }}>
				<PatientCensusGrid data={data} />
			</div>
			<div className="animate-slide-in-up" style={{ animationDelay: '300ms', opacity: 0, animationFillMode: 'forwards' }}>
				<AppointmentGrid data={data} onViewMoreRoles={onViewMoreRoles} />
			</div>
			<div className="animate-slide-in-up" style={{ animationDelay: '400ms', opacity: 0, animationFillMode: 'forwards' }}>
				<DiagnosisGrid data={data} />
			</div>
		</div>
	);
};

export default PatientInsightPage;
