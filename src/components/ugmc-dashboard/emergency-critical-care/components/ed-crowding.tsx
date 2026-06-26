"use client";

import * as React from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import { FaBed } from "react-icons/fa6";
import clsx from "clsx";

const EDCrowding: React.FC = () => {
    const [animatedPatients, setAnimatedPatients] = React.useState(0);
    const [animatedOccupancy, setAnimatedOccupancy] = React.useState(0);
    const [isVisible, setIsVisible] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);
    
    const patients = 42;
    const occupied = 21;
    const total = 24;
    const occupancyRate = (occupied / total) * 100;

    React.useEffect(() => {
        setIsVisible(true);
    }, []);

    // Animate the patient count and occupancy rate
    React.useEffect(() => {
        if (!isVisible) return;
        
        const duration = 1200;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            setAnimatedPatients(Math.round(patients * eased));
            setAnimatedOccupancy(occupancyRate * eased);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setAnimatedPatients(patients);
                setAnimatedOccupancy(occupancyRate);
            }
        };
        requestAnimationFrame(animate);
    }, [isVisible]);

    return (
        <DashboardCard 
            className="flex flex-col gap-2"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex items-start justify-between">
                <div className="flex flex-col gap-0.5">
                    <Text variant="body-md-semibold" color="text-primary">
                        ED Crowding
                    </Text>
                    <Text variant="body-sm" color="text-tertiary">
                        patients currently in the ED
                    </Text>
                </div>
                <div className={clsx(
                    "w-10 h-10 rounded-[10px] bg-accent-primary/10 flex items-center justify-center",
                    "transition-transform duration-300",
                    isHovered && "scale-110"
                )}>
                    <FaBed className="text-text-primary" size={16} />
                </div>
            </div>

            <span className={clsx(
                "text-[26px] font-bold tracking-tight text-accent-red tabular-nums",
                "transition-transform duration-300",
                isHovered && "scale-[1.02] origin-left inline-block"
            )}>
                {animatedPatients} Patients
            </span>

            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <Text variant="body-sm" color="text-secondary">
                        {occupied} of {total} beds occupied
                    </Text>
                    <span className="bg-accent-red/10 text-accent-red px-2 py-0.5 rounded-[6px] text-sm font-semibold tabular-nums">
                        {animatedOccupancy.toFixed(1)}%
                    </span>
                </div>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full bg-accent-red transition-all duration-1000 ease-out"
                        style={{ width: `${animatedOccupancy}%` }}
                    />
                </div>
            </div>
        </DashboardCard>
    );
};

export default EDCrowding;
