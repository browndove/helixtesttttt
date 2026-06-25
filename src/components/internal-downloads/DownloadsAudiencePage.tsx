"use client";

import React from "react";
import { KPIGrid, PatientCensusGrid, AppointmentGrid, DiagnosisGrid } from "@/components/ugmc-dashboard/patient-insight/components";
import type { DownloadAnalyticsData } from "@/lib/download-analytics-mock";
import { mapDownloadAnalyticsToUgmc } from "@/lib/download-analytics-mock";

const DownloadsAudiencePage = ({ data, onViewMoreRoles }: { data: DownloadAnalyticsData; onViewMoreRoles?: () => void }) => {
    const ugmc = mapDownloadAnalyticsToUgmc(data) as unknown as Record<string, unknown>;

    return (
        <div className="flex w-full flex-col" style={{ gap: 15 }}>
            <div className="animate-slide-in-up" style={{ animationDelay: '100ms', opacity: 0, animationFillMode: 'forwards' }}>
                <KPIGrid data={ugmc} />
            </div>
            <div className="animate-slide-in-up" style={{ animationDelay: '200ms', opacity: 0, animationFillMode: 'forwards' }}>
                <PatientCensusGrid data={ugmc} />
            </div>
            <div className="animate-slide-in-up" style={{ animationDelay: '300ms', opacity: 0, animationFillMode: 'forwards' }}>
                <AppointmentGrid data={ugmc} onViewMoreRoles={onViewMoreRoles} />
            </div>
            <div className="animate-slide-in-up" style={{ animationDelay: '400ms', opacity: 0, animationFillMode: 'forwards' }}>
                <DiagnosisGrid data={ugmc} />
            </div>
        </div>
    );
};

export default DownloadsAudiencePage;
