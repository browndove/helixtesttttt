"use client";

import * as React from "react";
import { KPIGrid, MortalityRiskAgeGrid, InfectionsGrid, ReadmissionGrid } from "./components";

const ClinicalOperationsPage = () => {
	return (
		<div className="w-full flex flex-col gap-[15px]">
			<div className="animate-slide-in-up" style={{ animationDelay: '100ms', opacity: 0, animationFillMode: 'forwards' }}>
				<KPIGrid />
			</div>
			<div className="animate-slide-in-up" style={{ animationDelay: '200ms', opacity: 0, animationFillMode: 'forwards' }}>
				<MortalityRiskAgeGrid />
			</div>
			<div className="animate-slide-in-up" style={{ animationDelay: '300ms', opacity: 0, animationFillMode: 'forwards' }}>
				<InfectionsGrid />
			</div>
			<div className="animate-slide-in-up" style={{ animationDelay: '400ms', opacity: 0, animationFillMode: 'forwards' }}>
				<ReadmissionGrid />
			</div>
		</div>
	);
};

export default ClinicalOperationsPage;
