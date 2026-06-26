'use client';

import {
    KPICard,
    AverageWaitTime,
    AverageBoardingTime,
    NurseStaffingFillRate,
    EDVolumeByHour,
    EDCrowding,
    CurrentEDPatients,
    StaffOnDuty,
} from './components';

const kpiData = [
    {
        title: 'Clinician to Patient Ratio',
        value: '1 : 3.75',
        subtitle: '12 clinicians / 45 patients',
        icon: 'clinician' as const,
        infoText: 'Available clinicians per patient; lower ratio means more coverage.',
    },
    {
        title: 'Left Before Treatment Completion',
        value: '8.5%',
        subtitle: '38 of 450 patients',
        icon: 'leftBefore' as const,
        infoText: 'Patients who left prior to completing treatment.',
    },
    {
        title: 'ED Boarders Count',
        value: '18',
        subtitle: 'Patients waiting for inpatient beds',
        icon: 'boarders' as const,
        infoText: 'Patients in ED awaiting inpatient beds (boarders).',
    },
    {
        title: 'Avg Disposition Decision Time',
        value: '3.2h',
        subtitle: 'Arrival + Decision to discharge/admit',
        icon: 'disposition' as const,
        infoText: 'Average time from arrival to disposition decision.',
    },
];

export default function EmergencyCriticalCarePage() {
    return (
        <div className="flex w-full flex-col gap-[15px]">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {kpiData.map((kpi, index) => (
                    <div
                        key={kpi.title}
                        className="animate-slide-in-up"
                        style={{ animationDelay: `${index * 100}ms`, opacity: 0, animationFillMode: 'forwards' }}
                    >
                        <KPICard {...kpi} />
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:items-start">
                <div
                    className="animate-slide-in-up xl:col-span-2"
                    style={{ animationDelay: '200ms', opacity: 0, animationFillMode: 'forwards' }}
                >
                    <EDVolumeByHour />
                </div>
                <div className="flex flex-col gap-4">
                    <div className="animate-slide-in-up" style={{ animationDelay: '300ms', opacity: 0, animationFillMode: 'forwards' }}>
                        <NurseStaffingFillRate />
                    </div>
                    <div className="animate-slide-in-up" style={{ animationDelay: '400ms', opacity: 0, animationFillMode: 'forwards' }}>
                        <EDCrowding />
                    </div>
                </div>
            </div>

            <div className="animate-slide-in-up" style={{ animationDelay: '500ms', opacity: 0, animationFillMode: 'forwards' }}>
                <StaffOnDuty />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
                <div className="animate-slide-in-up" style={{ animationDelay: '600ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <AverageWaitTime />
                </div>
                <div className="animate-slide-in-up" style={{ animationDelay: '700ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <AverageBoardingTime />
                </div>
            </div>

            <div className="animate-slide-in-up" style={{ animationDelay: '800ms', opacity: 0, animationFillMode: 'forwards' }}>
                <CurrentEDPatients />
            </div>
        </div>
    );
}
