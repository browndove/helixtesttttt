"use client";

import * as React from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import FullscreenOverlay from "@/components/fullscreen-overlay";

export type RegionalCoverageItem = {
    name: string;
    gap: number;
    installs: number;
    downloads: number;
};

export type RegionalPlatformItem = {
    name: string;
    ios: number;
    android: number;
};

const defaultCoverageData: RegionalCoverageItem[] = [
    { name: "Emergency", gap: 3, installs: 12, downloads: 15 },
    { name: "Surgery", gap: 2, installs: 16, downloads: 18 },
    { name: "Diagnostics", gap: 4, installs: 10, downloads: 14 },
    { name: "Outpatient", gap: 1, installs: 9, downloads: 10 },
    { name: "Medicine", gap: 3, installs: 8, downloads: 11 },
    { name: "Pharmacy", gap: 1, installs: 7, downloads: 8 },
];

function axisTicks(maxValue: number): number[] {
    if (maxValue <= 0) return [0];
    const step = maxValue <= 20 ? 4 : Math.ceil(maxValue / 5 / 10) * 10;
    const ticks: number[] = [0];
    for (let v = step; v < maxValue; v += step) ticks.push(v);
    ticks.push(Math.ceil(maxValue));
    return ticks;
}

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

const OutstandingReimbursement: React.FC<{
    title?: string;
    subtitle?: string;
    badgeLabel?: string;
    items?: RegionalCoverageItem[];
    platformItems?: RegionalPlatformItem[];
    gapLegendLabel?: string;
    installsLegendLabel?: string;
}> = ({
    title = "Dept. Coverage & Escalations",
    subtitle = "Filled vs Unfilled Roles by Department",
    badgeLabel = "Unfilled",
    items,
    platformItems,
    gapLegendLabel = "Unfilled",
    installsLegendLabel = "Filled",
}) => {
    const isPlatformMode = platformItems !== undefined;

    const coverageData = React.useMemo(
        () => (items && items.length > 0 ? items : defaultCoverageData),
        [items],
    );

    const platformData = React.useMemo(
        () => (platformItems ?? []).filter((item) => item.ios > 0 || item.android > 0).slice(0, 6),
        [platformItems],
    );

    const [isMaximized, setIsMaximized] = React.useState(false);
    const [animatedBars, setAnimatedBars] = React.useState<{ primary: number; secondary: number }[]>([]);
    const [animatedTotal, setAnimatedTotal] = React.useState(0);
    const [isVisible, setIsVisible] = React.useState(false);

    const chartRows = isPlatformMode ? platformData : coverageData;
    const maxValue = isPlatformMode
        ? Math.max(...platformData.map((item) => item.ios + item.android), 1)
        : Math.max(...coverageData.map((i) => Math.max(i.downloads, i.gap + i.installs)), 1);
    const totalBadge = isPlatformMode
        ? platformData.reduce((sum, item) => sum + item.android, 0)
        : coverageData.reduce((sum, i) => sum + i.gap, 0);
    const scaleTicks = React.useMemo(() => axisTicks(maxValue), [maxValue]);

    React.useEffect(() => { setIsVisible(true); }, []);

    React.useEffect(() => {
        setAnimatedBars(chartRows.map(() => ({ primary: 0, secondary: 0 })));
        setAnimatedTotal(0);
    }, [chartRows]);

    React.useEffect(() => {
        if (!isVisible || chartRows.length === 0) return;
        const duration = 2500;
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setAnimatedBars(chartRows.map((item) => {
                if (isPlatformMode) {
                    const row = item as RegionalPlatformItem;
                    return {
                        primary: (row.ios / maxValue) * 100 * eased,
                        secondary: (row.android / maxValue) * 100 * eased,
                    };
                }
                const row = item as RegionalCoverageItem;
                return {
                    primary: (row.gap / maxValue) * 100 * eased,
                    secondary: (row.installs / maxValue) * 100 * eased,
                };
            }));
            setAnimatedTotal(Math.round(totalBadge * eased));
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setAnimatedBars(chartRows.map((item) => {
                    if (isPlatformMode) {
                        const row = item as RegionalPlatformItem;
                        return {
                            primary: (row.ios / maxValue) * 100,
                            secondary: (row.android / maxValue) * 100,
                        };
                    }
                    const row = item as RegionalCoverageItem;
                    return {
                        primary: (row.gap / maxValue) * 100,
                        secondary: (row.installs / maxValue) * 100,
                    };
                }));
                setAnimatedTotal(totalBadge);
            }
        };
        requestAnimationFrame(animate);
    }, [isVisible, maxValue, totalBadge, chartRows, isPlatformMode]);

    const primaryLegend = isPlatformMode ? "iOS" : gapLegendLabel;
    const secondaryLegend = isPlatformMode ? "Android" : installsLegendLabel;
    const primaryColor = isPlatformMode ? "bg-accent-primary" : "bg-accent-red";
    const secondaryColor = isPlatformMode ? "bg-accent-green" : "bg-accent-green";

    const chartContent = (isModal: boolean = false) => (
        <>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <Text variant={isModal ? "body-lg-semibold" : "body-md-semibold"} color="text-primary" className="font-bold">{title}</Text>
                    <Text variant="body-sm" color="text-secondary">{subtitle}</Text>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <div className="rounded-[5px] bg-accent-primary/10 whitespace-nowrap px-[7px] py-1">
                        <Text variant="body-md-semibold" color="accent-primary">
                            <span className="tabular-nums">{animatedTotal}</span> {badgeLabel}
                        </Text>
                    </div>
                    {!isModal && (
                        <button onClick={() => setIsMaximized(true)} className="flex size-[30px] cursor-pointer items-center justify-center rounded-[10px] bg-secondary transition-colors hover:bg-tertiary" title="Maximize"><MaximizeIcon /></button>
                    )}
                    {isModal && (
                        <button onClick={() => setIsMaximized(false)} className="flex size-[30px] cursor-pointer items-center justify-center rounded-[10px] bg-secondary transition-colors hover:bg-tertiary" title="Close"><CloseIcon /></button>
                    )}
                </div>
            </div>

            {chartRows.length === 0 ? (
                <div className="flex min-h-[120px] items-center justify-center rounded-[10px] bg-secondary/40 px-4 py-6 text-center">
                    <Text variant="body-sm" color="text-secondary">No regional data available.</Text>
                </div>
            ) : (
                <>
                    <div className="flex flex-col gap-[15px]">
                        {chartRows.map((row, index) => (
                            <div key={row.name} className="flex items-center gap-[10px]">
                                <Text variant="body-sm" color="text-secondary" className="w-[120px] shrink-0 truncate" title={row.name}>{row.name}</Text>
                                <div className="flex h-[30px] flex-1 overflow-hidden rounded-[5px] bg-secondary/40">
                                    <div className={`h-full shrink-0 rounded-l-[5px] transition-all duration-100 ${primaryColor}`} style={{ width: `${animatedBars[index]?.primary || 0}%` }} />
                                    <div className={`h-full shrink-0 rounded-r-[5px] transition-all duration-100 ${secondaryColor}`} style={{ width: `${animatedBars[index]?.secondary || 0}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="ml-[130px] flex justify-between">
                        {scaleTicks.map((val) => (
                            <Text key={val} variant="body-xs" color="text-tertiary">{val >= 1000 ? `${(val / 1000).toFixed(1)}K` : val}</Text>
                        ))}
                    </div>
                    <div className="flex items-center justify-center gap-5 pt-2">
                        <div className="flex items-center gap-[5px]">
                            <div className={`h-[10px] w-[10px] rounded-[2px] ${primaryColor}`} />
                            <Text variant="body-sm" color="text-primary">{primaryLegend}</Text>
                        </div>
                        <div className="flex items-center gap-[5px]">
                            <div className={`h-[10px] w-[10px] rounded-[2px] ${secondaryColor}`} />
                            <Text variant="body-sm" color="text-primary">{secondaryLegend}</Text>
                        </div>
                    </div>
                </>
            )}
        </>
    );

    return (
        <>
            <DashboardCard className="flex flex-1 flex-col" padding="none" style={{ padding: 20, gap: 15 }}>{chartContent(false)}</DashboardCard>
            {isMaximized && (
                <FullscreenOverlay onClose={() => setIsMaximized(false)}>
                    <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-auto rounded-[20px] bg-primary shadow-2xl" style={{ padding: 24, gap: 15 }}>
                        {chartContent(true)}
                    </div>
                </FullscreenOverlay>
            )}
        </>
    );
};

export default OutstandingReimbursement;
