"use client";

import * as React from "react";
import Text from "@/components/text";
import DashboardCard from "@/components/ugmc-dashboard/shared/dashboard-card";
import { useState } from "react";
import { RiExpandDiagonalLine } from "react-icons/ri";
import { GrContract } from "react-icons/gr";
import InfoTooltip from "@/components/info-tooltip";

const infoText = "Average wait time in minutes by hour of day and day of week.";

// Wait time data: hours (rows) x days (columns)
// More varied and realistic wait times to avoid repetition
const waitTimeData = [
    { hour: "12 AM", values: [18.7, 22.4, 31.9, 26.3, 14.1, 17.8, 23.5] },
    { hour: "2 AM", values: [21.3, 16.2, 42.7, 38.4, 19.6, 15.9, 18.3] },
    { hour: "4 AM", values: [13.8, 12.5, 14.9, 16.1, 11.2, 13.7, 14.4] },
    { hour: "6 AM", values: [14.2, 27.6, 18.4, 22.9, 15.8, 16.3, 17.1] },
    { hour: "8 AM", values: [19.5, 28.7, 41.3, 17.6, 31.2, 46.8, 20.4] },
    { hour: "10 AM", values: [16.8, 18.3, 22.1, 19.7, 17.4, 25.9, 16.2] },
    { hour: "12 PM", values: [29.4, 17.9, 43.6, 21.3, 18.7, 27.8, 19.5] },
    { hour: "2 PM", values: [18.2, 19.6, 26.8, 17.4, 30.5, 39.2, 16.8] },
    { hour: "4 PM", values: [20.7, 33.1, 23.9, 19.8, 21.6, 18.5, 22.3] },
    { hour: "6 PM", values: [24.3, 19.2, 18.7, 17.9, 44.2, 16.4, 19.8] },
    { hour: "8 PM", values: [17.6, 31.4, 40.8, 18.9, 16.7, 29.1, 21.5] },
    { hour: "10 PM", values: [19.4, 25.7, 17.3, 28.6, 18.1, 16.9, 20.2] },
    { hour: "11 PM", values: [16.5, 22.8, 18.9, 26.3, 17.2, 15.6, 19.7] },
];

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Red scale: from light pink to dark red based on wait time intensity
const getHeatmapColor = (value: number | null): string => {
    if (value === null) return "#FFE7E5"; // Very light for empty
    if (value >= 40) return "#D80D03"; // Darkest red - very high (40+ mins)
    if (value >= 30) return "#FF3D33"; // Medium-dark red - high (30-39.9 mins)
    if (value >= 20) return "#FF8A80"; // Light coral - medium (20-29.9 mins)
    return "#FFE7E5"; // Light pink - low (<20 mins)
};

const getTextColor = (value: number | null): string => {
    if (value === null) return "#000000";
    if (value >= 44) return "#FFFFFF"; // White text for darkest red
    if (value >= 30) return "#FFFFFF"; // White text for medium-dark red
    if (value >= 20) return "#000000"; // Pure black text for light coral
    return "#000000"; // Pure black text for light pink
};

const AverageWaitTime: React.FC = () => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [animatedData, setAnimatedData] = useState(waitTimeData.map(row => ({ ...row, values: row.values.map(() => 0) })));
    const [isVisible, setIsVisible] = useState(false);

    React.useEffect(() => {
        setIsVisible(true);
    }, []);

    // Animate the heatmap cells
    React.useEffect(() => {
        if (!isVisible) return;
        
        const duration = 1500;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            setAnimatedData(waitTimeData.map(row => ({
                ...row,
                values: row.values.map(val => val * eased)
            })));
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setAnimatedData(waitTimeData);
            }
        };
        requestAnimationFrame(animate);
    }, [isVisible]);

    return (
        <DashboardCard
            className={`flex flex-col gap-2 transition-all duration-300 ${isFullscreen ? "fixed inset-0 z-50 m-4 h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] bg-white overflow-auto" : ""
                }`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex shrink-0 justify-between items-start">
                <div className="flex flex-col gap-0.5">
                    <Text variant="body-md-semibold" color="text-primary">
                        Average Wait Time (mins)
                    </Text>
                    <Text variant="body-sm" color="text-tertiary">
                        Last 7 days
                    </Text>
                </div>
                <div className="flex items-center gap-2">
                    <InfoTooltip text={infoText} show={isHovered} />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full table-fixed border-separate border-spacing-0">
                    <thead>
                        <tr>
                            <th className="w-[42px]"></th>
                            {days.map((day) => (
                                <th key={day} className="text-center" style={{ padding: '0 2px 4px' }}>
                                    <span className="text-[10px] font-medium text-text-secondary">{day}</span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {animatedData.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                <td className="text-right align-middle" style={{ padding: '1px 4px 1px 0' }}>
                                    <span className="text-[10px] font-medium text-text-secondary whitespace-nowrap">
                                        {row.hour}
                                    </span>
                                </td>
                                {row.values.map((value, colIndex) => (
                                    <td
                                        key={colIndex}
                                        className="text-center align-middle rounded-[3px] transition-all duration-100"
                                        style={{ backgroundColor: getHeatmapColor(value), padding: '2px 1px' }}
                                    >
                                        <span
                                            className="text-[10px] font-medium tabular-nums leading-none"
                                            style={{ color: getTextColor(value) }}
                                        >
                                            {value !== null ? value.toFixed(1) : ""}
                                        </span>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </DashboardCard>
    );
};

export default AverageWaitTime;

