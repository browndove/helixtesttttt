'use client';

import { useState, useEffect } from "react";
import Text from "../text";
import { ThemeToggle } from "../theme-toggle";
import Dropdown from "../dropdown";
import { IoCalendar, IoSearch } from "react-icons/io5";
import { HiMiniUserGroup } from "react-icons/hi2";
import Image from "next/image";
import { RiCommandFill } from "react-icons/ri";
import clsx from "clsx";

interface TopbarProps {
    title: string;
    subtitle?: string;
}

const departmentOptions = [
    { value: "all", label: "All Departments" },
    { value: "emergency", label: "Emergency" },
    { value: "icu", label: "ICU" },
    { value: "surgery", label: "Surgery" },
    { value: "pediatrics", label: "Pediatrics" },
    { value: "cardiology", label: "Cardiology" },
    { value: "radiology", label: "Radiology" },
    { value: "pharmacy", label: "Pharmacy" },
];

const Topbar = ({ title, subtitle }: TopbarProps) => {
    const [department, setDepartment] = useState("all");
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    return (
        <div className="w-full">
            <div
                className={clsx(
                    "flex items-center justify-between w-full sticky top-0 z-10 pt-[15px]",
                    "transition-all duration-700 ease-out",
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
                )}
                style={{ boxShadow: '0 0px 10px 10px var(--bg-secondary)' }}
            >
                {/* Title Section */}
                <div className="flex flex-col gap-0.5">
                    <Text variant="body-md-semibold" color="text-primary">
                        {title}
                    </Text>
                    {subtitle && (
                        <Text variant="body-sm" color="text-secondary">
                            {subtitle}
                        </Text>
                    )}
                </div>

                {/* Actions Section */}
                <div className="flex items-center gap-4">
                    {/* Year to date filter */}
                    <div className={clsx(
                        "flex items-center gap-2 bg-primary rounded-full px-4 py-2.5 h-[40px] shadow-soft",
                        "transition-all duration-300 cursor-pointer",
                        "hover:shadow-md hover:scale-[1.02]"
                    )}>
                        <IoCalendar className="w-3.5 h-3.5 text-text-secondary" />
                        <Text variant="body-sm" color="text-secondary">
                            Year to date
                        </Text>
                    </div>

                    {/* Department filter dropdown */}
                    <Dropdown
                        options={departmentOptions}
                        value={department}
                        onChange={setDepartment}
                        icon={<HiMiniUserGroup className="w-3.5 h-3.5" />}
                    />

                    {/* Search */}
                    <div className={clsx(
                        "flex items-center justify-between bg-primary rounded-full pl-4 pr-2 py-2 shadow-soft w-[280px]",
                        "transition-all duration-300 cursor-pointer",
                        "hover:shadow-md hover:scale-[1.01]"
                    )}>
                        <div className="flex items-center gap-2">
                            <IoSearch className="w-3.5 h-3.5 text-text-tertiary" />
                            <Text variant="body-sm" color="text-tertiary">
                                Search anything...
                            </Text>
                        </div>
                        <div className={clsx(
                            "flex items-center justify-center bg-tertiary rounded-full size-6",
                            "transition-all duration-300",
                            "hover:bg-quaternary hover:scale-110"
                        )}>
                            <RiCommandFill className="w-2 h-2 text-text-primary" />
                            <Text variant="body-xs" color="text-primary" className="font-semibold">K</Text>
                        </div>
                    </div>

                    {/* User profile */}
                    <div className={clsx(
                        "flex items-center gap-2 bg-primary rounded-full pl-1.5 pr-3 py-1.5 shadow-soft",
                        "transition-all duration-300 cursor-pointer",
                        "hover:shadow-md hover:scale-[1.02]"
                    )}>
                        <div className={clsx(
                            "w-7 h-7 rounded-full bg-tertiary",
                            "transition-transform duration-300",
                            "hover:scale-110"
                        )}>
                            <Image
                                src="/assets/images/dr-tanko.png"
                                alt="User"
                                width={28}
                                height={28}
                                className="object-cover w-full h-full"
                            />
                        </div>
                        <Text variant="body-sm" color="text-secondary">
                            Dr. Abdul-Samed Tanko
                        </Text>
                    </div>

                    {/* Theme toggle */}
                    <ThemeToggle />
                </div>
            </div>
        </div>
    );
};

export default Topbar;
