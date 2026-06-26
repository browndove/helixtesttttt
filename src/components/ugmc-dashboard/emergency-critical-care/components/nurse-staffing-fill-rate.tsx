"use client";

import * as React from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import clsx from "clsx";

const NurseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="21" height="20" viewBox="0 0 21 20" fill="none">
        <path fillRule="evenodd" clipRule="evenodd" d="M13.8153 1.95288H7.12529C6.63778 1.93578 6.15764 2.07005 5.75723 2.33544C5.35681 2.60084 5.05781 2.98299 4.90529 3.42431L3.80579 6.01716C8.23227 5.33373 12.7453 5.33228 17.1723 6.01288L16.0338 3.41859C15.8802 2.97834 15.5808 2.59745 15.1804 2.33314C14.7801 2.06884 14.3005 1.9354 13.8138 1.95288H13.8153ZM20.2398 8.43859C20.3379 8.46281 20.4297 8.50598 20.5095 8.5654C20.5894 8.62483 20.6555 8.69925 20.7039 8.78404C20.7523 8.86884 20.7819 8.9622 20.7908 9.05833C20.7997 9.15446 20.7878 9.25131 20.7558 9.34288L18.1068 17.0643C18.0085 17.3505 17.8177 17.5997 17.5618 17.7765C17.3059 17.9532 16.9979 18.0485 16.6818 18.0486H4.31879C4.00247 18.0484 3.69433 17.9529 3.43839 17.7759C3.18246 17.5988 2.99184 17.3493 2.89379 17.0629L0.244787 9.34288C0.212316 9.25142 0.200057 9.15456 0.208783 9.05838C0.217508 8.9622 0.247029 8.86878 0.295489 8.78399C0.34395 8.6992 0.410302 8.62487 0.490377 8.56567C0.570452 8.50648 0.662517 8.4637 0.760787 8.44002C7.15407 6.90738 13.8465 6.90596 20.2398 8.43859ZM8.25029 11.7757C8.00165 11.7757 7.76319 11.8698 7.58737 12.0372C7.41156 12.2047 7.31279 12.4318 7.31279 12.6686C7.31279 12.9054 7.41156 13.1325 7.58737 13.2999C7.76319 13.4674 8.00165 13.5614 8.25029 13.5614H9.56279V14.8114C9.56279 15.0482 9.66156 15.2754 9.83737 15.4428C10.0132 15.6102 10.2516 15.7043 10.5003 15.7043C10.7489 15.7043 10.9874 15.6102 11.1632 15.4428C11.339 15.2754 11.4378 15.0482 11.4378 14.8114V13.5614H12.7503C12.9989 13.5614 13.2374 13.4674 13.4132 13.2999C13.589 13.1325 13.6878 12.9054 13.6878 12.6686C13.6878 12.4318 13.589 12.2047 13.4132 12.0372C13.2374 11.8698 12.9989 11.7757 12.7503 11.7757H11.4378V10.5257C11.4378 10.2889 11.339 10.0618 11.1632 9.89439C10.9874 9.72695 10.7489 9.63288 10.5003 9.63288C10.2516 9.63288 10.0132 9.72695 9.83737 9.89439C9.66156 10.0618 9.56279 10.2889 9.56279 10.5257V11.7757H8.25029Z" fill="var(--text-primary)" />
    </svg>
);

const NurseStaffingFillRate: React.FC = () => {
    const [animatedFillRate, setAnimatedFillRate] = React.useState(0);
    const [animatedProgress, setAnimatedProgress] = React.useState(0);
    const [isVisible, setIsVisible] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);
    
    const onShift = 18;
    const planned = 22;
    const fillRate = (onShift / planned) * 100;
    const plannedPercentage = 100;

    React.useEffect(() => {
        setIsVisible(true);
    }, []);

    // Animate the fill rate and progress bar
    React.useEffect(() => {
        if (!isVisible) return;
        
        const duration = 1200;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            setAnimatedFillRate(fillRate * eased);
            setAnimatedProgress(plannedPercentage * eased);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setAnimatedFillRate(fillRate);
                setAnimatedProgress(plannedPercentage);
            }
        };
        requestAnimationFrame(animate);
    }, [isVisible, fillRate]);

    return (
        <DashboardCard 
            className="flex flex-col gap-2"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex items-start justify-between">
                <div className="flex flex-col gap-0.5">
                    <Text variant="body-md-semibold" color="text-primary">
                        Nurse Staffing Fill Rate
                    </Text>
                    <Text variant="body-sm" color="text-tertiary">
                        On shift vs planned
                    </Text>
                </div>
                <div className={clsx(
                    "w-10 h-10 rounded-[10px] bg-accent-primary/10 flex items-center justify-center",
                    "transition-transform duration-300",
                    isHovered && "scale-110"
                )}>
                    <NurseIcon />
                </div>
            </div>

            <span className={clsx(
                "text-[24px] font-bold tracking-tight text-accent-primary tabular-nums",
                "transition-transform duration-300",
                isHovered && "scale-[1.02] origin-left inline-block"
            )}>
                {animatedFillRate.toFixed(1)}%
            </span>

            <div className="flex flex-col gap-3">
                {/* On Shift - no progress bar */}
                <div className="flex items-center justify-between">
                    <Text variant="body-sm" color="text-secondary">
                        On shift
                    </Text>
                    <span className="bg-accent-primary/10 text-accent-primary px-2 py-0.5 rounded-[6px] text-sm font-semibold">
                        {onShift} nurses
                    </span>
                </div>

                {/* Separator line */}
                <div className="w-full h-px bg-quaternary" />

                {/* Planned - with progress bar */}
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                        <Text variant="body-sm" color="text-secondary">
                            Planned
                        </Text>
                        <span className="bg-accent-primary/10 text-accent-primary px-2 py-0.5 rounded-[6px] text-sm font-semibold">
                            {planned} nurses
                        </span>
                    </div>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full bg-accent-primary transition-all duration-1000 ease-out"
                            style={{ width: `${animatedProgress}%` }}
                        />
                    </div>
                </div>
            </div>
        </DashboardCard>
    );
};

export default NurseStaffingFillRate;
