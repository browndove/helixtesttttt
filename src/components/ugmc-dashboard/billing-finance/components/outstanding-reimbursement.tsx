"use client";

import * as React from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";

type InsurerData = {
    name: string;
    outstanding: number;
    paid: number;
    total: number;
};

const insurerData: InsurerData[] = [
    { name: "Premier Health", outstanding: 125000, paid: 85000, total: 210000 },
    { name: "Nationwide Mutual", outstanding: 98000, paid: 142000, total: 240000 },
    { name: "Cosmopolitan Health", outstanding: 76000, paid: 124000, total: 200000 },
    { name: "Equity Health", outstanding: 54000, paid: 96000, total: 150000 },
    { name: "Acacia Health", outstanding: 42000, paid: 88000, total: 130000 },
    { name: "Providence Health", outstanding: 31000, paid: 69000, total: 100000 },
];

const MaximizeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M12.9502 3.23759C12.9502 3.06586 12.8819 2.90116 12.7605 2.77973C12.6391 2.65829 12.4744 2.59007 12.3026 2.59007H9.06504C8.89331 2.59007 8.72861 2.65829 8.60718 2.77973C8.48574 2.90116 8.41752 3.06586 8.41752 3.23759C8.41752 3.40933 8.48574 3.57402 8.60718 3.69546C8.72861 3.81689 8.89331 3.88511 9.06504 3.88511H10.7292L8.6053 6.01545C8.54461 6.07565 8.49644 6.14726 8.46357 6.22617C8.43069 6.30508 8.41377 6.38971 8.41377 6.47519C8.41377 6.56067 8.43069 6.64531 8.46357 6.72421C8.49644 6.80312 8.54461 6.87474 8.6053 6.93493C8.6655 6.99562 8.73711 7.04379 8.81602 7.07667C8.89493 7.10954 8.97956 7.12647 9.06504 7.12647C9.15052 7.12647 9.23516 7.10954 9.31406 7.07667C9.39297 7.04379 9.46459 6.99562 9.52478 6.93493L11.6551 4.80459V6.47519C11.6551 6.64692 11.7233 6.81162 11.8448 6.93306C11.9662 7.05449 12.1309 7.12271 12.3026 7.12271C12.4744 7.12271 12.6391 7.05449 12.7605 6.93306C12.8819 6.81162 12.9502 6.64692 12.9502 6.47519V3.23759ZM6.9347 8.60553C6.87451 8.54484 6.80289 8.49667 6.72398 8.4638C6.64508 8.43092 6.56044 8.414 6.47496 8.414C6.38948 8.414 6.30485 8.43092 6.22594 8.4638C6.14704 8.49667 6.07542 8.54484 6.01522 8.60553L3.88488 10.7294V9.06527C3.88488 8.89354 3.81666 8.72884 3.69523 8.60741C3.5738 8.48597 3.4091 8.41775 3.23736 8.41775C3.06563 8.41775 2.90093 8.48597 2.7795 8.60741C2.65806 8.72884 2.58984 8.89354 2.58984 9.06527V12.3029C2.58984 12.4746 2.65806 12.6393 2.7795 12.7607C2.90093 12.8822 3.06563 12.9504 3.23736 12.9504H6.47496C6.6467 12.9504 6.81139 12.8822 6.93283 12.7607C7.05426 12.6393 7.12248 12.4746 7.12248 12.3029C7.12248 12.1311 7.05426 11.9664 6.93283 11.845C6.81139 11.7236 6.6467 11.6553 6.47496 11.6553H4.80436L6.9347 9.52501C6.99539 9.46481 7.04356 9.3932 7.07644 9.31429C7.10931 9.23539 7.12624 9.15075 7.12624 9.06527C7.12624 8.97979 7.10931 8.89516 7.07644 8.81625C7.04356 8.73734 6.99539 8.66573 6.9347 8.60553Z" fill="currentColor" />
    </svg>
);

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const OutstandingReimbursement: React.FC = () => {
    const [isMaximized, setIsMaximized] = React.useState(false);
    const [animatedBars, setAnimatedBars] = React.useState(insurerData.map(() => ({ outstanding: 0, paid: 0 })));
    const [animatedTotal, setAnimatedTotal] = React.useState(0);
    const [isVisible, setIsVisible] = React.useState(false);

    const maxValue = Math.max(...insurerData.map(i => i.total));
    const totalOutstanding = insurerData.reduce((sum, i) => sum + i.outstanding, 0);

    React.useEffect(() => { setIsVisible(true); }, []);

    React.useEffect(() => {
        if (!isVisible) return;
        const duration = 2500;
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setAnimatedBars(insurerData.map(item => ({ outstanding: (item.outstanding / maxValue) * 100 * eased, paid: (item.paid / maxValue) * 100 * eased })));
            setAnimatedTotal(Math.round((totalOutstanding / 1000) * eased));
            if (progress < 1) requestAnimationFrame(animate);
            else { setAnimatedBars(insurerData.map(item => ({ outstanding: (item.outstanding / maxValue) * 100, paid: (item.paid / maxValue) * 100 }))); setAnimatedTotal(Math.round(totalOutstanding / 1000)); }
        };
        requestAnimationFrame(animate);
    }, [isVisible, maxValue, totalOutstanding]);

    const chartContent = (isModal: boolean = false) => (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Text variant={isModal ? "body-lg-semibold" : "body-md-semibold"} color="text-primary" className="font-bold">Outstanding Reimbursement</Text>
                    <Text variant="body-sm" color="text-secondary">All Departments · Last 6 Months</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="bg-accent-primary/10 rounded-[5px] whitespace-nowrap" style={{ padding: '4px 7px' }}>
                        <Text variant="body-md-semibold" color="accent-primary"><span className="tabular-nums">{animatedTotal}K</span> Total Outstanding</Text>
                    </div>
                    {!isModal && (
                        <button onClick={() => setIsMaximized(true)} className="flex items-center justify-center size-[30px] bg-secondary rounded-[10px] cursor-pointer hover:bg-tertiary transition-colors" title="Maximize"><MaximizeIcon /></button>
                    )}
                    {isModal && (
                        <button onClick={() => setIsMaximized(false)} className="flex items-center justify-center size-[30px] bg-secondary rounded-[10px] cursor-pointer hover:bg-tertiary transition-colors" title="Close"><CloseIcon /></button>
                    )}
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                {insurerData.map((insurer, index) => (
                    <div key={insurer.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Text variant="body-sm" color="text-secondary" className="w-[120px] shrink-0">{insurer.name}</Text>
                        <div className="flex-1 h-[30px] rounded-[5px] overflow-hidden flex">
                            <div className="h-full bg-accent-red shrink-0 rounded-l-[5px] transition-all duration-100" style={{ width: `${animatedBars[index]?.outstanding || 0}%` }} />
                            <div className="h-full bg-accent-green shrink-0 rounded-r-[5px] transition-all duration-100" style={{ width: `${animatedBars[index]?.paid || 0}%` }} />
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex justify-between ml-[130px]">
                {[0, 50, 100, 150, 200, 250].map((val) => (
                    <Text key={val} variant="body-xs" color="text-tertiary">{val}K</Text>
                ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, paddingTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div className="w-[10px] h-[10px] rounded-[2px] bg-accent-red" />
                    <Text variant="body-sm" color="text-primary">Outstanding</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div className="w-[10px] h-[10px] rounded-[2px] bg-accent-green" />
                    <Text variant="body-sm" color="text-primary">Paid</Text>
                </div>
            </div>
        </>
    );

    return (
        <>
            <DashboardCard className="flex flex-col flex-1" padding="none" style={{ padding: 20, gap: 15 }}>{chartContent(false)}</DashboardCard>
            {isMaximized && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" style={{ padding: 24 }} onClick={() => setIsMaximized(false)}>
                    <div className="bg-primary rounded-[20px] w-full max-w-5xl max-h-[90vh] overflow-auto flex flex-col shadow-2xl" style={{ padding: 24, gap: 15 }} onClick={(e) => e.stopPropagation()}>{chartContent(true)}</div>
                </div>
            )}
        </>
    );
};

export default OutstandingReimbursement;
