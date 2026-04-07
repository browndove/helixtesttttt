"use client";

import * as React from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";

type RejectionReason = {
    name: string;
    percentage: number;
    color: string;
    bgColor: string;
    textColor: string;
};

const rejectionReasons: RejectionReason[] = [
    { name: "Incomplete Documentation", percentage: 32, color: "var(--accent-red)", bgColor: "rgba(248, 81, 73, 0.1)", textColor: "var(--accent-red)" },
    { name: "Prior Authorization Missing", percentage: 28, color: "#FF9257", bgColor: "#FF92571A", textColor: "#FF9257" },
    { name: "Coding Errors", percentage: 20, color: "#FFCA57", bgColor: "#FFCA5733", textColor: "#C68904" },
    { name: "Duplicate Claim", percentage: 12, color: "var(--accent-green)", bgColor: "rgba(63, 185, 80, 0.1)", textColor: "var(--accent-green)" },
    { name: "Coverage Expired", percentage: 8, color: "var(--accent-primary)", bgColor: "rgba(41, 128, 211, 0.1)", textColor: "var(--accent-primary)" },
];

const TopRejectionReasons: React.FC = () => {
    const [animatedBars, setAnimatedBars] = React.useState(rejectionReasons.map(() => 0));
    const [animatedTotal, setAnimatedTotal] = React.useState(0);
    const [isVisible, setIsVisible] = React.useState(false);
    const totalRejections = 30;

    React.useEffect(() => { setIsVisible(true); }, []);

    React.useEffect(() => {
        if (!isVisible) return;
        const duration = 2500;
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setAnimatedBars(rejectionReasons.map(item => item.percentage * eased));
            setAnimatedTotal(Math.round(totalRejections * eased));
            if (progress < 1) requestAnimationFrame(animate);
            else { setAnimatedBars(rejectionReasons.map(item => item.percentage)); setAnimatedTotal(totalRejections); }
        };
        requestAnimationFrame(animate);
    }, [isVisible]);

    return (
        <DashboardCard className="flex flex-col flex-1" padding="none" style={{ padding: 16, gap: 15 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Text variant="body-md-semibold" color="text-primary" className="font-bold">Top 5 Rejection Reasons</Text>
                    <Text variant="body-sm" color="text-secondary">All Departments · Last 6 Months</Text>
                </div>
                <div className="bg-accent-primary/10 rounded-[5px] whitespace-nowrap" style={{ padding: '4px 7px' }}>
                    <Text variant="body-sm-semibold" color="accent-primary"><span className="tabular-nums">{animatedTotal}</span> Total</Text>
                </div>
            </div>
            <div className="flex h-[35px] rounded-[10px] overflow-hidden">
                <div className="shrink-0 bg-accent-red rounded-l-[10px] transition-all duration-100" style={{ width: `${animatedBars[0]}%` }} />
                <div className="shrink-0 bg-[#FF9257] transition-all duration-100" style={{ width: `${animatedBars[1]}%` }} />
                <div className="shrink-0 bg-[#FFCA57] transition-all duration-100" style={{ width: `${animatedBars[2]}%` }} />
                <div className="shrink-0 bg-accent-green transition-all duration-100" style={{ width: `${animatedBars[3]}%` }} />
                <div className="flex-1 bg-accent-primary rounded-r-[10px] transition-all duration-100" style={{ minWidth: `${animatedBars[4]}%` }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rejectionReasons.map((reason, index) => (
                    <React.Fragment key={reason.name}>
                        <div className="flex items-center justify-between hover:bg-secondary/50 rounded-md px-1 -mx-1 transition-colors">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <div className="w-[10px] h-[10px] rounded-[2px]" style={{ backgroundColor: reason.color }} />
                                <Text variant="body-sm" color="text-primary">{reason.name}</Text>
                            </div>
                            <div className="rounded-[5px]" style={{ backgroundColor: reason.bgColor, padding: '4px 7px' }}>
                                <span className="text-[12px] font-semibold tabular-nums" style={{ color: reason.textColor }}>{Math.round(animatedBars[index])}%</span>
                            </div>
                        </div>
                        {index < rejectionReasons.length - 1 && <div className="border-t border-tertiary" />}
                    </React.Fragment>
                ))}
            </div>
        </DashboardCard>
    );
};

export default TopRejectionReasons;
